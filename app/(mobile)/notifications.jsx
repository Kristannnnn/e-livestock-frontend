import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import { agriPalette } from "../../constants/agriTheme";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";

const LIST_URL = apiUrl(apiRoutes.notifications.list);
const MARK_READ_URL = apiUrl(apiRoutes.notifications.markRead);
const CATEGORY_COUNTS_TEMPLATE = {
  all: 0,
  unread: 0,
  account: 0,
  renewals: 0,
  schedules: 0,
  forms: 0,
  system: 0,
};
const FILTER_ORDER = ["all", "unread", "account", "renewals", "schedules", "forms", "system"];
const FILTER_LABELS = {
  all: "All",
  unread: "Unread",
  account: "Account",
  renewals: "Renewals",
  schedules: "Schedules",
  forms: "Forms",
  system: "System",
};
const NOTIFICATION_VISUALS = {
  login_success: {
    icon: "shield-check-outline",
    accent: "#1F7A4C",
    backgroundColor: "#E8F5EC",
    borderColor: "#CBE5D4",
  },
  account_updated: {
    icon: "account-edit-outline",
    accent: "#315E8F",
    backgroundColor: "#E6EEF7",
    borderColor: "#C4D5EA",
  },
  password_updated: {
    icon: "lock-check-outline",
    accent: "#8A5E14",
    backgroundColor: "#FBF2D3",
    borderColor: "#E8D08B",
  },
  renewal_request: {
    icon: "calendar-refresh-outline",
    accent: "#7A5A12",
    backgroundColor: "#FFF4D6",
    borderColor: "#F2DC9F",
  },
  renewal_completed: {
    icon: "check-decagram-outline",
    accent: agriPalette.fieldDeep,
    backgroundColor: "#E4F1EB",
    borderColor: "#C7DDD1",
  },
  renewal_cancelled: {
    icon: "close-octagon-outline",
    accent: agriPalette.redClay,
    backgroundColor: "#F7E1D5",
    borderColor: "#E6B9A0",
  },
  schedule_created: {
    icon: "calendar-clock-outline",
    accent: "#315E8F",
    backgroundColor: "#E6EEF7",
    borderColor: "#C4D5EA",
  },
  schedule_status: {
    icon: "calendar-sync-outline",
    accent: agriPalette.fieldDeep,
    backgroundColor: "#E4F1EB",
    borderColor: "#C7DDD1",
  },
  schedule_cancelled: {
    icon: "calendar-remove-outline",
    accent: agriPalette.redClay,
    backgroundColor: "#F7E1D5",
    borderColor: "#E6B9A0",
  },
  form_batch: {
    icon: "file-document-check-outline",
    accent: agriPalette.field,
    backgroundColor: "#EEF7E9",
    borderColor: "#D8EBC9",
  },
  general: {
    icon: "bell-badge-outline",
    accent: agriPalette.inkSoft,
    backgroundColor: "#F5EEE1",
    borderColor: "#DFCDB4",
  },
};
const CATEGORY_TONES = {
  account: {
    backgroundColor: "#E9F0F8",
    borderColor: "#C4D5EA",
    color: "#315E8F",
  },
  renewals: {
    backgroundColor: "#FFF4D6",
    borderColor: "#F2DC9F",
    color: "#7A5A12",
  },
  schedules: {
    backgroundColor: "#E4F1EB",
    borderColor: "#C7DDD1",
    color: agriPalette.fieldDeep,
  },
  forms: {
    backgroundColor: "#EEF7E9",
    borderColor: "#D8EBC9",
    color: agriPalette.field,
  },
  system: {
    backgroundColor: "#F5EEE1",
    borderColor: "#DFCDB4",
    color: agriPalette.inkSoft,
  },
};

function normalizeNotificationType(type) {
  return String(type || "general")
    .trim()
    .toLowerCase();
}

