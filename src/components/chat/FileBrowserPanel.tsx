import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Client, FileEntry, FileStatusEntry } from "../../lib/sdk";
import { parentOf, nameOf } from "../../lib/path-utils";
import { useDensity, ds } from "../../lib/density";

interface Props {
  client: Client | null;
  rootDirectory?: string;
  isDark: boolean;
  compact?: boolean;
  onAttachPath: (path: string) => void;
}

const TEXT_EXT =
  /\.(tsx?|jsx?|json|md|mdx|txt|ya?ml|toml|xml|html?|css|scss|less|rs|go|py|java|kt|swift|c|cpp|h|hpp|sh|bash|zsh|ps1|sql|graphql|env|gitignore|dockerfile|makefile|csv|log)$/i;

function isTextFile(name: string): boolean {
  return TEXT_EXT.test(name) || !name.includes(".");
}

function statusColor(status?: string): string {
  if (!status) return "#888888";
  const s = status.toLowerCase();
  if (s.includes("modif") || s === "m") return "#f59e0b";
  if (s.includes("add") || s === "a" || s.includes("untracked"))
    return "#22c55e";
  if (s.includes("del") || s === "d") return "#ef4444";
  return "#8b5cf6";
}

function fileIcon(entry: FileEntry): keyof typeof Ionicons.glyphMap {
  if (entry.type === "directory") return "folder-outline";
  const name = entry.name.toLowerCase();
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "logo-javascript";
  if (name.endsWith(".json")) return "code-slash-outline";
  if (name.endsWith(".md")) return "document-text-outline";
  return "document-outline";
}

