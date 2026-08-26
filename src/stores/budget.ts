import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { todayKey } from "../lib/budget";

export interface DailyUsage {
  date: string;
  cost: number;
  tokens: number;
}

interface BudgetStoreState {
  daily: DailyUsage;
  load: () => void;
  record: (costDelta: number, tokenDelta: number) => void;
}

const KEY = "opencode_daily_usage_v1";

function freshDay(): DailyUsage {
  return { date: todayKey(), cost: 0, tokens: 0 };
}

// Local-only daily usage accumulator backing the budget alerts (§3.9).
// Fed by live assistant-message deltas from the sessions store; rolls over
// automatically when the local date changes.
export const useBudget = create<BudgetStoreState>((set, get) => ({
  daily: freshDay(),

  load: () => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<DailyUsage>;
        if (parsed?.date === todayKey()) {
          set({
            daily: {
              date: parsed.date,
              cost: parsed.cost ?? 0,
              tokens: parsed.tokens ?? 0,
            },
          });
        }
      })
      .catch(() => {});
  },

  record: (costDelta, tokenDelta) => {
    if (!(costDelta > 0) && !(tokenDelta > 0)) return;
    const current = get().daily;
    const date = todayKey();
    const next: DailyUsage =
      current.date === date
        ? {
            date,
            cost: current.cost + Math.max(0, costDelta),
            tokens: current.tokens + Math.max(0, tokenDelta),
          }
        : {
            date,
            cost: Math.max(0, costDelta),
            tokens: Math.max(0, tokenDelta),
          };
    set({ daily: next });
    SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  },
}));
