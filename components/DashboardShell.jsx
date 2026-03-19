import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { agriPalette } from "../constants/agriTheme";

function buildEmptySessionProfile() {
  return {
    firstName: "",
    lastName: "",
    role: "",
    profilePicture: "",
  };
}

function getProfileInitials(firstName, lastName) {
  const initials = `${(firstName || "").trim().charAt(0)}${(lastName || "")
    .trim()
    .charAt(0)}`.toUpperCase();

  return initials || "U";
}

function formatRoleLabel(role) {
  const roleMap = {
    user: "Livestock owner",
    livestockInspector: "Livestock inspector",
    AntemortemInspector: "Antemortem inspector",
    admin: "Administrator",
  };

  return roleMap[role] || "Account user";
}

export default function DashboardShell({
  eyebrow,
  title,
  subtitle,
  summary,
  children,
  contentContainerStyle,
  refreshControl,
  profilePlacement = "none",
}) {
  const [sessionProfile, setSessionProfile] = useState(buildEmptySessionProfile);

  useEffect(() => {
    if (profilePlacement === "none") {
      setSessionProfile(buildEmptySessionProfile());
      return undefined;
    }

    let mounted = true;

    const loadSessionProfile = async () => {
      try {
        const [storedUser, storedFirstName, storedLastName, storedRole] =
          await Promise.all([
            AsyncStorage.getItem("user"),
            AsyncStorage.getItem("first_name"),
            AsyncStorage.getItem("last_name"),
            AsyncStorage.getItem("role"),
          ]);

        const parsedUser = storedUser ? JSON.parse(storedUser) : {};

        if (!mounted) {
          return;
        }

        setSessionProfile({
          firstName: parsedUser.first_name || storedFirstName || "",
          lastName: parsedUser.last_name || storedLastName || "",
          role: parsedUser.account_type || storedRole || "",
          profilePicture: parsedUser.profile_picture || "",
        });
      } catch (error) {
        console.error("Failed to load dashboard profile:", error);
      }
    };

    loadSessionProfile();

    return () => {
      mounted = false;
    };
  }, [profilePlacement]);

  const displayName = `${sessionProfile.firstName} ${sessionProfile.lastName}`.trim();
  const roleLabel = formatRoleLabel(sessionProfile.role);
  const showInlineProfile = profilePlacement === "inlineTitle";
  const showProfilePanel = profilePlacement === "panel";

  const profileAvatar = (
    <View
      style={[
        styles.profileAvatarShell,
        showInlineProfile && styles.profileAvatarShellInline,
      ]}
    >
      {sessionProfile.profilePicture ? (
        <Image
          source={{ uri: sessionProfile.profilePicture }}
          style={[
            styles.profileAvatar,
            showInlineProfile && styles.profileAvatarInline,
          ]}
        />
      ) : (
        <View
          style={[
            styles.profileFallback,
            showInlineProfile && styles.profileFallbackInline,
          ]}
        >
          <Text
            style={[
              styles.profileFallbackText,
              showInlineProfile && styles.profileFallbackTextInline,
            ]}
          >
            {getProfileInitials(sessionProfile.firstName, sessionProfile.lastName)}
          </Text>
        </View>
      )}
    </View>
  );

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
          refreshControl={refreshControl}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        >
          <View style={styles.maxWidth}>
            <View style={styles.heroCard}>
              <View style={styles.heroContent}>
                <View style={styles.heroTextWrap}>
                  {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                  <View style={showInlineProfile && styles.inlineTitleRow}>
                    {showInlineProfile ? profileAvatar : null}
                    <View style={showInlineProfile && styles.inlineTitleTextWrap}>
                      <Text style={styles.title}>{title}</Text>
                      {showInlineProfile ? (
                        <Text style={styles.inlineProfileRole}>{roleLabel}</Text>
                      ) : null}
                    </View>
                  </View>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                  {summary ? (
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryText}>{summary}</Text>
                    </View>
                  ) : null}
                </View>

                {showProfilePanel ? (
                  <View style={styles.profilePanel}>
                    {profileAvatar}

                    <View style={styles.profileTextWrap}>
                      <Text style={styles.profileLabel}>Signed in as</Text>
                      <Text style={styles.profileName}>
                        {displayName || "Current user"}
                      </Text>
                      <Text style={styles.profileRole}>{roleLabel}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
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
  heroContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  heroTextWrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 320,
    minWidth: 220,
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
  inlineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  inlineTitleTextWrap: {
    flex: 1,
  },
  inlineProfileRole: {
    marginTop: 6,
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    fontWeight: "700",
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
  profilePanel: {
    flexBasis: 220,
    minWidth: 220,
    maxWidth: 280,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  profileAvatarShell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    backgroundColor: "rgba(240,212,142,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarShellInline: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
  },
  profileAvatarInline: {
    borderRadius: 33,
  },
  profileFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
    backgroundColor: agriPalette.fieldDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  profileFallbackInline: {
    borderRadius: 33,
  },
  profileFallbackText: {
    color: agriPalette.white,
    fontSize: 22,
    fontWeight: "900",
  },
  profileFallbackTextInline: {
    fontSize: 24,
  },
  profileTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  profileLabel: {
    color: "rgba(255,244,214,0.8)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  profileName: {
    marginTop: 6,
    color: agriPalette.white,
    fontSize: 18,
    fontWeight: "900",
  },
  profileRole: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 18,
  },
});
