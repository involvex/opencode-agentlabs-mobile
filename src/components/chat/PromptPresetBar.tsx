import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useDensity, ds } from "../../lib/density";

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
  tapToSend?: boolean;
  onSelect: (text: string, sendImmediately: boolean) => void;
}

export function PromptPresetBar({
  isDark,
  presets = DEFAULT_PROMPT_PRESETS,
  tapToSend = false,
  onSelect,
}: Props) {
  const density = useDensity();
  if (presets.length === 0) return null;

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
      {presets.map((preset) => (
        <TouchableOpacity
          key={preset.id}
          style={[s.chip, isDark && s.chipDark]}
          onPress={() => onSelect(preset.text, tapToSend)}
        >
          <Text
            style={[
              s.label,
              isDark && s.labelDark,
              { ...ds({ fontSize: 12 }, density) },
            ]}
          >
            {preset.label}
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
