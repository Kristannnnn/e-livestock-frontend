import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import StatCard from "../../components/StatCard";
import { apiRoutes, apiUrl } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const API_ENDPOINTS = {
  pending: apiUrl(apiRoutes.antemortem.schedules.pending),
  accepted: apiUrl(apiRoutes.antemortem.schedules.accepted),
  ongoing: apiUrl(apiRoutes.antemortem.schedules.ongoing),
  done: apiUrl(apiRoutes.antemortem.schedules.done),
  cancelled: apiUrl(apiRoutes.antemortem.schedules.cancelled),
};

const UPDATE_URL = apiUrl(apiRoutes.antemortem.updateScheduleStatus);

const CANCEL_URL = apiUrl(apiRoutes.antemortem.cancelSchedule);

const STATUS_ORDER = ["pending", "accepted", "ongoing", "done", "cancelled"];

const STATUS_META = {
  pending: {
    label: "Pending",
    icon: "clock-outline",
    badgeBackground: "#FFF4D6",
    badgeText: "#8A6510",
    chipBackground: "#FBF2D3",
    chipBorder: "#E8D08B",
    chipText: "#7A5A12",
    description: "Waiting for review.",
  },
  accepted: {
    label: "Accepted",
    icon: "calendar-check-outline",
    badgeBackground: "#E4F1EB",
    badgeText: agriPalette.fieldDeep,
    chipBackground: "#E1EFE8",
    chipBorder: "#B9D3C6",
    chipText: agriPalette.fieldDeep,
    description: "Ready for field prep.",
  },
  ongoing: {
    label: "Ongoing",
    icon: "tractor-variant",
    badgeBackground: "#E7EEF7",
    badgeText: "#315E8F",
    chipBackground: "#E6EEF7",
    chipBorder: "#C4D5EA",
    chipText: "#315E8F",
    description: "Currently in the field.",
  },
  done: {
    label: "Done",
    icon: "check-decagram-outline",
    badgeBackground: "#EEF7E9",
    badgeText: agriPalette.field,
    chipBackground: "#E7F4DF",
    chipBorder: "#C6DFB5",
    chipText: agriPalette.field,
    description: "Completed visits.",
  },
  cancelled: {
    label: "Cancelled",
    icon: "close-circle-outline",
    badgeBackground: "#F7E1D5",
    badgeText: agriPalette.redClay,
    chipBackground: "#F6E0D7",
    chipBorder: "#E5B6A4",
    chipText: agriPalette.redClay,
    description: "Removed from the board.",
  },
};

