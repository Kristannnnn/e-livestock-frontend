import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AgriButton from "./AgriButton";
import { agriPalette } from "../constants/agriTheme";

function normalizeDate(dateValue) {
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
    return null;
  }

  return new Date(
    dateValue.getFullYear(),
    dateValue.getMonth(),
    dateValue.getDate(),
    12,
    0,
    0,
    0
  );
}

function formatInputDate(dateValue) {
  const parsed = normalizeDate(dateValue);

  if (!parsed) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseInputDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    12,
    0,
    0,
    0
  );
}

function formatReadableDate(dateValue) {
  const parsed = normalizeDate(dateValue);

  if (!parsed) {
    return "";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getRangeHint(minimumDate, maximumDate) {
  const minLabel = formatReadableDate(minimumDate);
  const maxLabel = formatReadableDate(maximumDate);

  if (minLabel && maxLabel) {
    return `Available range: ${minLabel} to ${maxLabel}.`;
  }

  if (minLabel) {
    return `Choose ${minLabel} or later.`;
  }

  if (maxLabel) {
    return `Choose ${maxLabel} or earlier.`;
  }

  return "";
}

function getTodayShortcut(minimumDate, maximumDate) {
  const today = normalizeDate(new Date());
  const min = normalizeDate(minimumDate);
  const max = normalizeDate(maximumDate);

  if (min && today < min) {
    return min;
  }

  if (max && today > max) {
    return max;
  }

  return today;
}

function getValidationMessage(selectedDate, minimumDate, maximumDate) {
  const parsed = normalizeDate(selectedDate);

  if (!parsed) {
    return "Choose a valid date before continuing.";
  }

  const min = normalizeDate(minimumDate);
  const max = normalizeDate(maximumDate);

  if (min && parsed < min) {
    return `Pick ${formatReadableDate(min)} or a later date.`;
  }

  if (max && parsed > max) {
    return `Pick ${formatReadableDate(max)} or an earlier date.`;
  }

  return "";
}

export default function CrossPlatformDatePickerModal({
  visible,
  value,
  minimumDate,
  maximumDate,
  onConfirm,
  onCancel,
  title = "Choose a date",
  description = "Pick a date.",
  confirmLabel = "Use this date",
}) {
  const [draftValue, setDraftValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextValue = formatInputDate(
      normalizeDate(value) || getTodayShortcut(minimumDate, maximumDate)
    );

    setDraftValue(nextValue);
    setErrorMessage("");
  }, [visible, value, minimumDate, maximumDate]);

  const parsedDraftDate = useMemo(
    () => parseInputDate(draftValue),
    [draftValue]
  );
  const previewLabel = formatReadableDate(parsedDraftDate);
  const rangeHint = getRangeHint(minimumDate, maximumDate);

  const handleConfirm = () => {
    const validationMessage = getValidationMessage(
      parsedDraftDate,
      minimumDate,
      maximumDate
    );

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    onConfirm?.(parsedDraftDate);
  };

  const handleTodayPress = () => {
    setDraftValue(formatInputDate(getTodayShortcut(minimumDate, maximumDate)));
    setErrorMessage("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <View style={styles.card}>
          <View style={styles.iconShell}>
            <MaterialCommunityIcons
              name="calendar-range"
              size={28}
              color={agriPalette.fieldDeep}
            />
          </View>

          <Text style={styles.eyebrow}>Web date picker</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>{description}</Text>

          {rangeHint ? (
            <View style={styles.noticeCard}>
              <MaterialCommunityIcons
                name="calendar-check-outline"
                size={18}
                color={agriPalette.field}
              />
              <Text style={styles.noticeText}>{rangeHint}</Text>
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Date</Text>
            <View style={styles.inputShell}>
              <input
                type="date"
                value={draftValue}
                min={formatInputDate(minimumDate) || undefined}
                max={formatInputDate(maximumDate) || undefined}
                onChange={(event) => {
                  setDraftValue(event.target.value);
                  setErrorMessage("");
                }}
                aria-label={title}
                style={webInputStyle}
              />
            </View>
            <Text style={styles.previewText}>
              {previewLabel || "Pick a day."}
            </Text>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </View>

          <Pressable style={styles.quickAction} onPress={handleTodayPress}>
            <MaterialCommunityIcons
              name="calendar-today"
              size={16}
              color={agriPalette.fieldDeep}
            />
            <Text style={styles.quickActionText}>Use closest valid day</Text>
          </Pressable>

          <View style={styles.actionStack}>
            <AgriButton
              title="Cancel"
              icon="close"
              variant="secondary"
              compact
              trailingIcon={false}
              onPress={onCancel}
            />
            <AgriButton
              title={confirmLabel}
              icon="check-circle-outline"
              variant="primary"
              compact
              trailingIcon={false}
              onPress={handleConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const webInputStyle = {
  width: "100%",
  minHeight: "52px",
  borderRadius: "18px",
  border: `1px solid ${agriPalette.border}`,
  padding: "12px 14px",
  fontSize: "16px",
  lineHeight: "20px",
  color: agriPalette.ink,
  background: agriPalette.white,
  boxSizing: "border-box",
  outline: "none",
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: 22,
    backgroundColor: "rgba(16, 27, 19, 0.42)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 24,
    backgroundColor: agriPalette.surface,
    borderWidth: 1,
    borderColor: agriPalette.border,
    boxShadow: "0px 24px 48px rgba(18, 33, 24, 0.2)",
  },
  iconShell: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    marginTop: 16,
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  copy: {
    marginTop: 10,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 18,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  noticeText: {
    flex: 1,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  fieldBlock: {
    marginTop: 18,
  },
  fieldLabel: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputShell: {
    marginTop: 10,
  },
  previewText: {
    marginTop: 10,
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 8,
    color: agriPalette.redClay,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  quickActionText: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "700",
  },
  actionStack: {
    gap: 12,
    marginTop: 18,
  },
});
