import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import AgriButton from "../../components/AgriButton";
import CrossPlatformDatePickerModal from "../../components/CrossPlatformDatePickerModal";
import DashboardShell from "../../components/DashboardShell";
import StatCard from "../../components/StatCard";
import { agriPalette } from "../../constants/agriTheme";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";

function parseDateOnly(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : normalized
  );

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

function toApiDate(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string"
      ? parseDateOnly(value)
      : null;

  if (!parsed) {
    return typeof value === "string" && value ? value : "Date not available";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value) {
  const parsed = value instanceof Date ? value : parseDateOnly(value);
  if (!parsed) return "TBD";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(timeValue) {
  if (!timeValue) return "Time pending";
  const parsed = new Date(`1970-01-01T${timeValue}`);
  if (Number.isNaN(parsed.getTime())) return timeValue;

  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSlotRange(slot) {
  return `${formatTimeLabel(slot?.[0])} - ${formatTimeLabel(slot?.[1])}`;
}

function getSlotBucket(startTime) {
  const hour = Number.parseInt(String(startTime || "").slice(0, 2), 10);
  if (Number.isNaN(hour)) return "Open slot";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Late day";
}

function getPermitSummary(expirationDate) {
  const parsed = parseDateOnly(expirationDate);
  if (!parsed) {
    return { value: "TBD", caption: "Permit date missing." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((parsed - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { value: "Expired", caption: "Permit expired." };
  }
  if (diffDays === 0) {
    return { value: "Today", caption: "Book today." };
  }

  return {
    value: `${diffDays}d`,
    caption: `By ${formatDateLabel(parsed)}.`,
  };
}

function getSlotPalette(startTime) {
  const bucket = getSlotBucket(startTime);

  if (bucket === "Morning") {
    return {
      background: "#FFF7E0",
      border: "#E7D29B",
      badgeBackground: "#F8E8B5",
      badgeText: "#896310",
      icon: "weather-sunset-up",
    };
  }

  if (bucket === "Afternoon") {
    return {
      background: "#EEF6EA",
      border: "#C9DBBE",
      badgeBackground: "#DDEBD6",
      badgeText: agriPalette.fieldDeep,
      icon: "weather-sunny",
    };
  }

  return {
    background: "#E8EFF4",
    border: "#C8D7E3",
    badgeBackground: "#D6E3EC",
    badgeText: "#315E8F",
    icon: "weather-night",
  };
}

function buildBookingSuccessNotice({
  autoStatus,
  severityRating,
  ownerName,
  eartagNumber,
  location,
  date,
  slot,
}) {
  const normalizedStatus = String(autoStatus || "Pending").trim().toLowerCase();
  const windowLabel = `${formatDateLabel(date)} | ${formatSlotRange(slot)}`;

  if (normalizedStatus === "accepted") {
    return {
      status: "accepted",
      title: "Booking confirmed",
      message: "Your visit was accepted and added to the schedule.",
      ownerName,
      eartagNumber,
      location,
      windowLabel,
      severityRating,
    };
  }

  return {
    status: "pending",
    title: "Booking submitted",
    message: "Your visit was saved and is waiting for review.",
    ownerName,
    eartagNumber,
    location,
    windowLabel,
    severityRating,
  };
}

function getBookingSuccessAppearance(status) {
  if (status === "accepted") {
    return {
      icon: "calendar-check-outline",
      eyebrow: "Schedule ready",
      accent: agriPalette.fieldDeep,
      surface: "#EAF5EE",
      border: "#B9D3C6",
      iconSurface: "#DCECE2",
      pillSurface: "#E1EFE8",
      pillText: agriPalette.fieldDeep,
      actionVariant: "primary",
      statusLabel: "Accepted",
    };
  }

  return {
    icon: "clock-outline",
    eyebrow: "Waiting for review",
    accent: "#8A6510",
    surface: "#FFF7E1",
    border: "#E8D08B",
    iconSurface: "#F8E8B5",
    pillSurface: "#FBF2D3",
    pillText: "#8A6510",
    actionVariant: "secondary",
    statusLabel: "Pending",
  };
}

async function requestAvailableSlots(dateValue) {
  const selectedDay = toApiDate(dateValue);
  const response = await fetch(apiUrl(apiRoutes.appointments.available), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: selectedDay }),
  });

  const data = await parseJsonResponse(
    response,
    `Available slots request failed (HTTP ${response.status}).`
  );

  if (data.status !== "success") {
    return [];
  }

  let slots = Array.isArray(data.available_slots) ? data.available_slots : [];
  const today = new Date();

  if (selectedDay === toApiDate(today)) {
    const currentMinutes = today.getHours() * 60 + today.getMinutes();

    slots = slots.filter((slot) => {
      const [hour, minute] = String(slot?.[0] || "").split(":");
      const slotMinutes =
        Number.parseInt(hour || "", 10) * 60 +
        Number.parseInt(minute || "0", 10);

      return Number.isFinite(slotMinutes) && slotMinutes >= currentMinutes;
    });
  }

  return slots;
}

export default function Appointment() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 920;

  const [formId, setFormId] = useState(null);
  const [ownerName, setOwnerName] = useState("");
  const [eartagNumber, setEartagNumber] = useState("");
  const [location, setLocation] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [booking, setBooking] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [successNotice, setSuccessNotice] = useState(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [storedFormId, storedOwner, storedEartag, storedAddress, storedExpiration] =
          await Promise.all([
            AsyncStorage.getItem("selected_form_id"),
            AsyncStorage.getItem("selected_form_owner"),
            AsyncStorage.getItem("selected_form_eartag"),
            AsyncStorage.getItem("selected_form_address"),
            AsyncStorage.getItem("selected_form_expiration"),
          ]);

        if (!active) return;

        const parsedFormId = Number.parseInt(storedFormId || "", 10);
        setFormId(Number.isNaN(parsedFormId) ? null : parsedFormId);
        setOwnerName(storedOwner || "");
        setEartagNumber(storedEartag || "");
        setLocation(storedAddress || "");
        setExpirationDate(storedExpiration || "");
      } catch (error) {
        console.error(error);
        if (active) {
          Alert.alert("Error", "Unable to load permit details.");
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  const parsedExpirationDate = parseDateOnly(expirationDate);
  const maxDate =
    parsedExpirationDate && parsedExpirationDate >= minDate
      ? parsedExpirationDate
      : minDate;

  useEffect(() => {
    if (date > maxDate) {
      setDate(maxDate);
    }
  }, [date, maxDate]);

  useEffect(() => {
    let active = true;

    const loadSlots = async () => {
      try {
        setLoadingSlots(true);
        const slots = await requestAvailableSlots(date);
        if (active) {
          setAvailableSlots(slots);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setAvailableSlots([]);
          Alert.alert("Error", "Unable to fetch available slots.");
        }
      } finally {
        if (active) {
          setLoadingSlots(false);
        }
      }
    };

    loadSlots();
    return () => {
      active = false;
    };
  }, [date]);

  const refreshSlots = async () => {
    try {
      setLoadingSlots(true);
      const slots = await requestAvailableSlots(date);
      setAvailableSlots(slots);
    } catch (error) {
      console.error(error);
      setAvailableSlots([]);
      Alert.alert("Error", "Unable to fetch available slots.");
    } finally {
      setLoadingSlots(false);
    }
  };

  const openConfirmation = (slot) => {
    if (!formId) {
      Alert.alert(
        "Permit not ready",
        "Open booking from the stockyard so it stays linked to the correct livestock form."
      );
      return;
    }

    setSelectedSlot(slot);
    setConfirmVisible(true);
  };

  const bookSlot = async () => {
    if (!selectedSlot || !formId) {
      setConfirmVisible(false);
      Alert.alert("Missing details", "Pick a valid slot before booking.");
      return;
    }

    setConfirmVisible(false);
    setBooking(true);

    try {
      const response = await fetch(apiUrl(apiRoutes.appointments.create), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: formId,
          owner_name: ownerName,
          eartag_number: eartagNumber,
          location,
          date: toApiDate(date),
          start_time: selectedSlot[0],
          end_time: selectedSlot[1],
        }),
      });

      const data = await parseJsonResponse(
        response,
        `Create appointment request failed (HTTP ${response.status}).`
      );

      if (data.status === "success") {
        setSuccessNotice(
          buildBookingSuccessNotice({
            autoStatus: data.auto_status,
            severityRating: data.severity_rating,
            ownerName,
            eartagNumber,
            location,
            date,
            slot: selectedSlot,
          })
        );
      } else {
        Alert.alert("Error", data.message || "Failed to create appointment");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Network error");
    } finally {
      setBooking(false);
    }
  };

  const permitSummary = getPermitSummary(expirationDate);
  const nextSlot = availableSlots[0] || null;
  const successAppearance = getBookingSuccessAppearance(successNotice?.status);
  const morningCount = availableSlots.filter(
    (slot) => getSlotBucket(slot?.[0]) === "Morning"
  ).length;
  const afternoonCount = availableSlots.filter(
    (slot) => getSlotBucket(slot?.[0]) === "Afternoon"
  ).length;

  return (
    <DashboardShell
      eyebrow="Appointment booking"
      title={ownerName ? `Book a visit for ${ownerName}` : "Schedule an inspection visit"}
      subtitle="Pick a day and slot for this permit."
      summary={
        formId
          ? `Form #${formId} ready to book.`
          : "Open a permit from the stockyard first."
      }
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.statsGrid}>
        <StatCard
          label="Open slots"
          value={loadingSlots ? "..." : availableSlots.length}
          caption="Open on this day."
          icon="calendar-clock-outline"
          accent="wheat"
          loading={loadingSlots}
        />
        <StatCard
          label="Selected day"
          value={formatShortDate(date)}
          caption={formatDateLabel(date)}
          icon="calendar-range"
          accent="sky"
        />
        <StatCard
          label="Permit window"
          value={permitSummary.value}
          caption={permitSummary.caption}
          icon="shield-check-outline"
          accent="meadow"
        />
      </View>

      <View style={styles.surfaceCard}>
        <View style={[styles.heroRow, isWide && styles.heroRowWide]}>
          <View style={styles.heroCopy}>
            <Text style={styles.cardEyebrow}>Permit overview</Text>
            <Text style={styles.cardTitle}>Confirm permit</Text>
            <Text style={styles.cardCopy}>Check the linked record before booking.</Text>

            <View style={[styles.infoGrid, isWide && styles.infoGridWide]}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Owner</Text>
                <Text style={styles.infoValue}>{ownerName || "Not loaded yet"}</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Eartag</Text>
                <Text style={styles.infoValue}>{eartagNumber || "No eartag recorded"}</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{location || "No address recorded"}</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Valid until</Text>
                <Text style={styles.infoValue}>
                  {parsedExpirationDate
                    ? formatDateLabel(parsedExpirationDate)
                    : "Permit date unavailable"}
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <AgriButton
                title="Pick day"
                subtitle={null}
                icon="calendar-edit-outline"
                variant="secondary"
                compact
                trailingIcon={false}
                onPress={() => setShowPicker(true)}
                style={styles.actionButton}
              />
              <AgriButton
                title="Refresh slots"
                subtitle={null}
                icon="refresh"
                variant="sky"
                compact
                trailingIcon={false}
                loading={loadingSlots}
                onPress={refreshSlots}
                style={styles.actionButton}
              />
            </View>
          </View>

          <View style={styles.highlightCard}>
            <Text style={styles.highlightEyebrow}>
              {nextSlot ? "Next opening" : "Date status"}
            </Text>
            <Text style={styles.highlightTitle}>
              {loadingSlots ? "Refreshing..." : nextSlot ? formatSlotRange(nextSlot) : "No open slots"}
            </Text>
            <Text style={styles.highlightMeta}>{formatDateLabel(date)}</Text>
            <View style={styles.highlightStats}>
              <View style={styles.highlightPill}>
                <Text style={styles.highlightValue}>{morningCount}</Text>
                <Text style={styles.highlightLabel}>Morning</Text>
              </View>
              <View style={styles.highlightPill}>
                <Text style={styles.highlightValue}>{afternoonCount}</Text>
                <Text style={styles.highlightLabel}>Afternoon</Text>
              </View>
            </View>
            <Text style={styles.highlightCopy}>
              {nextSlot
                ? "Tap a slot below."
                : "Try another date."}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.cardEyebrow}>Available slots</Text>
            <Text style={styles.cardTitle}>Choose a slot</Text>
            <Text style={styles.cardCopy}>Tap a time to continue.</Text>
          </View>
          <View style={styles.queueBadge}>
            <MaterialCommunityIcons
              name="calendar-star"
              size={16}
              color={agriPalette.fieldDeep}
            />
            <Text style={styles.queueBadgeText}>{availableSlots.length} open</Text>
          </View>
        </View>

        {loadingSlots ? (
          <ActivityIndicator
            size="large"
            color={agriPalette.field}
            style={styles.loadingState}
          />
        ) : availableSlots.length ? (
          <View style={[styles.slotGrid, isWide && styles.slotGridWide]}>
            {availableSlots.map((slot, index) => {
              const palette = getSlotPalette(slot?.[0]);

              return (
                <Pressable
                  key={`${slot?.[0] || "start"}-${slot?.[1] || "end"}-${index}`}
                  onPress={() => openConfirmation(slot)}
                  style={({ pressed }) => [
                    styles.slotCard,
                    {
                      backgroundColor: palette.background,
                      borderColor: palette.border,
                    },
                    pressed && styles.slotCardPressed,
                  ]}
                >
                  <View style={styles.slotHeader}>
                    <View
                      style={[
                        styles.slotIconWrap,
                        { backgroundColor: palette.badgeBackground },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={palette.icon}
                        size={20}
                        color={palette.badgeText}
                      />
                    </View>

                    <View style={styles.slotTextWrap}>
                      <Text style={styles.slotTime}>{formatSlotRange(slot)}</Text>
                      <Text style={styles.slotDay}>{formatDateLabel(date)}</Text>
                    </View>

                    <View
                      style={[
                        styles.slotBadge,
                        { backgroundColor: palette.badgeBackground },
                      ]}
                    >
                      <Text style={[styles.slotBadgeText, { color: palette.badgeText }]}>
                        {getSlotBucket(slot?.[0])}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.slotHint}>
                    {index === 0
                      ? "Earliest open slot."
                      : "Tap to book."}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="calendar-remove-outline"
              size={36}
              color={agriPalette.field}
            />
            <Text style={styles.emptyTitle}>No open visits on this day</Text>
            <Text style={styles.emptyCopy}>
              Try another day before{" "}
              {parsedExpirationDate
                ? formatDateLabel(parsedExpirationDate)
                : "the permit expires"}
              .
            </Text>
            <View style={styles.actionRow}>
              <AgriButton
                title="Pick day"
                subtitle={null}
                icon="calendar-range"
                variant="secondary"
                compact
                trailingIcon={false}
                onPress={() => setShowPicker(true)}
                style={styles.actionButton}
              />
              <AgriButton
                title="Refresh"
                subtitle={null}
                icon="refresh"
                variant="sky"
                compact
                trailingIcon={false}
                onPress={refreshSlots}
                style={styles.actionButton}
              />
            </View>
          </View>
        )}
      </View>

      <CrossPlatformDatePickerModal
        visible={showPicker}
        value={date > maxDate ? maxDate : date}
        minimumDate={minDate}
        maximumDate={maxDate}
        title="Choose a day"
        description="Pick a day to check open slots."
        confirmLabel="Use this day"
        onConfirm={(selectedDate) => {
          setShowPicker(false);
          setDate(selectedDate);
        }}
        onCancel={() => setShowPicker(false)}
      />

      <Modal transparent visible={confirmVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={36}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.blurBackdrop}
          />
          <View style={styles.modalTint} />
          <View style={styles.modalBox}>
            <Text style={styles.modalEyebrow}>Confirm booking</Text>
            <Text style={styles.modalTitle}>Book this visit?</Text>
            <Text style={styles.modalCopy}>This will be added to your schedule.</Text>

            <View style={styles.modalSummary}>
              <Text style={styles.modalSummaryText}>
                {selectedSlot ? formatSlotRange(selectedSlot) : "Time pending"}
              </Text>
              <Text style={styles.modalSummaryMeta}>{formatDateLabel(date)}</Text>
              <Text style={styles.modalSummaryMeta}>
                {ownerName || "Owner not loaded"}
                {eartagNumber ? ` | ${eartagNumber}` : ""}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <AgriButton
                title="Confirm"
                subtitle={null}
                icon="check-circle-outline"
                variant="primary"
                compact
                trailingIcon={false}
                loading={booking}
                disabled={booking}
                onPress={bookSlot}
              />
              <AgriButton
                title="Back"
                subtitle={null}
                icon="arrow-left"
                variant="muted"
                compact
                trailingIcon={false}
                lightText={false}
                disabled={booking}
                onPress={() => setConfirmVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={Boolean(successNotice)}
        animationType="fade"
        onRequestClose={() => setSuccessNotice(null)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={36}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.blurBackdrop}
          />
          <View style={styles.modalTint} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSuccessNotice(null)}
          />

          <View
            style={[
              styles.successBox,
              { borderColor: successAppearance.border },
            ]}
          >
            <View
              style={[
                styles.successAccentBar,
                { backgroundColor: successAppearance.accent },
              ]}
            />

            <View style={styles.successHeader}>
              <View
                style={[
                  styles.successIconWrap,
                  { backgroundColor: successAppearance.iconSurface },
                ]}
              >
                <MaterialCommunityIcons
                  name={successAppearance.icon}
                  size={28}
                  color={successAppearance.accent}
                />
              </View>

              <View style={styles.successHeaderCopy}>
                <Text
                  style={[
                    styles.successEyebrow,
                    { color: successAppearance.accent },
                  ]}
                >
                  {successAppearance.eyebrow}
                </Text>
                <Text style={styles.successTitle}>
                  {successNotice?.title || "Booking saved"}
                </Text>
              </View>
            </View>

            <Text style={styles.successCopy}>
              {successNotice?.message || "Your visit was added to the schedule."}
            </Text>

            <View
              style={[
                styles.successStatusPill,
                { backgroundColor: successAppearance.pillSurface },
              ]}
            >
              <MaterialCommunityIcons
                name={successAppearance.icon}
                size={16}
                color={successAppearance.pillText}
              />
              <Text
                style={[
                  styles.successStatusText,
                  { color: successAppearance.pillText },
                ]}
              >
                {successAppearance.statusLabel}
              </Text>
            </View>

            <View
              style={[
                styles.successDetailsCard,
                {
                  backgroundColor: successAppearance.surface,
                  borderColor: successAppearance.border,
                },
              ]}
            >
              <View style={styles.successDetailRow}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={16}
                  color={successAppearance.accent}
                />
                <Text style={styles.successDetailText}>
                  {successNotice?.ownerName || "Owner not loaded"}
                  {successNotice?.eartagNumber
                    ? ` | ${successNotice.eartagNumber}`
                    : ""}
                </Text>
              </View>

              <View style={styles.successDetailRow}>
                <MaterialCommunityIcons
                  name="calendar-clock-outline"
                  size={16}
                  color={successAppearance.accent}
                />
                <Text style={styles.successDetailText}>
                  {successNotice?.windowLabel || "Time not available"}
                </Text>
              </View>

              {successNotice?.location ? (
                <View style={styles.successDetailRow}>
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={16}
                    color={successAppearance.accent}
                  />
                  <Text style={styles.successDetailText}>
                    {successNotice.location}
                  </Text>
                </View>
              ) : null}

              {successNotice?.severityRating !== null &&
              successNotice?.severityRating !== undefined ? (
                <View style={styles.successSeverityRow}>
                  <Text style={styles.successSeverityLabel}>Severity</Text>
                  <Text style={styles.successSeverityValue}>
                    {successNotice.severityRating}
                  </Text>
                </View>
              ) : null}
            </View>

            <AgriButton
              title="Back to stockyard"
              icon="arrow-left"
              variant={successAppearance.actionVariant}
              compact
              trailingIcon={false}
              onPress={() => {
                setSuccessNotice(null);
                router.replace("/stockyard");
              }}
            />
          </View>
        </View>
      </Modal>
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
  heroRow: {
    gap: 18,
  },
  heroRowWide: {
    flexDirection: "row",
  },
  heroCopy: {
    flex: 1.1,
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
  infoGrid: {
    gap: 12,
    marginTop: 18,
  },
  infoGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 22,
    backgroundColor: agriPalette.cream,
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
    lineHeight: 21,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  actionButton: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 220,
  },
  highlightCard: {
    flex: 0.9,
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#F2E0A4",
    minHeight: 220,
    justifyContent: "space-between",
  },
  highlightEyebrow: {
    color: "rgba(31,77,46,0.74)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  highlightTitle: {
    marginTop: 12,
    color: agriPalette.fieldDeep,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  highlightMeta: {
    marginTop: 10,
    color: "rgba(31,77,46,0.82)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  highlightStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  highlightPill: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.34)",
    alignItems: "center",
  },
  highlightValue: {
    color: agriPalette.fieldDeep,
    fontSize: 22,
    fontWeight: "900",
  },
  highlightLabel: {
    marginTop: 4,
    color: "rgba(31,77,46,0.72)",
    fontSize: 12,
    fontWeight: "800",
  },
  highlightCopy: {
    marginTop: 18,
    color: "rgba(31,77,46,0.82)",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  queueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: agriPalette.mist,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  queueBadgeText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  loadingState: {
    marginVertical: 40,
  },
  slotGrid: {
    gap: 14,
    marginTop: 18,
  },
  slotGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  slotCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 250,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  slotCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  slotHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  slotIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  slotTextWrap: {
    flex: 1,
  },
  slotTime: {
    color: agriPalette.ink,
    fontSize: 19,
    fontWeight: "900",
  },
  slotDay: {
    marginTop: 5,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  slotBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slotBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  slotHint: {
    marginTop: 14,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  blurBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  modalEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  modalTitle: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  modalCopy: {
    marginTop: 10,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  modalSummary: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modalSummaryText: {
    color: agriPalette.fieldDeep,
    fontSize: 18,
    fontWeight: "900",
  },
  modalSummaryMeta: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  modalActions: {
    gap: 10,
    marginTop: 18,
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
    overflow: "hidden",
  },
  successAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
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
  },
  successHeaderCopy: {
    flex: 1,
  },
  successEyebrow: {
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
  },
  successStatusText: {
    fontSize: 13,
    fontWeight: "800",
  },
  successDetailsCard: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 22,
    borderWidth: 1,
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
  successSeverityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(32,49,38,0.08)",
    paddingTop: 12,
  },
  successSeverityLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  successSeverityValue: {
    color: agriPalette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
});
