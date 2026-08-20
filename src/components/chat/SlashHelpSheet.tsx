import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type {
  SlashCommand,
  SlashCommandCategory,
} from "../../lib/slash-commands";
import { COMMAND_CATEGORIES, DEFAULT_BUILTINS } from "../../lib/slash-commands";

interface Props {
  isDark: boolean;
  sheetRef: React.RefObject<BottomSheet | null>;
  customCommands: SlashCommand[];
}

export function SlashHelpSheet({ isDark, sheetRef, customCommands }: Props) {
  const { t } = useTranslation();
  const snapPoints = useMemo(() => ["60%", "85%"], []);

  const grouped = useMemo(() => {
    const groups = new Map<SlashCommandCategory, SlashCommand[]>();
    const builtins = Object.values(DEFAULT_BUILTINS);
    for (const cmd of builtins) {
      const cat = (cmd.category ?? "navigation") as SlashCommandCategory;
      const arr = groups.get(cat) ?? [];
      arr.push(cmd);
      groups.set(cat, arr);
    }
    if (customCommands.length > 0) {
      groups.set("navigation", [
        ...(groups.get("navigation") ?? []),
        ...customCommands,
      ]);
    }
    return groups;
  }, [customCommands]);

  const entries = useMemo(
    () =>
      Array.from(grouped.entries()) as [SlashCommandCategory, SlashCommand[]][],
    [grouped],
  );

  return (
    <BottomSheet
      ref={(innerRef) => {
        sheetRef.current = innerRef;
      }}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={isDark ? s.sheetDark : s.sheet}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "#666666" : "#cccccc",
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetView style={[s.container, isDark && s.containerDark]}>
        <Text style={[s.title, isDark && s.titleDark]}>
          {t("chat.slashHelp.title", "Slash Commands")}
        </Text>
        <Text style={[s.subtitle, isDark && s.subtitleDark]}>
          {t(
            "chat.slashHelp.subtitle",
            "Type / in the composer to see available commands.",
          )}
        </Text>
        {entries.map(([cat, cmds]) => (
          <View key={cat} style={s.group}>
            <Text style={[s.groupHeader, isDark && s.groupHeaderDark]}>
              {COMMAND_CATEGORIES[cat] ?? cat}
            </Text>
            {cmds.map((cmd) => (
              <View key={cmd.trigger} style={[s.item, isDark && s.itemDark]}>
                <Ionicons
                  name={(cmd.icon ?? "code-slash-outline") as any}
                  size={18}
                  color={isDark ? "#888888" : "#666666"}
                />
                <View style={s.textCol}>
                  <Text style={[s.trigger, isDark && s.textWhite]}>
                    /{cmd.trigger}
                  </Text>
                  {cmd.description && (
                    <Text
                      style={[s.desc, isDark && s.metaDark]}
                      numberOfLines={1}
                    >
                      {cmd.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
      </BottomSheetView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "#ffffff",
  },
  containerDark: { backgroundColor: "#1a1a1a" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0a0a0a",
    marginBottom: 4,
  },
  titleDark: { color: "#ffffff" },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 16,
  },
  subtitleDark: { color: "#888888" },
  group: { marginBottom: 12 },
  groupHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  groupHeaderDark: { color: "#666666" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  itemDark: {},
  textCol: { flex: 1 },
  trigger: { fontSize: 14, fontWeight: "600", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  desc: { fontSize: 12, color: "#999999", marginTop: 1 },
  metaDark: { color: "#666666" },
  sheet: { backgroundColor: "#ffffff" },
  sheetDark: { backgroundColor: "#1a1a1a" },
});
