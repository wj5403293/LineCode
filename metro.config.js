const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    extraNodeModules: {
      fs: require.resolve('./polyfills/empty.js'),
      'node:fs': require.resolve('./polyfills/empty.js'),
      path: require.resolve('./polyfills/empty.js'),
      'node:path': require.resolve('./polyfills/empty.js'),
      os: require.resolve('./polyfills/empty.js'),
      'node:os': require.resolve('./polyfills/empty.js'),
      https: require.resolve('./polyfills/empty.js'),
      'node:https': require.resolve('./polyfills/empty.js'),
      stream: require.resolve('./polyfills/empty.js'),
      'node:stream': require.resolve('./polyfills/empty.js'),
      url: require.resolve('./polyfills/empty.js'),
      'node:url': require.resolve('./polyfills/empty.js'),
      crypto: require.resolve('./polyfills/empty.js'),
      'node:crypto': require.resolve('./polyfills/empty.js'),
      zlib: require.resolve('./polyfills/empty.js'),
      'node:zlib': require.resolve('./polyfills/empty.js'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
