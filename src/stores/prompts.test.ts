import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { PromptSnippet } from "../../stores/prompts";

interface MatchablePrompt {
  id: string;
  title: string;
  body: string;
}

function matchPrompt(
  prompts: MatchablePrompt[],
  query: string,
): MatchablePrompt[] {
  if (!query.trim()) return prompts;
  const q = query.toLowerCase();
  return prompts.filter(
    (p) =>
      p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
  );
}

function filterByExactName(
  prompts: MatchablePrompt[],
  name: string,
): MatchablePrompt | undefined {
  const q = name.toLowerCase();
  return prompts.find(
    (p) => p.title.toLowerCase() === q || p.title.toLowerCase().startsWith(q),
  );
}

describe("prompts matching", () => {
  const snippets: PromptSnippet[] = [
    {
      id: "p1",
      title: "Code Review",
      body: "Review this PR for bugs and style",
      createdAt: 0,
    },
    {
      id: "p2",
      title: "Debug Bug",
      body: "Help me debug this authentication error",
      createdAt: 0,
    },
    {
      id: "p3",
      title: "Documentation",
      body: "Write API documentation for the new endpoints",
      createdAt: 0,
    },
  ];

  const simple = snippets.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
  }));

  test("matchPrompt returns all for empty query", () => {
    assert.equal(matchPrompt(simple, "").length, 3);
    assert.equal(matchPrompt(simple, "   ").length, 3);
  });

  test("matchPrompt matches by title (case-insensitive)", () => {
    const result = matchPrompt(simple, "code");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "p1");
  });

  test("matchPrompt matches by body", () => {
    const result = matchPrompt(simple, "authentication");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "p2");
  });

  test("matchPrompt matches partial substring", () => {
    const result = matchPrompt(simple, "bug");
    assert.equal(result.length, 2);
  });

  test("matchPrompt returns empty for no match", () => {
    const result = matchPrompt(simple, "nonexistent");
    assert.equal(result.length, 0);
  });

  test("filterByExactName finds exact match", () => {
    const result = filterByExactName(simple, "documentation");
    assert.ok(result);
    assert.equal(result?.id, "p3");
  });

  test("filterByExactName finds prefix match", () => {
    const result = filterByExactName(simple, "code");
    assert.ok(result);
    assert.equal(result?.id, "p1");
  });

  test("filterByExactName returns undefined for no match", () => {
    const result = filterByExactName(simple, "nonexistent");
    assert.equal(result, undefined);
  });
});
