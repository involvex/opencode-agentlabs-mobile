import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import { useDensity } from "../../lib/density";

interface AttachAction {
  key: string;
  icon: string;
  label: string;
  description: string;
  onPress: () => void;
}

interface Props {
  sheetRef: React.RefObject<BottomSheet | null>;
  isDark: boolean;
  actions: AttachAction[];
}

export function AttachSheet({ sheetRef, isDark, actions }: Props) {
  const { t } = useTranslation();
  const density = useDensity();

  return (
    <BottomSheet
      ref={(innerRef) => {
        sheetRef.current = innerRef;
      }}
      index={-1}
      snapPoints={["50%", "75%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
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
    >
      <BottomSheetView
        style={[
          s.container,
          isDark && s.containerDark,
          {
            paddingHorizontal: 16 * density.padding,
            paddingTop: 8 * density.padding,
          },
        ]}
      >
        <Text
          style={[
            s.title,
            isDark && s.titleDark,
            { marginBottom: 16 * density.padding },
          ]}
        >
          {t("session.alerts.attachTitle", "Attach")}
        </Text>
        <View style={s.list}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[
                s.row,
                isDark && s.rowDark,
                { padding: 16 * density.padding },
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View
                style={[
                  s.iconWrap,
                  isDark && s.iconWrapDark,
                  { padding: 10 * density.padding },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={22}
                  color={isDark ? "#ffffff" : "#0a0a0a"}
                />
              </View>
              <View style={s.textCol}>
                <Text
                  style={[
                    s.label,
                    isDark && s.labelDark,
                    { fontSize: 16 * density.font },
                  ]}
                >
                  {action.label}
                </Text>
                <Text
                  style={[
                    s.desc,
                    isDark && s.descDark,
                    { fontSize: 13 * density.font },
                  ]}
                  numberOfLines={1}
                >
                  {action.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[s.cancel, { padding: 14 * density.padding }]}
          onPress={() => sheetRef.current?.close()}
        >
          <Text style={[s.cancelText, isDark && s.cancelTextDark]}>
            {t("common.cancel", "Cancel")}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  sheetDark: { backgroundColor: "#1a1a1a" },
  container: { flex: 1 },
  containerDark: {},
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0a0a0a",
  },
  titleDark: { color: "#ffffff" },
  list: { marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#f5f5f5",
  },
  rowDark: { backgroundColor: "#2a2a2a" },
  iconWrap: {
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  iconWrapDark: { backgroundColor: "#3a3a3a" },
  textCol: { flex: 1, minWidth: 0, marginLeft: 12 },
  label: { fontSize: 16, fontWeight: "600", color: "#0a0a0a" },
  labelDark: { color: "#ffffff" },
  desc: { fontSize: 13, color: "#888888", marginTop: 2 },
  descDark: { color: "#aaaaaa" },
  cancel: { alignItems: "center", marginTop: 8 },
  cancelText: { fontSize: 16, color: "#999999" },
  cancelTextDark: { color: "#888888" },
});
