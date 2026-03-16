import { LinearGradient } from "expo-linear-gradient";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { agriPalette } from "../constants/agriTheme";

export default function AppHeader() {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[agriPalette.fieldDeep, agriPalette.field]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <Image
          source={require("../assets/favicon.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.titleWrap}>
          <Text style={styles.title}>Region V</Text>
          <Text style={styles.subtitle}>Livestock Inspection Services</Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>Field Ready</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: Platform.OS === "web" ? 0 : 38,
    left: 14,
    right: 14,
    zIndex: 100,
  },
  container: {
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#10251a",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  logo: {
    width: 42,
    height: 42,
    marginRight: 12,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: "900",
    color: agriPalette.white,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: agriPalette.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