function getNotificationCategory(type) {
  const normalizedType = normalizeNotificationType(type);

  if (["login_success", "account_updated", "password_updated"].includes(normalizedType)) {
    return "account";
  }

  if (["renewal_request", "renewal_completed", "renewal_cancelled"].includes(normalizedType)) {
    return "renewals";
  }

  if (["schedule_created", "schedule_status", "schedule_cancelled"].includes(normalizedType)) {
    return "schedules";
  }

  if (normalizedType === "form_batch") {
    return "forms";
  }

  return "system";
}

function getNotificationCategoryLabel(category) {
  return FILTER_LABELS[category] || "System";
}

function getNotificationTypeLabel(type) {
  const normalizedType = normalizeNotificationType(type);
  const labels = {
    form_batch: "Batch recorded",
    schedule_created: "Appointment booked",
    schedule_status: "Appointment update",
    schedule_cancelled: "Appointment cancelled",
    login_success: "Login success",
    account_updated: "Account updated",
    password_updated: "Password updated",
    renewal_request: "Renewal booked",
    renewal_completed: "Renewal completed",
    renewal_cancelled: "Renewal cancelled",
    general: "General",
  };

  return labels[normalizedType] || "General";
}

function hydrateNotifications(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const type = normalizeNotificationType(item?.type);
    const category = item?.category || getNotificationCategory(type);

    return {
      ...item,
      type,
      category,
      category_label: item?.category_label || getNotificationCategoryLabel(category),
      type_label: item?.type_label || getNotificationTypeLabel(type),
      is_read: Number(item?.is_read) || 0,
    };
  });
}

function deriveCategoryCounts(items) {
  const counts = { ...CATEGORY_COUNTS_TEMPLATE };

  for (const item of items) {
    counts.all += 1;

    if (counts[item.category] !== undefined) {
      counts[item.category] += 1;
    }

    if (!item.is_read) {
      counts.unread += 1;
    }
  }

  return counts;
}

function mergeCategoryCounts(rawCounts, notifications) {
  const derivedCounts = deriveCategoryCounts(notifications);

  return Object.keys(CATEGORY_COUNTS_TEMPLATE).reduce((acc, key) => {
    const nextValue = Number(rawCounts?.[key]);
    acc[key] = Number.isFinite(nextValue) ? nextValue : derivedCounts[key];
    return acc;
  }, {});
}

function filterNotifications(items, activeFilter) {
  if (activeFilter === "all") {
    return items;
  }

  if (activeFilter === "unread") {
    return items.filter((item) => !item.is_read);
  }

  return items.filter((item) => item.category === activeFilter);
}

function parseNotificationDateValue(dateValue) {
  const raw = String(dateValue || "").trim();

  if (!raw) {
    return null;
  }

  const sqlDateMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (sqlDateMatch) {
    const [, year, month, day, hour, minute, second = "0"] = sqlDateMatch;
    const parsedUtc = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    );

    if (!Number.isNaN(parsedUtc.getTime())) {
      return parsedUtc;
    }
  }

  const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatNotificationDate(dateValue) {
  const parsed = parseNotificationDateValue(dateValue);

  if (!parsed) {
    return "Date unavailable";
  }

  return parsed.toLocaleString();
}

