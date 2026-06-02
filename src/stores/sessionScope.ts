// Single source of truth for which directory scope session reads/writes use.
//
// Bug #10 ("sessions tab empty after connect / create") happened because the
// list path and the create path each computed this rule independently and drifted:
// loadSessions listed sessions home-scoped while createSession wrote CWD-scoped, so
// a freshly created session was invisible. Both call sites now derive their client
// from this one function, so they cannot disagree again.
//
// Rule: when the active connection pins an explicit directory, use the default
// client (it is already scoped to that directory). Otherwise, if we know the
// server's home directory, scope to it. If home is unknown, fall back to default.

export function sessionScopeDirectory(hasExplicitDirectory: boolean, home: string | null | undefined): string | null {
  if (hasExplicitDirectory) return null
  return home ? home : null
}
