// Pure, transport-agnostic logic for listing sessions, extracted from sdk.ts so
// it's unit-testable under plain `node --test` without importing expo/fetch
// (sdk.ts is RN-only) — same pattern as api-error.ts / file-roots.ts.
//
// Why this exists: the Recent Sessions list must show sessions from ALL
// directories without the user first picking a folder. V2 GET /api/session is
// global and paginated ({data, cursor}); roots:true maps to ?parentID=null
// ("only root sessions", per the V2 openapi). Search, sort-by-updated and
// limit shaping happens client-side in normalizeSessions so the visible page
// matches the list UI's intent regardless of server-side ordering.
import type { Session } from "./sdk";

export interface SessionListParams {
  roots?: boolean;
  limit?: number;
  search?: string;
}

export interface SessionListTransport {
  // One page of the V2 session list. The sdk.ts production transport maps
  // roots:true to ?parentID=null server-side and unwraps the {data, cursor}
  // envelope; `next` is the opaque cursor.next (null/undefined = last page).
  getPage: (
    cursor?: string,
  ) => Promise<{ sessions: Session[]; next?: string | null }>;
}

// Shape the session pool to match the list UI's intent: when roots:true,
// keep only top-level sessions (no parentID); case-insensitive title search;
// most-recently-updated first; then apply limit. Order matters — limit is
// applied LAST so it caps the visible roots, not the raw (root+child) pool.
export function normalizeSessions(
  all: Session[],
  params?: SessionListParams,
): Session[] {
  let out = Array.isArray(all) ? all.slice() : [];
  if (params?.roots) out = out.filter((s) => !s.parentID);
  if (params?.search) {
    const q = params.search.toLowerCase();
    out = out.filter((s) => (s.title ?? "").toLowerCase().includes(q));
  }
  out.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0));
  if (params?.limit != null) out = out.slice(0, params.limit);
  return out;
}

// Safety cap so a huge server-side history can't page forever.
const MAX_PAGES = 25;

// List sessions globally: fetch every page (roots are pre-filtered
// server-side via ?parentID=null when params.roots is set), then shape
// client-side. Any non-2xx is surfaced by the transport, exactly as before.
export async function loadSessionList(
  transport: SessionListTransport,
  params?: SessionListParams,
): Promise<Session[]> {
  const all: Session[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { sessions, next } = await transport.getPage(cursor);
    if (Array.isArray(sessions)) all.push(...sessions);
    cursor = next ?? undefined;
    if (!cursor) break;
  }
  return normalizeSessions(all, params);
}