export function FileBrowserPanel({
  client,
  rootDirectory,
  isDark,
  compact,
  onAttachPath,
}: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const [path, setPath] = useState(".");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    path: string;
    content: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const token = useRef(0);

  const loadStatus = useCallback(async () => {
    if (!client?.file?.status) return;
    try {
      const items: FileStatusEntry[] = await client.file.status();
      const map: Record<string, string> = {};
      for (const item of items) {
        if (item.path) map[item.path.replace(/\\/g, "/")] = item.status || "M";
      }
      setStatusMap(map);
    } catch {
      setStatusMap({});
    }
  }, [client]);

  const load = useCallback(
    (dir: string, opts?: { refresh?: boolean }) => {
      if (!client) {
        setEntries([]);
        setError(t("session.workspace.noConnection", "No active connection"));
        return;
      }
      const id = ++token.current;
      if (opts?.refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      client.file
        .list({ path: dir })
        .then((items) => {
          if (token.current !== id) return;
          const sorted = [...items].sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          setEntries(sorted);
        })
        .catch((err) => {
          if (token.current !== id) return;
          setEntries([]);
          setError(
            err instanceof Error
              ? err.message
              : t("session.workspace.listFailed", "Failed to list files"),
          );
        })
        .finally(() => {
          if (token.current !== id) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    [client, t],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setPath(".");
      load(".");
      void loadStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [client, rootDirectory, load, loadStatus]);

  const goUp = () => {
    if (path === "." || path === "") return;
    const parent = parentOf(path) || ".";
    setPath(parent);
    load(parent);
  };

  const openPreview = async (filePath: string) => {
    if (!client?.file?.read) {
      onAttachPath(filePath);
      return;
    }
    setPreviewLoading(true);
    setPreview({ path: filePath, content: "" });
    try {
      const result = await client.file.read({ path: filePath });
      const content =
        typeof result?.content === "string"
          ? result.content
          : t("session.workspace.previewEmpty", "(empty file)");
      setPreview({ path: filePath, content });
    } catch (err) {
      setPreview({
        path: filePath,
        content:
          err instanceof Error
            ? err.message
            : t("session.workspace.previewFailed", "Failed to read file"),
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const openEntry = (entry: FileEntry) => {
    if (entry.type === "directory") {
      setPath(entry.path);
      load(entry.path);
      return;
    }
    if (isTextFile(entry.name || entry.path)) {
      void openPreview(entry.path);
      return;
    }
    onAttachPath(entry.path);
  };

  return (
    <View
      style={[s.container, isDark && s.containerDark, compact && s.compact]}
      testID="file-browser-panel"
    >
      <View style={[s.header, isDark && s.headerDark]}>
        <TouchableOpacity
          onPress={goUp}
          disabled={path === "."}
          hitSlop={8}
          style={s.upBtn}
        >
          <Ionicons
            name="chevron-up"
            size={18}
            color={
              path === "."
                ? isDark
                  ? "#444"
                  : "#ccc"
                : isDark
                  ? "#e5e5e5"
                  : "#1a1a1a"
            }
          />
        </TouchableOpacity>
        <Text
          style={[
            s.path,
            isDark && s.pathDark,
            { ...ds({ fontSize: 12 }, density) },
          ]}
          numberOfLines={1}
        >
          {path}
        </Text>
        <TouchableOpacity
          onPress={() => {
            load(path, { refresh: true });
            void loadStatus();
          }}
          hitSlop={8}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={isDark ? "#888" : "#666"}
          />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={s.loader} color={isDark ? "#888" : "#666"} />
      ) : error ? (
        <Text style={[s.error, isDark && s.errorDark]}>{error}</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.path}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                load(path, { refresh: true });
                void loadStatus();
              }}
              tintColor={isDark ? "#888" : "#666"}
            />
          }
          ListEmptyComponent={
            <Text style={[s.empty, isDark && s.emptyDark]}>
              {t("session.workspace.emptyDir", "No files here")}
            </Text>
          }
          renderItem={({ item }) => {
            const st = statusMap[item.path.replace(/\\/g, "/")];
            return (
              <TouchableOpacity
                style={[s.row, isDark && s.rowDark]}
                onPress={() => openEntry(item)}
                onLongPress={() => onAttachPath(item.path)}
                delayLongPress={350}
              >
                <Ionicons
                  name={fileIcon(item)}
                  size={18}
                  color={isDark ? "#a78bfa" : "#8b5cf6"}
                />
                <Text
                  style={[
                    s.name,
                    isDark && s.nameDark,
                    { ...ds({ fontSize: 14 }, density) },
                  ]}
                  numberOfLines={1}
                >
                  {item.name || nameOf(item.path)}
                </Text>
                {st ? (
                  <View style={[s.badge, { backgroundColor: statusColor(st) }]}>
                    <Text style={s.badgeText}>
                      {st.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
      {!compact && (
        <Text style={[s.hint, isDark && s.hintDark]}>
          {t(
            "session.workspace.attachHint",
            "Tap to preview · Long-press to attach as context",
          )}
        </Text>
      )}

      <Modal
        visible={!!preview}
        animationType="slide"
        onRequestClose={() => setPreview(null)}
      >
        <View style={[s.preview, isDark && s.previewDark]}>
          <View style={[s.previewHeader, isDark && s.previewHeaderDark]}>
            <TouchableOpacity onPress={() => setPreview(null)} hitSlop={8}>
              <Ionicons
                name="close"
                size={22}
                color={isDark ? "#888" : "#666"}
              />
            </TouchableOpacity>
            <Text
              style={[s.previewTitle, isDark && s.previewTitleDark]}
              numberOfLines={1}
            >
              {preview ? nameOf(preview.path) || preview.path : ""}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (preview) onAttachPath(preview.path);
                setPreview(null);
              }}
              hitSlop={8}
            >
              <Ionicons
                name="attach-outline"
                size={22}
                color={isDark ? "#a78bfa" : "#8b5cf6"}
              />
            </TouchableOpacity>
          </View>
          {previewLoading ? (
            <ActivityIndicator
              style={s.loader}
              color={isDark ? "#888" : "#666"}
            />
          ) : (
            <ScrollView contentContainerStyle={s.previewBody}>
              <Text
                style={[
                  s.previewText,
                  isDark && s.previewTextDark,
                  { ...ds({ fontSize: 12 }, density) },
                ]}
                selectable
              >
                {preview?.content || ""}
              </Text>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  containerDark: { backgroundColor: "#0a0a0a" },
  compact: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#e5e5e5",
    maxWidth: 280,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  headerDark: { borderBottomColor: "#1a1a1a" },
  upBtn: { padding: 2 },
  path: { flex: 1, color: "#666666", fontFamily: "monospace" },
  pathDark: { color: "#888888" },
  loader: { marginTop: 24 },
  error: { color: "#ef4444", padding: 16, fontSize: 13 },
  errorDark: { color: "#f87171" },
  empty: { color: "#999999", padding: 16, fontSize: 13 },
  emptyDark: { color: "#666666" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowDark: { borderBottomColor: "#1a1a1a" },
  name: { flex: 1, color: "#1a1a1a" },
  nameDark: { color: "#e5e5e5" },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  hint: {
    fontSize: 11,
    color: "#999999",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hintDark: { color: "#666666" },
  preview: { flex: 1, backgroundColor: "#ffffff", paddingTop: 48 },
  previewDark: { backgroundColor: "#0a0a0a" },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  previewHeaderDark: { borderBottomColor: "#1a1a1a" },
  previewTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  previewTitleDark: { color: "#ffffff" },
  previewBody: { padding: 16 },
  previewText: {
    color: "#1a1a1a",
    fontFamily: "monospace",
    lineHeight: 18,
  },
  previewTextDark: { color: "#e5e5e5" },
});
