import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDensity, ds } from "../../lib/density";
import type { Part } from "../../lib/sdk";

const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

const IMAGE_MIME = /^image\//;

export function SnapshotPartCard({
  part,
  isDark,
}: {
  part: Part;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const density = useDensity();
  const [expanded, setExpanded] = useState(false);

  const filename =
    part.filename || t("chat.snapshotPartCard.untitled", "snapshot.txt");
  const isImage = IMAGE_MIME.test(part.mime || "");
  const isPdf = part.mime === "application/pdf";
  const textContent = typeof part.text === "string" ? part.text : undefined;

  const hasDetail =
    !!part.url ||
    !!textContent ||
    part.state?.input !== undefined ||
    part.state?.output !== undefined;
  const toggle = useCallback(() => {
    if (hasDetail) setExpanded((v) => !v);
  }, [hasDetail]);

  const iconColor = isImage ? "#3b82f6" : isPdf ? "#ef4444" : "#6366f1";

  return (
    <TouchableOpacity
      style={[
        s.card,
        isDark && s.cardDark,
        isImage && s.imageCard,
        isImage && isDark && s.imageCardDark,
        { ...ds({ padding: 10, marginTop: 8 }, density) },
      ]}
      onPress={toggle}
      activeOpacity={hasDetail ? 0.7 : 1}
    >
      <View style={[s.header, { ...ds({ gap: 8 }, density) }]}>
        <Ionicons
          name={
            isImage
              ? "image-outline"
              : isPdf
                ? "document-text-outline"
                : "camera-outline"
          }
          size={16}
          color={iconColor}
        />
        <View style={s.info}>
          <Text
            style={[
              s.filename,
              isDark && s.filenameDark,
              { ...ds({ fontSize: 13 }, density) },
            ]}
            numberOfLines={1}
          >
            {filename}
          </Text>
          {part.mime && (
            <Text
              style={[
                s.mime,
                isDark && s.mimeDark,
                { ...ds({ fontSize: 11 }, density) },
              ]}
            >
              {part.mime}
            </Text>
          )}
        </View>
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
            { ...ds({ marginTop: 8, gap: 8 }, density) },
          ]}
        >
          {isImage && part.url && (
            <Image
              source={{ uri: part.url }}
              style={[s.imagePreview, isDark && s.imagePreviewDark]}
              resizeMode="contain"
            />
          )}
          {isPdf && (
            <View
              style={[
                s.pdfPreview,
                isDark && s.pdfPreviewDark,
                { ...ds({ padding: 20 }, density) },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={40}
                color="#ef4444"
              />
              <Text
                style={[
                  s.pdfHint,
                  isDark && s.pdfHintDark,
                  { ...ds({ fontSize: 12, marginTop: 8 }, density) },
                ]}
              >
                {t(
                  "chat.snapshotPartCard.pdfHint",
                  "PDF file — open on your computer to view",
                )}
              </Text>
            </View>
          )}
          {textContent && (
            <View
              style={[
                s.codeBlock,
                isDark && s.codeBlockDark,
                { ...ds({ padding: 8 }, density) },
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
                {textContent}
              </Text>
            </View>
          )}
          {part.state?.input !== undefined && (
            <View style={s.detailGroup}>
              <Text
                style={[
                  s.detailLabel,
                  isDark && s.detailLabelDark,
                  { ...ds({ fontSize: 10 }, density) },
                ]}
              >
                {t("chat.snapshotPartCard.inputLabel", "Input")}
              </Text>
              <View
                style={[
                  s.codeBlock,
                  isDark && s.codeBlockDark,
                  { ...ds({ padding: 8 }, density) },
                ]}
              >
                <Text
                  style={[
                    s.codePre,
                    isDark && s.codePteDark,
                    { ...ds({ fontSize: 12 }, density) },
                  ]}
                  selectable
                  numberOfLines={20}
                >
                  {typeof part.state.input === "string"
                    ? part.state.input
                    : JSON.stringify(part.state.input, null, 2)}
                </Text>
              </View>
            </View>
          )}
          {part.state?.output !== undefined && (
            <View style={s.detailGroup}>
              <Text
                style={[
                  s.detailLabel,
                  isDark && s.detailLabelDark,
                  { ...ds({ fontSize: 10 }, density) },
                ]}
              >
                {t("chat.snapshotPartCard.outputLabel", "Output")}
              </Text>
              <View
                style={[
                  s.codeBlock,
                  isDark && s.codeBlockDark,
                  { ...ds({ padding: 8 }, density) },
                ]}
              >
                <Text
                  style={[
                    s.codePre,
                    isDark && s.codePteDark,
                    { ...ds({ fontSize: 12 }, density) },
                  ]}
                  selectable
                  numberOfLines={20}
                >
                  {typeof part.state.output === "string"
                    ? part.state.output
                    : JSON.stringify(part.state.output, null, 2)}
                </Text>
              </View>
            </View>
          )}
          {typeof part.state?.error?.message === "string" && (
            <View
              style={[
                s.errorBanner,
                isDark && s.errorBannerDark,
                { ...ds({ gap: 6, padding: 8 }, density) },
              ]}
            >
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
              <Text
                style={[
                  s.errorText,
                  isDark && s.errorTextDark,
                  { ...ds({ fontSize: 12 }, density) },
                ]}
              >
                {part.state.error.message}
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
  imageCard: { backgroundColor: "#eff6ff", borderColor: "#dbeafe" },
  imageCardDark: { backgroundColor: "#0c2044", borderColor: "#333366" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  info: { flex: 1, minWidth: 0 },
  filename: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0a0a0a",
  },
  filenameDark: { color: "#e5e5e5" },
  mime: { fontSize: 11, color: "#999999", marginTop: 2 },
  mimeDark: { color: "#666666" },

  expandedContent: { marginTop: 8, gap: 8 },
  imagePreview: {
    width: "100%",
    maxHeight: 200,
    borderRadius: 6,
    backgroundColor: "#f5f5f5",
  },
  imagePreviewDark: { backgroundColor: "#1a1a1a" },
  pdfPreview: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },
  pdfPreviewDark: { backgroundColor: "#1a0a0a" },
  pdfHint: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 8,
    textAlign: "center",
  },
  pdfHintDark: { color: "#ff6b6b" },

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
  codePteDark: { color: "#e5e5e5" },

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
});
