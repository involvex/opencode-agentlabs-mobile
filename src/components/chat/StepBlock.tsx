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
import { WIDE_CONTENT_SCROLL_CONFIG } from "../../lib/scroll-config";
import { useDensity } from "../../lib/density";
import type { Part } from "../../lib/sdk";

const STEP_ICONS: Record<string, string> = {
  "step-start": "play-outline",
  "step-finish": "checkmark-outline",
};

export interface StepPair {
  start: Part;
  finish: Part | null;
  index: number;
}

export function pairStepParts(parts: Part[]): StepPair[] {
  const pairs: StepPair[] = [];
  let currentStart: Part | null = null;
  let index = 0;

  for (const part of parts) {
    if (part.type === "step-start") {
      if (currentStart) {
        // Orphaned start (previous one had no matching finish) — store it
        pairs.push({ start: currentStart, finish: null, index: index++ });
      }
      currentStart = part;
    } else if (part.type === "step-finish" && currentStart) {
      pairs.push({ start: currentStart, finish: part, index: index++ });
      currentStart = null;
    }
  }

  // Any trailing unpaired start
  if (currentStart) {
    pairs.push({ start: currentStart, finish: null, index: index });
  }

  return pairs;
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

  // When expanded shows all steps; when collapsed shows only the first step title
  const summaryText = useMemo(() => {
    if (stepCount === 0) return "";
    if (stepCount === 1) {
      return (
        parts[0]?.start.text ||
        t("chat.stepBlock.untitledStep", "Untitled step")
      );
    }
    return t("chat.stepBlock.summary", "{{count}} steps", { count: stepCount });
  }, [parts, t, stepCount]);

  // Combine all step text for the expanded view
  const expandedText = useMemo(() => {
    return parts
      .map((pair) => {
        const startText = pair.start.text || "";
        const finishText = pair.finish?.text || "";
        if (startText && finishText) {
          return `→ ${startText}\n  ${finishText}`;
        }
        return `→ ${startText}`;
      })
      .filter((s) => s.trim())
      .join("\n\n");
  }, [parts]);

  if (stepCount === 0) return null;

  return (
    <TouchableOpacity
      style={[
        s.block,
        isDark && s.blockDark,
        { padding: 10 * density.padding, marginBottom: 8 * density.padding },
      ]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={[s.header, { gap: 6 * density.gap }]}>
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
            { fontSize: 12 * density.font },
          ]}
        >
          {t("chat.stepBlock.title", "Steps")} ·{" "}
          <Text style={[s.stepCount, { fontSize: 11 * density.font }]}>
            {stepCount}
          </Text>
        </Text>
        <Text
          style={[
            s.summary,
            isDark && s.summaryDark,
            { fontSize: 12 * density.font, marginTop: 4 * density.padding },
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
          <View style={[s.expandedContent, { gap: 6 * density.gap }]}>
            {parts.map((pair) => (
              <View
                key={`${pair.index}-${pair.start.id}`}
                style={[s.stepItem, { gap: 4 * density.gap }]}
              >
                <View style={[s.stepRow, { gap: 6 * density.gap }]}>
                  <View
                    style={[
                      s.stepDot,
                      {
                        width: 18 * density.padding,
                        height: 18 * density.padding,
                        borderRadius: 9 * density.padding,
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
                        fontSize: 13 * density.font,
                        lineHeight: 20 * density.font,
                      },
                    ]}
                    selectable
                  >
                    {pair.start.text ||
                      t("chat.stepBlock.untitledStep", "Untitled step")}
                  </Text>
                </View>
                {pair.finish && pair.finish.text && (
                  <Text
                    style={[
                      s.stepResult,
                      isDark && s.stepResultDark,
                      {
                        fontSize: 12 * density.font,
                        lineHeight: 18 * density.font,
                        marginLeft: 24 * density.padding,
                        marginTop: 2 * density.padding,
                      },
                    ]}
                    selectable
                  >
                    {pair.finish.text}
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
