// Incomplete ANSI CSI sequence at end of a string: ESC + [ + (optional digits/semicolons)
// without a final byte. The final byte (e.g. 'm' for SGR) is in the next chunk.
const INCOMPLETE_CSI = /\x1b\[[0-9;]*$/;

// Standalone ESC at end of a string — the next byte (e.g. '[') arrived in the next chunk.
const STANDALONE_ESC = /\x1b$/;

export function normalizeTerminalChunk(
  chunk: string,
  pending: string,
): { lines: string[]; pending: string } {
  const data = pending + chunk;
  const rawLines = data.split("\n");
  const complete = rawLines.slice(0, -1);
  const remainder = rawLines[rawLines.length - 1] ?? "";

  let newPending = "";
  const m = INCOMPLETE_CSI.exec(remainder);
  if (m) {
    newPending = m[0];
    const lastComplete = remainder.slice(0, m.index);
    if (lastComplete) complete.push(lastComplete);
  } else {
    const e = STANDALONE_ESC.exec(remainder);
    if (e) {
      newPending = e[0];
      const lastComplete = remainder.slice(0, e.index);
      if (lastComplete) complete.push(lastComplete);
    } else if (remainder || data.endsWith("\n") || data === "") {
      complete.push(remainder);
    }
  }

  // Check each complete line for trailing incomplete CSIs or standalone ESC.
  // A trimmed line may itself end with another incomplete CSI, so we loop
  // until no more fragments are found at the end.
  const lines: string[] = [];
  for (const line of complete) {
    let trimmed = line;
    while (trimmed) {
      const lm = INCOMPLETE_CSI.exec(trimmed);
      if (lm) {
        newPending = lm[0] + newPending;
        trimmed = trimmed.slice(0, lm.index);
        continue;
      }
      const le = STANDALONE_ESC.exec(trimmed);
      if (le) {
        newPending = le[0] + newPending;
        trimmed = trimmed.slice(0, le.index);
        continue;
      }
      break;
    }
    lines.push(trimmed.replace(/\r$/, ""));
  }

  return {
    lines,
    pending: newPending,
  };
}
