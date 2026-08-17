import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { usePtySession } from "../../hooks/use-pty-session";
import { buildPtyWsUrl, PtyWebSocket } from "../../lib/pty-ws";
import { ansiToSegments } from "../../lib/ansi-to-style";
import { useSettings } from "../../stores/settings";
import {
  executeLocalCommand,
  isLocalTerminalAvailable,
} from "../../lib/local-terminal";
import type { Client } from "../../lib/sdk";

interface Props {
  sessionDirectory: string | undefined;
  sessionClient: Client;
  baseUrl: string;
  username?: string;
  password?: string;
  isDark: boolean;
  onClose: () => void;
}

type WsState = "connecting" | "connected" | "disconnected" | "error";
type TerminalMode = "server" | "local";

const lineStyles = StyleSheet.create({
  line: { color: "#1a1a1a", lineHeight: 20 },
  lineDark: { color: "#e5e5e5" },
});

function AnsiLine({
  text,
  isDark,
  fontSize,
}: {
  text: string;
  isDark: boolean;
  fontSize: number;
}) {
  const segments = useMemo(() => ansiToSegments(text, isDark), [text, isDark]);
  return (
    <Text
      style={[lineStyles.line, isDark && lineStyles.lineDark, { fontSize }]}
    >
      {segments.map((seg) => (
        <Text key={seg.text} style={seg.style}>
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

interface TerminalSocketProps {
  wsUrl: string;
  isDark: boolean;
  terminalFontSize: number;
  onClose: () => void;
  sessionDirectory: string | undefined;
  onWsError: () => void;
  authorization?: string;
}

function TerminalSocket({
  wsUrl,
  isDark,
  terminalFontSize,
  onClose,
  sessionDirectory,
  onWsError,
  authorization,
}: TerminalSocketProps) {
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [wsState, setWsState] = useState<WsState>("connecting");
  const wsRef = useRef<PtyWebSocket | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const ws = new PtyWebSocket();
    wsRef.current = ws;

    ws.connect(
      wsUrl,
      (chunk: string) => {
        setWsState("connected");
        setOutput((prev) => {
          const next = [...prev];
          const lines = chunk.split("\n");
          if (lines.length === 1) {
            if (next.length > 0) {
              next[next.length - 1] += lines[0];
            } else {
              next.push(lines[0]);
            }
          } else {
            if (next.length > 0) {
              next[next.length - 1] += lines[0];
            } else {
              next.push(lines[0]);
            }
            for (let i = 1; i < lines.length; i++) {
              next.push(lines[i]);
            }
          }
          return next;
        });
        scrollRef.current?.scrollToEnd({ animated: true });
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

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !wsRef.current) return;
    wsRef.current.send(trimmed + "\r");
    setInput("");
  }, [input]);

  const handleClose = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    onClose();
  }, [onClose]);

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

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} hitSlop={8}>
          <Ionicons
            name="close"
            size={22}
            color={isDark ? "#888888" : "#666666"}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          Terminal (Server)
        </Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.output, isDark && styles.outputDark]}
        contentContainerStyle={styles.outputContent}
      >
        {output.map((line) => (
          <AnsiLine
            key={line.slice(0, 32)}
            text={line}
            isDark={isDark}
            fontSize={terminalFontSize}
          />
        ))}
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
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(12, 0) },
          isDark && styles.inputBarDark,
        ]}
      >
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
          testID="terminal-input"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim()}
          style={[
            styles.sendButton,
            !input.trim() && styles.sendButtonDisabled,
          ]}
        >
          <Ionicons name="send" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LocalTerminalView({
  isDark,
  terminalFontSize,
  sessionDirectory,
  onClose,
  onSwitchToServer,
}: {
  isDark: boolean;
  terminalFontSize: number;
  sessionDirectory: string | undefined;
  onClose: () => void;
  onSwitchToServer?: () => void;
}) {
  const [output, setOutput] = useState<string[]>([
    "Local terminal ready. Type commands to execute on device.",
  ]);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cwdRef = useRef(sessionDirectory || "/");

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || executing) return;

    setExecuting(true);
    setOutput((prev) => [...prev, `$ ${trimmed}`]);
    setInput("");

    try {
      const result = await executeLocalCommand(trimmed, cwdRef.current);
      const lines = [result.stdout, result.stderr].filter(Boolean).join("\n");
      if (lines) {
        setOutput((prev) => [...prev, ...lines.split("\n")]);
      }
      if (result.exitCode !== 0) {
        setOutput((prev) => [...prev, `[Exit code: ${result.exitCode}]`]);
      }
    } catch (error) {
      setOutput((prev) => [
        ...prev,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
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
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} hitSlop={8}>
          <Ionicons
            name="close"
            size={22}
            color={isDark ? "#888888" : "#666666"}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          Terminal (Local)
        </Text>
        {onSwitchToServer && (
          <TouchableOpacity
            onPress={onSwitchToServer}
            hitSlop={8}
            style={styles.switchButton}
          >
            <Text style={styles.switchButtonText}>Server</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.statusDot, { backgroundColor: "#22c55e" }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.output, isDark && styles.outputDark]}
        contentContainerStyle={styles.outputContent}
      >
        {output.map((line) => (
          <AnsiLine
            key={line.slice(0, 32)}
            text={line}
            isDark={isDark}
            fontSize={terminalFontSize}
          />
        ))}
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(12, 0) },
          isDark && styles.inputBarDark,
        ]}
      >
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
}: Props) {
  const { t } = useTranslation();
  const terminalFontSize = useSettings((s) => s.terminalFontSize);
  const [mode, setMode] = useState<TerminalMode>("server");
  const [wsFailed, setWsFailed] = useState(false);
  const localAvailable = isLocalTerminalAvailable();

  const {
    ptyId,
    status: ptyStatus,
    error: ptyError,
    retry: retryPty,
    ticket,
  } = usePtySession(sessionClient, sessionDirectory);

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
        onSwitchToServer={localAvailable ? switchToServer : undefined}
      />
    );
  }

  if (showServerLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons
              name="close"
              size={22}
              color={isDark ? "#888888" : "#666666"}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            {t("session.terminal.title", "Terminal")}
          </Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator color={isDark ? "#22c55e" : "#16a34a"} />
          <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
            {t("session.terminal.connecting", "Connecting to terminal...")}
          </Text>
        </View>
      </View>
    );
  }

  if (showServerError) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons
              name="close"
              size={22}
              color={isDark ? "#888888" : "#666666"}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            {t("session.terminal.title", "Terminal")}
          </Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons
            name="terminal-outline"
            size={48}
            color={isDark ? "#666666" : "#999999"}
          />
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            {ptyError ||
              t("session.terminal.error", "Terminal connection failed")}
            {localAvailable &&
              "\n\nServer PTY not available. Try Local Terminal instead."}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryPty}>
            <Text style={styles.retryButtonText}>
              {t("common.retry", "Retry Server")}
            </Text>
          </TouchableOpacity>
          {localAvailable && (
            <TouchableOpacity
              style={[styles.retryButton, styles.localButton]}
              onPress={() => setMode("local")}
            >
              <Text style={styles.retryButtonText}>Use Local Terminal</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <TerminalSocket
      key={wsUrl}
      wsUrl={wsUrl!}
      isDark={isDark}
      terminalFontSize={terminalFontSize}
      onClose={onClose}
      sessionDirectory={sessionDirectory}
      onWsError={handleWsError}
      authorization={authorization ?? undefined}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  headerTitleDark: {
    color: "#ffffff",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  line: {
    color: "#1a1a1a",
    lineHeight: 20,
  },
  lineDark: {
    color: "#e5e5e5",
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
});
