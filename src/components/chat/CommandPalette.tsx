import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDensity, ds } from "../../lib/density";
import type { Session } from "../../lib/sdk";

export type PaletteAction =
  | { type: "session"; session: Session }
  | { type: "app"; id: string; label: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  sessions: Session[];
  isDark: boolean;
  onSelect: (action: PaletteAction) => void;
}

function matches(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export function CommandPalette({
  visible,
  onClose,
  sessions,
  isDark,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const [query, setQuery] = useState("");

  const appActions: PaletteAction[] = useMemo(
    () => [
      {
        type: "app",
        id: "new-session",
        label: t("session.palette.newSession", "New session"),
      },
      {
        type: "app",
        id: "search-messages",
        label: t("session.palette.searchMessages", "Search messages"),
      },
      {
        type: "app",
        id: "mode-files",
        label: t("session.palette.files", "Open files"),
      },
      {
        type: "app",
        id: "mode-terminal",
        label: t("session.palette.terminal", "Open terminal"),
      },
      {
        type: "app",
        id: "mode-diff",
        label: t("session.palette.diff", "Open diff"),
      },
      {
        type: "app",
        id: "cycle-theme",
        label: t("session.palette.cycleTheme", "Cycle theme"),
      },
      {
        type: "app",
        id: "cycle-density",
        label: t("session.palette.cycleDensity", "Cycle density"),
      },
      {
        type: "app",
        id: "settings",
        label: t("session.palette.settings", "Settings"),
      },
    ],
    [t],
  );

  const items = useMemo(() => {
    const actions = appActions.filter((a) =>
      a.type === "app" ? matches(a.label, query) : false,
    );
    const sessionItems: PaletteAction[] = sessions
      .filter((s) => matches(s.title || s.id, query))
      .slice(0, 20)
      .map((session) => ({ type: "session" as const, session }));
    return [...actions, ...sessionItems];
  }, [appActions, sessions, query]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[s.sheet, isDark && s.sheetDark]} testID="command-palette">
        <View style={[s.searchRow, isDark && s.searchRowDark]}>
          <Ionicons
            name="search-outline"
            size={18}
            color={isDark ? "#888" : "#666"}
          />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t(
              "session.palette.placeholder",
              "Search actions & sessions",
            )}
            placeholderTextColor={isDark ? "#666" : "#999"}
            style={[
              s.input,
              isDark && s.inputDark,
              { ...ds({ fontSize: 15 }, density) },
            ]}
            testID="command-palette-input"
          />
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color={isDark ? "#888" : "#666"} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item, i) =>
            item.type === "session" ? item.session.id : `${item.id}-${i}`
          }
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[s.empty, isDark && s.emptyDark]}>
              {t("session.palette.empty", "No matches")}
            </Text>
          }
          renderItem={({ item }) => {
            const label =
              item.type === "session"
                ? item.session.title || item.session.id
                : item.label;
            const icon: keyof typeof Ionicons.glyphMap =
              item.type === "session" ? "chatbubble-outline" : "flash-outline";
            return (
              <TouchableOpacity
                style={[s.row, isDark && s.rowDark]}
                onPress={() => {
                  onSelect(item);
                  setQuery("");
                  onClose();
                }}
              >
                <Ionicons
                  name={icon}
                  size={16}
                  color={isDark ? "#a78bfa" : "#8b5cf6"}
                />
                <Text
                  style={[
                    s.label,
                    isDark && s.labelDark,
                    { ...ds({ fontSize: 14 }, density) },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {item.type === "session" ? (
                  <Text style={[s.meta, isDark && s.metaDark]}>session</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    marginTop: 80,
    marginHorizontal: 16,
    maxHeight: "70%",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
  },
  sheetDark: {
    backgroundColor: "#111111",
    borderColor: "#2a2a2a",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  searchRowDark: { borderBottomColor: "#2a2a2a" },
  input: { flex: 1, color: "#1a1a1a", paddingVertical: 4 },
  inputDark: { color: "#e5e5e5" },
  empty: { padding: 16, color: "#999999", fontSize: 13 },
  emptyDark: { color: "#666666" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowDark: { borderBottomColor: "#1a1a1a" },
  label: { flex: 1, color: "#1a1a1a" },
  labelDark: { color: "#e5e5e5" },
  meta: { fontSize: 11, color: "#999999" },
  metaDark: { color: "#666666" },
});
