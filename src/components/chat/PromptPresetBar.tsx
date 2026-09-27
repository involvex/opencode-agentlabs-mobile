import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useDensity, ds } from "../../lib/density";
import type { QuickAction } from "../../lib/quick-actions";

export interface PromptPreset {
  id: string;
  label: string;
  text: string;
}

export const DEFAULT_PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "commit",
    label: "Commit",
    text: "Create a concise git commit for the current changes.",
  },
  {
    id: "tests",
    label: "Tests",
    text: "Run relevant tests and fix any failures.",
  },
  {
    id: "explain",
    label: "Explain",
    text: "Explain the current changes and their impact briefly.",
  },
  {
    id: "lint",
    label: "Lint",
    text: "Fix lint and type errors in the touched files.",
  },
  {
    id: "summarize",
    label: "Summarize",
    text: "Summarize this conversation in 3 concise bullet points.",
  },
];

interface Props {
  isDark: boolean;
  presets?: PromptPreset[];
  /** When provided, renders these customizable actions instead of `presets`. */
  quickActions?: QuickAction[];
  tapToSend?: boolean;
  onSelect: (text: string, sendImmediately: boolean) => void;
  onQuickAction?: (action: QuickAction) => void;
}

function fallbackText(action: QuickAction): string {
  if (action.kind === "text") return action.text;
  const args = action.args?.trim() ? ` ${action.args.trim()}` : "";
  return `/${action.trigger}${args}`;
}

export function PromptPresetBar({
  isDark,
  presets = DEFAULT_PROMPT_PRESETS,
  quickActions,
  tapToSend = false,
  onSelect,
  onQuickAction,
}: Props) {
  const density = useDensity();
  const items: { id: string; label: string }[] = quickActions
    ? quickActions.map((a) => ({ id: a.id, label: a.label }))
    : presets.map((p) => ({ id: p.id, label: p.label }));
  if (items.length === 0) return null;

  const handlePress = (id: string) => {
    if (quickActions) {
      const action = quickActions.find((a) => a.id === id);
      if (action) {
        if (onQuickAction) {
          onQuickAction(action);
          return;
        }
        onSelect(fallbackText(action), tapToSend);
        return;
      }
    }
    const preset = presets.find((p) => p.id === id);
    if (preset) onSelect(preset.text, tapToSend);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={s.bar}
      contentContainerStyle={[
        s.row,
        {
          ...ds({ gap: 6, paddingHorizontal: 12, paddingVertical: 4 }, density),
        },
      ]}
      testID="prompt-preset-bar"
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[s.chip, isDark && s.chipDark]}
          onPress={() => handlePress(item.id)}
        >
          <Text
            style={[
              s.label,
              isDark && s.labelDark,
              { ...ds({ fontSize: 12 }, density) },
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Horizontal ScrollView defaults to flexGrow:1 and steals vertical space
  // in the session composer column — pin height to content only.
  bar: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: "row", alignItems: "center" },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipDark: {
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
  },
  label: { color: "#1a1a1a", fontWeight: "600" },
  labelDark: { color: "#e5e5e5" },
});
