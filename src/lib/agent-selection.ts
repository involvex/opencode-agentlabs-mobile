// Pure helpers for cycling primary agents. Framework-free so they are
// unit-testable without pulling zustand/expo into the test runner
// (same pattern as model-selection.ts / session-search.ts).
import type { Agent } from "./sdk";

// A server treats an unspecified agent mode as "all" (Agent.Info schema
// default), and upstream #21364/#22130 leak config-defined subagents whose
// `mode` was dropped from the merged config entry. So a missing `mode` must
// NOT exclude an agent from primary cycling, while an explicit "subagent"
// must. `mode` stays optional here even though the SDK type marks it
// required — real /agent responses have been observed without it.
export interface AgentModeRef {
  mode?: Agent["mode"];
}

export function isPrimaryAgent(agent: AgentModeRef): boolean {
  return (agent.mode ?? "all") !== "subagent";
}

export function primaryAgents(agents: Agent[]): Agent[] {
  return agents.filter(isPrimaryAgent);
}

// Returns the next primary agent name in cycle order, or null when there is
// nothing to cycle to (fewer than two primaries — the caller should surface
// that instead of silently no-op'ing, issue #198).
export function cycleAgentName(
  agents: Agent[],
  current: string,
  direction: 1 | -1 = 1,
): string | null {
  const primary = primaryAgents(agents);
  if (primary.length < 2) return null;
  const idx = primary.findIndex((a) => a.name === current);
  const next = primary[(idx + direction + primary.length) % primary.length];
  return next?.name ?? null;
}
