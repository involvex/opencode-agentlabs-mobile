// Pure, transport-agnostic logic for token/cost budget alerts (§3.9).
// Extracted so it's unit-testable under plain `node --test` without expo
// imports (same pattern as session-archive.ts / session-search.ts).
import type { Message } from "./sdk";

export interface UsageTotals {
  cost: number;
  outputTokens: number;
}

// Cumulative usage across a message list: sum of assistant-message costs and
// output tokens. Mirrors SessionInfo's cost summation; output tokens are used
// (not context/input) because they represent actual generation spend.
export function sumMessageUsage(
  messages: Message[] | undefined | null,
): UsageTotals {
  let cost = 0;
  let outputTokens = 0;
  for (const m of Array.isArray(messages) ? messages : []) {
    if (m.role !== "assistant") continue;
    if (typeof m.cost === "number" && Number.isFinite(m.cost) && m.cost > 0) {
      cost += m.cost;
    }
    const out = m.tokens?.output;
    if (typeof out === "number" && Number.isFinite(out) && out > 0) {
      outputTokens += out;
    }
  }
  return { cost, outputTokens };
}

export type BudgetState = "off" | "ok" | "exceeded";

// limit <= 0 means the limit is disabled ("off"). Used >= limit trips it.
export function budgetState(used: number, limit: number): BudgetState {
  if (!(limit > 0)) return "off";
  return used >= limit ? "exceeded" : "ok";
}

// Local-date key (YYYY-MM-DD) for daily budget rollover.
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
