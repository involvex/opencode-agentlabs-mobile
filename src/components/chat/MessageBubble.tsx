import { memo, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Markdown } from "../markdown";
import { ToolCallCard } from "./ToolCallCard";
import { ReasoningBlock } from "./ReasoningBlock";
import { useDensity } from "../../lib/density";
import { useSettings } from "../../stores/settings";
import { formatRelativeTime, formatAbsoluteTime } from "../../lib/time-format";
import { useReactions } from "../../stores/reactions";
import type { Message, Part } from "../../lib/sdk";

const SCREEN_WIDTH = Dimensions.get("window").width;

const EMOJI_PICKER: string[] = ["👍", "❤️", "🎉", "🤔", "🔥", "✅", "💡", "🚀"];

function isImageMime(mime?: string): boolean {
  return !!mime && mime.startsWith("image/");
}

interface Props {
  message: Message;
  parts: Part[];
  isDark: boolean;
  // Only wired up for user messages — long-press opens the "Edit message" /
  // revert action sheet. Identified by messageID (not a closure over parts)
  // so it stays correct even if the memo below bails on a stale render.
  onLongPress?: (messageID: string) => void;
  onReply?: (messageID: string, role: string, text: string) => void;
}

// TODO: Replace with streamdown-rn once React 19 types PR lands - it has
// built-in block-level memoization that eliminates re-renders for stable blocks
export const MessageBubble = memo(
  function MessageBubble({
    message,
    parts,
    isDark,
    onLongPress,
    onReply,
  }: Props) {
    const { t } = useTranslation();
    const density = useDensity();
    const chatFontSize = useSettings((s) => s.chatFontSize);
    const isUser = message.role === "user";

    const textParts = parts.filter((p) => p.type === "text");
    const reasoningParts = parts.filter((p) => p.type === "reasoning");
    const toolParts = parts.filter((p) => p.type === "tool");
    const fileParts = parts.filter(
      (p) => p.type === "file" && isImageMime(p.mime),
    );
    const text = textParts.map((p) => p.text).join("\n") || "";
    const reasoning = reasoningParts.map((p) => p.text).join("\n") || "";

    const handleTimestampPress = useCallback(() => {
      const abs = formatAbsoluteTime(message.time.created);
      Alert.alert(t("chat.message.timestamp"), abs, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chat.message.copyTimestamp"),
          onPress: () => Clipboard.setStringAsync(abs),
        },
      ]);
    }, [message.time.created, t]);

    const handleReactionPress = useCallback(
      (emoji: string) => {
        const msgReactions =
          useReactions.getState().reactions[message.id] || [];
        if (msgReactions.includes(emoji)) {
          useReactions.getState().removeReaction(message.id, emoji);
        } else {
          useReactions.getState().addReaction(message.id, emoji);
        }
      },
      [message.id],
    );

    const showReactionPicker = useCallback(() => {
      const buttons = EMOJI_PICKER.map((emoji) => ({
        text: emoji,
        onPress: () => handleReactionPress(emoji),
      }));
      const actions = [
        ...buttons,
        {
          text: t("chat.message.reply"),
          onPress: () => onReply?.(message.id, message.role, text),
        },
        { text: t("common.cancel"), style: "cancel" as const },
      ];
      Alert.alert(t("chat.message.addReaction"), undefined, actions);
    }, [t, handleReactionPress, onReply, message.id, message.role, text]);

    const messageReactions = useReactions((s) => s.reactions[message.id]);

    return (
      <TouchableOpacity
        activeOpacity={isUser && onLongPress ? 0.7 : 1}
        onLongPress={
          isUser && onLongPress
            ? () => onLongPress(message.id)
            : showReactionPicker
        }
        disabled={!isUser && !onLongPress}
        style={[
          s.bubble,
          isUser ? s.user : s.assistant,
          isUser && isDark && s.userDark,
          !isUser && isDark && s.assistantDark,
          { padding: 12 * density.padding, marginBottom: 16 * density.padding },
        ]}
        testID={`chat-bubble-${message.role}`}
      >
        {/* Role indicator */}
        <View style={[s.header, { gap: 6 * density.gap }]}>
          <Ionicons
            name={isUser ? "person" : "sparkles"}
            size={14}
            color={isUser ? (isDark ? "#ffffff" : "#0a0a0a") : "#8b5cf6"}
          />
          <Text style={[s.role, isUser && s.roleUser, isDark && s.textWhite]}>
            {isUser ? "You" : "Assistant"}
          </Text>
          {message.model && (
            <Text style={[s.modelTag, isDark && s.modelTagDark]}>
              {message.model.modelID}
            </Text>
          )}
          {!isUser && message.modelID && (
            <Text style={[s.modelTag, isDark && s.modelTagDark]}>
              {message.modelID}
            </Text>
          )}
          {!isUser && (
            <TouchableOpacity
              onPress={handleTimestampPress}
              style={s.timePressable}
            >
              <Text
                style={[
                  s.timestamp,
                  isDark && s.timestampDark,
                  { fontSize: 10 * density.font },
                ]}
              >
                {formatRelativeTime(message.time.created)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isUser && (
          <Text
            style={[
              s.timestamp,
              isDark && s.timestampDark,
              { fontSize: 10 * density.font, marginTop: 2 * density.gap },
            ]}
          >
            {formatRelativeTime(message.time.created)}
          </Text>
        )}

        {/* Image attachments */}
        {fileParts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.imageRow}
            style={s.imageScroll}
          >
            {fileParts.map((fp) => (
              <View key={fp.id} style={s.imageWrap}>
                <Image
                  source={{ uri: fp.url }}
                  style={s.attachedImage}
                  resizeMode="cover"
                />
                {fp.filename && (
                  <Text
                    style={[s.imageLabel, isDark && s.imageLabelDark]}
                    numberOfLines={1}
                  >
                    {fp.filename}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Reasoning (collapsible) */}
        {reasoning.length > 0 && (
          <ReasoningBlock text={reasoning} isDark={isDark} />
        )}

        {/* Message text */}
        {text.length > 0 &&
          (isUser ? (
            <Text
              style={[
                s.messageText,
                isDark && s.textWhite,
                { fontSize: chatFontSize },
              ]}
              selectable
            >
              {text}
            </Text>
          ) : (
            <View style={s.markdownWrap}>
              <Markdown>{text}</Markdown>
            </View>
          ))}

        {/* Tool calls */}
        {toolParts.map((tool) => (
          <ToolCallCard key={tool.id} tool={tool} isDark={isDark} />
        ))}

        {/* Tokens/cost for assistant messages */}
        {!isUser && message.tokens && (
          <Text style={[s.tokens, isDark && s.tokensDark]}>
            {message.tokens.input + message.tokens.output} tokens
            {message.cost ? ` · $${message.cost.toFixed(4)}` : ""}
          </Text>
        )}

        {/* Reactions */}
        {messageReactions && messageReactions.length > 0 && (
          <View style={s.reactionsRow}>
            {messageReactions.map((emoji) => {
              const count = messageReactions.filter((e) => e === emoji).length;
              return (
                <TouchableOpacity
                  key={`${emoji}-${count}`}
                  style={[s.reactionChip, isDark && s.reactionChipDark]}
                  onPress={() => handleReactionPress(emoji)}
                >
                  <Text style={s.reactionEmoji}>{emoji}</Text>
                  {count > 1 && (
                    <Text
                      style={[s.reactionCount, isDark && s.reactionCountDark]}
                    >
                      {count}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    );
  },
  (prev, next) => {
    // Only re-render if message content actually changed
    // This prevents completed messages from re-rendering during streaming.
    // The store replaces changed parts/messages with NEW object references,
    // so a reference-equality sweep over every part catches every real change
    // (including tool parts, which have no `.text`) while still skipping
    // unchanged (completed) messages during other messages' streaming.
    if (prev.message !== next.message) return false;
    if (prev.isDark !== next.isDark) return false;
    if (prev.onLongPress !== next.onLongPress) return false;
    if (prev.parts.length !== next.parts.length) return false;
    for (let i = 0; i < prev.parts.length; i++) {
      if (prev.parts[i] !== next.parts[i]) return false;
    }
    return true;
  },
);

const s = StyleSheet.create({
  bubble: { marginBottom: 16, padding: 12, borderRadius: 12, maxWidth: "100%" },
  user: { backgroundColor: "#f5f5f5", marginLeft: 32 },
  userDark: { backgroundColor: "#1a1a1a" },
  assistant: { backgroundColor: "#f0f0ff" },
  assistantDark: { backgroundColor: "#1a1a2e" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  role: { fontSize: 13, fontWeight: "600", color: "#666666" },
  roleUser: { color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },

  modelTag: {
    fontSize: 11,
    color: "#999999",
    backgroundColor: "#e5e5e5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  modelTagDark: { backgroundColor: "#2a2a2a", color: "#888888" },

  timestamp: {
    fontSize: 10,
    color: "#999999",
  },
  timestampDark: {
    color: "#666666",
  },

  messageText: { fontSize: 15, lineHeight: 22, color: "#0a0a0a" },
  markdownWrap: { marginHorizontal: -4 },

  tokens: { fontSize: 11, color: "#999999", marginTop: 8 },
  tokensDark: { color: "#666666" },

  // Images
  imageScroll: { marginBottom: 8 },
  imageRow: { gap: 8 },
  imageWrap: { alignItems: "center" },
  attachedImage: {
    width: Math.min(200, SCREEN_WIDTH * 0.5),
    height: Math.min(200, SCREEN_WIDTH * 0.5),
    borderRadius: 8,
    backgroundColor: "#e5e5e5",
  },
  imageLabel: { fontSize: 10, color: "#666666", marginTop: 2, maxWidth: 200 },
  imageLabelDark: { color: "#888888" },

  timePressable: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  reactionsRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reactionChipDark: {
    backgroundColor: "#2a2a2a",
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: "#666666",
  },
  reactionCountDark: {
    color: "#888888",
  },
});
