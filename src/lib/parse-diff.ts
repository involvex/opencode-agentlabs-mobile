export type DiffLineType = "add" | "remove" | "context";

export interface DiffLine {
  type: DiffLineType;
  content: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiffEntry {
  path: string;
  hunks: DiffHunk[];
}

/** Parse a unified diff string into hunks (Desk Escape–compatible). */
export function parseDiff(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diff.split("\n");
  let current: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      current = { header: line, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("+")) {
      current.lines.push({ type: "add", content: line.slice(1) });
      continue;
    }
    if (line.startsWith("-")) {
      current.lines.push({ type: "remove", content: line.slice(1) });
      continue;
    }
    if (line.startsWith(" ")) {
      current.lines.push({ type: "context", content: line.slice(1) });
    }
  }

  return hunks;
}
