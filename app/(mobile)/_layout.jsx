import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { agriPalette, agriPaperTheme } from "../../constants/agriTheme";
import {
  syncAccountPushToken,
  unregisterAccountPushToken,
} from "../../lib/notifications/deviceNotifications";

const HIDE_FOOTER_SCREENS = new Set([
  "/register",
  "/login",
  "/sendOtp",
  "/verifyOtp",
  "/resetPassword",
  "/appointment",
  "/createLivestockForm",
  "/antemortemScanQRcode",
]);

const FOOTER_ITEMS_BY_ROLE = {
  user: [
    {
      key: "owner-dashboard",
      label: "Dashboard",
      to: "/ownerDashboard",
      icon: "view-dashboard-outline",
    },
    {
      key: "notifications",
      label: "Alerts",
      to: "/notifications",
      icon: "bell-outline",
    },
    {
      key: "stockyard",
      label: "Stockyard",
      to: "/stockyard",
      icon: "barn",
    },
    {
      key: "schedules",
      label: "Schedules",
      to: "/checkSchedule",
      icon: "calendar-month-outline",
    },
    {
      key: "settings",
      label: "Settings",
      to: "/settings",
      icon: "cog-outline",
    },
  ],
  livestockInspector: [
    {
      key: "inspector-dashboard",
      label: "Dashboard",
      to: "/livestockInspectorDashboard",
      icon: "view-dashboard-outline",
    },
    {
      key: "notifications",
      label: "Alerts",
      to: "/notifications",
      icon: "bell-outline",
    },
    {
      key: "view-forms",
      label: "Forms",
      to: "/viewForms",
      icon: "file-document-multiple-outline",
    },
    {
      key: "settings",
      label: "Settings",
      to: "/settings",
      icon: "cog-outline",
    },
    {
      key: "logout",
      label: "Logout",
      icon: "logout",
      danger: true,
    },
  ],
  AntemortemInspector: [
    {
      key: "antemortem-dashboard",
      label: "Dashboard",
      to: "/antemortemDashboard",
      icon: "view-dashboard-outline",
    },
    {
      key: "notifications",
      label: "Alerts",
      to: "/notifications",
      icon: "bell-outline",
    },
    {
      key: "antemortem-schedules",
      label: "Schedules",
      to: "/antemortemSchedules",
      icon: "calendar-month-outline",
    },
    {
      key: "settings",
      label: "Settings",
      to: "/settings",
      icon: "cog-outline",
    },
    {
      key: "logout",
      label: "Logout",
      icon: "logout",
      danger: true,
    },
  ],
};

export default function ScreensLayout() {
  const path = usePathname();
  const router = useRouter();
  const [role, setRole] = useState("");
  const pushSyncAttemptedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const loadRole = async () => {
      try {
        const [storedRole, storedUser, storedAccountId] = await Promise.all([
          AsyncStorage.getItem("role"),
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("account_id"),
        ]);

        const parsedUser = storedUser ? JSON.parse(storedUser) : {};
        const nextRole = storedRole || parsedUser.account_type || "";
        const parsedAccountId = parseInt(
          storedAccountId || parsedUser.account_id || 0,
          10,
        );

        if (mounted) {
          setRole(nextRole);
        }

        if (!pushSyncAttemptedRef.current && parsedAccountId > 0) {
          pushSyncAttemptedRef.current = true;

          try {
            await syncAccountPushToken(parsedAccountId);
          } catch (error) {
            console.error("Push registration error:", error);
          }
        }
      } catch (error) {
        console.error("Unable to load footer role:", error);
      }
    };

    loadRole();

    return () => {
      mounted = false;
    };
  }, [path]);

  const footerItems = FOOTER_ITEMS_BY_ROLE[role] || [];
  const shouldHideFooter = HIDE_FOOTER_SCREENS.has(path) || !footerItems.length;

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              const storedAccountId = parseInt(
                (await AsyncStorage.getItem("account_id")) || "0",
                10,
              );

              await unregisterAccountPushToken(storedAccountId);
              await AsyncStorage.clear();
              router.replace("/");
            } catch (err) {
              console.error("Logout error:", err);
              Alert.alert("Error", "Failed to log out.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <PaperProvider theme={agriPaperTheme}>
      <View style={styles.shell}>
        <Slot />

        {!shouldHideFooter && (
          <View style={styles.footer}>
            {footerItems.map((item) => (
              <FooterButton
                key={item.key}
                label={item.label}
                to={item.to}
                path={path}
                icon={item.icon}
                onPress={item.danger ? handleLogout : undefined}
                danger={item.danger}
              />
            ))}
          </View>
        )}
      </View>
    </PaperProvider>
  );
}

function FooterButton({ label, to, path, icon, onPress, danger = false }) {
  const router = useRouter();
  const isActive = Boolean(to && (path === to || path.startsWith(`${to}/`)));

  return (
    <Pressable
      onPress={onPress || (() => router.replace(to))}
      style={({ pressed }) => [
        styles.footerButton,
        isActive && styles.footerButtonActive,
        danger && styles.footerButtonDanger,
        pressed && styles.footerButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={
          danger
            ? agriPalette.redClay
            : isActive
            ? agriPalette.white
            : agriPalette.fieldDeep
        }
      />
      <Text
        style={[
          styles.footerLabel,
          isActive && styles.footerLabelActive,
          danger && styles.footerLabelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: agriPalette.cream,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: "#E5E6DB",
    backgroundColor: agriPalette.surface,
  },
  footerButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: "#FAF7EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  footerButtonActive: {
    backgroundColor: agriPalette.field,
    borderColor: agriPalette.field,
  },
  footerButtonDanger: {
    backgroundColor: "#FFF5F1",
    borderColor: "#F2C9BA",
  },
  footerButtonPressed: {
    opacity: 0.9,
  },
  footerLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    color: agriPalette.fieldDeep,
    textAlign: "center",
  },
  footerLabelActive: {
    color: agriPalette.white,
  },
  footerLabelDanger: {
    color: agriPalette.redClay,
  },
});
