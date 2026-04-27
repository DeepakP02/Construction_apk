const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Explicitly tell Metro where node_modules and assets are
config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.assetExts.push('png', 'jpg', 'jpeg', 'svg');

module.exports = config;
