// Centralised Sentry wrapper. The goals here:
//   1. Capture every *unexpected* error: React render crashes, uncaught JS
//      exceptions from the RN bridge, unhandled promise rejections, native
//      crashes (handled by the Sentry RN SDK automatically).
//   2. Stay a strict no-op when no DSN is configured so dev/CI builds need no
//      secrets and offline behaviour is unchanged.
//   3. Scrub URLs (basic-auth + query string) from every outgoing event so
//      server addresses or tokens never leak to Sentry.
//   4. Provide small `addBreadcrumb` / `captureException` helpers so call sites
//      get rich context without importing the Sentry SDK directly.

import * as Sentry from "@sentry/react-native"
import appJson from "../../app.json"
import { log } from "./logbuffer"
import type { DiagnosticReport } from "./diagnostics"

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
const APP_VERSION = (appJson as { expo?: { version?: string } }).expo?.version ?? "unknown"

let enabled = false

export function initSentry() {
  if (!DSN) {
    log.info("sentry", "no DSN configured — telemetry disabled")
    installGlobalHandlers(false)
    return
  }
  try {
    Sentry.init({
      dsn: DSN,
      release: `opencode-mobile@${APP_VERSION}`,
      dist: APP_VERSION,
      // Performance tracing off by default; only error + crash capture.
      tracesSampleRate: 0,
      enableAutoSessionTracking: true,
      // Don't ship default PII (IP, cookies). We attach what we want explicitly.
      sendDefaultPii: false,
      // Auto-capture uncaught JS exceptions AND unhandled promise rejections.
      // The SDK enables these by default but we keep them on explicitly so a
      // future config refactor can't silently drop coverage.
      enableNative: true,
      enableNativeCrashHandling: true,
      enableAutoPerformanceTracing: false,
      attachStacktrace: true,
      maxBreadcrumbs: 100,
      // Final pre-send scrub: strip URLs everywhere they could appear.
      beforeSend(event) {
        return scrubEvent(event)
      },
      beforeBreadcrumb(crumb) {
        if (crumb.data && typeof crumb.data === "object") {
          crumb.data = scrubObject(crumb.data as Record<string, unknown>)
        }
        if (typeof crumb.message === "string") crumb.message = scrubString(crumb.message)
        return crumb
      },
    })
    enabled = true
    Sentry.setTag("app.version", APP_VERSION)
    log.info("sentry", "initialized", `release=opencode-mobile@${APP_VERSION}`)
  } catch (e) {
    log.warn("sentry", "init failed", String(e))
  }
  installGlobalHandlers(enabled)
}

// Install belt-and-braces global handlers. The Sentry RN SDK already wires
// these via its ReactNativeErrorHandlers integration, but we layer our own on
// top so:
//   * Errors still land in the in-memory log buffer (and therefore in any
//     shared diagnostic report) even when Sentry is disabled.
//   * Telemetry-disabled builds still leave a breadcrumb that something blew
//     up, which is invaluable when triaging a user-shared report offline.
function installGlobalHandlers(sentryEnabled: boolean) {
  type GlobalErrorUtils = {
    getGlobalHandler?: () => (err: unknown, isFatal?: boolean) => void
    setGlobalHandler?: (handler: (err: unknown, isFatal?: boolean) => void) => void
  }
  const errorUtils = (globalThis as unknown as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils
  if (errorUtils?.setGlobalHandler && errorUtils?.getGlobalHandler) {
    const previous = errorUtils.getGlobalHandler()
    errorUtils.setGlobalHandler((err: unknown, isFatal?: boolean) => {
      const error = toError(err)
      log.error("crash", isFatal ? "FATAL" : "non-fatal", error.message, error.stack ?? "")
      if (sentryEnabled) {
        Sentry.captureException(error, (scope) => {
          scope.setLevel(isFatal ? "fatal" : "error")
          scope.setTag("crash.source", "js-global")
          scope.setTag("crash.fatal", String(Boolean(isFatal)))
          return scope
        })
      }
      previous?.(err, isFatal)
    })
  }

  // Hermes/RN expose `onunhandledrejection` on the global object.
  type GlobalRejection = {
    onunhandledrejection?: (event: { reason?: unknown; promise?: unknown }) => void
  }
  const g = globalThis as unknown as GlobalRejection
  const prevRej = g.onunhandledrejection
  g.onunhandledrejection = (event) => {
    const error = toError(event?.reason)
    log.error("crash", "unhandled-rejection", error.message, error.stack ?? "")
    if (sentryEnabled) {
      Sentry.captureException(error, (scope) => {
        scope.setLevel("error")
        scope.setTag("crash.source", "promise-rejection")
        return scope
      })
    }
    prevRej?.(event)
  }
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === "string") return new Error(value)
  try {
    return new Error(JSON.stringify(value))
  } catch {
    return new Error(String(value))
  }
}

