import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { loadTerminalVendor } from "./terminal-assets";
import {
  buildReceiveScript,
  buildTerminalHtml,
  xtermTheme,
  type XtermInbound,
  type XtermOutbound,
} from "./terminal-xterm-html";

export interface TerminalWebViewHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

interface Props {
  isDark: boolean;
  fontSize: number;
  onInput: (data: string) => void;
  onReady?: () => void;
  handleRef?: (handle: TerminalWebViewHandle | null) => void;
  testID?: string;
}

const SCROLLBACK = 2000;

function parseOutbound(raw: string): XtermOutbound | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const type = (parsed as { type?: unknown }).type;
    if (type === "ready") return { type: "ready" };
    if (
      type === "input" &&
      typeof (parsed as { data?: unknown }).data === "string"
    ) {
      return { type: "input", data: (parsed as { data: string }).data };
    }
    if (
      type === "error" &&
      typeof (parsed as { message?: unknown }).message === "string"
    ) {
      return {
        type: "error",
        message: (parsed as { message: string }).message,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default function TerminalWebView({
  isDark,
  fontSize,
  onInput,
  onReady,
  handleRef,
  testID,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadKey, setLoadKey] = useState(0);
  const [html, setHtml] = useState<string | null>(null);
  const pendingRef = useRef<string[]>([]);
  const readyRef = useRef(false);
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const attempt = loadKey;
    let cancelled = false;
    loadTerminalVendor()
      .then((vendor) => {
        if (cancelled) return;
        setHtml((prev) => {
          if (prev !== null && attempt === 0) return prev;
          return buildTerminalHtml({
            theme: xtermTheme(isDark),
            fontSize,
            scrollback: SCROLLBACK,
            vendor,
          });
        });
      })
      .catch((caught) => {
        if (cancelled) return;
        setFailed(
          caught instanceof Error
            ? caught.message
            : "Terminal engine failed to load.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isDark, fontSize, loadKey]);

  const send = useCallback((msg: XtermInbound) => {
    webRef.current?.injectJavaScript(buildReceiveScript(msg));
  }, []);

  const flushPending = useCallback(() => {
    const queued = pendingRef.current;
    pendingRef.current = [];
    for (const data of queued) send({ type: "write", data });
  }, [send]);

  const write = useCallback(
    (data: string) => {
      if (!data) return;
      if (!readyRef.current) {
        pendingRef.current.push(data);
        if (pendingRef.current.length > 500) {
          pendingRef.current = pendingRef.current.slice(-500);
        }
        return;
      }
      send({ type: "write", data });
    },
    [send],
  );

  const clear = useCallback(() => {
    pendingRef.current = [];
    send({ type: "clear" });
  }, [send]);

  const focus = useCallback(() => {
    send({ type: "focus" });
  }, [send]);

  useEffect(() => {
    handleRef?.({ write, clear, focus });
    return () => handleRef?.(null);
  }, [handleRef, write, clear, focus]);

  useEffect(() => {
    if (ready) send({ type: "theme", theme: xtermTheme(isDark) });
  }, [isDark, ready, send]);

  useEffect(() => {
    if (ready) send({ type: "fontSize", size: fontSize });
  }, [fontSize, ready, send]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const msg = parseOutbound(event.nativeEvent.data);
      if (!msg) return;
      if (msg.type === "ready") {
        readyRef.current = true;
        setReady(true);
        flushPending();
        onReadyRef.current?.();
        return;
      }
      if (msg.type === "input") {
        onInputRef.current(msg.data);
        return;
      }
      setFailed(msg.message);
    },
    [flushPending],
  );

  const handleRetry = useCallback(() => {
    pendingRef.current = [];
    readyRef.current = false;
    setFailed(null);
    setReady(false);
    setLoadKey((k) => k + 1);
    setReloadKey((k) => k + 1);
  }, []);

  if (failed) {
    return (
      <View style={[styles.center, isDark && styles.centerDark]}>
        <Text style={[styles.error, isDark && styles.errorDark]}>{failed}</Text>
        <TouchableOpacity style={styles.retry} onPress={handleRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.fill, isDark && styles.fillDark]}>
      {html !== null && (
        <WebView
          key={reloadKey}
          ref={webRef}
          testID={testID}
          originWhitelist={["*"]}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled={false}
          mediaPlaybackRequiresUserAction={false}
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView
          bounces={false}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={handleMessage}
          onError={() =>
            setFailed("Terminal view failed to load. Tap Retry to reload.")
          }
          style={styles.webview}
        />
      )}
      {!ready && (
        <View style={styles.loading}>
          <ActivityIndicator color={isDark ? "#22c55e" : "#16a34a"} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#ffffff" },
  fillDark: { backgroundColor: "#0a0a0a" },
  webview: { flex: 1, backgroundColor: "transparent" },
  loading: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: "#ffffff",
  },
  centerDark: { backgroundColor: "#0a0a0a" },
  error: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
    lineHeight: 20,
  },
  errorDark: { color: "#f87171" },
  retry: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
});
