import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDensity } from "../../lib/density";
import type { Part } from "../../lib/sdk";

function duration(start?: number, end?: number): string | null {
  if (!start || !end) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RetryBanner({ part, isDark }: { part: Part; isDark: boolean }) {
  const { t } = useTranslation();
  const density = useDensity();
  const [expanded, setExpanded] = useState(false);

  const reason =
    typeof part.state?.input === "string"
      ? part.state.input
      : typeof part.text === "string"
        ? part.text
        : undefined;

  const attempt =
    typeof part.state?.input === "object" &&
    part.state.input !== null &&
    "attempt" in part.state.input
      ? String((part.state.input as Record<string, unknown>).attempt)
      : undefined;

  const elapsed = duration(part.state?.time?.start, part.state?.time?.end);
  const error = part.state?.error?.message;
  const hasDetail = !!reason || !!attempt || !!elapsed || !!error;

  const toggle = useCallback(() => {
    if (hasDetail) setExpanded((v) => !v);
  }, [hasDetail]);

  return (
    <TouchableOpacity
      style={[
        s.banner,
        isDark && s.bannerDark,
        { padding: 8 * density.padding, marginTop: 8 * density.padding },
      ]}
      onPress={toggle}
      activeOpacity={hasDetail ? 0.7 : 1}
    >
      <View style={[s.header, { gap: 6 * density.gap }]}>
        <Ionicons name="refresh-outline" size={14} color="#8b5cf6" />
        <Text
          style={[
            s.label,
            isDark && s.labelDark,
            { fontSize: 11 * density.font },
          ]}
        >
          {t("chat.retryBanner.label", "Retry")}
        </Text>
        {typeof attempt === "string" && (
          <Text
            style={[
              s.attempt,
              isDark && s.attemptDark,
              { fontSize: 11 * density.font },
            ]}
          >
            {t("chat.retryBanner.attempt", "Attempt {{n}}", { n: attempt })}
          </Text>
        )}
        {elapsed && (
          <Text
            style={[
              s.elapsed,
              isDark && s.elapsedDark,
              { fontSize: 10 * density.font },
            ]}
          >
            {elapsed}
          </Text>
        )}
        {hasDetail && (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={isDark ? "#666666" : "#999999"}
          />
        )}
      </View>

      {expanded && hasDetail && (
        <View
          style={[
            s.expandedContent,
            { marginTop: 6 * density.padding, gap: 6 * density.gap },
          ]}
        >
          {reason && (
            <Text
              style={[
                s.reason,
                isDark && s.reasonDark,
                { fontSize: 12 * density.font, lineHeight: 18 * density.font },
              ]}
              selectable
            >
              {reason}
            </Text>
          )}
          {error && (
            <View
              style={[
                s.errorBanner,
                isDark && s.errorBannerDark,
                { gap: 6 * density.gap, padding: 6 * density.padding },
              ]}
            >
              <Ionicons name="alert-circle" size={12} color="#ef4444" />
              <Text
                style={[
                  s.errorText,
                  isDark && s.errorTextDark,
                  { fontSize: 11 * density.font },
                ]}
                selectable
              >
                {error}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: "#f5f0ff",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e4d6ff",
  },
  bannerDark: {
    backgroundColor: "#1a1a2e",
    borderColor: "#3a3a66",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8b5cf6",
    textTransform: "uppercase",
    flex: 1,
  },
  labelDark: { color: "#a78bfa" },
  attempt: {
    fontSize: 11,
    color: "#999999",
  },
  attemptDark: { color: "#666666" },
  elapsed: {
    fontSize: 10,
    color: "#999999",
  },
  elapsedDark: { color: "#666666" },
  expandedContent: { marginTop: 6, gap: 6 },
  reason: {
    fontSize: 12,
    color: "#4b5563",
    lineHeight: 18,
  },
  reasonDark: { color: "#9ca3af" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    padding: 6,
  },
  errorBannerDark: { backgroundColor: "#1a0a0a" },
  errorText: { fontSize: 11, color: "#dc2626", flex: 1, lineHeight: 16 },
  errorTextDark: { color: "#ff6b6b" },
});
