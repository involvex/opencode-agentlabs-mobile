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
      type === "copy" &&
      typeof (parsed as { data?: unknown }).data === "string"
    ) {
      return { type: "copy", data: (parsed as { data: string }).data };
    }
    if (type === "paste-request") return { type: "paste-request" };
    return null;
  } catch {
    return null;
  }
}
