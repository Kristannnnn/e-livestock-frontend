import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import LogoutConfirmModal from "../../components/LogoutConfirmModal";
import StatCard from "../../components/StatCard";
import { apiRoutes, apiUrl } from "../../lib/api";
import logoutSession from "../../lib/auth/logoutSession";
import { agriPalette } from "../../constants/agriTheme";

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [analytics, setAnalytics] = useState({
    slaughtered: 0,
    scheduled: 0,
    pending: 0,
    ongoing: 0,
  });

  async function fetchAnalytics() {
    setLoading(true);

    try {
      const response = await fetch(
        apiUrl(apiRoutes.antemortem.analytics)
      );

      const result = await response.json();

      if (result.status === "success") {
        setAnalytics({
          slaughtered: parseInt(result.data.total_slaughtered, 10) || 0,
          scheduled: parseInt(result.data.total_scheduled, 10) || 0,
          pending: parseInt(result.data.total_pending, 10) || 0,
          ongoing: parseInt(result.data.total_ongoing, 10) || 0,
        });
      } else {
        console.log("API error:", result.message);
        Alert.alert("Error", "Failed to load analytics.");
      }
    } catch (error) {
      console.log("Analytics fetch error:", error);
      Alert.alert("Error", "Failed to load analytics.");
    }

    setLoading(false);
  }

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        const parsedUser = storedUser ? JSON.parse(storedUser) : {};
        setFirstName(parsedUser.first_name || "");
      } catch (error) {
        console.error("Failed to load antemortem session:", error);
      }
    };

    loadSession();
    fetchAnalytics();
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
      eyebrow="Antemortem inspection"
      profilePlacement="inlineTitle"
      title={
        firstName
          ? `Welcome back, Dr. ${firstName}`
          : "Welcome back, Antemortem Inspector"
      }
      subtitle="Follow slaughter preparation, scheduled inspections, and pending checks from a dashboard that keeps your profile and next actions visible right away."
      summary={
        loading
          ? "Refreshing antemortem analytics..."
          : `${analytics.scheduled} scheduled and ${analytics.ongoing} ongoing inspections right now.`
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
          label="Slaughtered"
          value={analytics.slaughtered}
          caption="Completed animal inspections and processing records."
          icon="cow"
          accent="meadow"
          loading={loading}
        />
        <StatCard
          label="Scheduled"
          value={analytics.scheduled}
          caption="Upcoming livestock checks already queued."
          icon="calendar-check-outline"
          accent="wheat"
          loading={loading}
        />
        <StatCard
          label="Pending"
          value={analytics.pending}
          caption="Requests still waiting for an antemortem review."
          icon="clock-outline"
          accent="clay"
          loading={loading}
        />
        <StatCard
          label="Ongoing"
          value={analytics.ongoing}
          caption="Inspections currently in progress in the field."
          icon="progress-clock"
          accent="sky"
          loading={loading}
        />
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Action center</Text>
        <Text style={styles.cardTitle}>Continue the antemortem workflow</Text>
        <Text style={styles.cardCopy}>
          These shortcuts guide the next field step: open the schedule board,
          verify a QR on-site, adjust your profile, or sign out when the round
          is complete.
        </Text>

        <View style={styles.actionStack}>
          <AgriButton
            title="Open schedule board"
            subtitle="Review pending, accepted, ongoing, and completed visits before heading to the field."
            icon="calendar-month-outline"
            variant="primary"
            onPress={() => router.push("/antemortemSchedules")}
          />
          <AgriButton
            title="Verify permit QR"
            subtitle="Launch the scanner to confirm a livestock record before inspection starts on-site."
            icon="qrcode-scan"
            variant="secondary"
            onPress={() => router.push("/antemortemScanQRcode")}
          />
          <AgriButton
            title="Manage profile settings"
            subtitle="Update your antemortem account details so schedule activity and notifications stay accurate."
            icon="cog-outline"
            variant="sky"
            onPress={() => router.push("/settings")}
          />
          <AgriButton
            title="End this field session"
            subtitle="Sign out securely after reviewing schedules, scans, and inspection progress."
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
  surfaceCard: {
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
  cardEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cardTitle: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 25,
    fontWeight: "900",
  },
  cardCopy: {
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
