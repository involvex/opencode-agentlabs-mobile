import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDensity, ds } from "../../lib/density";
import { formatFileSize } from "../../lib/attachments";

function formatSize(bytes?: number): string {
  return formatFileSize(bytes);
}

export interface Attachment {
  uri: string;
  mime: string;
  filename?: string;
  width?: number;
  height?: number;
  base64?: string;
  size?: number;
}

interface Props {
  attachments: Attachment[];
  isDark: boolean;
  onRemove: (index: number) => void;
}

export function ImageAttachments({ attachments, isDark, onRemove }: Props) {
  const density = useDensity();
  if (attachments.length === 0) return null;

  const isImage = (mime: string) => mime.startsWith("image/");

  return (
    <View
      style={[
        s.container,
        isDark && s.containerDark,
        {
          ...ds(
            {
              paddingHorizontal: 12,
              paddingVertical: 8,
            },
            density,
          ),
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { ...ds({ gap: 8 }, density) }]}
      >
        {attachments.map((att, idx) => {
          if (!isImage(att.mime)) {
            return (
              <View
                key={`${att.uri}-${idx}`}
                style={[s.fileChip, isDark && s.fileChipDark]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={28}
                  color={isDark ? "#bbbbbb" : "#555555"}
                />
                <View style={s.fileMeta}>
                  <Text
                    style={[s.fileName, isDark && s.labelDark]}
                    numberOfLines={2}
                  >
                    {att.filename || "file"}
                  </Text>
                  <Text style={[s.fileSub, isDark && s.labelDark]}>
                    {att.mime}
                    {att.size != null ? ` · ${formatSize(att.size)}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.remove, isDark && s.removeDark]}
                  onPress={() => onRemove(idx)}
                >
                  <Ionicons name="close" size={14} color="#ffffff" />
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <View key={`${att.uri}-${idx}`} style={s.thumb}>
              <Image
                source={{ uri: att.uri }}
                style={s.image}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={[s.remove, isDark && s.removeDark]}
                onPress={() => onRemove(idx)}
              >
                <Ionicons name="close" size={14} color="#ffffff" />
              </TouchableOpacity>
              {att.filename && (
                <Text
                  style={[
                    s.label,
                    isDark && s.labelDark,
                    {
                      ...ds(
                        {
                          fontSize: 10,
                          marginTop: 2,
                        },
                        density,
                      ),
                    },
                  ]}
                  numberOfLines={1}
                >
                  {att.filename}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#ffffff",
  },
  containerDark: { backgroundColor: "#0a0a0a", borderTopColor: "#1a1a1a" },
  scroll: { gap: 8 },
  thumb: { position: "relative" },
  image: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  removeDark: { backgroundColor: "#ef4444", borderColor: "#0a0a0a" },
  label: {
    fontSize: 10,
    color: "#666666",
    marginTop: 2,
    maxWidth: 72,
    textAlign: "center",
  },
  labelDark: { color: "#888888" },
  fileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 180,
    maxWidth: 260,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  fileChipDark: { backgroundColor: "#1a1a1a" },
  fileMeta: { flex: 1, minWidth: 0 },
  fileName: { fontSize: 12, fontWeight: "600", color: "#0a0a0a" },
  fileSub: { fontSize: 10, color: "#666666", marginTop: 2 },
});