function formatTime(time) {
  if (!time) return "";

  const [hour, minute] = time.split(":");
  const nextHour = ((Number(hour) + 11) % 12) + 1;
  const ampm = Number(hour) >= 12 ? "PM" : "AM";
  return `${nextHour}:${minute} ${ampm}`;
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Date not recorded";
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

function formatScheduleWindow(schedule) {
  const dateLabel = formatDate(schedule?.date);

  if (schedule?.start_time && schedule?.end_time) {
    return `${dateLabel} • ${formatTime(schedule.start_time)} - ${formatTime(
      schedule.end_time
    )}`;
  }

  if (schedule?.start_time) {
    return `${dateLabel} • ${formatTime(schedule.start_time)}`;
  }

  return dateLabel;
}

function getParamValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatScheduleSubject(schedule) {
  const ownerLabel = String(schedule?.owner_name || "").trim();
  const eartagLabel = String(schedule?.eartag_number || "").trim();

  if (ownerLabel && eartagLabel) {
    return `${ownerLabel} • Eartag ${eartagLabel}`;
  }

  if (ownerLabel) {
    return ownerLabel;
  }

  if (eartagLabel) {
    return `Eartag ${eartagLabel}`;
  }

  return "This livestock visit";
}

function buildStatusSuccessFeedback(schedule, newStatus) {
  const subject = formatScheduleSubject(schedule);
  const windowLabel = formatScheduleWindow(schedule);

  switch (newStatus) {
    case "accepted":
      return {
        status: "accepted",
        title: "Moved to accepted",
        message: "This visit is confirmed and ready for field prep.",
        subject,
        windowLabel,
      };
    case "ongoing":
      return {
        status: "ongoing",
        title: "Visit started",
        message: "This inspection is now active in the field.",
        subject,
        windowLabel,
      };
    case "done":
      return {
        status: "done",
        title: "Visit completed",
        message: "This inspection is now closed.",
        subject,
        windowLabel,
      };
    case "cancelled":
      return {
        status: "cancelled",
        title: "Visit cancelled",
        message: "This visit was removed from the board.",
        subject,
        windowLabel,
      };
    default:
      return {
        status: "pending",
        title: "Schedule updated",
        message: "The visit status was updated.",
        subject,
        windowLabel,
      };
  }
}

function getFeedbackAppearance(status) {
  switch (status) {
    case "accepted":
      return {
        icon: "calendar-check-outline",
        eyebrow: "Schedule updated",
        accent: agriPalette.fieldDeep,
        surface: "#EAF5EE",
        border: "#B9D3C6",
        iconSurface: "#DCECE2",
        pillSurface: "#E1EFE8",
        pillText: agriPalette.fieldDeep,
        buttonVariant: "primary",
      };
    case "ongoing":
      return {
        icon: "tractor-variant",
        eyebrow: "Field update",
        accent: "#315E8F",
        surface: "#EDF3FA",
        border: "#C4D5EA",
        iconSurface: "#E2EAF5",
        pillSurface: "#E6EEF7",
        pillText: "#315E8F",
        buttonVariant: "sky",
      };
    case "done":
      return {
        icon: "check-decagram-outline",
        eyebrow: "Visit closed",
        accent: agriPalette.field,
        surface: "#EEF7E9",
        border: "#C6DFB5",
        iconSurface: "#E1F0D8",
        pillSurface: "#E7F4DF",
        pillText: agriPalette.field,
        buttonVariant: "primary",
      };
    case "cancelled":
      return {
        icon: "close-circle-outline",
        eyebrow: "Visit removed",
        accent: agriPalette.redClay,
        surface: "#F9E8E0",
        border: "#E5B6A4",
        iconSurface: "#F5DED5",
        pillSurface: "#F6E0D7",
        pillText: agriPalette.redClay,
        buttonVariant: "danger",
      };
    default:
      return {
        icon: "check-circle-outline",
        eyebrow: "Schedule updated",
        accent: agriPalette.fieldDeep,
        surface: agriPalette.cream,
        border: agriPalette.border,
        iconSurface: "#E7F2EA",
        pillSurface: agriPalette.mist,
        pillText: agriPalette.fieldDeep,
        buttonVariant: "primary",
      };
  }
}

async function fetchScheduleList(status) {
  const response = await fetch(API_ENDPOINTS[status]);
  const data = await response.json();

  if (data.status === "success") {
    return Array.isArray(data.schedules) ? data.schedules : [];
  }

  return [];
}

function matchesSearch(schedule, query) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return (
    String(schedule?.owner_name || "")
      .toLowerCase()
      .includes(normalizedQuery) ||
    String(schedule?.eartag_number || "")
      .toLowerCase()
      .includes(normalizedQuery) ||
    String(schedule?.location || "")
      .toLowerCase()
      .includes(normalizedQuery) ||
    String(schedule?.form_id || "").includes(normalizedQuery)
  );
}

