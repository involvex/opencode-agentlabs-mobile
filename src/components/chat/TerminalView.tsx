"use no memo";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import { hapticSelection } from "../../lib/haptics";
import {
  formatPtyError,
  usePtySession,
  type PtySessionItem,
} from "../../hooks/use-pty-session";
import { buildPtyWsUrl, PtyWebSocket } from "../../lib/pty-ws";
import { ansiToSegments } from "../../lib/ansi-to-style";
import { useSettings } from "../../stores/settings";
import { useTerminalRun } from "../../stores/terminal-run";
import { useDensity, ds } from "../../lib/density";
import { useKeyboardInset } from "../../lib/use-keyboard-inset";
import {
  executeLocalCommand,
  isLocalTerminalAvailable,
} from "../../lib/local-terminal";
import TerminalWebView, { type TerminalWebViewHandle } from "./TerminalWebView";
import type { Client } from "../../lib/sdk";

const SHELL_OPTIONS = ["auto", "bash", "zsh", "fish", "pwsh", "cmd"] as const;
type ShellOption = (typeof SHELL_OPTIONS)[number];

interface Props {
  sessionDirectory: string | undefined;
  sessionClient: Client;
  baseUrl: string;
  username?: string;
  password?: string;
  isDark: boolean;
  onClose: () => void;
  showClose?: boolean;
}

type WsState = "connecting" | "connected" | "disconnected" | "error";
type TerminalMode = "server" | "local";

const generateId = () => Math.random().toString(36).substring(2, 11);

const lineStyles = StyleSheet.create({
  line: { color: "#1a1a1a", lineHeight: 20 },
  lineDark: { color: "#e5e5e5" },
});

const SPECIAL_KEYS_NAV = [
  { label: "↑", sequence: "\x1b[A" },
  { label: "↓", sequence: "\x1b[B" },
  { label: "←", sequence: "\x1b[D" },
  { label: "→", sequence: "\x1b[C" },
  { label: "Home", sequence: "\x1b[H" },
  { label: "End", sequence: "\x1b[F" },
] as const;

const SPECIAL_KEYS_CTRL = [
  { label: "Tab", sequence: "\t" },
  { label: "Esc", sequence: "\x1b" },
  { label: "Ctrl+C", sequence: "\x03" },
  { label: "Ctrl+V", sequence: "\x16" },
] as const;

function tabLabel(session: PtySessionItem, index: number): string {
  const titled = session.title?.match(/(\d+)\s*$/);
  if (titled) return titled[1];
  return String(index + 1);
}

