/**
 * Expo config plugin: guarantee RECORD_AUDIO survives prebuild.
 *
 * Root cause: `expo-image-picker` with `microphonePermission: false` calls
 * `withBlockedPermissions(RECORD_AUDIO)`, which emits
 * `<uses-permission RECORD_AUDIO tools:node="remove"/>`. That strips the
 * permission even though `expo-speech-recognition` (and
 * `android.permissions` in app.json) declares it, so
 * `requestPermissionsAsync()` never shows an OS dialog and voice input fails.
 *
 * This plugin runs after all other permission plugins: it drops any
 * `tools:node="remove"` / `tools:node="replace"` block on RECORD_AUDIO and
 * ensures a plain `<uses-permission android:name="android.permission.RECORD_AUDIO"/>`
 * entry exists. Idempotent and order-safe.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const RECORD_AUDIO = "android.permission.RECORD_AUDIO";

module.exports = function withRecordAudio(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const current = manifest["uses-permission"] || [];
    const kept = current.filter((entry) => {
      const name = entry.$?.["android:name"];
      if (name !== RECORD_AUDIO) return true;
      const node = entry.$?.["tools:node"];
      // Drop any block/remove entry for RECORD_AUDIO; we re-add a clean one below.
      return node !== "remove" && node !== "replace";
    });
    const hasRecordAudio = kept.some(
      (entry) => entry.$?.["android:name"] === RECORD_AUDIO,
    );
    if (!hasRecordAudio) {
      kept.push({ $: { "android:name": RECORD_AUDIO } });
    }
    manifest["uses-permission"] = kept;
    return config;
  });
};
