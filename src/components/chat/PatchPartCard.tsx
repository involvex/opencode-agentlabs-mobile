import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { DiffView } from "./DiffView";
import { useDensity, ds } from "../../lib/density";
import type { Part } from "../../lib/sdk";

const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

function duration(start?: number, end?: number): string | null {
  if (!start || !end) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function PatchPartCard({
  part,
  isDark,
}: {
  part: Part;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const density = useDensity();
  const [expanded, setExpanded] = useState(false);

  const status = part.state?.status || "pending";
  const elapsed = duration(part.state?.time?.start, part.state?.time?.end);
  const error = part.state?.error?.message;

  // Patch content: prefer text, fall back to state.input/output
  const before = useMemo(() => {
    if (typeof part.text === "string" && part.text.length > 0) return part.text;
    if (typeof part.state?.input === "string") return part.state.input;
    if (typeof part.state?.input === "object" && part.state.input !== null)
      return JSON.stringify(part.state.input, null, 2);
    return "";
  }, [part.text, part.state]);

  const after = useMemo(() => {
    if (typeof part.state?.output === "string") return part.state.output;
    if (typeof part.state?.output === "object" && part.state.output !== null)
      return JSON.stringify(part.state.output, null, 2);
    return "";
  }, [part.state]);

  // Fallback: raw JSON of the whole part state if no diff input/output
  const rawState = useMemo(() => {
    if (
      typeof part.state?.input === "string" ||
      typeof part.state?.output === "string" ||
      part.state?.input === undefined ||
      part.state?.output === undefined
    )
      return null;
    return JSON.stringify(part.state || {}, null, 2);
  }, [part.state]);

  const hasDiff = before.length > 0 && after.length > 0;
  const hasDetail = hasDiff || !!rawState || !!error;
  const hasNoDetail = !hasDiff && !rawState && !error;

  const toggle = useCallback(() => {
    if (hasDetail) setExpanded((v) => !v);
  }, [hasDetail]);

  const title =
    part.state?.title || t("chat.patchPartCard.defaultTitle", "File Patch");

  return (
    <TouchableOpacity
      style={[
        s.card,
        isDark && s.cardDark,
        status === "error" && s.cardError,
        status === "error" && isDark && s.cardErrorDark,
        { ...ds({ padding: 10, marginTop: 8 }, density) },
      ]}
      onPress={toggle}
      activeOpacity={hasDetail ? 0.7 : 1}
    >
      <View style={s.header}>
        <View style={[s.headerLeft, { ...ds({ gap: 8 }, density) }]}>
          <Ionicons name="git-merge-outline" size={16} color="#8b5cf6" />
          <Text
            style={[
              s.name,
              isDark && s.nameDark,
              { ...ds({ fontSize: 13 }, density) },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {elapsed && (
            <Text
              style={[
                s.elapsed,
                isDark && s.elapsedDark,
                { ...ds({ fontSize: 11 }, density) },
              ]}
            >
              {elapsed}
            </Text>
          )}
        </View>
        <View style={[s.headerRight, { ...ds({ gap: 6 }, density) }]}>
          {status === "running" && (
            <ActivityIndicator size="small" color="#8b5cf6" />
          )}
          {status === "completed" && (
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          )}
          {status === "error" && (
            <Ionicons name="close-circle" size={16} color="#ef4444" />
          )}
          {hasDetail && (
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={isDark ? "#666666" : "#999999"}
            />
          )}
        </View>
      </View>

      {error && !expanded && (
        <View
          style={[
            s.errorBannerInline,
            isDark && s.errorBannerDark,
            {
              ...ds({ gap: 6, marginTop: 6, padding: 8 }, density),
            },
          ]}
        >
          <Ionicons name="alert-circle" size={12} color="#ef4444" />
          <Text
            style={[
              s.errorText,
              isDark && s.errorTextDark,
              { ...ds({ fontSize: 12 }, density) },
            ]}
            numberOfLines={2}
            selectable
          >
            {error}
          </Text>
        </View>
      )}

      {expanded && (
        <View
          style={[
            s.expandedContent,
            { ...ds({ marginTop: 8, gap: 8 }, density) },
          ]}
        >
          {hasNoDetail && (
            <Text
              style={[
                s.emptyHint,
                isDark && s.emptyHintDark,
                { ...ds({ fontSize: 11 }, density) },
              ]}
            >
              {t("chat.patchPartCard.noDetails", "No patch details available")}
            </Text>
          )}
          {hasDiff && (
            <DiffView before={before} after={after} isDark={isDark} />
          )}
          {rawState && (
            <View
              style={[
                s.codeBlock,
                isDark && s.codeBlockDark,
                { ...ds({ padding: 10 }, density) },
              ]}
            >
              <Text
                style={[
                  s.codePre,
                  isDark && s.codePteDark,
                  { ...ds({ fontSize: 12 }, density) },
                ]}
                selectable
                numberOfLines={30}
              >
                {rawState}
              </Text>
            </View>
          )}
          {error && (
            <View
              style={[
                s.errorBanner,
                isDark && s.errorBannerDark,
                {
                  ...ds({ gap: 6, marginTop: 6, padding: 8 }, density),
                },
              ]}
            >
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
              <Text
                style={[
                  s.errorText,
                  isDark && s.errorTextDark,
                  { ...ds({ fontSize: 12 }, density) },
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
  card: {
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  cardDark: { backgroundColor: "#2a2a2a", borderColor: "#3a3a3a" },
  cardError: { borderColor: "#fecaca" },
  cardErrorDark: { borderColor: "#7f1d1d" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 13, fontWeight: "500", color: "#0a0a0a", flex: 1 },
  nameDark: { color: "#e5e5e5" },
  elapsed: { fontSize: 11, color: "#999999" },
  elapsedDark: { color: "#666666" },

  expandedContent: { marginTop: 8, gap: 8 },
  codeBlock: {
    backgroundColor: "#f8f8f8",
    borderRadius: 6,
    padding: 10,
  },
  codeBlockDark: { backgroundColor: "#1a1a1a" },
  codePre: {
    fontSize: 12,
    fontFamily: mono,
    color: "#0a0a0a",
    lineHeight: 18,
  },
  codePteDark: { color: "#e5e5e5" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    padding: 8,
  },
  errorBannerDark: { backgroundColor: "#1a0a0a" },
  errorText: { fontSize: 12, color: "#dc2626", flex: 1, lineHeight: 18 },
  errorTextDark: { color: "#ff6b6b" },
  errorBannerInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },

  emptyHint: { fontSize: 11, color: "#999999", fontStyle: "italic" },
  emptyHintDark: { color: "#666666" },
});
