import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { type Category, defaultPreferences } from "../lib/notifications"
import { clampPageSize, mergeStoredSettings } from "../lib/settings-merge"

const SETTINGS_KEY = "opencode_settings"

interface Settings {
  pageSize: number
  notifications: Record<Category, boolean>
}

const DEFAULTS: Settings = {
  pageSize: 25,
  notifications: { ...defaultPreferences },
}

interface SettingsState extends Settings {
  loaded: boolean
  load: () => Promise<void>
  setPageSize: (size: number) => Promise<void>
  setNotification: (category: Category, enabled: boolean) => Promise<void>
}

function snapshot(get: () => SettingsState): Settings {
  return { pageSize: get().pageSize, notifications: get().notifications }
}

async function persist(settings: Settings) {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings))
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      // Merge stored settings with defaults so new fields/categories get their default
      set({ ...mergeStoredSettings(DEFAULTS, parsed), loaded: true })
      return
    }
    set({ loaded: true })
  },

  setPageSize: async (size) => {
    const clamped = clampPageSize(size)
    set({ pageSize: clamped })
    await persist({ ...snapshot(get), pageSize: clamped })
  },

  setNotification: async (category, enabled) => {
    const notifications = { ...get().notifications, [category]: enabled }
    set({ notifications })
    await persist({ ...snapshot(get), notifications })
  },
}))
