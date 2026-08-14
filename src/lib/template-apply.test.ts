import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyTemplate,
  filterTemplates,
  templateMatches,
} from "./template-apply.ts";
import type { SessionTemplate } from "../stores/templates";

describe("template-apply", () => {
  const tmpl = (overrides: Partial<SessionTemplate> = {}): SessionTemplate => ({
    id: "t1",
    name: "My Template",
    prompt: "Fix the auth bug",
    model: { providerID: "openai", modelID: "gpt-5" },
    agent: "default",
    directory: "/home/user/project",
    ...overrides,
  });

  describe("applyTemplate", () => {
    test("null template returns overrides as-is", () => {
      const result = applyTemplate(null, {
        model: { providerID: "openai", modelID: "gpt-5" },
        agent: "coder",
      });
      assert.deepEqual(result, {
        model: { providerID: "openai", modelID: "gpt-5" },
        agent: "coder",
        directory: undefined,
      });
    });

    test("null template with no overrides returns empties", () => {
      const result = applyTemplate(null);
      assert.equal(result.model, undefined);
      assert.equal(result.agent, undefined);
      assert.equal(result.directory, undefined);
    });

    test("template fields are returned when no overrides", () => {
      const result = applyTemplate(tmpl());
      assert.deepEqual(result.model, {
        providerID: "openai",
        modelID: "gpt-5",
      });
      assert.equal(result.agent, "default");
      assert.equal(result.directory, "/home/user/project");
    });

    test("overrides take precedence over template", () => {
      const result = applyTemplate(tmpl(), {
        model: { providerID: "anthropic", modelID: "claude-3" },
      });
      assert.deepEqual(result.model, {
        providerID: "anthropic",
        modelID: "claude-3",
      });
      assert.equal(result.agent, "default"); // from template
    });

    test("partial overrides fall back to template", () => {
      const result = applyTemplate(tmpl(), {
        agent: "reviewer",
      });
      assert.deepEqual(result.model, {
        providerID: "openai",
        modelID: "gpt-5",
      }); // from template
      assert.equal(result.agent, "reviewer"); // from override
      assert.equal(result.directory, "/home/user/project"); // from template
    });

    test("template without optional fields", () => {
      const t = tmpl({
        model: undefined,
        agent: undefined,
        directory: undefined,
      });
      const result = applyTemplate(t);
      assert.equal(result.model, undefined);
      assert.equal(result.agent, undefined);
      assert.equal(result.directory, undefined);
    });
  });

  describe("templateMatches", () => {
    test("matches by name", () => {
      assert.equal(templateMatches(tmpl(), "my"), true);
      assert.equal(templateMatches(tmpl(), "MY"), true);
    });

    test("matches by prompt", () => {
      assert.equal(templateMatches(tmpl(), "auth"), true);
      assert.equal(templateMatches(tmpl(), "AUTH"), true);
    });

    test("no match", () => {
      assert.equal(templateMatches(tmpl(), "nonexistent"), false);
    });

    test("empty query matches all", () => {
      assert.equal(templateMatches(tmpl(), ""), true);
      assert.equal(templateMatches(tmpl(), "   "), true);
    });
  });

  describe("filterTemplates", () => {
    const templates = [
      tmpl({ id: "t1", name: "Auth Fixer", prompt: "Fix auth" }),
      tmpl({ id: "t2", name: "Code Reviewer", prompt: "Review the code" }),
      tmpl({ id: "t3", name: "Debug Helper", prompt: "Debug the issue" }),
    ];

    test("returns all when query is empty", () => {
      assert.equal(filterTemplates(templates, "").length, 3);
    });

    test("filters by name", () => {
      const result = filterTemplates(templates, "auth");
      assert.equal(result.length, 1);
      assert.equal(result[0].id, "t1");
    });

    test("filters by prompt", () => {
      const result = filterTemplates(templates, "debug");
      assert.equal(result.length, 1);
      assert.equal(result[0].id, "t3");
    });

    test("case-insensitive", () => {
      const result = filterTemplates(templates, "CODE");
      assert.equal(result.length, 1);
      assert.equal(result[0].id, "t2");
    });
  });
});
