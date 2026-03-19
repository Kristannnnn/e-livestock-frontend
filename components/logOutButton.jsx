import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import AgriButton from "./AgriButton";
import LogoutConfirmModal from "./LogoutConfirmModal";
import logoutSession from "../lib/auth/logoutSession";

export default function LogoutButton() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    if (loading) {
      return;
    }

    setVisible(true);
  };

  const confirmLogout = async () => {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      await logoutSession();
      setVisible(false);
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert(
        "Logout failed",
        "We could not finish signing you out. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <LogoutConfirmModal
        visible={visible}
        loading={loading}
        onCancel={() => setVisible(false)}
        onConfirm={confirmLogout}
      />
      <AgriButton
        title="Logout"
        subtitle="End this session securely"
        icon="logout"
        variant="danger"
        onPress={handleLogout}
      />
    </View>
  );
}