function TerminalToolbar({
  showClose,
  onClose,
  isDark,
  shell,
  onCycleShell,
  sessions,
  activeId,
  onSelect,
  onCloseSession,
  onCreate,
  badge,
}: {
  showClose: boolean;
  onClose: () => void;
  isDark: boolean;
  shell?: string;
  onCycleShell?: () => void;
  sessions: PtySessionItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCloseSession: (id: string) => void;
  onCreate: () => void;
  /** Optional right-side badge when shell picker is absent (e.g. Local). */
  badge?: string;
}) {
  return (
    <View style={[styles.toolbar, isDark && styles.toolbarDark]}>
      {showClose ? (
        <TouchableOpacity
          onPress={onClose}
          hitSlop={8}
          style={styles.toolbarClose}
        >
          <Ionicons
            name="close"
            size={20}
            color={isDark ? "#888888" : "#666666"}
          />
        </TouchableOpacity>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabStrip}
        contentContainerStyle={styles.tabStripContent}
        keyboardShouldPersistTaps="handled"
      >
        {sessions.map((session, index) => {
          const label = tabLabel(session, index);
          const a11y = session.title || `Shell ${index + 1}`;
          const active = session.id === activeId;
          return (
            <TouchableOpacity
              key={session.id}
              onPress={() => onSelect(session.id)}
              onLongPress={() => onCloseSession(session.id)}
              style={[
                styles.tabChip,
                isDark && styles.tabChipDark,
                active && styles.tabChipActive,
                active && isDark && styles.tabChipActiveDark,
              ]}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.tabChipText,
                  isDark && styles.tabChipTextDark,
                  active && styles.tabChipTextActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
              <TouchableOpacity
                onPress={() => onCloseSession(session.id)}
                hitSlop={6}
                style={styles.tabChipClose}
                accessibilityLabel={`Close ${a11y}`}
              >
                <Ionicons
                  name="close"
                  size={14}
                  color={active ? "#16a34a" : isDark ? "#888888" : "#666666"}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={onCreate}
          style={[styles.tabAdd, isDark && styles.tabAddDark]}
          accessibilityRole="button"
          accessibilityLabel="New terminal"
          testID="terminal-tab-add"
        >
          <Ionicons
            name="add"
            size={18}
            color={isDark ? "#4ade80" : "#16a34a"}
          />
        </TouchableOpacity>
      </ScrollView>
      {onCycleShell ? (
        <TouchableOpacity
          onPress={onCycleShell}
          hitSlop={8}
          testID="shell-picker"
          style={styles.toolbarTrailing}
        >
          <Text style={[styles.shellChip, isDark && styles.shellChipDark]}>
            {shell || "auto"}
          </Text>
        </TouchableOpacity>
      ) : badge ? (
        <Text
          style={[
            styles.shellChip,
            isDark && styles.shellChipDark,
            styles.toolbarTrailing,
          ]}
        >
          {badge}
        </Text>
      ) : null}
    </View>
  );
}

function TerminalKeyButton({
  label,
  onPress,
  isDark,
  disabled,
}: {
  label: string;
  onPress: () => void;
  isDark: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.keyButton,
        isDark && styles.keyButtonDark,
        disabled && styles.keyButtonDisabled,
      ]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.keyButtonText, isDark && styles.keyButtonTextDark]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface TerminalLine {
  id: string;
  text: string;
}

function AnsiLine({
  text,
  isDark,
  fontSize,
}: {
  text: string;
  isDark: boolean;
  fontSize: number;
}) {
  const segments = useMemo(() => {
    const segs = ansiToSegments(text, isDark);
    if (segs.length === 0) {
      console.log("AnsiLine: empty segments for text:", JSON.stringify(text));
    }
    return segs;
  }, [text, isDark]);

  const renderedSegments = segments
    .filter((seg) => seg.text.length > 0)
    .map((seg, i) => (
      <Text key={`seg-${i}-${JSON.stringify(seg.style)}`} style={seg.style}>
        {seg.text}
      </Text>
    ));

  return (
    <Text
      style={[lineStyles.line, isDark && lineStyles.lineDark, { fontSize }]}
    >
      {renderedSegments.length > 0 ? renderedSegments : " "}
    </Text>
  );
}

interface TerminalSocketProps {
  wsUrl: string;
  ptyId: string;
  sessionClient: Client;
  isDark: boolean;
  terminalFontSize: number;
  onClose: () => void;
  showClose: boolean;
  sessionDirectory: string | undefined;
  onWsError: () => void;
  authorization?: string;
  shell?: string;
  onCycleShell?: () => void;
  sessions: PtySessionItem[];
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onCreateSession: () => void;
}

function TerminalSocket({
  wsUrl,
  ptyId,
  sessionClient,
  isDark,
  terminalFontSize,
  onClose,
  showClose,
  sessionDirectory,
  onWsError,
  authorization,
  shell,
  onCycleShell,
  sessions,
  onSelectSession,
  onCloseSession,
  onCreateSession,
}: TerminalSocketProps) {
  const density = useDensity();
  const { androidBottom: keyboardBottom, height: keyboardHeight } =
    useKeyboardInset();
  const [wsState, setWsState] = useState<WsState>("connecting");
  const wsRef = useRef<PtyWebSocket | null>(null);
  const termHandleRef = useRef<TerminalWebViewHandle | null>(null);
  const sizeRef = useRef({ cols: 0, rows: 0 });

  useEffect(() => {
    const ws = new PtyWebSocket();
    wsRef.current = ws;

    ws.connect(
      wsUrl,
      (chunk: string) => {
        setWsState("connected");
        termHandleRef.current?.write(chunk);
      },
      () => {
        setWsState("disconnected");
        onWsError();
      },
      () => {
        setWsState("connected");
      },
      authorization ? { Authorization: authorization } : undefined,
    );

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [wsUrl, onWsError, authorization]);

  const handleClose = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    onClose();
  }, [onClose]);

  const handleTermInput = useCallback((data: string) => {
    wsRef.current?.send(data);
  }, []);

  const setWriter = useTerminalRun((s) => s.setWriter);
  useEffect(() => {
    setWriter((data: string) => {
      wsRef.current?.send(data);
    });
    return () => setWriter(null);
  }, [setWriter]);

  const handleTermHandle = useCallback(
    (handle: TerminalWebViewHandle | null) => {
      termHandleRef.current = handle;
    },
    [],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (cols < 2 || rows < 2) return;
      if (sizeRef.current.cols === cols && sizeRef.current.rows === rows) {
        return;
      }
      sizeRef.current = { cols, rows };
      void sessionClient.pty.update(
        ptyId,
        { size: { cols, rows } },
        sessionDirectory,
      );
    },
    [sessionClient, ptyId, sessionDirectory],
  );

  useEffect(() => {
    // Refit after keyboard show/hide changes available WebView height.
    const timer = setTimeout(() => termHandleRef.current?.fit(), 50);
    return () => clearTimeout(timer);
  }, [keyboardHeight]);

  const statusLabel =
    wsState === "connected"
      ? "Connected"
      : wsState === "disconnected"
        ? "Disconnected"
        : wsState === "error"
          ? "Connection error"
          : "Connecting...";

  const statusColor =
    wsState === "connected"
      ? "#22c55e"
      : wsState === "error" || wsState === "disconnected"
        ? "#ef4444"
        : "#f59e0b";

  const showKeys = keyboardHeight === 0;

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <TerminalToolbar
        showClose={showClose}
        onClose={handleClose}
        isDark={isDark}
        shell={shell}
        onCycleShell={onCycleShell}
        sessions={sessions}
        activeId={ptyId}
        onSelect={onSelectSession}
        onCloseSession={onCloseSession}
        onCreate={onCreateSession}
      />

      {/* Android adjustResize is unreliable — pad by IME height so content
          stays above the soft keyboard. Special keys hide while IME is open. */}
      <View
        style={[
          styles.body,
          keyboardBottom > 0 ? { paddingBottom: keyboardBottom } : null,
        ]}
      >
        <View style={[styles.output, isDark && styles.outputDark]}>
          <TerminalWebView
            isDark={isDark}
            fontSize={terminalFontSize}
            onInput={handleTermInput}
            onResize={handleResize}
            handleRef={handleTermHandle}
            testID="terminal-webview"
          />
          {wsState !== "connected" && (
            <Text
              style={[
                styles.statusInline,
                isDark && styles.statusInlineDark,
                { color: statusColor },
              ]}
            >
              {statusLabel}
            </Text>
          )}
        </View>

        {showKeys ? (
          <>
            <View
              style={[
                styles.keyButtonRow,
                { ...ds({ gap: 6, paddingBottom: 4 }, density) },
              ]}
            >
              {SPECIAL_KEYS_NAV.map((k) => (
                <TerminalKeyButton
                  key={k.label}
                  label={k.label}
                  onPress={() => wsRef.current?.send(k.sequence)}
                  isDark={isDark}
                  disabled={wsState !== "connected"}
                />
              ))}
            </View>
            <View
              style={[
                styles.keyButtonRow,
                styles.keyButtonRowLast,
                { ...ds({ gap: 6, paddingBottom: 8 }, density) },
              ]}
            >
              {SPECIAL_KEYS_CTRL.map((k) => (
                <TerminalKeyButton
                  key={k.label}
                  label={k.label}
                  onPress={() => wsRef.current?.send(k.sequence)}
                  isDark={isDark}
                  disabled={wsState !== "connected"}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function LocalTerminalView({
  isDark,
  terminalFontSize,
  sessionDirectory,
  onClose,
  showClose,
  onSwitchToServer,
}: {
  isDark: boolean;
  terminalFontSize: number;
  sessionDirectory: string | undefined;
  onClose: () => void;
  showClose: boolean;
  onSwitchToServer?: () => void;
}) {
  const density = useDensity();
  const { t } = useTranslation();
  const { androidBottom: keyboardBottom, height: keyboardHeight } =
    useKeyboardInset();
  const [output, setOutput] = useState<TerminalLine[]>([
    {
      id: "initial",
      text: "Local terminal ready. Type commands to execute on device.",
    },
  ]);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cwdRef = useRef(sessionDirectory || "/");
  const showKeys = keyboardHeight === 0;

  const copyLocalText = useCallback((text: string) => {
    if (!text.trim()) return;
    void hapticSelection();
    void Clipboard.setStringAsync(text).catch(() => {});
  }, []);

  const copyAllLocal = useCallback(() => {
    const all = output.map((line) => line.text).join("\n");
    copyLocalText(all);
  }, [output, copyLocalText]);

  const pasteToLocalInput = useCallback(() => {
    void Clipboard.getStringAsync()
      .then((text) => {
        if (!text) {
          Alert.alert(t("chat.terminal.clipboardEmpty", "Clipboard is empty"));
          return;
        }
        void hapticSelection();
        setInput((prev) => prev + text);
      })
      .catch(() => {});
  }, [t]);

  const showLocalLineMenu = useCallback(
    (lineText: string) => {
      void hapticSelection();
      Alert.alert(
        t("chat.terminal.selectionTitle", "Terminal selection"),
        undefined,
        [
          {
            text: t("chat.terminal.copy", "Copy"),
            onPress: () => copyLocalText(lineText),
          },
          {
            text: t("chat.terminal.copyAll", "Copy all"),
            onPress: copyAllLocal,
          },
          {
            text: t("chat.terminal.paste", "Paste"),
            onPress: pasteToLocalInput,
          },
          { text: t("common.cancel"), style: "cancel" },
        ],
      );
    },
    [t, copyLocalText, copyAllLocal, pasteToLocalInput],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || executing) return;

    setExecuting(true);
    setOutput((prev) => [...prev, { id: generateId(), text: `$ ${trimmed}` }]);
    setInput("");

    try {
      const result = await executeLocalCommand(trimmed, cwdRef.current);
      const lines = [result.stdout, result.stderr].filter(Boolean).join("\n");
      if (lines) {
        const normalized = lines.split("\n").map((l) => l.replace(/\r$/, ""));
        setOutput((prev) => {
          const next = [
            ...prev,
            ...normalized.map((text) => ({ id: generateId(), text })),
          ];
          const MAX_LINES = 2000;
          if (next.length > MAX_LINES) {
            return next.slice(next.length - MAX_LINES);
          }
          return next;
        });
      }
      if (result.exitCode !== 0) {
        setOutput((prev) => [
          ...prev,
          { id: generateId(), text: `[Exit code: ${result.exitCode}]` },
        ]);
      }
    } catch (error) {
      setOutput((prev) => [
        ...prev,
        {
          id: generateId(),
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setExecuting(false);
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [input, executing]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.toolbar, isDark && styles.toolbarDark]}>
        {showClose ? (
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={8}
            style={styles.toolbarClose}
          >
            <Ionicons
              name="close"
              size={20}
              color={isDark ? "#888888" : "#666666"}
            />
          </TouchableOpacity>
        ) : null}
        <Text
          style={[styles.localTitle, isDark && styles.localTitleDark]}
          numberOfLines={1}
        >
          Local
        </Text>
        {onSwitchToServer ? (
          <TouchableOpacity
            onPress={onSwitchToServer}
            hitSlop={8}
            style={styles.switchButton}
          >
            <Text style={styles.switchButtonText}>Server</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 56 : 0}
        style={[
          styles.body,
          keyboardBottom > 0 ? { paddingBottom: keyboardBottom } : null,
        ]}
      >
        <ScrollView
          ref={scrollRef}
          style={[styles.output, isDark && styles.outputDark]}
          contentContainerStyle={styles.outputContent}
          keyboardShouldPersistTaps="handled"
        >
          {output.map((line) => (
            <Pressable
              key={line.id}
              onLongPress={() => showLocalLineMenu(line.text)}
            >
              <AnsiLine
                text={line.text}
                isDark={isDark}
                fontSize={terminalFontSize}
              />
            </Pressable>
          ))}
        </ScrollView>

        {showKeys ? (
          <>
            <View
              style={[
                styles.keyButtonRow,
                { ...ds({ gap: 6, paddingBottom: 4 }, density) },
              ]}
            >
              {SPECIAL_KEYS_NAV.map((k) => (
                <TerminalKeyButton
                  key={k.label}
                  label={k.label}
                  onPress={() => {}}
                  isDark={isDark}
                  disabled
                />
              ))}
            </View>
            <View
              style={[
                styles.keyButtonRow,
                { ...ds({ gap: 6, paddingBottom: 4 }, density) },
              ]}
            >
              {SPECIAL_KEYS_CTRL.map((k) => (
                <TerminalKeyButton
                  key={k.label}
                  label={k.label}
                  onPress={() => {
                    if (k.label === "Tab" || k.label === "Esc") {
                      setInput((prev) => prev + k.sequence);
                    }
                  }}
                  isDark={isDark}
                  disabled={executing}
                />
              ))}
            </View>
          </>
        ) : null}

        <View style={[styles.inputBar, isDark && styles.inputBarDark]}>
          <Text
            style={[
              styles.prompt,
              isDark && styles.promptDark,
              { fontSize: terminalFontSize },
            ]}
          >
            {"$ "}
          </Text>
          <TextInput
            style={[
              styles.input,
              isDark && styles.inputDark,
              { fontSize: terminalFontSize },
            ]}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            autoFocus
            placeholder="Type a command..."
            placeholderTextColor={isDark ? "#666666" : "#999999"}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            testID="local-terminal-input"
            editable={!executing}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || executing}
            style={[
              styles.sendButton,
              (!input.trim() || executing) && styles.sendButtonDisabled,
            ]}
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function TerminalView({
  sessionDirectory,
  sessionClient,
  baseUrl,
  username,
  password,
  isDark,
  onClose,
  showClose = true,
}: Props) {
  const { t } = useTranslation();
  const terminalFontSize = useSettings((s) => s.terminalFontSize);
  const [mode, setMode] = useState<TerminalMode>("server");
  const [shell, setShell] = useState<ShellOption>("auto");
  const [wsFailed, setWsFailed] = useState(false);
  const localAvailable = isLocalTerminalAvailable();

  const {
    sessions,
    ptyId,
    status: ptyStatus,
    error: ptyError,
    retry: retryPty,
    reset: resetPty,
    ticket,
    select: selectSession,
    createNew,
    closeSession,
  } = usePtySession(sessionClient, sessionDirectory, shell);

  const handleSelectSession = useCallback(
    (id: string) => {
      setWsFailed(false);
      void selectSession(id);
    },
    [selectSession],
  );

  const handleCloseSession = useCallback(
    (id: string) => {
      setWsFailed(false);
      void closeSession(id);
    },
    [closeSession],
  );

  const handleCreateSession = useCallback(() => {
    setWsFailed(false);
    void createNew();
  }, [createNew]);

  const cycleShell = useCallback(() => {
    const idx = SHELL_OPTIONS.indexOf(shell);
    const next = SHELL_OPTIONS[(idx + 1) % SHELL_OPTIONS.length];
    setShell(next);
    setWsFailed(false);
    resetPty();
  }, [shell, resetPty]);

  const authorization = useMemo(() => {
    if (!username && !password) return null;
    const user = username || "opencode";
    const pass = password || "";
    const value = `${user}:${pass}`;
    if (typeof btoa === "function") return btoa(value);
    return null;
  }, [username, password]);

  const wsUrl = useMemo(() => {
    if (!ptyId || !sessionDirectory || !baseUrl) return null;
    return buildPtyWsUrl({
      baseUrl,
      ptyId,
      directory: sessionDirectory,
      ticket: ticket ?? undefined,
    });
  }, [ptyId, sessionDirectory, baseUrl, ticket]);

  const showServerLoading =
    mode === "server" &&
    (ptyStatus === "loading" || (ptyStatus === "idle" && !ptyId)) &&
    !wsFailed;
  const showServerError =
    mode === "server" && (ptyStatus === "error" || !wsUrl || wsFailed);

  // Stable callback so the TerminalSocket effect (keyed only on wsUrl) does not
  // tear down and reconnect the socket on every parent re-render.
  const handleWsError = useCallback(() => setWsFailed(true), []);

  const switchToServer = useCallback(() => {
    setWsFailed(false);
    setMode("server");
  }, []);

  // When the server PTY socket cannot be reached, fall back to the on-device
  // local terminal automatically. Derived (not stored) to avoid an extra render
  // pass.
  const effectiveMode: TerminalMode =
    wsFailed && localAvailable && mode === "server" ? "local" : mode;

  if (effectiveMode === "local") {
    return (
      <LocalTerminalView
        isDark={isDark}
        terminalFontSize={terminalFontSize}
        sessionDirectory={sessionDirectory}
        onClose={onClose}
        showClose={showClose}
        onSwitchToServer={localAvailable ? switchToServer : undefined}
      />
    );
  }

  if (showServerLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <TerminalToolbar
          showClose={showClose}
          onClose={onClose}
          isDark={isDark}
          shell={shell}
          onCycleShell={cycleShell}
          sessions={sessions}
          activeId={ptyId}
          onSelect={handleSelectSession}
          onCloseSession={handleCloseSession}
          onCreate={handleCreateSession}
        />
        <View style={styles.centerContent}>
          <ActivityIndicator color={isDark ? "#22c55e" : "#16a34a"} />
          <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
            {t("chat.terminal.connecting", "Connecting to terminal...")}
          </Text>
        </View>
      </View>
    );
  }

  if (showServerError) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <TerminalToolbar
          showClose={showClose}
          onClose={onClose}
          isDark={isDark}
          shell={shell}
          onCycleShell={cycleShell}
          sessions={sessions}
          activeId={ptyId}
          onSelect={handleSelectSession}
          onCloseSession={handleCloseSession}
          onCreate={handleCreateSession}
        />
        <View style={styles.centerContent}>
          <Ionicons
            name="terminal-outline"
            size={48}
            color={isDark ? "#666666" : "#999999"}
          />
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            {formatPtyError(ptyError) ||
              t("chat.terminal.error", "Terminal connection failed")}
            {localAvailable
              ? "\n\nServer PTY not available. Try Local Terminal instead."
              : ""}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryPty}>
            <Text style={styles.retryButtonText}>
              {t("common.retry", "Retry")}
            </Text>
          </TouchableOpacity>
          {localAvailable ? (
            <TouchableOpacity
              style={[styles.retryButton, styles.localButton]}
              onPress={() => setMode("local")}
            >
              <Text style={styles.retryButtonText}>Use Local Terminal</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <TerminalSocket
      key={wsUrl}
      wsUrl={wsUrl!}
      ptyId={ptyId!}
      sessionClient={sessionClient}
      isDark={isDark}
      terminalFontSize={terminalFontSize}
      onClose={onClose}
      showClose={showClose}
      sessionDirectory={sessionDirectory}
      onWsError={handleWsError}
      authorization={authorization ?? undefined}
      shell={shell}
      onCycleShell={cycleShell}
      sessions={sessions}
      onSelectSession={handleSelectSession}
      onCloseSession={handleCloseSession}
      onCreateSession={handleCreateSession}
    />
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
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
    gap: 6,
  },
  toolbarDark: {
    borderBottomColor: "#2a2a2a",
  },
  toolbarClose: {
    padding: 4,
  },
  toolbarTrailing: {
    flexShrink: 0,
  },
  localTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
    paddingHorizontal: 4,
  },
  localTitleDark: {
    color: "#ffffff",
  },
  tabStrip: {
    flex: 1,
    maxHeight: 36,
  },
  tabStripContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    gap: 6,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabChipDark: {
    backgroundColor: "#1a1a1a",
  },
  tabChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22c55e",
  },
  tabChipActiveDark: {
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    borderColor: "#4ade80",
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#444444",
    minWidth: 10,
    textAlign: "center",
  },
  tabChipTextDark: {
    color: "#cccccc",
  },
  tabChipTextActive: {
    color: "#16a34a",
  },
  tabChipClose: {
    marginLeft: 2,
    padding: 2,
  },
  tabAdd: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  tabAddDark: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  body: {
    flex: 1,
  },
  shellChip: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16a34a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    textTransform: "lowercase",
  },
  shellChipDark: {
    color: "#4ade80",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  statusText: {
    fontSize: 15,
    color: "#666666",
    marginTop: 12,
  },
  statusTextDark: {
    color: "#888888",
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  errorTextDark: {
    color: "#f87171",
  },
  retryButton: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  localButton: {
    backgroundColor: "#3b82f6",
    marginTop: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  output: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  outputDark: {
    backgroundColor: "#0a0a0a",
  },
  outputContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  statusInline: {
    fontSize: 13,
    color: "#888888",
    marginTop: 8,
    fontStyle: "italic",
  },
  statusInlineDark: {
    color: "#666666",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#f5f5f5",
  },
  inputBarDark: {
    borderTopColor: "#2a2a2a",
    backgroundColor: "#111111",
  },
  prompt: {
    color: "#22c55e",
    fontFamily: "Menlo, monospace",
    marginRight: 4,
  },
  promptDark: {
    color: "#22c55e",
  },
  input: {
    flex: 1,
    color: "#1a1a1a",
    fontFamily: "Menlo, monospace",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#ffffff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  inputDark: {
    color: "#e5e5e5",
    backgroundColor: "#1a1a1a",
    borderColor: "#333333",
  },
  sendButton: {
    backgroundColor: "#22c55e",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#cccccc",
  },
  switchButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#333333",
  },
  switchButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  keyButtonRow: {
    flexDirection: "row",
    flexShrink: 0,
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
  keyButtonRowLast: {
    paddingBottom: 8,
  },
  keyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#e5e5e5",
    borderRadius: 6,
  },
  keyButtonDark: {
    backgroundColor: "#2a2a2a",
  },
  keyButtonDisabled: {
    opacity: 0.4,
  },
  keyButtonText: {
    fontSize: 13,
    color: "#333333",
    fontFamily: "Menlo, monospace",
  },
  keyButtonTextDark: {
    color: "#e5e5e5",
  },
});
