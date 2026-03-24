import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { agriPalette } from "../constants/agriTheme";
import AgriButton from "./AgriButton";
import {
  dismissAppAlert,
  subscribeToAppAlerts,
} from "../lib/appAlert";

const TONE_STYLES = {
  success: {
    icon: "check-decagram-outline",
    eyebrow: "Success",
    accent: agriPalette.fieldDeep,
    surface: "#EAF5EE",
    border: "#B9D3C6",
    iconSurface: "#DCECE2",
    pillSurface: "#E1EFE8",
    pillText: agriPalette.fieldDeep,
    buttonVariant: "primary",
  },
  error: {
    icon: "alert-circle-outline",
    eyebrow: "Attention",
    accent: agriPalette.redClay,
    surface: "#F9E8E0",
    border: "#E5B6A4",
    iconSurface: "#F5DED5",
    pillSurface: "#F6E0D7",
    pillText: agriPalette.redClay,
    buttonVariant: "danger",
  },
  warning: {
    icon: "alert-outline",
    eyebrow: "Review",
    accent: "#8A6510",
    surface: "#FFF6E0",
    border: "#E8D08B",
    iconSurface: "#FBF0CD",
    pillSurface: "#FBF2D3",
    pillText: "#8A6510",
    buttonVariant: "secondary",
  },
  info: {
    icon: "information-outline",
    eyebrow: "Notice",
    accent: "#315E8F",
    surface: "#EDF3FA",
    border: "#C4D5EA",
    iconSurface: "#E2EAF5",
    pillSurface: "#E6EEF7",
    pillText: "#315E8F",
    buttonVariant: "sky",
  },
};

function getNoticeTone(notice) {
  const content = `${notice?.title || ""} ${notice?.message || ""}`
    .trim()
    .toLowerCase();

  if (
    content.includes("error") ||
    content.includes("failed") ||
    content.includes("unable") ||
    content.includes("invalid") ||
    content.includes("missing") ||
    content.includes("not found") ||
    content.includes("could not")
  ) {
    return "error";
  }

  if (
    content.includes("warning") ||
    content.includes("review") ||
    content.includes("check") ||
    content.includes("pending")
  ) {
    return "warning";
  }

  if (
    content.includes("success") ||
    content.includes("saved") ||
    content.includes("submitted") ||
    content.includes("completed") ||
    content.includes("accepted") ||
    content.includes("cancelled") ||
    content.includes("updated") ||
    content.includes("booked")
  ) {
    return "success";
  }

  return "info";
}

export default function AppAlertHost() {
  const [alerts, setAlerts] = useState([]);
  const currentAlert = alerts[0] || null;
  const tone = getNoticeTone(currentAlert);
  const appearance = useMemo(
    () => TONE_STYLES[tone] || TONE_STYLES.info,
    [tone]
  );

  useEffect(() => subscribeToAppAlerts(setAlerts), []);

  const handleDismiss = () => {
    if (!currentAlert) {
      return;
    }

    dismissAppAlert(currentAlert.id);
  };

  const handleBackdropPress = () => {
    if (!currentAlert?.options?.cancelable) {
      return;
    }

    const onDismiss = currentAlert.options?.onDismiss;
    handleDismiss();
    onDismiss?.();
  };

  const handlePrimaryAction = () => {
    if (!currentAlert) {
      return;
    }

    const primaryButton = currentAlert.buttons?.[0];
    handleDismiss();
    primaryButton?.onPress?.();
  };

  return (
    <Modal
      transparent
      visible={Boolean(currentAlert)}
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        <View style={styles.tint} />

        <View
          style={[
            styles.card,
            {
              borderColor: appearance.border,
              backgroundColor: agriPalette.surface,
            },
          ]}
        >
          <View
            style={[
              styles.accentBar,
              { backgroundColor: appearance.accent },
            ]}
          />

          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: appearance.iconSurface },
              ]}
            >
              <MaterialCommunityIcons
                name={appearance.icon}
                size={28}
                color={appearance.accent}
              />
            </View>

            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: appearance.accent }]}>
                {appearance.eyebrow}
              </Text>
              <Text style={styles.title}>
                {currentAlert?.title || "Notice"}
              </Text>
            </View>
          </View>

          {currentAlert?.message ? (
            <Text style={styles.message}>{currentAlert.message}</Text>
          ) : null}

          <View
            style={[
              styles.statusPill,
              { backgroundColor: appearance.pillSurface },
            ]}
          >
            <MaterialCommunityIcons
              name={appearance.icon}
              size={16}
              color={appearance.pillText}
            />
            <Text style={[styles.statusText, { color: appearance.pillText }]}>
              {currentAlert?.buttons?.[0]?.text || "OK"}
            </Text>
          </View>

          <AgriButton
            title={currentAlert?.buttons?.[0]?.text || "OK"}
            icon="check"
            variant={appearance.buttonVariant}
            compact
            trailingIcon={false}
            onPress={handlePrimaryAction}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 28, 22, 0.42)",
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 18,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: agriPalette.fieldDeep,
  },
  message: {
    fontSize: 17,
    lineHeight: 26,
    color: agriPalette.ink,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
