import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { loadTerminalVendor } from "./terminal-assets";
import { hapticSelection } from "../../lib/haptics";
import {
  buildReceiveScript,
  buildTerminalHtml,
  xtermTheme,
  type XtermInbound,
} from "./terminal-xterm-html";
import { parseOutbound } from "./terminal-copy";

export { parseOutbound } from "./terminal-copy";

export interface TerminalWebViewHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
}

interface Props {
  isDark: boolean;
  fontSize: number;
  onInput: (data: string) => void;
  onReady?: () => void;
  onResize?: (cols: number, rows: number) => void;
  handleRef?: (handle: TerminalWebViewHandle | null) => void;
  testID?: string;
}

const SCROLLBACK = 2000;

export default function TerminalWebView({
  isDark,
  fontSize,
  onInput,
  onReady,
  onResize,
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
  const layoutRef = useRef({ width: 0, height: 0 });
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);
  const { t } = useTranslation();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const attempt = loadKey;
    const fontFamily = Platform.select({
      ios: "Menlo, monospace",
      android: "monospace",
      default: "monospace",
    })!;
    let cancelled = false;
    loadTerminalVendor()
      .then((vendor) => {
        if (cancelled) return;
        setHtml((prev) => {
          if (prev !== null && attempt === 0) return prev;
          const translate = tRef.current;
          return buildTerminalHtml({
            theme: xtermTheme(isDark),
            fontSize,
            scrollback: SCROLLBACK,
            vendor,
            fontFamily,
            labels: {
              copy: translate("chat.terminal.copy", "Copy"),
              copyAll: translate("chat.terminal.copyAll", "Copy all"),
              paste: translate("chat.terminal.paste", "Paste"),
              dismiss: translate("chat.terminal.dismiss", "Dismiss"),
            },
          });
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed("Terminal engine failed to load. Tap Retry to reload.");
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

  const fit = useCallback(() => {
    send({ type: "fit" });
  }, [send]);

  useEffect(() => {
    handleRef?.({ write, clear, focus, fit });
    return () => handleRef?.(null);
  }, [handleRef, write, clear, focus, fit]);

  useEffect(() => {
    if (ready) send({ type: "theme", theme: xtermTheme(isDark) });
  }, [isDark, ready, send]);

  useEffect(() => {
    if (ready) send({ type: "fontSize", size: fontSize });
  }, [fontSize, ready, send]);

  const copyToClipboard = useCallback((text: string) => {
    if (!text.trim()) return;
    void hapticSelection();
    void Clipboard.setStringAsync(text).catch(() => {});
  }, []);

  const pasteFromClipboard = useCallback(() => {
    void Clipboard.getStringAsync()
      .then((text) => {
        if (!text) {
          Alert.alert(
            tRef.current("chat.terminal.clipboardEmpty", "Clipboard is empty"),
          );
          return;
        }
        void hapticSelection();
        onInputRef.current(text);
      })
      .catch(() => {});
  }, []);

  const sendLabels = useCallback(() => {
    const translate = tRef.current;
    send({
      type: "labels",
      labels: {
        copy: translate("chat.terminal.copy", "Copy"),
        copyAll: translate("chat.terminal.copyAll", "Copy all"),
        paste: translate("chat.terminal.paste", "Paste"),
        dismiss: translate("chat.terminal.dismiss", "Dismiss"),
      },
    });
  }, [send]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const msg = parseOutbound(event.nativeEvent.data);
      if (!msg) return;
      if (msg.type === "ready") {
        readyRef.current = true;
        setReady(true);
        flushPending();
        onReadyRef.current?.();
        send({ type: "fit" });
        sendLabels();
        return;
      }
      if (msg.type === "input") {
        onInputRef.current(msg.data);
        return;
      }
      if (msg.type === "resize") {
        onResizeRef.current?.(msg.cols, msg.rows);
        return;
      }
      if (msg.type === "copy") {
        copyToClipboard(msg.data);
        return;
      }
      if (msg.type === "paste-request") {
        pasteFromClipboard();
        return;
      }
      if (msg.type === "error") {
        setFailed(msg.message);
        return;
      }
    },
    [flushPending, send, sendLabels, copyToClipboard, pasteFromClipboard],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (
        Math.abs(width - layoutRef.current.width) < 1 &&
        Math.abs(height - layoutRef.current.height) < 1
      ) {
        return;
      }
      layoutRef.current = { width, height };
      if (readyRef.current) send({ type: "fit" });
    },
    [send],
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
    <View
      style={[styles.fill, isDark && styles.fillDark]}
      onLayout={handleLayout}
    >
      {html !== null && (
        <WebView
          key={reloadKey}
          ref={webRef}
          testID={testID}
          originWhitelist={[]}
          source={{ html }}
          androidLayerType="hardware"
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
