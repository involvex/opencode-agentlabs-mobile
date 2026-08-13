import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEvents } from "../../src/stores/events";
import type { SSEEvent } from "../../src/stores/events";

export default function SSEInspectorScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const eventLog = useEvents((s) => s.eventLog);
  const clearEventLog = useEvents((s) => s.clearEventLog);
  const connected = useEvents((s) => s.connected);

  const handleClear = () => {
    clearEventLog();
  };

  const renderEvent = ({ item }: { item: SSEEvent }) => (
    <View style={[styles.eventItem, isDark && styles.eventItemDark]}>
      <Text style={styles.eventType}>{item.type}</Text>
      <Text style={[styles.eventTime, isDark && styles.eventTimeDark]}>
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
      {item.properties && Object.keys(item.properties).length > 0 && (
        <Text style={[styles.eventProps, isDark && styles.eventPropsDark]}>
          {JSON.stringify(item.properties, null, 2)}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          SSE Event Inspector
        </Text>
        <View style={styles.headerActions}>
          <Text
            style={[
              styles.connectionStatus,
              isDark && styles.connectionStatusDark,
            ]}
          >
            {connected ? "Connected" : "Disconnected"}
          </Text>
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={eventLog}
        keyExtractor={(_, index) => `event-${index}`}
        renderItem={renderEvent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              No events received. Enable Debug Mode in Settings to start
              logging.
            </Text>
          </View>
        }
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerDark: {
    borderBottomColor: "#2a2a2a",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  titleDark: {
    color: "#ffffff",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  connectionStatus: {
    fontSize: 13,
    fontWeight: "500",
    color: "#22c55e",
  },
  connectionStatusDark: {
    color: "#4ade80",
  },
  clearButton: {
    padding: 6,
  },
  refreshButton: {
    padding: 6,
  },
  eventItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  eventItemDark: {
    borderBottomColor: "#2a2a2a",
  },
  eventType: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  eventTime: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  eventTimeDark: {
    color: "#888888",
  },
  eventProps: {
    fontSize: 11,
    color: "#666666",
    marginTop: 4,
    fontFamily: "monospace",
  },
  eventPropsDark: {
    color: "#888888",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
  emptyTextDark: {
    color: "#888888",
  },
});
