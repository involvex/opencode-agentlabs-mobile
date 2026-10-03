import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useConnections } from "../../src/stores/connections";
import { useEvents } from "../../src/stores/events";
import { useTheme } from "../../src/lib/theme";
import type { ConnectionType } from "../../src/lib/types";
import { probeConnection, shareReport } from "../../src/lib/diagnostics";
import { parseUrl } from "../../src/lib/diagnostics-classify";
import { buildAuth } from "../../src/lib/auth";
import * as SecureStore from "expo-secure-store";
import { useDensity, ds } from "../../src/lib/density";
import type BottomSheet from "@gorhom/bottom-sheet";
import { createClient, type Client } from "../../src/lib/sdk";
import {
  DirectorySwitcher,
  DirectoryBrowserSheet,
} from "../../src/components/chat";

// labelKey (not literal text): this is a module-level constant evaluated
// before i18next is guaranteed ready, so the label is resolved with t() at
// render time — same pattern as categoryMeta in src/lib/notifications.ts.
const CONNECTION_TYPES: {
  type: ConnectionType;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { type: "local", labelKey: "connection.shared.types.local", icon: "wifi" },
  { type: "tunnel", labelKey: "connection.shared.types.tunnel", icon: "globe" },
  { type: "cloud", labelKey: "connection.shared.types.cloud", icon: "cloud" },
];

