import { useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export interface RenameModalProps {
  visible: boolean;
  onClose: () => void;
  renameText: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  isDark: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const styles = {
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center" as const,
  },
  modalDismiss: {
    flex: 1,
  },
  renameCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 32,
    gap: 16,
  },
  renameCardDark: {
    backgroundColor: "#1a1a1a",
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#0a0a0a",
  },
  textDark: {
    color: "#ffffff",
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
  renameActions: {
    flexDirection: "row" as const,
    justifyContent: "flex-end" as const,
    gap: 12,
  },
  renameBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  renameBtnCancel: {
    backgroundColor: "transparent",
  },
  renameBtnCancelText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#888888",
  },
  modalButtonPrimary: {
    backgroundColor: "#0a0a0a",
  },
  modalButtonPrimaryDark: {
    backgroundColor: "#ffffff",
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#ffffff",
  },
  modalButtonTextPrimaryDark: {
    color: "#0a0a0a",
  },
};

export function RenameModal({
  visible,
  onClose,
  renameText,
  onChangeText,
  onSubmit,
  disabled,
  isDark,
  t,
}: RenameModalProps) {
  const submit = useCallback(() => {
    onSubmit();
  }, [onSubmit]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.modalDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.renameCard, isDark && styles.renameCardDark]}>
          <Text style={[styles.renameTitle, isDark && styles.textDark]}>
            {t("sessionsList.renameModal.title")}
          </Text>
          <TextInput
            style={[styles.modalInput, isDark && styles.modalInputDark]}
            value={renameText}
            onChangeText={onChangeText}
            onSubmitEditing={submit}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            autoCapitalize="sentences"
            autoCorrect={false}
          />
          <View style={styles.renameActions}>
            <TouchableOpacity style={styles.renameBtn} onPress={onClose}>
              <Text style={styles.renameBtnCancelText}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.renameBtn,
                styles.modalButtonPrimary,
                isDark && styles.modalButtonPrimaryDark,
              ]}
              onPress={submit}
              disabled={disabled}
            >
              <Text
                style={[
                  styles.modalButtonTextPrimary,
                  isDark && styles.modalButtonTextPrimaryDark,
                ]}
              >
                {t("common.save")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.modalDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
