import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_TERM_CTRL,
  DEFAULT_TERM_NAV,
  defaultTermKeys,
  mergeTermKeys,
  validateTermKey,
  type TermKey,
} from "../lib/terminal-keys";

const TERMINAL_KEYS_KEY = "opencode_terminal_keys_v1";

interface TerminalKeysState {
  nav: TermKey[];
  ctrl: TermKey[];
  loaded: boolean;
  load: () => Promise<void>;
  updateKey: (
    row: "nav" | "ctrl",
    id: string,
    patch: Partial<TermKey>,
  ) => Promise<boolean>;
  resetDefaults: () => Promise<void>;
}

function persist(nav: TermKey[], ctrl: TermKey[]) {
  return SecureStore.setItemAsync(
    TERMINAL_KEYS_KEY,
    JSON.stringify({ nav, ctrl }),
  ).catch(() => {});
}

export const useTerminalKeys = create<TerminalKeysState>((set, get) => ({
  nav: DEFAULT_TERM_NAV.map((k) => ({ ...k })),
  ctrl: DEFAULT_TERM_CTRL.map((k) => ({ ...k })),
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(TERMINAL_KEYS_KEY).catch(
      () => null,
    );
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { nav?: unknown; ctrl?: unknown };
        const nav = mergeTermKeys(parsed?.nav, DEFAULT_TERM_NAV);
        const ctrl = mergeTermKeys(parsed?.ctrl, DEFAULT_TERM_CTRL);
        if (nav && ctrl) {
          set({ nav, ctrl, loaded: true });
          return;
        }
      } catch {}
    }
    const defaults = defaultTermKeys();
    set({ ...defaults, loaded: true });
  },

  updateKey: async (row, id, patch) => {
    const keys = get()[row].map((k) =>
      k.id === id ? { ...k, ...patch, id } : k,
    );
    const updated = keys.find((k) => k.id === id);
    if (!updated || validateTermKey(updated)) return false;
    set({ [row]: keys } as Partial<TerminalKeysState>);
    const state = get();
    await persist(state.nav, state.ctrl);
    return true;
  },

  resetDefaults: async () => {
    const defaults = defaultTermKeys();
    set({ ...defaults });
    await persist(defaults.nav, defaults.ctrl);
  },
}));
