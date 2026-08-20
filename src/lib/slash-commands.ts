import type { Session } from "./sdk";

export interface SlashCommand {
  trigger: string;
  title: string;
  description?: string;
  icon?: string;
  category?: SlashCommandCategory;
  type: "builtin" | "custom";
  keywords?: string[];
}

export type SlashCommandCategory =
  "navigation" | "edit" | "view" | "prompts" | "debug";

export interface CommandContext {
  setInput: (text: string) => void;
  clearInput: () => void;
  focusComposer: () => void;
  sendMessage: (text: string) => void;
  newSession: () => void;
  switchModel: () => void;
  switchAgent: () => void;
  exportSession: () => void;
  cycleTheme: () => void;
  cycleDensity: () => void;
  summarize: () => void;
  focusSearch: () => void;
  showHelp: () => void;
  getCurrentSession: () => Session | null;
  showToast: (message: string) => void;
}

export type BuiltinCommandHandler = (
  ctx: CommandContext,
  args: string[],
) => void | Promise<void>;

interface RegisteredBuiltin {
  command: SlashCommand;
  handler: BuiltinCommandHandler;
}

export class SlashCommandRegistry {
  private builtins = new Map<string, RegisteredBuiltin>();
  private customCommands: SlashCommand[] = [];

  registerBuiltin(cmd: SlashCommand, handler: BuiltinCommandHandler): void {
    this.builtins.set(cmd.trigger.toLowerCase(), { command: cmd, handler });
  }

  registerCustomCommands(
    commands: { name: string; description?: string }[],
  ): SlashCommand[] {
    this.customCommands = commands.map((cmd) => ({
      trigger: cmd.name,
      title: cmd.name,
      description: cmd.description,
      icon: "code-slash-outline",
      type: "custom",
      category: "navigation",
    }));
    return this.customCommands;
  }

  getBuiltin(trigger: string): SlashCommand | undefined {
    return this.builtins.get(trigger.toLowerCase())?.command;
  }

  getBuiltinHandler(trigger: string): BuiltinCommandHandler | undefined {
    return this.builtins.get(trigger.toLowerCase())?.handler;
  }

  getAll(query?: string): SlashCommand[] {
    const builtinList = Array.from(this.builtins.values()).map(
      (b) => b.command,
    );
    const combined = [...builtinList, ...this.customCommands];
    if (!query || query.trim() === "") return combined;
    return filterCommands(query, combined);
  }

  executeBuiltin(trigger: string, args: string[], ctx: CommandContext): void {
    const entry = this.builtins.get(trigger.toLowerCase());
    if (!entry) return;
    entry.handler(ctx, args);
  }

  insertCustom(trigger: string, ctx: CommandContext): void {
    ctx.setInput(`/${trigger} `);
    ctx.focusComposer();
  }
}

export function filterCommands(
  query: string,
  commands: SlashCommand[],
): SlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) return commands;

  const terms = q.split(/\s+/);
  return commands.filter((cmd) => {
    const haystack = [
      cmd.trigger,
      cmd.title,
      cmd.description,
      ...(cmd.keywords || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

export const COMMAND_CATEGORIES: Record<SlashCommandCategory, string> = {
  navigation: "Navigation",
  edit: "Edit",
  view: "View",
  prompts: "Prompts",
  debug: "Debug",
};

export const DEFAULT_BUILTINS: Record<string, SlashCommand> = {
  new: {
    trigger: "new",
    title: "New Session",
    description: "Start a new session",
    icon: "add-circle-outline",
    category: "navigation",
    type: "builtin",
    keywords: ["create", "start"],
  },
  model: {
    trigger: "model",
    title: "Switch Model",
    description: "Choose a different model",
    icon: "hardware-chip-outline",
    category: "navigation",
    type: "builtin",
    keywords: ["pick", "change"],
  },
  agent: {
    trigger: "agent",
    title: "Switch Agent",
    description: "Cycle to next agent",
    icon: "person-outline",
    category: "navigation",
    type: "builtin",
    keywords: ["cycle", "change"],
  },
  prompt: {
    trigger: "prompt",
    title: "Prompt Library",
    description: "Insert a saved prompt snippet",
    icon: "library-outline",
    category: "prompts",
    type: "builtin",
    keywords: ["snippet", "template"],
  },
  clear: {
    trigger: "clear",
    title: "Clear Input",
    description: "Clear the composer text",
    icon: "close-circle-outline",
    category: "edit",
    type: "builtin",
    keywords: ["reset", "empty"],
  },
  export: {
    trigger: "export",
    title: "Export Session",
    description: "Export current session to Markdown",
    icon: "download-outline",
    category: "edit",
    type: "builtin",
    keywords: ["share", "save", "markdown"],
  },
  theme: {
    trigger: "theme",
    title: "Cycle Theme",
    description: "Switch between light, dark, and auto",
    icon: "moon-outline",
    category: "view",
    type: "builtin",
    keywords: ["dark", "light", "mode"],
  },
  density: {
    trigger: "density",
    title: "Cycle Density",
    description: "Switch between compact, default, and comfortable",
    icon: "apps-outline",
    category: "view",
    type: "builtin",
    keywords: ["compact", "font", "spacing"],
  },
  summarize: {
    trigger: "summarize",
    title: "Summarize",
    description: "Send a summarize prompt for this conversation",
    icon: "document-text-outline",
    category: "edit",
    type: "builtin",
    keywords: ["summary", "bullets", "recap"],
  },
  search: {
    trigger: "search",
    title: "Search Sessions",
    description: "Focus the session list search bar",
    icon: "search-outline",
    category: "navigation",
    type: "builtin",
    keywords: ["find", "filter"],
  },
  help: {
    trigger: "help",
    title: "Help",
    description: "Show all available commands",
    icon: "help-circle-outline",
    category: "debug",
    type: "builtin",
    keywords: ["commands", "list", "docs"],
  },
};
