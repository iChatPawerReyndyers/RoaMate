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
 * "Outdoors" is the closest MapTiler style to the Mapbox Outdoors style
 * this app used before (Mapbox.StyleURL.Outdoors in the old MapScreen/
 * OfflineMapManager) - trail-oriented styling with terrain shading, a good
 * fit for GEO-01..05's hiking/itinerary use case. Swap the style name here
 * (e.g. "streets-v2", "topo-v2") to change it app-wide in one place - see
 * https://cloud.maptiler.com/maps/ for the full catalog.
 */
export const MAP_STYLE_URL = `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_API_KEY}`;