export default function EditConnectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useTheme();
  const { t } = useTranslation();
  const density = useDensity();

  const {
    connections,
    updateConnection,
    removeConnection,
    testConnection,
    recentDirectories,
  } = useConnections();

  const connection = connections.find((c) => c.id === id);

  const [type, setType] = useState<ConnectionType>(connection?.type || "local");
  const [name, setName] = useState(connection?.name || "");
  const [url, setUrl] = useState(connection?.url || "");
  const [directory, setDirectory] = useState(connection?.directory || "");
  const [username, setUsername] = useState(connection?.username || "");
  const [password, setPassword] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Custom auth headers — loaded from SecureStore on mount, edited inline.
  const [headerEdits, setHeaderEdits] = useState<
    { key: string; value: string }[]
  >([]);
  const [showHeaders, setShowHeaders] = useState(false);

  // Directory picker (same DirectorySwitcher → DirectoryBrowserSheet flow as
  // the sessions tab). The sheets live outside the ScrollView at screen root.
  const dirSheetRef = useRef<BottomSheet>(null);
  const browserSheetRef = useRef<BottomSheet>(null);
  const [browseStartDir, setBrowseStartDir] = useState<string | null>(null);
  // Home directory of the server this form points at (for ~ expansion and as
  // a browse start fallback) — fetched lazily on first picker open. NOT the
  // active connection's serverHome: this connection may be a different server.
  const [pickerHome, setPickerHome] = useState<string | null>(null);
  // Stored password for browse clients. Loaded into a ref, never into the
  // password input (the form intentionally loads that field blank).
  const storedPasswordRef = useRef<string | null>(null);

  useEffect(() => {
    if (id && connection) {
      SecureStore.getItemAsync(`opencode_headers_${id}`)
        .then((raw) => {
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as Record<string, string>;
              setHeaderEdits(
                Object.entries(parsed).map(([key, value]) => ({ key, value })),
              );
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, [id, connection]);

  useEffect(() => {
    let cancelled = false;
    storedPasswordRef.current = null;
    if (!id) return;
    SecureStore.getItemAsync(`opencode_password_${id}`)
      .then((pw) => {
        if (!cancelled) storedPasswordRef.current = pw ?? null;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Client factory for the directory picker, bound to the connection THIS
  // form edits (form state + its stored secrets). The store's
  // clientForDirectory() would browse via the ACTIVE connection — wrong
  // server when editing a non-active connection.
  const buildClient = useCallback(
    (directory?: string): Client | null => {
      const baseUrl = url.trim();
      if (!parseUrl(baseUrl).valid) return null;
      const extraHeaders: Record<string, string> = {};
      for (const h of headerEdits) {
        const key = h.key.trim();
        if (key && h.value) extraHeaders[key] = h.value;
      }
      return createClient({
        baseUrl,
        directory,
        auth: buildAuth(username, password || storedPasswordRef.current),
        extraHeaders:
          Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
      });
    },
    [url, username, password, headerEdits],
  );

  const openDirectoryPicker = useCallback(() => {
    if (!parseUrl(url.trim()).valid) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterUrl"));
      return;
    }
    dirSheetRef.current?.expand();
    // Fill in the server home once (for ~ chips + browse start fallback).
    if (pickerHome) return;
    const probe = buildClient();
    if (!probe) return;
    probe.path
      .get()
      .then((paths) => setPickerHome(paths?.home ?? null))
      .catch(() => {});
  }, [url, pickerHome, buildClient, t]);

  const openBrowserSheet = useCallback(() => {
    setBrowseStartDir(directory || pickerHome || null);
    browserSheetRef.current?.expand();
  }, [directory, pickerHome]);

  const handleSwitchDirectory = useCallback((dir?: string) => {
    setDirectory(dir ?? "");
  }, []);

  const handleBrowserSelect = useCallback((dir: string) => {
    setDirectory(dir);
  }, []);

  // Reset local form state when the connection prop changes (e.g. list
  // updated).  Calling setState during render is the React-recommended
  // pattern for "adjusting state when a prop changes" — it avoids the
  // extra render cycle a useEffect would cause.
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevId, setPrevId] = useState(id);
  if (prevId !== id && connection) {
    setPrevId(id);
    setType(connection.type);
    setName(connection.name);
    setUrl(connection.url);
    setDirectory(connection.directory || "");
    setUsername(connection.username || "");
    // Different connection — its server home may differ too.
    setPickerHome(null);
  }

  if (!connection) {
    return (
      <View
        style={[
          styles.container,
          isDark && styles.containerDark,
          styles.center,
        ]}
      >
        <Text style={[styles.errorText, isDark && styles.textDark]}>
          {t("connection.edit.notFound")}
        </Text>
      </View>
    );
  }

  const handleTest = async () => {
    if (!url.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterUrl"));
      return;
    }
    if (!parseUrl(url).valid) {
      Alert.alert(
        t("connection.shared.alerts.invalidUrlTitle"),
        t("connection.shared.alerts.invalidUrlMessage"),
      );
      return;
    }

    setIsTesting(true);
    // The password field loads blank (stored passwords are never read back
    // into the form). A blank field means "keep the existing password", not
    // "test with no password" — fall back to the stored secret so Test does
    // not 401 against a password-protected server the saved connection
    // already reaches. A typed value always wins (password rotation). The
    // ref may not have loaded yet on a fast tap, so read SecureStore
    // directly as a fallback.
    let effectivePassword: string | undefined =
      password || storedPasswordRef.current || undefined;
    if (!effectivePassword) {
      try {
        effectivePassword =
          (await SecureStore.getItemAsync(
            `opencode_password_${connection.id}`,
          )) || undefined;
      } catch {
        // ignore — test proceeds unauthenticated and reports the real error
      }
    }
    const result = await testConnection(
      {
        id: connection.id,
        name: name || "Test",
        type,
        url: url.trim(),
        directory: directory.trim() || undefined,
        username: username.trim() || undefined,
      },
      "edit_test",
      effectivePassword,
    );

    if (result.ok) {
      setIsTesting(false);
      Alert.alert(
        t("connection.edit.alerts.successTitle"),
        t("connection.edit.alerts.successMessage"),
      );
      return;
    }

    // Failed: run active diagnostics, offer a shareable report.
    // Use the same effective password as the test above — probing with a
    // blank password when a stored one exists would always 401 and
    // misreport a working server as "auth failed".
    const report = await probeConnection(
      url.trim(),
      buildAuth(username, effectivePassword),
    );
    setIsTesting(false);

    Alert.alert(
      t("connection.shared.alerts.connectionFailedTitle"),
      t("connection.edit.alerts.connectionFailedMessage", {
        summary: report.summary,
        detail: result.error || t("connection.edit.alerts.noDetail"),
      }),
      [
        { text: t("common.ok"), style: "cancel" },
        { text: t("common.shareReport"), onPress: () => shareReport(report) },
      ],
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterName"));
      return;
    }
    if (!url.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterUrl"));
      return;
    }
    if (!parseUrl(url).valid) {
      Alert.alert(
        t("connection.shared.alerts.invalidUrlTitle"),
        t("connection.shared.alerts.invalidUrlMessage"),
      );
      return;
    }

    setIsSaving(true);
    try {
      const invalidHeader = headerEdits.find((h) => /[\r\n]/.test(h.key));
      if (invalidHeader) {
        setIsSaving(false);
        Alert.alert(
          t("common.error"),
          t(
            "connection.edit.alerts.invalidHeaderKey",
            "Header names cannot contain newlines.",
          ),
        );
        return;
      }

      await updateConnection(
        connection.id,
        {
          name: name.trim(),
          type,
          url: url.trim(),
          directory: directory.trim() || undefined,
          username: username.trim() || undefined,
          authHeaderKeys: headerEdits
            .map((h) => h.key.trim())
            .filter((k) => k.length > 0),
        },
        // Empty = keep existing password (the field loads blank); a typed value
        // rotates it in SecureStore.
        password || undefined,
      );

      // Persist custom auth headers to SecureStore (separate from the main
      // connection record, since they're sensitive tokens/keys).
      const headersToSave: Record<string, string> = {};
      for (const h of headerEdits) {
        const k = h.key.trim();
        if (k && h.value) headersToSave[k] = h.value;
      }
      if (Object.keys(headersToSave).length > 0) {
        await SecureStore.setItemAsync(
          `opencode_headers_${connection.id}`,
          JSON.stringify(headersToSave),
        );
      } else {
        await SecureStore.deleteItemAsync(`opencode_headers_${connection.id}`);
      }
      // If this was the active connection, the SSE loop may have stopped
      // retrying after a prior 401 (see events.ts) — reconnect now with the
      // freshly saved credentials instead of leaving the user stuck until
      // they relaunch the app.
      if (useConnections.getState().activeConnection?.id === connection.id) {
        useEvents.getState().connect();
      }
      setIsSaving(false);
      router.back();
    } catch {
      setIsSaving(false);
      Alert.alert(
        t("connection.shared.alerts.saveFailedTitle"),
        t("connection.shared.alerts.saveFailedMessage"),
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t("connection.edit.alerts.deleteTitle"),
      t("connection.edit.alerts.deleteMessage", { name: connection.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await removeConnection(connection.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView
        style={[styles.container, isDark && styles.containerDark]}
        contentContainerStyle={[
          styles.content,
          { ...ds({ padding: 16 }, density) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Connection Type */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          {t("connection.shared.connectionType")}
        </Text>
        <View style={styles.typeContainer}>
          {CONNECTION_TYPES.map((opt) => (
            <TouchableOpacity
              key={opt.type}
              style={[
                styles.typeOption,
                isDark && styles.typeOptionDark,
                type === opt.type && styles.typeOptionSelected,
                type === opt.type && isDark && styles.typeOptionSelectedDark,
              ]}
              onPress={() => setType(opt.type)}
            >
              <Ionicons
                name={opt.icon}
                size={20}
                color={
                  type === opt.type
                    ? isDark
                      ? "#0a0a0a"
                      : "#ffffff"
                    : isDark
                      ? "#888888"
                      : "#666666"
                }
              />
              <Text
                style={[
                  styles.typeLabel,
                  isDark && styles.textDark,
                  type === opt.type && styles.typeLabelSelected,
                  type === opt.type && isDark && styles.typeLabelSelectedDark,
                ]}
              >
                {t(opt.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Name */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          {t("connection.shared.name")}
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t("connection.shared.namePlaceholder")}
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={name}
          onChangeText={setName}
        />

        {/* URL */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          {t("connection.shared.serverUrl")}
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="http://192.168.1.100:4096"
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {/* Directory */}
        <Text style={[styles.label, isDark && styles.labelDark]}>
          {t("connection.shared.directoryOptional")}
        </Text>
        <View style={styles.directoryRow}>
          <TextInput
            style={[
              styles.input,
              styles.directoryInput,
              isDark && styles.inputDark,
            ]}
            placeholder="/path/to/project"
            placeholderTextColor={isDark ? "#666666" : "#999999"}
            value={directory}
            onChangeText={setDirectory}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.directoryPickBtn,
              isDark && styles.directoryPickBtnDark,
            ]}
            onPress={openDirectoryPicker}
            accessibilityRole="button"
            accessibilityLabel={t("connection.shared.directoryPickerLabel")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={20}
              color={isDark ? "#c4b5fd" : "#6d28d9"}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, isDark && styles.hintDark]}>
          {t("connection.edit.directoryHint")}
        </Text>

        {/* Auth */}
        <Text
          style={[
            styles.sectionTitle,
            { ...ds({ fontSize: 18 }, density) },
            isDark && styles.textDark,
          ]}
        >
          {t("connection.shared.authentication")}
        </Text>

        <Text
          style={[
            styles.label,
            { ...ds({ fontSize: 14 }, density) },
            isDark && styles.labelDark,
          ]}
        >
          {t("connection.shared.username")}
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="admin"
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text
          style={[
            styles.label,
            { ...ds({ fontSize: 14 }, density) },
            isDark && styles.labelDark,
          ]}
        >
          {t("connection.edit.passwordLabel")}
        </Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="••••••••"
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Custom Auth Headers */}
        <View style={styles.headerSection}>
          <TouchableOpacity
            style={styles.headerToggle}
            onPress={() => setShowHeaders(!showHeaders)}
          >
            <Text style={[styles.label, isDark && styles.labelDark]}>
              {t("connection.shared.customHeaders")}
            </Text>
            <Ionicons
              name={showHeaders ? "chevron-up" : "chevron-down"}
              size={20}
              color={isDark ? "#ffffff" : "#0a0a0a"}
            />
          </TouchableOpacity>

          {showHeaders && (
            <View style={styles.headerList}>
              {headerEdits.map((h, idx) => (
                <View key={idx} style={styles.headerRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.headerKey,
                      isDark && styles.inputDark,
                    ]}
                    placeholder={t("connection.shared.headerKey")}
                    placeholderTextColor={isDark ? "#666666" : "#999999"}
                    value={h.key}
                    onChangeText={(val) =>
                      setHeaderEdits(
                        headerEdits.map((e, i) =>
                          i === idx ? { ...e, key: val } : e,
                        ),
                      )
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      styles.headerValue,
                      isDark && styles.inputDark,
                    ]}
                    placeholder={t("connection.shared.headerValue")}
                    placeholderTextColor={isDark ? "#666666" : "#999999"}
                    value={h.value}
                    onChangeText={(val) =>
                      setHeaderEdits(
                        headerEdits.map((e, i) =>
                          i === idx ? { ...e, value: val } : e,
                        ),
                      )
                    }
                    secureTextEntry
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setHeaderEdits(headerEdits.filter((_, i) => i !== idx))
                    }
                    style={styles.headerRemoveBtn}
                  >
                    <Ionicons
                      name="remove-circle"
                      size={20}
                      color={isDark ? "#ef4444" : "#ef4444"}
                    />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addHeaderBtn, isDark && styles.addHeaderBtnDark]}
                onPress={() =>
                  setHeaderEdits([...headerEdits, { key: "", value: "" }])
                }
              >
                <Ionicons
                  name="add"
                  size={16}
                  color={isDark ? "#ffffff" : "#0a0a0a"}
                />
                <Text style={[styles.addHeaderText, isDark && styles.textDark]}>
                  {t("connection.shared.addHeader")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Actions */}
        <View
          style={[
            styles.actions,
            { ...ds({ marginTop: 32, gap: 12 }, density) },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.testButton,
              { ...ds({ padding: 16, gap: 8 }, density) },
              isDark && styles.testButtonDark,
            ]}
            onPress={handleTest}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator
                size="small"
                color={isDark ? "#ffffff" : "#0a0a0a"}
              />
            ) : (
              <>
                <Ionicons
                  name="pulse"
                  size={20}
                  color={isDark ? "#ffffff" : "#0a0a0a"}
                />
                <Text
                  style={[
                    styles.testButtonText,
                    { ...ds({ fontSize: 16 }, density) },
                    isDark && styles.textDark,
                  ]}
                >
                  {t("connection.edit.testButton")}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              { ...ds({ padding: 16 }, density) },
              isDark && styles.saveButtonDark,
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator
                size="small"
                color={isDark ? "#0a0a0a" : "#ffffff"}
              />
            ) : (
              <Text
                style={[
                  styles.saveButtonText,
                  { ...ds({ fontSize: 16 }, density) },
                  isDark && styles.saveButtonTextDark,
                ]}
              >
                {t("connection.edit.saveButton")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              { ...ds({ padding: 16, gap: 8 }, density) },
            ]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text
              style={[
                styles.deleteButtonText,
                { ...ds({ fontSize: 16 }, density) },
              ]}
            >
              {t("connection.edit.deleteButton")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Directory switcher + browsable folder picker — the same flow as the
          sessions tab, but the browse client targets the connection THIS
          form edits (never the active connection's client). */}
      <DirectorySwitcher
        sheetRef={dirSheetRef}
        current={directory || undefined}
        recents={recentDirectories}
        serverHome={pickerHome}
        isDark={isDark}
        onSwitch={handleSwitchDirectory}
        onBrowse={openBrowserSheet}
      />
      <DirectoryBrowserSheet
        sheetRef={browserSheetRef}
        startDirectory={browseStartDir}
        clientForDirectory={buildClient}
        isDark={isDark}
        onSelect={handleBrowserSelect}
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
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  errorText: {
    fontSize: 16,
    color: "#666666",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
    marginTop: 16,
    marginBottom: 8,
  },
  labelDark: {
    color: "#ffffff",
  },
  typeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    gap: 6,
  },
  typeOptionDark: {
    backgroundColor: "#1a1a1a",
  },
  typeOptionSelected: {
    backgroundColor: "#0a0a0a",
  },
  typeOptionSelectedDark: {
    backgroundColor: "#ffffff",
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666666",
  },
  textDark: {
    color: "#ffffff",
  },
  typeLabelSelected: {
    color: "#ffffff",
  },
  typeLabelSelectedDark: {
    color: "#0a0a0a",
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0a0a0a",
  },
  inputDark: {
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
  },
  directoryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  directoryInput: {
    flex: 1,
  },
  directoryPickBtn: {
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#f5f5f5",
  },
  directoryPickBtnDark: {
    borderColor: "#333333",
    backgroundColor: "#1a1a1a",
  },
  hint: {
    fontSize: 13,
    color: "#666666",
    marginTop: 6,
  },
  hintDark: {
    color: "#888888",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0a0a0a",
    marginTop: 32,
    marginBottom: 8,
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  testButtonDark: {
    borderColor: "#333333",
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  saveButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#0a0a0a",
  },
  saveButtonDark: {
    backgroundColor: "#ffffff",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  saveButtonTextDark: {
    color: "#0a0a0a",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },

  headerSection: {
    marginBottom: 16,
  },
  headerToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  headerList: {
    gap: 8,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerKey: {
    flex: 1,
    fontSize: 13,
  },
  headerValue: {
    flex: 1,
    fontSize: 13,
  },
  headerRemoveBtn: {
    padding: 4,
  },
  addHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  addHeaderBtnDark: {
    backgroundColor: "#2a2a2a",
  },
  addHeaderText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0a0a0a",
  },
});
