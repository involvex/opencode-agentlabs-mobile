import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { WIDE_CONTENT_SCROLL_CONFIG } from "../../lib/scroll-config";
import { useDensity, ds } from "../../lib/density";
import type { Part } from "../../lib/sdk";
import { pairStepParts, type StepPair } from "../../lib/step-pairs";

const STEP_ICONS: Record<string, string> = {
  "step-start": "play-outline",
  "step-finish": "checkmark-outline",
};

// Re-exported so existing importers (MessageBubble) keep working; the
// implementation lives in lib/ so plain `node --test` can cover it without
// pulling in react-native.
export { pairStepParts, type StepPair };

// Display title for one step. The server's StepStartPart carries no `text`
// (only an optional snapshot ref), so titles are positional — "Step N" —
// with any legacy text a server does send kept as-is for compatibility.
function stepTitle(pair: StepPair, t: TFunction): string {
  return (
    pair.start.text ||
    pair.finish?.text ||
    t("chat.stepBlock.stepN", "Step {{n}}", { n: pair.index + 1 })
  );
}

// One-line outcome for a finished step, built from the fields
// StepFinishPart actually carries (reason/cost/tokens — never `text`).
// Returns null when the finish carries nothing displayable.
function finishMetaLine(finish: Part | null): string | null {
  if (!finish) return null;
  const bits: string[] = [];
  if (finish.reason) bits.push(finish.reason);
  const tokens = finish.tokens;
  if (
    tokens &&
    typeof tokens.input === "number" &&
    typeof tokens.output === "number"
  ) {
    bits.push(`${(tokens.input + tokens.output).toLocaleString()} tokens`);
  }
  if (typeof finish.cost === "number" && finish.cost > 0) {
    bits.push(`$${finish.cost.toFixed(4)}`);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

interface Props {
  parts: StepPair[];
  isDark: boolean;
}

export function StepBlock({ parts, isDark }: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const [expanded, setExpanded] = useState(false);

  const stepCount = parts.length;

  // Collapsed: single step shows its title; multiple steps show the count.
  // Expanded: every step shows its title plus any finish outcome.
  const summaryText = useMemo(() => {
    if (stepCount === 0) return "";
    if (stepCount === 1 && parts[0]) {
      return stepTitle(parts[0], t);
    }
    return t("chat.stepBlock.summary", "{{count}} steps", { count: stepCount });
  }, [parts, t, stepCount]);

  // Titles always exist (positional "Step N" fallback), so the expanded view
  // is never blank when steps exist — it doubles as the has-content gate.
  const expandedText = useMemo(() => {
    return parts
      .map((pair) => {
        const title = stepTitle(pair, t);
        const meta = finishMetaLine(pair.finish);
        return meta ? `→ ${title}\n  ${meta}` : `→ ${title}`;
      })
      .join("\n\n");
  }, [parts, t]);

  if (stepCount === 0) return null;

  return (
    <TouchableOpacity
      style={[
        s.block,
        isDark && s.blockDark,
        { ...ds({ padding: 10, marginBottom: 8 }, density) },
      ]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={[s.header, { ...ds({ gap: 6 }, density) }]}>
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={16}
          color={isDark ? "#666666" : "#999999"}
        />
        <Ionicons name="stats-chart-outline" size={16} color="#3b82f6" />
        <Text
          style={[
            s.label,
            isDark && s.labelDark,
            { ...ds({ fontSize: 12 }, density) },
          ]}
        >
          {t("chat.stepBlock.title", "Steps")} ·{" "}
          <Text style={[s.stepCount, { ...ds({ fontSize: 11 }, density) }]}>
            {stepCount}
          </Text>
        </Text>
        <Text
          style={[
            s.summary,
            isDark && s.summaryDark,
            { ...ds({ fontSize: 12, marginTop: 4 }, density) },
          ]}
          numberOfLines={expanded ? undefined : 1}
        >
          {summaryText}
        </Text>
        {expanded && (
          <Ionicons
            name="chevron-up"
            size={14}
            color={isDark ? "#666666" : "#999999"}
          />
        )}
      </View>
      {expanded && expandedText.length > 0 && (
        <ScrollView
          {...WIDE_CONTENT_SCROLL_CONFIG}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={s.expandedScroll}
        >
          <View style={[s.expandedContent, { ...ds({ gap: 6 }, density) }]}>
            {parts.map((pair) => (
              <View
                key={`${pair.index}-${pair.start.id}`}
                style={[s.stepItem, { ...ds({ gap: 4 }, density) }]}
              >
                <View style={[s.stepRow, { ...ds({ gap: 6 }, density) }]}>
                  <View
                    style={[
                      s.stepDot,
                      {
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                      },
                      pair.finish
                        ? isDark
                          ? s.stepDotCompleteDark
                          : s.stepDotComplete
                        : isDark
                          ? s.stepDotRunningDark
                          : s.stepDotRunning,
                    ]}
                  >
                    <Ionicons
                      name={STEP_ICONS[pair.start.type] || "ellipse"}
                      size={10}
                      color={pair.finish ? "#ffffff" : "#f59e0b"}
                    />
                  </View>
                  <Text
                    style={[
                      s.stepText,
                      isDark && s.stepTextDark,
                      {
                        ...ds({ fontSize: 13, lineHeight: 20 }, density),
                      },
                    ]}
                    selectable
                  >
                    {stepTitle(pair, t)}
                  </Text>
                </View>
                {pair.finish && finishMetaLine(pair.finish) && (
                  <Text
                    style={[
                      s.stepResult,
                      isDark && s.stepResultDark,
                      {
                        ...ds(
                          {
                            fontSize: 12,
                            lineHeight: 18,
                            marginLeft: 24,
                            marginTop: 2,
                          },
                          density,
                        ),
                      },
                    ]}
                    selectable
                  >
                    {finishMetaLine(pair.finish)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  block: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  blockDark: {
    backgroundColor: "#1a1a2e",
    borderColor: "#333366",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e40af",
    flex: 1,
  },
  labelDark: { color: "#8b5cf6" },
  stepCount: {
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 0,
    fontSize: 11,
    overflow: "hidden",
  },
  summary: {
    fontSize: 12,
    color: "#373017",
    marginTop: 4,
    flex: 1,
  },
  summaryDark: { color: "#d4a574" },
  expandedScroll: {
    maxHeight: 250,
    marginTop: 8,
  },
  expandedContent: {
    gap: 6,
  },
  stepItem: {
    gap: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepDotComplete: {
    backgroundColor: "#22c55e",
  },
  stepDotCompleteDark: {
    backgroundColor: "#16a34a",
  },
  stepDotRunning: {
    backgroundColor: "#f59e0b",
  },
  stepDotRunningDark: {
    backgroundColor: "#d97706",
  },
  stepText: {
    fontSize: 13,
    color: "#0a0a0a",
    lineHeight: 20,
    flex: 1,
  },
  stepTextDark: { color: "#e5e5e5" },
  stepResult: {
    fontSize: 12,
    color: "#4b5563",
    lineHeight: 18,
    marginLeft: 24,
    marginTop: 2,
  },
  stepResultDark: { color: "#9ca3af" },
});
