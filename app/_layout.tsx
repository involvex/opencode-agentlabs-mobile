import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, AppState } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "../src/lib/i18n/config";
import { useAuth } from "../src/stores/auth";
import { useConnections } from "../src/stores/connections";
import { useEvents } from "../src/stores/events";
import { useCatalog } from "../src/stores/catalog";
import { useSettings } from "../src/stores/settings";
import { useTheme } from "../src/lib/theme";
import { AuthGate } from "../src/components/AuthGate";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import * as notifications from "../src/lib/notifications";

const queryClient = new QueryClient();

function RootLayout() {
  const isDark = useTheme();
  const { t } = useTranslation();

  const { initialize: initAuth, isLoading: authLoading } = useAuth();
  const {
    loadConnections,
    isLoading: connectionsLoading,
    client,
  } = useConnections();
  const sseStarted = useRef(false);
  const notifPermissionRequested = useRef(false);

  useEffect(() => {
    initAuth();
    loadConnections();
    useSettings.getState().load();

    notifications.configure(() => useSettings.getState().notifications);

    const unsubNotifications = notifications.onTap((data) => {
      if (data.sessionId) router.push(`/session/${data.sessionId}`);
      else router.push("/");
    });

    return unsubNotifications;
  }, [initAuth, loadConnections]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (
        next === "background" &&
        useAuth.getState().settings.requireBiometric
      ) {
        useAuth.getState().lock();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (client && !sseStarted.current) {
      sseStarted.current = true;
      useEvents.getState().connect();
      useCatalog.getState().load();
      if (!notifPermissionRequested.current) {
        notifPermissionRequested.current = true;
        void notifications.setup();
      }
    } else if (!client && sseStarted.current) {
      sseStarted.current = false;
      useEvents.getState().disconnect();
    }
    return () => {
      if (sseStarted.current) {
        sseStarted.current = false;
        useEvents.getState().disconnect();
      }
    };
  }, [client]);

  const isLoading = authLoading || connectionsLoading;

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
        }}
      >
        <ActivityIndicator
          size="large"
          color={isDark ? "#ffffff" : "#0a0a0a"}
        />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <QueryClientProvider client={queryClient}>
              <AuthGate>
                <Stack
                  screenOptions={{
                    headerStyle: {
                      backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
                    },
                    headerTintColor: isDark ? "#ffffff" : "#0a0a0a",
                    contentStyle: {
                      backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
                    },
                  }}
                >
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="session/[id]"
                    options={{
                      title: t("session.titleFallback"),
                      presentation: "card",
                    }}
                  />
                  <Stack.Screen
                    name="connection/add"
                    options={{
                      title: t("nav.addConnectionTitle"),
                      presentation: "modal",
                    }}
                  />
                  <Stack.Screen
                    name="connection/[id]"
                    options={{
                      title: t("nav.editConnectionTitle"),
                      presentation: "modal",
                    }}
                  />
                  <Stack.Screen
                    name="debug/sse"
                    options={{
                      title: "SSE Events",
                      presentation: "modal",
                    }}
                  />
                </Stack>
                <StatusBar style={isDark ? "light" : "dark"} />
              </AuthGate>
            </QueryClientProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default RootLayout;
