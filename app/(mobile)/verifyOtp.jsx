import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TextInput } from "react-native-paper";
import AgriButton from "../../components/AgriButton";
import AuthRecoveryShell from "../../components/AuthRecoveryShell";
import FeedbackBanner from "../../components/FeedbackBanner";
import { apiRoutes, apiUrl } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const VERIFY_OTP_URL = apiUrl(apiRoutes.auth.verifyOtp);

function getParamValue(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function VerifyOtp() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = getParamValue(params.email);
  const purpose = getParamValue(params.purpose) || "reset";
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!email) {
      setNotice({
        tone: "error",
        title: "Missing email",
        message: "Returning to login.",
      });

      const timeoutId = setTimeout(() => {
        router.replace("/");
      }, 900);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [email, router]);

  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.replace(/\D/g, "").slice(0, 6);

    if (!trimmedOtp) {
      setNotice({
        tone: "error",
        title: "OTP required",
        message: "Enter the 6-digit code.",
      });
      return;
    }

    setLoading(true);
    setNotice({
      tone: "info",
      title: "Verifying your code",
      message: "Checking your code.",
    });

    try {
      const response = await fetch(VERIFY_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: trimmedOtp, purpose }),
      });
      const result = await response.json();

      if (!result.success) {
        setNotice({
          tone: "error",
          title: "OTP verification failed",
          message: result.message || "Invalid OTP.",
        });
        return;
      }

      setNotice({
        tone: "success",
        title: "OTP verified",
        message:
          purpose === "register"
            ? "Email verified. Returning to login."
            : "Code accepted. Opening password reset.",
      });
      await pause(700);

      if (purpose === "register") {
        router.replace({ pathname: "/", params: { notice: "email_verified" } });
      } else if (purpose === "reset") {
        router.replace({ pathname: "/resetPassword", params: { email } });
      }
    } catch (error) {
      console.error(error);
      setNotice({
        tone: "error",
        title: "Verification failed",
        message: error.message || "Network error.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthRecoveryShell
      eyebrow="OTP verification"
      title="Confirm your recovery code"
      subtitle="Enter the one-time password sent to your email."
      step={2}
    >
      <Text style={styles.sectionEyebrow}>Verification</Text>
      <Text style={styles.sectionTitle}>Enter the OTP</Text>
      <Text style={styles.sectionCopy}>Use the 6-digit code from your email.</Text>

      {notice ? (
        <FeedbackBanner
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          style={styles.noticeBanner}
        />
      ) : null}

      <View style={styles.emailCard}>
        <View style={styles.emailIconWrap}>
          <MaterialCommunityIcons
            name="email-lock-outline"
            size={20}
            color={agriPalette.fieldDeep}
          />
        </View>
        <View style={styles.emailTextWrap}>
          <Text style={styles.emailLabel}>Sent to</Text>
          <Text style={styles.emailValue}>{email || "Email not available"}</Text>
        </View>
      </View>

      <TextInput
        label="6-digit OTP"
        mode="outlined"
        value={otp}
        onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        left={<TextInput.Icon icon="shield-key-outline" />}
        style={styles.input}
        outlineColor={agriPalette.border}
        activeOutlineColor={agriPalette.field}
        contentStyle={styles.otpInputContent}
        theme={{
          colors: {
            background: agriPalette.surface,
          },
        }}
      />

      <View style={styles.tipBox}>
        <MaterialCommunityIcons
          name="timer-sand"
          size={18}
          color={agriPalette.wheat}
        />
        <Text style={styles.tipText}>No code yet? Go back and request another one.</Text>
      </View>

      <View style={styles.actionStack}>
        <AgriButton
          title="Verify OTP"
          icon="check-decagram-outline"
          loading={loading}
          disabled={loading}
          onPress={handleVerifyOtp}
        />
        <AgriButton
          title="Back"
          icon="arrow-left"
          variant="secondary"
          trailingIcon={false}
          disabled={loading}
          onPress={() => router.replace("/sendOtp")}
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
  emailCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  emailIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F2EA",
    marginRight: 12,
  },
  emailTextWrap: {
    flex: 1,
  },
  emailLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emailValue: {
    marginTop: 5,
    color: agriPalette.fieldDeep,
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    marginTop: 18,
    backgroundColor: agriPalette.surface,
  },
  otpInputContent: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 8,
    textAlign: "center",
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
