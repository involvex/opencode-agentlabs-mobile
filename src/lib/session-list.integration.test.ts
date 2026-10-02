// Integration test for the V2 global recent-sessions list.
//
// Stands up the mock opencode server over HTTP and drives loadSessionList
// through the SAME transport shape sdk.ts wires in production (GET
// /api/session with ?parentID=null for roots, cursor pagination, {data,
// cursor} envelope). It proves the feature works end-to-end across the HTTP
// boundary: the Recent Sessions list is populated globally — every session
// across every directory — WITHOUT the user picking a folder.
//
// Run: node --test src/lib/session-list.integration.test.ts

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createMockOpencodeServer } from "../../tests/fixtures/mock-opencode-server.ts";
import { loadSessionList, type SessionListTransport } from "./session-list.ts";
import { adaptSession } from "./v2-adapters.ts";

const PORT = 45071;
let mock: ReturnType<typeof createMockOpencodeServer>;
let base: string;

before(async () => {
  // --seed-sessions pre-populates two sessions in two DIFFERENT directories:
  //   seed-default -> /mock/project        (updated now-120s)
  //   seed-other   -> /mock/project/other-dir (updated now-60s, more recent)
  mock = createMockOpencodeServer({ port: PORT, seedSessions: true });
  await mock.listen();
  base = mock.url;
});

after(async () => {
  await mock.close();
});

// Mirror of the production transport in sdk.ts session.list: large pages,
// order=desc, roots:true -> ?parentID=null, cursor passthrough, {data,
// cursor} envelope unwrapped, V2 sessions adapted to the legacy shape.
function realTransport(
  baseUrl: string,
  params?: { roots?: boolean },
  seenQueries: string[] = [],
): SessionListTransport {
  return {
    getPage: async (cursor?: string) => {
      const query = new URLSearchParams();
      query.set("limit", "200");
      query.set("order", "desc");
      if (params?.roots) query.set("parentID", "null");
      if (cursor) query.set("cursor", cursor);
      seenQueries.push(query.toString());
      const r = await fetch(`${baseUrl}/api/session?${query.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as {
        data?: Record<string, unknown>[];
        cursor?: { next?: string | null };
      };
      const data = Array.isArray(body?.data) ? body.data : [];
      return {
        sessions: data.map((s) => adaptSession("", s)),
        next: body?.cursor?.next ?? null,
      };
    },
  };
}

test("global sessions: lists sessions from EVERY directory without picking a folder", async () => {
  const seen: string[] = [];
  const sessions = await loadSessionList(
    realTransport(base, { roots: true }, seen),
    {
      roots: true,
      limit: 50,
    },
  );

  // roots:true must map to ?parentID=null server-side.
  assert.ok(
    seen.some((q) => q.includes("parentID=null")),
    "roots:true maps to ?parentID=null",
  );

  // Both directories are represented — this is the whole feature.
  const ids = sessions.map((s) => s.id);
  assert.ok(
    ids.includes("seed-default"),
    "session from /mock/project must appear",
  );
  assert.ok(
    ids.includes("seed-other"),
    "session from /mock/project/other-dir must appear",
  );
  assert.equal(sessions.length, 2);

  const dirs = new Set(sessions.map((s) => s.directory));
  assert.equal(
    dirs.size,
    2,
    "sessions span two distinct directories (global, not directory-scoped)",
  );

  // Most-recently-updated first: seed-other (now-60s) before seed-default (now-120s).
  assert.equal(sessions[0].id, "seed-other");
  assert.equal(sessions[1].id, "seed-default");
});

test("cursor pagination: walks multiple pages until cursor.next is null", async () => {
  // Force one-item pages to exercise the cursor loop.
  const transport: SessionListTransport = {
    getPage: async (cursor?: string) => {
      const query = new URLSearchParams();
      query.set("limit", "1");
      query.set("parentID", "null");
      if (cursor) query.set("cursor", cursor);
      const r = await fetch(`${base}/api/session?${query.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as {
        data?: Record<string, unknown>[];
        cursor?: { next?: string | null };
      };
      return {
        sessions: (body.data ?? []).map((s) => adaptSession("", s)),
        next: body?.cursor?.next ?? null,
      };
    },
  };

  const sessions = await loadSessionList(transport, { roots: true });
  assert.equal(sessions.length, 2, "both pages walked");
  assert.deepEqual(
    new Set(sessions.map((s) => s.id)),
    new Set(["seed-default", "seed-other"]),
  );
});
