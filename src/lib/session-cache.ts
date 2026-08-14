import * as SecureStore from "expo-secure-store";
import type { Message, Part, Session } from "./sdk";

export interface CachedSession {
  session: Session;
  messages: Message[];
  parts: Record<string, Part[]>;
  cachedAt: number;
}

const SESSION_CACHE_PREFIX = "session_cache_";
const SESSION_LIST_CACHE_KEY = "cached_sessions_list";

const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionCacheKey(sessionID: string): string {
  return `${SESSION_CACHE_PREFIX}${sessionID}`;
}

export async function cacheSession(
  sessionID: string,
  data: CachedSession,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      sessionCacheKey(sessionID),
      JSON.stringify(data),
    );
  } catch {
    // SecureStore can fail on low-disk / encryption issues — cache is best-effort
  }
}

export async function cacheSessionMessages(
  sessionID: string,
  session: Session,
  messages: Message[],
  parts: Record<string, Part[]>,
): Promise<void> {
  await cacheSession(sessionID, {
    session,
    messages,
    parts,
    cachedAt: Date.now(),
  });
}

export async function getCachedSession(
  sessionID: string,
): Promise<CachedSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(sessionCacheKey(sessionID));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    const age = Date.now() - (parsed.cachedAt ?? 0);
    if (age > MAX_CACHE_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function cacheSessionList(sessions: Session[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      SESSION_LIST_CACHE_KEY,
      JSON.stringify({ sessions, cachedAt: Date.now() }),
    );
  } catch {}
}

export async function getCachedSessionList(): Promise<Session[] | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      sessions: Session[];
      cachedAt: number;
    };
    const age = Date.now() - (parsed.cachedAt ?? 0);
    if (age > MAX_CACHE_AGE_MS) return null;
    return parsed.sessions;
  } catch {
    return null;
  }
}

export async function removeCachedSession(sessionID: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(sessionCacheKey(sessionID));
  } catch {}
}

export async function clearAllSessionCache(): Promise<void> {
  // SecureStore has no iteration API, so we can only delete known keys.
  // In practice, cache invalidation is per-session (removeCachedSession).
  // This is a best-effort helper for the "Clear local cache" dev action.
  // Full wipe is handled in the store reset path.
}
