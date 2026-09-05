import { useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type {
  SlashCommand,
  SlashCommandCategory,
} from "../../lib/slash-commands";
import { COMMAND_CATEGORIES, filterCommands } from "../../lib/slash-commands";
import { useSlashCommands } from "../../stores/slash-commands";
import { useDensity, ds } from "../../lib/density";

interface Props {
  query: string;
  commands: SlashCommand[];
  isDark: boolean;
  onSelect: (cmd: SlashCommand) => void;
  onDismiss: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAX_WIDTH = Math.min(SCREEN_WIDTH - 32, 420);

export function SlashPopover({
  query,
  commands,
  isDark,
  onSelect,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const { recent, favorites, addRecent, toggleFavorite } = useSlashCommands();
  const density = useDensity();
  const scrollViewRef = useRef<ScrollView>(null);

  const filtered = useMemo(() => {
    const raw = filterCommands(query, commands);
    const seen = new Set<string>();
    return raw.filter((c) => {
      const t = c.trigger.toLowerCase();
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  }, [query, commands]);

  const grouped = useMemo(() => {
    const groups = new Map<
      SlashCommandCategory | "favorites" | "recent",
      SlashCommand[]
    >();
    const favSet = new Set(favorites.map((f) => f.toLowerCase()));
    const recentSet = new Set(recent);
    const favs = filtered.filter((c) => favSet.has(c.trigger.toLowerCase()));
    const recents = filtered.filter(
      (c) =>
        !favSet.has(c.trigger.toLowerCase()) &&
        recentSet.has(c.trigger.toLowerCase()),
    );
    const rest = filtered.filter(
      (c) =>
        !favSet.has(c.trigger.toLowerCase()) &&
        !recentSet.has(c.trigger.toLowerCase()),
    );
    if (favs.length > 0) groups.set("favorites", favs);
    if (recents.length > 0) groups.set("recent", recents);
    const byCategory = new Map<SlashCommandCategory, SlashCommand[]>();
    for (const cmd of rest) {
      const cat = cmd.category ?? "navigation";
      const arr = byCategory.get(cat) ?? [];
      arr.push(cmd);
      byCategory.set(cat, arr);
    }
    for (const [cat, cmds] of byCategory) {
      groups.set(cat, cmds);
    }
    return groups;
  }, [filtered, favorites, recent]);

  const handleSelect = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.type === "builtin") {
        addRecent(cmd.trigger);
      }
      onSelect(cmd);
    },
    [onSelect, addRecent],
  );

  const handleToggleFav = useCallback(
    (cmd: SlashCommand) => {
      toggleFavorite(cmd.trigger);
    },
    [toggleFavorite],
  );

  if (filtered.length === 0) {
    return (
      <View
        style={[
          s.popover,
          isDark && s.popoverDark,
          {
            maxWidth: MAX_WIDTH,
            ...ds(
              {
                marginHorizontal: 16,
                marginBottom: 8,
              },
              density,
            ),
          },
        ]}
      >
        <Text
          style={[
            s.empty,
            isDark && s.emptyDark,
            {
              ...ds(
                {
                  fontSize: 14,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                },
                density,
              ),
            },
          ]}
        >
          {t("chat.slashPopover.noMatches")}
        </Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text
            style={[
              s.helpLink,
              isDark && s.helpLinkDark,
              {
                ...ds(
                  {
                    fontSize: 13,
                    paddingBottom: 12,
                  },
                  density,
                ),
              },
            ]}
          >
            {t("chat.slashPopover.helpLink")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        s.popover,
        isDark && s.popoverDark,
        {
          maxWidth: MAX_WIDTH,
          marginHorizontal: 16 * density.padding,
          marginBottom: 8 * density.padding,
        },
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="always"
        style={[s.scroll, { ...ds({ paddingVertical: 8 }, density) }]}
        nestedScrollEnabled
      >
        {Array.from(grouped.entries()).map(([groupKey, cmds]) => (
          <View key={groupKey} style={s.group}>
            <Text
              style={[
                s.groupHeader,
                isDark && s.groupHeaderDark,
                {
                  ...ds(
                    {
                      fontSize: 11,
                      paddingHorizontal: 16,
                      paddingTop: 8,
                      paddingBottom: 4,
                    },
                    density,
                  ),
                },
              ]}
            >
              {groupKey === "favorites"
                ? t("chat.slashPopover.favorites")
                : groupKey === "recent"
                  ? t("chat.slashPopover.recent")
                  : (COMMAND_CATEGORIES[groupKey as SlashCommandCategory] ??
                    groupKey)}
            </Text>
            {cmds.map((cmd) => {
              const isFav = useSlashCommands.getState().isFavorite(cmd.trigger);
              return (
                <View
                  key={cmd.trigger}
                  style={[
                    s.item,
                    isDark && s.itemDark,
                    {
                      ...ds(
                        {
                          gap: 10,
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                        },
                        density,
                      ),
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={s.rowTouch}
                    onPress={() => handleSelect(cmd)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cmd.icon ?? "code-slash-outline"}
                      size={18}
                      color={
                        cmd.type === "custom"
                          ? "#8b5cf6"
                          : isDark
                            ? "#888888"
                            : "#666666"
                      }
                    />
                    <View style={s.textCol}>
                      <Text
                        style={[
                          s.trigger,
                          isDark && s.textWhite,
                          { ...ds({ fontSize: 14 }, density) },
                        ]}
                        numberOfLines={1}
                      >
                        /{cmd.trigger}
                      </Text>
                      {cmd.description && (
                        <Text
                          style={[
                            s.desc,
                            isDark && s.metaDark,
                            { ...ds({ fontSize: 12 }, density) },
                          ]}
                          numberOfLines={1}
                        >
                          {cmd.description}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.favButton}
                    onPress={() => handleToggleFav(cmd)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isFav ? "star" : "star-outline"}
                      size={16}
                      color={isFav ? "#f59e0b" : isDark ? "#666666" : "#cccccc"}
                    />
                  </TouchableOpacity>
                  {cmd.type === "custom" && (
                    <View
                      style={[
                        s.badge,
                        isDark && s.badgeDark,
                        {
                          ...ds(
                            {
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            },
                            density,
                          ),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.badgeText,
                          { ...ds({ fontSize: 10 }, density) },
                        ]}
                      >
                        {t("chat.slashPopover.customBadge")}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  popover: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    maxHeight: 280,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  popoverDark: { backgroundColor: "#1a1a1a", borderTopColor: "#2a2a2a" },
  scroll: { paddingVertical: 8 },
  group: { marginBottom: 4 },
  groupHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  groupHeaderDark: { color: "#666666" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  itemDark: {},
  rowTouch: { flex: 1, flexDirection: "row", alignItems: "center" },
  textCol: { flex: 1 },
  trigger: { fontSize: 14, fontWeight: "600", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  desc: { fontSize: 12, color: "#999999", marginTop: 1 },
  metaDark: { color: "#666666" },
  favButton: { padding: 4, marginRight: 4 },
  badge: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDark: { backgroundColor: "#2a1a3e" },
  badgeText: { fontSize: 10, color: "#8b5cf6", fontWeight: "600" },
  empty: {
    fontSize: 14,
    color: "#999999",
    textAlign: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  emptyDark: { color: "#666666" },
  helpLink: {
    fontSize: 13,
    color: "#8b5cf6",
    textAlign: "center",
    paddingBottom: 12,
    fontWeight: "600",
  },
  helpLinkDark: { color: "#a78bfa" },
});
