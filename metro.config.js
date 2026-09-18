const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// lucide-react-native resolves its ~1,800 icon modules as .mjs, which is not in
// Metro's default sourceExts. Without this, any lucide import fails with
// "Unable to resolve module ./icons/<name>.mjs".
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
