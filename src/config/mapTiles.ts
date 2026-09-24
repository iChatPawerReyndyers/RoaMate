/**
 * MapTiler free-tier API key, from https://cloud.maptiler.com/account/keys/
 * (no credit card, no corporate email required - free tier is 100k tile
 * requests + 5k map sessions/month, non-commercial use, MapTiler
 * attribution required on the map). Replace the placeholder below with
 * your real key before building.
 *
 * Same committed-placeholder pattern as the old src/config/mapbox.ts this
 * file replaces, for the same reason: a gitignored file that's statically
 * imported would leave Metro unable to resolve the module on a fresh
 * clone, breaking the build entirely rather than failing at runtime with
 * a clear error.
 *
 * DELETE src/config/mapbox.ts - it's replaced by this file. Nothing in the
 * app imports it anymore after the MapLibre migration.
 */
export const MAPTILER_API_KEY = '5HGi25NPfkGuCM0EBMq6';

/**
 * The three map views the Map tab's "Map type" picker offers - the same
 * three Google Maps has. Each is just a different MapTiler style ID behind
 * the same API key; see https://cloud.maptiler.com/maps/ for the catalog.
 *
 *   default   streets-v2  the classic road map
 *   satellite hybrid      satellite imagery WITH labels, roads and borders
 *                         (use "satellite" instead for imagery with no labels)
 *   terrain   outdoor-v2  trail-oriented styling with contours, peaks and
 *                         hillshade - the closest MapTiler match to the Mapbox
 *                         Outdoors style this app used originally, and the
 *                         style the app has always shown
 */
export type MapType = 'default' | 'satellite' | 'terrain';

export interface MapTypeOption {
  id: MapType;
  label: string;
  /** MapTiler style ID. */
  styleId: string;
}

/** In picker order (Google's order). */
export const MAP_TYPES: readonly MapTypeOption[] = [
  { id: 'default', label: 'Default', styleId: 'streets-v2' },
  { id: 'satellite', label: 'Satellite', styleId: 'hybrid' },
  { id: 'terrain', label: 'Terrain', styleId: 'outdoor-v2' },
];

/**
 * What a fresh install shows, and what an unreadable saved choice falls
 * back to. Terrain on purpose: it's the view the app has always had, and
 * it's the one offline map downloads cover (see MAP_STYLE_URL below).
 */
export const DEFAULT_MAP_TYPE: MapType = 'terrain';

export function isMapType(value: unknown): value is MapType {
  return MAP_TYPES.some(option => option.id === value);
}

export function mapStyleUrl(type: MapType): string {
  const option = MAP_TYPES.find(o => o.id === type) ?? (MAP_TYPES.find(o => o.id === DEFAULT_MAP_TYPE) as MapTypeOption);
  return `https://api.maptiler.com/maps/${option.styleId}/style.json?key=${MAPTILER_API_KEY}`;
}

/**
 * The Terrain style. OfflineMapManager downloads offline packs for exactly
 * this style, so offline maps keep covering the Terrain view only -
 * Default and Satellite need a connection (satellite imagery would also
 * blow through the 500MB offline cap very quickly). Use mapStyleUrl() for
 * what the live map should show.
 */
export const MAP_STYLE_URL = mapStyleUrl('terrain');