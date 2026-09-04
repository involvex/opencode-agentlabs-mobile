import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDensity } from "../../lib/density";

interface Props {
  text: string;
  isDark: boolean;
}

export function ReasoningBlock({ text, isDark }: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[
        s.block,
        isDark && s.blockDark,
        { padding: 10 * density.padding, marginBottom: 8 * density.padding },
      ]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={[s.header, { gap: 6 * density.gap }]}>
        <Ionicons name="bulb-outline" size={14} color="#f59e0b" />
        <Text
          style={[
            s.label,
            isDark && s.labelDark,
            { fontSize: 12 * density.font },
          ]}
        >
          {t("chat.reasoningBlock.label")}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={isDark ? "#666666" : "#999999"}
        />
      </View>
      {expanded && (
        <Text
          style={[
            s.text,
            isDark && s.textDark,
            {
              fontSize: 13 * density.font,
              lineHeight: 20 * density.font,
              marginTop: 8 * density.padding,
            },
          ]}
          selectable
        >
          {text}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  block: {
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  blockDark: { backgroundColor: "#1a1a0a", borderColor: "#333300" },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 12, fontWeight: "600", color: "#92400e", flex: 1 },
  labelDark: { color: "#f59e0b" },
  text: { fontSize: 13, lineHeight: 20, color: "#78350f", marginTop: 8 },
  textDark: { color: "#d4a574" },
});