function formatRelativeTime(dateValue) {
  const parsed = parseNotificationDateValue(dateValue);

  if (!parsed) {
    return "Unknown time";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return formatNotificationDate(dateValue);
}

function getNotificationVisual(type) {
  const normalizedType = normalizeNotificationType(type);
  return NOTIFICATION_VISUALS[normalizedType] || NOTIFICATION_VISUALS.general;
}

function getDashboardRoute(role) {
  if (role === "livestockInspector") {
    return "/livestockInspectorDashboard";
  }

  if (role === "AntemortemInspector") {
    return "/antemortemDashboard";
  }

  return "/ownerDashboard";
}

function buildNotificationRouteParams(item) {
  const params = {};
  const relatedFormId = Number(item?.related_form_id) || 0;
  const relatedScheduleId = Number(item?.related_schedule_id) || 0;

  if (relatedFormId > 0) {
    params.form_id = String(relatedFormId);
  }

  if (relatedScheduleId > 0) {
    params.schedule_id = String(relatedScheduleId);
  }

  return Object.keys(params).length ? params : undefined;
}

function getNotificationActionLabel(item, role) {
  const type = normalizeNotificationType(item?.type);

  if (type === "renewal_request") {
    return role === "livestockInspector"
      ? "Open renewal queue"
      : "Open stockyard";
  }

  if (type === "renewal_completed") {
    return role === "livestockInspector"
      ? "Open submitted forms"
      : "Review renewed form";
  }

  if (type === "renewal_cancelled") {
    return role === "livestockInspector"
      ? "Review renewal queue"
      : "Review stockyard";
  }

  if (["schedule_created", "schedule_status", "schedule_cancelled"].includes(type)) {
    return role === "AntemortemInspector"
      ? "Open schedule board"
      : "Open my schedules";
  }

  if (type === "form_batch") {
    return role === "livestockInspector"
      ? "Open form records"
      : "Open stockyard";
  }

  if (["account_updated", "password_updated"].includes(type)) {
    return "Open settings";
  }

  if (type === "login_success") {
    return "Open dashboard";
  }

  return "Open alert";
}

function buildNotificationReferenceChips(item) {
  const chips = [];
  const relatedFormId = Number(item?.related_form_id) || 0;
  const relatedScheduleId = Number(item?.related_schedule_id) || 0;

  if (relatedFormId > 0) {
    chips.push(`Form #${relatedFormId}`);
  }

  if (relatedScheduleId > 0) {
    chips.push(`Schedule #${relatedScheduleId}`);
  }

  return chips;
}

function buildNotificationDestination(item, role) {
  const type = normalizeNotificationType(item?.type);
  const params = buildNotificationRouteParams(item);

  if (type === "renewal_request") {
    if (role === "livestockInspector") {
      return { pathname: "/renewalRequests", params };
    }

    return { pathname: "/stockyard", params };
  }

  if (type === "renewal_completed") {
    if (role === "livestockInspector") {
      return { pathname: "/viewForms", params };
    }

    return { pathname: "/stockyard", params };
  }

  if (type === "renewal_cancelled") {
    if (role === "livestockInspector") {
      return { pathname: "/renewalRequests", params };
    }

    return { pathname: "/stockyard", params };
  }

  if (["schedule_created", "schedule_status", "schedule_cancelled"].includes(type)) {
    if (role === "AntemortemInspector") {
      return { pathname: "/antemortemSchedules", params };
    }

    return { pathname: "/checkSchedule", params };
  }

  if (type === "form_batch") {
    if (role === "livestockInspector") {
      return { pathname: "/viewForms", params };
    }

    return { pathname: "/stockyard", params };
  }

  if (["account_updated", "password_updated"].includes(type)) {
    return { pathname: "/settings" };
  }

  if (type === "login_success") {
    return { pathname: getDashboardRoute(role) };
  }

  return { pathname: getDashboardRoute(role) };
}

function buildEmptyState(activeFilter) {
  if (activeFilter === "unread") {
    return {
      title: "No unread alerts",
      copy: "You are all caught up. New account, schedule, renewal, and form updates will appear here when they arrive.",
    };
  }

  if (activeFilter === "account") {
    return {
      title: "No account alerts",
      copy: "Successful sign-ins, profile saves, and password changes will appear here for quick account tracking.",
    };
  }

  if (activeFilter === "renewals") {
    return {
      title: "No renewal alerts",
      copy: "Renewal requests, completed renewals, and auto-cancelled renewal notices will appear here.",
    };
  }

  if (activeFilter === "schedules") {
    return {
      title: "No schedule alerts",
      copy: "Booking confirmations, status updates, and cancellations will appear here.",
    };
  }

  if (activeFilter === "forms") {
    return {
      title: "No form alerts",
      copy: "Batch form submissions and related record activity will show up here.",
    };
  }

  if (activeFilter === "system") {
    return {
      title: "No system alerts",
      copy: "General account notifications will appear here when there is something you need to know.",
    };
  }

  return {
    title: "No notifications yet",
    copy: "New account, form, renewal, and schedule activity will appear here for your account.",
  };
}

async function requestNotifications(accountId) {
  const response = await fetch(LIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId }),
  });

  return parseJsonResponse(response, "Invalid notifications response.");
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [accountId, setAccountId] = useState(null);
  const [role, setRole] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState(CATEGORY_COUNTS_TEMPLATE);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const applyNotificationResponse = (data) => {
    const normalizedNotifications = hydrateNotifications(data.notifications);
    const nextCounts = mergeCategoryCounts(data.category_counts, normalizedNotifications);

    setNotifications(normalizedNotifications);
    setCategoryCounts(nextCounts);
    setUnreadCount(Number(data.unread_count) || nextCounts.unread);
  };

  const applyLocalReadState = (notificationId = null) => {
    setNotifications((current) => {
      const nextNotifications = current.map((item) => {
        if (notificationId && item.notification_id !== notificationId) {
          return item;
        }

        return item.is_read ? item : { ...item, is_read: 1 };
      });

      const nextCounts = deriveCategoryCounts(nextNotifications);
      setCategoryCounts(nextCounts);
      setUnreadCount(nextCounts.unread);

      return nextNotifications;
    });
  };

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const [storedId, storedRole, storedUser] = await Promise.all([
          AsyncStorage.getItem("account_id"),
          AsyncStorage.getItem("role"),
          AsyncStorage.getItem("user"),
        ]);
        const parsedId = parseInt(storedId, 10);
        const parsedUser = storedUser ? JSON.parse(storedUser) : {};
        const resolvedRole = storedRole || parsedUser.account_type || "";

        if (!parsedId) {
          Alert.alert("Error", "User not logged in.");
          return;
        }

        setAccountId(parsedId);
        setRole(resolvedRole);
        const data = await requestNotifications(parsedId);

        if (data.status === "success") {
          applyNotificationResponse(data);
        } else {
          throw new Error(data.message || "Failed to fetch notifications.");
        }
      } catch (error) {
        console.error("Notification load error:", error);
        Alert.alert("Error", "Failed to load notifications.");
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, []);

  const refreshNotifications = async (nextAccountId = accountId) => {
    if (!nextAccountId) {
      return;
    }

    const data = await requestNotifications(nextAccountId);

    if (data.status === "success") {
      applyNotificationResponse(data);
    } else {
      throw new Error(data.message || "Failed to fetch notifications.");
    }
  };

  const markRead = async (notificationId = null, options = {}) => {
    const { refreshAfter = true, suppressAlert = false } = options;

    if (!accountId) {
      return;
    }

    try {
      const response = await fetch(MARK_READ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          notification_id: notificationId,
          mark_all: !notificationId,
        }),
      });

      const data = await parseJsonResponse(response, "Invalid update response.");

      if (data.status === "success") {
        if (refreshAfter) {
          await refreshNotifications(accountId);
        } else {
          applyLocalReadState(notificationId);
        }
      } else {
        if (!suppressAlert) {
          Alert.alert("Error", data.message || "Failed to update notifications.");
        }
      }
    } catch (error) {
      console.error("Notification update error:", error);
      if (!suppressAlert) {
        Alert.alert("Error", "Failed to update notifications.");
      }
    }
  };

  const openNotification = async (item) => {
    const destination = buildNotificationDestination(item, role);

    if (!item?.is_read && item?.notification_id) {
      await markRead(item.notification_id, {
        refreshAfter: false,
        suppressAlert: true,
      });
    }

    if (destination?.pathname) {
      router.push(destination);
    }
  };

  const filteredNotifications = filterNotifications(notifications, activeFilter);
  const latestNotification = notifications[0] || null;
  const filterKeys = FILTER_ORDER.filter(
    (key) => key !== "system" || categoryCounts.system > 0 || activeFilter === "system",
  );
  const summary =
    loading
      ? "Loading your notifications..."
      : activeFilter === "all"
        ? `${categoryCounts.all} alert${categoryCounts.all === 1 ? "" : "s"} total, ${unreadCount} unread.`
        : `${filteredNotifications.length} ${FILTER_LABELS[activeFilter].toLowerCase()} alert${
            filteredNotifications.length === 1 ? "" : "s"
          } shown, ${unreadCount} unread overall.`;
  const emptyState = buildEmptyState(activeFilter);

  return (
    <DashboardShell
      eyebrow="Notification center"
      title="Your alerts"
      subtitle="Use this inbox to review schedule updates, form activity, renewals, and other account events that may need action."
      summary={summary}
    >
      <View style={styles.actions}>
        <AgriButton
          title="Refresh"
          subtitle="Reload the newest alerts for this account"
          icon="refresh"
          compact
          onPress={() => refreshNotifications(accountId)}
          disabled={!accountId}
        />
        <AgriButton
          title="Mark all read"
          subtitle="Clear unread alerts after you finish reviewing them"
          icon="check-all"
          variant="secondary"
          compact
          onPress={() => markRead(null)}
          disabled={!accountId || unreadCount === 0}
        />
      </View>

      {latestNotification ? (
        <Pressable
          style={({ pressed }) => [
            styles.highlightCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() => openNotification(latestNotification)}
        >
          <View
            style={[
              styles.highlightIconWrap,
              {
                backgroundColor: getNotificationVisual(latestNotification.type).backgroundColor,
                borderColor: getNotificationVisual(latestNotification.type).borderColor,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={getNotificationVisual(latestNotification.type).icon}
              size={24}
              color={getNotificationVisual(latestNotification.type).accent}
            />
          </View>

          <View style={styles.highlightBody}>
            <Text style={styles.highlightEyebrow}>Latest activity</Text>
            <Text style={styles.highlightTitle}>{latestNotification.title}</Text>
            <Text style={styles.highlightCopy} numberOfLines={2}>
              {latestNotification.message}
            </Text>
            <View style={styles.highlightMetaRow}>
              <View
                style={[
                  styles.metaBadge,
                  {
                    backgroundColor:
                      (CATEGORY_TONES[latestNotification.category] ||
                        CATEGORY_TONES.system).backgroundColor,
                    borderColor:
                      (CATEGORY_TONES[latestNotification.category] ||
                        CATEGORY_TONES.system).borderColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.metaBadgeText,
                    {
                      color:
                        (CATEGORY_TONES[latestNotification.category] ||
                          CATEGORY_TONES.system).color,
                    },
                  ]}
                >
                  {latestNotification.category_label}
                </Text>
              </View>
              <View style={styles.actionHintPill}>
                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={14}
                  color={agriPalette.fieldDeep}
                />
                <Text style={styles.actionHintText}>
                  {getNotificationActionLabel(latestNotification, role)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.highlightTimeWrap}>
            <Text style={styles.highlightTime}>
              {formatRelativeTime(latestNotification.created_at)}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.filterRail}>
        <Text style={styles.filterHeading}>Browse by category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filterKeys.map((key) => {
            const active = key === activeFilter;
            const count = Number(categoryCounts[key]) || 0;

            return (
              <Pressable
                key={key}
                onPress={() => setActiveFilter(key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {FILTER_LABELS[key]}
                </Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text
                    style={[
                      styles.filterCountText,
                      active && styles.filterCountTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.list}>
        {!loading && filteredNotifications.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.title}>{emptyState.title}</Text>
            <Text style={styles.copy}>{emptyState.copy}</Text>
          </View>
        ) : null}

        {filteredNotifications.map((item) => {
          const tone = CATEGORY_TONES[item.category] || CATEGORY_TONES.system;
          const visual = getNotificationVisual(item.type);

          return (
            <Pressable
              key={item.notification_id}
              style={({ pressed }) => [
                styles.card,
                item.is_read ? styles.cardRead : styles.cardUnread,
                pressed && styles.cardPressed,
              ]}
              onPress={() => openNotification(item)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardLead}>
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: visual.backgroundColor,
                        borderColor: visual.borderColor,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={visual.icon}
                      size={22}
                      color={visual.accent}
                    />
                  </View>

                  <View style={styles.cardLeadText}>
                    <Text style={styles.cardEyebrow}>{item.type_label}</Text>
                    <Text style={styles.title}>{item.title}</Text>
                  </View>
                </View>

                <View style={styles.timePill}>
                  <Text style={styles.timePillText}>{formatRelativeTime(item.created_at)}</Text>
                  {!item.is_read ? <View style={styles.dot} /> : null}
                </View>
              </View>
              <Text style={styles.copy}>{item.message}</Text>
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.metaBadge,
                    {
                      backgroundColor: tone.backgroundColor,
                      borderColor: tone.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.metaBadgeText, { color: tone.color }]}>
                    {item.category_label}
                  </Text>
                </View>
                <Text style={styles.metaType}>{item.type_label}</Text>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.actionHintPill}>
                  <MaterialCommunityIcons
                    name="arrow-top-right"
                    size={14}
                    color={agriPalette.fieldDeep}
                  />
                  <Text style={styles.actionHintText}>
                    {getNotificationActionLabel(item, role)}
                  </Text>
                </View>

                {buildNotificationReferenceChips(item).map((chip) => (
                  <View key={`${item.notification_id}-${chip}`} style={styles.referenceChip}>
                    <Text style={styles.referenceChipText}>{chip}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.meta}>{formatNotificationDate(item.created_at)}</Text>
            </Pressable>
          );
        })}
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginBottom: 18,
  },
  highlightCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: "rgba(255,253,247,0.96)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  highlightIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightBody: {
    flex: 1,
    minWidth: 0,
  },
  highlightEyebrow: {
    color: agriPalette.field,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  highlightTitle: {
    color: agriPalette.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  highlightCopy: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  highlightMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  highlightTimeWrap: {
    alignSelf: "flex-start",
    backgroundColor: agriPalette.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  highlightTime: {
    color: agriPalette.fieldDeep,
    fontSize: 11,
    fontWeight: "900",
  },
  filterRail: {
    backgroundColor: "rgba(255,253,247,0.9)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  filterHeading: {
    color: agriPalette.ink,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
  },
  filterRow: {
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: agriPalette.cream,
  },
  filterChipActive: {
    borderColor: agriPalette.fieldDeep,
    backgroundColor: agriPalette.fieldDeep,
  },
  filterChipText: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "900",
  },
  filterChipTextActive: {
    color: agriPalette.white,
  },
  filterCount: {
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    alignItems: "center",
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  filterCountText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "900",
  },
  filterCountTextActive: {
    color: agriPalette.white,
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: agriPalette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 18,
  },
  cardUnread: {
    borderColor: agriPalette.field,
  },
  cardRead: {
    opacity: 0.84,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLeadText: {
    flex: 1,
  },
  cardEyebrow: {
    color: agriPalette.field,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    color: agriPalette.ink,
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
  },
  copy: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  metaBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metaType: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  meta: {
    marginTop: 8,
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
  },
  detailRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  actionHintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#EEF4EA",
    borderWidth: 1,
    borderColor: "#D5E0CF",
  },
  actionHintText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "900",
  },
  referenceChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  referenceChipText: {
    color: agriPalette.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  timePill: {
    maxWidth: 110,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: agriPalette.cream,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  timePillText: {
    color: agriPalette.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: agriPalette.field,
  },
});
