import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDensity, ds } from "../../lib/density";
import { nameOf } from "../../lib/path-utils";

interface Props {
  paths: string[];
  isDark: boolean;
  onRemove: (path: string) => void;
}

export function PathContextChips({ paths, isDark, onRemove }: Props) {
  const density = useDensity();
  if (paths.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.bar}
      contentContainerStyle={[
        s.row,
        {
          ...ds({ gap: 8, paddingHorizontal: 12, paddingVertical: 6 }, density),
        },
      ]}
      testID="path-context-chips"
    >
      {paths.map((path) => (
        <View key={path} style={[s.chip, isDark && s.chipDark]}>
          <Ionicons
            name="document-attach-outline"
            size={12}
            color={isDark ? "#a78bfa" : "#8b5cf6"}
          />
          <Text
            style={[
              s.label,
              isDark && s.labelDark,
              { ...ds({ fontSize: 12 }, density) },
            ]}
            numberOfLines={1}
          >
            {nameOf(path) || path}
          </Text>
          <TouchableOpacity onPress={() => onRemove(path)} hitSlop={8}>
            <Ionicons name="close" size={14} color={isDark ? "#888" : "#666"} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bar: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: "row", alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    backgroundColor: "#f8f8f8",
  },
  chipDark: {
    borderColor: "#2a2a2a",
    backgroundColor: "#141414",
  },
  label: { color: "#1a1a1a", flexShrink: 1 },
  labelDark: { color: "#e5e5e5" },
});
