import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import LogoutConfirmModal from "../../components/LogoutConfirmModal";
import StatCard from "../../components/StatCard";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";
import logoutSession from "../../lib/auth/logoutSession";
import { agriPalette } from "../../constants/agriTheme";

const API_URL = apiUrl(apiRoutes.owner.forms);

function isFormExpired(expirationDate) {
  if (!expirationDate) {
    return true;
  }

  return new Date(expirationDate) < new Date();
}

function normalizeFullName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function matchesOwnerName(ownerName, firstName, lastName) {
  const normalizedOwner = normalizeFullName(ownerName);
  const normalizedFirst = normalizeFullName(firstName);
  const normalizedLast = normalizeFullName(lastName);

  if (!normalizedFirst && !normalizedLast) {
    return true;
  }

  return (
    (!normalizedFirst || normalizedOwner.includes(normalizedFirst)) &&
    (!normalizedLast || normalizedOwner.includes(normalizedLast))
  );
}

function scopeOwnerForms(forms, session) {
  const records = Array.isArray(forms) ? forms : [];
  const accountId = Number.parseInt(session.accountId || "", 10);

  if (accountId > 0) {
    return records;
  }

  return records.filter((form) =>
    matchesOwnerName(form.owner_name, session.firstName, session.lastName)
  );
}

async function requestOwnerForms(session) {
  const payload = {
    first_name: session.firstName || "",
    last_name: session.lastName || "",
  };

  if (session.accountId) {
    payload.account_id = Number.parseInt(session.accountId, 10);
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(
    response,
    `Owner dashboard API request failed (HTTP ${response.status}).`
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [analytics, setAnalytics] = useState({
    total: 0,
    expired: 0,
    valid: 0,
  });

  useEffect(() => {
    const loadOwnerDashboard = async () => {
      setLoading(true);

      try {
        const [storedFirstName, storedLastName, storedAccountId] =
          await Promise.all([
            AsyncStorage.getItem("first_name"),
            AsyncStorage.getItem("last_name"),
            AsyncStorage.getItem("account_id"),
          ]);

        if (storedFirstName) {
          setFirstName(storedFirstName);
        }

        const data = await requestOwnerForms({
          firstName: storedFirstName,
          lastName: storedLastName,
          accountId: storedAccountId,
        });

        if (data.status === "success") {
          const forms = scopeOwnerForms(data.forms, {
            firstName: storedFirstName,
            lastName: storedLastName,
            accountId: storedAccountId,
          });
          const expired = forms.filter((form) =>
            isFormExpired(form.qr_expiration)
          ).length;

          setAnalytics({
            total: forms.length,
            expired,
            valid: forms.length - expired,
          });
        } else {
          setAnalytics({ total: 0, expired: 0, valid: 0 });
        }
      } catch (error) {
        console.log(error);
        Alert.alert("Error", "Failed to load analytics.");
      }

      setLoading(false);
    };

    loadOwnerDashboard();
  }, []);

  const handleLogout = () => {
    if (loggingOut) {
      return;
    }

    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);
      await logoutSession();
      setLogoutModalVisible(false);
      router.replace("/");
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Logout failed",
        "We could not finish signing you out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <DashboardShell
      eyebrow="Livestock owner portal"
      profilePlacement="inlineTitle"
      title={
        firstName ? `Welcome back, ${firstName}` : "Welcome back to e-Livestock"
      }
      subtitle="Track only your own livestock forms, monitor expiring permits, and move from the stockyard to your next schedule without sorting through other users' records."
      summary={
        loading
          ? "Refreshing your livestock permit overview..."
          : `${analytics.valid} of your forms are still active for inspection and transport.`
      }
    >
      <LogoutConfirmModal
        visible={logoutModalVisible}
        loading={loggingOut}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={confirmLogout}
      />

      <View style={styles.statsGrid}>
        <StatCard
          label="My forms"
          value={analytics.total}
          caption="Only records filed under your account are counted here."
          icon="file-document-multiple-outline"
          accent="meadow"
          loading={loading}
          onPress={() => router.push("/stockyard")}
        />
        <StatCard
          label="Expired"
          value={analytics.expired}
          caption="Permits that already need renewal before the next movement."
          icon="calendar-remove-outline"
          accent="clay"
          loading={loading}
        />
        <StatCard
          label="Valid forms"
          value={analytics.valid}
          caption="Your records that are still usable for inspection and transport."
          icon="shield-check-outline"
          accent="wheat"
          loading={loading}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>Quick actions</Text>
        <Text style={styles.sectionTitle}>
          Start the owner task you need next
        </Text>
        <Text style={styles.sectionCopy}>
          Use these shortcuts as your owner workspace: review active permits,
          check booking progress, update your profile, or close the session
          once today&apos;s work is done.
        </Text>

        <View style={styles.actionStack}>
          <AgriButton
            title="Review stockyard records"
            subtitle="Open your permit list to inspect QR details, expiry dates, and renewal-ready forms."
            icon="barn"
            variant="primary"
            onPress={() => router.push("/stockyard")}
          />
          <AgriButton
            title="Track appointment progress"
            subtitle="Check upcoming visits, booked dates, and inspection updates tied to your livestock records."
            icon="calendar-month-outline"
            variant="sky"
            onPress={() => router.push("/checkSchedule")}
          />
          <AgriButton
            title="Manage account settings"
            subtitle="Update your owner profile information so records and notifications stay accurate."
            icon="cog-outline"
            variant="secondary"
            onPress={() => router.push("/settings")}
          />
          <AgriButton
            title="End this owner session"
            subtitle="Sign out securely after reviewing permits, schedules, and profile updates."
            icon="logout"
            variant="danger"
            onPress={handleLogout}
          />
        </View>
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 18,
  },
  sectionCard: {
    borderRadius: 30,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 22,
    paddingVertical: 22,
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
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
    fontSize: 25,
    fontWeight: "900",
  },
  sectionCopy: {
    marginTop: 10,
    marginBottom: 18,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  actionStack: {
    gap: 12,
  },
});
