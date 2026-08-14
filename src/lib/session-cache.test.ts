import { test } from "node:test";
import assert from "node:assert/strict";

function makeSession(
  id: string,
  title: string,
  updated = 1000,
): { id: string; title: string; time: { updated: number } } {
  return { id, title, time: { updated } };
}

const cachedSessions = new Map<string, any>();

const mockStore = {
  getItemAsync: async (key: string) => cachedSessions.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    cachedSessions.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    cachedSessions.delete(key);
  },
};

const SESSION_CACHE_PREFIX = "session_cache_";
const SESSION_LIST_CACHE_KEY = "cached_sessions_list";
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function cacheSessionMessages(
  sessionID: string,
  data: any,
): Promise<void> {
  await mockStore.setItemAsync(
    `${SESSION_CACHE_PREFIX}${sessionID}`,
    JSON.stringify(data),
  );
}

async function getCachedSession(sessionID: string): Promise<any | null> {
  const raw = await mockStore.getItemAsync(
    `${SESSION_CACHE_PREFIX}${sessionID}`,
  );
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const age = Date.now() - (parsed.cachedAt ?? 0);
  if (age > MAX_CACHE_AGE_MS) return null;
  return parsed;
}

async function cacheSessionList(sessions: any[]): Promise<void> {
  await mockStore.setItemAsync(
    SESSION_LIST_CACHE_KEY,
    JSON.stringify({ sessions, cachedAt: Date.now() }),
  );
}

async function getCachedSessionList(): Promise<any[] | null> {
  const raw = await mockStore.getItemAsync(SESSION_LIST_CACHE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const age = Date.now() - (parsed.cachedAt ?? 0);
  if (age > MAX_CACHE_AGE_MS) return null;
  return parsed.sessions;
}

async function removeCachedSession(sessionID: string): Promise<void> {
  await mockStore.deleteItemAsync(`${SESSION_CACHE_PREFIX}${sessionID}`);
}

test("cacheSessionMessages + getCachedSession round-trips", async () => {
  cachedSessions.clear();
  const sess = makeSession("s1", "Test");
  await cacheSessionMessages("s1", {
    session: sess,
    messages: [],
    parts: {},
    cachedAt: Date.now(),
  });
  const got = await getCachedSession("s1");
  assert.deepEqual(got?.session.id, "s1");
});

test("cacheSessionList + getCachedSessionList round-trips", async () => {
  cachedSessions.clear();
  const list = [makeSession("a", "A"), makeSession("b", "B")];
  await cacheSessionList(list);
  const got = await getCachedSessionList();
  assert.equal(got?.length, 2);
  assert.deepEqual(got?.[0].id, "a");
});

test("getCachedSession returns null for unknown key", async () => {
  cachedSessions.clear();
  const got = await getCachedSession("nonexistent");
  assert.equal(got, null);
});

test("getCachedSessionList returns null for unknown key", async () => {
  cachedSessions.clear();
  const got = await getCachedSessionList();
  assert.equal(got, null);
});

test("getCachedSession returns null when cache expired", async () => {
  cachedSessions.clear();
  await cacheSessionMessages("s1", {
    session: makeSession("s1", "Test"),
    messages: [],
    parts: {},
    cachedAt: Date.now() - MAX_CACHE_AGE_MS - 1,
  });
  const got = await getCachedSession("s1");
  assert.equal(got, null);
});

test("getCachedSessionList returns null when cache expired", async () => {
  cachedSessions.clear();
  const list = [makeSession("a", "A")];
  await mockStore.setItemAsync(
    SESSION_LIST_CACHE_KEY,
    JSON.stringify({
      sessions: list,
      cachedAt: Date.now() - MAX_CACHE_AGE_MS - 1,
    }),
  );
  const got = await getCachedSessionList();
  assert.equal(got, null);
});

test("removeCachedSession deletes the cache", async () => {
  cachedSessions.clear();
  await cacheSessionMessages("s1", {
    session: makeSession("s1", "Test"),
    messages: [],
    parts: {},
    cachedAt: Date.now(),
  });
  await removeCachedSession("s1");
  const got = await getCachedSession("s1");
  assert.equal(got, null);
});

test("cache tolerates empty messages array", async () => {
  cachedSessions.clear();
  await cacheSessionMessages("s1", {
    session: makeSession("s1", "Test"),
    messages: [],
    parts: {},
    cachedAt: Date.now(),
  });
  const got = await getCachedSession("s1");
  assert.deepEqual(got?.messages, []);
});
