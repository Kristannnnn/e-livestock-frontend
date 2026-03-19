import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { agriPalette } from "../constants/agriTheme";

const toneMap = {
  success: {
    icon: "check-decagram-outline",
    accent: "#1F7A4C",
    backgroundColor: "#E8F5EC",
    borderColor: "#CBE5D4",
    titleColor: "#1C5D3B",
    copyColor: "#315845",
  },
  error: {
    icon: "alert-circle-outline",
    accent: agriPalette.redClay,
    backgroundColor: "#F9E5DD",
    borderColor: "#E7BEAD",
    titleColor: "#8A432A",
    copyColor: "#7B5243",
  },
  warning: {
    icon: "alert-outline",
    accent: "#946A12",
    backgroundColor: "#FBF2D3",
    borderColor: "#E8D08B",
    titleColor: "#7A5A12",
    copyColor: "#705E33",
  },
  info: {
    icon: "information-outline",
    accent: "#315E8F",
    backgroundColor: "#E8EFF8",
    borderColor: "#C8D7EA",
    titleColor: "#294D74",
    copyColor: "#4B6178",
  },
};

export default function FeedbackBanner({
  tone = "info",
  title,
  message,
  style,
}) {
  if (!title && !message) {
    return null;
  }

  const palette = toneMap[tone] || toneMap.info;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: "rgba(255,255,255,0.7)",
            borderColor: palette.borderColor,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={palette.icon}
          size={21}
          color={palette.accent}
        />
      </View>

      <View style={styles.body}>
        {title ? (
          <Text style={[styles.title, { color: palette.titleColor }]}>{title}</Text>
        ) : null}
        {message ? (
          <Text style={[styles.message, { color: palette.copyColor }]}>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
});
