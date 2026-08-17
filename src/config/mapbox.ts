/**
 * Public Mapbox access token (starts with "pk."), from
 * https://account.mapbox.com/access-tokens/ - rate-limited and scoped to
 * your account, not a build-time secret, so it's fine for this file to be
 * committed and to ship inside the app bundle. Replace the placeholder
 * below with your real token before building.
 *
 * This is deliberately a plain committed file rather than a gitignored
 * one: a gitignored file that's statically `require`'d/imported would
 * leave Metro unable to resolve the module on a fresh clone (before
 * anyone has created it locally), breaking the build for every new
 * checkout rather than just failing at runtime with a clear error.
 *
 * For a real deployment, prefer injecting this via your CI/build
 * pipeline's secret store (e.g. react-native-config, or a build-time
 * sed/envsubst step) rather than hand-editing this file per machine -
 * this placeholder pattern is meant to get local development unblocked,
 * not to be the production secret-management story.
 */
export const MAPBOX_ACCESS_TOKEN = 'REPLACE_WITH_YOUR_MAPBOX_PUBLIC_TOKEN';
