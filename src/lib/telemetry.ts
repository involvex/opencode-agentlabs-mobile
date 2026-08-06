/**
 * Telemetry disabled — no-op implementation.
 *
 * All consent functions return "denied" and initializers are no-ops.
 * Kept for API compatibility with existing imports.
 */

import * as SecureStore from "expo-secure-store";

const CONSENT_KEY = "opencode_telemetry_consent";

export type ConsentState = "granted" | "denied" | "unknown";

let _resolved: boolean | null = null;

export async function loadTelemetryConsent(): Promise<ConsentState> {
  try {
    const stored = await SecureStore.getItemAsync(CONSENT_KEY);
    if (stored === "granted") {
      _resolved = true;
      return "granted";
    }
    if (stored === "denied") {
      _resolved = false;
      return "denied";
    }
    _resolved = false;
    return "denied";
  } catch {
    _resolved = false;
    return "denied";
  }
}

export function hasTelemetryConsent(): boolean | null {
  return _resolved;
}

export function setTelemetryConsent(granted: boolean): Promise<void> {
  return (async () => {
    if (granted) {
      await SecureStore.setItemAsync(CONSENT_KEY, "granted");
      _resolved = true;
      return;
    }
    _resolved = false;
    try {
      await SecureStore.setItemAsync(CONSENT_KEY, "denied");
    } catch {
      await SecureStore.deleteItemAsync(CONSENT_KEY);
    }
  })();
}
