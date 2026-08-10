// Pure absolute-path helpers for the server-filesystem browser.
// No React Native imports — unit-testable with node --test.
//
// Server working directories can be POSIX (/a/b) or Windows (C:\a\b, D:/a/b)
// since the mobile app can point at either kind of opencode server, so both
// separators are handled.

/** Remove trailing slashes/backslashes, keeping the input if that would empty it. */
export function stripTrailingSlash(dir: string): string {
  return dir.replace(/[\\/]+$/, "") || dir;
}

function isRoot(trimmed: string): boolean {
  // POSIX root ("/", "//"), a bare backslash, or a Windows drive root ("C:").
  return /^[\\/]+$/.test(trimmed) || /^[a-zA-Z]:$/.test(trimmed);
}

/**
 * Parent directory of an absolute path, or null when already at a
 * filesystem root (POSIX "/" or a Windows drive root like "C:\").
 */
export function parentOf(dir: string): string | null {
  const trimmed = stripTrailingSlash(dir);
  if (isRoot(trimmed)) return null;
  const lastSlash = Math.max(
    trimmed.lastIndexOf("/"),
    trimmed.lastIndexOf("\\"),
  );
  if (lastSlash < 0) return null;
  const head = trimmed.slice(0, lastSlash);
  if (!head) return trimmed[0] === "\\" ? "\\" : "/"; // reached posix root
  if (/^[a-zA-Z]:$/.test(head)) return `${head}\\`; // reached a windows drive root
  return head;
}

/** Last path segment, e.g. "/a/b/" -> "b", "C:\\proj" -> "proj". */
export function nameOf(dir: string): string {
  const trimmed = stripTrailingSlash(dir);
  const lastSlash = Math.max(
    trimmed.lastIndexOf("/"),
    trimmed.lastIndexOf("\\"),
  );
  return lastSlash >= 0 ? trimmed.slice(lastSlash + 1) || trimmed : trimmed;
}
