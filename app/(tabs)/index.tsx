import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSessions } from "../../src/stores/sessions";
import { useConnections } from "../../src/stores/connections";
import { useEvents } from "../../src/stores/events";
import { useCatalog } from "../../src/stores/catalog";
import { useTemplates } from "../../src/stores/templates";
import { useTheme, useAccentColor } from "../../src/lib/theme";
import type BottomSheet from "@gorhom/bottom-sheet";
import type { Session, Project } from "../../src/lib/sdk";
import {
  DirectorySwitcher,
  DirectoryBrowserSheet,
} from "../../src/components/chat";
import { groupByDirectory } from "../../src/lib/session-grouping";
import { nameOf } from "../../src/lib/path-utils";
import { SETUP_GUIDE_URL } from "../../src/lib/links";
import { NewSessionModal } from "../../src/components/tabs/NewSessionModal";
import { RenameModal } from "../../src/components/tabs/RenameModal";

function formatTime(
  timestamp: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return t("sessionsList.time.justNow");
  if (diff < 3600000)
    return t("sessionsList.time.minutesAgo", {
      count: Math.floor(diff / 60000),
    });
  if (diff < 86400000)
    return t("sessionsList.time.hoursAgo", {
      count: Math.floor(diff / 3600000),
    });
  if (diff < 604800000)
    return t("sessionsList.time.daysAgo", {
      count: Math.floor(diff / 86400000),
    });

  return date.toLocaleDateString();
}

