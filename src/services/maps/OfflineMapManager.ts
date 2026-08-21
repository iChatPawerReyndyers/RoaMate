import { OfflineManager } from '@maplibre/maplibre-react-native';
import { createMMKV } from 'react-native-mmkv';
import { MAP_STYLE_URL } from '@/config/mapTiles';

/**
 * MapLibre v11's OfflineManager identifies packs by an auto-generated id
 * (createPack returns it), not a caller-chosen name the way the old
 * Mapbox SDK did - there's no more getPack(name)/deletePack(name). This
 * local map is what lets the rest of this file (and AutoOfflineMapSync)
 * keep working in terms of tripId, and also tracks when each pack was
 * downloaded and what itinerary it covered, so staleness can be judged
 * without asking the native SDK (which only knows pack size/progress, not
 * "is this still the right region").
 */
const storage = createMMKV({ id: 'roamate-offline-maps' });
const PACK_META_KEY = 'trip-pack-meta';

interface PackMeta {
  packId: string;
  downloadedAt: number;
  /** Cheap fingerprint of the destination coordinates this pack was built from - see hashCoordinates. */
  destinationsHash: string;
}

function loadPackMetaMap(): Record<string, PackMeta> {
  const raw = storage.getString(PACK_META_KEY);
  return raw ? JSON.parse(raw) : {};
}

function savePackMetaMap(map: Record<string, PackMeta>): void {
  storage.set(PACK_META_KEY, JSON.stringify(map));
}

/**
 * Cheap, stable fingerprint of a coordinate set - sorted so the same
 * destinations in a different fetch order still hash identically, rounded
 * to ~11m precision so float noise doesn't cause spurious "changed"
 * detections. Only needs to detect "did the itinerary meaningfully
 * change", not cryptographic uniqueness.
 */
