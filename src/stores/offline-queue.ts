import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORAGE_KEY = "opencode_offline_queue";

export interface QueuedPrompt {
  id: string;
  sessionID: string;
  text: string;
  pathContexts: string[];
  timestamp: number;
}

interface OfflineQueueState {
  queue: QueuedPrompt[];
  loaded: boolean;
  load: () => Promise<void>;
  enqueue: (
    entry: Omit<QueuedPrompt, "id" | "timestamp">,
  ) => Promise<QueuedPrompt>;
  dequeue: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  forSession: (sessionID: string) => QueuedPrompt[];
}

async function persist(queue: QueuedPrompt[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

let seq = 0;
function nextId() {
  seq += 1;
  return `q-${Date.now()}-${seq}`;
}

export const useOfflineQueue = create<OfflineQueueState>((set, get) => ({
  queue: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const queue = raw ? (JSON.parse(raw) as QueuedPrompt[]) : [];
      set({ queue: Array.isArray(queue) ? queue : [], loaded: true });
    } catch {
      set({ queue: [], loaded: true });
    }
  },

  enqueue: async (entry) => {
    const item: QueuedPrompt = {
      ...entry,
      id: nextId(),
      timestamp: Date.now(),
    };
    const queue = [...get().queue, item];
    set({ queue });
    await persist(queue);
    return item;
  },

  dequeue: async (id) => {
    const queue = get().queue.filter((q) => q.id !== id);
    set({ queue });
    await persist(queue);
  },

  clear: async () => {
    set({ queue: [] });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  forSession: (sessionID) =>
    get().queue.filter((q) => q.sessionID === sessionID),
}));
