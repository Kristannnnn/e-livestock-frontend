import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import QRCode from "react-native-qrcode-svg";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import FormDetailsModal from "../../components/FormDetailsModal";
import StatCard from "../../components/StatCard";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const API_URL = apiUrl(apiRoutes.owner.forms);
const RENEWAL_REQUEST_URL = apiUrl(apiRoutes.renewals.request);

const filterOptions = ["All", "Active QR", "Expired QR"];

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

function scopeFormsToOwner(forms, session) {
  const records = Array.isArray(forms) ? forms : [];
  const accountId = Number.parseInt(session.accountId || "", 10);

  if (accountId > 0) {
    return records;
  }

  return records.filter((form) =>
    matchesOwnerName(form.owner_name, session.firstName, session.lastName)
  );
}

async function requestForms(session = null) {
  const accountId =
    session?.accountId ?? (await AsyncStorage.getItem("account_id"));
  const firstNameValue =
    session?.firstName ?? (await AsyncStorage.getItem("first_name"));
  const lastNameValue =
    session?.lastName ?? (await AsyncStorage.getItem("last_name"));

  const payload = {
    first_name: firstNameValue || "",
    last_name: lastNameValue || "",
  };

  if (accountId) {
    payload.account_id = Number.parseInt(accountId, 10);
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(
    response,
    `Stockyard API request failed (HTTP ${response.status}).`
  );
}

function isQRExpired(expirationDate, isExpiredFlag) {
  if (typeof isExpiredFlag === "boolean") {
    return isExpiredFlag;
  }

  if (!expirationDate) {
    return true;
  }

  return new Date(expirationDate) <= new Date();
}

function getDaysRemaining(expirationDate) {
  if (!expirationDate) {
    return "No expiry recorded";
  }

  const today = new Date();
  const expiry = new Date(expirationDate);
  const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return `Expired ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`;
  }

  if (diff === 0) {
    return "Expires today";
  }

  return `${diff} day${diff === 1 ? "" : "s"} left`;
}

