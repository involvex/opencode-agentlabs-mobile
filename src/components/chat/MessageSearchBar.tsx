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
import type { Message, Part } from "../../lib/sdk";
import { useDensity, ds } from "../../lib/density";

interface Props {
  visible: boolean;
  onClose: () => void;
  messages: Message[];
  parts: Record<string, Part[]>;
  isDark: boolean;
  onSelectMessage: (messageId: string) => void;
}

interface SearchHit {
  messageId: string;
  role: string;
  snippet: string;
}

function textFromParts(parts: Part[] | undefined): string {
  if (!parts) return "";
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text || "")
    .join("\n");
}

export function MessageSearchBar({
  visible,
  onClose,
  messages,
  parts,
  isDark,
  onSelectMessage,
}: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchHit[];
    const out: SearchHit[] = [];
    for (const message of messages) {
      const text = textFromParts(parts[message.id]);
      if (!text.toLowerCase().includes(q)) continue;
      const at = text.toLowerCase().indexOf(q);
      const start = Math.max(0, at - 24);
      const end = Math.min(text.length, at + q.length + 40);
      out.push({
        messageId: message.id,
        role: message.role,
        snippet: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
      });
    }
    return out;
  }, [messages, parts, query]);

  const go = (delta: number) => {
    if (hits.length === 0) return;
    const next = (index + delta + hits.length) % hits.length;
    setIndex(next);
    onSelectMessage(hits[next].messageId);
  };

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
      <View style={[s.sheet, isDark && s.sheetDark]} testID="message-search">
        <View style={[s.searchRow, isDark && s.searchRowDark]}>
          <Ionicons
            name="search-outline"
            size={18}
            color={isDark ? "#888" : "#666"}
          />
          <TextInput
            autoFocus
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setIndex(0);
            }}
            placeholder={t("session.search.placeholder", "Search in session")}
            placeholderTextColor={isDark ? "#666" : "#999"}
            style={[
              s.input,
              isDark && s.inputDark,
              { ...ds({ fontSize: 15 }, density) },
            ]}
            testID="message-search-input"
          />
          <TouchableOpacity
            onPress={() => go(-1)}
            hitSlop={8}
            disabled={!hits.length}
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={hits.length ? (isDark ? "#e5e5e5" : "#1a1a1a") : "#555"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => go(1)}
            hitSlop={8}
            disabled={!hits.length}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={hits.length ? (isDark ? "#e5e5e5" : "#1a1a1a") : "#555"}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color={isDark ? "#888" : "#666"} />
          </TouchableOpacity>
        </View>
        <Text style={[s.count, isDark && s.countDark]}>
          {hits.length
            ? t("session.search.count", {
                current: Math.min(index + 1, hits.length),
                total: hits.length,
                defaultValue: `${Math.min(index + 1, hits.length)} / ${hits.length}`,
              })
            : t("session.search.none", "No matches")}
        </Text>
        <FlatList
          data={hits}
          keyExtractor={(item) => item.messageId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index: i }) => (
            <TouchableOpacity
              style={[
                s.row,
                isDark && s.rowDark,
                i === index && (isDark ? s.rowActiveDark : s.rowActive),
              ]}
              onPress={() => {
                setIndex(i);
                onSelectMessage(item.messageId);
                onClose();
              }}
            >
              <Text style={[s.role, isDark && s.roleDark]}>{item.role}</Text>
              <Text
                style={[
                  s.snippet,
                  isDark && s.snippetDark,
                  { ...ds({ fontSize: 13 }, density) },
                ]}
                numberOfLines={2}
              >
                {item.snippet}
              </Text>
            </TouchableOpacity>
          )}
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
  count: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 11,
    color: "#888888",
  },
  countDark: { color: "#666666" },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    gap: 4,
  },
  rowDark: { borderBottomColor: "#1a1a1a" },
  rowActive: { backgroundColor: "rgba(139, 92, 246, 0.08)" },
  rowActiveDark: { backgroundColor: "rgba(139, 92, 246, 0.18)" },
  role: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8b5cf6",
    textTransform: "uppercase",
  },
  roleDark: { color: "#a78bfa" },
  snippet: { color: "#1a1a1a" },
  snippetDark: { color: "#e5e5e5" },
});
