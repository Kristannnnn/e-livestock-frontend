import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TextInput } from "react-native-paper";
import AgriButton from "../../components/AgriButton";
import AuthRecoveryShell from "../../components/AuthRecoveryShell";
import FeedbackBanner from "../../components/FeedbackBanner";
import { apiRoutes, apiUrl } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const API_SEND_OTP = apiUrl(apiRoutes.auth.sendOtp);

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SendOtp() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const sendOTP = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setNotice({
        tone: "error",
        title: "Email required",
        message: "Enter your account email.",
      });
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setNotice({
        tone: "warning",
        title: "Invalid email",
        message: "Enter a valid email address.",
      });
      return;
    }

    setLoading(true);
    setNotice({
      tone: "info",
      title: "Sending recovery code",
      message: "Sending a code to your email.",
    });

    try {
      const response = await fetch(API_SEND_OTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, purpose: "reset" }),
      });
      const rawText = await response.text();
      const result = rawText ? JSON.parse(rawText) : {};

      if (result.success) {
        setNotice({
          tone: "success",
          title: "Recovery code sent",
          message: "Check your inbox. Opening the next step.",
        });
        await pause(700);
        router.push({
          pathname: "/verifyOtp",
          params: { email: trimmedEmail, purpose: "reset" },
        });
      } else {
        setNotice({
          tone: "error",
          title: "Unable to send OTP",
          message: result.message || "Failed to send OTP.",
        });
      }
    } catch (error) {
      console.error(error);
      setNotice({
        tone: "error",
        title: "Request failed",
        message: error.message || "Unable to send OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthRecoveryShell
      eyebrow="Forgot password"
      title="Get a recovery code"
      subtitle="Enter your account email to receive a one-time password."
      step={1}
    >
      <Text style={styles.sectionEyebrow}>Email recovery</Text>
      <Text style={styles.sectionTitle}>Send code</Text>
      <Text style={styles.sectionCopy}>Use your registered email.</Text>

      {notice ? (
        <FeedbackBanner
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          style={styles.noticeBanner}
        />
      ) : null}

      <View style={styles.infoCard}>
        <View style={styles.infoIconWrap}>
          <MaterialCommunityIcons
            name="email-check-outline"
            size={20}
            color={agriPalette.fieldDeep}
          />
        </View>
        <View style={styles.infoTextWrap}>
          <Text style={styles.infoTitle}>Email on file</Text>
          <Text style={styles.infoCopy}>The code is sent only to the saved account email.</Text>
        </View>
      </View>

      <TextInput
        label="Email address"
        mode="outlined"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        left={<TextInput.Icon icon="email-outline" />}
        style={styles.input}
        outlineColor={agriPalette.border}
        activeOutlineColor={agriPalette.field}
        contentStyle={styles.inputContent}
        theme={{
          colors: {
            background: agriPalette.surface,
          },
        }}
      />

      <View style={styles.tipBox}>
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={18}
          color={agriPalette.field}
        />
        <Text style={styles.tipText}>Check inbox and spam.</Text>
      </View>

      <View style={styles.actionStack}>
        <AgriButton
          title="Send OTP"
          icon="send-outline"
          loading={loading}
          disabled={loading}
          onPress={sendOTP}
        />
        <AgriButton
          title="Back to login"
          icon="arrow-left"
          variant="secondary"
          trailingIcon={false}
          disabled={loading}
          onPress={() => router.replace("/")}
        />
      </View>
    </AuthRecoveryShell>
  );
}

const styles = StyleSheet.create({
  sectionEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  sectionCopy: {
    marginTop: 10,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  noticeBanner: {
    marginTop: 18,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F2EA",
    marginRight: 12,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    color: agriPalette.fieldDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  infoCopy: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    marginTop: 18,
    backgroundColor: agriPalette.surface,
  },
  inputContent: {
    fontSize: 15,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  tipText: {
    flex: 1,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  actionStack: {
    gap: 12,
    marginTop: 20,
  },
});
