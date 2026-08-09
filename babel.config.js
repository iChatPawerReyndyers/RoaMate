module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // WatermelonDB's @field/@text/@children decorators require this -
    // "legacy: true" specifically, per WatermelonDB's own install docs
    // (their decorator style predates the modern stage-3 proposal).
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],
  ],
};
