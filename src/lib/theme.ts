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
