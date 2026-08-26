import { create } from "zustand";
import { useConnections } from "./connections";
import type { Agent, Command } from "../lib/sdk";
import {
  chooseModelSelection,
  type ModelSelection,
} from "../lib/model-selection";
import { cycleAgentName } from "../lib/agent-selection";

export interface ProviderModel {
  id: string;
  name: string;
  reasoning: boolean;
  attachment: boolean;
  limit?: { context: number; output: number };
  variants?: Record<string, { reasoningEffort?: string }>;
}

export interface Provider {
  id: string;
  name: string;
  connected: boolean;
  models: ProviderModel[];
}

function sameModel(left: ModelSelection | null, right: ModelSelection | null) {
  return (
    left?.providerID === right?.providerID && left?.modelID === right?.modelID
  );
}

// Last-used selections per directory scope. Catalog requests are scoped by
// the x-opencode-directory header, so each project has its own agent set and
// provider list — remembering per scope keeps switching between projects
// from leaking one project's custom agents into another (issue #198).
interface ScopedSelection {
  agent: string;
  model: ModelSelection | null;
  variant: string | null;
}
const scopedSelections = new Map<string, ScopedSelection>();

interface CatalogState {
  agents: Agent[];
  commands: Command[];
  providers: Provider[];
  defaults: Record<string, string>;
  // Current selections
  agent: string; // agent name, e.g. "build"
  model: ModelSelection | null;
  variant: string | null; // model variant for reasoning effort (e.g. "low", "medium", "high")
  // Directory scope the current selections were loaded for. Undefined means
  // the active connection's default scope.
  directory?: string;
  loaded: boolean;

  // Actions
  load: (directory?: string) => Promise<void>;
  setAgent: (name: string) => void;
  setModel: (selection: ModelSelection | null) => void;
  setVariant: (variant: string | null) => void;
  cycleAgent: (direction?: 1 | -1) => boolean;
}

function remember(scopeKey: string, selection: ScopedSelection) {
  scopedSelections.set(scopeKey, selection);
}

export const useCatalog = create<CatalogState>((set, get) => ({
  agents: [],
  commands: [],
  providers: [],
  defaults: {},
  agent: "",
  model: null,
  variant: null,
  loaded: false,

  load: async (directory) => {
    const connState = useConnections.getState();
    // Scope the whole catalog (agents/commands/providers AND the request's
    // directory header) to the caller's project: the session screen passes its
    // session's directory so the agent/model lists come from the SAME server
    // instance the prompts will be sent to. A mismatch here lets the UI offer
    // an agent name the target instance doesn't have — upstream then throws
    // "Agent not found" before the user message is even saved, silently
    // swallowing the prompt (issue #198). No argument keeps the legacy
    // active-connection client scope.
    const client = directory
      ? connState.clientForDirectory(directory)
      : connState.client;
    if (!client) return;

    const [agentResult, commandResult, providerResult] = await Promise.all([
      client.agent.list().catch(() => [] as Agent[]),
      client.command.list().catch(() => [] as Command[]),
      client.provider.list().catch(() => null),
    ]);

    const agents = Array.isArray(agentResult) ? agentResult : [];
    const commands = Array.isArray(commandResult) ? commandResult : [];

    // Parse provider response: { all: [...], default: {...}, connected: [...] }
    const raw = providerResult;
    const connected = new Set(
      Array.isArray(raw?.connected) ? raw.connected : [],
    );
    const defaults = raw?.default || {};
    const providers: Provider[] = Array.isArray(raw?.all)
      ? raw.all
          .filter((p) => connected.has(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name || p.id,
            connected: connected.has(p.id),
            models: Object.values(p.models || {})
              .filter((m) => m.status !== "deprecated")
              .map((m) => ({
                id: m.id,
                name: m.name || m.id,
                reasoning: m.reasoning ?? false,
                attachment: m.attachment ?? false,
                limit: m.limit,
                variants: m.variants,
              })),
          }))
          .filter((p) => p.models.length > 0)
      : [];

    // Filter out hidden agents
    const visible = agents.filter((a) => !a.hidden);

    // Restore this scope's last selections; while reloading the SAME scope,
    // unsaved in-store picks win over the snapshot (they may be newer than
    // the last remember() call).
    const scopeKey = directory ?? "";
    const sameScope = get().directory === directory;
    const stored = scopedSelections.get(scopeKey);
    const prior: ScopedSelection = sameScope
      ? { agent: get().agent, model: get().model, variant: get().variant }
      : { agent: "", model: null, variant: null };
    const preferredAgent = stored?.agent || prior.agent;
    const agent =
      preferredAgent && visible.some((a) => a.name === preferredAgent)
        ? preferredAgent
        : visible[0]?.name || "build";

    // Default model: keep valid existing selection; otherwise prefer connected
    // provider defaults, then first connected model; agent model is last fallback.
    const defaultAgent = visible[0];
    const model = chooseModelSelection({
      providers,
      defaults,
      existing: stored?.model ?? prior.model,
      agentModel: defaultAgent?.model || null,
    });
    const selectedPrior = stored?.model ?? prior.model;
    const variant = sameModel(selectedPrior, model)
      ? (stored?.variant ?? prior.variant)
      : null;

    const selection: ScopedSelection = { agent, model, variant };
    remember(scopeKey, selection);

    set({
      agents: visible,
      commands,
      providers,
      defaults,
      directory,
      ...selection,
      loaded: true,
    });
  },

  setAgent: (name) => {
    const match = get().agents.find((a) => a.name === name);
    if (!match) return;
    const model = match.model || get().model;
    set((state) => ({
      agent: name,
      model,
      variant: sameModel(state.model, model) ? state.variant : null,
    }));
    remember(get().directory ?? "", {
      agent: get().agent,
      model: get().model,
      variant: get().variant,
    });
  },

  setModel: (selection) => {
    set((state) => ({
      model: selection,
      variant: sameModel(state.model, selection) ? state.variant : null,
    }));
    remember(get().directory ?? "", {
      agent: get().agent,
      model: get().model,
      variant: get().variant,
    });
  },

  setVariant: (variant) => {
    set({ variant });
    remember(get().directory ?? "", {
      agent: get().agent,
      model: get().model,
      variant: get().variant,
    });
  },

  cycleAgent: (direction = 1) => {
    const next = cycleAgentName(get().agents, get().agent, direction);
    if (!next) return false;
    get().setAgent(next);
    return true;
  },
}));