export default function AntemortemScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const requestedScheduleId = parseInt(
    String(getParamValue(params?.schedule_id) || ""),
    10
  );
  const [allSchedules, setAllSchedules] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    accepted: 0,
    ongoing: 0,
    done: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyScheduleId, setBusyScheduleId] = useState(null);
  const [feedbackNotice, setFeedbackNotice] = useState(null);
  const requestedStatus = String(getParamValue(params?.status) || "")
    .trim()
    .toLowerCase();
  const initialStatus =
    STATUS_ORDER.includes(requestedStatus) ? requestedStatus : "pending";
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (STATUS_ORDER.includes(requestedStatus)) {
      setStatusFilter(requestedStatus);
    }
  }, [requestedStatus]);

  useEffect(() => {
    let active = true;

    const loadSchedules = async () => {
      try {
        setLoading(true);

        const [selectedSchedules, countCollections] = await Promise.all([
          fetchScheduleList(statusFilter),
          Promise.all(
            STATUS_ORDER.map(async (status) => {
              try {
                const schedules = await fetchScheduleList(status);
                return [status, schedules.length];
              } catch (_error) {
                return [status, 0];
              }
            })
          ),
        ]);

        if (!active) {
          return;
        }

        setAllSchedules(selectedSchedules);
        setStatusCounts(Object.fromEntries(countCollections));
      } catch (error) {
        console.error(error);

        if (active) {
          setAllSchedules([]);
          Alert.alert("Error", "Failed to fetch schedules.");
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
          setBusyScheduleId(null);
        }
      }
    };

    loadSchedules();

    return () => {
      active = false;
    };
  }, [statusFilter, reloadToken]);

  const filteredSchedules = allSchedules.filter((schedule) =>
    matchesSearch(schedule, searchQuery)
  );

  const activeMeta = STATUS_META[statusFilter];
  const closedCount = statusCounts.done + statusCounts.cancelled;

  const triggerReload = (useRefreshState = false) => {
    if (useRefreshState) {
      setRefreshing(true);
    }

    setReloadToken((current) => current + 1);
  };

  const updateScheduleStatus = async (schedule, newStatus) => {
    const scheduleId = schedule?.schedule_id;

    if (!scheduleId) {
      Alert.alert("Error", "Schedule ID is missing for this update.");
      return;
    }

    try {
      setBusyScheduleId(scheduleId);

      const response = await fetch(UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: scheduleId,
          new_status: newStatus,
        }),
      });
      const data = await response.json();

      if (data.status === "success") {
        const feedback = buildStatusSuccessFeedback(schedule, newStatus);
        setFeedbackNotice(feedback);
        triggerReload(false);
      } else {
        Alert.alert("Error", data.message || "Failed to update schedule.");
        setBusyScheduleId(null);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Something went wrong.");
      setBusyScheduleId(null);
    }
  };

  const deleteSchedule = async (schedule) => {
    const scheduleId = schedule?.schedule_id;

    try {
      setBusyScheduleId(scheduleId);

      const response = await fetch(CANCEL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: scheduleId }),
      });
      const data = await response.json();

      if (data.status === "success") {
        setFeedbackNotice(buildStatusSuccessFeedback(schedule, "cancelled"));
        triggerReload(false);
      } else {
        Alert.alert("Error", data.message || "Failed to cancel schedule.");
        setBusyScheduleId(null);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to cancel schedule.");
      setBusyScheduleId(null);
    }
  };

  const confirmCancellation = (schedule) => {
    Alert.alert(
      "Cancel schedule",
      "Cancel this accepted visit?",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel visit",
          style: "destructive",
          onPress: () => deleteSchedule(schedule),
        },
      ]
    );
  };

  const renderActions = (schedule) => {
    const isBusy = busyScheduleId === schedule.schedule_id;

    if (statusFilter === "pending") {
      return (
        <View style={styles.actionStack}>
          <AgriButton
            title="Accept"
            icon="check-decagram-outline"
            variant="primary"
            compact
            trailingIcon={false}
            loading={isBusy}
            disabled={Boolean(busyScheduleId)}
            onPress={() => updateScheduleStatus(schedule, "accepted")}
          />
          <AgriButton
            title="Decline"
            icon="close-circle-outline"
            variant="danger"
            compact
            trailingIcon={false}
            disabled={Boolean(busyScheduleId)}
            onPress={() => updateScheduleStatus(schedule, "cancelled")}
          />
        </View>
      );
    }

    if (statusFilter === "accepted") {
      return (
        <View style={styles.actionStack}>
          <AgriButton
            title="Start visit"
            icon="play-circle-outline"
            variant="sky"
            compact
            trailingIcon={false}
            loading={isBusy}
            disabled={Boolean(busyScheduleId)}
            onPress={() => updateScheduleStatus(schedule, "ongoing")}
          />
          <AgriButton
            title="Verify QR"
            icon="qrcode-scan"
            variant="secondary"
            compact
            disabled={Boolean(busyScheduleId)}
            onPress={() =>
              router.push({
                pathname: "/antemortemScanQRcode",
                params: {
                  form_id: schedule.form_id,
                  schedule_id: schedule.schedule_id,
                  status: statusFilter,
                },
              })
            }
          />
          <AgriButton
            title="Cancel visit"
            icon="calendar-remove-outline"
            variant="danger"
            compact
            trailingIcon={false}
            disabled={Boolean(busyScheduleId)}
            onPress={() => confirmCancellation(schedule)}
          />
        </View>
      );
    }

    if (statusFilter === "ongoing") {
      return (
        <View style={styles.actionStack}>
          <AgriButton
            title="Mark done"
            icon="check-circle-outline"
            variant="primary"
            compact
            trailingIcon={false}
            loading={isBusy}
            disabled={Boolean(busyScheduleId)}
            onPress={() => updateScheduleStatus(schedule, "done")}
          />
        </View>
      );
    }

    return null;
  };

  const feedbackAppearance = getFeedbackAppearance(feedbackNotice?.status);
  const feedbackStatusLabel =
    STATUS_META[feedbackNotice?.status]?.label || "Updated";

  return (
    <DashboardShell
      eyebrow="Antemortem schedule board"
      title="Review schedules"
      subtitle="Move visits through each schedule stage."
      summary={
        loading
          ? "Loading schedule board..."
          : `${statusCounts.pending} pending, ${statusCounts.accepted} accepted, ${statusCounts.ongoing} ongoing.`
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => triggerReload(true)} />
      }
    >
      <Modal
        transparent
        visible={Boolean(feedbackNotice)}
        animationType="fade"
        onRequestClose={() => setFeedbackNotice(null)}
      >
        <View style={styles.feedbackOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFeedbackNotice(null)}
          />
          <View style={styles.feedbackTint} />

          <View
            style={[
              styles.feedbackCard,
              {
                borderColor: feedbackAppearance.border,
                backgroundColor: agriPalette.surface,
              },
            ]}
          >
            <View
              style={[
                styles.feedbackAccentBar,
                { backgroundColor: feedbackAppearance.accent },
              ]}
            />

            <View style={styles.feedbackHeader}>
              <View
                style={[
                  styles.feedbackIconWrap,
                  { backgroundColor: feedbackAppearance.iconSurface },
                ]}
              >
                <MaterialCommunityIcons
                  name={feedbackAppearance.icon}
                  size={28}
                  color={feedbackAppearance.accent}
                />
              </View>

              <View style={styles.feedbackHeaderCopy}>
                <Text
                  style={[
                    styles.feedbackEyebrow,
                    { color: feedbackAppearance.accent },
                  ]}
                >
                  {feedbackAppearance.eyebrow}
                </Text>
                <Text style={styles.feedbackTitle}>
                  {feedbackNotice?.title || "Schedule updated"}
                </Text>
              </View>
            </View>

            <Text style={styles.feedbackMessage}>
              {feedbackNotice?.message || "The visit status was updated."}
            </Text>

            <View
              style={[
                styles.feedbackStatusPill,
                { backgroundColor: feedbackAppearance.pillSurface },
              ]}
            >
              <MaterialCommunityIcons
                name={feedbackAppearance.icon}
                size={16}
                color={feedbackAppearance.pillText}
              />
              <Text
                style={[
                  styles.feedbackStatusText,
                  { color: feedbackAppearance.pillText },
                ]}
              >
                {feedbackStatusLabel}
              </Text>
            </View>

            <View
              style={[
                styles.feedbackDetailsCard,
                {
                  backgroundColor: feedbackAppearance.surface,
                  borderColor: feedbackAppearance.border,
                },
              ]}
            >
              <View style={styles.feedbackDetailRow}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={16}
                  color={feedbackAppearance.accent}
                />
                <Text style={styles.feedbackDetailText}>
                  {feedbackNotice?.subject || "Visit details"}
                </Text>
              </View>

              <View style={styles.feedbackDetailRow}>
                <MaterialCommunityIcons
                  name="calendar-clock-outline"
                  size={16}
                  color={feedbackAppearance.accent}
                />
                <Text style={styles.feedbackDetailText}>
                  {feedbackNotice?.windowLabel || "Time not recorded"}
                </Text>
              </View>
            </View>

            <AgriButton
              title="Continue"
              icon="check"
              variant={feedbackAppearance.buttonVariant}
              compact
              trailingIcon={false}
              onPress={() => setFeedbackNotice(null)}
            />
          </View>
        </View>
      </Modal>

      <View style={styles.statsGrid}>
        <StatCard
          label="Pending queue"
          value={statusCounts.pending}
          caption="Waiting for review."
          icon="clock-outline"
          accent="wheat"
          loading={loading}
        />
        <StatCard
          label="Active field"
          value={statusCounts.ongoing}
          caption="In the field."
          icon="tractor-variant"
          accent="sky"
          loading={loading}
        />
        <StatCard
          label="Closed visits"
          value={closedCount}
          caption="Done or cancelled."
          icon="check-decagram-outline"
          accent="meadow"
          loading={loading}
        />
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Search and filter</Text>
        <Text style={styles.cardTitle}>Choose a queue</Text>
        <Text style={styles.cardCopy}>Search then switch status.</Text>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={agriPalette.fieldDeep}
          />
          <TextInput
            placeholder="Search owner, eartag, location, or form number"
            placeholderTextColor={agriPalette.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterGrid}>
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const isActive = status === statusFilter;

            return (
              <Pressable
                key={status}
                onPress={() => setStatusFilter(status)}
                style={[
                  styles.filterCard,
                  {
                    backgroundColor: isActive
                      ? meta.badgeBackground
                      : agriPalette.surface,
                    borderColor: isActive ? meta.chipBorder : agriPalette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.filterIconWrap,
                    { backgroundColor: meta.chipBackground },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={meta.icon}
                    size={18}
                    color={meta.chipText}
                  />
                </View>
                <View style={styles.filterTextWrap}>
                  <Text
                    style={[
                      styles.filterTitle,
                      { color: isActive ? meta.chipText : agriPalette.ink },
                    ]}
                  >
                    {meta.label}
                  </Text>
                  <Text style={styles.filterCount}>{statusCounts[status] || 0}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.scopeNote,
            { backgroundColor: activeMeta.badgeBackground },
          ]}
        >
          <MaterialCommunityIcons
            name={activeMeta.icon}
            size={18}
            color={activeMeta.badgeText}
          />
          <Text style={[styles.scopeNoteText, { color: activeMeta.badgeText }]}>
            {activeMeta.description}
          </Text>
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.cardEyebrow}>Schedule list</Text>
            <Text style={styles.cardTitle}>{activeMeta.label} visits</Text>
            <Text style={styles.cardCopy}>
              {filteredSchedules.length} result{filteredSchedules.length === 1 ? "" : "s"}.
            </Text>
          </View>

          <View
            style={[
              styles.queueBadge,
              { backgroundColor: activeMeta.badgeBackground },
            ]}
          >
            <MaterialCommunityIcons
              name={activeMeta.icon}
              size={16}
              color={activeMeta.badgeText}
            />
            <Text style={[styles.queueBadgeText, { color: activeMeta.badgeText }]}>
              {activeMeta.label}
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={agriPalette.field}
            style={styles.loadingState}
          />
        ) : filteredSchedules.length ? (
          <View style={styles.scheduleStack}>
            {filteredSchedules.map((schedule) => {
              const isBusy = busyScheduleId === schedule.schedule_id;
              const isHighlighted =
                Number.isFinite(requestedScheduleId) &&
                requestedScheduleId > 0 &&
                schedule.schedule_id === requestedScheduleId;

              return (
                <View
                  key={schedule.schedule_id}
                  style={[
                    styles.scheduleCard,
                    isHighlighted && styles.scheduleCardHighlighted,
                  ]}
                >
                  {isHighlighted ? (
                    <View style={styles.returnBadge}>
                      <MaterialCommunityIcons
                        name="restore"
                        size={15}
                        color={agriPalette.fieldDeep}
                      />
                      <Text style={styles.returnBadgeText}>
                        Returned from scanner
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.scheduleHeader,
                      isWide && styles.scheduleHeaderWide,
                    ]}
                  >
                    <View style={styles.scheduleHeaderText}>
                      <Text style={styles.ownerName}>
                        {schedule.owner_name || "Owner not recorded"}
                      </Text>
                      <Text style={styles.formMeta}>
                        Form #{schedule.form_id || "N/A"} • Schedule #
                        {schedule.schedule_id}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: activeMeta.badgeBackground },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={activeMeta.icon}
                        size={15}
                        color={activeMeta.badgeText}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: activeMeta.badgeText },
                        ]}
                      >
                        {activeMeta.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scheduleWindowCard}>
                    <MaterialCommunityIcons
                      name="calendar-clock-outline"
                      size={18}
                      color={agriPalette.fieldDeep}
                    />
                    <Text style={styles.scheduleWindowText}>
                      {formatScheduleWindow(schedule)}
                    </Text>
                  </View>

                  <View style={[styles.infoGrid, isWide && styles.infoGridWide]}>
                    <View style={styles.infoCard}>
                      <Text style={styles.infoLabel}>Eartag</Text>
                      <Text style={styles.infoValue}>
                        {schedule.eartag_number || "Not provided"}
                      </Text>
                    </View>
                    <View style={styles.infoCard}>
                      <Text style={styles.infoLabel}>Location</Text>
                      <Text style={styles.infoValue}>
                        {schedule.location || "Location not provided"}
                      </Text>
                    </View>
                  </View>

                  {renderActions(schedule)}

                  {isBusy ? (
                    <View style={styles.inlineLoading}>
                      <ActivityIndicator size="small" color={agriPalette.field} />
                      <Text style={styles.inlineLoadingText}>
                        Updating schedule...
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name={activeMeta.icon}
              size={34}
              color={agriPalette.field}
            />
            <Text style={styles.emptyTitle}>
              No {activeMeta.label.toLowerCase()} visits found
            </Text>
            <Text style={styles.emptyCopy}>
              Try a different search term or refresh the schedule board to check
              for newer inspection activity.
            </Text>
          </View>
        )}
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  feedbackOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  feedbackTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12, 24, 16, 0.48)",
  },
  feedbackCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: "#102116",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 14,
    overflow: "hidden",
  },
  feedbackAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  feedbackIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackHeaderCopy: {
    flex: 1,
  },
  feedbackEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  feedbackTitle: {
    marginTop: 6,
    color: agriPalette.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  feedbackMessage: {
    marginTop: 16,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  feedbackStatusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  feedbackStatusText: {
    fontSize: 13,
    fontWeight: "800",
  },
  feedbackDetailsCard: {
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  feedbackDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  feedbackDetailText: {
    flex: 1,
    color: agriPalette.ink,
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: agriPalette.cream,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: agriPalette.ink,
    fontSize: 15,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  filterCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 148,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  filterIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  filterTextWrap: {
    flex: 1,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  filterCount: {
    marginTop: 3,
    color: agriPalette.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  scopeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
  },
  scopeNoteText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  queueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  loadingState: {
    marginVertical: 40,
  },
  scheduleStack: {
    gap: 14,
    marginTop: 18,
  },
  scheduleCard: {
    borderRadius: 28,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  scheduleCardHighlighted: {
    borderColor: agriPalette.field,
    shadowColor: agriPalette.fieldDeep,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 4,
  },
  returnBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#E1EFE8",
    borderWidth: 1,
    borderColor: "#B9D3C6",
  },
  returnBadgeText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  scheduleHeader: {
    gap: 12,
  },
  scheduleHeaderWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  scheduleHeaderText: {
    flex: 1,
  },
  ownerName: {
    color: agriPalette.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  formMeta: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  scheduleWindowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  scheduleWindowText: {
    flex: 1,
    color: agriPalette.fieldDeep,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  infoGrid: {
    gap: 12,
    marginTop: 14,
  },
  infoGridWide: {
    flexDirection: "row",
  },
  infoCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  infoLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoValue: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
  },
  actionStack: {
    gap: 10,
    marginTop: 16,
  },
  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  inlineLoadingText: {
    color: agriPalette.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderRadius: 24,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  emptyTitle: {
    marginTop: 12,
    color: agriPalette.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyCopy: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
