import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "opencode_reactions";

interface ReactionsState {
  reactions: Record<string, string[]>;
  addReaction: (messageID: string, emoji: string) => void;
  removeReaction: (messageID: string, emoji: string) => void;
  clear: () => void;
  loaded: boolean;
}

export const useReactions = create<ReactionsState>((set, get) => ({
  reactions: {},
  loaded: false,

  addReaction: (messageID, emoji) => {
    const existing = get().reactions[messageID] || [];
    const next = existing.includes(emoji)
      ? existing.filter((e) => e !== emoji)
      : [...existing, emoji];
    const updated = { ...get().reactions, [messageID]: next };
    set({ reactions: updated });
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updated));
  },

  removeReaction: (messageID, emoji) => {
    const existing = get().reactions[messageID] || [];
    const next = existing.filter((e) => e !== emoji);
    const updated = { ...get().reactions };
    if (next.length === 0) {
      delete updated[messageID];
    } else {
      updated[messageID] = next;
    }
    set({ reactions: updated });
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updated));
  },

  clear: () => {
    set({ reactions: {} });
    SecureStore.deleteItemAsync(STORAGE_KEY);
  },
}));

SecureStore.getItemAsync(STORAGE_KEY)
  .then((raw) => {
    if (raw) {
      useReactions.setState({
        reactions: JSON.parse(raw) as Record<string, string[]>,
        loaded: true,
      });
    } else {
      useReactions.setState({ loaded: true });
    }
  })
  .catch(() => {
    useReactions.setState({ loaded: true });
  });
