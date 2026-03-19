import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import StatCard from "../../components/StatCard";
import { agriPalette } from "../../constants/agriTheme";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";

const API_URL = apiUrl(apiRoutes.owner.schedules);
const statusOptions = ["All", "Pending", "Accepted", "Ongoing", "Done", "Cancelled"];
const progressSteps = ["Pending", "Accepted", "Ongoing", "Done"];

const statusStyles = {
  Pending: {
    icon: "clock-outline",
    badgeBackground: "#FFF4D6",
    badgeText: "#8A6510",
    cardBackground: "#FFF9EB",
    borderColor: "#E8D4A4",
    gradient: ["#FFF1C8", "#E8C86E"],
  },
  Accepted: {
    icon: "calendar-check-outline",
    badgeBackground: "#E4F1EB",
    badgeText: agriPalette.field,
    cardBackground: "#F4FAF6",
    borderColor: "#CFE1D4",
    gradient: ["#D8EBDD", "#80A57F"],
  },
  Ongoing: {
    icon: "progress-clock",
    badgeBackground: "#EAF1F7",
    badgeText: "#3A6780",
    cardBackground: "#F5F9FC",
    borderColor: "#C9D9E4",
    gradient: ["#DCEAF3", "#8EABBD"],
  },
  Done: {
    icon: "check-circle-outline",
    badgeBackground: "#EEF7E9",
    badgeText: agriPalette.fieldDeep,
    cardBackground: "#F5FBF1",
    borderColor: "#D0E1C5",
    gradient: ["#E5F2D9", "#99B47C"],
  },
  Cancelled: {
    icon: "close-circle-outline",
    badgeBackground: "#F7E1D5",
    badgeText: agriPalette.redClay,
    cardBackground: "#FDF5F1",
    borderColor: "#E6C3B3",
    gradient: ["#F6DED3", "#D08E72"],
  },
};

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

function scopeSchedulesToOwner(schedules, session) {
  const records = Array.isArray(schedules) ? schedules : [];
  const accountId = Number.parseInt(session.accountId || "", 10);

  if (accountId > 0) {
    return records;
  }

  return records.filter((schedule) =>
    matchesOwnerName(schedule.owner_name, session.firstName, session.lastName)
  );
}

function formatScheduleDate(dateValue) {
  if (!dateValue) {
    return "Date not set";
  }

  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeValue(timeValue) {
  if (!timeValue) {
    return "Time pending";
  }

  const parsed = new Date(`1970-01-01T${timeValue}`);
  if (Number.isNaN(parsed.getTime())) {
    return timeValue;
  }

  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeWindow(startTime, endTime) {
  if (!startTime && !endTime) {
    return "Time pending";
  }

  if (!startTime || !endTime) {
    return formatTimeValue(startTime || endTime);
  }

  return `${formatTimeValue(startTime)} - ${formatTimeValue(endTime)}`;
}

function getDateBadge(dateValue) {
  if (!dateValue) {
    return { month: "TBD", day: "--" };
  }

  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { month: "TBD", day: "--" };
  }

  return {
    month: parsed.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: parsed.toLocaleDateString(undefined, { day: "2-digit" }),
  };
}

function isUpcomingStatus(status) {
  return ["Pending", "Accepted", "Ongoing"].includes(status);
}

function getProgressState(currentStatus, step) {
  const currentIndex = progressSteps.indexOf(currentStatus);
  const stepIndex = progressSteps.indexOf(step);

  if (currentIndex < 0 || stepIndex < 0) {
    return "idle";
  }
  if (stepIndex < currentIndex) {
    return "done";
  }
  if (stepIndex === currentIndex) {
    return "current";
  }
  return "idle";
}

function getRouteParamValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function requestSchedules(ownerAccountId) {
  const [firstName, lastName] = await Promise.all([
    AsyncStorage.getItem("first_name"),
    AsyncStorage.getItem("last_name"),
  ]);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: ownerAccountId,
      first_name: firstName || "",
      last_name: lastName || "",
    }),
  });

  return parseJsonResponse(
    response,
    `Schedule API request failed (HTTP ${response.status}).`
  );
}

