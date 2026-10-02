import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadSessionList,
  normalizeSessions,
  type SessionListTransport,
} from "./session-list.ts";
import type { Session } from "./sdk.ts";

// Minimal Session factory — only the fields the list logic reads.
function session(over: Partial<Session> & { id: string }): Session {
  return {
    id: over.id,
    slug: over.slug ?? over.id,
    projectID: "p",
    directory: over.directory ?? "/dir",
    title: over.title ?? over.id,
    version: "1",
    time: over.time ?? { created: 0, updated: 0 },
    ...over,
  } as Session;
}

// A fake transport that records which pages got hit. Pages resolve to
// { sessions, next } (the V2 {data, cursor} envelope unwrapped), or throw
// (non-2xx), mirroring the real sdk.ts transport contract.
function transport(opts: {
  pages?: Session[][];
  throws?: Error;
}): SessionListTransport & { calls: (string | undefined)[] } {
  const calls: (string | undefined)[] = [];
  let page = 0;
  return {
    calls,
    getPage: async (cursor?: string) => {
      calls.push(cursor);
      if (opts.throws) throw opts.throws;
      const pages = opts.pages ?? [[]];
      const sessions = pages[page] ?? [];
      page++;
      const hasNext = page < pages.length;
      return {
        sessions,
        next: hasNext ? `cursor-${page}` : null,
      };
    },
  };
}

test("loadSessionList: (a) fetches the first page with no cursor", async () => {
  const t = transport({ pages: [[session({ id: "a" })]] });
  await loadSessionList(t, { roots: true, limit: 50 });
  assert.equal(t.calls[0], undefined);
  assert.equal(t.calls.length, 1, "single page must not re-request");
});

test("loadSessionList: (b) filters to roots (no parentID) when roots:true", async () => {
  const t = transport({
    pages: [
      [
        session({ id: "root1" }),
        session({ id: "child1", parentID: "root1" }),
        session({ id: "root2" }),
        session({ id: "child2", parentID: "root2" }),
      ],
    ],
  });
  const out = await loadSessionList(t, { roots: true });
  assert.deepEqual(
    out.map((s) => s.id).sort(),
    ["root1", "root2"],
    "children (with parentID) must be excluded",
  );
});

test("loadSessionList: roots not set keeps children too", async () => {
  const t = transport({
    pages: [
      [session({ id: "root1" }), session({ id: "child1", parentID: "root1" })],
    ],
  });
  const out = await loadSessionList(t, {});
  assert.equal(out.length, 2);
});

test("loadSessionList: (c) follows cursor.next across pages", async () => {
  const t = transport({
    pages: [[session({ id: "p1" })], [session({ id: "p2" })]],
  });
  const out = await loadSessionList(t, {});
  assert.deepEqual(out.map((s) => s.id).sort(), ["p1", "p2"]);
  assert.deepEqual(t.calls, [undefined, "cursor-1"]);
});

test("loadSessionList: (d) sorts by time.updated descending (most recent first)", async () => {
  const t = transport({
    pages: [
      [
        session({ id: "old", time: { created: 0, updated: 100 } }),
        session({ id: "newest", time: { created: 0, updated: 300 } }),
        session({ id: "mid", time: { created: 0, updated: 200 } }),
      ],
    ],
  });
  const out = await loadSessionList(t, { roots: true });
  assert.deepEqual(
    out.map((s) => s.id),
    ["newest", "mid", "old"],
  );
});

test("loadSessionList: applies limit AFTER root-filter + sort", async () => {
  const t = transport({
    pages: [
      [
        session({
          id: "c1",
          parentID: "r",
          time: { created: 0, updated: 999 },
        }),
        session({ id: "r1", time: { created: 0, updated: 100 } }),
        session({ id: "r2", time: { created: 0, updated: 200 } }),
        session({ id: "r3", time: { created: 0, updated: 300 } }),
      ],
    ],
  });
  const out = await loadSessionList(t, { roots: true, limit: 2 });
  // Children excluded first, then sort desc, then take 2 → r3, r2 (not the child).
  assert.deepEqual(
    out.map((s) => s.id),
    ["r3", "r2"],
  );
});

test("loadSessionList: search matches title case-insensitively", async () => {
  const t = transport({
    pages: [
      [
        session({ id: "1", title: "Fix Auth Bug" }),
        session({ id: "2", title: "Add feature" }),
      ],
    ],
  });
  const out = await loadSessionList(t, { search: "AUTH" });
  assert.deepEqual(
    out.map((s) => s.id),
    ["1"],
  );
});

test("loadSessionList: transport error propagates (no silent fallback)", async () => {
  const t = transport({
    throws: new Error("API Error: 500 - boom"),
  });
  await assert.rejects(() => loadSessionList(t, {}), /500/);
  assert.equal(t.calls.length, 1);
});

test("normalizeSessions: tolerates non-array input", () => {
  assert.deepEqual(normalizeSessions(undefined as unknown as Session[]), []);
});
