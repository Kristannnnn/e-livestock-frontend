import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { agriPalette, statAccents } from "../constants/agriTheme";

export default function StatCard({
  label,
  value,
  caption,
  icon,
  accent = "meadow",
  loading = false,
  onPress,
  style,
}) {
  const colors = statAccents[accent] || statAccents.meadow;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      <View style={styles.card}>
        <View style={[styles.accentBar, { backgroundColor: colors[1] }]} />

        <View style={styles.cardTop}>
          <View style={styles.textWrap}>
            <Text style={styles.label}>{label}</Text>
            {loading ? (
              <ActivityIndicator
                color={agriPalette.field}
                style={styles.loader}
              />
            ) : (
              <Text style={styles.value}>{value}</Text>
            )}
          </View>

          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: colors[0] }]}>
              <MaterialCommunityIcons
                name={icon}
                size={22}
                color={agriPalette.fieldDeep}
              />
            </View>
          ) : null}
        </View>

        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 150,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  card: {
    minHeight: 148,
    borderRadius: 26,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 4,
  },
  accentBar: {
    width: 56,
    height: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  textWrap: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    color: agriPalette.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    marginTop: 10,
    color: agriPalette.ink,
    fontSize: 34,
    fontWeight: "900",
  },
  loader: {
    marginTop: 14,
    alignSelf: "flex-start",
  },
  caption: {
    marginTop: 14,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
