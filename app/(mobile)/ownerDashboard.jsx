import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import StatCard from "../../components/StatCard";
import { agriPalette } from "../../constants/agriTheme";

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [analytics, setAnalytics] = useState({
    total: 0,
    expired: 0,
    valid: 0,
  });

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const response = await fetch(
        "https://e-livestock.tulongkabataanbicol.com/eLiveStockAPI/API/get_owner_analytics_summary.php"
      );
      const data = await response.json();

      setAnalytics({
        total: data.total,
        expired: data.expired,
        valid: data.valid,
      });
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to load analytics.");
    }
    setLoading(false);
  }

  useEffect(() => {
    AsyncStorage.getItem("first_name").then((storedName) => {
      if (storedName) {
        setFirstName(storedName);
      }
    });

    fetchAnalytics();
  }, []);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <DashboardShell
      eyebrow="Livestock owner portal"
      title={
        firstName ? `Welcome back, ${firstName}` : "Welcome back to e-Livestock"
      }
      subtitle="Track active permits, monitor expiring forms, and move from your stockyard to your next inspection schedule without the clutter."
      summary={
        loading
          ? "Refreshing your livestock permit overview..."
          : `${analytics.valid} active forms are ready for your next transaction.`
      }
    >
      <View style={styles.statsGrid}>
        <StatCard
          label="Total forms"
          value={analytics.total}
          caption="Open your stockyard records and livestock QR permits."
          icon="file-document-multiple-outline"
          accent="meadow"
          loading={loading}
          onPress={() => router.push("/stockyard")}
        />
        <StatCard
          label="Expired"
          value={analytics.expired}
          caption="Forms that need renewal before the next movement."
          icon="calendar-remove-outline"
          accent="clay"
          loading={loading}
        />
        <StatCard
          label="Valid forms"
          value={analytics.valid}
          caption="Records currently usable for inspection and transport."
          icon="shield-check-outline"
          accent="wheat"
          loading={loading}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>Quick actions</Text>
        <Text style={styles.sectionTitle}>Move through your livestock tasks faster</Text>
        <Text style={styles.sectionCopy}>
          Jump into the stockyard, check your appointment queue, or safely end
          your session. These buttons now use a more modern, agriculture-led
          layout for faster scanning.
        </Text>

        <View style={styles.actionStack}>
          <AgriButton
            title="Open Stockyard"
            subtitle="Review livestock permits and QR details"
            icon="barn"
            variant="primary"
            onPress={() => router.push("/stockyard")}
          />
          <AgriButton
            title="Check schedules"
            subtitle="See upcoming inspections and appointment slots"
            icon="calendar-month-outline"
            variant="sky"
            onPress={() => router.push("/checkSchedule")}
          />
          <AgriButton
            title="Logout"
            subtitle="Finish this session securely"
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
