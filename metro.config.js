const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Vendored xterm.js sources live under assets/terminal/ with a `.txt`
// suffix so Metro bundles them as static text assets (read at runtime via
// expo-asset + expo-file-system) instead of parsing them as source modules.
config.resolver.assetExts.push("txt");

module.exports = config;
