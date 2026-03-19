import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AgriButton from "./AgriButton";
import { agriPalette } from "../constants/agriTheme";

export default function LogoutConfirmModal({
  visible,
  loading = false,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
        />

        <View style={styles.card}>
          <View style={styles.iconShell}>
            <MaterialCommunityIcons
              name={loading ? "logout-variant" : "shield-lock-outline"}
              size={28}
              color={agriPalette.fieldDeep}
            />
          </View>

          <Text style={styles.eyebrow}>Secure logout</Text>
          <Text style={styles.title}>
            {loading ? "Signing you out..." : "Log out of this account?"}
          </Text>
          <Text style={styles.copy}>
            {loading
              ? "Please wait while we clear this device session and return you to the sign-in screen."
              : "You will return to the sign-in screen on this device. Your saved records will stay safe, but unsaved changes on this page may be lost."}
          </Text>

          <View style={styles.noticeCard}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color={agriPalette.field}
            />
            <Text style={styles.noticeText}>
              {loading
                ? "Finishing logout safely..."
                : "Use logout when you are done so the next person does not open your account on this device."}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={agriPalette.field} />
              <Text style={styles.loadingText}>
                Removing local session data and push-device access.
              </Text>
            </View>
          ) : null}

          <View style={styles.actionStack}>
            <AgriButton
              title="Stay signed in"
              subtitle="Return to the current screen"
              icon="arrow-left"
              variant="secondary"
              compact
              trailingIcon={null}
              disabled={loading}
              onPress={onCancel}
            />
            <AgriButton
              title={loading ? "Signing out" : "Log out now"}
              subtitle={
                loading
                  ? "Please wait a moment"
                  : "End this account session securely"
              }
              icon="logout"
              variant="danger"
              compact
              trailingIcon={null}
              loading={loading}
              disabled={loading}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: 22,
    backgroundColor: "rgba(16, 27, 19, 0.42)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 24,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    shadowColor: "#122118",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  iconShell: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    marginTop: 16,
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  copy: {
    marginTop: 10,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 18,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  noticeText: {
    flex: 1,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#E7F2EA",
    borderWidth: 1,
    borderColor: "#C9DEC8",
  },
  loadingText: {
    flex: 1,
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  actionStack: {
    gap: 12,
    marginTop: 18,
  },
});
