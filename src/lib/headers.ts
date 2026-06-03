// Pure request-header construction for the opencode client.
// Extracted from sdk.ts so the auth + directory-encoding rules are unit-testable
// without pulling in expo/fetch (which has no resolver outside Metro).
//
// Relies only on `btoa`, which is available in both Hermes (RN) and Node >= 16.

export interface HeaderConfig {
  directory?: string
  auth?: { username: string; password: string }
}

export function buildRequestHeaders(config: HeaderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (config.directory) {
    // The directory travels in an HTTP header, which is latin1-only. ASCII paths
    // pass through untouched (so the server sees a readable path); anything with
    // non-ASCII bytes is percent-encoded to stay header-safe.
    const encoded = /[^\x00-\x7F]/.test(config.directory)
      ? encodeURIComponent(config.directory)
      : config.directory
    headers["x-opencode-directory"] = encoded
  }

  if (config.auth) {
    const credentials = btoa(`${config.auth.username}:${config.auth.password}`)
    headers["Authorization"] = `Basic ${credentials}`
  }

  return headers
}
