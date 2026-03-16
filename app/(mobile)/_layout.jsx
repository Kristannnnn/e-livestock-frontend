import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { agriPalette, agriPaperTheme } from "../../constants/agriTheme";

export default function ScreensLayout() {
  const path = usePathname();
  const router = useRouter();

  const hideFooterScreens = [
    "/ownerDashboard",
    "/register",
    "/login",
    "/livestockInspectorDashboard",
    "/createLivestockForm",
    "/viewForms",
    "/antemortemDashboard",
    "/antemortemSchedules",
    "/sendOtp",
    "/verifyOtp",
    "/antemortemScanQRcode",
  ];
  const shouldHideFooter = hideFooterScreens.includes(path);

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
            <FooterButton
              label="Stockyard"
              to="/stockyard"
              path={path}
              icon="barn"
            />
            <FooterButton
              label="Schedules"
              to="/checkSchedule"
              path={path}
              icon="calendar-month-outline"
            />
            <FooterButton
              label="Logout"
              icon="logout"
              onPress={handleLogout}
              danger
            />
          </View>
        )}
      </View>
    </PaperProvider>
  );
}

function FooterButton({ label, to, path, icon, onPress, danger = false }) {
  const router = useRouter();
  const isActive = Boolean(to && path.startsWith(to));

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
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: "#E5E6DB",
    backgroundColor: agriPalette.surface,
  },
  footerButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: "#FAF7EE",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 12,
    fontWeight: "800",
    color: agriPalette.fieldDeep,
  },
  footerLabelActive: {
    color: agriPalette.white,
  },
  footerLabelDanger: {
    color: agriPalette.redClay,
  },
});
