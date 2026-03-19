import AsyncStorage from "@react-native-async-storage/async-storage";
import { unregisterAccountPushToken } from "../notifications/deviceNotifications";

export default async function logoutSession() {
  const [storedAccountId, storedUser] = await Promise.all([
    AsyncStorage.getItem("account_id"),
    AsyncStorage.getItem("user"),
  ]);

  let parsedUser = null;

  try {
    parsedUser = storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    parsedUser = null;
  }

  const accountId = Number.parseInt(
    storedAccountId || parsedUser?.account_id || "0",
    10,
  );

  await unregisterAccountPushToken(accountId);
  await AsyncStorage.clear();
}
