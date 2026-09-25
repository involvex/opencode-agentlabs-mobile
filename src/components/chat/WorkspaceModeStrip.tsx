import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDensity, ds } from "../../lib/density";

export type WorkspaceMode = "chat" | "files" | "terminal" | "diff";

interface Props {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  isDark: boolean;
}

const MODES: {
  id: WorkspaceMode;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  fallback: string;
}[] = [
  {
    id: "chat",
    icon: "chatbubble-outline",
    labelKey: "session.workspace.chat",
    fallback: "Chat",
  },
  {
    id: "files",
    icon: "folder-outline",
    labelKey: "session.workspace.files",
    fallback: "Files",
  },
  {
    id: "terminal",
    icon: "terminal-outline",
    labelKey: "session.workspace.terminal",
    fallback: "Terminal",
  },
  {
    id: "diff",
    icon: "git-compare-outline",
    labelKey: "session.workspace.diff",
    fallback: "Diff",
  },
];

export function WorkspaceModeStrip({ mode, onChange, isDark }: Props) {
  const { t } = useTranslation();
  const density = useDensity();

  return (
    <View
      style={[
        s.strip,
        isDark && s.stripDark,
        { ...ds({ paddingVertical: 4 }, density) },
      ]}
      testID="workspace-mode-strip"
    >
      {MODES.map((item) => {
        const active = mode === item.id;
        const color = active
          ? item.id === "terminal"
            ? "#22c55e"
            : "#8b5cf6"
          : isDark
            ? "#888888"
            : "#666666";
        return (
          <TouchableOpacity
            key={item.id}
            style={[s.tab, active && (isDark ? s.tabActiveDark : s.tabActive)]}
            onPress={() => onChange(item.id)}
            testID={`workspace-mode-${item.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={item.icon} size={16} color={color} />
            <Text
              style={[
                s.label,
                { color, ...ds({ fontSize: 11 }, density) },
                active && s.labelActive,
              ]}
            >
              {t(item.labelKey, item.fallback)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#ffffff",
  },
  stripDark: {
    borderTopColor: "#1a1a1a",
    backgroundColor: "#0a0a0a",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
    minHeight: 40,
  },
  tabActive: {
    backgroundColor: "rgba(139, 92, 246, 0.08)",
  },
  tabActiveDark: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  label: {
    fontWeight: "500",
  },
  labelActive: {
    fontWeight: "700",
  },
});