function hashCoordinates(coordinates: { lat: number; lng: number }[]): string {
  return coordinates
    .map(c => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`)
    .sort()
    .join('|');
}

/** Per the spec: offline vector tile cache is capped at 500MB total, across every downloaded trip. */
export const OFFLINE_MAP_CAP_BYTES = 500 * 1024 * 1024;

/** How long a pack can go without being re-verified before it's considered stale even if the itinerary hasn't changed - tiles for a region can go out of date upstream (new roads, renamed places) independent of RoaMate's own data. */
export const OFFLINE_PACK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface OfflinePackSummary {
  tripId: string;
  bytes: number;
  percentage: number;
  downloadedAt: number;
}

export class OfflineStorageFullError extends Error {
  constructor(public readonly currentBytes: number) {
    super('Offline map storage is at its 500MB cap. Delete another trip\'s offline map to free up space.');
    this.name = 'OfflineStorageFullError';
  }
}

/**
 * Lists every downloaded pack (across all trips) with its current size on
 * disk. Self-heals the local tripId->pack metadata map if a pack it
 * references no longer exists on-device (e.g. OfflineManager.
 * resetDatabase() was called elsewhere, or app storage was cleared) -
 * drops that one stale entry rather than one missing pack breaking every
 * other trip's summary.
 */
export async function listOfflinePacks(): Promise<OfflinePackSummary[]> {
  const packMetaMap = loadPackMetaMap();
  const summaries: OfflinePackSummary[] = [];
  let mapChanged = false;

  for (const [tripId, meta] of Object.entries(packMetaMap)) {
    try {
      const pack = await OfflineManager.getPack(meta.packId);
      const status = await pack.status();
      summaries.push({ tripId, bytes: status.completedResourceSize, percentage: status.percentage, downloadedAt: meta.downloadedAt });
    } catch (err) {
      console.warn(`Offline pack for trip ${tripId} referenced locally but not found on-device, dropping stale mapping`, err);
      delete packMetaMap[tripId];
      mapChanged = true;
    }
  }

  if (mapChanged) savePackMetaMap(packMetaMap);
  return summaries;
}

export async function totalOfflineBytes(): Promise<number> {
  const packs = await listOfflinePacks();
  return packs.reduce((sum, p) => sum + p.bytes, 0);
}

export async function deleteOfflinePackForTrip(tripId: string): Promise<void> {
  const packMetaMap = loadPackMetaMap();
  const meta = packMetaMap[tripId];
  if (!meta) return;

  await OfflineManager.deletePack(meta.packId);
  delete packMetaMap[tripId];
  savePackMetaMap(packMetaMap);
}

export async function getOfflinePackForTrip(tripId: string): Promise<OfflinePackSummary | null> {
  const packMetaMap = loadPackMetaMap();
  const meta = packMetaMap[tripId];
  if (!meta) return null;

  try {
    const pack = await OfflineManager.getPack(meta.packId);
    const status = await pack.status();
    return { tripId, bytes: status.completedResourceSize, percentage: status.percentage, downloadedAt: meta.downloadedAt };
  } catch (err) {
    console.warn(`Offline pack for trip ${tripId} referenced locally but not found on-device, dropping stale mapping`, err);
    delete packMetaMap[tripId];
    savePackMetaMap(packMetaMap);
    return null;
  }
}

/**
 * Used by AutoOfflineMapSync to decide whether a (re)download is worth
 * doing right now, without actually starting one - true when there's no
 * pack yet for this trip, the itinerary has changed since the pack was
 * built, or the pack is older than OFFLINE_PACK_MAX_AGE_MS.
 */
export async function shouldRefreshOfflinePack(tripId: string, coordinates: { lat: number; lng: number }[]): Promise<boolean> {
  const packMetaMap = loadPackMetaMap();
  const meta = packMetaMap[tripId];
  if (!meta) return true;

  const isStale = Date.now() - meta.downloadedAt >= OFFLINE_PACK_MAX_AGE_MS;
  const itineraryChanged = meta.destinationsHash !== hashCoordinates(coordinates);
  return isStale || itineraryChanged;
}

/**
 * Downloads an offline region covering the given coordinates (destinations
 * and/or last-known member locations) plus a fixed padding margin, so the
 * cached map is still pannable a little beyond the pins themselves.
 *
 * Enforces the 500MB total cap up front: refuses to start a new download
 * if downloading this trip isn't already in progress/complete and the
 * existing total across all trips is already at or over the cap. This
 * deliberately does NOT auto-evict another trip's saved offline map to
 * make room - that's a surprising thing to happen silently, so the caller
 * (OfflineMapControl, AutoOfflineMapSync) surfaces OfflineStorageFullError
 * and lets the person choose what to delete, rather than doing it for them.
 */
export async function downloadOfflinePackForTrip(
  tripId: string,
  coordinates: { lat: number; lng: number }[],
  onProgress?: (status: { percentage: number; bytes: number }) => void,
): Promise<void> {
  const packMetaMap = loadPackMetaMap();

  const existingMeta = packMetaMap[tripId];
  if (existingMeta) {
    // Re-downloading (e.g. the itinerary changed, or it's just stale) -
    // drop the old pack first rather than layering a second one for the
    // same trip.
    try {
      await OfflineManager.deletePack(existingMeta.packId);
    } catch (err) {
      console.warn(`Failed to delete stale offline pack for trip ${tripId} before re-downloading`, err);
    }
    delete packMetaMap[tripId];
  }

  const otherPacksTotal = (await listOfflinePacks())
    .filter(p => p.tripId !== tripId)
    .reduce((sum, p) => sum + p.bytes, 0);

  if (otherPacksTotal >= OFFLINE_MAP_CAP_BYTES) {
    throw new OfflineStorageFullError(otherPacksTotal);
  }

  const bounds = boundsWithPadding(coordinates);

  const pack = await OfflineManager.createPack(
    {
      mapStyle: MAP_STYLE_URL,
      minZoom: 10,
      maxZoom: 16,
      bounds,
      metadata: { tripId },
    },
    (_pack, status) => {
      onProgress?.({ percentage: status.percentage, bytes: status.completedResourceSize });
    },
    (_pack, err) => {
      console.warn('Offline pack download error', err);
    },
  );

  packMetaMap[tripId] = { packId: pack.id, downloadedAt: Date.now(), destinationsHash: hashCoordinates(coordinates) };
  savePackMetaMap(packMetaMap);
}

/**
 * [west, south, east, north] - MapLibre v11's flat bounds format (the old
 * Mapbox SDK used nested [[neLng,neLat],[swLng,swLat]] corner pairs
 * instead). Note the ordering here is [lng, lat] within each value, the
 * opposite of the {lat, lng} shape used by the rest of this app's API
 * responses.
 */
function boundsWithPadding(coordinates: { lat: number; lng: number }[]): [number, number, number, number] {
  if (coordinates.length === 0) {
    // No pinned destinations or member locations yet - fall back to a
    // small region around the app's generic Philippines default center
    // (see MapScreen's DEFAULT_CENTER) so there's still something
    // downloadable rather than an invalid empty-bounds request.
    return [120.774, 11.8797, 122.774, 13.8797];
  }

  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const pad = 0.1; // ~11km of margin at the equator, enough to pan around each pin while offline

  return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
}