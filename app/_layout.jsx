import { Slot, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  addNotificationResponseListenerAsync,
  configureDeviceNotificationsAsync,
} from "../lib/notifications/deviceNotifications";
import StartupLoadingOverlay from "../components/StartupLoadingOverlay";

const MIN_STARTUP_LOADING_MS = 950;

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function RootLayout() {
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyWidth = document.body.style.width;

    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
      document.body.style.width = previousBodyWidth;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let responseSubscription = null;

    const bootstrapNotifications = async () => {
      const startedAt = Date.now();

      try {
        await configureDeviceNotificationsAsync();

        if (!mounted) {
          return;
        }

        responseSubscription = await addNotificationResponseListenerAsync(() => {
          router.push("/notifications");
        });
      } catch (error) {
        console.error("Startup bootstrap error:", error);
      } finally {
        const elapsed = Date.now() - startedAt;
        await pause(Math.max(0, MIN_STARTUP_LOADING_MS - elapsed));

        if (mounted) {
          setAppReady(true);
        }
      }
    };

    bootstrapNotifications();

    return () => {
      mounted = false;
      responseSubscription?.remove?.();
    };
  }, [router]);

  return (
    <View style={styles.root}>
      <Slot />
      {!appReady ? <StartupLoadingOverlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
