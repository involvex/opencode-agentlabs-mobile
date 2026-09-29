import type { Part } from "./sdk";

export interface StepPair {
  start: Part;
  finish: Part | null;
  index: number;
}

// Groups scattered `step-start`/`step-finish` parts of one message into
// pairs. Matches the real server schema (StepStartPart/StepFinishPart carry
// no `text` — titles/summaries are derived by the renderer, never read from
// the parts). A `step-finish` with no open `step-start` is stray server noise
// and is dropped; a `step-start` with no matching `step-finish` is kept as an
// in-flight pair with `finish: null`.
export function pairStepParts(parts: Part[]): StepPair[] {
  const pairs: StepPair[] = [];
  let currentStart: Part | null = null;
  let index = 0;

  for (const part of parts) {
    if (part.type === "step-start") {
      if (currentStart) {
        // Orphaned start (previous one had no matching finish) — store it
        pairs.push({ start: currentStart, finish: null, index: index++ });
      }
      currentStart = part;
    } else if (part.type === "step-finish" && currentStart) {
      pairs.push({ start: currentStart, finish: part, index: index++ });
      currentStart = null;
    }
  }

  // Any trailing unpaired start
  if (currentStart) {
    pairs.push({ start: currentStart, finish: null, index: index });
  }

  return pairs;
}
