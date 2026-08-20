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
  const scrollViewRef = useRef<ScrollView>(null);
  const itemRefs = useRef<Map<string, View>>(new Map());

  const filtered = useMemo(() => {
    if (!query || query.trim() === "") {
      const favSet = new Set(favorites.map((f) => f.toLowerCase()));
      const recentSet = new Set(recent);
      const favs = commands.filter((c) => favSet.has(c.trigger.toLowerCase()));
      const recents = commands.filter(
        (c) =>
          !favSet.has(c.trigger.toLowerCase()) &&
          recentSet.has(c.trigger.toLowerCase()),
      );
      const rest = commands.filter(
        (c) =>
          !favSet.has(c.trigger.toLowerCase()) &&
          !recentSet.has(c.trigger.toLowerCase()),
      );
      return [...favs, ...recents, ...rest];
    }
    return filterCommands(query, commands);
  }, [query, commands, favorites, recent]);

  const grouped = useMemo(() => {
    const groups = new Map<
      SlashCommandCategory | "favorites" | "recent",
      SlashCommand[]
    >();
    if (!query || query.trim() === "") {
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
    }
    const byCategory = new Map<SlashCommandCategory, SlashCommand[]>();
    for (const cmd of filtered) {
      const cat = cmd.category ?? "navigation";
      const arr = byCategory.get(cat) ?? [];
      arr.push(cmd);
      byCategory.set(cat, arr);
    }
    for (const [cat, cmds] of byCategory) {
      groups.set(cat, cmds);
    }
    return groups;
  }, [filtered, query, favorites, recent]);

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
        style={[s.popover, isDark && s.popoverDark, { maxWidth: MAX_WIDTH }]}
      >
        <Text style={[s.empty, isDark && s.emptyDark]}>
          {t("chat.slashPopover.noMatches")}
        </Text>
        <TouchableOpacity onPress={onDismiss}>
          <Text style={[s.helpLink, isDark && s.helpLinkDark]}>
            {t("chat.slashPopover.helpLink")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.popover, isDark && s.popoverDark, { maxWidth: MAX_WIDTH }]}>
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="always"
        style={s.scroll}
        nestedScrollEnabled
      >
        {Array.from(grouped.entries()).map(([groupKey, cmds]) => (
          <View key={groupKey} style={s.group}>
            <Text style={[s.groupHeader, isDark && s.groupHeaderDark]}>
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
                <TouchableOpacity
                  key={cmd.trigger}
                  ref={(ref) => {
                    if (ref) itemRefs.current.set(cmd.trigger, ref);
                  }}
                  style={[s.item, isDark && s.itemDark]}
                  onPress={() => handleSelect(cmd)}
                >
                  <Ionicons
                    name={(cmd.icon ?? "code-slash-outline") as any}
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
                    <View style={[s.badge, isDark && s.badgeDark]}>
                      <Text style={s.badgeText}>
                        {t("chat.slashPopover.customBadge")}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
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
