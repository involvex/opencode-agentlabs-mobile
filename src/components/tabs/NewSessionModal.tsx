import { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Project } from "../../lib/sdk";

export interface NewSessionModalProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  accent: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  isCreating: boolean;
  customDir: string;
  onCustomDirChange: (text: string) => void;
  templateName: string;
  onTemplateNameChange: (text: string) => void;
  selectedTemplateID: string | null;
  onSelectTemplateID: (id: string | null) => void;
  templates: {
    id: string;
    name: string;
    prompt: string;
    model?: unknown;
    agent?: string;
    directory?: string;
  }[];
  currentProject: Project | null;
  activeConnection?: { directory?: string } | null;
  onCreate: (dir?: string) => Promise<void>;
  onSaveTemplate: () => Promise<void>;
  onDeleteTemplate: (id: string) => void;
  onBrowse: (startDir: string | null, mode: "create" | "switch") => void;
  serverHome?: string | null;
  recentDirectories: string[];
  serverProjects: Project[];
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalContentDark: {
    backgroundColor: "#1a1a1a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  textDark: {
    color: "#ffffff",
  },
  metaDark: {
    color: "#888888",
  },
  modalScrollBody: {
    maxHeight: 420,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  modalDirBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
  },
  modalDirBoxDark: {
    backgroundColor: "#2a2a2a",
  },
  modalDirText: {
    fontSize: 15,
    color: "#0a0a0a",
    flex: 1,
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    marginBottom: 6,
  },
  projectRowDark: {
    backgroundColor: "#2a2a2a",
  },
  projectRowActive: {
    backgroundColor: "#f5f3ff",
  },
  projectRowContent: {
    flex: 1,
  },
  projectRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  projectRowPath: {
    fontSize: 11,
    color: "#999999",
    marginTop: 1,
  },
  pathChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  pathChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e8e5f0",
    borderRadius: 16,
  },
  pathChipDark: {
    backgroundColor: "#2a2040",
  },
  pathChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6d28d9",
  },
  pathChipTextDark: {
    color: "#c4b5fd",
  },
  modalInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0a0a0a",
  },
  modalInputDark: {
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  modalSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  templateRowContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  templatePrompt: {
    fontSize: 12,
    color: "#999999",
    marginTop: 2,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  modalButtonPrimary: {
    backgroundColor: "#0a0a0a",
  },
  modalButtonPrimaryDark: {
    backgroundColor: "#ffffff",
  },
  modalButtonSecondary: {
    backgroundColor: "#f5f5f5",
  },
  modalButtonSecondaryDark: {
    backgroundColor: "#2a2a2a",
  },
  modalButtonFull: {
    width: "100%",
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  modalButtonTextPrimaryDark: {
    color: "#0a0a0a",
  },
  modalButtonTextSecondary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  modalButtonTextSecondaryDark: {
    color: "#ffffff",
  },
});

export function NewSessionModal({
  visible,
  onClose,
  isDark,
  accent,
  t,
  isCreating,
  customDir,
  onCustomDirChange,
  templateName,
  onTemplateNameChange,
  selectedTemplateID,
  onSelectTemplateID,
  templates,
  currentProject,
  activeConnection,
  onCreate,
  onSaveTemplate,
  onDeleteTemplate,
  onBrowse,
  serverHome,
  recentDirectories,
  serverProjects,
}: NewSessionModalProps) {
  const handleSaveTemplate = useCallback(async () => {
    await onSaveTemplate();
  }, [onSaveTemplate]);

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      onDeleteTemplate(id);
      if (selectedTemplateID === id) {
        onSelectTemplateID(null);
      }
    },
    [onDeleteTemplate, selectedTemplateID, onSelectTemplateID],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.modalDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.textDark]}>
              {t("sessionsList.newSessionModal.title")}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close"
                size={24}
                color={isDark ? "#ffffff" : "#0a0a0a"}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollBody}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.modalLabel, isDark && styles.metaDark]}>
              {t("sessionsList.newSessionModal.currentProjectLabel")}
            </Text>
            <TouchableOpacity
              style={[styles.modalDirBox, isDark && styles.modalDirBoxDark]}
              onPress={() => onCreate()}
              disabled={isCreating}
            >
              <Ionicons name="folder" size={20} color={accent} />
              <Text
                style={[styles.modalDirText, isDark && styles.textDark]}
                numberOfLines={2}
              >
                {currentProject?.path?.absolute ||
                  activeConnection?.directory ||
                  t("sessionsList.newSessionModal.serverDefault")}
              </Text>
              <Ionicons name="arrow-forward-circle" size={20} color={accent} />
            </TouchableOpacity>

            {recentDirectories.length > 0 && (
              <>
                <Text
                  style={[
                    styles.modalLabel,
                    isDark && styles.metaDark,
                    { marginTop: 16 },
                  ]}
                >
                  {t("sessionsList.newSessionModal.recentProjectsLabel")}
                </Text>
                {recentDirectories.map((dir) => {
                  const short = dir.split("/").filter(Boolean).pop() || dir;
                  const isCurrent =
                    dir ===
                    (currentProject?.path?.absolute ||
                      activeConnection?.directory);
                  return (
                    <TouchableOpacity
                      key={dir}
                      style={[
                        styles.projectRow,
                        isDark && styles.projectRowDark,
                        isCurrent && styles.projectRowActive,
                      ]}
                      onPress={() => onCreate(dir)}
                      disabled={isCreating}
                    >
                      <Ionicons
                        name="folder-outline"
                        size={18}
                        color={
                          isCurrent ? accent : isDark ? "#888888" : "#666666"
                        }
                      />
                      <View style={styles.projectRowContent}>
                        <Text
                          style={[
                            styles.projectRowName,
                            isDark && styles.textDark,
                            isCurrent && { color: accent },
                          ]}
                          numberOfLines={1}
                        >
                          {short}
                        </Text>
                        <Text
                          style={[
                            styles.projectRowPath,
                            isDark && styles.metaDark,
                          ]}
                          numberOfLines={1}
                        >
                          {dir}
                        </Text>
                      </View>
                      {isCurrent && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={accent}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {serverProjects.filter(
              (p) => p.path?.absolute !== currentProject?.path?.absolute,
            ).length > 0 && (
              <>
                <Text
                  style={[
                    styles.modalLabel,
                    isDark && styles.metaDark,
                    { marginTop: 16 },
                  ]}
                >
                  {t("sessionsList.newSessionModal.serverProjectsLabel")}
                </Text>
                {serverProjects
                  .filter(
                    (p) => p.path?.absolute !== currentProject?.path?.absolute,
                  )
                  .map((p) => {
                    const short =
                      p.name ||
                      p.path?.absolute?.split("/").filter(Boolean).pop() ||
                      p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.projectRow,
                          isDark && styles.projectRowDark,
                        ]}
                        onPress={() => onCreate(p.path?.absolute)}
                        disabled={isCreating}
                      >
                        <Ionicons
                          name="code-slash-outline"
                          size={18}
                          color={isDark ? "#888888" : "#666666"}
                        />
                        <View style={styles.projectRowContent}>
                          <Text
                            style={[
                              styles.projectRowName,
                              isDark && styles.textDark,
                            ]}
                            numberOfLines={1}
                          >
                            {short}
                          </Text>
                          {p.path?.absolute && (
                            <Text
                              style={[
                                styles.projectRowPath,
                                isDark && styles.metaDark,
                              ]}
                              numberOfLines={1}
                            >
                              {p.path.absolute}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.projectRow,
                isDark && styles.projectRowDark,
                { marginTop: 16 },
              ]}
              onPress={() =>
                onBrowse(
                  currentProject?.path?.absolute ||
                    activeConnection?.directory ||
                    null,
                  "create",
                )
              }
              disabled={isCreating}
            >
              <Ionicons name="folder-open-outline" size={18} color={accent} />
              <View style={styles.projectRowContent}>
                <Text
                  style={[styles.projectRowName, isDark && styles.textDark]}
                >
                  {t("sessionsList.newSessionModal.browseFoldersLabel")}
                </Text>
                <Text
                  style={[styles.projectRowPath, isDark && styles.metaDark]}
                >
                  {t("sessionsList.newSessionModal.browseFoldersHint")}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={isDark ? "#666666" : "#999999"}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.modalLabel,
                isDark && styles.metaDark,
                { marginTop: 16 },
              ]}
            >
              {t("sessionsList.newSessionModal.enterPathLabel")}
            </Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              placeholder={
                serverHome ? `${serverHome}/...` : "/path/to/project"
              }
              placeholderTextColor={isDark ? "#666666" : "#999999"}
              value={customDir}
              onChangeText={onCustomDirChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {serverHome && (
              <View style={styles.pathChips}>
                <TouchableOpacity
                  style={[styles.pathChip, isDark && styles.pathChipDark]}
                  onPress={() => onCustomDirChange(serverHome)}
                >
                  <Text
                    style={[
                      styles.pathChipText,
                      isDark && styles.pathChipTextDark,
                    ]}
                  >
                    ~
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pathChip, isDark && styles.pathChipDark]}
                  onPress={() => onCustomDirChange(serverHome + "/")}
                >
                  <Text
                    style={[
                      styles.pathChipText,
                      isDark && styles.pathChipTextDark,
                    ]}
                  >
                    ~/
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {templates.length > 0 && (
            <View style={[styles.modalSection, { marginTop: 16 }]}>
              <Text style={[styles.modalLabel, isDark && styles.metaDark]}>
                {t("sessionsList.newSessionModal.templatesLabel")}
              </Text>
              {templates.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={[
                    styles.templateRow,
                    isDark && styles.projectRowDark,
                    selectedTemplateID === tmpl.id && styles.projectRowActive,
                  ]}
                  onPress={() => {
                    onSelectTemplateID(
                      selectedTemplateID === tmpl.id ? null : tmpl.id,
                    );
                  }}
                >
                  <View style={styles.templateRowContent}>
                    <Text
                      style={[styles.templateName, isDark && styles.textDark]}
                      numberOfLines={1}
                    >
                      {tmpl.name}
                    </Text>
                    <Text
                      style={[styles.templatePrompt, isDark && styles.metaDark]}
                      numberOfLines={2}
                    >
                      {tmpl.prompt}
                    </Text>
                  </View>
                  {selectedTemplateID === tmpl.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={accent}
                    />
                  )}
                  <Ionicons
                    name="ellipsis-vertical"
                    size={16}
                    color={isDark ? "#666666" : "#999999"}
                    onPress={() => handleDeleteTemplate(tmpl.id)}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.modalSection, { marginTop: 8 }]}>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              placeholder={t(
                "sessionsList.newSessionModal.templateNamePlaceholder",
              )}
              placeholderTextColor={isDark ? "#666666" : "#999999"}
              value={templateName}
              onChangeText={onTemplateNameChange}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.modalActions}>
            {customDir.trim() ? (
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  isDark && styles.modalButtonPrimaryDark,
                  styles.modalButtonFull,
                ]}
                onPress={() => onCreate(customDir)}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#0a0a0a" : "#ffffff"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonTextPrimary,
                      isDark && styles.modalButtonTextPrimaryDark,
                    ]}
                  >
                    {t("sessionsList.newSessionModal.createInButton", {
                      dir:
                        customDir.split("/").filter(Boolean).pop() || customDir,
                    })}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  isDark && styles.modalButtonPrimaryDark,
                  styles.modalButtonFull,
                ]}
                onPress={() => onCreate()}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#0a0a0a" : "#ffffff"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonTextPrimary,
                      isDark && styles.modalButtonTextPrimaryDark,
                    ]}
                  >
                    {t("sessionsList.newSessionModal.createSessionButton")}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.modalButton,
              styles.modalButtonSecondary,
              isDark && styles.modalButtonSecondaryDark,
              styles.modalButtonFull,
            ]}
            onPress={handleSaveTemplate}
          >
            <Text
              style={[
                styles.modalButtonTextSecondary,
                isDark && styles.modalButtonTextSecondaryDark,
              ]}
            >
              {selectedTemplateID
                ? t("sessionsList.newSessionModal.saveTemplateButton")
                : t("sessionsList.newSessionModal.saveTemplateButton")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
