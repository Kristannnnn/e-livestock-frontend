import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { agriPalette, gradientSets } from "../constants/agriTheme";

const variants = {
  primary: gradientSets.primary,
  meadow: gradientSets.meadow,
  secondary: gradientSets.wheat,
  earth: gradientSets.earth,
  sky: gradientSets.sky,
  muted: gradientSets.muted,
  danger: gradientSets.danger,
};

export default function AgriButton({
  title,
  subtitle,
  icon,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  trailingIcon = "arrow-right",
  style,
  contentStyle,
  compact = false,
  lightText,
}) {
  const colors = variants[variant] || variants.primary;
  const useLightText =
    lightText ?? !["secondary", "muted"].includes(variant);
  const iconColor = useLightText ? agriPalette.white : agriPalette.fieldDeep;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.button,
          compact && styles.compactButton,
          disabled && styles.disabled,
          contentStyle,
        ]}
      >
        {icon ? (
          <View
            style={[
              styles.iconWrap,
              useLightText ? styles.lightIconWrap : styles.darkIconWrap,
            ]}
          >
            <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
          </View>
        ) : null}

        <View style={styles.textWrap}>
          <Text
            style={[
              styles.title,
              useLightText ? styles.lightTitle : styles.darkTitle,
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                useLightText ? styles.lightSubtitle : styles.darkSubtitle,
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={iconColor} />
        ) : trailingIcon ? (
          <MaterialCommunityIcons
            name={trailingIcon}
            size={20}
            color={iconColor}
          />
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
  },
  pressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },
  button: {
    minHeight: 74,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  compactButton: {
    minHeight: 62,
    borderRadius: 20,
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.72,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  lightIconWrap: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  darkIconWrap: {
    backgroundColor: "rgba(31,77,46,0.1)",
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
  },
  lightTitle: {
    color: agriPalette.white,
  },
  darkTitle: {
    color: agriPalette.fieldDeep,
  },
  lightSubtitle: {
    color: "rgba(255,255,255,0.82)",
  },
  darkSubtitle: {
    color: "rgba(31,77,46,0.72)",
  },
});
