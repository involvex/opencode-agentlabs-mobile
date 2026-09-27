import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTerminalKeys } from "../../stores/terminal-keys";
import {
  MAX_TERM_LABEL,
  describeSequence,
  formatSequenceForEdit,
  parseSequenceInput,
  validateTermKey,
  type TermKey,
} from "../../lib/terminal-keys";

interface Draft {
  row: "nav" | "ctrl";
  id: string;
  label: string;
  sequence: string;
}

export function TerminalKeysEditor({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  const nav = useTerminalKeys((s) => s.nav);
  const ctrl = useTerminalKeys((s) => s.ctrl);
  const updateKey = useTerminalKeys((s) => s.updateKey);
  const resetDefaults = useTerminalKeys((s) => s.resetDefaults);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    void useTerminalKeys.getState().load();
  }, []);

  const openDraft = (row: "nav" | "ctrl", key: TermKey) =>
    setDraft({
      row,
      id: key.id,
      label: key.label,
      sequence: formatSequenceForEdit(key.sequence),
    });

  const handleSave = async () => {
    if (!draft) return;
    const sequence = parseSequenceInput(draft.sequence);
    const error = validateTermKey({
      id: draft.id,
      label: draft.label.trim(),
      sequence,
    });
    if (error) {
      Alert.alert(t("settings.terminalKeys.invalidTitle"), error);
      return;
    }
    const ok = await updateKey(draft.row, draft.id, {
      label: draft.label.trim(),
      sequence,
    });
    if (!ok) {
      Alert.alert(t("settings.terminalKeys.invalidTitle"), error ?? "");
      return;
    }
    setDraft(null);
  };

  const handleReset = () => {
    Alert.alert(
      t("settings.terminalKeys.reset.confirmTitle"),
      t("settings.terminalKeys.reset.confirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.terminalKeys.reset.label"),
          style: "destructive",
          onPress: () => void resetDefaults(),
        },
      ],
    );
  };

  const renderGroup = (title: string, row: "nav" | "ctrl", keys: TermKey[]) => (
    <View>
      <Text style={[s.groupLabel, isDark && s.metaDark]}>{title}</Text>
      {keys.map((key) => (
        <TouchableOpacity
          key={key.id}
          style={[s.row, isDark && s.rowDark]}
          onPress={() => openDraft(row, key)}
        >
          <View style={s.rowText}>
            <Text style={[s.label, isDark && s.textDark]}>{key.label}</Text>
            <Text style={[s.desc, isDark && s.metaDark]} numberOfLines={1}>
              {describeSequence(key.sequence)}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#666666" : "#999999"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View>
      <Text style={[s.hint, isDark && s.hintDark]}>
        {t("settings.terminalKeys.hint")}
      </Text>
      {renderGroup(t("settings.terminalKeys.navLabel"), "nav", nav)}
      {renderGroup(t("settings.terminalKeys.ctrlLabel"), "ctrl", ctrl)}
      <TouchableOpacity
        style={[s.row, isDark && s.rowDark]}
        onPress={handleReset}
      >
        <Ionicons
          name="refresh-outline"
          size={20}
          color={isDark ? "#888888" : "#666666"}
        />
        <Text style={[s.label, isDark && s.textDark]}>
          {t("settings.terminalKeys.reset.label")}
        </Text>
      </TouchableOpacity>

      {draft && (
        <View style={[s.editor, isDark && s.editorDark]}>
          <Text style={[s.editorTitle, isDark && s.textDark]}>
            {t("settings.terminalKeys.edit")}
          </Text>
          <Text style={[s.fieldLabel, isDark && s.metaDark]}>
            {t("settings.terminalKeys.labelLabel")}
          </Text>
          <TextInput
            style={[s.input, isDark && s.inputDark]}
            value={draft.label}
            onChangeText={(v) => setDraft((d) => (d ? { ...d, label: v } : d))}
            maxLength={MAX_TERM_LABEL}
            autoCapitalize="none"
            placeholderTextColor={isDark ? "#666666" : "#999999"}
          />
          <Text style={[s.fieldLabel, isDark && s.metaDark]}>
            {t("settings.terminalKeys.sequenceLabel")}
          </Text>
          <TextInput
            style={[s.input, isDark && s.inputDark]}
            value={draft.sequence}
            onChangeText={(v) =>
              setDraft((d) => (d ? { ...d, sequence: v } : d))
            }
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={isDark ? "#666666" : "#999999"}
          />
          <Text style={[s.sequenceHint, isDark && s.metaDark]}>
            {t("settings.terminalKeys.sequenceHint")}
          </Text>
          <View style={s.editorActions}>
            <TouchableOpacity style={s.saveButton} onPress={handleSave}>
              <Text style={s.saveText}>{t("common.save")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDraft(null)}>
              <Text style={[s.cancelText, isDark && s.metaDark]}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hint: {
    fontSize: 12,
    color: "#525252",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hintDark: { color: "#a1a1aa" },
  groupLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
  },
  rowDark: { borderTopColor: "#2a2a2a" },
  rowText: { flex: 1 },
  label: { fontSize: 16, color: "#0a0a0a" },
  textDark: { color: "#ffffff" },
  desc: { fontSize: 13, color: "#666666", marginTop: 2 },
  metaDark: { color: "#888888" },
  editor: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#fafafa",
    gap: 8,
  },
  editorDark: { borderTopColor: "#2a2a2a", backgroundColor: "#141414" },
  editorTitle: { fontSize: 15, fontWeight: "700", color: "#0a0a0a" },
  fieldLabel: { fontSize: 13, color: "#666666", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: "#0a0a0a",
    backgroundColor: "#ffffff",
  },
  inputDark: {
    borderColor: "#3a3a3a",
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  sequenceHint: { fontSize: 12, color: "#888888" },
  editorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  cancelText: { fontSize: 15, color: "#666666" },
});
