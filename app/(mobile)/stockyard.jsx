import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
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
  useWindowDimensions,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import AgriButton from "../../components/AgriButton";
import CrossPlatformDatePickerModal from "../../components/CrossPlatformDatePickerModal";
import DashboardShell from "../../components/DashboardShell";
import FormDetailsModal from "../../components/FormDetailsModal";
import StatCard from "../../components/StatCard";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const API_URL = apiUrl(apiRoutes.owner.forms);
const OWNER_SCHEDULES_URL = apiUrl(apiRoutes.owner.schedules);
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

async function requestOwnerSchedules(session = null) {
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

  const response = await fetch(OWNER_SCHEDULES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(
    response,
    `Owner schedule API request failed (HTTP ${response.status}).`
  );
}

function attachLinkedScheduleState(forms, schedules) {
  const linkedSchedules = new Map();

  (Array.isArray(schedules) ? schedules : []).forEach((schedule) => {
    const formId = Number.parseInt(schedule?.form_id, 10);
    const normalizedStatus = String(schedule?.status || "").trim().toLowerCase();

    if (formId > 0 && normalizedStatus !== "cancelled") {
      linkedSchedules.set(formId, schedule);
    }
  });

  return (Array.isArray(forms) ? forms : []).map((form) => {
    const linkedSchedule = linkedSchedules.get(Number.parseInt(form?.form_id, 10));

    return {
      ...form,
      has_linked_schedule: Boolean(linkedSchedule),
      linked_schedule_id: Number.parseInt(linkedSchedule?.schedule_id, 10) || 0,
      linked_schedule_status: linkedSchedule?.status || "",
    };
  });
}

function isQRExpired(expirationDate, isExpiredFlag) {
  if (typeof isExpiredFlag === "boolean") {
    return isExpiredFlag;
  }

  if (!expirationDate) {
    return true;
  }

  const parsedExpiry = parseSqlDateTime(expirationDate);

  if (!parsedExpiry) {
    return true;
  }

  return parsedExpiry.getTime() <= Date.now();
}

function getDaysRemaining(expirationDate) {
  if (!expirationDate) {
    return "No expiry recorded";
  }

  const expiry = parseSqlDateTime(expirationDate);

  if (!expiry) {
    return "No expiry recorded";
  }

  const today = new Date();
  const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return `Expired ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`;
  }

  if (diff === 0) {
    return "Expires today";
  }

  return `${diff} day${diff === 1 ? "" : "s"} left`;
}

