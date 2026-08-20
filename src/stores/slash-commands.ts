import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const PREFS_KEY = "opencode_slash_prefs_v1";

interface SlashCommandPrefs {
  recent: string[];
  favorites: string[];
}

const DEFAULTS: SlashCommandPrefs = {
  recent: [],
  favorites: [],
};

interface SlashCommandsState extends SlashCommandPrefs {
  loaded: boolean;
  load: () => Promise<void>;
  addRecent: (trigger: string) => Promise<void>;
  clearRecent: () => Promise<void>;
  toggleFavorite: (trigger: string) => Promise<void>;
  isFavorite: (trigger: string) => boolean;
}

function persist(prefs: SlashCommandPrefs) {
  return SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs)).catch(
    () => {},
  );
}

export const useSlashCommands = create<SlashCommandsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(PREFS_KEY).catch(() => null);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SlashCommandPrefs;
        if (
          parsed &&
          Array.isArray(parsed.recent) &&
          Array.isArray(parsed.favorites)
        ) {
          set({
            recent: parsed.recent.slice(0, 10),
            favorites: parsed.favorites,
            loaded: true,
          });
          return;
        }
      } catch {}
    }
    set({ ...DEFAULTS, loaded: true });
  },

  addRecent: async (trigger) => {
    const lower = trigger.toLowerCase();
    const recent = [lower, ...get().recent.filter((t) => t !== lower)].slice(
      0,
      10,
    );
    set({ recent });
    await persist({ recent, favorites: get().favorites });
  },

  clearRecent: async () => {
    set({ recent: [] });
    await persist({ recent: [], favorites: get().favorites });
  },

  toggleFavorite: async (trigger) => {
    const lower = trigger.toLowerCase();
    const favorites = get().favorites.includes(lower)
      ? get().favorites.filter((t) => t !== lower)
      : [...get().favorites, lower];
    set({ favorites });
    await persist({ recent: get().recent, favorites });
  },

  isFavorite: (trigger) => get().favorites.includes(trigger.toLowerCase()),
}));
