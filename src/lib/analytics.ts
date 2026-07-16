// Centralised PostHog wrapper for activation-funnel analytics.
//
// Mirrors sentry.ts's shape and guarantees:
//   1. Strict no-op when no API key is configured (dev/CI builds need no secrets).
//   2. Strict no-op when the user has not granted telemetry consent — this
//      module never calls PostHog.init/capture on its own; it is only ever
//      driven by ./telemetry.ts, which gates BOTH Sentry and analytics behind
//      the exact same "opencode_telemetry_consent" flag.
//   3. No PII in event properties: never pass server URLs, tokens, prompts,
//      or file contents. Only coarse, enumerated event names + small typed
//      properties (booleans, enums, counts).
//
// Chosen SDK: PostHog (posthog-react-native), self-instantiated (no
// PostHogProvider / autocapture) so the app controls exactly what is sent —
// same "explicit event, no magic" posture as sentry.ts.

import PostHog from "posthog-react-native"
import * as SecureStore from "expo-secure-store"
import { log } from "./logbuffer"

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY
// EU by default (GDPR-friendly region for opencode's mostly-EU/self-hosted user base).
// Override with EXPO_PUBLIC_POSTHOG_HOST for a self-hosted instance.
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com"

const FIRST_OPEN_KEY = "opencode_analytics_first_open_done"

let client: PostHog | null = null
let enabled = false

/** Coarse, non-identifying failure buckets — never include the raw error string
 *  (it may embed hostnames/tokens/paths). Reuses the vocabulary already
 *  established by diagnostics-classify.ts's Classification type. */
export type ConnectionErrorClass =
  | "malformed-url"
  | "no-internet"
  | "server-unreachable"
  | "unauthorized"
  | "tls-error"
  | "timeout"
  | "unknown"

/** Activation-funnel events. Keep this list in 1:1 sync with the funnel steps
 *  tracked in the product analytics dashboard. */
export enum AnalyticsEvent {
  /** App process started and the user has an existing telemetry decision of "granted". */
  AppOpened = "app_opened",
  /** User tapped Connect/Save with a non-empty server URL (quick or advanced mode). */
  ConnectionFormSubmitted = "connection_form_submitted",
  /** A real network call to test/establish the connection started. */
  ConnectionAttempted = "connection_attempted",
  /** The connection attempt succeeded (health check / project fetch responded). */
  ConnectionSucceeded = "connection_succeeded",
  /** The connection attempt failed. Always paired with `error_class`. */
  ConnectionFailed = "connection_failed",
  /** User sent a prompt/message to an agent session (excludes slash commands). */
  MessageSent = "message_sent",
  /** An agent response finished streaming (session transitioned busy -> idle). */
  ResponseReceived = "response_received",
}

export function initAnalytics() {
  if (enabled) return
  if (!API_KEY) {
    log.info("analytics", "no API key configured — analytics disabled")
    return
  }
  try {
    client = new PostHog(API_KEY, {
      host: HOST,
      // We call track() explicitly at each funnel step — no implicit capture.
      captureAppLifecycleEvents: false,
    })
    enabled = true
    log.info("analytics", "initialized", `host=${HOST}`)
  } catch (e) {
    log.warn("analytics", "init failed", String(e))
  }
}

export async function shutdownAnalytics() {
  if (!enabled || !client) return
  enabled = false
  const c = client
  client = null
  try {
    await c.shutdown()
  } catch (e) {
    log.warn("analytics", "shutdown failed", String(e))
  }
  log.info("analytics", "disabled by user")
}

export function analyticsEnabled(): boolean {
  return enabled
}

/** Flat, JSON-safe event properties — keep it to primitives so nothing
 *  accidentally nests an object that could carry a URL/token. */
export type AnalyticsProps = Record<string, string | number | boolean | null>

/** No-op unless consent has been granted (initAnalytics() was called) and a
 *  key is configured. Never throws. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  if (!enabled || !client) return
  try {
    client.capture(event, props)
  } catch (e) {
    log.warn("analytics", "capture failed", String(e))
  }
}

/** Fire AppOpened with `is_first_open`. The "seen before" flag is only ever
 *  read/written once consent is granted (this function is itself a no-op
 *  without consent), so nothing is recorded locally pre-consent either. */
export async function trackAppOpened() {
  if (!enabled) return
  let isFirstOpen = false
  try {
    const seen = await SecureStore.getItemAsync(FIRST_OPEN_KEY)
    isFirstOpen = !seen
    if (isFirstOpen) await SecureStore.setItemAsync(FIRST_OPEN_KEY, "1")
  } catch {
    // SecureStore unavailable — still fire the event, just without the flag.
  }
  track(AnalyticsEvent.AppOpened, { is_first_open: isFirstOpen })
}

/** Classify a connection failure into a coarse bucket without leaking the
 *  raw error message (which can contain hostnames/IPs). */
export function classifyConnectionError(message: string | undefined): ConnectionErrorClass {
  const m = (message || "").toLowerCase()
  if (/401|unauthoriz/.test(m)) return "unauthorized"
  if (/ssl|tls|certificate|handshake/.test(m)) return "tls-error"
  if (/timeout|timed out/.test(m)) return "timeout"
  if (/network request failed|unreachable|econnrefused|fetch failed/.test(m)) return "server-unreachable"
  if (/malformed|invalid url/.test(m)) return "malformed-url"
  return "unknown"
}
