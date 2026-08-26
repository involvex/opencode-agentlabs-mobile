// Pure, transport-agnostic logic for the session archive feature. Extracted so
// it's unit-testable under plain `node --test` without importing expo modules
// (same pattern as session-list.ts / session-search.ts).
import type { Session } from "./sdk";

export interface ArchivePartition {
  active: Session[];
  archived: Session[];
}

// Split a session list into active and archived, preserving input order
// within each partition. Active sessions are everything NOT in archivedIDs;
// archived sessions are those that are (IDs without a matching session are
// simply ignored — they may reference sessions deleted server-side).
export function partitionArchived(
  sessions: Session[],
  archivedIDs: string[],
): ArchivePartition {
  const archivedSet = new Set(archivedIDs);
  const active: Session[] = [];
  const archived: Session[] = [];
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (archivedSet.has(s.id)) archived.push(s);
    else active.push(s);
  }
  return { active, archived };
}
