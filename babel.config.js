module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54+) already injects react-native-worklets/plugin,
    // which Reanimated 4 requires. Adding it manually double-applies it.
    presets: ['babel-preset-expo'],
  };
};