function SessionItem({
  session,
  isDark,
  accent,
  pinned,
  unreadCount,
  onRename,
  onDelete,
  onPin,
  searchSnippet,
  tags,
  onAddTag,
}: {
  session: Session;
  isDark: boolean;
  accent: string;
  pinned: boolean;
  unreadCount?: number;
  onRename: () => void;
  onDelete: () => void;
  onPin: () => void;
  searchSnippet?: string | null;
  tags?: string[];
  onAddTag?: () => void;
}) {
  const { t } = useTranslation();

  const onPress = () => {
    router.push({
      pathname: `/session/[id]`,
      params: {
        id: session.id,
        ...(session.directory ? { directory: session.directory } : {}),
      },
    });
  };

  const onLongPress = () => {
    Alert.alert(session.title || t("sessionsList.untitledSession"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: pinned
          ? t("sessionsList.actions.unpin")
          : t("sessionsList.actions.pin"),
        onPress: onPin,
      },
      { text: t("sessionsList.actions.rename"), onPress: onRename },
      ...(onAddTag
        ? [{ text: t("sessionsList.actions.addTag"), onPress: onAddTag }]
        : []),
      { text: t("common.delete"), style: "destructive", onPress: onDelete },
    ]);
  };

  // Extract short directory name from session
  const shortDir = session.directory
    ? session.directory.split("/").filter(Boolean).pop()
    : null;

  return (
    <TouchableOpacity
      style={[styles.sessionItem, isDark && styles.sessionItemDark]}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={`session-item-${session.id}`}
    >
      <View style={styles.sessionContent}>
        <View style={styles.sessionHeader}>
          <Text
            style={[styles.sessionTitle, isDark && styles.textDark]}
            numberOfLines={1}
          >
            {session.title || t("sessionsList.untitledSession")}
          </Text>
        </View>
        <View style={styles.sessionMetaRow}>
          <Text style={[styles.sessionMeta, isDark && styles.metaDark]}>
            {formatTime(session.time.updated, t)}
            {/* summary is always present but files defaults to 0 until the
                server populates it — only show the count when it's meaningful,
                matching the SessionInfo panel's `summary.files > 0` guard (#55) */}
            {session.summary &&
              session.summary.files > 0 &&
              ` · ${t("sessionsList.filesCount", { count: session.summary.files })}`}
          </Text>
          {shortDir && (
            <View style={styles.sessionDirBadge}>
              <Ionicons
                name="folder-outline"
                size={12}
                color={isDark ? "#888888" : "#666666"}
              />
              <Text style={[styles.sessionDirText, isDark && styles.metaDark]}>
                {shortDir}
              </Text>
            </View>
          )}
        </View>
        {searchSnippet && (
          <Text
            style={[styles.sessionSnippet, isDark && styles.metaDark]}
            numberOfLines={2}
          >
            {searchSnippet}
          </Text>
        )}
        {tags && tags.length > 0 && (
          <View style={styles.sessionTagsRow}>
            {tags.map((tag) => (
              <View
                key={tag}
                style={[styles.sessionTagChip, { borderColor: accent }]}
              >
                <Text style={[styles.sessionTagText, { color: accent }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {pinned && <Ionicons name="push-pin" size={16} color={accent} />}
      {unreadCount && unreadCount > 0 && (
        <View
          style={[
            styles.unreadBadge,
            unreadCount > 9 && styles.unreadBadgeLarge,
            isDark && styles.unreadBadgeDark,
          ]}
        >
          <Text style={styles.unreadBadgeText}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      )}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={isDark ? "#666666" : "#999999"}
      />
    </TouchableOpacity>
  );
}

// Flattened list row — either a collapsible group header or a session.
// A single flat array keeps FlatList's refresh/empty-state handling as-is
// instead of switching to SectionList.
type ListRow =
  | {
      type: "header";
      directory: string;
      shortName: string;
      count: number;
      collapsed: boolean;
    }
  | {
      type: "session";
      session: Session;
      searchSnippet: string | null;
    };

function GroupHeader({
  row,
  isDark,
  accent,
  onToggle,
}: {
  row: {
    directory: string;
    shortName: string;
    count: number;
    collapsed: boolean;
  };
  isDark: boolean;
  accent: string;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.groupHeader, isDark && styles.groupHeaderDark]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Ionicons name="folder-outline" size={16} color={accent} />
      <Text
        style={[styles.groupHeaderText, isDark && styles.textDark]}
        numberOfLines={1}
      >
        {row.shortName}
      </Text>
      <Text style={[styles.groupHeaderCount, isDark && styles.metaDark]}>
        {row.count}
      </Text>
      <Ionicons
        name={row.collapsed ? "chevron-forward" : "chevron-down"}
        size={16}
        color={isDark ? "#666666" : "#999999"}
      />
    </TouchableOpacity>
  );
}

// Get short directory name (last folder or project name)
function getShortPath(
  project:
    | {
        path?: { cwd?: string; root?: string; absolute?: string };
        name?: string;
      }
    | null
    | undefined,
): string {
  if (!project) return "";
  if (project.name) return project.name;
  if (!project.path?.absolute) return "";
  const parts = project.path.absolute.split("/").filter(Boolean);
  return parts[parts.length - 1] || project.path.absolute;
}

export default function SessionsScreen() {
  const isDark = useTheme();
  const accent = useAccentColor();
  const { t } = useTranslation();
  const [showNewSession, setShowNewSession] = useState(false);
  const [customDir, setCustomDir] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [renaming, setRenaming] = useState<Session | null>(null);
  const [renameText, setRenameText] = useState("");
  const renamingInFlight = useRef(false);
  const creatingInFlight = useRef(false);
  const [serverProjects, setServerProjects] = useState<Project[]>([]);
  const [selectedTemplateID, setSelectedTemplateID] = useState<string | null>(
    null,
  );

  const {
    sessions,
    isLoading,
    error,
    loadSessions,
    createSession,
    deleteSession,
    pinSession,
    unpinSession,
    pinnedSessions,
    unreadCounts,
    searchCachedSessions,
  } = useSessions();
  const {
    activeConnection,
    client,
    currentProject,
    serverHome,
    refreshProject,
    clientForDirectory,
    switchDirectory,
    addRecentDirectory,
    recentDirectories,
  } = useConnections();
  const authError = useEvents((s) => s.authError);
  const reconnect = useEvents((s) => s.connect);
  const loadCatalog = useCatalog((s) => s.load);

  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    load: loadTemplates,
  } = useTemplates();

  const dirSheetRef = useRef<BottomSheet>(null);
  const browserSheetRef = useRef<BottomSheet>(null);
  const [browseStartDir, setBrowseStartDir] = useState<string | null>(null);
  // Shared folder browser is opened either to pick a directory for a new
  // session, or to switch the active connection's directory.
  const [browseMode, setBrowseMode] = useState<"create" | "switch">("create");
  const [refreshing, setRefreshing] = useState(false);
  // Directories collapsed in the grouped session list. Empty by default —
  // all groups start expanded (#67).
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [cachedSearchResults, setCachedSearchResults] = useState<{
    hits: Record<string, string>;
  }>({ hits: {} });

  const toggleGroup = useCallback((directory: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(directory)) next.delete(directory);
      else next.add(directory);
      return next;
    });
  }, []);

  // Flatten sessions into header+item rows. Skip headers entirely when
  // everything lives in one directory — a lone header adds noise, not clarity.
  const rows = useMemo<ListRow[]>(() => {
    const q = searchQuery;
    // Title match: filter sessions by title
    const titleMatched = q
      ? sessions.filter(
          (s) => s.title?.toLowerCase().includes(q.toLowerCase()) || false,
        )
      : sessions;

    // Cached search match: include sessions whose cached message content
    // matches the query (works offline too)
    const cachedMatchIDs = new Set(Object.keys(cachedSearchResults.hits));
    const cachedMatched = q
      ? sessions.filter((s) => cachedMatchIDs.has(s.id))
      : [];

    // Union, preserving title-first then cached-only, with pinned sorting
    const combined = new Map<string, Session>();
    for (const s of titleMatched) combined.set(s.id, s);
    for (const s of cachedMatched) {
      if (!combined.has(s.id)) {
        combined.set(s.id, s);
      } else {
        combined.set(s.id, s);
      }
    }
    const filtered = Array.from(combined.values());

    const sorted = [...filtered].sort((a, b) => {
      const aPinned = pinnedSessions.includes(a.id);
      const bPinned = pinnedSessions.includes(b.id);
      if (aPinned === bPinned) return 0;
      return aPinned ? -1 : 1;
    });
    const groups = groupByDirectory(sorted);
    if (groups.length <= 1) {
      return sorted.map((session) => ({
        type: "session" as const,
        session,
        searchSnippet: cachedSearchResults.hits[session.id] ?? null,
      }));
    }
    const out: ListRow[] = [];
    for (const group of groups) {
      const collapsed = collapsedDirs.has(group.directory);
      out.push({
        type: "header",
        directory: group.directory,
        shortName: nameOf(group.directory) || group.directory,
        count: group.items.length,
        collapsed,
      });
      if (!collapsed) {
        for (const session of group.items)
          out.push({
            type: "session" as const,
            session,
            searchSnippet: cachedSearchResults.hits[session.id] ?? null,
          });
      }
    }
    return out;
  }, [
    sessions,
    collapsedDirs,
    pinnedSessions,
    searchQuery,
    cachedSearchResults,
  ]);

  useEffect(() => {
    let cancelled = false;
    void searchCachedSessions(searchQuery).then((result) => {
      if (cancelled) return;
      const hits: Record<string, string> = {};
      for (const hit of result.hits) {
        hits[hit.sessionID] = hit.snippet;
      }
      setCachedSearchResults({ hits });
    });
    return () => {
      cancelled = true;
    };
  }, [searchQuery, searchCachedSessions]);

  useEffect(() => {
    if (!showNewSession || !client) return;
    client.project
      .list()
      .then(setServerProjects)
      .catch(() => setServerProjects([]));
  }, [showNewSession, client]);

  const handleSwitchDirectory = useCallback(
    async (dir?: string) => {
      await switchDirectory(dir);
      loadSessions();
      refreshProject();
      loadCatalog();
    },
    [switchDirectory, loadSessions, refreshProject, loadCatalog],
  );

  useFocusEffect(
    useCallback(() => {
      if (client) {
        loadSessions();
        refreshProject();
        loadCatalog();
      }
      loadTemplates();
    }, [client, loadSessions, refreshProject, loadCatalog, loadTemplates]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadSessions(), refreshProject()]);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [loadSessions, refreshProject]);

  const handleRename = useCallback((session: Session) => {
    setRenameText(session.title || "");
    setRenaming(session);
  }, []);

  const submitRename = useCallback(async () => {
    const title = renameText.trim();
    if (!title || !renaming || renamingInFlight.current) return;
    const renameClient = renaming.directory
      ? (clientForDirectory(renaming.directory) ?? client)
      : client;
    if (!renameClient) return;
    renamingInFlight.current = true;
    try {
      await renameClient.session.update(renaming.id, { title });
      setRenaming(null);
      setRenameText("");
      loadSessions();
    } catch (err) {
      console.error("Rename failed:", err);
      Alert.alert(
        t("sessionsList.alerts.renameFailedTitle"),
        t("sessionsList.alerts.renameFailedMessage"),
      );
    } finally {
      renamingInFlight.current = false;
    }
  }, [renaming, renameText, client, clientForDirectory, loadSessions, t]);

  const handleDelete = useCallback(
    (session: Session) => {
      Alert.alert(
        t("sessionsList.alerts.deleteTitle"),
        t("sessionsList.alerts.deleteMessage", {
          title: session.title || t("sessionsList.untitledSession"),
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteSession(session.id);
              } catch (err) {
                console.error("Delete failed:", err);
                Alert.alert(
                  t("sessionsList.alerts.deleteFailedTitle"),
                  t("sessionsList.alerts.deleteFailedMessage"),
                );
              }
            },
          },
        ],
      );
    },
    [deleteSession, t],
  );

  const onCreateSession = async () => {
    if (creatingInFlight.current) return;
    creatingInFlight.current = true;
    try {
      const session = await createSession();
      if (session) {
        const tpl = selectedTemplateID
          ? templates.find((t) => t.id === selectedTemplateID)
          : null;
        router.push({
          pathname: `/session/[id]`,
          params: {
            id: session.id,
            ...(session.directory ? { directory: session.directory } : {}),
            ...(tpl?.model ? { templateModel: JSON.stringify(tpl.model) } : {}),
            ...(tpl?.agent ? { templateAgent: tpl.agent } : {}),
            ...(tpl?.prompt ? { templatePrompt: tpl.prompt } : {}),
          },
        });
      } else {
        Alert.alert(
          t("common.error"),
          t("sessionsList.alerts.createFailedMessage"),
        );
      }
    } finally {
      creatingInFlight.current = false;
    }
  };

  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim();
    const template = selectedTemplateID
      ? templates.find((t) => t.id === selectedTemplateID)
      : null;
    if (!name) {
      Alert.alert(
        t("sessionsList.alerts.renameFailedTitle"),
        t("sessionsList.alerts.renameFailedMessage"),
      );
      return;
    }

    const payload = {
      name,
      prompt: template?.prompt ?? "",
      model: template?.model,
      agent: template?.agent,
      directory: (template?.directory ?? customDir.trim()) || undefined,
    };

    if (selectedTemplateID && template) {
      await updateTemplate(selectedTemplateID, payload);
    } else {
      await addTemplate(payload);
    }
    setTemplateName("");
    setSelectedTemplateID(null);
    Alert.alert(
      t("common.success"),
      selectedTemplateID
        ? t("sessionsList.newSessionModal.templateUpdated")
        : t("sessionsList.newSessionModal.templateSaved"),
    );
  }, [
    templateName,
    selectedTemplateID,
    templates,
    updateTemplate,
    addTemplate,
    customDir,
    t,
  ]);

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      Alert.alert(
        t("sessionsList.alerts.deleteTitle"),
        t("sessionsList.alerts.deleteMessage", {
          title:
            templates.find((tmpl) => tmpl.id === id)?.name ||
            t("sessionsList.newSessionModal.templateNamePlaceholder"),
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => {
              void deleteTemplate(id);
              if (selectedTemplateID === id) {
                setSelectedTemplateID(null);
              }
            },
          },
        ],
      );
    },
    [deleteTemplate, selectedTemplateID, templates, t],
  );

  const onCreateInDirectory = useCallback(
    async (dir?: string) => {
      if (!activeConnection) return;
      if (creatingInFlight.current) return;
      creatingInFlight.current = true;
      setIsCreating(true);

      try {
        const template = selectedTemplateID
          ? templates.find((t) => t.id === selectedTemplateID)
          : null;
        const effectiveDir =
          dir && dir.trim() ? dir.trim() : template?.directory;

        if (effectiveDir) {
          const dirClient = clientForDirectory(effectiveDir);
          if (!dirClient) return;
          try {
            const session = await dirClient.session.create({});
            addRecentDirectory(effectiveDir);
            setShowNewSession(false);
            setCustomDir("");
            if (session) {
              router.push({
                pathname: `/session/[id]`,
                params: {
                  id: session.id,
                  ...(session.directory
                    ? { directory: session.directory }
                    : {}),
                  ...(template?.model
                    ? { templateModel: JSON.stringify(template.model) }
                    : {}),
                  ...(template?.agent ? { templateAgent: template.agent } : {}),
                  ...(template?.prompt
                    ? { templatePrompt: template.prompt }
                    : {}),
                },
              });
            }
          } catch (error) {
            console.error("Failed to create session in directory:", error);
            Alert.alert(
              t("common.error"),
              t("sessionsList.alerts.createFailedMessage"),
            );
          }
          return;
        }

        const session = await createSession();
        setShowNewSession(false);
        setCustomDir("");
        if (session) {
          router.push({
            pathname: `/session/[id]`,
            params: {
              id: session.id,
              ...(session.directory ? { directory: session.directory } : {}),
            },
          });
        } else {
          Alert.alert(
            t("common.error"),
            t("sessionsList.alerts.createFailedMessage"),
          );
        }
      } finally {
        creatingInFlight.current = false;
        setIsCreating(false);
      }
    },
    [
      activeConnection,
      clientForDirectory,
      addRecentDirectory,
      createSession,
      selectedTemplateID,
      templates,
      t,
    ],
  );

  // The browser sheet is a sibling of the New Session <Modal>. A native RN
  // Modal layers above everything in the React root (including bottom-sheet
  // portals), so the modal must be closed before the sheet is shown; this ref
  // remembers to bring it back if the user cancels without picking a folder.
  const restoreNewSessionOnDismiss = useRef(false);

  const openBrowser = useCallback(
    (startDir: string | null, mode: "create" | "switch") => {
      setBrowseStartDir(startDir || serverHome || null);
      setBrowseMode(mode);
      if (mode === "create" && showNewSession) {
        restoreNewSessionOnDismiss.current = true;
        setShowNewSession(false);
      }
      browserSheetRef.current?.expand();
    },
    [serverHome, showNewSession],
  );

  const onBrowserSelect = useCallback(
    (directory: string) => {
      restoreNewSessionOnDismiss.current = false;
      if (browseMode === "switch") {
        handleSwitchDirectory(directory);
        dirSheetRef.current?.close();
      } else {
        onCreateInDirectory(directory);
      }
    },
    [browseMode, handleSwitchDirectory, onCreateInDirectory],
  );

  const onBrowserDismiss = useCallback(() => {
    if (restoreNewSessionOnDismiss.current) {
      restoreNewSessionOnDismiss.current = false;
      setShowNewSession(true);
    }
  }, []);

  const onFabPress = () => {
    // Quick create in current project
    onCreateSession();
  };

  const onFabLongPress = () => {
    // Show modal with more options
    setCustomDir("");
    setShowNewSession(true);
  };

  if (!activeConnection) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons
          name="server-outline"
          size={64}
          color={isDark ? "#444444" : "#cccccc"}
        />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
          {t("sessionsList.empty.noConnectionTitle")}
        </Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
          {t("sessionsList.empty.noConnectionSubtitle")}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, isDark && styles.addButtonDark]}
          onPress={() => router.push("/connection/add")}
          testID="add-connection-button"
        >
          <Text
            style={[styles.addButtonText, isDark && styles.addButtonTextDark]}
          >
            {t("sessionsList.empty.addConnectionButton")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.setupGuideLink}
          onPress={() => Linking.openURL(SETUP_GUIDE_URL)}
          testID="setup-guide-link"
        >
          <Text style={styles.setupGuideLinkText}>
            {t("sessionsList.empty.setupGuideLink")}
          </Text>
        </TouchableOpacity>
        {/* No-server activation path (retention): a fully offline scripted
            demo, isolated from real connect/session state — see app/demo.tsx. */}
        <TouchableOpacity
          style={[
            styles.tryDemoButton,
            { borderColor: accent },
            isDark && styles.tryDemoButtonDark,
          ]}
          onPress={() => router.push("/demo")}
          testID="try-demo-button"
        >
          <Ionicons name="play-circle-outline" size={16} color={accent} />
          <Text
            style={[
              styles.tryDemoButtonText,
              { color: accent },
              isDark && styles.tryDemoButtonTextDark,
            ]}
          >
            {t("sessionsList.empty.tryDemoButton")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // The SSE loop stopped retrying because the server rejected our
  // credentials (401/403) — no amount of pull-to-refresh fixes that, so
  // point the user straight at the fix instead of a spinner that never
  // resolves (issue #76).
  if (authError) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons
          name="lock-closed-outline"
          size={64}
          color={isDark ? "#444444" : "#cccccc"}
        />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
          {t("sessionsList.empty.authFailedTitle")}
        </Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
          {t("sessionsList.empty.authFailedSubtitle", {
            name: activeConnection.name,
          })}
        </Text>
        <View style={styles.authErrorButtonRow}>
          <TouchableOpacity
            style={[styles.addButton, isDark && styles.addButtonDark]}
            onPress={() => router.push(`/connection/${activeConnection.id}`)}
            testID="fix-connection-button"
          >
            <Text
              style={[styles.addButtonText, isDark && styles.addButtonTextDark]}
            >
              {t("sessionsList.empty.checkCredentialsButton")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, isDark && styles.addButtonDark]}
            onPress={() => {
              // authError is cleared inside connect() itself once the retry
              // attempt starts (see src/stores/events.ts), so a manual
              // set() here isn't needed — just kick the SSE state machine.
              reconnect();
            }}
            testID="retry-connection-button"
          >
            <Text
              style={[styles.addButtonText, isDark && styles.addButtonTextDark]}
            >
              {t("common.retry")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const shortPath = getShortPath(currentProject);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Connection indicator — tap to switch project, long-press to browse filesystem */}
      <TouchableOpacity
        style={[styles.connectionBar, isDark && styles.connectionBarDark]}
        onPress={() => dirSheetRef.current?.expand()}
        onLongPress={() =>
          openBrowser(activeConnection?.directory || null, "switch")
        }
        activeOpacity={0.7}
        testID="connection-status-bar"
      >
        <View style={styles.connectionInfo}>
          <View
            style={[styles.connectionDot, { backgroundColor: "#22c55e" }]}
            testID="connection-status-dot"
          />
          <Text
            style={[styles.connectionName, isDark && styles.textDark]}
            numberOfLines={1}
          >
            {activeConnection.name}
          </Text>
          {shortPath && (
            <>
              <Ionicons
                name="folder"
                size={14}
                color={isDark ? "#888888" : "#666666"}
              />
              <Text
                style={[styles.projectPath, isDark && styles.metaDark]}
                numberOfLines={1}
              >
                {shortPath}
              </Text>
            </>
          )}
        </View>
        <Ionicons
          name="swap-horizontal-outline"
          size={16}
          color={isDark ? "#666666" : "#999999"}
        />
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View
        style={[styles.searchContainer, isDark && styles.searchContainerDark]}
      >
        <Ionicons
          name="search-outline"
          size={16}
          color={isDark ? "#888888" : "#999999"}
        />
        <TextInput
          style={[styles.searchInput, isDark && styles.searchInputDark]}
          placeholder={t("sessionsList.searchPlaceholder")}
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) =>
          row.type === "header" ? `dir:${row.directory}` : row.session.id
        }
        renderItem={({ item: row }) =>
          row.type === "header" ? (
            <GroupHeader
              row={row}
              isDark={isDark}
              accent={accent}
              onToggle={() => toggleGroup(row.directory)}
            />
          ) : (
            <SessionItem
              session={row.session}
              isDark={isDark}
              accent={accent}
              pinned={pinnedSessions.includes(row.session.id)}
              unreadCount={unreadCounts[row.session.id]}
              searchSnippet={row.searchSnippet}
              tags={useSessions.getState().sessionTags[row.session.id]}
              onRename={() => handleRename(row.session)}
              onDelete={() => handleDelete(row.session)}
              onPin={() => {
                if (pinnedSessions.includes(row.session.id)) {
                  unpinSession(row.session.id);
                } else {
                  pinSession(row.session.id);
                }
              }}
              onAddTag={() => {
                Alert.prompt(
                  t("sessionsList.addTagTitle"),
                  t("sessionsList.addTagMessage"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("common.save"),
                      onPress: (tag: string | undefined) => {
                        const trimmed = tag?.trim().toLowerCase();
                        if (!trimmed) return;
                        useSessions
                          .getState()
                          .addSessionTag(row.session.id, trimmed);
                      },
                    },
                  ],
                  "plain-text",
                );
              }}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#ffffff" : "#0a0a0a"}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={isDark ? "#ffffff" : "#0a0a0a"}
              />
            </View>
          ) : (
            <View style={styles.emptyList}>
              <Text style={[styles.emptyListText, isDark && styles.metaDark]}>
                {t("sessionsList.empty.noSessions")}
              </Text>
            </View>
          )
        }
        contentContainerStyle={
          sessions.length === 0 ? styles.emptyContent : undefined
        }
      />

      {/* FAB to create new session */}
      <TouchableOpacity
        style={[styles.fab, isDark && styles.fabDark]}
        onPress={onFabPress}
        onLongPress={onFabLongPress}
        delayLongPress={500}
        testID="new-session-fab"
      >
        <Ionicons name="add" size={28} color={isDark ? "#0a0a0a" : "#ffffff"} />
      </TouchableOpacity>

      <NewSessionModal
        visible={showNewSession}
        onClose={() => setShowNewSession(false)}
        isDark={isDark}
        accent={accent}
        t={t}
        isCreating={isCreating}
        customDir={customDir}
        onCustomDirChange={(text) => {
          if (serverHome && text.startsWith("~/")) {
            setCustomDir(serverHome + text.slice(1));
          } else if (serverHome && text === "~") {
            setCustomDir(serverHome);
          } else {
            setCustomDir(text);
          }
        }}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        selectedTemplateID={selectedTemplateID}
        onSelectTemplateID={setSelectedTemplateID}
        templates={templates}
        currentProject={currentProject}
        activeConnection={activeConnection}
        onCreate={onCreateInDirectory}
        onSaveTemplate={handleSaveTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onBrowse={openBrowser}
        serverHome={serverHome}
        recentDirectories={recentDirectories}
        serverProjects={serverProjects}
      />

      <RenameModal
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        renameText={renameText}
        onChangeText={setRenameText}
        onSubmit={submitRename}
        disabled={!renameText.trim()}
        isDark={isDark}
        t={t}
      />

      {/* Directory switcher bottom sheet */}
      <DirectorySwitcher
        sheetRef={dirSheetRef}
        current={activeConnection?.directory}
        recents={recentDirectories}
        serverHome={serverHome}
        isDark={isDark}
        onSwitch={handleSwitchDirectory}
        onBrowse={() =>
          openBrowser(
            activeConnection?.directory ||
              currentProject?.path?.absolute ||
              null,
            "switch",
          )
        }
      />

      {/* Browsable folder picker — used for both "new session in..." and
          "switch project directory" flows (see browseMode). */}
      <DirectoryBrowserSheet
        sheetRef={browserSheetRef}
        startDirectory={browseStartDir}
        clientForDirectory={clientForDirectory}
        isDark={isDark}
        onSelect={onBrowserSelect}
        onDismiss={onBrowserDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#0a0a0a",
  },
  connectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  connectionBarDark: {
    borderBottomColor: "#1a1a1a",
  },
  connectionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  connectionUrl: {
    fontSize: 12,
    color: "#666666",
  },
  projectPath: {
    fontSize: 13,
    color: "#666666",
    flex: 1,
  },
  errorBar: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  groupHeaderDark: {
    backgroundColor: "#151515",
    borderBottomColor: "#1a1a1a",
  },
  groupHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  groupHeaderCount: {
    fontSize: 12,
    color: "#666666",
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  sessionItemDark: {
    borderBottomColor: "#1a1a1a",
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  unreadBadgeLarge: {
    minWidth: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
  },
  unreadBadgeDark: {
    backgroundColor: "#22c55e",
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 14,
  },
  sessionContent: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0a0a0a",
    marginBottom: 4,
  },
  textDark: {
    color: "#ffffff",
  },
  sessionMeta: {
    fontSize: 13,
    color: "#666666",
  },
  sessionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionDirBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionDirText: {
    fontSize: 11,
    color: "#666666",
  },
  sessionSnippet: {
    fontSize: 12,
    color: "#888888",
    marginTop: 4,
    lineHeight: 16,
  },
  sessionTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  sessionTagChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sessionTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  metaDark: {
    color: "#888888",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#ffffff",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    color: "#0a0a0a",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  authErrorButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  addButtonDark: {
    backgroundColor: "#ffffff",
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  addButtonTextDark: {
    color: "#0a0a0a",
  },
  setupGuideLink: {
    marginTop: 16,
  },
  setupGuideLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  },
  tryDemoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  tryDemoButtonDark: {
    borderColor: "#a78bfa",
  },
  tryDemoButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6d28d9",
  },
  tryDemoButtonTextDark: {
    color: "#a78bfa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyListText: {
    fontSize: 16,
    color: "#666666",
  },
  emptyContent: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDark: {
    backgroundColor: "#ffffff",
  },
  // Modal styles removed — extracted to src/components/tabs/NewSessionModal.tsx and RenameModal.tsx

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
  },
  searchContainerDark: {
    backgroundColor: "#2a2a2a",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0a0a0a",
  },
  searchInputDark: {
    color: "#ffffff",
  },
});
