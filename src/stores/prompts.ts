import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export interface PromptSnippet {
  id: string;
  title: string;
  body: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
  directory?: string;
  createdAt: number;
}

export interface PromptsState {
  prompts: PromptSnippet[];
  loaded: boolean;
  load: () => Promise<void>;
  addPrompt: (prompt: Omit<PromptSnippet, "id" | "createdAt">) => Promise<void>;
  updatePrompt: (
    id: string,
    patch: Partial<Omit<PromptSnippet, "id" | "createdAt">>,
  ) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  getPrompt: (id: string) => PromptSnippet | undefined;
  matchPrompt: (query: string) => PromptSnippet | undefined;
}

const PROMPTS_KEY = "opencode_prompts_v1";

function persist(prompts: PromptSnippet[]) {
  return SecureStore.setItemAsync(PROMPTS_KEY, JSON.stringify(prompts)).catch(
    () => {},
  );
}

export const usePrompts = create<PromptsState>((set, get) => ({
  prompts: [],
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(PROMPTS_KEY).catch(() => null);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PromptSnippet[];
        if (Array.isArray(parsed)) {
          set({ prompts: parsed, loaded: true });
          return;
        }
      } catch {}
    }
    set({ prompts: [], loaded: true });
  },

  addPrompt: async (prompt) => {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const full: PromptSnippet = { ...prompt, id, createdAt: Date.now() };
    const next = [...get().prompts, full];
    set({ prompts: next });
    await persist(next);
  },

  updatePrompt: async (id, patch) => {
    const next = get().prompts.map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    );
    set({ prompts: next });
    await persist(next);
  },

  deletePrompt: async (id) => {
    const next = get().prompts.filter((p) => p.id !== id);
    set({ prompts: next });
    await persist(next);
  },

  getPrompt: (id) => get().prompts.find((p) => p.id === id),

  matchPrompt: (query) => {
    const q = query.toLowerCase();
    return get().prompts.find(
      (p) =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
    );
  },
}));
