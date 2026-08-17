import Mapbox from '@rnmapbox/maps';

/** Per the spec: offline vector tile cache is capped at 500MB total, across every downloaded trip. */
export const OFFLINE_MAP_CAP_BYTES = 500 * 1024 * 1024;

export interface OfflinePackSummary {
  name: string;
  tripId: string;
  bytes: number;
  percentage: number;
}

export class OfflineStorageFullError extends Error {
  constructor(public readonly currentBytes: number) {
    super('Offline map storage is at its 500MB cap. Delete another trip\'s offline map to free up space.');
    this.name = 'OfflineStorageFullError';
  }
}

function packNameForTrip(tripId: string): string {
  return `trip-${tripId}`;
}

function tripIdFromPackName(packName: string): string {
  return packName.replace(/^trip-/, '');
}

/** Lists every downloaded pack (across all trips) with its current size on disk. */
export async function listOfflinePacks(): Promise<OfflinePackSummary[]> {
  const packs = await Mapbox.offlineManager.getPacks();
  const summaries = await Promise.all(
    packs.map(async pack => {
      const status = await pack.status();
      return {
        name: pack.name,
        tripId: tripIdFromPackName(pack.name),
        bytes: status.completedResourceSize,
        percentage: status.percentage,
      };
    }),
  );
  return summaries;
}

export async function totalOfflineBytes(): Promise<number> {
  const packs = await listOfflinePacks();
  return packs.reduce((sum, p) => sum + p.bytes, 0);
}

export async function deleteOfflinePackForTrip(tripId: string): Promise<void> {
  await Mapbox.offlineManager.deletePack(packNameForTrip(tripId));
}

export async function getOfflinePackForTrip(tripId: string): Promise<OfflinePackSummary | null> {
  const pack = await Mapbox.offlineManager.getPack(packNameForTrip(tripId));
  if (!pack) return null;
  const status = await pack.status();
  return { name: pack.name, tripId, bytes: status.completedResourceSize, percentage: status.percentage };
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
 * (OfflineMapControl) surfaces OfflineStorageFullError and lets the person
 * choose what to delete.
 */
export async function downloadOfflinePackForTrip(
  tripId: string,
  coordinates: { lat: number; lng: number }[],
  onProgress?: (status: { percentage: number; bytes: number }) => void,
): Promise<void> {
  const packName = packNameForTrip(tripId);

  const existingForThisTrip = await Mapbox.offlineManager.getPack(packName);
  if (existingForThisTrip) {
    // Re-downloading (e.g. the itinerary changed since last download) -
    // drop the stale pack first rather than layering a second one under
    // the same name, which the native SDK doesn't support.
    await Mapbox.offlineManager.deletePack(packName);
  }

  const otherPacksTotal = (await listOfflinePacks())
    .filter(p => p.tripId !== tripId)
    .reduce((sum, p) => sum + p.bytes, 0);

  if (otherPacksTotal >= OFFLINE_MAP_CAP_BYTES) {
    throw new OfflineStorageFullError(otherPacksTotal);
  }

  const bounds = boundsWithPadding(coordinates);

  await Mapbox.offlineManager.createPack(
    {
      name: packName,
      styleURL: Mapbox.StyleURL.Outdoors,
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
}

/**
 * [[neLng, neLat], [swLng, swLat]] - Mapbox's bounds format, and note the
 * coordinate order within each corner is [lng, lat], the opposite of the
 * {lat, lng} shape used by the rest of this app's API responses.
 */
function boundsWithPadding(coordinates: { lat: number; lng: number }[]): [[number, number], [number, number]] {
  if (coordinates.length === 0) {
    // No pinned destinations or member locations yet - fall back to a
    // small region around the app's generic Philippines default center
    // (see MapScreen's DEFAULT_REGION) so there's still something
    // downloadable rather than an invalid empty-bounds request.
    return [
      [122.774, 13.8797],
      [120.774, 11.8797],
    ];
  }

  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const pad = 0.1; // ~11km of margin at the equator, enough to pan around each pin while offline

  return [
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
  ];
}