function parseSqlDateTime(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const normalized = raw.replace(" ", "T");
  const parsed = new Date(normalized);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
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

function getRouteParamValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildRenewalSuccessNotice({ form, requestedDate, renewalRequestId }) {
  return {
    title: "Renewal booked",
    message: "Your renewal request was saved and is waiting for review.",
    requestedDate,
    renewalRequestId,
    formId: form?.form_id || 0,
    ownerName: form?.owner_name || "",
    species: form?.animal_species || "",
    eartagNumber: form?.animal_unique_identifier || "",
  };
}

export default function Stockyard() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
  const useStackedCardLayout = width < 780;
  const useWideActionRow = width >= 860;
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
  const [renewalSuccessNotice, setRenewalSuccessNotice] = useState(null);
  const [expandedFormId, setExpandedFormId] = useState(null);
  const highlightedFormId =
    parseInt(getRouteParamValue(params?.form_id), 10) || 0;

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

        const session = {
          accountId,
          firstName: storedFirstName,
          lastName: lastNameValue,
        };
        const [formsResult, schedulesResult] = await Promise.allSettled([
          requestForms(session),
          requestOwnerSchedules(session),
        ]);

        if (formsResult.status !== "fulfilled") {
          throw formsResult.reason;
        }

        const data = formsResult.value;
        const scheduleData =
          schedulesResult.status === "fulfilled" &&
          schedulesResult.value?.status === "success"
            ? schedulesResult.value.schedules
            : [];

        if (schedulesResult.status === "rejected") {
          console.error("Failed to load owner schedules:", schedulesResult.reason);
        }

        if (data.status === "success") {
          const nextForms = attachLinkedScheduleState(
            scopeFormsToOwner(data.forms, {
              accountId,
              firstName: storedFirstName,
              lastName: lastNameValue,
            }),
            scheduleData
          );
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

  useEffect(() => {
    if (
      expandedFormId !== null &&
      !filteredForms.some((form) => form.form_id === expandedFormId)
    ) {
      setExpandedFormId(null);
    }
  }, [expandedFormId, filteredForms]);

  useEffect(() => {
    if (!highlightedFormId) {
      return;
    }

    const hasTarget = forms.some(
      (form) => Number(form.form_id) === highlightedFormId
    );

    if (hasTarget) {
      setStatusFilter("All");
      setExpandedFormId(highlightedFormId);
    }
  }, [forms, highlightedFormId]);

  const fetchForms = async (session = null) => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      setLoadError("");

      const [formsResult, schedulesResult, sessionFirstName, sessionLastName, sessionAccountId] =
        await Promise.all([
          requestForms(session),
          requestOwnerSchedules(session).catch((error) => {
            console.error("Failed to refresh owner schedules:", error);
            return null;
          }),
          session?.firstName ?? AsyncStorage.getItem("first_name"),
          session?.lastName ?? AsyncStorage.getItem("last_name"),
          session?.accountId ?? AsyncStorage.getItem("account_id"),
        ]);

      const scheduleData =
        schedulesResult?.status === "success" ? schedulesResult.schedules : [];

      if (formsResult.status === "success") {
        const nextForms = attachLinkedScheduleState(
          scopeFormsToOwner(formsResult.forms, {
            accountId: sessionAccountId,
            firstName: sessionFirstName,
            lastName: sessionLastName,
          }),
          scheduleData
        );
        setForms(nextForms);
        setLoadError("");
      } else {
        setForms([]);
        setLoadError(
          formsResult.message && formsResult.message !== "No forms found"
            ? formsResult.message
            : ""
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

  const goToCheckSchedule = (form) => {
    router.push({
      pathname: "/checkSchedule",
      params: {
        form_id: String(form.form_id),
        ...(form.linked_schedule_id
          ? { schedule_id: String(form.linked_schedule_id) }
          : {}),
      },
    });
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

      setRenewalSuccessNotice(
        buildRenewalSuccessNotice({
          form: renewalTargetForm,
          requestedDate: data.requested_date,
          renewalRequestId: data.renewal_request_id,
        })
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
  const toggleFormExpansion = (formId) => {
    setExpandedFormId((current) => (current === formId ? null : formId));
  };

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
      subtitle="Check permits, booking, and renewal."
      summary={
        loading
          ? "Loading permits..."
          : `${activeCount} active, ${expiredCount} expired.`
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
            caption="Forms in your account."
            icon="barn"
            accent="meadow"
            loading={loading}
          />
          <StatCard
            label="Active QR"
            value={activeCount}
            caption="Ready to use."
            icon="qrcode-scan"
            accent="wheat"
            loading={loading}
          />
          <StatCard
            label="Expired"
            value={expiredCount}
            caption="Needs renewal."
            icon="calendar-remove-outline"
            accent="clay"
            loading={loading}
          />
        </View>

        <View style={styles.surfaceCard}>
          <Text style={styles.cardEyebrow}>Search and filter</Text>
          <Text style={styles.cardTitle}>Find a permit</Text>
          <Text style={styles.cardCopy}>
            Search by owner, species, eartag, or form number.
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
              title="Refresh"
              subtitle={null}
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
          <Text style={styles.cardTitle}>Your permits</Text>
          <Text style={styles.cardCopy}>Open details, book an inspection, or request renewal.</Text>

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
                      ? "Renewed"
                      : renewalCancelled
                        ? "Renew again"
                        : "Request renewal"
                  : "Schedule inspection";
                const renewalButtonSubtitle = null;
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
                const hasLinkedSchedule =
                  !expired && Boolean(item.has_linked_schedule);
                const actionButtonTitle = expired
                  ? renewalButtonTitle
                  : hasLinkedSchedule
                    ? "Check schedule"
                    : "Schedule inspection";
                const actionButtonIcon = expired
                  ? renewalButtonIcon
                  : hasLinkedSchedule
                    ? "calendar-month-outline"
                    : "calendar-plus-outline";
                const actionButtonVariant = expired
                  ? renewalButtonVariant
                  : hasLinkedSchedule
                    ? "primary"
                    : "sky";
                const permitSubtitle = item.owner_name || "Owner not recorded";
                const isExpanded = expandedFormId === item.form_id;
                const isHighlighted = Number(item.form_id) === highlightedFormId;

                return (
                  <View
                    key={item.form_id}
                    style={[
                      styles.formCard,
                      isHighlighted && styles.formCardHighlighted,
                    ]}
                  >
                    <Pressable
                      onPress={() => toggleFormExpansion(item.form_id)}
                      style={({ pressed }) => [
                        styles.summaryPressable,
                        pressed && styles.summaryPressablePressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.cardHeader,
                          useStackedCardLayout && styles.cardHeaderCompact,
                        ]}
                      >
                        <View style={styles.headerIdentity}>
                          <View
                            style={[
                              styles.recordIconWrap,
                              expired
                                ? styles.recordIconWrapExpired
                                : styles.recordIconWrapActive,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="clipboard-text-outline"
                              size={24}
                              color={
                                expired
                                  ? agriPalette.redClay
                                  : agriPalette.fieldDeep
                              }
                            />
                          </View>

                          <View style={styles.headerTextWrap}>
                            <Text style={styles.formTitle} numberOfLines={1}>
                              {item.animal_species || "Livestock record"}
                            </Text>
                            <Text style={styles.formMeta} numberOfLines={1}>
                              Form #{item.form_id} - {permitSubtitle}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.headerControls}>
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
                                expired
                                  ? agriPalette.redClay
                                  : agriPalette.fieldDeep
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

                          <View style={styles.expandIconWrap}>
                            <MaterialCommunityIcons
                              name={
                                isExpanded ? "chevron-up" : "chevron-down"
                              }
                              size={22}
                              color={agriPalette.fieldDeep}
                            />
                          </View>
                        </View>
                      </View>

                      <View style={styles.summaryMetrics}>
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipLabel}>Eartag</Text>
                          <Text style={styles.summaryChipValue} numberOfLines={1}>
                            {item.animal_unique_identifier || "Not provided"}
                          </Text>
                        </View>
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipLabel}>Date</Text>
                          <Text style={styles.summaryChipValue} numberOfLines={1}>
                            {formatDateLabel(item.date)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.summaryChip,
                            styles.summaryChipWide,
                            expired
                              ? styles.summaryChipExpired
                              : styles.summaryChipActive,
                          ]}
                        >
                          <Text style={styles.summaryChipLabel}>Permit</Text>
                          <Text
                            style={[
                              styles.summaryChipValue,
                              expired && styles.summaryChipValueExpired,
                            ]}
                            numberOfLines={1}
                          >
                            {qrMeta}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.expandHint}>
                        {isExpanded
                          ? "Tap to hide details"
                          : "Tap for details"}
                      </Text>
                    </Pressable>

                    {isExpanded ? (
                      <View style={styles.expandedContent}>
                        <View
                          style={[
                            styles.formBody,
                            useStackedCardLayout && styles.formBodyCompact,
                          ]}
                        >
                          <View
                            style={[
                              styles.detailColumn,
                              useStackedCardLayout && styles.detailColumnCompact,
                            ]}
                          >
                            <View
                              style={[
                                styles.infoGrid,
                                useStackedCardLayout && styles.infoGridCompact,
                              ]}
                            >
                              <View
                                style={[
                                  styles.infoBlock,
                                  useStackedCardLayout && styles.infoBlockCompact,
                                ]}
                              >
                                <Text style={styles.infoLabel}>Eartag</Text>
                                <Text style={styles.infoValue}>
                                  {item.animal_unique_identifier || "Not provided"}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.infoBlock,
                                  useStackedCardLayout && styles.infoBlockCompact,
                                ]}
                              >
                                <Text style={styles.infoLabel}>Inspection date</Text>
                                <Text style={styles.infoValue}>
                                  {formatDateLabel(item.date)}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.infoBlock,
                                  useStackedCardLayout && styles.infoBlockCompact,
                                ]}
                              >
                                <Text style={styles.infoLabel}>Origin</Text>
                                <Text style={styles.infoValue}>
                                  {item.animal_origin || "Not provided"}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.infoBlock,
                                  useStackedCardLayout && styles.infoBlockCompact,
                                ]}
                              >
                                <Text style={styles.infoLabel}>Destination</Text>
                                <Text style={styles.infoValue}>
                                  {item.animal_destination || "Not provided"}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.ownerPanel}>
                              <View style={styles.ownerPanelHeader}>
                                <MaterialCommunityIcons
                                  name="map-marker-outline"
                                  size={16}
                                  color={agriPalette.fieldDeep}
                                />
                                <Text style={styles.ownerPanelLabel}>
                                  Owner address
                                </Text>
                              </View>
                              <Text style={styles.ownerPanelValue} numberOfLines={2}>
                                {item.owner_address || "Not provided"}
                              </Text>
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
                                  expired
                                    ? agriPalette.redClay
                                    : agriPalette.fieldDeep
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
                                  renewalCancelled &&
                                    styles.renewalPanelCancelled,
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
                                    renewalCancelled &&
                                      styles.renewalPanelTextCancelled,
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
                              useStackedCardLayout && styles.qrCardStacked,
                              isCompact && styles.qrCardCompact,
                            ]}
                          >
                            {!useStackedCardLayout ? (
                              <Text style={styles.qrEyebrow}>Permit QR</Text>
                            ) : null}
                            <View
                              style={[
                                styles.qrSurface,
                                useStackedCardLayout && styles.qrSurfaceCompact,
                              ]}
                            >
                              <QRCode
                                value={item.qr_code}
                                size={isCompact ? 80 : 92}
                              />
                            </View>
                            <View
                              style={[
                                styles.qrCopyWrap,
                                useStackedCardLayout &&
                                  styles.qrCopyWrapStacked,
                                isCompact && styles.qrCopyWrapCompact,
                              ]}
                            >
                              {useStackedCardLayout ? (
                                <Text style={styles.qrEyebrowStacked}>
                                  Permit QR
                                </Text>
                              ) : null}
                              <Text
                                style={[
                                  styles.qrLabel,
                                  useStackedCardLayout && styles.qrLabelStacked,
                                ]}
                              >
                                Scan permit QR
                              </Text>
                              <Text
                                style={[
                                  styles.qrCaption,
                                  useStackedCardLayout &&
                                    styles.qrCaptionStacked,
                                ]}
                              >
                                Show this during verification.
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.actionStack,
                            useWideActionRow && styles.actionStackWide,
                          ]}
                        >
                          <View
                            style={useWideActionRow ? styles.actionCell : null}
                          >
                            <AgriButton
                              title="Details"
                              subtitle={null}
                              icon="file-search-outline"
                              variant="primary"
                              compact
                              onPress={() => openModal(item)}
                            />
                          </View>
                          <View
                            style={useWideActionRow ? styles.actionCell : null}
                          >
                            <AgriButton
                              title={actionButtonTitle}
                              subtitle={renewalButtonSubtitle}
                              icon={actionButtonIcon}
                              variant={actionButtonVariant}
                              compact
                              trailingIcon={expired ? false : "arrow-right"}
                              disabled={
                                renewalButtonDisabled ||
                                requestingRenewalId === item.form_id
                              }
                              loading={requestingRenewalId === item.form_id}
                              onPress={() =>
                                expired
                                  ? openRenewalRequest(item)
                                  : hasLinkedSchedule
                                    ? goToCheckSchedule(item)
                                    : goToAppointment(item)
                              }
                            />
                          </View>
                        </View>
                      </View>
                    ) : null}
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
              <Text style={styles.emptyCopy}>Try another search or filter.</Text>
            </View>
          )}
        </View>
      </View>

      <FormDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        form={selectedForm}
      />

      <CrossPlatformDatePickerModal
        visible={renewalPickerVisible}
        value={new Date()}
        minimumDate={new Date()}
        title="Choose a renewal date"
        description="Pick a day for this renewal."
        confirmLabel="Request renewal"
        onConfirm={submitRenewalRequest}
        onCancel={closeRenewalPicker}
      />

      <Modal
        transparent
        visible={Boolean(renewalSuccessNotice)}
        animationType="fade"
        onRequestClose={() => setRenewalSuccessNotice(null)}
      >
        <View style={styles.successOverlay}>
          <BlurView
            intensity={34}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.successBlurBackdrop}
          />
          <View style={styles.successTint} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setRenewalSuccessNotice(null)}
          />

          <View style={styles.successBox}>
            <View style={styles.successAccentBar} />

            <View style={styles.successHeader}>
              <View style={styles.successIconWrap}>
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={28}
                  color={agriPalette.fieldDeep}
                />
              </View>

              <View style={styles.successHeaderCopy}>
                <Text style={styles.successEyebrow}>Renewal request</Text>
                <Text style={styles.successTitle}>
                  {renewalSuccessNotice?.title || "Renewal booked"}
                </Text>
              </View>
            </View>

            <Text style={styles.successCopy}>
              {renewalSuccessNotice?.message ||
                "Your renewal request was saved."}
            </Text>

            <View style={styles.successStatusPill}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color="#8A6510"
              />
              <Text style={styles.successStatusText}>Pending</Text>
            </View>

            <View style={styles.successDetailsCard}>
              <View style={styles.successDetailRow}>
                <MaterialCommunityIcons
                  name="calendar-range"
                  size={16}
                  color={agriPalette.fieldDeep}
                />
                <Text style={styles.successDetailText}>
                  {formatDateLabel(renewalSuccessNotice?.requestedDate)}
                </Text>
              </View>

              <View style={styles.successDetailRow}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={16}
                  color={agriPalette.fieldDeep}
                />
                <Text style={styles.successDetailText}>
                  Form #{renewalSuccessNotice?.formId || "N/A"}
                  {renewalSuccessNotice?.renewalRequestId
                    ? ` | Request #${renewalSuccessNotice.renewalRequestId}`
                    : ""}
                </Text>
              </View>

              {(renewalSuccessNotice?.ownerName ||
                renewalSuccessNotice?.eartagNumber) ? (
                <View style={styles.successDetailRow}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={16}
                    color={agriPalette.fieldDeep}
                  />
                  <Text style={styles.successDetailText}>
                    {renewalSuccessNotice?.ownerName || "Owner not recorded"}
                    {renewalSuccessNotice?.eartagNumber
                      ? ` | ${renewalSuccessNotice.eartagNumber}`
                      : ""}
                  </Text>
                </View>
              ) : null}

              {renewalSuccessNotice?.species ? (
                <View style={styles.successDetailRow}>
                  <MaterialCommunityIcons
                    name="cow"
                    size={16}
                    color={agriPalette.fieldDeep}
                  />
                  <Text style={styles.successDetailText}>
                    {renewalSuccessNotice.species}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.successActions}>
              <AgriButton
                title="View renewals"
                icon="calendar-month-outline"
                variant="primary"
                compact
                trailingIcon={false}
                onPress={() => {
                  setRenewalSuccessNotice(null);
                  router.push({
                    pathname: "/checkSchedule",
                    params: { board: "renewal" },
                  });
                }}
              />
              <AgriButton
                title="Stay here"
                icon="arrow-left"
                variant="secondary"
                compact
                trailingIcon={false}
                onPress={() => setRenewalSuccessNotice(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: "100%",
    paddingBottom: 96,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 18,
  },
  surfaceCard: {
    width: "100%",
    alignSelf: "stretch",
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
    overflow: "hidden",
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
    width: "100%",
    minWidth: 0,
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
    minWidth: 0,
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
    width: "100%",
    gap: 14,
    marginTop: 18,
  },
  formCard: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 28,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
    overflow: "hidden",
  },
  formCardHighlighted: {
    borderColor: agriPalette.field,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  summaryPressable: {
    borderRadius: 22,
    minWidth: 0,
  },
  summaryPressablePressed: {
    opacity: 0.92,
  },
  cardHeader: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  cardHeaderCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recordIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  recordIconWrapActive: {
    backgroundColor: "#EAF6E8",
    borderColor: "#CDE1C6",
  },
  recordIconWrapExpired: {
    backgroundColor: "#FCEAE4",
    borderColor: "#EBC4B6",
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "100%",
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
    alignSelf: "flex-start",
    maxWidth: "100%",
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
    flexShrink: 1,
  },
  statusBadgeTextActive: {
    color: agriPalette.fieldDeep,
  },
  statusBadgeTextExpired: {
    color: agriPalette.redClay,
  },
  expandIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF0E3",
  },
  summaryMetrics: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  summaryChip: {
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryChipWide: {
    flexBasis: "100%",
  },
  summaryChipActive: {
    backgroundColor: "#EEF7E9",
    borderColor: "#D0E2CF",
  },
  summaryChipExpired: {
    backgroundColor: "#FDEAE1",
    borderColor: "#E6BEA9",
  },
  summaryChipLabel: {
    color: agriPalette.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  summaryChipValue: {
    marginTop: 6,
    color: agriPalette.ink,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  summaryChipValueExpired: {
    color: agriPalette.redClay,
  },
  expandHint: {
    marginTop: 10,
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  expandedContent: {
    width: "100%",
    minWidth: 0,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E1E7D7",
  },
  formBody: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  formBodyCompact: {
    flexDirection: "column",
  },
  detailColumn: {
    flex: 1,
    minWidth: 220,
    maxWidth: "100%",
    gap: 12,
  },
  detailColumnCompact: {
    minWidth: 0,
  },
  infoGrid: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 12,
  },
  infoGridCompact: {
    gap: 10,
  },
  infoBlock: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 0,
    alignSelf: "flex-start",
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "flex-start",
  },
  infoBlockCompact: {
    flexBasis: "48%",
    minWidth: 128,
    minHeight: 132,
    justifyContent: "space-between",
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
  ownerPanel: {
    minWidth: 0,
    borderRadius: 20,
    backgroundColor: "#FDFBF4",
    borderWidth: 1,
    borderColor: "#D9DFCC",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  ownerPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ownerPanelLabel: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  ownerPanelValue: {
    marginTop: 10,
    color: agriPalette.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    flexShrink: 1,
  },
  expiryPanel: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#EEF7E9",
    borderWidth: 1,
    borderColor: "#D0E2CF",
  },
  expiryPanelExpired: {
    backgroundColor: "#F7E1D5",
    borderColor: "#E6BEA9",
  },
  expiryPanelText: {
    flex: 1,
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    flexShrink: 1,
  },
  expiryPanelTextExpired: {
    color: agriPalette.redClay,
  },
  renewalPanel: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#FFF4D6",
    borderWidth: 1,
    borderColor: "#F0D48E",
  },
  renewalPanelCancelled: {
    backgroundColor: "#F7E1D5",
    borderColor: "#E6BEA9",
  },
  renewalPanelText: {
    flex: 1,
    color: "#8A6510",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    flexShrink: 1,
  },
  renewalPanelTextCancelled: {
    color: agriPalette.redClay,
  },
  qrCard: {
    maxWidth: "100%",
    minWidth: 0,
    width: 170,
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: 24,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  qrCardStacked: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 16,
    paddingHorizontal: 16,
    minWidth: 0,
  },
  qrCardCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  qrSurface: {
    alignSelf: "center",
    padding: 12,
    borderRadius: 18,
    backgroundColor: agriPalette.white,
  },
  qrSurfaceCompact: {
    padding: 12,
  },
  qrEyebrow: {
    color: agriPalette.field,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  qrEyebrowStacked: {
    color: agriPalette.field,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  qrCopyWrap: {
    marginTop: 12,
    alignItems: "center",
    minWidth: 0,
  },
  qrCopyWrapStacked: {
    flex: 1,
    marginTop: 0,
    alignItems: "flex-start",
    minWidth: 0,
  },
  qrCopyWrapCompact: {
    alignItems: "center",
  },
  qrLabel: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },
  qrLabelStacked: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "left",
  },
  qrCaption: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    flexShrink: 1,
  },
  qrCaptionStacked: {
    textAlign: "left",
  },
  actionStack: {
    width: "100%",
    gap: 10,
    marginTop: 16,
  },
  actionStackWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  actionCell: {
    flex: 1,
    minWidth: 0,
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
  successOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  successBlurBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  successTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12, 24, 16, 0.44)",
  },
  successBox: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: "#B9D3C6",
    overflow: "hidden",
  },
  successAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: agriPalette.fieldDeep,
  },
  successHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  successIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCECE2",
  },
  successHeaderCopy: {
    flex: 1,
  },
  successEyebrow: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  successTitle: {
    marginTop: 6,
    color: agriPalette.ink,
    fontSize: 26,
    fontWeight: "900",
  },
  successCopy: {
    marginTop: 16,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  successStatusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#FBF2D3",
  },
  successStatusText: {
    color: "#8A6510",
    fontSize: 13,
    fontWeight: "800",
  },
  successDetailsCard: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#B9D3C6",
    backgroundColor: "#EAF5EE",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  successDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  successDetailText: {
    flex: 1,
    color: agriPalette.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  successActions: {
    gap: 10,
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
