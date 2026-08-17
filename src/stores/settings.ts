import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { type Category, defaultPreferences } from "../lib/notifications";
import { clampPageSize, mergeStoredSettings } from "../lib/settings-merge";
import { setAppLocale } from "../lib/i18n/config";
import type { LocalePreference } from "../lib/i18n/locale-resolve";

const SETTINGS_KEY = "opencode_settings";

export type Density = "compact" | "default" | "comfortable";
export type Theme = "light" | "dark" | "auto";

interface Settings {
  pageSize: number;
  notifications: Record<Category, boolean>;
  locale: LocalePreference;
  terminalFontSize: number;
  chatFontSize: number;
  debugMode: boolean;
  density: Density;
  theme: Theme;
  accentColor: string;
  autoPlaySpeech: boolean;
}

const DEFAULTS: Settings = {
  pageSize: 25,
  notifications: { ...defaultPreferences },
  locale: "system",
  terminalFontSize: 13,
  chatFontSize: 15,
  debugMode: false,
  density: "default",
  theme: "auto",
  accentColor: "#8b5cf6",
  autoPlaySpeech: false,
};

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  setPageSize: (size: number) => Promise<void>;
  setNotification: (category: Category, enabled: boolean) => Promise<void>;
  setLocale: (locale: LocalePreference) => Promise<void>;
  setTerminalFontSize: (size: number) => Promise<void>;
  setChatFontSize: (size: number) => Promise<void>;
  setDebugMode: (enabled: boolean) => Promise<void>;
  setDensity: (density: Density) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
  setAutoPlaySpeech: (enabled: boolean) => Promise<void>;
}

function clampTerminalFontSize(size: number): number {
  return Math.max(10, Math.min(18, size));
}

function clampChatFontSize(size: number): number {
  return Math.max(12, Math.min(20, size));
}

function snapshot(get: () => SettingsState): Settings {
  return {
    pageSize: get().pageSize,
    notifications: get().notifications,
    locale: get().locale,
    terminalFontSize: get().terminalFontSize,
    chatFontSize: get().chatFontSize,
    debugMode: get().debugMode,
    density: get().density,
    theme: get().theme,
    accentColor: get().accentColor,
    autoPlaySpeech: get().autoPlaySpeech,
  };
}

async function persist(settings: Settings) {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      // Merge stored settings with defaults so new fields/categories get their default
      const merged = mergeStoredSettings(DEFAULTS, parsed);
      set({ ...merged, loaded: true });
      setAppLocale(merged.locale);
      return;
    }
    set({ loaded: true });
  },

  setPageSize: async (size) => {
    const clamped = clampPageSize(size);
    set({ pageSize: clamped });
    await persist({ ...snapshot(get), pageSize: clamped });
  },

  setNotification: async (category, enabled) => {
    const notifications = { ...get().notifications, [category]: enabled };
    set({ notifications });
    await persist({ ...snapshot(get), notifications });
  },

  setLocale: async (locale) => {
    set({ locale });
    setAppLocale(locale); // applies immediately
    await persist({ ...snapshot(get), locale });
  },

  setTerminalFontSize: async (size) => {
    const clamped = clampTerminalFontSize(size);
    set({ terminalFontSize: clamped });
    await persist({ ...snapshot(get), terminalFontSize: clamped });
  },

  setChatFontSize: async (size: number) => {
    const clamped = clampChatFontSize(size);
    set({ chatFontSize: clamped });
    await persist({ ...snapshot(get), chatFontSize: clamped });
  },

  setDebugMode: async (enabled) => {
    set({ debugMode: enabled });
    await persist({ ...snapshot(get), debugMode: enabled });
  },

  setDensity: async (density) => {
    set({ density });
    await persist({ ...snapshot(get), density });
  },

  setTheme: async (theme) => {
    set({ theme });
    await persist({ ...snapshot(get), theme });
  },

  setAccentColor: async (color) => {
    set({ accentColor: color });
    await persist({ ...snapshot(get), accentColor: color });
  },

  setAutoPlaySpeech: async (enabled) => {
    set({ autoPlaySpeech: enabled });
    await persist({ ...snapshot(get), autoPlaySpeech: enabled });
  },
}));
