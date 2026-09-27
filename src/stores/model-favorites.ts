import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { modelFavKey } from "../lib/model-list";

export { modelFavKey };

const STORAGE_KEY = "opencode_model_favorites_v1";

interface ModelFavoritesState {
  favorites: string[];
  loaded: boolean;
  load: () => Promise<void>;
  toggleFavorite: (providerID: string, modelID: string) => Promise<void>;
  isFavorite: (providerID: string, modelID: string) => boolean;
}

function persist(favorites: string[]) {
  return SecureStore.setItemAsync(
    STORAGE_KEY,
    JSON.stringify({ favorites }),
  ).catch(() => {});
}

export const useModelFavorites = create<ModelFavoritesState>((set, get) => ({
  favorites: [],
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY).catch(() => null);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { favorites?: unknown };
        if (parsed && Array.isArray(parsed.favorites)) {
          set({
            favorites: parsed.favorites.filter(
              (f): f is string => typeof f === "string",
            ),
            loaded: true,
          });
          return;
        }
      } catch {}
    }
    set({ favorites: [], loaded: true });
  },

  toggleFavorite: async (providerID, modelID) => {
    const key = modelFavKey(providerID, modelID);
    const favorites = get().favorites.includes(key)
      ? get().favorites.filter((f) => f !== key)
      : [...get().favorites, key];
    set({ favorites });
    await persist(favorites);
  },

  isFavorite: (providerID, modelID) =>
    get().favorites.includes(modelFavKey(providerID, modelID)),
}));
