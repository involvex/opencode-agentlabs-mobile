import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractSessionText,
  searchCachedSessions,
  cacheMatches,
} from "./session-search.ts";
import type { CachedSession } from "./session-cache.ts";

describe("session-search", () => {
  const makeCached = (
    id: string,
    title: string,
    messages: { id: string; role: "user" | "assistant" }[],
    parts: Record<string, { type: string; text?: string }[]>,
  ): CachedSession => ({
    session: {
      id,
      title,
      projectID: "p1",
      directory: "/dir",
      version: "1",
      time: { created: 0, updated: 0 },
    },
    messages: messages as CachedSession["messages"],
    parts: parts as CachedSession["parts"],
    cachedAt: Date.now(),
  });

  test("extractSessionText includes title, role, and part text", () => {
    const cached = makeCached(
      "s1",
      "My Title",
      [
        { id: "m1", role: "user" },
        { id: "m2", role: "assistant" },
      ],
      {
        m1: [{ type: "text", text: "hello world" }],
        m2: [
          { type: "text", text: "hi there" },
          { type: "reasoning", text: "thinking" },
        ],
      },
    );
    const text = extractSessionText(cached);
    assert.ok(text.includes("My Title"));
    assert.ok(text.includes("hello world"));
    assert.ok(text.includes("hi there"));
    assert.ok(text.includes("thinking"));
    assert.ok(text.includes("(You)"));
    assert.ok(text.includes("(Assistant)"));
  });

  test("extractSessionText handles empty session", () => {
    const cached = makeCached("s1", "", [], {});
    const text = extractSessionText(cached);
    assert.equal(text.trim(), "");
  });

  test("extractSessionText skips non-text parts", () => {
    const cached = makeCached("s1", "Test", [], {
      m1: [
        { type: "tool", text: "should not appear" },
        { type: "text", text: "visible" },
      ],
    });
    const text = extractSessionText(cached);
    assert.ok(text.includes("visible"));
    assert.ok(!text.includes("should not appear"));
  });

  test("searchCachedSessions returns empty for empty query", () => {
    const cached = makeCached("s1", "Test", [], {});
    const result = searchCachedSessions([cached], "");
    assert.deepEqual(result.hits, []);
  });

  test("searchCachedSessions matches by title only (no parts)", () => {
    const cached = makeCached("s1", "Hello World Project", [], {});
    const result = searchCachedSessions([cached], "hello world");
    assert.equal(result.hits.length, 1);
    assert.equal(result.hits[0].sessionID, "s1");
  });

  test("searchCachedSessions matches by part text", () => {
    const cached = makeCached("s1", "Project", [{ id: "m1", role: "user" }], {
      m1: [{ type: "text", text: "I need to fix the authentication bug" }],
    });
    const result = searchCachedSessions([cached], "authentication");
    assert.equal(result.hits.length, 1);
    assert.equal(result.hits[0].sessionID, "s1");
  });

  test("searchCachedSessions ranks by matchCount", () => {
    const cached1 = makeCached("a", "A", [{ id: "m1", role: "user" }], {
      m1: [{ type: "text", text: "fix bug fix fix fix" }],
    });
    const cached2 = makeCached("b", "B", [{ id: "m1", role: "user" }], {
      m1: [{ type: "text", text: "fix bug" }],
    });
    const result = searchCachedSessions([cached1, cached2], "fix");
    assert.equal(result.hits.length, 2);
    assert.equal(result.hits[0].sessionID, "a");
    assert.equal(result.hits[1].sessionID, "b");
    assert.ok(result.hits[0].matchCount > result.hits[1].matchCount);
  });

  test("searchCachedSessions case-insensitive", () => {
    const cached = makeCached("s1", "Test", [{ id: "m1", role: "user" }], {
      m1: [{ type: "text", text: "The Quick Brown Fox" }],
    });
    const lower = searchCachedSessions([cached], "quick brown");
    const upper = searchCachedSessions([cached], "QUICK BROWN");
    assert.equal(lower.hits.length, 1);
    assert.equal(upper.hits.length, 1);
  });

  test("cacheMatches returns true for empty query (no filter)", () => {
    const cached = makeCached("s1", "Test", [], {});
    assert.equal(cacheMatches(cached, ""), true);
  });

  test("cacheMatches returns false when no match", () => {
    const cached = makeCached("s1", "Test", [{ id: "m1", role: "user" }], {
      m1: [{ type: "text", text: "hello world" }],
    });
    assert.equal(cacheMatches(cached, "xyz"), false);
  });

  test("cacheMatches returns true when match in parts", () => {
    const cached = makeCached("s1", "Test", [{ id: "m1", role: "user" }], {
      m1: [{ type: "text", text: "hello world" }],
    });
    assert.equal(cacheMatches(cached, "world"), true);
  });

  test("searchCachedSessions snippet is bounded by SNIPPET_RADIUS", () => {
    const longText = "x".repeat(200) + "TARGET" + "y".repeat(200);
    const cached = makeCached("s1", "Test", [{ id: "m1", role: "user" }], {
      m1: [{ type: "text", text: longText }],
    });
    const result = searchCachedSessions([cached], "TARGET");
    assert.equal(result.hits.length, 1);
    assert.ok(result.hits[0].snippet.includes("TARGET"));
    assert.ok(result.hits[0].snippet.length < 200);
  });
});
