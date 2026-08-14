// Pure, transport-agnostic logic for searching across cached session
// content. Extracted so it's unit-testable under plain `node --test` without
// importing expo/fetch or expo-secure-store (those are RN-only).
//
// This powers the "local full-text search across cached messages" feature:
// when the user types in the sessions list search box, we match against BOTH
// session titles (server-side, as before) and message/part text from the
// local cache. This works offline when the server is unreachable.

import type { CachedSession } from "./session-cache";

export interface SearchHit {
  sessionID: string;
  sessionTitle: string;
  snippet: string;
  matchCount: number;
}

export interface SearchResult {
  hits: SearchHit[];
}

const SNIPPET_RADIUS = 40;

function extractTextFromPart(part: { type: string; text?: string }): string {
  if (part.type === "text" || part.type === "reasoning") {
    return part.text ?? "";
  }
  return "";
}

export function extractSessionText(cached: CachedSession): string {
  const chunks: string[] = [];

  chunks.push(cached.session.title ?? "");

  for (const msg of cached.messages) {
    const role = msg.role === "assistant" ? "(Assistant)" : "(You)";
    chunks.push(role + " " + (msg.id ?? ""));
  }

  for (const msgID of Object.keys(cached.parts)) {
    const msgParts = cached.parts[msgID];
    if (!Array.isArray(msgParts)) continue;
    for (const part of msgParts) {
      const text = extractTextFromPart(part);
      if (text) chunks.push(text);
    }
  }

  return chunks.join(" ");
}

function findLastIndex(haystack: string, needle: string): number {
  if (needle.length === 0) return -1;
  let idx = haystack.indexOf(needle);
  if (idx === -1) return -1;
  while (true) {
    const next = haystack.indexOf(needle, idx + needle.length);
    if (next === -1) break;
    idx = next;
  }
  return idx;
}

export function searchCachedSessions(
  sessions: CachedSession[],
  query: string,
): SearchResult {
  if (!query.trim()) {
    return { hits: [] };
  }

  const q = query.toLowerCase();
  const hits: SearchHit[] = [];

  for (const cached of sessions) {
    const originalText = extractSessionText(cached);
    const fullText = originalText.toLowerCase();
    if (!fullText.includes(q)) continue;

    let matchCount = 0;
    let idx = fullText.indexOf(q);
    while (idx !== -1) {
      matchCount++;
      idx = fullText.indexOf(q, idx + 1);
    }

    const lastIdx = findLastIndex(fullText, q);
    const snippetStart = Math.max(
      0,
      (lastIdx === -1 ? 0 : lastIdx) - SNIPPET_RADIUS,
    );
    const snippetEnd = Math.min(
      fullText.length,
      lastIdx + q.length + SNIPPET_RADIUS,
    );
    const snippetRaw = originalText.slice(snippetStart, snippetEnd).trim();
    const snippet = snippetRaw || (cached.session.title ?? "");

    hits.push({
      sessionID: cached.session.id,
      sessionTitle: cached.session.title ?? "",
      snippet,
      matchCount,
    });
  }

  return {
    hits: hits.sort((a, b) => b.matchCount - a.matchCount),
  };
}

export function cacheMatches(cached: CachedSession, query: string): boolean {
  if (!query.trim()) return true;
  return extractSessionText(cached).toLowerCase().includes(query.toLowerCase());
}
