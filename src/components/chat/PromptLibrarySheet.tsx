import { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import type { PromptSnippet } from "../../stores/prompts";
import { useDensity } from "../../lib/density";

interface Props {
  prompts: PromptSnippet[];
  isDark: boolean;
  sheetRef: React.RefObject<BottomSheet | null>;
  onSelect: (prompt: PromptSnippet) => void;
  onSaveCurrent: (title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function PromptLibrarySheet({
  prompts,
  isDark,
  sheetRef,
  onSelect,
  onSaveCurrent,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const [query, setQuery] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const activePrompts = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
    );
  }, [prompts, query]);

  const handleSave = useCallback(async () => {
    if (!saveTitle.trim() || saving) return;
    setSaving(true);
    try {
      await onSaveCurrent(saveTitle.trim());
      setSaveTitle("");
    } finally {
      setSaving(false);
    }
  }, [saveTitle, saving, onSaveCurrent]);

  const handleDelete = useCallback(
    (prompt: PromptSnippet) => {
      Alert.alert(
        t("prompts.deleteAlertTitle"),
        t("prompts.deleteAlertMessage", { title: prompt.title }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => onDelete(prompt.id),
          },
        ],
      );
    },
    [onDelete, t],
  );

  const handleSelect = useCallback(
    (prompt: PromptSnippet) => {
      onSelect(prompt);
      sheetRef.current?.close();
    },
    [onSelect, sheetRef],
  );

  return (
    <BottomSheet
      ref={(innerRef) => {
        sheetRef.current = innerRef;
      }}
      index={-1}
      snapPoints={["55%", "70%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={isDark ? s.sheetDark : s.sheet}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "#666666" : "#cccccc",
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetView>
        <View
          style={[
            s.header,
            {
              paddingHorizontal: 16 * density.padding,
              paddingBottom: 12 * density.padding,
            },
          ]}
        >
          <Text
            style={[
              s.title,
              isDark && s.textWhite,
              { fontSize: 18 * density.font },
            ]}
          >
            {t("prompts.title")}
          </Text>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={() => sheetRef.current?.close()}
            testID="prompt-sheet-close"
          >
            <Ionicons
              name="close"
              size={20}
              color={isDark ? "#888888" : "#666666"}
            />
          </TouchableOpacity>
        </View>

        <View
          style={[
            s.searchContainer,
            {
              gap: 8 * density.gap,
              marginHorizontal: 16 * density.padding,
              marginBottom: 8 * density.padding,
              paddingHorizontal: 12 * density.padding,
              paddingVertical: 8 * density.padding,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={isDark ? "#666666" : "#999999"}
          />
          <TextInput
            style={[
              s.searchInput,
              isDark && s.searchInputDark,
              { fontSize: 14 * density.font },
            ]}
            placeholder={t("prompts.searchPlaceholder")}
            placeholderTextColor={isDark ? "#666666" : "#999999"}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>

        <TextInput
          style={[
            s.saveInput,
            isDark && s.saveInputDark,
            {
              marginHorizontal: 16 * density.padding,
              marginBottom: 8 * density.padding,
              paddingHorizontal: 12 * density.padding,
              paddingVertical: 8 * density.padding,
              fontSize: 14 * density.font,
            },
          ]}
          placeholder={t("prompts.savePlaceholder")}
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={saveTitle}
          onChangeText={setSaveTitle}
          autoCapitalize="sentences"
          onSubmitEditing={handleSave}
        />
      </BottomSheetView>

      <BottomSheetFlatList
        style={{ flex: 1 }}
        data={activePrompts}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.listContent,
          activePrompts.length === 0 && s.emptyContent,
        ]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              s.row,
              isDark && s.rowDark,
              {
                gap: 12 * density.gap,
                paddingHorizontal: 16 * density.padding,
                paddingVertical: 12 * density.padding,
              },
            ]}
            onPress={() => handleSelect(item)}
            testID={`prompt-item-${item.id}`}
          >
            <View style={s.rowText}>
              <Text
                style={[
                  s.rowName,
                  isDark && s.textWhite,
                  { fontSize: 15 * density.font },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  s.rowDesc,
                  isDark && s.metaDark,
                  { fontSize: 12 * density.font },
                ]}
                numberOfLines={2}
              >
                {item.body || t("prompts.emptyBody")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              hitSlop={8}
              testID={`prompt-delete-${item.id}`}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={16}
                color={isDark ? "#666666" : "#999999"}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View
            style={[
              s.emptyState,
              {
                gap: 12 * density.gap,
                paddingHorizontal: 32 * density.padding,
              },
            ]}
          >
            <Ionicons
              name="library-outline"
              size={32}
              color={isDark ? "#444444" : "#cccccc"}
            />
            <Text
              style={[
                s.emptyText,
                isDark && s.textWhite,
                { fontSize: 14 * density.font },
              ]}
            >
              {t("prompts.emptyState")}
            </Text>
          </View>
        )}
      />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  sheetDark: { backgroundColor: "#1a1a1a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  metaDark: { color: "#666666" },
  closeBtn: { padding: 4 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0a0a0a",
  },
  searchInputDark: {
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  saveInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0a0a0a",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  saveInputDark: {
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  listContent: { paddingBottom: 40 },
  emptyContent: { flexGrow: 1, justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  rowDark: { borderBottomColor: "#2a2a2a" },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "600", color: "#0a0a0a" },
  rowDesc: { fontSize: 12, color: "#999999", marginTop: 2 },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
});