export default function ScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountId, setAccountId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const highlightedScheduleId =
    parseInt(getRouteParamValue(params?.schedule_id), 10) || 0;
  const highlightedFormId =
    parseInt(getRouteParamValue(params?.form_id), 10) || 0;

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const [storedFirst, storedLast, storedAccountId] = await Promise.all([
          AsyncStorage.getItem("first_name"),
          AsyncStorage.getItem("last_name"),
          AsyncStorage.getItem("account_id"),
        ]);

        if (storedFirst) setFirstName(storedFirst);
        if (storedLast) setLastName(storedLast);
        if (storedAccountId) {
          setAccountId(storedAccountId);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  useEffect(() => {
    if (!accountId) {
      return;
    }

    const loadSchedules = async () => {
      setLoading(true);

      try {
        const data = await requestSchedules(accountId);
        const [storedFirstName, storedLastName] = await Promise.all([
          AsyncStorage.getItem("first_name"),
          AsyncStorage.getItem("last_name"),
        ]);

        if (data.status === "success") {
          setSchedules(
            scopeSchedulesToOwner(data.schedules, {
              accountId,
              firstName: storedFirstName,
              lastName: storedLastName,
            })
          );
        } else {
          setSchedules([]);
        }
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to fetch schedules.");
      }

      setLoading(false);
    };

    loadSchedules();
  }, [accountId]);

  useEffect(() => {
    if (!highlightedScheduleId && !highlightedFormId) {
      return;
    }

    const matchedSchedule = schedules.find((item) => {
      if (highlightedScheduleId && Number(item.schedule_id) === highlightedScheduleId) {
        return true;
      }

      if (highlightedFormId && Number(item.form_id) === highlightedFormId) {
        return true;
      }

      return false;
    });

    if (matchedSchedule?.status && statusFilter !== matchedSchedule.status) {
      setStatusFilter(matchedSchedule.status);
    }
  }, [highlightedFormId, highlightedScheduleId, schedules, statusFilter]);

  const fetchSchedules = async () => {
    if (!accountId) {
      return;
    }

    setLoading(true);

    try {
      const data = await requestSchedules(accountId);
      const [storedFirst, storedLast] = await Promise.all([
        AsyncStorage.getItem("first_name"),
        AsyncStorage.getItem("last_name"),
      ]);

      if (data.status === "success") {
        setSchedules(
          scopeSchedulesToOwner(data.schedules, {
            accountId,
            firstName: storedFirst,
            lastName: storedLast,
          })
        );
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to fetch schedules.");
    }

    setLoading(false);
  };

  const cancelSchedule = async (scheduleId) => {
    Alert.alert("Cancel schedule", "Are you sure you want to cancel this appointment?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel schedule",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            const res = await fetch(API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "cancel", schedule_id: scheduleId }),
            });

            const data = await parseJsonResponse(
              res,
              `Cancel schedule request failed (HTTP ${res.status}).`
            );

            if (data.status === "success") {
              setSchedules((prev) =>
                prev.map((schedule) =>
                  schedule.schedule_id === scheduleId
                    ? { ...schedule, status: "Cancelled" }
                    : schedule
                )
              );
              Alert.alert("Success", "Schedule cancelled successfully.");
            } else {
              Alert.alert("Error", data.message || "Failed to cancel schedule.");
            }
          } catch (error) {
            console.error(error);
            Alert.alert("Error", "Something went wrong while cancelling.");
          }

          setLoading(false);
        },
      },
    ]);
  };

  const totalSchedules = schedules.length;
  const upcomingSchedules = schedules.filter((item) => isUpcomingStatus(item.status)).length;
  const doneSchedules = schedules.filter((item) => item.status === "Done").length;
  const cancelledSchedules = schedules.filter((item) => item.status === "Cancelled").length;
  const filteredSchedules =
    statusFilter === "All"
      ? schedules
      : schedules.filter((item) => item.status === statusFilter);
  const featuredSchedule =
    filteredSchedules.find((item) => isUpcomingStatus(item.status)) ||
    filteredSchedules[0] ||
    null;

  return (
    <DashboardShell
      eyebrow="Owner schedules"
      title={
        firstName
          ? `${firstName}'s schedule board`
          : lastName
          ? `${lastName}'s schedule board`
          : "My schedules"
      }
      subtitle="A cleaner queue for upcoming inspections, completed visits, and cancellations."
      summary={
        loading
          ? "Refreshing your appointment board..."
          : `${upcomingSchedules} active visits, ${doneSchedules} completed, and ${cancelledSchedules} cancelled.`
      }
    >
      <View style={styles.statsGrid}>
        <StatCard label="All schedules" value={totalSchedules} caption="All linked appointments." icon="calendar-month-outline" accent="meadow" loading={loading} />
        <StatCard label="Upcoming" value={upcomingSchedules} caption="Pending, accepted, and ongoing." icon="calendar-clock-outline" accent="wheat" loading={loading} />
        <StatCard label="Completed" value={doneSchedules} caption="Finished schedule records." icon="check-circle-outline" accent="sky" loading={loading} />
        <StatCard label="Cancelled" value={cancelledSchedules} caption="Cancelled inspection slots." icon="close-circle-outline" accent="clay" loading={loading} />
      </View>

      <View style={styles.surfaceCard}>
        <View style={[styles.boardRow, isWide && styles.boardRowWide]}>
          <View style={styles.boardCopy}>
            <Text style={styles.cardEyebrow}>Schedule board</Text>
            <Text style={styles.cardTitle}>Filter the queue with better context</Text>
            <Text style={styles.cardCopy}>
              Switch views, keep the next inspection visible, and jump back to the stockyard when you need a permit record.
            </Text>

            <View style={styles.filterRow}>
              {statusOptions.map((option) => {
                const active = option === statusFilter;
                const count =
                  option === "All"
                    ? totalSchedules
                    : schedules.filter((item) => item.status === option).length;

                return (
                  <Pressable
                    key={option}
                    onPress={() => setStatusFilter(option)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {option}
                    </Text>
                    <Text style={[styles.filterCount, active && styles.filterCountActive]}>
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actionRow}>
              <AgriButton
                title="Refresh schedules"
                subtitle="Pull the latest updates"
                icon="refresh"
                variant="secondary"
                compact
                trailingIcon={false}
                onPress={fetchSchedules}
                style={styles.actionButton}
              />
              <AgriButton
                title="Open stockyard"
                subtitle="Return to permit records"
                icon="barn"
                variant="sky"
                compact
                onPress={() => router.push("/stockyard")}
                style={styles.actionButton}
              />
            </View>
          </View>

          <LinearGradient
            colors={featuredSchedule ? (statusStyles[featuredSchedule.status] || statusStyles.Pending).gradient : ["#EDF4E7", "#D6E4CA"]}
            style={styles.featureCard}
          >
            <Text style={styles.featureEyebrow}>
              {featuredSchedule ? "Queue focus" : "No appointment yet"}
            </Text>
            <Text style={styles.featureTitle}>
              {featuredSchedule ? featuredSchedule.owner_name || "Owner pending" : "Book a schedule to unlock this panel"}
            </Text>
            <Text style={styles.featureMeta}>
              {featuredSchedule
                ? `${formatScheduleDate(featuredSchedule.date)} | ${formatTimeWindow(
                    featuredSchedule.start_time,
                    featuredSchedule.end_time
                  )}`
                : "Your next active visit will stay pinned here."}
            </Text>
            <Text style={styles.featureFoot}>
              {featuredSchedule
                ? featuredSchedule.location || "Location pending"
                : "Use the stockyard to create a new appointment."}
            </Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Appointments</Text>
        <Text style={styles.cardTitle}>A stronger visit timeline</Text>
        <Text style={styles.cardCopy}>
          Each card keeps the date, visit window, route, and status stage visible in one scan.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={agriPalette.field} style={styles.loadingState} />
        ) : filteredSchedules.length ? (
          <View style={styles.scheduleStack}>
            {filteredSchedules.map((item) => {
              const colors = statusStyles[item.status] || statusStyles.Pending;
              const canCancel = item.status !== "Cancelled" && item.status !== "Done";
              const badge = getDateBadge(item.date);
              const isHighlighted =
                (highlightedScheduleId &&
                  Number(item.schedule_id) === highlightedScheduleId) ||
                (!highlightedScheduleId &&
                  highlightedFormId &&
                  Number(item.form_id) === highlightedFormId);

              return (
                <View
                  key={item.schedule_id}
                  style={[
                    styles.scheduleCard,
                    isHighlighted && styles.scheduleCardHighlighted,
                    { backgroundColor: colors.cardBackground, borderColor: colors.borderColor },
                  ]}
                >
                  <View style={styles.scheduleFrame}>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeMonth}>{badge.month}</Text>
                      <Text style={styles.dateBadgeDay}>{badge.day}</Text>
                    </View>

                    <View style={styles.scheduleBody}>
                      <View style={styles.scheduleHeader}>
                        <View style={styles.scheduleHeaderCopy}>
                          <Text style={styles.ownerName}>{item.owner_name || "Owner pending"}</Text>
                          <Text style={styles.scheduleMeta}>
                            {`Form #${item.form_id || "--"} | Eartag ${item.eartag_number || "not recorded"}`}
                          </Text>
                        </View>

                        <View style={[styles.statusBadge, { backgroundColor: colors.badgeBackground }]}>
                          <MaterialCommunityIcons name={colors.icon} size={15} color={colors.badgeText} />
                          <Text style={[styles.statusBadgeText, { color: colors.badgeText }]}>
                            {item.status || "Pending"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.infoRow}>
                        <Text style={styles.infoText}>{formatScheduleDate(item.date)}</Text>
                        <Text style={styles.infoDivider}>|</Text>
                        <Text style={styles.infoText}>{formatTimeWindow(item.start_time, item.end_time)}</Text>
                      </View>

                      <View style={styles.locationPill}>
                        <MaterialCommunityIcons name="map-marker-outline" size={15} color={agriPalette.fieldDeep} />
                        <Text style={styles.locationText}>{item.location || "Location pending"}</Text>
                      </View>

                      {item.status === "Cancelled" || item.status === "Done" ? (
                        <Text style={styles.noteText}>
                          {item.status === "Done"
                            ? "Inspection completed. This visit now lives in your finished history."
                            : "This appointment was cancelled and removed from your active queue."}
                        </Text>
                      ) : (
                        <View style={styles.progressRow}>
                          {progressSteps.map((step) => {
                            const state = getProgressState(item.status, step);
                            return (
                              <View key={step} style={styles.progressStep}>
                                <View
                                  style={[
                                    styles.progressDot,
                                    state === "done" && styles.progressDotDone,
                                    state === "current" && styles.progressDotCurrent,
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.progressText,
                                    state !== "idle" && styles.progressTextActive,
                                  ]}
                                >
                                  {step}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {canCancel ? (
                        <AgriButton
                          title="Cancel schedule"
                          subtitle="Release this appointment slot"
                          icon="close-circle-outline"
                          variant="danger"
                          compact
                          trailingIcon={false}
                          onPress={() => cancelSchedule(item.schedule_id)}
                          style={styles.cancelButton}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={34} color={agriPalette.field} />
            <Text style={styles.emptyTitle}>No schedules in this filter</Text>
            <Text style={styles.emptyCopy}>
              Try another status chip, refresh the board, or jump back to the stockyard to book a visit.
            </Text>
          </View>
        )}
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 18 },
  surfaceCard: {
    borderRadius: 30,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 22,
    marginBottom: 18,
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  boardRow: { gap: 18 },
  boardRowWide: { flexDirection: "row" },
  boardCopy: { flex: 1.1 },
  cardEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cardTitle: { marginTop: 8, color: agriPalette.ink, fontSize: 25, fontWeight: "900" },
  cardCopy: { marginTop: 10, color: agriPalette.inkSoft, fontSize: 15, lineHeight: 22 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: agriPalette.mist,
  },
  filterChipActive: { backgroundColor: agriPalette.field },
  filterChipText: { color: agriPalette.fieldDeep, fontSize: 13, fontWeight: "800" },
  filterChipTextActive: { color: agriPalette.white },
  filterCount: { color: agriPalette.fieldDeep, fontSize: 12, fontWeight: "900" },
  filterCountActive: { color: agriPalette.white },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  actionButton: { flexBasis: "48%", flexGrow: 1, minWidth: 220 },
  featureCard: {
    minHeight: 200,
    borderRadius: 28,
    padding: 18,
    justifyContent: "space-between",
    flex: 0.9,
  },
  featureEyebrow: { color: "rgba(31,77,46,0.74)", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  featureTitle: { marginTop: 14, color: agriPalette.fieldDeep, fontSize: 24, fontWeight: "900", lineHeight: 30 },
  featureMeta: { marginTop: 10, color: agriPalette.fieldDeep, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  featureFoot: { marginTop: 14, color: "rgba(31,77,46,0.82)", fontSize: 13, lineHeight: 20, fontWeight: "700" },
  loadingState: { marginVertical: 40 },
  scheduleStack: { gap: 14, marginTop: 18 },
  scheduleCard: { borderRadius: 26, borderWidth: 1, padding: 16 },
  scheduleCardHighlighted: {
    borderWidth: 2,
    borderColor: agriPalette.field,
    shadowColor: agriPalette.fieldDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  scheduleFrame: { flexDirection: "row", gap: 14 },
  dateBadge: {
    width: 78,
    borderRadius: 22,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: "rgba(31,77,46,0.08)",
    paddingVertical: 12,
    alignItems: "center",
  },
  dateBadgeMonth: { color: agriPalette.field, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  dateBadgeDay: { marginTop: 8, color: agriPalette.ink, fontSize: 28, fontWeight: "900" },
  scheduleBody: { flex: 1 },
  scheduleHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  scheduleHeaderCopy: { flex: 1 },
  ownerName: { color: agriPalette.ink, fontSize: 18, fontWeight: "900" },
  scheduleMeta: { marginTop: 4, color: agriPalette.inkSoft, fontSize: 13, lineHeight: 19 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: "800" },
  infoRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 },
  infoText: { color: agriPalette.fieldDeep, fontSize: 13, fontWeight: "700" },
  infoDivider: { color: agriPalette.inkSoft, fontSize: 12, fontWeight: "800" },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.66)",
  },
  locationText: { color: agriPalette.fieldDeep, fontSize: 12, fontWeight: "700" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(31,77,46,0.08)" },
  progressStep: { flex: 1, alignItems: "center", gap: 8 },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#C9D4C1",
    backgroundColor: agriPalette.surface,
  },
  progressDotDone: { borderColor: agriPalette.field, backgroundColor: agriPalette.field },
  progressDotCurrent: { borderColor: agriPalette.wheat, backgroundColor: agriPalette.wheat },
  progressText: { textAlign: "center", color: agriPalette.inkSoft, fontSize: 11, fontWeight: "700" },
  progressTextActive: { color: agriPalette.fieldDeep },
  noteText: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(31,77,46,0.08)", color: agriPalette.inkSoft, fontSize: 13, lineHeight: 20, fontWeight: "700" },
  cancelButton: { marginTop: 16 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderRadius: 24,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  emptyTitle: { marginTop: 12, color: agriPalette.ink, fontSize: 18, fontWeight: "900" },
  emptyCopy: { marginTop: 8, textAlign: "center", color: agriPalette.inkSoft, fontSize: 14, lineHeight: 21 },
});
