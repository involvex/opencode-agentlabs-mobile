import { useColorScheme, type ColorSchemeName } from "react-native";
import { useSettings } from "../stores/settings";
import type { Theme } from "../stores/settings";

export function resolveTheme(theme: Theme, system: ColorSchemeName): boolean {
  if (theme === "auto") {
    return system === "dark";
  }
  return theme === "dark";
}

export function useTheme(): boolean {
  const theme = useSettings((s) => s.theme);
  const system = useColorScheme();
  return resolveTheme(theme, system);
}

export function useAccentColor(): string {
  return useSettings((s) => s.accentColor);
}

export const PRESET_ACCENT_COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#14b8a3",
] as const;
