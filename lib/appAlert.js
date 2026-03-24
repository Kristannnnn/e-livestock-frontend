import { Alert } from "react-native";

const listeners = new Set();
const alertQueue = [];
const originalAlert =
  typeof Alert.alert === "function" ? Alert.alert.bind(Alert) : null;

let nextAlertId = 1;
let alertOverrideInstalled = false;

function notifyListeners() {
  const snapshot = [...alertQueue];
  listeners.forEach((listener) => listener(snapshot));
}

function normalizeButtons(buttons) {
  const normalizedButtons = Array.isArray(buttons)
    ? buttons.filter(Boolean)
    : [];

  if (!normalizedButtons.length) {
    return [{ text: "OK" }];
  }

  return normalizedButtons;
}

function shouldUseCustomAlert(title, message, buttons) {
  const hasContent =
    String(title ?? "").trim() !== "" || String(message ?? "").trim() !== "";
  const buttonCount = Array.isArray(buttons)
    ? buttons.filter(Boolean).length
    : 0;

  return hasContent && buttonCount <= 1;
}

export function enqueueAppAlert(payload) {
  alertQueue.push({
    id: nextAlertId++,
    title: String(payload?.title ?? "").trim(),
    message: String(payload?.message ?? "").trim(),
    buttons: normalizeButtons(payload?.buttons),
    options: payload?.options || {},
  });
  notifyListeners();
}

export function dismissAppAlert(alertId) {
  const nextIndex = alertQueue.findIndex((item) => item.id === alertId);

  if (nextIndex === -1) {
    return;
  }

  alertQueue.splice(nextIndex, 1);
  notifyListeners();
}

export function subscribeToAppAlerts(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  listeners.add(listener);
  listener([...alertQueue]);

  return () => {
    listeners.delete(listener);
  };
}

export function installAppAlertOverride() {
  if (alertOverrideInstalled || !originalAlert) {
    return;
  }

  Alert.alert = (title, message, buttons, options) => {
    if (shouldUseCustomAlert(title, message, buttons)) {
      enqueueAppAlert({
        title,
        message,
        buttons,
        options,
      });
      return;
    }

    return originalAlert(title, message, buttons, options);
  };

  alertOverrideInstalled = true;
}

export function getOriginalAlert() {
  return originalAlert;
}
