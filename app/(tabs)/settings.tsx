import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { useAuth } from "../../src/stores/auth";
import { useSettings } from "../../src/stores/settings";
import { useTheme, PRESET_ACCENT_COLORS } from "../../src/lib/theme";
import { useEvents } from "../../src/stores/events";
import { useSessions } from "../../src/stores/sessions";
import { useConnections } from "../../src/stores/connections";
import * as Clipboard from "expo-clipboard";
import {
  categories,
  categoryMeta,
  setup as setupNotifications,
  granted as notificationsGranted,
} from "../../src/lib/notifications";
import type { Category } from "../../src/lib/notifications";
import {
  hasTelemetryConsent,
  setTelemetryConsent,
} from "../../src/lib/telemetry";
import { PRIVACY_POLICY_URL } from "../../src/lib/links";
import type { LocalePreference } from "../../src/lib/i18n/locale-resolve";

function SettingRow({
  icon,
  label,
  description,
  isDark,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  isDark: boolean;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
      <View style={[styles.settingIcon, isDark && styles.settingIconDark]}>
        <Ionicons
          name={icon}
          size={22}
          color={isDark ? "#ffffff" : "#0a0a0a"}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, isDark && styles.textDark]}>
          {label}
        </Text>
        {description && (
          <Text style={[styles.settingDescription, isDark && styles.metaDark]}>
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
}

function SettingSection({
  title,
  children,
  isDark,
}: {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
        {title}
      </Text>
      <View
        style={[styles.sectionContent, isDark && styles.sectionContentDark]}
      >
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const isDark = useTheme();
  const { t } = useTranslation();

  const { settings, hasBiometrics, updateSettings, lock } = useAuth();
  const {
    notifications,
    setNotification,
    locale,
    setLocale,
    terminalFontSize,
    setTerminalFontSize,
    debugMode,
    setDebugMode,
    density,
    setDensity,
    theme,
    setTheme,
    accentColor,
    setAccentColor,
  } = useSettings();
  const reconnect = useEvents((s) => s.connect);
  const [osGranted, setOsGranted] = useState<boolean | null>(null);
  const [telemetryUpdating, setTelemetryUpdating] = useState(false);

  // Telemetry consent: hasTelemetryConsent() returns null (unknown), true, or false.
  // We initialise local state from in-memory value; updates call setTelemetryConsent().
  const [crashReporting, setCrashReporting] = useState<boolean>(
    hasTelemetryConsent() ?? false,
  );

  const handleCrashReportingToggle = useCallback(
    async (value: boolean) => {
      setTelemetryUpdating(true);
      try {
        await setTelemetryConsent(value);
        setCrashReporting(value);
      } catch {
        setCrashReporting(hasTelemetryConsent() ?? false);
        Alert.alert(
          t("settings.alerts.privacyNotSavedTitle"),
          t("settings.alerts.privacyNotSavedMessage"),
        );
      } finally {
        setTelemetryUpdating(false);
      }
    },
    [t],
  );

  // Check OS permission state on first toggle attempt
  const handleToggle = useCallback(
    async (category: Category, enabled: boolean) => {
      if (enabled) {
        const ok = await setupNotifications();
        setOsGranted(ok);
        if (!ok) {
          Alert.alert(
            t("settings.alerts.notificationsDisabledTitle"),
            t("settings.alerts.notificationsDisabledMessage"),
          );
          return;
        }
      }
      setNotification(category, enabled);
    },
    [setNotification, t],
  );

  // Lazy-check OS permission for status display
  if (osGranted === null) {
    notificationsGranted()
      .then(setOsGranted)
      .catch(() => setOsGranted(false));
  }

  const localeLabels: Record<LocalePreference, string> = useMemo(
    () => ({
      system: t("settings.language.system"),
      en: t("settings.language.en"),
      "zh-Hans": t("settings.language.zhHans"),
    }),
    [t],
  );

  const handleLanguagePress = useCallback(() => {
    Alert.alert(t("settings.language.title"), undefined, [
      { text: localeLabels.system, onPress: () => setLocale("system") },
      { text: localeLabels.en, onPress: () => setLocale("en") },
      { text: localeLabels["zh-Hans"], onPress: () => setLocale("zh-Hans") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }, [t, setLocale, localeLabels]);

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={styles.content}
    >
      <SettingSection title={t("settings.sections.security")} isDark={isDark}>
        <SettingRow
          icon="finger-print"
          label={t("settings.security.biometricOpen.label")}
          description={
            hasBiometrics
              ? t("settings.security.biometricOpen.descriptionEnabled")
              : t("settings.security.biometricOpen.descriptionUnavailable")
          }
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometric}
              onValueChange={(value) =>
                updateSettings({ requireBiometric: value })
              }
              disabled={!hasBiometrics}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          }
        />
        <SettingRow
          icon="lock-closed"
          label={t("settings.security.biometricSend.label")}
          description={t("settings.security.biometricSend.description")}
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometricForMessages}
              onValueChange={(value) =>
                updateSettings({ requireBiometricForMessages: value })
              }
              disabled={!hasBiometrics || !settings.requireBiometric}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          }
        />
        {settings.requireBiometric && (
          <SettingRow
            icon="exit"
            label={t("settings.security.lockNow.label")}
            description={t("settings.security.lockNow.description")}
            isDark={isDark}
            onPress={lock}
            right={
              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? "#666666" : "#999999"}
              />
            }
          />
        )}
      </SettingSection>

      <SettingSection
        title={t("settings.sections.notifications")}
        isDark={isDark}
      >
        {categories.map((category) => {
          const meta = categoryMeta[category];
          return (
            <SettingRow
              key={category}
              icon={meta.icon as keyof typeof Ionicons.glyphMap}
              label={t(meta.labelKey)}
              description={t(meta.descriptionKey)}
              isDark={isDark}
              right={
                <Switch
                  value={notifications[category]}
                  onValueChange={(value) => handleToggle(category, value)}
                  trackColor={{ false: "#767577", true: "#22c55e" }}
                />
              }
            />
          );
        })}
        {osGranted === false && (
          <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
            <Text
              style={[
                styles.settingDescription,
                { color: "#ef4444", paddingLeft: 48 },
              ]}
            >
              {t("settings.notifications.disabledNotice")}
            </Text>
          </View>
        )}
      </SettingSection>

      <SettingSection title={t("settings.sections.privacy")} isDark={isDark}>
        <SettingRow
          icon="shield-checkmark"
          label={t("settings.privacy.crashReporting.label")}
          description={t("settings.privacy.crashReporting.description")}
          isDark={isDark}
          right={
            <Switch
              value={crashReporting}
              onValueChange={handleCrashReportingToggle}
              disabled={telemetryUpdating}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          }
        />
        <SettingRow
          icon="document-text"
          label={t("settings.privacy.privacyPolicy.label")}
          description={t("settings.privacy.privacyPolicy.description")}
          isDark={isDark}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          right={
            <Ionicons
              name="open-outline"
              size={20}
              color={isDark ? "#666666" : "#999999"}
            />
          }
        />
      </SettingSection>

      <SettingSection title={t("settings.sections.about")} isDark={isDark}>
        <SettingRow
          icon="language"
          label={t("settings.language.label")}
          description={localeLabels[locale]}
          isDark={isDark}
          onPress={handleLanguagePress}
          right={
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#666666" : "#999999"}
            />
          }
        />
        <SettingRow
          icon="text"
          label={t("settings.terminal.fontSize.label")}
          description={t("settings.terminal.fontSize.description", {
            size: terminalFontSize,
          })}
          isDark={isDark}
          right={
            <View style={styles.fontSizeControls}>
              <TouchableOpacity
                onPress={() => setTerminalFontSize(terminalFontSize - 1)}
                disabled={terminalFontSize <= 10}
                style={[
                  styles.fontSizeButton,
                  terminalFontSize <= 10 && styles.fontSizeButtonDisabled,
                ]}
              >
                <Ionicons name="remove" size={18} color="#ffffff" />
              </TouchableOpacity>
              <Text style={[styles.fontSizeValue, isDark && styles.textDark]}>
                {terminalFontSize}
              </Text>
              <TouchableOpacity
                onPress={() => setTerminalFontSize(terminalFontSize + 1)}
                disabled={terminalFontSize >= 18}
                style={[
                  styles.fontSizeButton,
                  terminalFontSize >= 18 && styles.fontSizeButtonDisabled,
                ]}
              >
                <Ionicons name="add" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          }
        />
        <SettingRow
          icon="resize-outline"
          label={t("settings.appearance.density.label")}
          description={t("settings.appearance.density.description", {
            value: density,
          })}
          isDark={isDark}
          right={
            <View style={styles.densityControls}>
              {(["compact", "default", "comfortable"] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.densityButton,
                    density === d && styles.densityButtonActive,
                    isDark && styles.densityButtonDark,
                    density === d && isDark && styles.densityButtonActiveDark,
                  ]}
                  onPress={() => setDensity(d)}
                >
                  <Text
                    style={[
                      styles.densityButtonText,
                      density === d && styles.densityButtonTextActive,
                      isDark && styles.densityButtonTextDark,
                    ]}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        <SettingRow
          icon="moon-outline"
          label={t("settings.appearance.theme.label")}
          description={t("settings.appearance.theme.description", {
            value: theme,
          })}
          isDark={isDark}
          right={
            <View style={styles.densityControls}>
              {(["light", "dark", "auto"] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.densityButton,
                    theme === d && styles.densityButtonActive,
                    isDark && styles.densityButtonDark,
                    theme === d && isDark && styles.densityButtonActiveDark,
                  ]}
                  onPress={() => setTheme(d)}
                >
                  <Ionicons
                    name={
                      d === "light"
                        ? "sunny-outline"
                        : d === "dark"
                          ? "moon-outline"
                          : "phone-portrait-outline"
                    }
                    size={16}
                    color={
                      theme === d ? "#ffffff" : isDark ? "#aaaaaa" : "#666666"
                    }
                  />
                  <Text
                    style={[
                      styles.densityButtonText,
                      theme === d && styles.densityButtonTextActive,
                      isDark && styles.densityButtonTextDark,
                    ]}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        <SettingRow
          icon="palette-outline"
          label={t("settings.appearance.accentColor.label")}
          description={t("settings.appearance.accentColor.description")}
          isDark={isDark}
          right={
            <View style={styles.accentRow}>
              {PRESET_ACCENT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.accentSwatch,
                    { backgroundColor: color },
                    accentColor === color && styles.accentSwatchSelected,
                  ]}
                  onPress={() => setAccentColor(color)}
                />
              ))}
            </View>
          }
        />
      </SettingSection>

      <SettingSection title={t("settings.sections.about")} isDark={isDark}>
        <SettingRow
          icon="information-circle"
          label={t("settings.about.version")}
          description="1.0.0"
          isDark={isDark}
        />
        <SettingRow
          icon="logo-github"
          label={t("settings.about.github.label")}
          description={t("settings.about.github.description")}
          isDark={isDark}
          onPress={() =>
            Linking.openURL("https://github.com/anomalyco/opencode")
          }
          right={
            <Ionicons
              name="open-outline"
              size={20}
              color={isDark ? "#666666" : "#999999"}
            />
          }
        />
        <SettingRow
          icon="document-text"
          label={t("settings.about.docs.label")}
          description={t("settings.about.docs.description")}
          isDark={isDark}
          onPress={() => Linking.openURL("https://opencode.ai/docs")}
          right={
            <Ionicons
              name="open-outline"
              size={20}
              color={isDark ? "#666666" : "#999999"}
            />
          }
        />
      </SettingSection>

      <SettingSection title={t("settings.sections.developer")} isDark={isDark}>
        <SettingRow
          icon="bug-outline"
          label={t("settings.developer.debugMode.label")}
          description={t("settings.developer.debugMode.description")}
          isDark={isDark}
          right={
            <Switch
              value={debugMode}
              onValueChange={setDebugMode}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          }
        />
        {debugMode && (
          <>
            <SettingRow
              icon="eye-outline"
              label={t("settings.developer.sseInspector.label")}
              description={t("settings.developer.sseInspector.description")}
              isDark={isDark}
              onPress={() => router.push("/debug/sse")}
              right={
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={isDark ? "#666666" : "#999999"}
                />
              }
            />
            <SettingRow
              icon="refresh-outline"
              label={t("settings.developer.forceReconnect.label")}
              description={t("settings.developer.forceReconnect.description")}
              isDark={isDark}
              onPress={() => {
                const client = useConnections.getState().client;
                if (!client) {
                  Alert.alert(
                    t("settings.developer.reconnectAlert.title"),
                    t("settings.developer.reconnectAlert.message"),
                  );
                  return;
                }
                reconnect();
                Alert.alert(
                  t("settings.developer.reconnectAlert.title"),
                  t("settings.developer.reconnectAlert.message"),
                );
              }}
            />
            <SettingRow
              icon="document-text-outline"
              label={t("settings.developer.dumpState.label")}
              description={t("settings.developer.dumpState.description")}
              isDark={isDark}
              onPress={async () => {
                const sessions = useSessions.getState();
                const connections = useConnections.getState();
                const events = useEvents.getState();
                const dump = {
                  sessions: {
                    sessions: sessions.sessions,
                    currentSession: sessions.currentSession,
                    sending: sessions.sending,
                  },
                  connections: {
                    activeConnection: connections.activeConnection,
                    connectionIds: connections.connections.map((c) => c.id),
                  },
                  events: {
                    connected: events.connected,
                    authError: events.authError,
                    reconnectAttempts: events.reconnectAttempts,
                    lastDisconnectAt: events.lastDisconnectAt,
                    sessionStatus: events.sessionStatus,
                    statusText: events.statusText,
                  },
                };
                const json = JSON.stringify(dump, null, 2);
                await Clipboard.setStringAsync(json);
                Alert.alert(
                  t("settings.developer.dumpAlert.title"),
                  t("settings.developer.dumpAlert.message"),
                );
              }}
            />
          </>
        )}
      </SettingSection>

      <View style={styles.footer}>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>
          {t("settings.footer.appName")}
        </Text>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>
          {t("settings.footer.tagline")}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  containerDark: {
    backgroundColor: "#0a0a0a",
  },
  content: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
    marginLeft: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionTitleDark: {
    color: "#888888",
  },
  sectionContent: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },
  sectionContentDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  settingRowDark: {
    borderBottomColor: "#2a2a2a",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingIconDark: {
    backgroundColor: "#2a2a2a",
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: "#0a0a0a",
  },
  textDark: {
    color: "#ffffff",
  },
  settingDescription: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  metaDark: {
    color: "#888888",
  },
  footer: {
    alignItems: "center",
    padding: 32,
  },
  footerText: {
    fontSize: 13,
    color: "#999999",
    textAlign: "center",
  },
  densityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  densityButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  densityButtonActive: {
    backgroundColor: "#0a0a0a",
  },
  densityButtonDark: {
    borderColor: "#2a2a2a",
  },
  densityButtonActiveDark: {
    backgroundColor: "#ffffff",
  },
  densityButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666666",
  },
  densityButtonTextActive: {
    color: "#ffffff",
  },
  densityButtonTextDark: {
    color: "#888888",
  },
  fontSizeControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fontSizeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
  },
  fontSizeButtonDisabled: {
    backgroundColor: "#cccccc",
  },
  fontSizeValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0a0a0a",
    minWidth: 24,
    textAlign: "center",
  },

  accentRow: {
    flexDirection: "row",
    gap: 8,
  },
  accentSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  accentSwatchSelected: {
    borderWidth: 2,
    borderColor: "#0a0a0a",
  },
});
