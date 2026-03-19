import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Provider as PaperProvider,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import AgriButton from "../components/AgriButton";
import FeedbackBanner from "../components/FeedbackBanner";
import { apiRoutes, apiUrl } from "../lib/api";
import { agriPalette, agriPaperTheme } from "../constants/agriTheme";

const API_URL = apiUrl(apiRoutes.auth.login);

function getParamValue(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function buildAuthNotice(noticeKey) {
  const key = String(noticeKey || "").trim().toLowerCase();

  if (key === "password_reset") {
    return {
      tone: "success",
      title: "Password updated",
      message: "Sign in with your new password to continue to your dashboard.",
    };
  }

  if (key === "email_verified") {
    return {
      tone: "success",
      title: "Email verified",
      message: "Your account is ready. Sign in to start using e-Livestock.",
    };
  }

  return null;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Login() {
  return (
    <PaperProvider theme={agriPaperTheme}>
      <LoginScreen />
    </PaperProvider>
  );
}

function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const isCompact = width < 560;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setNotice(buildAuthNotice(getParamValue(params.notice)));
  }, [params.notice]);

  const handleLogin = async () => {
    if (!username || !password) {
      setNotice({
        tone: "error",
        title: "Missing credentials",
        message: "Please enter both username and password before signing in.",
      });
      return;
    }

    try {
      setLoading(true);
      setNotice({
        tone: "info",
        title: "Signing you in",
        message: "Checking your account details and opening your workspace.",
      });
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const text = await response.text();
      let result;

      if (!text.trim()) {
        throw new Error(
          `Server returned an empty response (HTTP ${response.status}) from ${API_URL}`
        );
      }

      try {
        result = JSON.parse(text);
      } catch (_error) {
        throw new Error(
          `Server did not return valid JSON (HTTP ${response.status}). Got: ${text}`
        );
      }

      setLoading(false);

      if (result.success) {
        await AsyncStorage.multiSet([
          ["token", result.token],
          ["role", result.user.account_type],
          ["first_name", result.user.first_name || ""],
          ["last_name", result.user.last_name || ""],
          ["username", result.user.username || ""],
          ["email", result.user.email || ""],
          ["contact_number", result.user.contact_number || ""],
          ["address", result.user.address || ""],
          ["account_id", String(result.user.account_id)],
          ["user", JSON.stringify(result.user)],
        ]);

        setNotice({
          tone: "success",
          title: "Signed in successfully",
          message: "Your dashboard is opening now.",
        });
        await pause(650);

        switch (result.user.account_type) {
          case "user":
            router.replace("/(mobile)/ownerDashboard");
            break;
          case "admin":
            router.replace("/(admin)/dashboard");
            break;
          case "AntemortemInspector":
            router.replace("/antemortemDashboard");
            break;
          case "livestockInspector":
            router.replace("/livestockInspectorDashboard");
            break;
          default:
            setNotice({
              tone: "error",
              title: "Unknown account type",
              message: "This account does not have a supported dashboard yet.",
            });
        }
      } else {
        setNotice({
          tone: "error",
          title: "Login failed",
          message: result.message || "Invalid credentials.",
        });
      }
    } catch (error) {
      setLoading(false);
      console.error("Login error:", error);
      setNotice({
        tone: "error",
        title: "Unable to sign in",
        message: error.message || "Something went wrong.",
      });
    }
  };

  return (
    <LinearGradient
      colors={[agriPalette.fieldDeep, agriPalette.field, agriPalette.cream]}
      locations={[0, 0.44, 1]}
      style={styles.root}
    >
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View
            style={[
              styles.page,
              {
                flexDirection: isWide ? "row" : "column",
                alignItems: isWide ? "center" : "stretch",
                paddingHorizontal: isCompact ? 16 : 20,
                paddingVertical: isCompact ? 18 : 30,
              },
            ]}
          >
            <View style={[styles.heroColumn, isWide && styles.heroColumnWide]}>
              <View style={styles.brandRow}>
                <Image
                  source={require("../assets/logo.png")}
                  style={[styles.logo, isCompact && styles.logoCompact]}
                />
                <View style={styles.brandTextWrap}>
                  <Text style={styles.eyebrow}>Municipal Agriculture Office</Text>
                  <Text style={[styles.logoText, isCompact && styles.logoTextCompact]}>
                    e-Livestock services for Sipocot
                  </Text>
                </View>
              </View>

              <View style={styles.heroPill}>
                <MaterialCommunityIcons
                  name="sprout"
                  size={18}
                  color={agriPalette.white}
                />
                <Text style={styles.heroPillText}>
                  Connected livestock records
                </Text>
              </View>

              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                Modern field access for permits, schedules, and inspections.
              </Text>
              <Text
                style={[styles.heroSubtitle, isCompact && styles.heroSubtitleCompact]}
              >
                Sign in to manage livestock documents with a cleaner,
                agriculture-led dashboard experience.
              </Text>

              <View style={styles.heroChipRow}>
                <InfoChip label="Permit tracking" />
                <InfoChip label="Inspection status" />
                <InfoChip label="QR-ready records" />
              </View>
            </View>

            <View
              style={[
                styles.card,
                isCompact && styles.cardCompact,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text style={styles.cardEyebrow}>Secure Login</Text>
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                Welcome back
              </Text>
              <Text style={styles.cardSubtitle}>
                Access your e-Livestock account and continue your field
                operations.
              </Text>

              {notice ? (
                <FeedbackBanner
                  tone={notice.tone}
                  title={notice.title}
                  message={notice.message}
                  style={styles.noticeBanner}
                />
              ) : null}

              <TextInput
                label="Username"
                mode="outlined"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                left={<TextInput.Icon icon="account" />}
                outlineColor={colors.outline}
                activeOutlineColor={colors.primary}
              />

              <TextInput
                label="Password"
                mode="outlined"
                secureTextEntry={secureText}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={secureText ? "eye-off" : "eye"}
                    onPress={() => setSecureText(!secureText)}
                  />
                }
                outlineColor={colors.outline}
                activeOutlineColor={colors.primary}
              />

              <TouchableOpacity
                onPress={() => router.push("/sendOtp")}
                style={styles.linkWrap}
              >
                <Text variant="bodySmall" style={styles.linkText}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              <AgriButton
                title="Login"
                subtitle="Open your livestock dashboard"
                icon="login"
                onPress={handleLogin}
                loading={loading}
              />

              <View style={styles.signupContainer}>
                <Text variant="bodyMedium" style={styles.signupText}>
                  Do not have an account?
                </Text>
                <TouchableOpacity onPress={() => router.push("/register")}>
                  <Text variant="bodyMedium" style={styles.signupLink}>
                    Sign up here
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function InfoChip({ label }) {
  return (
    <View style={styles.infoChip}>
      <Text style={styles.infoChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  glowTopLeft: {
    position: "absolute",
    top: -90,
    left: -20,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(240,212,142,0.18)",
  },
  glowBottomRight: {
    position: "absolute",
    bottom: -60,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  page: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    justifyContent: "center",
  },
  heroColumn: {
    width: "100%",
    marginBottom: 20,
  },
  heroColumnWide: {
    flex: 1,
    paddingRight: 28,
    marginBottom: 0,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 84,
    height: 84,
    resizeMode: "contain",
    marginRight: 16,
  },
  logoCompact: {
    width: 68,
    height: 68,
    marginRight: 12,
  },
  brandTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: "rgba(255,244,214,0.86)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  logoText: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    color: agriPalette.white,
  },
  logoTextCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroPillText: {
    marginLeft: 8,
    color: agriPalette.white,
    fontSize: 13,
    fontWeight: "800",
  },
  heroTitle: {
    color: agriPalette.white,
    fontSize: Platform.OS === "web" ? 40 : 32,
    fontWeight: "900",
    lineHeight: Platform.OS === "web" ? 46 : 38,
    maxWidth: 620,
  },
  heroTitleCompact: {
    fontSize: 28,
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: 14,
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 560,
  },
  heroSubtitleCompact: {
    fontSize: 15,
    lineHeight: 22,
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },
  infoChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  infoChipText: {
    color: agriPalette.white,
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 440 : 520,
    alignSelf: "center",
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: agriPalette.border,
    shadowColor: "#10251a",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 6,
  },
  cardCompact: {
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  cardEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cardTitle: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: "900",
  },
  cardSubtitle: {
    marginTop: 10,
    marginBottom: 20,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    marginBottom: 14,
    backgroundColor: agriPalette.white,
  },
  noticeBanner: {
    marginBottom: 16,
  },
  linkWrap: {
    alignSelf: "flex-end",
    marginBottom: 14,
  },
  linkText: {
    color: agriPalette.field,
    fontWeight: "700",
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 18,
  },
  signupText: {
    color: agriPalette.inkSoft,
  },
  signupLink: {
    color: agriPalette.field,
    fontWeight: "700",
    marginLeft: 6,
  },
});
