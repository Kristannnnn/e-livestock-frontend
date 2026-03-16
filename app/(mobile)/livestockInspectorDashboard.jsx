import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import StatCard from "../../components/StatCard";
import LogoutButton from "../../components/logOutButton";
import { agriPalette } from "../../constants/agriTheme";

const API_URL =
  "https://e-livestock.tulongkabataanbicol.com/eLiveStockAPI/API/get_inspection_summary.php";

const filterOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

function parseCount(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function createEmptyDashboard() {
  return {
    total: 0,
    validQr: 0,
    analytics: [],
    peak: { label: "No data", total: 0 },
    latest: { label: "No data", total: 0 },
    average: 0,
    recentActivity: [],
  };
}

function normalizeAnalytics(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    label: item?.label || item?.month || `Point ${index + 1}`,
    detail: item?.detail || "",
    total: parseCount(item?.total),
  }));
}

function deriveTrendMeta(items) {
  if (!items.length) {
    return {
      peak: { label: "No data", total: 0 },
      latest: { label: "No data", total: 0 },
      average: 0,
    };
  }

  let peak = items[0];
  let total = 0;

  items.forEach((item) => {
    total += item.total;

    if (item.total > peak.total) {
      peak = item;
    }
  });

  return {
    peak,
    latest: items[items.length - 1],
    average: Math.round(total / items.length),
  };
}

function buildDashboardState(result) {
  const analytics = normalizeAnalytics(result?.analytics);
  const derivedTrend = deriveTrendMeta(analytics);

  return {
    total: parseCount(result?.total),
    validQr: parseCount(result?.valid_qr),
    analytics,
    peak: {
      label: result?.peak?.label || derivedTrend.peak.label,
      total: parseCount(result?.peak?.total, derivedTrend.peak.total),
    },
    latest: {
      label: result?.latest?.label || derivedTrend.latest.label,
      total: parseCount(result?.latest?.total, derivedTrend.latest.total),
    },
    average: parseCount(result?.average, derivedTrend.average),
    recentActivity: Array.isArray(result?.recent_activity)
      ? result.recent_activity.map((item) => ({
          formId: item?.form_id,
          ownerName: item?.owner_name || "Owner not recorded",
          animalSpecies: item?.animal_species || "Livestock record",
          identifier: item?.animal_unique_identifier || "",
          inspectionDate: item?.inspection_date || "",
          inspectionTime: item?.inspection_time || "",
          qrDaysLeft:
            item?.qr_days_left === null || item?.qr_days_left === undefined
              ? null
              : parseCount(item.qr_days_left),
          qrExpirationLabel: item?.qr_expiration_label || "",
        }))
      : [],
  };
}

function getQrAppearance(qrDaysLeft) {
  if (qrDaysLeft === null || Number.isNaN(qrDaysLeft)) {
    return {
      backgroundColor: agriPalette.mist,
      textColor: agriPalette.fieldDeep,
      iconColor: agriPalette.fieldDeep,
      label: "QR pending",
    };
  }

  if (qrDaysLeft < 0) {
    return {
      backgroundColor: "#F7E1D5",
      textColor: agriPalette.redClay,
      iconColor: agriPalette.redClay,
      label: `Expired ${Math.abs(qrDaysLeft)}d`,
    };
  }

  if (qrDaysLeft === 0) {
    return {
      backgroundColor: "#FFF4D6",
      textColor: "#8A6510",
      iconColor: "#8A6510",
      label: "Expires today",
    };
  }

  if (qrDaysLeft === 1) {
    return {
      backgroundColor: "#FFF4D6",
      textColor: "#8A6510",
      iconColor: "#8A6510",
      label: "1 day left",
    };
  }

  return {
    backgroundColor: "#E4F1EB",
    textColor: agriPalette.field,
    iconColor: agriPalette.field,
    label: `${qrDaysLeft} days left`,
  };
}

