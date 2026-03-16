import { LinearGradient } from "expo-linear-gradient";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { agriPalette } from "../constants/agriTheme";

export default function DashboardShell({
  eyebrow,
  title,
  subtitle,
  summary,
  children,
  contentContainerStyle,
}) {
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[agriPalette.fieldDeep, agriPalette.field, agriPalette.cream]}
        locations={[0, 0.44, 1]}
        style={styles.background}
      >
        <View style={styles.orbTopLeft} />
        <View style={styles.orbRight} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        >
          <View style={styles.maxWidth}>
            <View style={styles.heroCard}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              {summary ? (
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryText}>{summary}</Text>
                </View>
              ) : null}
            </View>

            {children}
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: agriPalette.cream,
  },
  background: {
    flex: 1,
  },
  orbTopLeft: {
    position: "absolute",
    top: -90,
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(240,212,142,0.18)",
  },
  orbRight: {
    position: "absolute",
    top: 160,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 32,
  },
  maxWidth: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
  },
  heroCard: {
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 18,
    backgroundColor: "rgba(255,253,247,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    shadowColor: "#10251a",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 6,
  },
  eyebrow: {
    color: "rgba(255,244,214,0.88)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    color: agriPalette.white,
    fontSize: Platform.OS === "web" ? 34 : 30,
    fontWeight: "900",
    lineHeight: Platform.OS === "web" ? 40 : 35,
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 620,
  },
  summaryPill: {
    alignSelf: "flex-start",
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  summaryText: {
    color: agriPalette.white,
    fontSize: 13,
    fontWeight: "700",
  },
});
