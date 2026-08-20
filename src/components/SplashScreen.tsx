import { View, Text, StyleSheet, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function SplashScreen() {
  return (
    <View style={[s.container, { backgroundColor: "#0F172A" }]}>
      <View style={s.content}>
        <View style={s.logoContainer}>
          <View style={s.logoCircle}>
            <Text style={s.logoText}>
              {SCREEN_WIDTH > 400 ? "OpenCode" : "OC"}
            </Text>
          </View>
        </View>
        <Text style={s.title}>OpenCode</Text>
        <Text style={s.subtitle}>AI Coding Assistant</Text>
      </View>
      <View style={s.loadingRow}>
        <View style={s.dot} />
        <View style={s.dot} />
        <View style={s.dot} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#334155",
  },
  logoText: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "500",
  },
  loadingRow: {
    position: "absolute",
    bottom: 48,
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#475569",
  },
});
