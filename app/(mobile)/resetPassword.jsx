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

const API_RESET_PASSWORD = apiUrl(apiRoutes.auth.resetPassword);

function getParamValue(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = getParamValue(params.email);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [securePassword, setSecurePassword] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!email) {
      setNotice({
        tone: "error",
        title: "Missing email",
        message: "Returning to login so you can restart the recovery flow safely.",
      });

      const timeoutId = setTimeout(() => {
        router.replace("/");
      }, 900);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [email, router]);

  const resetPassword = async () => {
    if (!password || !confirm) {
      setNotice({
        tone: "error",
        title: "Missing fields",
        message: "Enter both password fields before updating your account password.",
      });
      return;
    }

    if (password.length < 6) {
      setNotice({
        tone: "warning",
        title: "Password too short",
        message: "Use at least 6 characters for your new password.",
      });
      return;
    }

    if (password !== confirm) {
      setNotice({
        tone: "error",
        title: "Passwords do not match",
        message: "Make sure both password entries are exactly the same.",
      });
      return;
    }

    setLoading(true);
    setNotice({
      tone: "info",
      title: "Updating password",
      message: "Saving your new login password and securing your account.",
    });

    try {
      const response = await fetch(API_RESET_PASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (result.success) {
        setNotice({
          tone: "success",
          title: "Password reset complete",
          message: "Your new password is ready. Returning you to login now.",
        });
        await pause(800);
        router.replace({ pathname: "/", params: { notice: "password_reset" } });
      } else {
        setNotice({
          tone: "error",
          title: "Password reset failed",
          message: result.message || "Failed to reset password.",
        });
      }
    } catch (error) {
      console.error(error);
      setNotice({
        tone: "error",
        title: "Update failed",
        message: error.message || "Unable to reset password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthRecoveryShell
      eyebrow="Reset password"
      title="Create a fresh password"
      subtitle="Set a new password for your e-Livestock account after your recovery code has already been verified."
      step={3}
    >
      <Text style={styles.sectionEyebrow}>Password update</Text>
      <Text style={styles.sectionTitle}>Finish your recovery</Text>
      <Text style={styles.sectionCopy}>
        Choose a new password for the account below. Use something secure and
        memorable so you can get back to your dashboard without friction.
      </Text>

      {notice ? (
        <FeedbackBanner
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          style={styles.noticeBanner}
        />
      ) : null}

      <View style={styles.accountCard}>
        <View style={styles.accountIconWrap}>
          <MaterialCommunityIcons
            name="account-lock-outline"
            size={20}
            color={agriPalette.fieldDeep}
          />
        </View>
        <View style={styles.accountTextWrap}>
          <Text style={styles.accountLabel}>Updating account</Text>
          <Text style={styles.accountValue}>{email || "Email not available"}</Text>
        </View>
      </View>

      <TextInput
        label="New password"
        mode="outlined"
        secureTextEntry={securePassword}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        left={<TextInput.Icon icon="lock-outline" />}
        right={
          <TextInput.Icon
            icon={securePassword ? "eye-off-outline" : "eye-outline"}
            onPress={() => setSecurePassword((current) => !current)}
          />
        }
        style={styles.input}
        outlineColor={agriPalette.border}
        activeOutlineColor={agriPalette.field}
        theme={{
          colors: {
            background: agriPalette.surface,
          },
        }}
      />

      <TextInput
        label="Confirm new password"
        mode="outlined"
        secureTextEntry={secureConfirm}
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="none"
        left={<TextInput.Icon icon="shield-check-outline" />}
        right={
          <TextInput.Icon
            icon={secureConfirm ? "eye-off-outline" : "eye-outline"}
            onPress={() => setSecureConfirm((current) => !current)}
          />
        }
        style={styles.inputSecondary}
        outlineColor={agriPalette.border}
        activeOutlineColor={agriPalette.field}
        theme={{
          colors: {
            background: agriPalette.surface,
          },
        }}
      />

      <View style={styles.requirementsCard}>
        <Text style={styles.requirementsTitle}>Password checklist</Text>
        <RequirementRow label="Use at least 6 characters" />
        <RequirementRow label="Keep the new password private" />
        <RequirementRow label="Make sure both entries match exactly" />
      </View>

      <View style={styles.actionStack}>
        <AgriButton
          title="Update password"
          subtitle="Save your new login password"
          icon="lock-reset"
          loading={loading}
          disabled={loading}
          onPress={resetPassword}
        />
        <AgriButton
          title="Back to login"
          subtitle="Return to sign in without changing more details"
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

function RequirementRow({ label }) {
  return (
    <View style={styles.requirementRow}>
      <MaterialCommunityIcons
        name="check-circle-outline"
        size={18}
        color={agriPalette.field}
      />
      <Text style={styles.requirementText}>{label}</Text>
    </View>
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
  accountCard: {
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
  accountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F2EA",
    marginRight: 12,
  },
  accountTextWrap: {
    flex: 1,
  },
  accountLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  accountValue: {
    marginTop: 5,
    color: agriPalette.fieldDeep,
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    marginTop: 18,
    backgroundColor: agriPalette.surface,
  },
  inputSecondary: {
    marginTop: 14,
    backgroundColor: agriPalette.surface,
  },
  requirementsCard: {
    marginTop: 18,
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
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  requirementText: {
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
