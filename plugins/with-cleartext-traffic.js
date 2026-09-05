/**
 * Expo config plugin: set android:usesCleartextTraffic="true".
 *
 * The app connects to user-configured opencode servers over plain HTTP on
 * LAN/Tailscale (any host/IP the user types in, so no allowlist is possible).
 * Release builds block cleartext by default (debuggable builds allow it),
 * which breaks the SSE event stream, model list, and terminal while cached
 * sessions still render — see android/app/src/main/AndroidManifest.xml.
 * There is no first-class app.json key for this, hence this plugin.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:usesCleartextTraffic"] = "true";
    }
    return config;
  });
};
