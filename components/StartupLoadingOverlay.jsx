import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from "react-native";
import { agriPalette } from "../constants/agriTheme";

export default function StartupLoadingOverlay() {
  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={[agriPalette.fieldDeep, agriPalette.field, "#7DA274"]}
        locations={[0, 0.58, 1]}
        style={styles.background}
      >
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.card}>
          <View style={styles.brandRow}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.brandCopy}>
              <Text style={styles.eyebrow}>Municipal Agriculture Office</Text>
              <Text style={styles.title}>e-Livestock services for Sipocot</Text>
            </View>
          </View>

          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color={agriPalette.fieldDeep} />
            <View style={styles.loadingCopy}>
              <Text style={styles.loadingTitle}>Preparing your workspace</Text>
              <Text style={styles.loadingText}>
                Loading the secure app shell, routes, and startup services for web
                and mobile.
              </Text>
            </View>
          </View>

          <View style={styles.progressPill}>
            <Text style={styles.progressText}>Starting safely...</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  background: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  glowTop: {
    position: "absolute",
    top: -88,
    left: -36,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(240, 212, 142, 0.18)",
  },
  glowBottom: {
    position: "absolute",
    right: -42,
    bottom: -78,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 34,
    paddingHorizontal: 24,
    paddingVertical: 26,
    backgroundColor: "rgba(255, 253, 247, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(208, 216, 193, 0.96)",
    ...Platform.select({
      web: {
        boxShadow: "0px 28px 54px rgba(18, 33, 24, 0.18)",
      },
      default: {
        shadowColor: "#122118",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
        elevation: 10,
      },
    }),
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 72,
    height: 72,
  },
  brandCopy: {
    flex: 1,
  },
  eyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    color: agriPalette.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  loadingPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 24,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#F4EEDC",
    borderWidth: 1,
    borderColor: "#DDD2B9",
  },
  loadingCopy: {
    flex: 1,
  },
  loadingTitle: {
    color: agriPalette.fieldDeep,
    fontSize: 17,
    fontWeight: "800",
  },
  loadingText: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  progressPill: {
    alignSelf: "flex-start",
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(47, 107, 61, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(47, 107, 61, 0.16)",
  },
  progressText: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "700",
  },
});
