import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { WIDE_CONTENT_SCROLL_CONFIG } from "../../lib/scroll-config";
import { useDensity } from "../../lib/density";
import type { Part } from "../../lib/sdk";

const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

export function CompactionBanner({
  part,
  isDark,
}: {
  part: Part;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const density = useDensity();
  const [expanded, setExpanded] = useState(false);

  const summary =
    part.text || t("chat.compactionBanner.default", "Conversation compacted");
  const elapsed =
    part.time?.start && part.time?.end
      ? (() => {
          const ms = part.time!.end! - part.time!.start!;
          if (ms < 1000) return `${ms}ms`;
          return `${(ms / 1000).toFixed(1)}s`;
        })()
      : null;

  const toggle = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  return (
    <TouchableOpacity
      style={[
        s.banner,
        isDark && s.bannerDark,
        { padding: 10 * density.padding, marginBottom: 8 * density.padding },
      ]}
      onPress={toggle}
      activeOpacity={0.7}
    >
      <View
        style={[
          s.header,
          { gap: 6 * density.gap, marginBottom: 4 * density.padding },
        ]}
      >
        <Ionicons name="archive-outline" size={14} color="#6366f1" />
        <Text
          style={[
            s.label,
            isDark && s.labelDark,
            { fontSize: 11 * density.font },
          ]}
        >
          {t("chat.compactionBanner.label", "Compacted")}
        </Text>
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
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={isDark ? "#666666" : "#999999"}
        />
      </View>
      <Text
        style={[
          s.summary,
          isDark && s.summaryDark,
          { fontSize: 12 * density.font, lineHeight: 18 * density.font },
        ]}
        numberOfLines={2}
        selectable
      >
        {summary}
      </Text>
      {expanded && (
        <ScrollView
          {...WIDE_CONTENT_SCROLL_CONFIG}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={s.expandedScroll}
        >
          <View style={[s.expandedContent, { gap: 8 * density.gap }]}>
            {typeof part.state?.input === "string" &&
              part.state.input.length > 0 && (
                <View style={s.detailGroup}>
                  <Text
                    style={[
                      s.detailLabel,
                      isDark && s.detailLabelDark,
                      { fontSize: 10 * density.font },
                    ]}
                  >
                    {t("chat.compactionBanner.inputLabel", "Prompt sent")}
                  </Text>
                  <View
                    style={[
                      s.codeBlock,
                      isDark && s.codeBlockDark,
                      { padding: 8 * density.padding },
                    ]}
                  >
                    <Text
                      style={[
                        s.codePre,
                        isDark && s.codePreDark,
                        { fontSize: 12 * density.font },
                      ]}
                      selectable
                      numberOfLines={20}
                    >
                      {part.state.input}
                    </Text>
                  </View>
                </View>
              )}
            {typeof part.state?.output === "string" &&
              part.state.output.length > 0 && (
                <View style={s.detailGroup}>
                  <Text
                    style={[
                      s.detailLabel,
                      isDark && s.detailLabelDark,
                      { fontSize: 10 * density.font },
                    ]}
                  >
                    {t("chat.compactionBanner.outputLabel", "Response")}
                  </Text>
                  <View
                    style={[
                      s.codeBlock,
                      isDark && s.codeBlockDark,
                      { padding: 8 * density.padding },
                    ]}
                  >
                    <Text
                      style={[
                        s.codePre,
                        isDark && s.codePreDark,
                        { fontSize: 12 * density.font },
                      ]}
                      selectable
                      numberOfLines={30}
                    >
                      {part.state.output}
                    </Text>
                  </View>
                </View>
              )}
            {typeof part.state?.error?.message === "string" &&
              part.state.error.message.length > 0 && (
                <View
                  style={[
                    s.errorBanner,
                    isDark && s.errorBannerDark,
                    { gap: 6 * density.gap, padding: 8 * density.padding },
                  ]}
                >
                  <Ionicons name="alert-circle" size={14} color="#ef4444" />
                  <Text
                    style={[
                      s.errorText,
                      isDark && s.errorTextDark,
                      { fontSize: 12 * density.font },
                    ]}
                    selectable
                  >
                    {part.state.error.message}
                  </Text>
                </View>
              )}
            {!part.state?.input &&
              !part.state?.output &&
              !part.state?.error?.message && (
                <Text
                  style={[
                    s.emptyHint,
                    isDark && s.emptyHintDark,
                    { fontSize: 11 * density.font },
                  ]}
                >
                  {t(
                    "chat.compactionBanner.noDetails",
                    "No additional details",
                  )}
                </Text>
              )}
          </View>
        </ScrollView>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: "#f8f4ff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
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
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6366f1",
    flex: 1,
    textTransform: "uppercase",
  },
  labelDark: { color: "#a78bfa" },
  elapsed: {
    fontSize: 10,
    color: "#999999",
  },
  elapsedDark: { color: "#666666" },
  summary: {
    fontSize: 12,
    color: "#4b5563",
    lineHeight: 18,
  },
  summaryDark: { color: "#9ca3af" },

  expandedScroll: {
    maxHeight: 250,
    marginTop: 6,
  },
  expandedContent: { gap: 8 },
  detailGroup: { gap: 4 },
  detailLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  detailLabelDark: { color: "#888888" },
  codeBlock: {
    backgroundColor: "#f8f8f8",
    borderRadius: 6,
    padding: 8,
  },
  codeBlockDark: { backgroundColor: "#1a1a1a" },
  codePre: {
    fontSize: 12,
    fontFamily: mono,
    color: "#0a0a0a",
    lineHeight: 18,
  },
  codePreDark: { color: "#e5e5e5" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    padding: 8,
  },
  errorBannerDark: { backgroundColor: "#1a0a0a" },
  errorText: { fontSize: 12, color: "#dc2626", flex: 1, lineHeight: 18 },
  errorTextDark: { color: "#ff6b6b" },

  emptyHint: { fontSize: 11, color: "#999999", fontStyle: "italic" },
  emptyHintDark: { color: "#666666" },
});