function formatDateLabel(dateValue) {
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

function formatLocalDateValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeRenewalStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export default function Stockyard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
  const [forms, setForms] = useState([]);
  const [filteredForms, setFilteredForms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [accountId, setAccountId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [renewalPickerVisible, setRenewalPickerVisible] = useState(false);
  const [renewalTargetForm, setRenewalTargetForm] = useState(null);
  const [requestingRenewalId, setRequestingRenewalId] = useState(null);

  useEffect(() => {
    const loadSessionAndForms = async () => {
      try {
        const [storedFirstName, accountId, lastNameValue] =
          await Promise.all([
            AsyncStorage.getItem("first_name"),
            AsyncStorage.getItem("account_id"),
            AsyncStorage.getItem("last_name"),
          ]);

        if (storedFirstName) {
          setFirstName(storedFirstName);
        }
        if (lastNameValue) {
          setLastName(lastNameValue);
        }
        if (accountId) {
          setAccountId(accountId);
        }

        const data = await requestForms({
          accountId,
          firstName: storedFirstName,
          lastName: lastNameValue,
        });

        if (data.status === "success") {
          const nextForms = scopeFormsToOwner(data.forms, {
            accountId,
            firstName: storedFirstName,
            lastName: lastNameValue,
          });
          setForms(nextForms);
          setLoadError("");
        } else {
          setForms([]);
          setLoadError(
            data.message && data.message !== "No forms found"
              ? data.message
              : ""
          );
        }
      } catch (err) {
        console.error(err);
        setLoadError(err.message || "Failed to load your stockyard records.");
        Alert.alert("Error", "Failed to load your stockyard records.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    loadSessionAndForms();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();

    const nextForms = forms.filter((form) => {
      const expired = isQRExpired(form.qr_expiration, form.is_expired);
      const passesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active QR" && !expired) ||
        (statusFilter === "Expired QR" && expired);

      const passesSearch =
        query === "" ||
        (form.owner_name || "").toLowerCase().includes(query) ||
        (form.animal_unique_identifier || "").toLowerCase().includes(query) ||
        (form.animal_species || "").toLowerCase().includes(query) ||
        String(form.form_id).includes(query);

      return passesStatus && passesSearch;
    });

    setFilteredForms(nextForms);
  }, [searchQuery, statusFilter, forms]);

  const fetchForms = async (session = null) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      setLoadError("");

      const data = await requestForms(session);
      const sessionFirstName =
        session?.firstName ?? (await AsyncStorage.getItem("first_name"));
      const sessionLastName =
        session?.lastName ?? (await AsyncStorage.getItem("last_name"));
      const sessionAccountId =
        session?.accountId ?? (await AsyncStorage.getItem("account_id"));

      if (data.status === "success") {
        const nextForms = scopeFormsToOwner(data.forms, {
          accountId: sessionAccountId,
          firstName: sessionFirstName,
          lastName: sessionLastName,
        });
        setForms(nextForms);
        setLoadError("");
      } else {
        setForms([]);
        setLoadError(
          data.message && data.message !== "No forms found" ? data.message : ""
        );
      }
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "Failed to fetch forms.");
      Alert.alert("Error", "Failed to fetch forms.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchForms();
  };

  const goToAppointment = async (form) => {
    if (isQRExpired(form.qr_expiration, form.is_expired)) {
      Alert.alert(
        "QR Expired",
        "This permit has already expired. Please request a new inspection form before scheduling."
      );
      return;
    }

    await AsyncStorage.multiSet([
      ["selected_form_id", String(form.form_id)],
      ["selected_form_owner", form.owner_name || ""],
      ["selected_form_eartag", form.animal_unique_identifier || ""],
      ["selected_form_address", form.owner_address || ""],
      ["selected_form_expiration", form.qr_expiration || ""],
    ]);

    router.push("/appointment");
  };

  const openModal = (form) => {
    setSelectedForm(form);
    setModalVisible(true);
  };

  const openRenewalRequest = (form) => {
    if (!accountId) {
      Alert.alert("Error", "Your account could not be loaded for renewal.");
      return;
    }

    setRenewalTargetForm(form);
    setRenewalPickerVisible(true);
  };

  const closeRenewalPicker = () => {
    setRenewalPickerVisible(false);
    setRenewalTargetForm(null);
  };

  const submitRenewalRequest = async (selectedDate) => {
    if (!renewalTargetForm) {
      closeRenewalPicker();
      return;
    }

    try {
      setRequestingRenewalId(renewalTargetForm.form_id);
      closeRenewalPicker();

      const response = await fetch(RENEWAL_REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: Number.parseInt(accountId, 10),
          form_id: renewalTargetForm.form_id,
          requested_date: formatLocalDateValue(selectedDate),
        }),
      });

      const data = await parseJsonResponse(
        response,
        `Renewal request failed (HTTP ${response.status}).`
      );

      if (data.status !== "success") {
        Alert.alert(
          "Renewal request failed",
          data.message || "Unable to schedule the renewal request."
        );
        return;
      }

      Alert.alert(
        "Renewal scheduled",
        `Your renewal request was scheduled for ${formatDateLabel(
          data.requested_date
        )}.`
      );

      await fetchForms({
        accountId,
        firstName,
        lastName,
      });
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Renewal request failed",
        error.message || "Unable to schedule the renewal request."
      );
    } finally {
      setRequestingRenewalId(null);
    }
  };

  const activeCount = forms.filter(
    (form) => !isQRExpired(form.qr_expiration, form.is_expired)
  ).length;
  const expiredCount = forms.filter((form) =>
    isQRExpired(form.qr_expiration, form.is_expired)
  ).length;

  return (
    <DashboardShell
      eyebrow="Owner stockyard"
      title={
        firstName
          ? `${firstName}'s livestock permits`
          : lastName
          ? `${lastName}'s livestock permits`
          : "My stockyard"
      }
      subtitle="Review your submitted livestock records, scan QR validity quickly, and jump into scheduling from a cleaner stockyard layout."
      summary={
        loading
          ? "Refreshing your stockyard forms..."
          : `${activeCount} active QR permits and ${expiredCount} expired records in your stockyard.`
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.scrollContent}>
        <View style={styles.statsGrid}>
          <StatCard
            label="All permits"
            value={forms.length}
            caption="Every livestock form filed under your account."
            icon="barn"
            accent="meadow"
            loading={loading}
          />
          <StatCard
            label="Active QR"
            value={activeCount}
            caption="Permits currently ready for verification and scheduling."
            icon="qrcode-scan"
            accent="wheat"
            loading={loading}
          />
          <StatCard
            label="Expired"
            value={expiredCount}
            caption="Forms that now need renewal before the next movement."
            icon="calendar-remove-outline"
            accent="clay"
            loading={loading}
          />
        </View>

        <View style={styles.surfaceCard}>
          <Text style={styles.cardEyebrow}>Search and filter</Text>
          <Text style={styles.cardTitle}>Find the right permit faster</Text>
          <Text style={styles.cardCopy}>
            Search by owner, species, ear tag, or form number, then narrow the
            list to active or expired QR permits.
          </Text>

          <View style={styles.searchWrap}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={agriPalette.fieldDeep}
            />
            <TextInput
              placeholder="Search owner, species, eartag, or form number"
              placeholderTextColor={agriPalette.inkSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filterRow}>
            {filterOptions.map((option) => {
              const active = option === statusFilter;

              return (
                <View key={option} style={styles.filterChipWrap}>
                  <AgriButton
                    title={option}
                    variant={active ? "primary" : "muted"}
                    compact
                    subtitle={null}
                    icon={
                      option === "All"
                        ? "view-grid-outline"
                        : option === "Active QR"
                        ? "shield-check-outline"
                        : "calendar-remove-outline"
                    }
                    trailingIcon={false}
                    lightText={active}
                    onPress={() => setStatusFilter(option)}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.refreshButtonWrap}>
            <AgriButton
              title="Refresh permits"
              subtitle="Pull the latest stockyard records"
              icon="refresh"
              variant="sky"
              compact
              trailingIcon={false}
              onPress={onRefresh}
            />
          </View>
        </View>

        <View style={styles.surfaceCard}>
          <Text style={styles.cardEyebrow}>Permit list</Text>
          <Text style={styles.cardTitle}>Your submitted livestock records</Text>
          <Text style={styles.cardCopy}>
            Open full details, inspect QR validity at a glance, and create a
            schedule directly from each eligible record.
          </Text>

          {!!loadError && !loading && (
            <View style={styles.errorPanel}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={18}
                color={agriPalette.redClay}
              />
              <Text style={styles.errorPanelText}>{loadError}</Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator
              size="large"
              color={agriPalette.field}
              style={styles.loadingState}
            />
          ) : filteredForms.length ? (
            <View style={styles.formStack}>
              {filteredForms.map((item) => {
                const expired = isQRExpired(
                  item.qr_expiration,
                  item.is_expired
                );
                const qrMeta = getDaysRemaining(item.qr_expiration);
                const renewalStatus = normalizeRenewalStatus(
                  item.renewal_status
                );
                const renewalPending = renewalStatus === "pending";
                const renewalCompleted = renewalStatus === "completed";
                const renewalCancelled = renewalStatus === "cancelled";
                const showRenewalPanel =
                  expired &&
                  (renewalPending || renewalCompleted || renewalCancelled);
                const renewalButtonTitle = expired
                  ? renewalPending
                    ? "Renewal requested"
                    : renewalCompleted
                      ? "Renewal completed"
                      : renewalCancelled
                        ? "Request renewal again"
                        : "Request renewal"
                  : "Create schedule";
                const renewalButtonSubtitle = expired
                  ? renewalPending
                    ? `Scheduled for ${formatDateLabel(
                        item.renewal_requested_date
                      )}`
                    : renewalCompleted
                      ? item.renewed_form_id
                        ? `Updated under form #${item.renewed_form_id}`
                        : "The inspector already completed this renewal."
                      : renewalCancelled
                        ? item.renewal_cancel_reason ||
                          "The previous renewal schedule was cancelled."
                        : "Choose the date when you want the inspector to renew it"
                  : "Book an appointment for this livestock form";
                const renewalButtonIcon = expired
                  ? renewalPending
                    ? "calendar-clock-outline"
                    : renewalCompleted
                      ? "check-decagram-outline"
                      : "calendar-plus-outline"
                  : "calendar-plus-outline";
                const renewalButtonVariant = expired
                  ? renewalPending || renewalCompleted
                    ? "muted"
                    : "earth"
                  : "sky";
                const renewalButtonDisabled =
                  expired && (renewalPending || renewalCompleted);

                return (
                  <View key={item.form_id} style={styles.formCard}>
                    <View
                      style={[
                        styles.cardHeader,
                        isCompact && styles.cardHeaderCompact,
                      ]}
                    >
                      <View style={styles.headerTextWrap}>
                        <Text style={styles.formTitle}>
                          {item.animal_species || "Livestock record"}
                        </Text>
                        <Text style={styles.formMeta}>
                          Form #{item.form_id} - {item.owner_name || "Owner"}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          expired
                            ? styles.statusBadgeExpired
                            : styles.statusBadgeActive,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            expired
                              ? "calendar-remove-outline"
                              : "shield-check-outline"
                          }
                          size={15}
                          color={
                            expired ? agriPalette.redClay : agriPalette.fieldDeep
                          }
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            expired
                              ? styles.statusBadgeTextExpired
                              : styles.statusBadgeTextActive,
                          ]}
                        >
                          {expired ? "Expired QR" : "Active QR"}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.formBody,
                        isCompact && styles.formBodyCompact,
                      ]}
                    >
                      <View
                        style={[
                          styles.detailColumn,
                          isCompact && styles.detailColumnCompact,
                        ]}
                      >
                        <View
                          style={[
                            styles.infoGrid,
                            isCompact && styles.infoGridCompact,
                          ]}
                        >
                          <View style={styles.infoBlock}>
                            <Text style={styles.infoLabel}>Eartag</Text>
                            <Text style={styles.infoValue}>
                              {item.animal_unique_identifier || "Not provided"}
                            </Text>
                          </View>
                          <View style={styles.infoBlock}>
                            <Text style={styles.infoLabel}>Inspection date</Text>
                            <Text style={styles.infoValue}>
                              {formatDateLabel(item.date)}
                            </Text>
                          </View>
                          <View style={[styles.infoBlock, styles.infoBlockFull]}>
                            <Text style={styles.infoLabel}>Owner address</Text>
                            <Text style={styles.infoValue}>
                              {item.owner_address || "Not provided"}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.expiryPanel,
                            expired && styles.expiryPanelExpired,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={16}
                            color={
                              expired ? agriPalette.redClay : agriPalette.fieldDeep
                            }
                          />
                          <Text
                            style={[
                              styles.expiryPanelText,
                              expired && styles.expiryPanelTextExpired,
                            ]}
                          >
                            {qrMeta}
                          </Text>
                        </View>

                        {showRenewalPanel ? (
                          <View
                            style={[
                              styles.renewalPanel,
                              renewalCancelled && styles.renewalPanelCancelled,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={
                                renewalPending
                                  ? "calendar-clock-outline"
                                  : renewalCompleted
                                    ? "check-decagram-outline"
                                    : "calendar-remove-outline"
                              }
                              size={16}
                              color={
                                renewalPending
                                  ? agriPalette.fieldDeep
                                  : renewalCompleted
                                    ? agriPalette.field
                                    : agriPalette.redClay
                              }
                            />
                            <Text
                              style={[
                                styles.renewalPanelText,
                                renewalCancelled && styles.renewalPanelTextCancelled,
                              ]}
                            >
                              {renewalPending
                                ? `Renewal requested for ${formatDateLabel(
                                    item.renewal_requested_date
                                  )}`
                                : renewalCompleted
                                  ? item.renewed_form_id
                                    ? `Renewal completed with form #${item.renewed_form_id}.`
                                    : "Renewal already completed for this record."
                                  : item.renewal_cancel_reason ||
                                    "Renewal request cancelled."}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View
                        style={[
                          styles.qrCard,
                          isCompact && styles.qrCardCompact,
                        ]}
                      >
                        <View
                          style={[
                            styles.qrSurface,
                            isCompact && styles.qrSurfaceCompact,
                          ]}
                        >
                          <QRCode value={item.qr_code} size={isCompact ? 80 : 92} />
                        </View>
                        <Text
                          style={[
                            styles.qrLabel,
                            isCompact && styles.qrLabelCompact,
                          ]}
                        >
                          Scan permit QR
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionStack}>
                      <AgriButton
                        title="View details"
                        subtitle="Open the full livestock record"
                        icon="file-search-outline"
                        variant="primary"
                        compact
                        onPress={() => openModal(item)}
                      />
                      <AgriButton
                        title={renewalButtonTitle}
                        subtitle={renewalButtonSubtitle}
                        icon={renewalButtonIcon}
                        variant={renewalButtonVariant}
                        compact
                        trailingIcon={expired ? false : "arrow-right"}
                        disabled={
                          renewalButtonDisabled ||
                          requestingRenewalId === item.form_id
                        }
                        loading={requestingRenewalId === item.form_id}
                        onPress={() =>
                          expired ? openRenewalRequest(item) : goToAppointment(item)
                        }
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="barn"
                size={34}
                color={agriPalette.field}
              />
              <Text style={styles.emptyTitle}>No permits match this view</Text>
              <Text style={styles.emptyCopy}>
                Try a different search term or switch the QR filter to see more
                stockyard records.
              </Text>
            </View>
          )}
        </View>
      </View>

      <FormDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        form={selectedForm}
      />

      <DateTimePickerModal
        isVisible={renewalPickerVisible}
        mode="date"
        minimumDate={new Date()}
        onConfirm={submitRenewalRequest}
        onCancel={closeRenewalPicker}
      />
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 96,
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  refreshButtonWrap: {
    marginTop: 14,
  },
  filterChipWrap: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 150,
  },
  loadingState: {
    marginVertical: 40,
  },
  formStack: {
    gap: 14,
    marginTop: 18,
  },
  formCard: {
    borderRadius: 28,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardHeaderCompact: {
    flexDirection: "column",
  },
  headerTextWrap: {
    flex: 1,
  },
  formTitle: {
    color: agriPalette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  formMeta: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusBadgeActive: {
    backgroundColor: "#EEF7E9",
  },
  statusBadgeExpired: {
    backgroundColor: "#F7E1D5",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusBadgeTextActive: {
    color: agriPalette.fieldDeep,
  },
  statusBadgeTextExpired: {
    color: agriPalette.redClay,
  },
  formBody: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 16,
  },
  formBodyCompact: {
    flexDirection: "column",
  },
  detailColumn: {
    flex: 1,
    minWidth: 220,
  },
  detailColumnCompact: {
    minWidth: 0,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoGridCompact: {
    flexDirection: "column",
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
  expiryPanel: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#EEF7E9",
  },
  expiryPanelExpired: {
    backgroundColor: "#F7E1D5",
  },
  expiryPanelText: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  expiryPanelTextExpired: {
    color: agriPalette.redClay,
  },
  renewalPanel: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#FFF4D6",
  },
  renewalPanelCancelled: {
    backgroundColor: "#F7E1D5",
  },
  renewalPanelText: {
    flex: 1,
    color: "#8A6510",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  renewalPanelTextCancelled: {
    color: agriPalette.redClay,
  },
  qrCard: {
    width: 138,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  qrCardCompact: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 14,
    paddingHorizontal: 16,
  },
  qrSurface: {
    padding: 10,
    borderRadius: 18,
    backgroundColor: agriPalette.white,
  },
  qrSurfaceCompact: {
    padding: 12,
  },
  qrLabel: {
    marginTop: 10,
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  qrLabelCompact: {
    marginTop: 0,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "left",
  },
  actionStack: {
    gap: 10,
    marginTop: 16,
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
  errorPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#F7E1D5",
    borderWidth: 1,
    borderColor: "#E6BEA9",
  },
  errorPanelText: {
    flex: 1,
    color: agriPalette.redClay,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
});
