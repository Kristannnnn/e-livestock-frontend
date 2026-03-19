import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const RENEWALS_URL = apiUrl(apiRoutes.renewals.list);

function formatDateLabel(dateValue) {
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

export default function RenewalRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(RENEWALS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });

      const data = await parseJsonResponse(
        response,
        `Renewal requests API failed (HTTP ${response.status}).`
      );

      if (data.status === "success") {
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load renewal requests.");
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests(false);
  }, []);

  return (
    <DashboardShell
      eyebrow="Renewal queue"
      title="Scheduled renewals"
      subtitle="Owners pick their preferred renewal day here. Open a request to reuse the old form details, edit them, and submit a renewed record."
      summary={
        loading
          ? "Loading the latest renewal queue..."
          : `${requests.length} pending renewal request${requests.length === 1 ? "" : "s"} waiting for inspector action.`
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadRequests(true)}
        />
      }
    >
      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Quick tools</Text>
        <Text style={styles.cardTitle}>Refresh or return</Text>
        <Text style={styles.cardCopy}>
          Keep the renewal queue current, then open any request to reuse the
          original livestock form details.
        </Text>

        <View style={styles.actionStack}>
          <AgriButton
            title="Refresh renewal queue"
            subtitle="Check for the latest owner requests"
            icon="refresh"
            variant="sky"
            onPress={() => loadRequests(true)}
          />
          <AgriButton
            title="Back to dashboard"
            subtitle="Return to the livestock inspector dashboard"
            icon="arrow-left"
            variant="secondary"
            onPress={() => router.replace("/livestockInspectorDashboard")}
          />
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Pending requests</Text>
        <Text style={styles.cardTitle}>Renewal schedule board</Text>
        <Text style={styles.cardCopy}>
          Each request below came from an expired owner permit. Open the form to
          prefill the original details, edit them, and file the renewed record.
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={agriPalette.field}
            style={styles.loadingState}
          />
        ) : requests.length ? (
          <View style={styles.requestStack}>
            {requests.map((request) => (
              <View
                key={request.renewal_request_id}
                style={styles.requestCard}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestTitleWrap}>
                    <Text style={styles.requestTitle}>
                      {request.animal_species || "Livestock record"}
                    </Text>
                    <Text style={styles.requestMeta}>
                      Form #{request.form_id} - {request.owner_name || "Owner"}
                    </Text>
                  </View>

                  <View style={styles.dateBadge}>
                    <MaterialCommunityIcons
                      name="calendar-clock-outline"
                      size={15}
                      color={agriPalette.fieldDeep}
                    />
                    <Text style={styles.dateBadgeText}>
                      {formatDateLabel(request.requested_date)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Eartag</Text>
                    <Text style={styles.infoValue}>
                      {request.animal_unique_identifier || "Not provided"}
                    </Text>
                  </View>
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>QR expiry</Text>
                    <Text style={styles.infoValue}>
                      {request.qr_expiration
                        ? formatDateLabel(request.qr_expiration.slice(0, 10))
                        : "Not recorded"}
                    </Text>
                  </View>
                  <View style={[styles.infoBlock, styles.infoBlockFull]}>
                    <Text style={styles.infoLabel}>Owner address</Text>
                    <Text style={styles.infoValue}>
                      {request.owner_address || "Not provided"}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusPanel}>
                  <MaterialCommunityIcons
                    name="clipboard-text-clock-outline"
                    size={16}
                    color={agriPalette.fieldDeep}
                  />
                  <Text style={styles.statusPanelText}>
                    Renewal requested on {formatDateLabel(request.requested_date)}
                    . Open this request to reuse and edit the old form.
                  </Text>
                </View>

                <View style={styles.actionStack}>
                  <AgriButton
                    title="Open renewal form"
                    subtitle="Reuse this livestock record in the form editor"
                    icon="file-replace-outline"
                    variant="primary"
                    onPress={() =>
                      router.push({
                        pathname: "/createLivestockForm",
                        params: {
                          renewalRequestId: String(request.renewal_request_id),
                        },
                      })
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="calendar-check-outline"
              size={34}
              color={agriPalette.field}
            />
            <Text style={styles.emptyTitle}>No pending renewals</Text>
            <Text style={styles.emptyCopy}>
              When owners schedule expired permits for renewal, they will appear
              here for inspector review and form reuse.
            </Text>
          </View>
        )}
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
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
  actionStack: {
    gap: 12,
    marginTop: 18,
  },
  loadingState: {
    marginVertical: 40,
  },
  requestStack: {
    gap: 14,
    marginTop: 18,
  },
  requestCard: {
    borderRadius: 28,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  requestTitleWrap: {
    flex: 1,
  },
  requestTitle: {
    color: agriPalette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  requestMeta: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#EEF7E9",
  },
  dateBadgeText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  infoBlock: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 130,
    borderRadius: 18,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoBlockFull: {
    flexBasis: "100%",
  },
  infoLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoValue: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  statusPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#FFF4D6",
  },
  statusPanelText: {
    flex: 1,
    color: "#8A6510",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
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
  },
  emptyCopy: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
