import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { WIDE_CONTENT_SCROLL_CONFIG } from "../../lib/scroll-config";
import { useDensity, ds } from "../../lib/density";
import type { Part } from "../../lib/sdk";

const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

function statusColor(status: string): string {
  if (status === "completed") return "#22c55e";
  if (status === "error") return "#ef4444";
  if (status === "running") return "#f59e0b";
  return "#888888";
}

function statusIcon(status: string): string {
  if (status === "completed") return "checkmark-circle";
  if (status === "error") return "close-circle";
  if (status === "running") return "ellipsis-horizontal";
  return "time";
}

function duration(start?: number, end?: number): string | null {
  if (!start || !end) return null;
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getAgentName(
  tool: Part,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (tool.state?.title) return tool.state.title;
  if (tool.tool) {
    // Capitalize agent name, e.g. "build" -> "Build", "task" -> "Task"
    return tool.tool.charAt(0).toUpperCase() + tool.tool.slice(1);
  }
  const type =
    tool.type === "subtask"
      ? t("chat.agentPartCard.subtask")
      : t("chat.agentPartCard.agent");
  return type;
}

function getAgentLabel(
  tool: Part,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (tool.type === "subtask") return t("chat.agentPartCard.subtask");
  return t("chat.agentPartCard.agent");
}

interface AgentDetailProps {
  input: unknown;
  output: unknown;
  error: string | undefined;
  isDark: boolean;
}

function AgentDetail({ input, output, error, isDark }: AgentDetailProps) {
  const { t } = useTranslation();
  const density = useDensity();
  const hasInput = input !== undefined && input !== null;
  const hasOutput = output !== undefined && output !== null;

  return (
    <View
      style={[s.detailSection, { ...ds({ gap: 8, marginTop: 8 }, density) }]}
    >
      {typeof error === "string" && error.length > 0 && (
        <View
          style={[
            s.errorBannerInline,
            isDark && s.errorBannerDark,
            { ...ds({ gap: 6, marginTop: 6, padding: 8 }, density) },
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
            numberOfLines={3}
          >
            {error}
          </Text>
        </View>
      )}
      {hasInput && (
        <View style={s.detailGroup}>
          <Text
            style={[
              s.detailLabel,
              isDark && s.detailLabelDark,
              { ...ds({ fontSize: 11 }, density) },
            ]}
          >
            {t("chat.agentPartCard.inputLabel", "Input")}
          </Text>
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
              numberOfLines={40}
            >
              {typeof input === "string"
                ? input
                : JSON.stringify(input, null, 2)}
            </Text>
          </View>
        </View>
      )}
      {hasOutput && (
        <View style={s.detailGroup}>
          <Text
            style={[
              s.detailLabel,
              isDark && s.detailLabelDark,
              { ...ds({ fontSize: 11 }, density) },
            ]}
          >
            {t("chat.agentPartCard.outputLabel", "Output")}
          </Text>
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
              numberOfLines={40}
            >
              {typeof output === "string"
                ? output
                : JSON.stringify(output, null, 2)}
            </Text>
          </View>
        </View>
      )}
      {hasInput && hasOutput && (
        <DiffViewSimple
          before={
            typeof input === "string" ? input : JSON.stringify(input, null, 2)
          }
          after={
            typeof output === "string"
              ? output
              : JSON.stringify(output, null, 2)
          }
          isDark={isDark}
        />
      )}
      {!hasInput && !hasOutput && !error && (
        <Text
          style={[
            s.emptyHint,
            isDark && s.emptyHintDark,
            { ...ds({ fontSize: 12 }, density) },
          ]}
        >
          {t("chat.agentPartCard.noDetails", "No details available")}
        </Text>
      )}
    </View>
  );
}

// Simple inline diff view for agent input/output comparison.
// Reuses the same logic as DiffView but without the horizontal scroll wrapper
// complexity — agent diffs are typically short enough to fit.
function DiffViewSimple({
  before,
  after,
  isDark,
}: {
  before: string;
  after: string;
  isDark: boolean;
}) {
  const lines: { type: "add" | "remove" | "context"; text: string }[] = [];
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const setA = new Set(a);

  for (const line of b) {
    if (!setA.has(line)) lines.push({ type: "add", text: line });
  }
  for (const line of a) {
    if (!b.includes(line)) lines.push({ type: "remove", text: line });
  }

  if (lines.length === 0) return null;

  return (
    <View style={[s.diffContainer, isDark && s.diffContainerDark]}>
      <ScrollView
        {...WIDE_CONTENT_SCROLL_CONFIG}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {lines.map((line) => (
          <View
            key={`${line.type}-${crypto.randomUUID().slice(0, 8)}`}
            style={[
              s.diffLine,
              line.type === "add" && (isDark ? s.diffAddDark : s.diffAdd),
              line.type === "remove" &&
                (isDark ? s.diffRemoveDark : s.diffRemove),
            ]}
          >
            <Text
              style={[
                s.diffPrefix,
                isDark && s.diffPrefixDark,
                line.type === "add" && s.diffAddText,
                line.type === "remove" && s.diffRemoveText,
              ]}
            >
              {line.type === "add" ? "+" : "-"}
            </Text>
            <Text
              style={[
                s.diffText,
                isDark && s.diffTextDark,
                line.type === "add" && s.diffAddText,
                line.type === "remove" && s.diffRemoveText,
              ]}
              selectable
            >
              {line.text}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function AgentPartCard({
  tool,
  isDark,
}: {
  tool: Part;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const density = useDensity();
  const [expanded, setExpanded] = useState(false);

  const status = tool.state?.status || "pending";
  const color = statusColor(status);
  const iconName = statusIcon(status);
  const elapsed = duration(tool.state?.time?.start, tool.state?.time?.end);
  const error = tool.state?.error?.message;
  const hasDetail =
    tool.state?.input !== undefined ||
    tool.state?.output !== undefined ||
    error;

  const toggle = useCallback(() => {
    if (hasDetail) setExpanded((v) => !v);
  }, [hasDetail]);

  const agentName = getAgentName(tool, t);
  const label = getAgentLabel(tool, t);

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
      {/* Header row */}
      <View style={s.header}>
        <View style={[s.headerLeft, { ...ds({ gap: 8 }, density) }]}>
          <Ionicons
            name={
              label === t("chat.agentPartCard.subtask")
                ? "git-branch-outline"
                : "people-outline"
            }
            size={16}
            color={color}
          />
          <View style={s.nameContainer}>
            <Text
              style={[
                s.name,
                isDark && s.nameDark,
                { ...ds({ fontSize: 13 }, density) },
              ]}
              numberOfLines={1}
            >
              {agentName}
            </Text>
            <Text
              style={[
                s.label,
                isDark && s.labelDark,
                { ...ds({ fontSize: 11 }, density) },
              ]}
            >
              {label}
            </Text>
          </View>
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
            <ActivityIndicator size="small" color={color} />
          )}
          {status === "completed" && (
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          )}
          {status === "error" && (
            <Ionicons name="close-circle" size={16} color="#ef4444" />
          )}
          {status === "pending" && (
            <Ionicons name={iconName} size={16} color={color} />
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

      {/* Error banner (always visible when collapsed) */}
      {error && !expanded && (
        <View
          style={[
            s.errorBannerInline,
            isDark && s.errorBannerDark,
            { ...ds({ gap: 6, marginTop: 6, padding: 8 }, density) },
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

      {/* Expanded detail */}
      {expanded && (
        <AgentDetail
          input={tool.state?.input}
          output={tool.state?.output}
          error={error}
          isDark={isDark}
        />
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
  nameContainer: { flex: 1 },
  name: { fontSize: 13, fontWeight: "500", color: "#0a0a0a", flex: 1 },
  nameDark: { color: "#e5e5e5" },
  label: { fontSize: 11, color: "#999999", marginTop: 2 },
  labelDark: { color: "#666666" },
  elapsed: { fontSize: 11, color: "#999999" },
  elapsedDark: { color: "#666666" },

  detailSection: { gap: 8, marginTop: 8 },
  detailGroup: { gap: 4 },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666666",
    textTransform: "uppercase",
  },
  detailLabelDark: { color: "#888888" },

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

  diffContainer: {
    marginTop: 8,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#f8f8f8",
  },
  diffContainerDark: { backgroundColor: "#1a1a1a" },
  diffLine: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  diffAdd: { backgroundColor: "#dcfce7" },
  diffAddDark: { backgroundColor: "#052e16" },
  diffRemove: { backgroundColor: "#fee2e2" },
  diffRemoveDark: { backgroundColor: "#2a0a0a" },
  diffPrefix: {
    width: 16,
    fontSize: 12,
    fontFamily: mono,
    color: "#999999",
    lineHeight: 20,
  },
  diffPrefixDark: { color: "#666666" },
  diffAddText: { color: "#16a34a" },
  diffRemoveText: { color: "#dc2626" },
  diffText: {
    fontSize: 12,
    fontFamily: mono,
    color: "#0a0a0a",
    lineHeight: 20,
    flex: 1,
  },
  diffTextDark: { color: "#e5e5e5" },

  errorBannerInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },
  errorBannerDark: { backgroundColor: "#1a0a0a" },
  errorText: { fontSize: 12, color: "#dc2626", flex: 1, lineHeight: 18 },
  errorTextDark: { color: "#ff6b6b" },

  emptyHint: { fontSize: 12, color: "#999999", fontStyle: "italic" },
  emptyHintDark: { color: "#666666" },
});
