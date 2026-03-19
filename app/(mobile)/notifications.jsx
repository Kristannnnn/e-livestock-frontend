import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import { agriPalette } from "../../constants/agriTheme";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";

const LIST_URL = apiUrl(apiRoutes.notifications.list);
const MARK_READ_URL = apiUrl(apiRoutes.notifications.markRead);

async function requestNotifications(accountId) {
  const response = await fetch(LIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId }),
  });

  return parseJsonResponse(response, "Invalid notifications response.");
}

export default function NotificationsScreen() {
  const [accountId, setAccountId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const storedId = await AsyncStorage.getItem("account_id");
        const parsedId = parseInt(storedId, 10);

        if (!parsedId) {
          Alert.alert("Error", "User not logged in.");
          return;
        }

        setAccountId(parsedId);
        const data = await requestNotifications(parsedId);

        if (data.status === "success") {
          setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
          setUnreadCount(Number(data.unread_count) || 0);
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
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unread_count) || 0);
    } else {
      throw new Error(data.message || "Failed to fetch notifications.");
    }
  };

  const markRead = async (notificationId = null) => {
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
        await refreshNotifications(accountId);
      } else {
        Alert.alert("Error", data.message || "Failed to update notifications.");
      }
    } catch (error) {
      console.error("Notification update error:", error);
      Alert.alert("Error", "Failed to update notifications.");
    }
  };

  return (
    <DashboardShell
      eyebrow="Notification center"
      title="Your alerts"
      subtitle="Track schedule updates, form activity, and other account events in one place."
      summary={
        loading
          ? "Loading your notifications..."
          : `${notifications.length} alert${notifications.length === 1 ? "" : "s"} total, ${unreadCount} unread.`
      }
    >
      <View style={styles.actions}>
        <AgriButton
          title="Refresh"
          subtitle="Check for the latest account activity"
          icon="refresh"
          compact
          onPress={() => refreshNotifications(accountId)}
          disabled={!accountId}
        />
        <AgriButton
          title="Mark all read"
          subtitle="Clear all unread notifications"
          icon="check-all"
          variant="secondary"
          compact
          onPress={() => markRead(null)}
          disabled={!accountId || unreadCount === 0}
        />
      </View>

      <View style={styles.list}>
        {!loading && notifications.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.title}>No notifications yet</Text>
            <Text style={styles.copy}>
              New form and schedule activity will appear here for your account.
            </Text>
          </View>
        ) : null}

        {notifications.map((item) => (
          <Pressable
            key={item.notification_id}
            style={[styles.card, item.is_read ? styles.cardRead : styles.cardUnread]}
            onPress={() => {
              if (!item.is_read) {
                markRead(item.notification_id);
              }
            }}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{item.title}</Text>
              {!item.is_read ? <View style={styles.dot} /> : null}
            </View>
            <Text style={styles.copy}>{item.message}</Text>
            <Text style={styles.meta}>
              {item.type || "general"} | {new Date(item.created_at).toLocaleString()}
            </Text>
          </Pressable>
        ))}
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginBottom: 18,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  meta: {
    marginTop: 10,
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: agriPalette.field,
  },
});
