import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import LogoutButton from "../../components/logOutButton";
import StatCard from "../../components/StatCard";
import { agriPalette } from "../../constants/agriTheme";
import { apiRoutes, apiUrl } from "../../lib/api";

const API_URL = apiUrl(apiRoutes.inspector.summary);

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

function parseDecimal(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function createEmptyDashboard() {
  return {
    total: 0,
    validQr: 0,
    expiredQr: 0,
    expiringSoon: 0,
    uniqueOwners: 0,
    averageLiveWeight: 0,
    speciesCount: 0,
    purposeCount: 0,
    unreadNotifications: 0,
    analytics: [],
    peak: { label: "No data", total: 0 },
    latest: { label: "No data", total: 0 },
    average: 0,
    speciesBreakdown: [],
    purposeBreakdown: [],
    severityBreakdown: [],
    keywordBreakdown: [],
    ownerBreakdown: [],
    renewalSummary: {
      pending: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
    },
    qrSummary: {
      valid: 0,
      expiringSoon: 0,
      expired: 0,
    },
    dssSummary: {
      totalMatches: 0,
      dominantSeverity: { label: "No data", total: 0 },
      topKeyword: { label: "No keyword data", total: 0 },
    },
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

function normalizeBreakdown(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    label: item?.label || `Item ${index + 1}`,
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

function normalizeRecentActivity(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    formId: parseCount(item?.form_id),
    ownerName: item?.owner_name || "Owner not recorded",
    animalSpecies: item?.animal_species || "Livestock record",
    identifier: item?.animal_unique_identifier || "",
    purpose: item?.purpose || "Purpose not recorded",
    liveWeight: parseDecimal(item?.live_weight),
    inspectionDate: item?.inspection_date || "",
    inspectionTime: item?.inspection_time || "",
    qrDaysLeft:
      item?.qr_days_left === null || item?.qr_days_left === undefined
        ? null
        : parseCount(item.qr_days_left),
    qrExpirationLabel: item?.qr_expiration_label || "",
    highestSeverity:
      item?.highest_severity === null || item?.highest_severity === undefined
        ? null
        : parseCount(item.highest_severity),
    matchedKeywords: String(item?.matched_keywords || "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
  }));
}

function buildDashboardState(result) {
  const analytics = normalizeAnalytics(result?.analytics);
  const derivedTrend = deriveTrendMeta(analytics);

  return {
    total: parseCount(result?.total),
    validQr: parseCount(result?.valid_qr),
    expiredQr: parseCount(result?.expired_qr),
    expiringSoon: parseCount(result?.expiring_soon),
    uniqueOwners: parseCount(result?.unique_owners),
    averageLiveWeight: parseDecimal(result?.average_live_weight),
    speciesCount: parseCount(result?.species_count),
    purposeCount: parseCount(result?.purpose_count),
    unreadNotifications: parseCount(result?.unread_notifications),
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
    speciesBreakdown: normalizeBreakdown(result?.species_breakdown),
    purposeBreakdown: normalizeBreakdown(result?.purpose_breakdown),
    severityBreakdown: normalizeBreakdown(result?.severity_breakdown),
    keywordBreakdown: normalizeBreakdown(result?.keyword_breakdown),
    ownerBreakdown: normalizeBreakdown(result?.owner_breakdown),
    renewalSummary: {
      pending: parseCount(result?.renewal_summary?.pending),
      completed: parseCount(result?.renewal_summary?.completed),
      cancelled: parseCount(result?.renewal_summary?.cancelled),
      total: parseCount(result?.renewal_summary?.total),
    },
    qrSummary: {
      valid: parseCount(result?.qr_summary?.valid, parseCount(result?.valid_qr)),
      expiringSoon: parseCount(
        result?.qr_summary?.expiring_soon,
        parseCount(result?.expiring_soon)
      ),
      expired: parseCount(
        result?.qr_summary?.expired,
        parseCount(result?.expired_qr)
      ),
    },
    dssSummary: {
      totalMatches: parseCount(result?.dss_summary?.total_matches),
      dominantSeverity: {
        label:
          result?.dss_summary?.dominant_severity?.label || "No severity data",
        total: parseCount(result?.dss_summary?.dominant_severity?.total),
      },
      topKeyword: {
        label: result?.dss_summary?.top_keyword?.label || "No keyword data",
        total: parseCount(result?.dss_summary?.top_keyword?.total),
      },
    },
    recentActivity: normalizeRecentActivity(result?.recent_activity),
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

function shortenLabel(label, maxLength = 10) {
  if (!label) {
    return "";
  }

  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength - 1)}...`;
}

function formatPercentage(part, whole) {
  if (!whole || whole <= 0) {
    return "0%";
  }

  return `${Math.round((part / whole) * 100)}%`;
}

function formatWeight(weight) {
  if (!weight) {
    return "No weight data";
  }

  return `${weight.toFixed(1)} kg`;
}

function getToneColors(tone = "meadow") {
  switch (tone) {
    case "wheat":
      return {
        surface: "#FFF4D6",
        accent: agriPalette.wheat,
        text: "#8A6510",
        copy: "#926F18",
      };
    case "clay":
      return {
        surface: "#F7E1D5",
        accent: agriPalette.redClay,
        text: agriPalette.redClay,
        copy: "#945540",
      };
    case "sky":
      return {
        surface: "#E4F1EB",
        accent: agriPalette.sky,
        text: agriPalette.fieldDeep,
        copy: "#547364",
      };
    case "deep":
      return {
        surface: "rgba(31,77,46,0.12)",
        accent: agriPalette.fieldDeep,
        text: agriPalette.fieldDeep,
        copy: agriPalette.field,
      };
    default:
      return {
        surface: "#EEF7E9",
        accent: agriPalette.field,
        text: agriPalette.fieldDeep,
        copy: agriPalette.field,
      };
  }
}

function getSeverityAppearance(level) {
  if (level === null || level === undefined || Number.isNaN(level)) {
    return {
      backgroundColor: agriPalette.mist,
      textColor: agriPalette.fieldDeep,
      iconColor: agriPalette.fieldDeep,
      label: "No DSS flag",
      tone: "sky",
    };
  }

  if (level >= 5) {
    return {
      backgroundColor: "#F7E1D5",
      textColor: agriPalette.redClay,
      iconColor: agriPalette.redClay,
      label: `Severity ${level}`,
      tone: "clay",
    };
  }

  if (level >= 3) {
    return {
      backgroundColor: "#FFF4D6",
      textColor: "#8A6510",
      iconColor: "#8A6510",
      label: `Severity ${level}`,
      tone: "wheat",
    };
  }

  return {
    backgroundColor: "#E4F1EB",
    textColor: agriPalette.field,
    iconColor: agriPalette.field,
    label: `Severity ${level}`,
    tone: "meadow",
  };
}

function getMeterWidth(total, overall) {
  if (!overall || overall <= 0 || total <= 0) {
    return "0%";
  }

  return `${Math.max((total / overall) * 100, 6)}%`;
}

async function requestDashboardSummary(accountId, filter) {
  const response = await fetch(`${API_URL}?filter=${filter}&account_id=${accountId}`);
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message ||
        `Inspector dashboard request failed (HTTP ${response.status}).`
    );
  }

  return result;
}

function InsightChip({ icon, label, value, tone = "meadow" }) {
  const colors = getToneColors(tone);

  return (
    <View style={[styles.insightChip, { backgroundColor: colors.surface }]}>
      <View
        style={[
          styles.insightChipIcon,
          { backgroundColor: "rgba(255,255,255,0.62)" },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={18} color={colors.text} />
      </View>
      <View style={styles.insightChipCopy}>
        <Text style={[styles.insightChipLabel, { color: colors.copy }]}>
          {label}
        </Text>
        <Text style={[styles.insightChipValue, { color: colors.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MeterRow({ label, total, overall, tone = "meadow", note }) {
  const colors = getToneColors(tone);

  return (
    <View style={styles.meterRow}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterLabel}>{label}</Text>
        <Text style={[styles.meterValue, { color: colors.text }]}>{total}</Text>
      </View>
      {note ? <Text style={styles.meterNote}>{note}</Text> : null}
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            {
              width: getMeterWidth(total, overall),
              backgroundColor: colors.accent,
            },
          ]}
        />
      </View>
      <Text style={styles.meterFootnote}>
        {formatPercentage(total, overall)} of tracked total
      </Text>
    </View>
  );
}

const InspectorDashboard = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState("today");
  const [dashboard, setDashboard] = useState(createEmptyDashboard());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accountId, setAccountId] = useState(null);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");

        if (userData) {
          const parsed = JSON.parse(userData);
          setAccountId(parsed.account_id);
          setFirstName(parsed.first_name || "");
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
    let active = true;

    const fetchSummary = async () => {
      if (accountId === null || accountId === undefined) {
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");
        const result = await requestDashboardSummary(accountId, filter);

        if (active) {
          setDashboard(buildDashboardState(result));
        }
      } catch (err) {
        console.error("Inspector dashboard fetch error:", err);

        if (active) {
          setDashboard(createEmptyDashboard());
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Unable to load your inspector analytics right now."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchSummary();

    return () => {
      active = false;
    };
  }, [accountId, filter]);

  const handleRefresh = async () => {
    if (accountId === null || accountId === undefined) {
      return;
    }

    try {
      setRefreshing(true);
      setErrorMessage("");
      const result = await requestDashboardSummary(accountId, filter);
      setDashboard(buildDashboardState(result));
    } catch (err) {
      console.error("Inspector dashboard refresh error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to refresh your inspector analytics."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const baseChartWidth = Math.max(width - 96, 280);
  const activityChartWidth = Math.max(
    baseChartWidth,
    dashboard.analytics.length * 84
  );
  const speciesChartEntries = dashboard.speciesBreakdown.slice(0, 5);
  const speciesChartWidth = Math.max(
    baseChartWidth,
    speciesChartEntries.length * 78
  );
  const analyticsHasValues = dashboard.analytics.some((item) => item.total > 0);
  const speciesHasValues = speciesChartEntries.some((item) => item.total > 0);
  const qrTotal =
    dashboard.qrSummary.valid +
    dashboard.qrSummary.expiringSoon +
    dashboard.qrSummary.expired;
  const renewalTotal =
    dashboard.renewalSummary.total ||
    dashboard.renewalSummary.pending +
      dashboard.renewalSummary.completed +
      dashboard.renewalSummary.cancelled;
  const severityItems = [...dashboard.severityBreakdown].sort(
    (left, right) => parseCount(right.label) - parseCount(left.label)
  );
  const dssTotal = severityItems.reduce((sum, item) => sum + item.total, 0);
  const overviewCards = [
    {
      label: "Created forms",
      value: dashboard.total,
      caption: "Forms in this period.",
      icon: "clipboard-text-clock-outline",
      accent: "meadow",
    },
    {
      label: "Active QR",
      value: dashboard.validQr,
      caption: "Ready for field use.",
      icon: "qrcode-scan",
      accent: "wheat",
    },
    {
      label: "Owners served",
      value: dashboard.uniqueOwners,
      caption: "Owners served.",
      icon: "account-group-outline",
      accent: "sky",
    },
    {
      label: "Renewal queue",
      value: dashboard.renewalSummary.pending,
      caption: "Waiting for action.",
      icon: "calendar-refresh-outline",
      accent: "sky",
      onPress: () => router.push("/renewalRequests"),
    },
    {
      label: "Unread alerts",
      value: dashboard.unreadNotifications,
      caption: "Unread updates.",
      icon: "bell-ring-outline",
      accent: "wheat",
      onPress: () => router.push("/notifications"),
    },
    {
      label: "Average weight",
      value: dashboard.averageLiveWeight ? `${dashboard.averageLiveWeight} kg` : "0 kg",
      caption: "Average recorded weight.",
      icon: "scale-bathroom",
      accent: "meadow",
    },
  ];
  const activityChartData = {
    labels: dashboard.analytics.map((item) => shortenLabel(item.label, 8)),
    datasets: [
      {
        data:
          dashboard.analytics.length > 0
            ? dashboard.analytics.map((item) => item.total)
            : [0],
        strokeWidth: 3,
      },
    ],
  };
  const speciesChartData = {
    labels:
      speciesChartEntries.length > 0
        ? speciesChartEntries.map((item) => shortenLabel(item.label, 8))
        : ["No data"],
    datasets: [
      {
        data:
          speciesChartEntries.length > 0
            ? speciesChartEntries.map((item) => item.total)
            : [0],
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
  const workbenchInsights = [
    {
      icon: "calendar-refresh-outline",
      label: "Pending renewals",
      value: dashboard.renewalSummary.pending,
      tone: "wheat",
    },
    {
      icon: "bell-ring-outline",
      label: "Unread alerts",
      value: dashboard.unreadNotifications,
      tone: "sky",
    },
    {
      icon: "qrcode-scan",
      label: "Active QR",
      value: dashboard.qrSummary.valid,
      tone: "meadow",
    },
  ];
  const renewalRows = [
    {
      label: "Pending",
      total: dashboard.renewalSummary.pending,
      tone: "wheat",
      note: "Requests waiting for reuse, editing, or action.",
    },
    {
      label: "Completed",
      total: dashboard.renewalSummary.completed,
      tone: "meadow",
      note: "Renewals successfully converted into new inspection forms.",
    },
    {
      label: "Cancelled",
      total: dashboard.renewalSummary.cancelled,
      tone: "clay",
      note: "Requests closed without a renewed inspection form.",
    },
  ];
  const qrRows = [
    {
      label: "Active permits",
      total: dashboard.qrSummary.valid,
      tone: "meadow",
      note: "Still valid and available for permit confirmation.",
    },
    {
      label: "Expiring soon",
      total: dashboard.qrSummary.expiringSoon,
      tone: "wheat",
      note: "Will expire within 24 hours and may need follow-up.",
    },
    {
      label: "Expired",
      total: dashboard.qrSummary.expired,
      tone: "clay",
      note: "Already outside the valid permit window.",
    },
  ];
  const dssInsightTone = getSeverityAppearance(
    parseCount(dashboard.dssSummary.dominantSeverity.label)
  ).tone;

  return (
    <DashboardShell
      eyebrow="Inspector analytics"
      profilePlacement="inlineTitle"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={agriPalette.field}
          colors={[agriPalette.field, agriPalette.wheat]}
        />
      }
      title={
        firstName
          ? `Welcome back, Inspector ${firstName}`
          : "Welcome back, Inspector"
      }
      subtitle="Track forms, permits, renewals, and DSS activity."
      summary={
        loading
          ? "Loading dashboard..."
          : `${dashboard.total} forms, ${dashboard.validQr} active permits, ${dashboard.renewalSummary.pending} renewals waiting.`
      }
    >
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={agriPalette.redClay}
          />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.workbenchCard}>
        <View style={styles.workbenchHeader}>
          <View style={styles.workbenchHeaderCopy}>
            <Text style={styles.cardEyebrow}>Inspector workbench</Text>
            <Text style={styles.cardTitle}>Quick actions</Text>
            <Text style={styles.cardCopy}>Create forms, process renewals, review records, and open alerts.</Text>
          </View>
        </View>

        <View style={styles.workbenchInsightRow}>
          {workbenchInsights.map((item) => (
            <InsightChip
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              tone={item.tone}
            />
          ))}
        </View>

        <View style={styles.workbenchGrid}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryWorkbenchTile,
              pressed && styles.workbenchTilePressed,
            ]}
            onPress={() => router.push("/createLivestockForm")}
          >
            <View style={styles.primaryWorkbenchIcon}>
              <MaterialCommunityIcons
                name="note-plus-outline"
                size={24}
                color={agriPalette.white}
              />
            </View>
            <View style={styles.primaryWorkbenchCopy}>
              <Text style={styles.primaryWorkbenchTitle}>Create form</Text>
              <Text style={styles.primaryWorkbenchText}>Start a new livestock inspection record.</Text>
            </View>
            <MaterialCommunityIcons
              name="arrow-right"
              size={22}
              color={agriPalette.white}
            />
          </Pressable>

          <View style={styles.secondaryWorkbenchGrid}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryWorkbenchTile,
                pressed && styles.workbenchTilePressed,
              ]}
              onPress={() => router.push("/renewalRequests")}
            >
              <View style={styles.secondaryWorkbenchTop}>
                <View style={styles.secondaryWorkbenchIcon}>
                  <MaterialCommunityIcons
                    name="calendar-refresh-outline"
                    size={22}
                    color={agriPalette.fieldDeep}
                  />
                </View>
                <View style={styles.secondaryWorkbenchCountBadge}>
                  <Text style={styles.secondaryWorkbenchCountText}>
                    {dashboard.renewalSummary.pending}
                  </Text>
                </View>
              </View>
              <Text style={styles.secondaryWorkbenchTitle}>Renewals</Text>
              <Text style={styles.secondaryWorkbenchText}>Review and complete renewal requests.</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryWorkbenchTile,
                pressed && styles.workbenchTilePressed,
              ]}
              onPress={() => router.push("/viewForms")}
            >
              <View style={styles.secondaryWorkbenchTop}>
                <View style={styles.secondaryWorkbenchIcon}>
                  <MaterialCommunityIcons
                    name="file-search-outline"
                    size={22}
                    color={agriPalette.fieldDeep}
                  />
                </View>
                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={18}
                  color={agriPalette.field}
                />
              </View>
              <Text style={styles.secondaryWorkbenchTitle}>Submitted forms</Text>
              <Text style={styles.secondaryWorkbenchText}>Open saved records and permit details.</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryWorkbenchTile,
                pressed && styles.workbenchTilePressed,
              ]}
              onPress={() => router.push("/notifications")}
            >
              <View style={styles.secondaryWorkbenchTop}>
                <View style={styles.secondaryWorkbenchIcon}>
                  <MaterialCommunityIcons
                    name="bell-ring-outline"
                    size={22}
                    color={agriPalette.fieldDeep}
                  />
                </View>
                <View style={styles.secondaryWorkbenchCountBadge}>
                  <Text style={styles.secondaryWorkbenchCountText}>
                    {dashboard.unreadNotifications}
                  </Text>
                </View>
              </View>
              <Text style={styles.secondaryWorkbenchTitle}>Alerts</Text>
              <Text style={styles.secondaryWorkbenchText}>Check unread account and workflow updates.</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        {overviewCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            caption={card.caption}
            icon={card.icon}
            accent={card.accent}
            loading={loading}
            onPress={card.onPress}
          />
        ))}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Reporting lens</Text>
        <Text style={styles.cardTitle}>Change the time range</Text>
        <Text style={styles.cardCopy}>Switch the period to refresh all metrics.</Text>

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

        <View style={styles.periodInsightGrid}>
          <View style={styles.periodInsightCard}>
            <Text style={styles.periodInsightLabel}>Peak window</Text>
            <Text style={styles.periodInsightValue}>{dashboard.peak.label}</Text>
            <Text style={styles.periodInsightCaption}>
              {dashboard.peak.total} form{dashboard.peak.total === 1 ? "" : "s"}
            </Text>
          </View>

          <View style={styles.periodInsightCard}>
            <Text style={styles.periodInsightLabel}>Latest point</Text>
            <Text style={styles.periodInsightValue}>{dashboard.latest.label}</Text>
            <Text style={styles.periodInsightCaption}>
              {dashboard.latest.total} form{dashboard.latest.total === 1 ? "" : "s"}
            </Text>
          </View>

          <View style={styles.periodInsightCard}>
            <Text style={styles.periodInsightLabel}>Average pace</Text>
            <Text style={styles.periodInsightValue}>{dashboard.average}</Text>
            <Text style={styles.periodInsightCaption}>forms per chart point</Text>
          </View>
        </View>

        <View style={styles.scopeNote}>
          <MaterialCommunityIcons
            name="account-check-outline"
            size={18}
            color={agriPalette.fieldDeep}
          />
          <Text style={styles.scopeNoteText}>Only records under your account are included.</Text>
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Inspection flow</Text>
        <Text style={styles.cardTitle}>Submission activity over time</Text>
        <Text style={styles.cardCopy}>See how submissions changed over the selected period.</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={agriPalette.field}
            style={styles.loadingState}
          />
        ) : analyticsHasValues ? (
          <View style={styles.chartPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScrollContent}
            >
              <LineChart
                data={activityChartData}
                width={activityChartWidth}
                height={238}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                fromZero
                withVerticalLines={false}
                withOuterLines={false}
              />
            </ScrollView>

            <View style={styles.legendWrap}>
              {dashboard.analytics.map((item) => (
                <View key={`${item.label}-${item.detail}`} style={styles.legendItem}>
                  <View style={styles.legendDot} />
                  <View style={styles.legendTextWrap}>
                    <Text style={styles.legendTitle}>{item.label}</Text>
                    <Text style={styles.legendCaption}>
                      {item.total} form{item.total === 1 ? "" : "s"}
                      {item.detail ? ` · ${item.detail}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No submissions in this period.
          </Text>
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Livestock profile</Text>
        <Text style={styles.cardTitle}>Species mix and inspection purpose</Text>
        <Text style={styles.cardCopy}>See species, purpose, and owner trends.</Text>

        <View style={styles.analysisGrid}>
          <View style={styles.analysisPanel}>
            <Text style={styles.analysisPanelTitle}>Species handled</Text>
            <Text style={styles.analysisPanelCopy}>Top livestock species in your forms.</Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={agriPalette.field}
                style={styles.loadingState}
              />
            ) : speciesHasValues ? (
              <View style={styles.embeddedChartPanel}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartScrollContent}
                >
                  <BarChart
                    data={speciesChartData}
                    width={speciesChartWidth}
                    height={220}
                    yAxisLabel=""
                    chartConfig={chartConfig}
                    fromZero
                    style={styles.chart}
                    withInnerLines={false}
                    showValuesOnTopOfBars
                  />
                </ScrollView>

                <View style={styles.legendWrap}>
                  {speciesChartEntries.map((item) => (
                    <View key={item.label} style={styles.legendItem}>
                      <View style={styles.legendDot} />
                      <View style={styles.legendTextWrap}>
                        <Text style={styles.legendTitle}>{item.label}</Text>
                        <Text style={styles.legendCaption}>
                          {item.total} form{item.total === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No species data in this period.
              </Text>
            )}
          </View>

          <View style={styles.analysisPanel}>
            <Text style={styles.analysisPanelTitle}>Purpose mix</Text>
            <Text style={styles.analysisPanelCopy}>Compare inspection purposes and owner coverage.</Text>

            <View style={styles.meterStack}>
              {dashboard.purposeBreakdown.length ? (
                dashboard.purposeBreakdown.map((item, index) => (
                  <MeterRow
                    key={`${item.label}-${index}`}
                    label={item.label}
                    total={item.total}
                    overall={dashboard.total}
                    tone={index === 0 ? "meadow" : index === 1 ? "wheat" : "sky"}
                    note={`${formatPercentage(item.total, dashboard.total)} of submitted forms`}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No purpose data in this period.</Text>
              )}
            </View>

            <View style={styles.ownerInsightBlock}>
              <Text style={styles.ownerInsightTitle}>Owner coverage</Text>
              <View style={styles.tokenWrap}>
                {dashboard.ownerBreakdown.length ? (
                  dashboard.ownerBreakdown.map((item, index) => (
                    <View
                      key={`${item.label}-${index}`}
                      style={[
                        styles.tokenChip,
                        {
                          backgroundColor:
                            index === 0
                              ? "#EEF7E9"
                              : index === 1
                                ? "#FFF4D6"
                                : "#E4F1EB",
                        },
                      ]}
                    >
                      <Text style={styles.tokenLabel}>{shortenLabel(item.label, 24)}</Text>
                      <Text style={styles.tokenValue}>{item.total}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No owner data in this period.</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.insightGrid}>
          <InsightChip
            icon="account-group-outline"
            label="Owners served"
            value={dashboard.uniqueOwners}
            tone="sky"
          />
          <InsightChip
            icon="cow"
            label="Species covered"
            value={dashboard.speciesCount}
            tone="meadow"
          />
          <InsightChip
            icon="shape-outline"
            label="Purpose tags"
            value={dashboard.purposeCount}
            tone="wheat"
          />
          <InsightChip
            icon="scale-bathroom"
            label="Average weight"
            value={formatWeight(dashboard.averageLiveWeight)}
            tone="deep"
          />
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Permit and compliance pulse</Text>
        <Text style={styles.cardTitle}>QR health, renewals, and DSS findings</Text>
        <Text style={styles.cardCopy}>See permit status, renewals, and DSS signals.</Text>

        <View style={styles.analysisGrid}>
          <View style={styles.analysisPanel}>
            <Text style={styles.analysisPanelTitle}>QR permit health</Text>
            <Text style={styles.analysisPanelCopy}>Valid, expiring, and expired permit counts.</Text>
            <View style={styles.meterStack}>
              {qrRows.map((item) => (
                <MeterRow
                  key={item.label}
                  label={item.label}
                  total={item.total}
                  overall={qrTotal}
                  tone={item.tone}
                  note={item.note}
                />
              ))}
            </View>
          </View>

          <View style={styles.analysisPanel}>
            <Text style={styles.analysisPanelTitle}>Renewal workflow</Text>
            <Text style={styles.analysisPanelCopy}>Pending, completed, and cancelled renewals.</Text>
            <View style={styles.meterStack}>
              {renewalRows.map((item) => (
                <MeterRow
                  key={item.label}
                  label={item.label}
                  total={item.total}
                  overall={renewalTotal}
                  tone={item.tone}
                  note={item.note}
                />
              ))}
            </View>
          </View>

          <View style={styles.analysisPanel}>
            <Text style={styles.analysisPanelTitle}>DSS severity spread</Text>
            <Text style={styles.analysisPanelCopy}>Severity levels from matched DSS rules.</Text>
            <View style={styles.meterStack}>
              {severityItems.length ? (
                severityItems.map((item) => {
                  const severityLevel = parseCount(item.label);
                  const severityAppearance = getSeverityAppearance(severityLevel);

                  return (
                    <MeterRow
                      key={`${item.label}-${item.total}`}
                      label={severityAppearance.label}
                      total={item.total}
                      overall={dssTotal}
                      tone={severityAppearance.tone}
                      note={`${formatPercentage(item.total, dssTotal)} of DSS matches`}
                    />
                  );
                })
              ) : (
                <Text style={styles.emptyText}>
                  No DSS severity data in this period.
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.insightGrid}>
          <InsightChip
            icon="alert-decagram-outline"
            label="Dominant severity"
            value={
              dashboard.dssSummary.dominantSeverity.total
                ? `Severity ${dashboard.dssSummary.dominantSeverity.label}`
                : "No severity data"
            }
            tone={dssInsightTone}
          />
          <InsightChip
            icon="tag-multiple-outline"
            label="Top keyword"
            value={shortenLabel(dashboard.dssSummary.topKeyword.label, 18)}
            tone="wheat"
          />
          <InsightChip
            icon="radar"
            label="DSS matches"
            value={dashboard.dssSummary.totalMatches}
            tone="clay"
          />
          <InsightChip
            icon="bell-ring-outline"
            label="Unread alerts"
            value={dashboard.unreadNotifications}
            tone="sky"
          />
        </View>

        <View style={styles.signalSection}>
          <Text style={styles.signalSectionTitle}>Keyword signals</Text>
          <View style={styles.tokenWrap}>
            {dashboard.keywordBreakdown.length ? (
              dashboard.keywordBreakdown.map((item, index) => (
                <View
                  key={`${item.label}-${index}`}
                  style={[
                    styles.tokenChip,
                    { backgroundColor: index % 2 === 0 ? "#FFF4D6" : "#EEF7E9" },
                  ]}
                >
                  <Text style={styles.tokenLabel}>{shortenLabel(item.label, 22)}</Text>
                  <Text style={styles.tokenValue}>{item.total}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No DSS keywords in this period.
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Recent activity</Text>
        <Text style={styles.cardTitle}>Latest forms you submitted</Text>
        <Text style={styles.cardCopy}>Reopen recent records fast.</Text>

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
              const severityAppearance = getSeverityAppearance(item.highestSeverity);

              return (
                <View key={`form-${item.formId}`} style={styles.activityItem}>
                  <View style={styles.activityHeader}>
                    <View style={styles.activityTitleWrap}>
                      <Text style={styles.activityTitle}>
                        {item.animalSpecies}
                      </Text>
                      <Text style={styles.activityMeta}>
                        {item.ownerName}
                        {item.inspectionDate ? ` · ${item.inspectionDate}` : ""}
                        {item.inspectionTime ? ` · ${item.inspectionTime}` : ""}
                      </Text>
                    </View>

                    <View style={styles.formTag}>
                      <Text style={styles.formTagText}>#{item.formId}</Text>
                    </View>
                  </View>

                  <View style={styles.activityBadgeRow}>
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

                    <View
                      style={[
                        styles.activityBadge,
                        { backgroundColor: severityAppearance.backgroundColor },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="shield-alert-outline"
                        size={15}
                        color={severityAppearance.iconColor}
                      />
                      <Text
                        style={[
                          styles.activityBadgeText,
                          { color: severityAppearance.textColor },
                        ]}
                      >
                        {severityAppearance.label}
                      </Text>
                    </View>

                    <View style={[styles.activityBadge, styles.neutralBadge]}>
                      <MaterialCommunityIcons
                        name="shape-outline"
                        size={15}
                        color={agriPalette.fieldDeep}
                      />
                      <Text style={[styles.activityBadgeText, styles.neutralBadgeText]}>
                        {item.purpose}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.activitySecondary}>
                    {item.identifier ? `Tag ${item.identifier}` : "No ear tag recorded"}
                    {item.qrExpirationLabel
                      ? ` · QR expiry ${item.qrExpirationLabel}`
                      : ""}
                    {item.liveWeight ? ` · ${formatWeight(item.liveWeight)}` : ""}
                  </Text>

                  {item.matchedKeywords.length ? (
                    <View style={styles.activityKeywordWrap}>
                      {item.matchedKeywords.map((keyword) => (
                        <View key={`${item.formId}-${keyword}`} style={styles.activityKeywordChip}>
                          <Text style={styles.activityKeywordText}>
                            {shortenLabel(keyword, 20)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No recent forms in this period.
          </Text>
        )}
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Quick actions</Text>
        <Text style={styles.cardTitle}>Account actions</Text>
        <Text style={styles.cardCopy}>Open settings or sign out.</Text>

        <View style={styles.actionStack}>
          <AgriButton
            title="Settings"
            icon="cog-outline"
            variant="sky"
            onPress={() => router.push("/settings")}
          />
          <LogoutButton />
        </View>
      </View>
    </DashboardShell>
  );
};

export default InspectorDashboard;

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    borderRadius: 22,
    backgroundColor: "#FBECE6",
    borderWidth: 1,
    borderColor: "#E7B8A7",
  },
  errorBannerText: {
    flex: 1,
    color: "#8E4A35",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 18,
  },
  workbenchCard: {
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
  workbenchHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  workbenchHeaderCopy: {
    flex: 1,
    minWidth: 220,
  },
  workbenchInsightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  insightChip: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 130,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightChipIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  insightChipCopy: {
    flex: 1,
  },
  insightChipLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  insightChipValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "900",
  },
  workbenchSummaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  workbenchSummaryChipText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  workbenchGrid: {
    gap: 12,
    marginTop: 18,
  },
  primaryWorkbenchTile: {
    minHeight: 110,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: agriPalette.field,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  workbenchTilePressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  primaryWorkbenchIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  primaryWorkbenchCopy: {
    flex: 1,
  },
  primaryWorkbenchTitle: {
    color: agriPalette.white,
    fontSize: 20,
    fontWeight: "900",
  },
  primaryWorkbenchText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryWorkbenchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  secondaryWorkbenchTile: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 160,
    minHeight: 156,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  secondaryWorkbenchTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  secondaryWorkbenchIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  secondaryWorkbenchCountBadge: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E4F1EB",
  },
  secondaryWorkbenchCountText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "900",
  },
  secondaryWorkbenchTitle: {
    marginTop: 16,
    color: agriPalette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  secondaryWorkbenchText: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
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
  periodInsightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  periodInsightCard: {
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
  periodInsightLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  periodInsightValue: {
    marginTop: 10,
    color: agriPalette.ink,
    fontSize: 23,
    fontWeight: "900",
  },
  periodInsightCaption: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
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
  embeddedChartPanel: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 24,
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
  legendWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 14,
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
  analysisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  analysisPanel: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 220,
    borderRadius: 24,
    backgroundColor: agriPalette.surfaceMuted,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  analysisPanelTitle: {
    color: agriPalette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  analysisPanelCopy: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  meterStack: {
    gap: 12,
    marginTop: 16,
  },
  meterRow: {
    borderRadius: 20,
    backgroundColor: agriPalette.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(47,107,61,0.08)",
  },
  meterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  meterLabel: {
    flex: 1,
    color: agriPalette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  meterValue: {
    fontSize: 15,
    fontWeight: "900",
  },
  meterNote: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  meterTrack: {
    marginTop: 10,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#E8EDDF",
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 999,
  },
  meterFootnote: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  ownerInsightBlock: {
    marginTop: 18,
  },
  ownerInsightTitle: {
    color: agriPalette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  tokenWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  tokenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tokenLabel: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  tokenValue: {
    color: agriPalette.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  signalSection: {
    marginTop: 18,
  },
  signalSectionTitle: {
    color: agriPalette.ink,
    fontSize: 16,
    fontWeight: "900",
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
  activityBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  activityBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  neutralBadge: {
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  neutralBadgeText: {
    color: agriPalette.fieldDeep,
  },
  activitySecondary: {
    marginTop: 12,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  activityKeywordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  activityKeywordChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#FFF4D6",
  },
  activityKeywordText: {
    color: "#8A6510",
    fontSize: 12,
    fontWeight: "800",
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
