import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TextInput } from "react-native-paper";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import { apiRoutes, apiUrl } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const INFO_API = apiUrl(apiRoutes.profile.info);
const UPDATE_API = apiUrl(apiRoutes.profile.update);
const MAX_PROFILE_PICTURE_LENGTH = 500000;

const SETTINGS_META = {
  user: {
    eyebrow: "Owner settings",
    roleLabel: "owner",
    dashboardRoute: "/ownerDashboard",
    dashboardTitle: "owner dashboard",
  },
  livestockInspector: {
    eyebrow: "Inspector settings",
    roleLabel: "livestock inspector",
    dashboardRoute: "/livestockInspectorDashboard",
    dashboardTitle: "inspector dashboard",
  },
  AntemortemInspector: {
    eyebrow: "Antemortem settings",
    roleLabel: "antemortem inspector",
    dashboardRoute: "/antemortemDashboard",
    dashboardTitle: "antemortem dashboard",
  },
};

function buildEmptyProfile() {
  return {
    accountId: "",
    firstName: "",
    lastName: "",
    address: "",
    email: "",
    contactNumber: "",
    username: "",
    password: "",
    profilePicture: "",
  };
}

function getProfileInitials(firstName, lastName) {
  const initials = `${(firstName || "").trim().charAt(0)}${(lastName || "")
    .trim()
    .charAt(0)}`.toUpperCase();

  return initials || "U";
}

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(buildEmptyProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [profilePictureChanged, setProfilePictureChanged] = useState(false);
  const [role, setRole] = useState("user");

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);

      try {
        const [
          storedAccountId,
          storedUser,
          storedEmail,
          storedContactNumber,
          storedAddress,
          storedUsername,
          storedRole,
        ] = await Promise.all([
          AsyncStorage.getItem("account_id"),
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("email"),
          AsyncStorage.getItem("contact_number"),
          AsyncStorage.getItem("address"),
          AsyncStorage.getItem("username"),
          AsyncStorage.getItem("role"),
        ]);

        const parsedUser = storedUser ? JSON.parse(storedUser) : {};
        setRole(storedRole || parsedUser.account_type || "user");

        const baseProfile = {
          accountId: storedAccountId || String(parsedUser.account_id || ""),
          firstName: parsedUser.first_name || "",
          lastName: parsedUser.last_name || "",
          address: parsedUser.address || storedAddress || "",
          email: parsedUser.email || storedEmail || "",
          contactNumber:
            parsedUser.contact_number || storedContactNumber || "",
          username: parsedUser.username || storedUsername || "",
          password: "",
          profilePicture: parsedUser.profile_picture || "",
        };

        setProfile(baseProfile);

        if (baseProfile.accountId) {
          const response = await fetch(INFO_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account_id: baseProfile.accountId }),
          });
          const rawText = await response.text();
          const data = rawText ? JSON.parse(rawText) : {};

          if (data.status === "success" && data.user) {
            setProfile((current) => ({
              ...current,
              firstName: data.user.first_name ?? current.firstName,
              lastName: data.user.last_name ?? current.lastName,
              address: data.user.address ?? current.address,
              email: data.user.email ?? current.email,
              contactNumber: data.user.contact_number ?? current.contactNumber,
              username: data.user.username ?? current.username,
              profilePicture:
                data.user.profile_picture !== undefined
                  ? data.user.profile_picture || ""
                  : current.profilePicture,
            }));

            await AsyncStorage.setItem(
              "user",
              JSON.stringify({
                ...parsedUser,
                account_id: baseProfile.accountId,
                first_name: data.user.first_name ?? baseProfile.firstName,
                last_name: data.user.last_name ?? baseProfile.lastName,
                address: data.user.address ?? baseProfile.address,
                email: data.user.email ?? baseProfile.email,
                contact_number:
                  data.user.contact_number ?? baseProfile.contactNumber,
                username: data.user.username ?? baseProfile.username,
                profile_picture:
                  data.user.profile_picture !== undefined
                    ? data.user.profile_picture || ""
                    : parsedUser.profile_picture || "",
              })
            );
          }
        }
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "Failed to load your profile settings.");
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  const settingsMeta = SETTINGS_META[role] || SETTINGS_META.user;

  const updateField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handlePickProfilePicture = async () => {
    if (loading || saving || pickingImage) {
      return;
    }

    try {
      setPickingImage(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access so you can choose a profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const selectedAsset = result.assets[0];
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        selectedAsset.uri,
        [{ resize: { width: 640 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!manipulatedImage.base64) {
        throw new Error("Unable to prepare the selected image.");
      }

      const nextProfilePicture = `data:image/jpeg;base64,${manipulatedImage.base64}`;

      if (nextProfilePicture.length > MAX_PROFILE_PICTURE_LENGTH) {
        Alert.alert(
          "Image too large",
          "Please choose a smaller image with less detail so it can be saved safely."
        );
        return;
      }

      setProfile((current) => ({
        ...current,
        profilePicture: nextProfilePicture,
      }));
      setProfilePictureChanged(true);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Photo upload failed",
        "We could not prepare that image. Please try another photo."
      );
    } finally {
      setPickingImage(false);
    }
  };

  const handleRemoveProfilePicture = () => {
    if (!profile.profilePicture || loading || saving || pickingImage) {
      return;
    }

    Alert.alert("Remove photo", "Do you want to remove your profile picture?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setProfile((current) => ({ ...current, profilePicture: "" }));
          setProfilePictureChanged(true);
        },
      },
    ]);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.clear();
            router.replace("/");
          } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to log out.");
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!profile.accountId) {
      Alert.alert("Error", "Account ID is missing for this session.");
      return;
    }

    if (
      !profile.firstName.trim() ||
      !profile.lastName.trim() ||
      !profile.address.trim() ||
      !profile.email.trim() ||
      !profile.contactNumber.trim() ||
      !profile.username.trim()
    ) {
      Alert.alert("Error", "Please complete all required fields.");
      return;
    }

    if (!profile.email.includes("@")) {
      Alert.alert("Invalid email", "Email must contain @.");
      return;
    }

    if (profile.contactNumber.length !== 11) {
      Alert.alert(
        "Invalid phone number",
        "Phone number must be exactly 11 digits."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        account_id: Number.parseInt(profile.accountId, 10),
        first_name: profile.firstName.trim(),
        last_name: profile.lastName.trim(),
        address: profile.address.trim(),
        email: profile.email.trim(),
        contact_number: profile.contactNumber.trim(),
        username: profile.username.trim(),
      };

      if (profilePictureChanged) {
        if (profile.profilePicture) {
          payload.profile_picture = profile.profilePicture;
        } else {
          payload.remove_profile_picture = true;
        }
      }

      if (profile.password.trim()) {
        payload.password = profile.password;
      }

      const response = await fetch(UPDATE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const rawText = await response.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (data.status !== "success") {
        Alert.alert("Error", data.message || "Failed to update profile.");
        setSaving(false);
        return;
      }

      const storedUser = await AsyncStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : {};
      const savedProfilePicture =
        data.user?.profile_picture !== undefined
          ? data.user.profile_picture || ""
          : profile.profilePicture || "";
      const nextUser = {
        ...parsedUser,
        account_id: Number.parseInt(profile.accountId, 10),
        first_name: payload.first_name,
        last_name: payload.last_name,
        username: payload.username,
        address: payload.address,
        email: payload.email,
        contact_number: payload.contact_number,
        profile_picture: savedProfilePicture,
      };

      await AsyncStorage.multiSet([
        ["first_name", payload.first_name],
        ["last_name", payload.last_name],
        ["username", payload.username],
        ["email", payload.email],
        ["contact_number", payload.contact_number],
        ["address", payload.address],
        ["user", JSON.stringify(nextUser)],
      ]);

      setProfile((current) => ({
        ...current,
        password: "",
        profilePicture: savedProfilePicture,
      }));
      setProfilePictureChanged(false);
      Alert.alert("Success", "Your profile has been updated.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update profile.");
    }

    setSaving(false);
  };

  return (
    <DashboardShell
      eyebrow={settingsMeta.eyebrow}
      title="Profile settings"
      subtitle={`Update the ${settingsMeta.roleLabel} details connected to your account. Password is optional and only changes if you fill it in.`}
      summary={
        loading
          ? "Loading your account details..."
          : `Editing the ${settingsMeta.roleLabel} profile for ${profile.firstName || "your account"}.`
      }
    >
      <View style={styles.surfaceCard}>
        <Text style={styles.cardEyebrow}>Account profile</Text>
        <Text style={styles.cardTitle}>Edit your account details</Text>
        <Text style={styles.cardCopy}>
          These details are used for your login identity, contact profile, and
          account-linked records across the app. Keep them accurate so your
          assigned data stays matched to the right user.
        </Text>

        <View style={styles.profileHero}>
          <View style={styles.photoShell}>
            {profile.profilePicture ? (
              <Image
                source={{ uri: profile.profilePicture }}
                style={styles.profilePhoto}
              />
            ) : (
              <View style={styles.photoFallback}>
                <Text style={styles.photoFallbackText}>
                  {getProfileInitials(profile.firstName, profile.lastName)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileHeroCopy}>
            <Text style={styles.profilePhotoLabel}>Profile picture</Text>
            <Text style={styles.profilePhotoTitle}>
              {profile.firstName || profile.lastName
                ? `${profile.firstName} ${profile.lastName}`.trim()
                : "Your account"}
            </Text>
            <Text style={styles.profilePhotoHint}>
              Add a clear square photo so your account looks more personal and
              easier to recognize.
            </Text>
          </View>
        </View>

        <View style={styles.profileActionRow}>
          <TouchableOpacity
            style={styles.photoAction}
            onPress={handlePickProfilePicture}
            disabled={loading || saving || pickingImage}
            activeOpacity={0.86}
          >
            <MaterialCommunityIcons
              name={
                pickingImage
                  ? "image-sync-outline"
                  : profile.profilePicture
                    ? "image-edit-outline"
                    : "image-plus"
              }
              size={18}
              color={agriPalette.fieldDeep}
            />
            <Text style={styles.photoActionText}>
              {pickingImage
                ? "Preparing photo..."
                : profile.profilePicture
                  ? "Change photo"
                  : "Upload photo"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.photoAction,
              styles.photoActionSecondary,
              !profile.profilePicture && styles.photoActionDisabled,
            ]}
            onPress={handleRemoveProfilePicture}
            disabled={!profile.profilePicture || loading || saving || pickingImage}
            activeOpacity={0.86}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color={profile.profilePicture ? agriPalette.redClay : agriPalette.inkSoft}
            />
            <Text
              style={[
                styles.photoActionText,
                profile.profilePicture
                  ? styles.photoActionDangerText
                  : styles.photoActionMutedText,
              ]}
            >
              Remove photo
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formStack}>
          <TextInput
            label="First name"
            mode="outlined"
            value={profile.firstName}
            onChangeText={(value) => updateField("firstName", value)}
            style={styles.input}
            disabled={loading || saving}
          />
          <TextInput
            label="Last name"
            mode="outlined"
            value={profile.lastName}
            onChangeText={(value) => updateField("lastName", value)}
            style={styles.input}
            disabled={loading || saving}
          />
          <TextInput
            label="Address"
            mode="outlined"
            value={profile.address}
            onChangeText={(value) => updateField("address", value)}
            style={styles.input}
            disabled={loading || saving}
          />
          <TextInput
            label="Email"
            mode="outlined"
            value={profile.email}
            keyboardType="email-address"
            onChangeText={(value) => updateField("email", value)}
            style={styles.input}
            disabled={loading || saving}
          />
          <TextInput
            label="Phone number"
            mode="outlined"
            value={profile.contactNumber}
            keyboardType="phone-pad"
            onChangeText={(value) =>
              updateField("contactNumber", value.replace(/[^0-9]/g, "").slice(0, 11))
            }
            style={styles.input}
            disabled={loading || saving}
          />
          <TextInput
            label="Username"
            mode="outlined"
            value={profile.username}
            onChangeText={(value) => updateField("username", value)}
            style={styles.input}
            disabled={loading || saving}
          />
          <TextInput
            label="New password (optional)"
            mode="outlined"
            secureTextEntry
            value={profile.password}
            onChangeText={(value) => updateField("password", value)}
            style={styles.input}
            disabled={loading || saving}
          />
        </View>

        <View style={styles.actionStack}>
          <AgriButton
            title="Save settings"
            subtitle={`Update your ${settingsMeta.roleLabel} profile`}
            icon="content-save-outline"
            variant="primary"
            loading={saving}
            disabled={loading || saving}
            onPress={handleSave}
          />
          <AgriButton
            title="Back to dashboard"
            subtitle={`Return to your ${settingsMeta.dashboardTitle}`}
            icon="arrow-left"
            variant="secondary"
            onPress={() => router.replace(settingsMeta.dashboardRoute)}
          />
          <AgriButton
            title="Logout"
            subtitle="End this session securely"
            icon="logout"
            variant="danger"
            onPress={handleLogout}
          />
        </View>
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
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
  profileHero: {
    marginTop: 20,
    padding: 18,
    borderRadius: 26,
    backgroundColor: agriPalette.cream,
    borderWidth: 1,
    borderColor: agriPalette.border,
    flexDirection: "row",
    alignItems: "center",
  },
  photoShell: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 4,
    backgroundColor: agriPalette.wheatLight,
    justifyContent: "center",
    alignItems: "center",
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
  },
  photoFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
    backgroundColor: agriPalette.field,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFallbackText: {
    color: agriPalette.white,
    fontSize: 28,
    fontWeight: "900",
  },
  profileHeroCopy: {
    flex: 1,
    marginLeft: 16,
  },
  profilePhotoLabel: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  profilePhotoTitle: {
    marginTop: 6,
    color: agriPalette.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  profilePhotoHint: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  profileActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  photoAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: agriPalette.surfaceMuted,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  photoActionSecondary: {
    backgroundColor: "#FFF6F0",
    borderColor: "#F1D1C0",
  },
  photoActionDisabled: {
    backgroundColor: "#F6F1E7",
    borderColor: "#E5DCC7",
  },
  photoActionText: {
    marginLeft: 8,
    color: agriPalette.fieldDeep,
    fontSize: 14,
    fontWeight: "800",
  },
  photoActionDangerText: {
    color: agriPalette.redClay,
  },
  photoActionMutedText: {
    color: agriPalette.inkSoft,
  },
  formStack: {
    gap: 12,
    marginTop: 18,
  },
  input: {
    backgroundColor: agriPalette.surface,
  },
  actionStack: {
    gap: 12,
    marginTop: 18,
  },
});
