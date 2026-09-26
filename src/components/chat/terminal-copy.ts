import type { XtermOutbound } from "./terminal-xterm-html";

export function parseOutbound(raw: string): XtermOutbound | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const type = (parsed as { type?: unknown }).type;
    if (type === "ready") return { type: "ready" };
    if (
      type === "input" &&
      typeof (parsed as { data?: unknown }).data === "string"
    ) {
      return { type: "input", data: (parsed as { data: string }).data };
    }
    if (
      type === "resize" &&
      typeof (parsed as { cols?: unknown }).cols === "number" &&
      typeof (parsed as { rows?: unknown }).rows === "number"
    ) {
      return {
        type: "resize",
        cols: (parsed as { cols: number }).cols,
        rows: (parsed as { rows: number }).rows,
      };
    }
    if (
      type === "error" &&
      typeof (parsed as { message?: unknown }).message === "string"
    ) {
      return {
        type: "error",
        message: (parsed as { message: string }).message,
      };
    }
    if (
      (type === "longpress" || type === "selection") &&
      typeof (parsed as { data?: unknown }).data === "string" &&
      typeof (parsed as { hasSelection?: unknown }).hasSelection === "boolean"
    ) {
      const p = parsed as { data: string; hasSelection: boolean };
      return { type, data: p.data, hasSelection: p.hasSelection };
    }
    if (
      type === "buffer" &&
      typeof (parsed as { data?: unknown }).data === "string"
    ) {
      return { type: "buffer", data: (parsed as { data: string }).data };
    }
    return null;
  } catch {
    return null;
  }
}

export type TerminalMenuOption = "copy" | "copy-all" | "paste";

export function buildTerminalMenuOptions(
  hasSelection: boolean,
): TerminalMenuOption[] {
  if (hasSelection) return ["copy", "copy-all", "paste"];
  return ["copy-all", "paste"];
}
