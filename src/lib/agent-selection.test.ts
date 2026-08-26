import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cycleAgentName,
  isPrimaryAgent,
  primaryAgents,
} from "./agent-selection.ts";
import type { Agent } from "./sdk";

function mkAgent(name: string, mode?: Agent["mode"], hidden?: boolean): Agent {
  const base = {
    name,
    description: `${name} agent`,
    native: true,
    hidden,
    options: {},
  };
  // `mode` stays absent when not provided — that's the server-drift case
  // under test (SDK type marks it required; real /agent responses omit it).
  return (mode ? { ...base, mode } : base) as Agent;
}

describe("isPrimaryAgent", () => {
  test("treats missing mode as primary/all (server default)", () => {
    assert.equal(isPrimaryAgent(mkAgent("custom")), true);
  });

  test("explicit primary and all are primary", () => {
    assert.equal(isPrimaryAgent(mkAgent("build", "primary")), true);
    assert.equal(isPrimaryAgent(mkAgent("general", "all")), true);
  });

  test("explicit subagent is not primary", () => {
    assert.equal(isPrimaryAgent(mkAgent("explore", "subagent")), false);
  });
});

describe("primaryAgents", () => {
  test("filters subagents, preserves order, keeps missing-mode agents", () => {
    const agents = [
      mkAgent("build", "primary"),
      mkAgent("explore", "subagent"),
      mkAgent("compound-engineer"), // config-defined, mode dropped upstream
      mkAgent("plan", "primary"),
    ];
    assert.deepEqual(
      primaryAgents(agents).map((a) => a.name),
      ["build", "compound-engineer", "plan"],
    );
  });
});

describe("cycleAgentName", () => {
  const agents = [
    mkAgent("build"),
    mkAgent("explore", "subagent"),
    mkAgent("plan"),
  ];

  test("cycles forward skipping subagents", () => {
    assert.equal(cycleAgentName(agents, "build", 1), "plan");
  });

  test("cycles backward skipping subagents", () => {
    assert.equal(cycleAgentName(agents, "plan", -1), "build");
  });

  test("wraps around the ends of the primary list", () => {
    assert.equal(cycleAgentName(agents, "plan", 1), "build");
    assert.equal(cycleAgentName(agents, "build", -1), "plan");
  });

  test("unknown current agent falls back to the first primary", () => {
    assert.equal(cycleAgentName(agents, "nonexistent", 1), "build");
  });

  test("returns null when fewer than two primaries exist", () => {
    const solo = [mkAgent("build"), mkAgent("explore", "subagent")];
    assert.equal(cycleAgentName(solo, "build", 1), null);
    assert.equal(cycleAgentName([], "build", 1), null);
  });
});
