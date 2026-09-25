import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDensity, ds } from "../../lib/density";

interface Props {
  count: number;
  isDark: boolean;
  onFlush: () => void;
  onClear: () => void;
}

export function OfflineQueueBanner({ count, isDark, onFlush, onClear }: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  if (count <= 0) return null;

  return (
    <View
      style={[s.banner, isDark && s.bannerDark]}
      testID="offline-queue-banner"
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#ffffff" />
      <Text style={[s.text, { ...ds({ fontSize: 12 }, density) }]}>
        {t("session.offlineQueue.pending", {
          count,
          defaultValue: `${count} queued prompt${count === 1 ? "" : "s"}`,
        })}
      </Text>
      <TouchableOpacity onPress={onFlush} hitSlop={8}>
        <Text style={s.action}>{t("session.offlineQueue.send", "Send")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClear} hitSlop={8}>
        <Text style={s.actionMuted}>
          {t("session.offlineQueue.clear", "Clear")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f59e0b",
  },
  bannerDark: {
    backgroundColor: "#b45309",
  },
  text: {
    flex: 1,
    color: "#ffffff",
    fontWeight: "600",
  },
  action: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  actionMuted: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
});
