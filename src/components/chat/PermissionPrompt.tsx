import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDensity, ds } from "../../lib/density";

interface Props {
  permission: { id: string; permission: string; patterns: string[] };
  isDark: boolean;
  onReply: (reply: "once" | "always" | "reject") => void;
}

export function PermissionPrompt({ permission, isDark, onReply }: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  return (
    <View
      style={[
        s.card,
        isDark && s.cardDark,
        { ...ds({ margin: 12, padding: 16 }, density) },
      ]}
    >
      <View style={[s.header, { ...ds({ gap: 8, marginBottom: 8 }, density) }]}>
        <Ionicons name="shield-outline" size={18} color="#f59e0b" />
        <Text
          style={[
            s.title,
            isDark && s.textWhite,
            { ...ds({ fontSize: 15 }, density) },
          ]}
        >
          {t("chat.permissionPrompt.title")}
        </Text>
      </View>
      <Text
        style={[
          s.type,
          isDark && s.typeDark,
          { ...ds({ fontSize: 13, marginBottom: 12 }, density) },
        ]}
      >
        {permission.permission}: {permission.patterns.join(", ")}
      </Text>
      <View style={[s.actions, { ...ds({ gap: 8 }, density) }]}>
        <TouchableOpacity
          style={[s.btn, s.deny, { ...ds({ paddingVertical: 10 }, density) }]}
          onPress={() => onReply("reject")}
        >
          <Text style={[s.denyText, { ...ds({ fontSize: 14 }, density) }]}>
            {t("chat.permissionPrompt.deny")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.btn,
            s.always,
            isDark && s.alwaysDark,
            { ...ds({ paddingVertical: 10 }, density) },
          ]}
          onPress={() => onReply("always")}
        >
          <Text
            style={[
              s.alwaysText,
              isDark && s.textWhite,
              { ...ds({ fontSize: 14 }, density) },
            ]}
          >
            {t("chat.permissionPrompt.always")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.btn,
            s.allow,
            isDark && s.allowDark,
            { ...ds({ paddingVertical: 10 }, density) },
          ]}
          onPress={() => onReply("once")}
        >
          <Text
            style={[
              s.allowText,
              isDark && s.allowTextDark,
              { ...ds({ fontSize: 14 }, density) },
            ]}
          >
            {t("chat.permissionPrompt.allow")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    margin: 12,
    padding: 16,
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  cardDark: { backgroundColor: "#1a1800", borderColor: "#333300" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: "600", color: "#92400e" },
  textWhite: { color: "#ffffff" },
  type: { fontSize: 13, color: "#78350f", marginBottom: 12 },
  typeDark: { color: "#d4a574" },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  deny: { backgroundColor: "#fef2f2" },
  denyText: { color: "#dc2626", fontWeight: "600", fontSize: 14 },
  always: { backgroundColor: "#f5f5f5" },
  alwaysDark: { backgroundColor: "#2a2a2a" },
  alwaysText: { color: "#0a0a0a", fontWeight: "600", fontSize: 14 },
  allow: { backgroundColor: "#0a0a0a" },
  allowDark: { backgroundColor: "#ffffff" },
  allowText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },
  allowTextDark: { color: "#0a0a0a" },
});
