import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AgriButton from "./AgriButton";
import StatCard from "./StatCard";
import { agriPalette } from "../constants/agriTheme";

const renewalStatusOptions = ["All", "Pending", "Completed", "Cancelled"];
const renewalStatusStyles = {
  Pending: { icon: "calendar-clock-outline", badgeBackground: "#FFF4D6", badgeText: "#8A6510", cardBackground: "#FFF9EB", borderColor: "#E8D4A4" },
  Completed: { icon: "check-decagram-outline", badgeBackground: "#E4F1EB", badgeText: agriPalette.fieldDeep, cardBackground: "#F5FBF1", borderColor: "#D0E1C5" },
  Cancelled: { icon: "close-circle-outline", badgeBackground: "#F7E1D5", badgeText: agriPalette.redClay, cardBackground: "#FDF5F1", borderColor: "#E6C3B3" },
};

function normalizeStatusLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
}

function formatDateLabel(dateValue) {
  if (!dateValue) return "Date not set";
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function getDateBadge(dateValue) {
  if (!dateValue) return { month: "TBD", day: "--" };
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { month: "TBD", day: "--" };
  return {
    month: parsed.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: parsed.toLocaleDateString(undefined, { day: "2-digit" }),
  };
}

function getRenewalStatusMessage(request) {
  const renewalStatus = normalizeStatusLabel(request?.status) || "Pending";
  if (renewalStatus === "Completed") {
    return Number(request?.renewed_form_id) > 0
      ? `Saved as form #${Number(request.renewed_form_id)}.`
      : "Renewal completed.";
  }
  if (renewalStatus === "Cancelled") {
    return String(request?.cancel_reason || "").trim() || "Renewal cancelled.";
  }
  return "Waiting for review.";
}

export default function OwnerRenewalBoard({
  requests,
  loading,
  statusFilter,
  setStatusFilter,
  selectedDate,
  setSelectedDate,
  onOpenDatePicker,
  onRefresh,
  onOpenStockyard,
  onCancelRenewal,
  cancellingRenewalId = 0,
  highlightedFormId = 0,
  highlightedRenewalRequestId = 0,
}) {
  const pendingCount = requests.filter((item) => normalizeStatusLabel(item.status) === "Pending").length;
  const completedCount = requests.filter((item) => normalizeStatusLabel(item.status) === "Completed").length;
  const cancelledCount = requests.filter((item) => normalizeStatusLabel(item.status) === "Cancelled").length;
  const renewalDates = Array.from(new Set(requests.map((item) => String(item.requested_date || "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  const quickDateOptions = renewalDates.slice(0, 6);
  const statusFilteredRequests = statusFilter === "All" ? requests : requests.filter((item) => normalizeStatusLabel(item.status) === statusFilter);
  const filteredRequests = selectedDate ? statusFilteredRequests.filter((item) => item.requested_date === selectedDate) : statusFilteredRequests;

  return (
    <>
      <View style={styles.statsGrid}>
        <StatCard label="All renewals" value={requests.length} caption="Booked requests." icon="calendar-month-outline" accent="meadow" loading={loading} />
        <StatCard label="Pending" value={pendingCount} caption="Awaiting review." icon="calendar-clock-outline" accent="wheat" loading={loading} />
        <StatCard label="Completed" value={completedCount} caption="New permit issued." icon="check-circle-outline" accent="sky" loading={loading} />
        <StatCard label="Cancelled" value={cancelledCount} caption="Cancelled requests." icon="close-circle-outline" accent="clay" loading={loading} />
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Renewal board</Text>
        <Text style={styles.cardTitle}>Filter renewals</Text>
        <Text style={styles.cardCopy}>Use status or date.</Text>

        <View style={styles.filterRow}>
          {renewalStatusOptions.map((option) => {
            const active = option === statusFilter;
            const count = option === "All" ? requests.length : requests.filter((item) => normalizeStatusLabel(item.status) === option).length;
            return (
              <Pressable key={option} onPress={() => setStatusFilter(option)} style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option}</Text>
                <Text style={[styles.filterCount, active && styles.filterCountActive]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateFilterPanel}>
          <Text style={styles.dateFilterEyebrow}>Renewal date filter</Text>
          <Text style={styles.dateFilterTitle}>{selectedDate ? formatDateLabel(selectedDate) : "All renewal dates"}</Text>
          <Text style={styles.dateFilterHint}>
            {selectedDate
              ? `${filteredRequests.length} matching renewal request${filteredRequests.length === 1 ? "" : "s"} on this day.`
              : renewalDates.length
                ? `Browse renewal requests across ${renewalDates.length} booked day${renewalDates.length === 1 ? "" : "s"}.`
                : "Pick a date once renewal requests are available."}
          </Text>

          <View style={styles.dateFilterActions}>
            <Pressable style={styles.dateActionButton} onPress={onOpenDatePicker}>
              <MaterialCommunityIcons name="calendar-month-outline" size={16} color={agriPalette.fieldDeep} />
              <Text style={styles.dateActionText}>Pick date</Text>
            </Pressable>
            {selectedDate ? (
              <Pressable style={[styles.dateActionButton, styles.dateActionButtonMuted]} onPress={() => setSelectedDate("")}>
                <MaterialCommunityIcons name="close-circle-outline" size={16} color={agriPalette.inkSoft} />
                <Text style={[styles.dateActionText, styles.dateActionTextMuted]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {quickDateOptions.length ? (
            <View style={styles.dateChipRow}>
              <Pressable style={[styles.dateQuickChip, !selectedDate && styles.dateQuickChipActive]} onPress={() => setSelectedDate("")}>
                <Text style={[styles.dateQuickChipText, !selectedDate && styles.dateQuickChipTextActive]}>All dates</Text>
              </Pressable>
              {quickDateOptions.map((dateValue) => {
                const active = selectedDate === dateValue;
                return (
                  <Pressable key={dateValue} style={[styles.dateQuickChip, active && styles.dateQuickChipActive]} onPress={() => setSelectedDate(dateValue)}>
                    <Text style={[styles.dateQuickChipText, active && styles.dateQuickChipTextActive]}>{formatDateLabel(dateValue)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <AgriButton title="Refresh" subtitle={null} icon="refresh" variant="secondary" compact trailingIcon={false} onPress={onRefresh} style={styles.actionButton} />
          <AgriButton title="Stockyard" subtitle={null} icon="barn" variant="sky" compact onPress={onOpenStockyard} style={styles.actionButton} />
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Renewal requests</Text>
        <Text style={styles.cardTitle}>Your renewal requests</Text>
        <Text style={styles.cardCopy}>See status and permit details.</Text>

        {loading ? (
          <View style={styles.loadingWrap}><Text style={styles.loadingText}>Loading renewals...</Text></View>
        ) : filteredRequests.length ? (
          <View style={styles.requestStack}>
            {filteredRequests.map((item) => {
              const renewalStatus = normalizeStatusLabel(item.status) || "Pending";
              const colors = renewalStatusStyles[renewalStatus] || renewalStatusStyles.Pending;
              const badge = getDateBadge(item.requested_date);
              const isHighlighted = (highlightedRenewalRequestId && Number(item.renewal_request_id) === highlightedRenewalRequestId) || (!highlightedRenewalRequestId && highlightedFormId && Number(item.form_id) === highlightedFormId);
              const canCancel = renewalStatus === "Pending" && typeof onCancelRenewal === "function";
              return (
                <View key={item.renewal_request_id} style={[styles.requestCard, isHighlighted && styles.requestCardHighlighted, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                  <View style={styles.requestFrame}>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeMonth}>{badge.month}</Text>
                      <Text style={styles.dateBadgeDay}>{badge.day}</Text>
                    </View>
                    <View style={styles.requestBody}>
                      <View style={styles.requestHeader}>
                        <View style={styles.requestHeaderCopy}>
                          <Text style={styles.requestTitle}>{item.animal_species || "Renewal request"}</Text>
                          <Text style={styles.requestMeta}>{`Form #${item.form_id || "--"} | Eartag ${item.animal_unique_identifier || "not recorded"}`}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: colors.badgeBackground }]}>
                          <MaterialCommunityIcons name={colors.icon} size={15} color={colors.badgeText} />
                          <Text style={[styles.statusBadgeText, { color: colors.badgeText }]}>{renewalStatus}</Text>
                        </View>
                      </View>
                      <Text style={styles.requestInfo}>{formatDateLabel(item.requested_date)}</Text>
                      <Text style={styles.requestInfo}>{item.qr_expiration ? `Old QR expired ${formatDateLabel(String(item.qr_expiration).slice(0, 10))}` : "Previous QR expiry not recorded"}</Text>
                      <View style={styles.addressPill}>
                        <MaterialCommunityIcons name="map-marker-outline" size={15} color={agriPalette.fieldDeep} />
                        <Text style={styles.addressText}>{item.owner_address || "Owner address not provided"}</Text>
                      </View>
                      <View style={[styles.statePanel, renewalStatus === "Completed" && styles.statePanelCompleted, renewalStatus === "Cancelled" && styles.statePanelCancelled]}>
                        <MaterialCommunityIcons name={colors.icon} size={16} color={colors.badgeText} />
                        <Text style={[styles.stateText, renewalStatus === "Completed" && styles.stateTextCompleted, renewalStatus === "Cancelled" && styles.stateTextCancelled]}>{getRenewalStatusMessage(item)}</Text>
                      </View>
                      {canCancel ? (
                        <AgriButton
                          title="Cancel"
                          subtitle={null}
                          icon="close-circle-outline"
                          variant="danger"
                          compact
                          trailingIcon={false}
                          loading={Number(item.renewal_request_id) === Number(cancellingRenewalId)}
                          onPress={() => onCancelRenewal(item)}
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
            <MaterialCommunityIcons name="calendar-refresh-outline" size={34} color={agriPalette.field} />
            <Text style={styles.emptyTitle}>No renewals in this filter</Text>
            <Text style={styles.emptyCopy}>Try another filter or refresh.</Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 18 },
  surfaceCard: { borderRadius: 30, backgroundColor: agriPalette.surface, borderWidth: 1, borderColor: agriPalette.border, padding: 22, marginBottom: 18, shadowColor: "#203126", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 },
  cardEyebrow: { color: agriPalette.field, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  cardTitle: { marginTop: 8, color: agriPalette.ink, fontSize: 25, fontWeight: "900" },
  cardCopy: { marginTop: 10, color: agriPalette.inkSoft, fontSize: 15, lineHeight: 22 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: agriPalette.mist },
  filterChipActive: { backgroundColor: agriPalette.field },
  filterChipText: { color: agriPalette.fieldDeep, fontSize: 13, fontWeight: "800" },
  filterChipTextActive: { color: agriPalette.white },
  filterCount: { color: agriPalette.fieldDeep, fontSize: 12, fontWeight: "900" },
  filterCountActive: { color: agriPalette.white },
  dateFilterPanel: { marginTop: 18, borderRadius: 24, borderWidth: 1, borderColor: agriPalette.border, backgroundColor: "#F7F3E8", padding: 16 },
  dateFilterEyebrow: { color: agriPalette.field, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  dateFilterTitle: { marginTop: 8, color: agriPalette.ink, fontSize: 18, fontWeight: "900" },
  dateFilterHint: { marginTop: 6, color: agriPalette.inkSoft, fontSize: 13, lineHeight: 20 },
  dateFilterActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  dateActionButton: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: agriPalette.white, borderWidth: 1, borderColor: "#D9DDCE" },
  dateActionButtonMuted: { backgroundColor: "#F0ECE2" },
  dateActionText: { color: agriPalette.fieldDeep, fontSize: 13, fontWeight: "800" },
  dateActionTextMuted: { color: agriPalette.inkSoft },
  dateChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  dateQuickChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#EEE7D8", borderWidth: 1, borderColor: "#E1D8C4" },
  dateQuickChipActive: { backgroundColor: agriPalette.field, borderColor: agriPalette.field },
  dateQuickChipText: { color: agriPalette.fieldDeep, fontSize: 12, fontWeight: "800" },
  dateQuickChipTextActive: { color: agriPalette.white },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  actionButton: { flexBasis: "48%", flexGrow: 1, minWidth: 220 },
  loadingWrap: { marginTop: 18, borderRadius: 24, paddingVertical: 26, backgroundColor: agriPalette.cream, borderWidth: 1, borderColor: agriPalette.border, alignItems: "center" },
  loadingText: { color: agriPalette.fieldDeep, fontSize: 14, fontWeight: "800" },
  requestStack: { gap: 14, marginTop: 18 },
  requestCard: { borderRadius: 26, borderWidth: 1, padding: 16 },
  requestCardHighlighted: { borderWidth: 2, borderColor: agriPalette.field, shadowColor: agriPalette.fieldDeep, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  requestFrame: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  dateBadge: {
    width: 78,
    minHeight: 94,
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: "rgba(31,77,46,0.08)",
    paddingVertical: 12,
    alignItems: "center",
    flexShrink: 0,
  },
  dateBadgeMonth: { color: agriPalette.field, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  dateBadgeDay: { marginTop: 8, color: agriPalette.ink, fontSize: 28, fontWeight: "900" },
  requestBody: { flex: 1 },
  requestHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  requestHeaderCopy: { flex: 1 },
  requestTitle: { color: agriPalette.ink, fontSize: 18, fontWeight: "900" },
  requestMeta: { marginTop: 4, color: agriPalette.inkSoft, fontSize: 13, lineHeight: 19 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: "800" },
  requestInfo: { marginTop: 10, color: agriPalette.fieldDeep, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  addressPill: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(255,255,255,0.66)" },
  addressText: { color: agriPalette.fieldDeep, fontSize: 12, fontWeight: "700" },
  statePanel: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 16, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 20, backgroundColor: "#FFF4D6" },
  statePanelCompleted: { backgroundColor: "#E4F1EB" },
  statePanelCancelled: { backgroundColor: "#F7E1D5" },
  stateText: { flex: 1, color: "#8A6510", fontSize: 13, fontWeight: "700", lineHeight: 19 },
  stateTextCompleted: { color: agriPalette.fieldDeep },
  stateTextCancelled: { color: agriPalette.redClay },
  cancelButton: { marginTop: 16 },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 18, paddingHorizontal: 20, paddingVertical: 30, borderRadius: 24, backgroundColor: agriPalette.cream, borderWidth: 1, borderColor: agriPalette.border },
  emptyTitle: { marginTop: 12, color: agriPalette.ink, fontSize: 18, fontWeight: "900" },
  emptyCopy: { marginTop: 8, color: agriPalette.inkSoft, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
