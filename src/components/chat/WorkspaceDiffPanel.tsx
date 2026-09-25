import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Client } from "../../lib/sdk";
import { parseDiff, type DiffHunk, type FileDiffEntry } from "../../lib/parse-diff";
import { useDensity, ds } from "../../lib/density";
import { useTerminalRun } from "../../stores/terminal-run";
import { hapticSelection } from "../../lib/haptics";

interface Props {
  client: Client | null;
  sessionID?: string;
  isDark: boolean;
  onOpenTerminal?: () => void;
}

function shellQuote(path: string): string {
  if (/^[A-Za-z0-9_./\\:@+-]+$/.test(path)) return path;
  return `'${path.replace(/'/g, `'\\''`)}'`;
}

function lineStyle(type: string, isDark: boolean) {
  if (type === "add") {
    return {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      color: isDark ? "#4ade80" : "#16a34a",
    };
  }
  if (type === "remove") {
    return {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      color: isDark ? "#f87171" : "#dc2626",
    };
  }
  return {
    backgroundColor: "transparent",
    color: isDark ? "#888888" : "#666666",
  };
}

function HunkView({ hunk, isDark }: { hunk: DiffHunk; isDark: boolean }) {
  const density = useDensity();
  return (
    <View style={s.hunk}>
      <Text
        style={[
          s.hunkHeader,
          isDark && s.hunkHeaderDark,
          { ...ds({ fontSize: 11 }, density) },
        ]}
      >
        {hunk.header}
      </Text>
      {hunk.lines.map((line, i) => {
        const visual = lineStyle(line.type, isDark);
        const prefix =
          line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
        return (
          <Text
            key={`${hunk.header}-${i}`}
            style={[
              s.line,
              {
                backgroundColor: visual.backgroundColor,
                color: visual.color,
                ...ds({ fontSize: 11 }, density),
              },
            ]}
          >
            {prefix}
            {line.content}
          </Text>
        );
      })}
    </View>
  );
}

export function WorkspaceDiffPanel({
  client,
  sessionID,
  isDark,
  onOpenTerminal,
}: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const runInTerminal = useTerminalRun((st) => st.run);
  const [entries, setEntries] = useState<FileDiffEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) {
      setEntries([]);
      setError(t("session.workspace.noConnection", "No active connection"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (sessionID && client.session.diff) {
        const raw = await client.session.diff(sessionID);
        if (Array.isArray(raw) && raw.length > 0) {
          const mapped: FileDiffEntry[] = raw.map((item) => {
            const row = item as Record<string, unknown>;
            const path = String(row.path || row.file || "unknown");
            const diffText = String(row.diff || row.patch || "");
            return { path, hunks: diffText ? parseDiff(diffText) : [] };
          });
          setEntries(mapped);
          return;
        }
      }

      const changed = await client.file.status();
      if (!changed.length) {
        setEntries([]);
        return;
      }

      const results = await Promise.all(
        changed.map(async (file) => {
          const read = await client.file.read({ path: file.path });
          const diff = read?.diff ?? "";
          return {
            path: file.path,
            hunks: diff ? parseDiff(diff) : [],
          };
        }),
      );
      setEntries(results);
    } catch (err) {
      setEntries([]);
      setError(
        err instanceof Error
          ? err.message
          : t("session.workspace.diffFailed", "Failed to load diffs"),
      );
    } finally {
      setLoading(false);
    }
  }, [client, sessionID, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const runGit = useCallback(
    (command: string, thenReload = true) => {
      void hapticSelection();
      const ok = runInTerminal(command);
      if (!ok) {
        // Queue the command; opening Terminal mounts the writer and flushes it.
        onOpenTerminal?.();
      } else {
        onOpenTerminal?.();
      }
      if (thenReload) setTimeout(() => void load(), 1200);
    },
    [runInTerminal, onOpenTerminal, load],
  );

  const stageFile = (path: string) => {
    runGit(`git add -- ${shellQuote(path)}`);
  };

  const discardFile = (path: string) => {
    Alert.alert(
      t("session.workspace.discardTitle", "Discard changes?"),
      t(
        "session.workspace.discardBody",
        "This runs git restore on {{path}} and cannot be undone from the app.",
        { path },
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("session.workspace.discardConfirm", "Discard"),
          style: "destructive",
          onPress: () => runGit(`git restore -- ${shellQuote(path)}`),
        },
      ],
    );
  };

  return (
    <View
      style={[s.container, isDark && s.containerDark]}
      testID="workspace-diff-panel"
    >
      <View style={[s.header, isDark && s.headerDark]}>
        <Text
          style={[
            s.title,
            isDark && s.titleDark,
            { ...ds({ fontSize: 15 }, density) },
          ]}
        >
          {t("session.workspace.changes", "Changes")}
        </Text>
        <TouchableOpacity onPress={() => void load()} hitSlop={8}>
          <Ionicons
            name="refresh-outline"
            size={18}
            color={isDark ? "#888" : "#666"}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={s.loader} color={isDark ? "#888" : "#666"} />
      ) : error ? (
        <Text style={[s.error, isDark && s.errorDark]}>{error}</Text>
      ) : entries.length === 0 ? (
        <Text style={[s.empty, isDark && s.emptyDark]}>
          {t("session.workspace.noChanges", "No changes in this workspace")}
        </Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => {
            const open = expanded[item.path] ?? true;
            return (
              <View style={[s.fileCard, isDark && s.fileCardDark]}>
                <TouchableOpacity
                  style={s.fileHeader}
                  onPress={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [item.path]: !open,
                    }))
                  }
                >
                  <Ionicons
                    name={open ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={isDark ? "#888" : "#666"}
                  />
                  <Text
                    style={[
                      s.filePath,
                      isDark && s.filePathDark,
                      { ...ds({ fontSize: 13 }, density) },
                    ]}
                    numberOfLines={1}
                  >
                    {item.path}
                  </Text>
                  <Text style={[s.hunkCount, isDark && s.hunkCountDark]}>
                    {item.hunks.length}
                  </Text>
                </TouchableOpacity>
                <View style={s.fileActions}>
                  <TouchableOpacity
                    style={[s.actionBtn, isDark && s.actionBtnDark]}
                    onPress={() => stageFile(item.path)}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={14}
                      color="#22c55e"
                    />
                    <Text style={[s.actionText, { color: "#22c55e" }]}>
                      {t("session.workspace.stage", "Stage")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, isDark && s.actionBtnDark]}
                    onPress={() => discardFile(item.path)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    <Text style={[s.actionText, { color: "#ef4444" }]}>
                      {t("session.workspace.discard", "Discard")}
                    </Text>
                  </TouchableOpacity>
                </View>
                {open &&
                  (item.hunks.length === 0 ? (
                    <Text style={[s.empty, isDark && s.emptyDark]}>
                      {t("session.workspace.noHunks", "No diff available")}
                    </Text>
                  ) : (
                    item.hunks.map((hunk) => (
                      <HunkView
                        key={`${item.path}-${hunk.header}`}
                        hunk={hunk}
                        isDark={isDark}
                      />
                    ))
                  ))}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  containerDark: { backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  headerDark: { borderBottomColor: "#1a1a1a" },
  title: { fontWeight: "600", color: "#1a1a1a" },
  titleDark: { color: "#e5e5e5" },
  loader: { marginTop: 24 },
  error: { color: "#ef4444", padding: 16, fontSize: 13 },
  errorDark: { color: "#f87171" },
  empty: { color: "#999999", padding: 16, fontSize: 13 },
  emptyDark: { color: "#666666" },
  fileCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 8,
  },
  fileCardDark: { borderBottomColor: "#141414" },
  fileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filePath: { flex: 1, color: "#1a1a1a", fontFamily: "monospace" },
  filePathDark: { color: "#e5e5e5" },
  hunkCount: {
    fontSize: 11,
    color: "#888888",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  hunkCountDark: { backgroundColor: "#1a1a1a", color: "#888888" },
  fileActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#f5f5f5",
  },
  actionBtnDark: { backgroundColor: "#1a1a1a" },
  actionText: { fontSize: 12, fontWeight: "600" },
  hunk: { paddingHorizontal: 8, marginBottom: 8 },
  hunkHeader: {
    color: "#888888",
    fontFamily: "monospace",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  hunkHeaderDark: { color: "#666666" },
  line: {
    fontFamily: "monospace",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
