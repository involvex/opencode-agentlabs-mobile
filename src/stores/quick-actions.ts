import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import {
  MAX_QUICK_ACTIONS,
  defaultQuickActions,
  mergeQuickActions,
  validateQuickAction,
  type QuickAction,
} from "../lib/quick-actions";

const QUICK_ACTIONS_KEY = "opencode_quick_actions_v1";

interface QuickActionsState {
  actions: QuickAction[];
  tapToSend: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  setActions: (actions: QuickAction[]) => Promise<void>;
  addAction: (action: Omit<QuickAction, "id">) => Promise<string | null>;
  updateAction: (id: string, patch: Partial<QuickAction>) => Promise<boolean>;
  removeAction: (id: string) => Promise<void>;
  moveAction: (id: string, direction: 1 | -1) => Promise<void>;
  setTapToSend: (value: boolean) => Promise<void>;
  resetDefaults: () => Promise<void>;
}

function persist(actions: QuickAction[], tapToSend: boolean) {
  return SecureStore.setItemAsync(
    QUICK_ACTIONS_KEY,
    JSON.stringify({ actions, tapToSend }),
  ).catch(() => {});
}

export const useQuickActions = create<QuickActionsState>((set, get) => ({
  actions: defaultQuickActions(),
  tapToSend: false,
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(QUICK_ACTIONS_KEY).catch(
      () => null,
    );
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          actions?: unknown;
          tapToSend?: unknown;
        };
        const merged = mergeQuickActions(parsed?.actions);
        if (merged) {
          set({
            actions: merged,
            tapToSend: parsed?.tapToSend === true,
            loaded: true,
          });
          return;
        }
      } catch {}
    }
    set({ actions: defaultQuickActions(), tapToSend: false, loaded: true });
  },

  setActions: async (actions) => {
    const next = actions.slice(0, MAX_QUICK_ACTIONS);
    set({ actions: next });
    await persist(next, get().tapToSend);
  },

  addAction: async (action) => {
    if (get().actions.length >= MAX_QUICK_ACTIONS) return null;
    const full = {
      ...action,
      id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    } as QuickAction;
    if (validateQuickAction(full)) return null;
    const next = [...get().actions, full];
    set({ actions: next });
    await persist(next, get().tapToSend);
    return full.id;
  },

  updateAction: async (id, patch) => {
    const current = get().actions.find((a) => a.id === id);
    if (!current) return false;
    const nextAction = { ...current, ...patch, id } as QuickAction;
    if (validateQuickAction(nextAction)) return false;
    const next = get().actions.map((a) => (a.id === id ? nextAction : a));
    set({ actions: next });
    await persist(next, get().tapToSend);
    return true;
  },

  removeAction: async (id) => {
    const next = get().actions.filter((a) => a.id !== id);
    set({ actions: next });
    await persist(next, get().tapToSend);
  },

  moveAction: async (id, direction) => {
    const actions = [...get().actions];
    const idx = actions.findIndex((a) => a.id === id);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= actions.length) return;
    const [item] = actions.splice(idx, 1);
    actions.splice(swap, 0, item);
    set({ actions });
    await persist(actions, get().tapToSend);
  },

  setTapToSend: async (value) => {
    set({ tapToSend: value });
    await persist(get().actions, value);
  },

  resetDefaults: async () => {
    const next = defaultQuickActions();
    set({ actions: next, tapToSend: false });
    await persist(next, false);
  },
}));
