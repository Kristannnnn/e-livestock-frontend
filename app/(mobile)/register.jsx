import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Provider as PaperProvider,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import AgriButton from "../../components/AgriButton";
import FeedbackBanner from "../../components/FeedbackBanner";
import { apiRoutes, apiUrl } from "../../lib/api";
import { agriPaperTheme, agriPalette } from "../../constants/agriTheme";

const API_URL = apiUrl(apiRoutes.auth.register);
const API_SEND_OTP = apiUrl(apiRoutes.auth.sendOtp);

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Register() {
  return (
    <PaperProvider theme={agriPaperTheme}>
      <RegisterScreen />
    </PaperProvider>
  );
}

function RegisterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const isTablet = width >= 720;
  const isCompact = width < 560;
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [notice, setNotice] = useState(null);

  const isValidEmail = (value) => value.includes("@");
  const isValidPhone = (value) => value.length === 11;

  const handleRegister = async () => {
    if (
      !firstname ||
      !lastname ||
      !address ||
      !email ||
      !phone ||
      !username ||
      !password
    ) {
      setNotice({
        tone: "error",
        title: "Missing details",
        message: "Please fill in all registration fields before creating your account.",
      });
      return;
    }

    if (!isValidEmail(email)) {
      setNotice({
        tone: "warning",
        title: "Invalid email",
        message: "Use a valid email address because registration ends with OTP verification.",
      });
      return;
    }

    if (!isValidPhone(phone)) {
      setNotice({
        tone: "warning",
        title: "Invalid phone number",
        message: "Phone number must be exactly 11 digits.",
      });
      return;
    }

    setLoading(true);
    setNotice({
      tone: "info",
      title: "Creating your account",
      message: "Saving your owner profile and preparing your email verification step.",
    });

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          address: address.trim(),
          email: email.trim().toLowerCase(),
          phone,
          username: username.trim(),
          password,
        }),
      });

      const rawText = await response.text();
      const result = rawText ? JSON.parse(rawText) : {};

      if (!result.success) {
        setNotice({
          tone: "error",
          title: "Registration failed",
          message: result.message || "Registration failed.",
        });
        return;
      }

      const otpRes = await fetch(API_SEND_OTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          purpose: "register",
        }),
      });

      const otpText = await otpRes.text();
      const otpResult = otpText ? JSON.parse(otpText) : {};

      if (!otpResult.success) {
        setNotice({
          tone: "error",
          title: "OTP not sent",
          message: otpResult.message || "Failed to send OTP.",
        });
        return;
      }

      setNotice({
        tone: "success",
        title: "Account created",
        message: "Your OTP is on the way. Opening the email verification step now.",
      });
      await pause(700);
      router.replace({
        pathname: "/verifyOtp",
        params: { email: email.trim().toLowerCase(), purpose: "register" },
      });
    } catch (error) {
      console.error(error);
      setNotice({
        tone: "error",
        title: "Request failed",
        message: "Network or server error.",
      });
    } finally {
      setLoading(false);
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
                  source={require("../../assets/logo.png")}
                  style={[styles.logo, isCompact && styles.logoCompact]}
                />
                <View style={styles.brandTextWrap}>
                  <Text style={styles.eyebrow}>Municipal Agriculture Office</Text>
                  <Text
                    style={[styles.logoText, isCompact && styles.logoTextCompact]}
                  >
                    Create your e-Livestock account
                  </Text>
                </View>
              </View>

              <View style={styles.heroPill}>
                <MaterialCommunityIcons
                  name="account-plus-outline"
                  size={18}
                  color={agriPalette.white}
                />
                <Text style={styles.heroPillText}>Owner onboarding flow</Text>
              </View>

              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                Register once and manage permits, schedules, and QR-ready records
                from one place.
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  isCompact && styles.heroSubtitleCompact,
                ]}
              >
                Build your livestock owner account with a cleaner mobile-first
                signup experience, then verify your email to unlock the full
                dashboard.
              </Text>

              <View style={styles.heroChipRow}>
                <InfoChip label="Email verification" />
                <InfoChip label="Permit access" />
                <InfoChip label="Schedule tracking" />
              </View>

              <View style={styles.heroChecklist}>
                <ChecklistRow label="Use your real owner name for accurate records" />
                <ChecklistRow label="Keep your email active for OTP verification" />
                <ChecklistRow label="Phone number must be exactly 11 digits" />
              </View>
            </View>

            <View
              style={[
                styles.card,
                isCompact && styles.cardCompact,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text style={styles.cardEyebrow}>Owner Signup</Text>
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                Create your account
              </Text>
              <Text style={styles.cardSubtitle}>
                Enter your personal and contact details, then we will send an OTP
                to verify your email before you sign in.
              </Text>

              {notice ? (
                <FeedbackBanner
                  tone={notice.tone}
                  title={notice.title}
                  message={notice.message}
                  style={styles.noticeBanner}
                />
              ) : null}

              <View style={styles.helperCard}>
                <View style={styles.helperIconWrap}>
                  <MaterialCommunityIcons
                    name="email-fast-outline"
                    size={18}
                    color={agriPalette.fieldDeep}
                  />
                </View>
                <View style={styles.helperTextWrap}>
                  <Text style={styles.helperTitle}>Verification note</Text>
                  <Text style={styles.helperCopy}>
                    Your email must be valid because registration ends with an OTP
                    verification step.
                  </Text>
                </View>
              </View>

              <View style={[styles.formGrid, isTablet && styles.formGridWide]}>
                <View style={[styles.fieldWrap, isTablet && styles.halfField]}>
                  <TextInput
                    label="First Name"
                    mode="outlined"
                    value={firstname}
                    onChangeText={setFirstname}
                    left={<TextInput.Icon icon="account-outline" />}
                    style={styles.input}
                    outlineColor={colors.outline}
                    activeOutlineColor={colors.primary}
                  />
                </View>
                <View style={[styles.fieldWrap, isTablet && styles.halfField]}>
                  <TextInput
                    label="Last Name"
                    mode="outlined"
                    value={lastname}
                    onChangeText={setLastname}
                    left={<TextInput.Icon icon="account-outline" />}
                    style={styles.input}
                    outlineColor={colors.outline}
                    activeOutlineColor={colors.primary}
                  />
                </View>
                <View style={[styles.fieldWrap, styles.fullWidthField]}>
                  <TextInput
                    label="Address"
                    mode="outlined"
                    value={address}
                    onChangeText={setAddress}
                    left={<TextInput.Icon icon="map-marker-outline" />}
                    style={styles.input}
                    outlineColor={colors.outline}
                    activeOutlineColor={colors.primary}
                  />
                </View>
                <View style={[styles.fieldWrap, isTablet && styles.halfField]}>
                  <TextInput
                    label="Email"
                    mode="outlined"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="email-outline" />}
                    style={styles.input}
                    outlineColor={colors.outline}
                    activeOutlineColor={colors.primary}
                  />
                </View>
                <View style={[styles.fieldWrap, isTablet && styles.halfField]}>
                  <TextInput
                    label="Phone Number"
                    mode="outlined"
                    value={phone}
                    onChangeText={(text) => {
                      const numeric = text.replace(/[^0-9]/g, "");
                      if (numeric.length <= 11) {
                        setPhone(numeric);
                      }
                    }}
                    keyboardType="phone-pad"
                    left={<TextInput.Icon icon="phone-outline" />}
                    style={styles.input}
                    outlineColor={colors.outline}
                    activeOutlineColor={colors.primary}
                  />
                </View>
                <View style={[styles.fieldWrap, isTablet && styles.halfField]}>
                  <TextInput
                    label="Username"
                    mode="outlined"
                    value={username}
                    onChangeText={setUsername}
                    left={<TextInput.Icon icon="badge-account-outline" />}
                    style={styles.input}
                    outlineColor={colors.outline}
                    activeOutlineColor={colors.primary}
                  />
                </View>
                <View style={[styles.fieldWrap, isTablet && styles.halfField]}>
                  <TextInput
                    label="Password"
                    mode="outlined"
                    secureTextEntry={secureText}
                    value={password}
                    onChangeText={setPassword}
                    left={<TextInput.Icon icon="lock-outline" />}
                    right={
                      <TextInput.Icon
                        icon={secureText ? "eye-off" : "eye"}
                        onPress={() => setSecureText(!secureText)}
                      />
                    }
                    style={styles.input}
                    outlineColor={colors.outline}
                    activeOutlineColor={colors.primary}
                  />
                </View>
              </View>

              <View style={styles.requirementsCard}>
                <Text style={styles.requirementsTitle}>Before you continue</Text>
                <Text style={styles.requirementsCopy}>
                  Make sure your name and email are correct. Those details are
                  used for verification and owner-linked schedule records.
                </Text>
              </View>

              <AgriButton
                title="Create account"
                subtitle="Register and request email verification"
                icon="sprout"
                loading={loading}
                onPress={handleRegister}
                disabled={loading}
                style={styles.registerButton}
              />

              <View style={styles.loginContainer}>
                <Text variant="bodyMedium" style={styles.loginText}>
                  Already have an account?
                </Text>
                <TouchableOpacity onPress={() => router.replace("/")}>
                  <Text variant="bodyMedium" style={styles.loginLink}>
                    Sign in here
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

function ChecklistRow({ label }) {
  return (
    <View style={styles.checklistRow}>
      <MaterialCommunityIcons
        name="check-circle-outline"
        size={18}
        color={agriPalette.white}
      />
      <Text style={styles.checklistText}>{label}</Text>
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
    maxWidth: 1140,
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
    maxWidth: 640,
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
    maxWidth: 580,
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
  heroChecklist: {
    marginTop: 22,
    maxWidth: 500,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 12,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checklistText: {
    flex: 1,
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 560 : 620,
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
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  noticeBanner: {
    marginTop: 16,
    marginBottom: 18,
  },
  helperCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  helperIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F2EA",
    marginRight: 12,
  },
  helperTextWrap: {
    flex: 1,
  },
  helperTitle: {
    color: agriPalette.fieldDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  helperCopy: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  formGrid: {
    gap: 12,
  },
  formGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  fieldWrap: {
    width: "100%",
  },
  halfField: {
    width: "48.6%",
  },
  fullWidthField: {
    width: "100%",
  },
  input: {
    backgroundColor: agriPalette.white,
  },
  requirementsCard: {
    marginTop: 6,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  requirementsTitle: {
    color: agriPalette.fieldDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  requirementsCopy: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  registerButton: {
    marginTop: 20,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 18,
  },
  loginText: {
    color: agriPalette.inkSoft,
  },
  loginLink: {
    color: agriPalette.field,
    fontWeight: "700",
    marginLeft: 6,
  },
});
