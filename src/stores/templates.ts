import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export interface SessionTemplate {
  id: string;
  name: string;
  prompt: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
  directory?: string;
}

export interface TemplatesState {
  templates: SessionTemplate[];
  loaded: boolean;
  load: () => Promise<void>;
  addTemplate: (template: Omit<SessionTemplate, "id">) => Promise<void>;
  updateTemplate: (
    id: string,
    patch: Partial<Omit<SessionTemplate, "id">>,
  ) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  getTemplate: (id: string) => SessionTemplate | undefined;
}

const TEMPLATES_KEY = "opencode_templates_v1";

export const useTemplates = create<TemplatesState>((set, get) => ({
  templates: [],
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(TEMPLATES_KEY).catch(() => null);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SessionTemplate[];
        if (Array.isArray(parsed)) {
          set({ templates: parsed, loaded: true });
          return;
        }
      } catch {
        // Corrupt JSON — start fresh
      }
    }
    set({ templates: [], loaded: true });
  },

  addTemplate: async (template) => {
    const id = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const full: SessionTemplate = { ...template, id };
    const next = [...get().templates, full];
    set({ templates: next });
    await SecureStore.setItemAsync(TEMPLATES_KEY, JSON.stringify(next)).catch(
      () => {},
    );
  },

  updateTemplate: async (id, patch) => {
    const next = get().templates.map((t) =>
      t.id === id ? { ...t, ...patch } : t,
    );
    set({ templates: next });
    await SecureStore.setItemAsync(TEMPLATES_KEY, JSON.stringify(next)).catch(
      () => {},
    );
  },

  deleteTemplate: async (id) => {
    const next = get().templates.filter((t) => t.id !== id);
    set({ templates: next });
    await SecureStore.setItemAsync(TEMPLATES_KEY, JSON.stringify(next)).catch(
      () => {},
    );
  },

  getTemplate: (id) => get().templates.find((t) => t.id === id),
}));
