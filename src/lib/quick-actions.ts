// Pure helpers for customizable quick-action chips above the chat composer.
// A quick action inserts free text OR references any slash command
// (builtin trigger like "summarize" or server command name like "commit").

export type QuickAction =
  | {
      id: string;
      label: string;
      kind: "text";
      text: string;
      sendImmediately?: boolean;
    }
  | {
      id: string;
      label: string;
      kind: "command";
      trigger: string;
      args?: string;
      sendImmediately?: boolean;
    };

export const MAX_QUICK_ACTIONS = 8;
export const MAX_QUICK_LABEL = 20;

const TRIGGER_RE = /^[a-z0-9-_]+$/i;

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "commit",
    label: "Commit",
    kind: "text",
    text: "Create a concise git commit for the current changes.",
  },
  {
    id: "tests",
    label: "Tests",
    kind: "text",
    text: "Run relevant tests and fix any failures.",
  },
  {
    id: "explain",
    label: "Explain",
    kind: "text",
    text: "Explain the current changes and their impact briefly.",
  },
  {
    id: "lint",
    label: "Lint",
    kind: "text",
    text: "Fix lint and type errors in the touched files.",
  },
  {
    id: "summarize",
    label: "Summarize",
    kind: "command",
    trigger: "summarize",
  },
];

export type ResolvedQuickAction =
  | { type: "insert"; text: string }
  | { type: "builtin"; trigger: string; args: string }
  | { type: "server-command"; trigger: string; args: string };

export function quickActionSubtitle(action: QuickAction): string {
  if (action.kind === "text") return action.text;
  const args = action.args?.trim() ? ` ${action.args.trim()}` : "";
  return `/${action.trigger}${args}`;
}

export function validateQuickAction(action: QuickAction): string | null {
  if (!action.label.trim()) return "Label is required.";
  if (action.label.trim().length > MAX_QUICK_LABEL) {
    return `Label must be ${MAX_QUICK_LABEL} characters or fewer.`;
  }
  if (action.kind === "text") {
    if (!action.text.trim()) return "Text is required.";
    return null;
  }
  if (!action.trigger.trim()) return "Command trigger is required.";
  if (!TRIGGER_RE.test(action.trigger.trim())) {
    return "Command trigger may only contain letters, numbers, - and _.";
  }
  return null;
}

/**
 * Resolve a quick action against the known builtin triggers and server
 * command names. Unknown triggers degrade to plain insert-text
 * (`/trigger args`) so a stale/renamed server command never silently dies.
 */
export function resolveQuickAction(
  action: QuickAction,
  builtinTriggers: string[],
  serverCommands: string[],
): ResolvedQuickAction {
  if (action.kind === "text") {
    return { type: "insert", text: action.text };
  }
  const trigger = action.trigger.trim();
  const args = action.args?.trim() ?? "";
  const lower = trigger.toLowerCase();
  const builtins = new Set(builtinTriggers.map((t) => t.toLowerCase()));
  const server = new Set(serverCommands.map((c) => c.toLowerCase()));
  if (builtins.has(lower)) return { type: "builtin", trigger, args };
  if (server.has(lower)) return { type: "server-command", trigger, args };
  return {
    type: "insert",
    text: `/${trigger}${args ? ` ${args}` : ""}`.trim(),
  };
}

/**
 * Merge stored actions over defaults. Unknown stored entries are kept
 * (user data wins); an empty array is honored (user hid the bar).
 * Returns null when storage has no usable value (first run).
 */
export function mergeQuickActions(
  stored: unknown,
  defaults: QuickAction[] = DEFAULT_QUICK_ACTIONS,
): QuickAction[] | null {
  if (stored === null || stored === undefined) return null;
  if (!Array.isArray(stored)) return null;
  const cleaned = (stored as unknown[]).filter(
    (a): a is QuickAction =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as QuickAction).id === "string" &&
      typeof (a as QuickAction).label === "string" &&
      ((a as QuickAction).kind === "text" ||
        (a as QuickAction).kind === "command"),
  );
  return cleaned.slice(0, MAX_QUICK_ACTIONS);
}

export function defaultQuickActions(): QuickAction[] {
  return DEFAULT_QUICK_ACTIONS.map((a) => ({ ...a }));
}
