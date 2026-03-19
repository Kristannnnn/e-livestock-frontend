import { Slot, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  addNotificationResponseListenerAsync,
  configureDeviceNotificationsAsync,
} from "../lib/notifications/deviceNotifications";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let responseSubscription = null;

    const bootstrapNotifications = async () => {
      await configureDeviceNotificationsAsync();

      if (!mounted) {
        return;
      }

      responseSubscription = await addNotificationResponseListenerAsync(() => {
        router.push("/notifications");
      });
    };

    bootstrapNotifications();

    return () => {
      mounted = false;
      responseSubscription?.remove?.();
    };
  }, [router]);

  return <Slot />;
}
