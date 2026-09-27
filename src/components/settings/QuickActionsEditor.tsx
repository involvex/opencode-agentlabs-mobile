import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuickActions } from "../../stores/quick-actions";
import {
  MAX_QUICK_ACTIONS,
  MAX_QUICK_LABEL,
  quickActionSubtitle,
  validateQuickAction,
  type QuickAction,
} from "../../lib/quick-actions";
import { useDensity, ds } from "../../lib/density";

interface Draft {
  id: string | null;
  label: string;
  kind: "text" | "command";
  text: string;
  trigger: string;
  args: string;
  send: boolean;
}

function draftFrom(action: QuickAction): Draft {
  return {
    id: action.id,
    label: action.label,
    kind: action.kind,
    text: action.kind === "text" ? action.text : "",
    trigger: action.kind === "command" ? action.trigger : "",
    args: action.kind === "command" ? (action.args ?? "") : "",
    send: action.sendImmediately ?? false,
  };
}

const blankDraft = (): Draft => ({
  id: null,
  label: "",
  kind: "text",
  text: "",
  trigger: "",
  args: "",
  send: false,
});

export function QuickActionsEditor({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation();
  const density = useDensity();
  const actions = useQuickActions((s) => s.actions);
  const tapToSend = useQuickActions((s) => s.tapToSend);
  const setTapToSend = useQuickActions((s) => s.setTapToSend);
  const addAction = useQuickActions((s) => s.addAction);
  const updateAction = useQuickActions((s) => s.updateAction);
  const removeAction = useQuickActions((s) => s.removeAction);
  const moveAction = useQuickActions((s) => s.moveAction);
  const resetDefaults = useQuickActions((s) => s.resetDefaults);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    void useQuickActions.getState().load();
  }, []);

  const patchDraft = (patch: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleSave = async () => {
    if (!draft) return;
    const base = {
      label: draft.label.trim(),
      sendImmediately: draft.send,
    };
    const candidate =
      draft.kind === "text"
        ? { ...base, kind: "text" as const, text: draft.text }
        : {
            ...base,
            kind: "command" as const,
            trigger: draft.trigger.trim(),
            args: draft.args.trim() || undefined,
          };
    const error = validateQuickAction({
      ...candidate,
      id: draft.id ?? "new",
    });
    if (error) {
      Alert.alert(t("settings.composer.invalidTitle"), error);
      return;
    }
    if (draft.id) {
      const ok = await updateAction(draft.id, candidate);
      if (!ok) {
        Alert.alert(t("settings.composer.invalidTitle"), error ?? "");
        return;
      }
    } else {
      const id = await addAction(candidate);
      if (!id) {
        Alert.alert(
          t("settings.composer.invalidTitle"),
          t("settings.composer.maxReached"),
        );
        return;
      }
    }
    setDraft(null);
  };

  const handleRowPress = (action: QuickAction, index: number) => {
    const options: {
      text: string;
      onPress?: () => void;
      style?: "destructive" | "cancel";
    }[] = [
      {
        text: t("settings.composer.edit"),
        onPress: () => setDraft(draftFrom(action)),
      },
    ];
    if (index > 0) {
      options.push({
        text: t("settings.composer.moveUp"),
        onPress: () => void moveAction(action.id, -1),
      });
    }
    if (index < actions.length - 1) {
      options.push({
        text: t("settings.composer.moveDown"),
        onPress: () => void moveAction(action.id, 1),
      });
    }
    options.push({
      text: t("common.delete"),
      style: "destructive",
      onPress: () => void removeAction(action.id),
    });
    options.push({ text: t("common.cancel"), style: "cancel" });
    Alert.alert(action.label, quickActionSubtitle(action), options);
  };

  const handleReset = () => {
    Alert.alert(
      t("settings.composer.reset.confirmTitle"),
      t("settings.composer.reset.confirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.composer.reset.label"),
          style: "destructive",
          onPress: () => void resetDefaults(),
        },
      ],
    );
  };

  return (
    <View>
      <Text style={[s.hint, isDark && s.hintDark]}>
        {t("settings.composer.hint")}
      </Text>
      <View style={[s.row, isDark && s.rowDark]}>
        <View style={s.rowText}>
          <Text style={[s.label, isDark && s.textDark]}>
            {t("settings.composer.tapToSend.label")}
          </Text>
          <Text style={[s.desc, isDark && s.metaDark]}>
            {t("settings.composer.tapToSend.description")}
          </Text>
        </View>
        <Switch
          value={tapToSend}
          onValueChange={setTapToSend}
          trackColor={{ false: "#767577", true: "#22c55e" }}
        />
      </View>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={action.id}
          style={[s.row, isDark && s.rowDark]}
          onPress={() => handleRowPress(action, index)}
        >
          <View style={s.rowText}>
            <Text style={[s.label, isDark && s.textDark]}>{action.label}</Text>
            <Text style={[s.desc, isDark && s.metaDark]} numberOfLines={1}>
              {quickActionSubtitle(action)}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isDark ? "#666666" : "#999999"}
          />
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[s.row, isDark && s.rowDark]}
        onPress={() => {
          if (actions.length >= MAX_QUICK_ACTIONS) {
            Alert.alert(
              t("settings.composer.invalidTitle"),
              t("settings.composer.maxReached"),
            );
            return;
          }
          setDraft(blankDraft());
        }}
      >
        <Ionicons name="add" size={20} color={isDark ? "#4ade80" : "#16a34a"} />
        <Text style={[s.label, s.addLabel]}>
          {t("settings.composer.add.label")}
        </Text>
      </TouchableOpacity>
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
          {t("settings.composer.reset.label")}
        </Text>
      </TouchableOpacity>

      {draft && (
        <View style={[s.editor, isDark && s.editorDark]}>
          <Text style={[s.editorTitle, isDark && s.textDark]}>
            {t("settings.composer.editTitle")}
          </Text>
          <Text style={[s.fieldLabel, isDark && s.metaDark]}>
            {t("settings.composer.labelLabel")}
          </Text>
          <TextInput
            style={[s.input, isDark && s.inputDark]}
            value={draft.label}
            onChangeText={(v) => patchDraft({ label: v })}
            maxLength={MAX_QUICK_LABEL}
            autoCapitalize="sentences"
            placeholderTextColor={isDark ? "#666666" : "#999999"}
          />
          <View style={s.kindRow}>
            {(["text", "command"] as const).map((kind) => (
              <TouchableOpacity
                key={kind}
                style={[
                  s.kindButton,
                  draft.kind === kind && s.kindButtonActive,
                  isDark && s.kindButtonDark,
                  draft.kind === kind && isDark && s.kindButtonActiveDark,
                ]}
                onPress={() => patchDraft({ kind })}
              >
                <Text
                  style={[
                    s.kindText,
                    draft.kind === kind && s.kindTextActive,
                    isDark && s.kindTextDark,
                  ]}
                >
                  {kind === "text"
                    ? t("settings.composer.kindText")
                    : t("settings.composer.kindCommand")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {draft.kind === "text" ? (
            <>
              <Text style={[s.fieldLabel, isDark && s.metaDark]}>
                {t("settings.composer.textLabel")}
              </Text>
              <TextInput
                style={[s.input, isDark && s.inputDark, s.multiline]}
                value={draft.text}
                onChangeText={(v) => patchDraft({ text: v })}
                multiline
                autoCapitalize="sentences"
                placeholderTextColor={isDark ? "#666666" : "#999999"}
              />
            </>
          ) : (
            <>
              <Text style={[s.fieldLabel, isDark && s.metaDark]}>
                {t("settings.composer.triggerLabel")}
              </Text>
              <TextInput
                style={[s.input, isDark && s.inputDark]}
                value={draft.trigger}
                onChangeText={(v) => patchDraft({ trigger: v })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={isDark ? "#666666" : "#999999"}
              />
              <Text style={[s.fieldLabel, isDark && s.metaDark]}>
                {t("settings.composer.argsLabel")}
              </Text>
              <TextInput
                style={[s.input, isDark && s.inputDark]}
                value={draft.args}
                onChangeText={(v) => patchDraft({ args: v })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={isDark ? "#666666" : "#999999"}
              />
            </>
          )}
          <View style={[s.row, s.sendRow]}>
            <Text style={[s.label, isDark && s.textDark]}>
              {t("settings.composer.sendNow")}
            </Text>
            <Switch
              value={draft.send}
              onValueChange={(v) => patchDraft({ send: v })}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          </View>
          <View style={s.editorActions}>
            <TouchableOpacity
              style={[
                s.saveButton,
                { ...ds({ paddingHorizontal: 16 }, density) },
              ]}
              onPress={handleSave}
            >
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
  addLabel: { color: "#16a34a", fontWeight: "600" },
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
  multiline: { minHeight: 64, textAlignVertical: "top" },
  kindRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  kindButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    alignItems: "center",
  },
  kindButtonDark: { borderColor: "#2a2a2a" },
  kindButtonActive: { backgroundColor: "#0a0a0a" },
  kindButtonActiveDark: { backgroundColor: "#ffffff" },
  kindText: { fontSize: 14, fontWeight: "600", color: "#666666" },
  kindTextDark: { color: "#888888" },
  kindTextActive: { color: "#ffffff" },
  sendRow: { borderTopWidth: 0, paddingHorizontal: 0, paddingVertical: 4 },
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