// --- Scrubbing -----------------------------------------------------------

// Strip basic-auth credentials and any `?token=` style query secrets so URLs
// can be safely sent or logged.
export function scrubUrl(url: string): string {
  return url
    .replace(/\/\/[^@/]+@/, "//<redacted>@")
    .replace(/([?&](?:token|access_token|api_key|key|password|pwd|auth)=)[^&#]*/gi, "$1<redacted>")
}

function scrubString(s: string): string {
  // Catch any embedded URL inside a free-text string (error messages often
  // contain them, e.g. "fetch failed: https://user:pw@host/...").
  return s.replace(/https?:\/\/\S+/g, (m) => scrubUrl(m))
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = scrubString(v)
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = scrubObject(v as Record<string, unknown>)
    else out[k] = v
  }
  return out
}

function scrubEvent<T extends Sentry.Event>(event: T): T {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url)
  if (event.message) event.message = scrubString(event.message)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value)
    }
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === "string") crumb.message = scrubString(crumb.message)
      if (crumb.data && typeof crumb.data === "object") {
        crumb.data = scrubObject(crumb.data as Record<string, unknown>)
      }
    }
  }
  return event
}

// --- Helpers exposed to the rest of the app ------------------------------

export type Breadcrumb = {
  category: string
  message: string
  level?: "debug" | "info" | "warning" | "error"
  data?: Record<string, unknown>
}

export function addBreadcrumb(crumb: Breadcrumb) {
  if (!enabled) return
  Sentry.addBreadcrumb({
    category: crumb.category,
    message: crumb.message,
    level: crumb.level ?? "info",
    data: crumb.data,
    timestamp: Date.now() / 1000,
  })
}

export function captureException(
  err: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown>; level?: Sentry.SeverityLevel },
) {
  const error = toError(err)
  log.error("sentry", "captureException", error.message)
  if (!enabled) return
  Sentry.withScope((scope) => {
    if (context?.level) scope.setLevel(context.level)
    if (context?.tags) for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v)
    if (context?.extra) for (const [k, v] of Object.entries(context.extra)) scope.setExtra(k, v)
    Sentry.captureException(error)
  })
}

export function captureDiagnostic(report: DiagnosticReport, rawError?: unknown) {
  log.info("sentry", "capture", report.classification, enabled ? "(uploading)" : "(local only)")
  if (!enabled) return
  Sentry.withScope((scope) => {
    scope.setTag("connect.classification", report.classification)
    scope.setTag("connect.scheme", report.scheme ?? "n/a")
    scope.setContext("connection", {
      url: scrubUrl(report.url),
      host: report.host,
      port: report.port,
      isHostname: report.isHostname,
      summary: report.summary,
    })
    scope.setContext("probes", {
      attempts: report.attempts.map((a) => ({
        name: a.name,
        ok: a.ok,
        status: a.status,
        durationMs: a.durationMs,
        error: a.error,
        cause: a.errorCause,
      })),
    })
    scope.setContext("device", report.device)
    const err = rawError instanceof Error ? rawError : new Error(`connect ${report.classification}: ${report.summary}`)
    Sentry.captureException(err)
  })
}

// React error boundaries are implemented as our own class component
// (see src/components/ErrorBoundary.tsx) so we can render a useful
// "Share diagnostic" fallback. We still expose Sentry.wrap as `wrap`
// for callers that just want auto-capture without a custom fallback.
export const wrap = Sentry.wrap
export const sentryEnabled = () => enabled
