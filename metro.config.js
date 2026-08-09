const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * WatermelonDB requires .js resolution priority handled correctly with
 * Metro's default config; no custom resolver overrides needed beyond this.
 * https://reactnative.dev/docs/metro
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