const InspectorDashboard = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState("today");
  const [dashboard, setDashboard] = useState(createEmptyDashboard());
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");

        if (userData) {
          const parsed = JSON.parse(userData);
          setAccountId(parsed.account_id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading user:", err);
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const url = `${API_URL}?filter=${filter}&account_id=${accountId}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
          setDashboard(buildDashboardState(result));
        } else {
          console.error("Error:", result.message);
          setDashboard(createEmptyDashboard());
        }
      } catch (err) {
        console.error("Fetch Error:", err);
        setDashboard(createEmptyDashboard());
      } finally {
        setLoading(false);
      }
    };

    if (accountId !== null && accountId !== undefined) {
      fetchSummary();
    }
  }, [accountId, filter]);

  const selectedFilterLabel =
    filterOptions.find((option) => option.value === filter)?.label || "Today";
  const chartWidth = Math.max(width - 104, dashboard.analytics.length * 94, 280);
  const chartData = {
    labels: dashboard.analytics.map((item) => item.label),
    datasets: [
      {
        data: dashboard.analytics.map((item) => item.total),
        strokeWidth: 3,
      },
    ],
  };
  const chartConfig = {
    backgroundColor: agriPalette.surface,
    backgroundGradientFrom: agriPalette.surface,
    backgroundGradientTo: agriPalette.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(47, 107, 61, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(88, 102, 88, ${opacity})`,
    fillShadowGradientFrom: "rgba(47, 107, 61, 0.24)",
    fillShadowGradientTo: "rgba(210, 216, 193, 0.05)",
    fillShadowGradientFromOpacity: 0.24,
    fillShadowGradientToOpacity: 0.04,
    propsForDots: {
      r: "5",
      strokeWidth: "2",
      stroke: agriPalette.white,
      fill: agriPalette.wheat,
    },
    propsForBackgroundLines: {
      strokeWidth: 1,
      stroke: "#DDE3D2",
      strokeDasharray: "4",
    },
    propsForLabels: {
      fontSize: 11,
    },
    style: { borderRadius: 24 },
  };

  return (
    <DashboardShell
      eyebrow="Inspector operations"
      title="Inspection dashboard"
      subtitle="Focus on forms created under your own inspector account and monitor which of those permits still have active QR validity."
      summary={
        loading
          ? "Syncing your inspection records..."
          : `${dashboard.total} forms created by you in ${selectedFilterLabel.toLowerCase()}, with ${dashboard.validQr} active QR permits.`
      }
    >
      <View style={styles.statsGrid}>
        <StatCard
          label="Created forms"
          value={dashboard.total}
          caption="Only records submitted through your inspector account are counted here."
          icon="clipboard-text-clock-outline"
          accent="meadow"
          loading={loading}
        />
        <StatCard
          label="Active QR"
          value={dashboard.validQr}
          caption="Inspector-owned forms whose QR permits are still valid right now."
          icon="qrcode-scan"
          accent="wheat"
          loading={loading}
        />
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Reporting window</Text>
        <Text style={styles.cardTitle}>Switch the dashboard view</Text>
        <Text style={styles.cardCopy}>
          This filter now updates your own created-form totals, active QR count,
          trend chart, and recent submissions together.
        </Text>

        <View style={styles.filterRow}>
          {filterOptions.map((option) => {
            const active = option.value === filter;

            return (
              <Pressable
                key={option.value}
                onPress={() => setFilter(option.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.scopeNote}>
          <MaterialCommunityIcons
            name="account-check-outline"
            size={18}
            color={agriPalette.fieldDeep}
          />
          <Text style={styles.scopeNoteText}>
            Dashboard scope: only forms created under your logged-in inspector
            account.
          </Text>
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Inspection analytics</Text>
        <Text style={styles.cardTitle}>Recent activity trend</Text>
        <Text style={styles.cardCopy}>
          Follow how your own inspection submissions moved through the selected
          period and compare the strongest window against the latest one.
        </Text>

        <View style={styles.trendHighlights}>
          <View style={styles.trendCard}>
            <Text style={styles.trendLabel}>Peak period</Text>
            <Text style={styles.trendValue}>{dashboard.peak.label}</Text>
            <Text style={styles.trendCopy}>{dashboard.peak.total} forms</Text>
          </View>
          <View style={styles.trendCard}>
            <Text style={styles.trendLabel}>Latest point</Text>
            <Text style={styles.trendValue}>{dashboard.latest.label}</Text>
            <Text style={styles.trendCopy}>{dashboard.latest.total} forms</Text>
          </View>
          <View style={styles.trendCard}>
            <Text style={styles.trendLabel}>Average</Text>
            <Text style={styles.trendValue}>{dashboard.average}</Text>
            <Text style={styles.trendCopy}>forms per point</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={agriPalette.field}
            style={styles.loadingState}
          />
        ) : dashboard.analytics.length ? (
          <View style={styles.chartPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScrollContent}
            >
              <LineChart
                data={chartData}
                width={chartWidth}
                height={238}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                fromZero
                withVerticalLines={false}
                withOuterLines={false}
              />
            </ScrollView>

            <View style={styles.chartLegendRow}>
              {dashboard.analytics.map((item) => (
                <View key={`${item.label}-${item.detail}`} style={styles.legendItem}>
                  <View style={styles.legendDot} />
                  <View style={styles.legendTextWrap}>
                    <Text style={styles.legendTitle}>{item.label}</Text>
                    <Text style={styles.legendCaption}>
                      {item.total} forms
                      {item.detail ? ` - ${item.detail}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No inspection analytics are available for this period yet.
          </Text>
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Recent activity</Text>
        <Text style={styles.cardTitle}>Latest forms you submitted</Text>
        <Text style={styles.cardCopy}>
          These are the newest forms filed by your account inside the selected
          reporting window, with QR validity shown clearly for each record.
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={agriPalette.field}
            style={styles.loadingState}
          />
        ) : dashboard.recentActivity.length ? (
          <View style={styles.activityStack}>
            {dashboard.recentActivity.map((item) => {
              const qrAppearance = getQrAppearance(item.qrDaysLeft);

              return (
                <View key={`form-${item.formId}`} style={styles.activityItem}>
                  <View style={styles.activityHeader}>
                    <View style={styles.activityTitleWrap}>
                      <Text style={styles.activityTitle}>
                        {item.animalSpecies}
                      </Text>
                      <Text style={styles.activityMeta}>
                        {item.ownerName}
                        {item.inspectionDate ? ` - ${item.inspectionDate}` : ""}
                        {item.inspectionTime ? ` - ${item.inspectionTime}` : ""}
                      </Text>
                    </View>

                    <View style={styles.formTag}>
                      <Text style={styles.formTagText}>#{item.formId}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.activityBadge,
                      { backgroundColor: qrAppearance.backgroundColor },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="qrcode-scan"
                      size={15}
                      color={qrAppearance.iconColor}
                    />
                    <Text
                      style={[
                        styles.activityBadgeText,
                        { color: qrAppearance.textColor },
                      ]}
                    >
                      {qrAppearance.label}
                    </Text>
                  </View>

                  <Text style={styles.activitySecondary}>
                    {item.identifier ? `Tag ${item.identifier}` : "No ear tag recorded"}
                    {item.qrExpirationLabel
                      ? ` - QR expiry ${item.qrExpirationLabel}`
                      : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No submitted forms were found for this reporting window.
          </Text>
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Quick actions</Text>
        <Text style={styles.cardTitle}>Open your next workflow</Text>
        <Text style={styles.cardCopy}>
          Jump back into submitted records, create another inspection form, or
          end this session from the same inspector workspace.
        </Text>

        <View style={styles.actionStack}>
          <AgriButton
            title="View submitted forms"
            subtitle="Check livestock records already filed"
            icon="file-search-outline"
            variant="primary"
            onPress={() => router.push("/viewForms")}
          />
          <AgriButton
            title="Create a new form"
            subtitle="Start a fresh livestock inspection record"
            icon="note-plus-outline"
            variant="secondary"
            onPress={() => router.push("/createLivestockForm")}
          />
          <LogoutButton />
        </View>
      </View>
    </DashboardShell>
  );
};

export default InspectorDashboard;

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
    marginBottom: 18,
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
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: agriPalette.mist,
  },
  filterChipActive: {
    backgroundColor: agriPalette.field,
  },
  filterChipText: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: agriPalette.white,
  },
  scopeNote: {
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
  scopeNoteText: {
    flex: 1,
    marginLeft: 10,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  trendHighlights: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  trendCard: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 24,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  trendLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  trendValue: {
    marginTop: 10,
    color: agriPalette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  trendCopy: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  loadingState: {
    marginVertical: 40,
  },
  chartPanel: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  chartScrollContent: {
    paddingHorizontal: 10,
  },
  chart: {
    borderRadius: 24,
    marginRight: 12,
  },
  chartLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    minWidth: 124,
    flexBasis: "48%",
    flexGrow: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: agriPalette.field,
    marginTop: 5,
  },
  legendTextWrap: {
    flex: 1,
  },
  legendTitle: {
    color: agriPalette.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  legendCaption: {
    marginTop: 2,
    color: agriPalette.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  activityStack: {
    gap: 12,
    marginTop: 18,
  },
  activityItem: {
    borderRadius: 24,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  activityTitleWrap: {
    flex: 1,
  },
  activityTitle: {
    color: agriPalette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  activityMeta: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  formTag: {
    borderRadius: 999,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  formTagText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "900",
  },
  activityBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 14,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  activitySecondary: {
    marginTop: 12,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyText: {
    marginTop: 18,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  actionStack: {
    gap: 12,
    marginTop: 18,
  },
});
