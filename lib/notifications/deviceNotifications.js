import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRoutes, apiUrl, parseJsonResponse } from "../api";

const PUSH_REGISTER_URL = apiUrl(apiRoutes.notifications.pushRegister);
const PUSH_UNREGISTER_URL = apiUrl(apiRoutes.notifications.pushUnregister);
const EXPO_PROJECT_ID = "c1fc60ba-176b-415a-8c55-afbf7698f44a";
const IS_EXPO_GO =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

let notificationsModulePromise = null;
let notificationsConfigured = false;

function getProjectId() {
  return EXPO_PROJECT_ID;
}

async function getNotificationsModuleAsync() {
  if (IS_EXPO_GO || Platform.OS === "web") {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications");
  }

  return notificationsModulePromise;
}

export function systemNotificationsSupported() {
  return !IS_EXPO_GO && Platform.OS !== "web";
}

export async function configureDeviceNotificationsAsync() {
  const Notifications = await getNotificationsModuleAsync();

  if (!Notifications || notificationsConfigured) {
    return false;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2F6B3D",
      sound: "default",
    });
  }

  notificationsConfigured = true;
  return true;
}

export async function getExpoPushTokenSafelyAsync() {
  try {
    const Notifications = await getNotificationsModuleAsync();

    if (!Notifications) {
      return { token: "", status: "unsupported_in_expo_go" };
    }

    await configureDeviceNotificationsAsync();

    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;

    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== "granted") {
      return { token: "", status: finalStatus };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return { token: "", status: "missing_project_id" };
    }

    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: pushToken.data || "", status: "granted" };
  } catch (error) {
    console.error("Push token error:", error);
    return { token: "", status: "error" };
  }
}

export async function syncAccountPushToken(accountId) {
  const parsedAccountId = Number(accountId) || 0;
  if (!parsedAccountId) {
    return { status: "missing_account_id", token: "" };
  }

  const { token, status } = await getExpoPushTokenSafelyAsync();

  if (!token) {
    return { status, token: "" };
  }

  const response = await fetch(PUSH_REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: parsedAccountId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: `${Platform.OS}-device`,
    }),
  });

  const data = await parseJsonResponse(
    response,
    "Invalid push token registration response.",
  );

  if (data.status !== "success") {
    throw new Error(data.message || "Failed to register push token.");
  }

  await AsyncStorage.setItem("push_token", token);
  return { status: "registered", token };
}

export async function unregisterAccountPushToken(accountId = 0) {
  const pushToken = (await AsyncStorage.getItem("push_token")) || "";

  if (!pushToken) {
    return { status: "missing_token" };
  }

  try {
    const response = await fetch(PUSH_UNREGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: Number(accountId) || 0,
        expo_push_token: pushToken,
      }),
    });

    await parseJsonResponse(response, "Invalid push token removal response.");
  } catch (error) {
    console.error("Push token removal error:", error);
  } finally {
    await AsyncStorage.removeItem("push_token");
  }

  return { status: "removed" };
}

export async function addNotificationResponseListenerAsync(onResponse) {
  const Notifications = await getNotificationsModuleAsync();

  if (!Notifications) {
    return null;
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse?.(response?.notification?.request?.content?.data || {});
  });
}
