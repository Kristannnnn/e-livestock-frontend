import { Slot, useRouter } from "expo-router";
import { useEffect } from "react";
import { addNotificationResponseListener } from "../lib/notifications/deviceNotifications";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const responseSubscription = addNotificationResponseListener(() => {
      router.push("/notifications");
    });

    return () => {
      responseSubscription?.remove?.();
    };
  }, [router]);

  return <Slot />;
}
