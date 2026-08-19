export function normalizeTerminalChunk(chunk: string): string[] {
  const rawLines = chunk.split("\n");
  return rawLines.map((l) => l.replace(/\r$/, ""));
}
