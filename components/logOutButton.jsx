import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import AgriButton from "./AgriButton";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              router.replace("/");
            } catch (err) {
              console.error("Logout error:", err);
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <AgriButton
      title="Logout"
      subtitle="End this session securely"
      icon="logout"
      variant="danger"
      onPress={handleLogout}
    />
  );
}
