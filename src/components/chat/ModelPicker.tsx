import { useState, useCallback, useMemo, useEffect, memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetSectionList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import { useDensity } from "../../lib/density";
import {
  buildModelSections,
  modelFavKey,
  type ModelListItem,
} from "../../lib/model-list";
import { useModelFavorites } from "../../stores/model-favorites";

interface Provider {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

interface Props {
  providers: Provider[];
  selected: { providerID: string; modelID: string } | null;
  isDark: boolean;
  onSelect: (providerID: string, modelID: string) => void;
  sheetRef: React.RefObject<BottomSheet | null>;
}

export const ModelPicker = memo(function ModelPicker({
  providers,
  selected,
  isDark,
  onSelect,
  sheetRef,
}: Props) {
  const { t } = useTranslation();
  const density = useDensity();
  const [search, setSearch] = useState("");
  const favorites = useModelFavorites((s) => s.favorites);
  const loadFavorites = useModelFavorites((s) => s.load);
  const toggleFavorite = useModelFavorites((s) => s.toggleFavorite);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const favSet = useMemo(
    () => new Set(favorites.map((f) => f.toLowerCase())),
    [favorites],
  );

  const sections = useMemo(
    () =>
      buildModelSections(providers, {
        search,
        selected,
        favorites,
        favoritesTitle: t("chat.modelPicker.favorites"),
      }),
    [providers, search, selected, favorites, t],
  );

  const handleSelect = useCallback(
    (providerID: string, modelID: string) => {
      onSelect(providerID, modelID);
      setSearch("");
      sheetRef.current?.close();
    },
    [onSelect, sheetRef],
  );

  const handleToggleFav = useCallback(
    (providerID: string, modelID: string) => {
      toggleFavorite(providerID, modelID);
    },
    [toggleFavorite],
  );

  const header = useMemo(
    () => (
      <View
        style={[
          s.header,
          isDark && s.headerDark,
          {
            paddingHorizontal: 16 * density.padding,
            paddingBottom: 12 * density.padding,
            paddingTop: 8 * density.padding,
            gap: 10 * density.gap,
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
          {t("chat.modelPicker.title")}
        </Text>
        <BottomSheetTextInput
          style={[
            s.search,
            isDark && s.searchDark,
            {
              paddingHorizontal: 14 * density.padding,
              paddingVertical: 10 * density.padding,
              fontSize: 15 * density.font,
            },
          ]}
          placeholder={t("chat.modelPicker.searchPlaceholder")}
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          testID="model-search-input"
        />
      </View>
    ),
    [density, isDark, search, t],
  );

  return (
    <BottomSheet
      ref={(innerRef) => {
        sheetRef.current = innerRef;
      }}
      index={-1}
      snapPoints={["50%", "80%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={isDark ? s.sheetDark : s.sheet}
      handleIndicatorStyle={{ backgroundColor: isDark ? "#666666" : "#cccccc" }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      )}
      onChange={(idx) => {
        if (idx === -1) setSearch("");
      }}
    >
      <BottomSheetSectionList
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={(item: ModelListItem) =>
          `${item.providerID}/${item.modelID}`
        }
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({
          section,
        }: {
          section: { title: string; isFavorites?: boolean };
        }) => (
          <View
            style={[
              s.sectionHeader,
              isDark && s.sectionHeaderDark,
              {
                paddingHorizontal: 16 * density.padding,
                paddingVertical: 8 * density.padding,
              },
            ]}
          >
            <View style={s.sectionHeaderRow}>
              {section.isFavorites && (
                <Ionicons name="star" size={12} color="#f59e0b" />
              )}
              <Text
                style={[
                  s.sectionTitle,
                  isDark && s.metaDark,
                  { fontSize: 12 * density.font },
                ]}
              >
                {section.title}
              </Text>
            </View>
          </View>
        )}
        renderItem={({ item }: { item: ModelListItem }) => {
          const active =
            selected?.providerID === item.providerID &&
            selected?.modelID === item.modelID;
          const isFav = favSet.has(modelFavKey(item.providerID, item.modelID));
          return (
            <View
              style={[
                s.row,
                isDark && s.rowDark,
                active && (isDark ? s.rowSelectedDark : s.rowSelected),
                {
                  paddingHorizontal: 16 * density.padding,
                  paddingVertical: 12 * density.padding,
                },
              ]}
            >
              <TouchableOpacity
                style={s.rowTouch}
                onPress={() => handleSelect(item.providerID, item.modelID)}
                testID={`model-option-${item.providerID}-${item.modelID}`}
                activeOpacity={0.7}
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
                    {item.modelName || item.modelID}
                  </Text>
                  <Text
                    style={[
                      s.rowProvider,
                      isDark && s.metaDark,
                      { fontSize: 12 * density.font },
                    ]}
                  >
                    {item.providerName || item.providerID}
                  </Text>
                </View>
                {active && (
                  <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.favButton}
                onPress={() => handleToggleFav(item.providerID, item.modelID)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={`model-fav-${item.providerID}-${item.modelID}`}
                accessibilityRole="togglebutton"
                accessibilityLabel={t("chat.modelPicker.toggleFavorite", {
                  model: item.modelName || item.modelID,
                })}
                accessibilityState={{ selected: isFav }}
              >
                <Ionicons
                  name={isFav ? "star" : "star-outline"}
                  size={20}
                  color={isFav ? "#f59e0b" : isDark ? "#666666" : "#cccccc"}
                />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <Text
            style={[
              s.emptyText,
              isDark && s.metaDark,
              { fontSize: 14 * density.font },
            ]}
          >
            {t("chat.modelPicker.noResults")}
          </Text>
        )}
        contentContainerStyle={s.content}
        stickySectionHeadersEnabled={false}
      />
    </BottomSheet>
  );
});

const s = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  sheetDark: { backgroundColor: "#1a1a1a" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
    backgroundColor: "#ffffff",
  },
  headerDark: { backgroundColor: "#1a1a1a" },
  title: { fontSize: 18, fontWeight: "700", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  search: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0a0a0a",
  },
  searchDark: { backgroundColor: "#2a2a2a", color: "#ffffff" },
  content: { paddingBottom: 40 },
  sectionHeader: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderDark: { backgroundColor: "#111111" },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaDark: { color: "#666666" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  rowDark: { borderBottomColor: "#2a2a2a" },
  rowSelected: { backgroundColor: "#f5f3ff" },
  rowSelectedDark: { backgroundColor: "#1f1a2e" },
  rowTouch: { flex: 1, flexDirection: "row", alignItems: "center" },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "500", color: "#0a0a0a" },
  rowProvider: { fontSize: 12, color: "#999999", marginTop: 1 },
  favButton: { padding: 6, marginLeft: 8 },
  emptyText: {
    fontSize: 14,
    color: "#999999",
    textAlign: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
});
