const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable Hermes for better performance on Android
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;