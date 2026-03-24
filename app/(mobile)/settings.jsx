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
import LogoutConfirmModal from "../../components/LogoutConfirmModal";
import { apiRoutes, apiUrl } from "../../lib/api";
import logoutSession from "../../lib/auth/logoutSession";
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

const PROFILE_FIELDS = [
  {
    field: "firstName",
    label: "First name",
    icon: "account-outline",
    autoCapitalize: "words",
    helper: "Name on file.",
  },
  {
    field: "lastName",
    label: "Last name",
    icon: "badge-account-outline",
    autoCapitalize: "words",
    helper: "Used on records.",
  },
  {
    field: "address",
    label: "Address",
    icon: "map-marker-outline",
    autoCapitalize: "words",
    helper: "Shown on permits.",
  },
  {
    field: "email",
    label: "Email",
    icon: "email-outline",
    keyboardType: "email-address",
    autoCapitalize: "none",
    helper: "Used for alerts and recovery.",
  },
  {
    field: "contactNumber",
    label: "Phone number",
    icon: "phone-outline",
    keyboardType: "phone-pad",
    autoCapitalize: "none",
    helper: "Use 11 digits.",
  },
  {
    field: "username",
    label: "Username",
    icon: "at",
    autoCapitalize: "none",
    helper: "Your sign-in name.",
  },
  {
    field: "password",
    label: "New password (optional)",
    icon: "lock-outline",
    secureTextEntry: true,
    autoCapitalize: "none",
    helper: "Leave blank to keep current password.",
  },
];

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

function normalizeProfileState(nextProfile) {
  return {
    ...buildEmptyProfile(),
    ...nextProfile,
    password: "",
  };
}

function hasProfileChanges(currentProfile, savedProfile) {
  if ((currentProfile.password || "").trim()) {
    return true;
  }

  return [
    "firstName",
    "lastName",
    "address",
    "email",
    "contactNumber",
    "username",
    "profilePicture",
  ].some(
    (field) =>
      String(currentProfile[field] || "").trim() !==
      String(savedProfile[field] || "").trim()
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(buildEmptyProfile());
  const [savedProfile, setSavedProfile] = useState(buildEmptyProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [profilePictureChanged, setProfilePictureChanged] = useState(false);
  const [role, setRole] = useState("user");
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editableFields, setEditableFields] = useState({});

  const applyLoadedProfile = (nextProfile) => {
    const normalizedProfile = normalizeProfileState(nextProfile);
    setProfile(normalizedProfile);
    setSavedProfile(normalizedProfile);
    setProfilePictureChanged(false);
    setEditableFields({});
  };

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

        applyLoadedProfile(baseProfile);

        if (baseProfile.accountId) {
          const response = await fetch(INFO_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account_id: baseProfile.accountId }),
          });
          const rawText = await response.text();
          const data = rawText ? JSON.parse(rawText) : {};

          if (data.status === "success" && data.user) {
            const refreshedProfile = {
              ...baseProfile,
              firstName: data.user.first_name ?? baseProfile.firstName,
              lastName: data.user.last_name ?? baseProfile.lastName,
              address: data.user.address ?? baseProfile.address,
              email: data.user.email ?? baseProfile.email,
              contactNumber:
                data.user.contact_number ?? baseProfile.contactNumber,
              username: data.user.username ?? baseProfile.username,
              profilePicture:
                data.user.profile_picture !== undefined
                  ? data.user.profile_picture || ""
                  : baseProfile.profilePicture,
            };

            applyLoadedProfile(refreshedProfile);

            await AsyncStorage.setItem(
              "user",
              JSON.stringify({
                ...parsedUser,
                account_id: baseProfile.accountId,
                first_name: refreshedProfile.firstName,
                last_name: refreshedProfile.lastName,
                address: refreshedProfile.address,
                email: refreshedProfile.email,
                contact_number:
                  refreshedProfile.contactNumber,
                username: refreshedProfile.username,
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
  const hasUnsavedChanges = hasProfileChanges(profile, savedProfile);
  const hasActiveEditors = Object.values(editableFields).some(Boolean);
  const isFieldEditable = (field) =>
    !!editableFields[field] && !loading && !saving;
  const isPhotoEditable = isFieldEditable("profilePicture");

  const updateField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const toggleFieldEditing = (field) => {
    if (loading || saving) {
      return;
    }

    setEditableFields((current) => {
      const nextIsEditable = !current[field];

      if (!nextIsEditable && field === "password") {
        setProfile((currentProfile) => ({
          ...currentProfile,
          password: "",
        }));
      }

      return {
        ...current,
        [field]: nextIsEditable,
      };
    });
  };

  const handlePickProfilePicture = async () => {
    if (!isPhotoEditable || pickingImage) {
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
    if (
      !profile.profilePicture ||
      !isPhotoEditable ||
      pickingImage
    ) {
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

  const handleDiscardChanges = () => {
    if (saving || !hasUnsavedChanges) {
      return;
    }

    Alert.alert(
      "Discard changes",
      "Do you want to remove your unsaved profile changes?",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setProfile(normalizeProfileState(savedProfile));
            setProfilePictureChanged(false);
            setEditableFields({});
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    if (loggingOut) {
      return;
    }

    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);
      await logoutSession();
      setLogoutModalVisible(false);
      router.replace("/");
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Logout failed",
        "We could not finish signing you out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      return;
    }

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

      applyLoadedProfile({
        ...profile,
        firstName: payload.first_name,
        lastName: payload.last_name,
        address: payload.address,
        email: payload.email,
        contactNumber: payload.contact_number,
        username: payload.username,
        password: "",
        profilePicture: savedProfilePicture,
      });
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
      subtitle={`Review and update your ${settingsMeta.roleLabel} details.`}
      summary={
        loading
          ? "Loading profile..."
          : hasActiveEditors
            ? `Editing ${profile.firstName || "your account"}. Save when ready.`
            : `Profile for ${profile.firstName || "your account"}. Tap Edit to unlock a field.`
      }
    >
      <LogoutConfirmModal
        visible={logoutModalVisible}
        loading={loggingOut}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={confirmLogout}
      />

      <View style={styles.surfaceCard}>
        <View style={styles.settingsHeaderRow}>
          <View style={styles.settingsHeaderIcon}>
            <MaterialCommunityIcons
              name="cog-outline"
              size={24}
              color={agriPalette.fieldDeep}
            />
          </View>
          <View style={styles.settingsHeaderCopy}>
            <Text style={styles.cardEyebrow}>Account profile</Text>
            <Text style={styles.cardTitle}>Edit your account details</Text>
          </View>
        </View>
        <Text style={styles.cardCopy}>
          Keep these details current so records stay linked to the right account.
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
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.profilePhotoLabel}>Profile picture</Text>
              <TouchableOpacity
                style={[
                  styles.fieldEditButton,
                  isPhotoEditable
                    ? styles.fieldEditButtonActive
                    : styles.fieldEditButtonLocked,
                ]}
                onPress={() => toggleFieldEditing("profilePicture")}
                disabled={loading || saving}
                activeOpacity={0.88}
              >
                <MaterialCommunityIcons
                  name={isPhotoEditable ? "check-circle-outline" : "square-edit-outline"}
                  size={15}
                  color={isPhotoEditable ? agriPalette.fieldDeep : agriPalette.inkSoft}
                />
                <Text
                  style={[
                    styles.fieldEditButtonText,
                    isPhotoEditable
                      ? styles.fieldEditButtonTextActive
                      : styles.fieldEditButtonTextLocked,
                  ]}
                >
                  {isPhotoEditable ? "Done" : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.profilePhotoTitle}>
              {profile.firstName || profile.lastName
                ? `${profile.firstName} ${profile.lastName}`.trim()
                : "Your account"}
            </Text>
            <Text style={styles.profilePhotoHint}>
              Add a clear photo so your account is easy to recognize.
            </Text>
          </View>
        </View>

        <View style={styles.profileActionRow}>
          <TouchableOpacity
            style={[
              styles.photoAction,
              !isPhotoEditable && styles.photoActionDisabled,
            ]}
            onPress={handlePickProfilePicture}
            disabled={!isPhotoEditable || pickingImage}
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
            <Text
              style={[
                styles.photoActionText,
                !isPhotoEditable && styles.photoActionMutedText,
              ]}
            >
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
              (!profile.profilePicture || !isPhotoEditable) &&
                styles.photoActionDisabled,
            ]}
            onPress={handleRemoveProfilePicture}
            disabled={
              !profile.profilePicture || !isPhotoEditable || pickingImage
            }
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
          {PROFILE_FIELDS.map((fieldConfig) => {
            const isPasswordField = fieldConfig.field === "password";
            const fieldEditable = isFieldEditable(fieldConfig.field);

            return (
              <View
                key={fieldConfig.field}
                style={[
                  styles.inputCard,
                  fieldEditable
                    ? styles.inputCardEditable
                    : styles.inputCardLocked,
                ]}
              >
                <View style={styles.inputCardHeader}>
                  <View style={styles.inputCardTitleRow}>
                    <View
                      style={[
                        styles.inputCardIcon,
                        fieldEditable
                          ? styles.inputCardIconEditable
                          : styles.inputCardIconLocked,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={fieldConfig.icon}
                        size={18}
                        color={
                          fieldEditable
                            ? agriPalette.fieldDeep
                            : agriPalette.inkSoft
                        }
                      />
                    </View>
                    <View style={styles.inputCardCopy}>
                      <Text style={styles.inputCardLabel}>{fieldConfig.label}</Text>
                      <Text style={styles.inputCardHint}>
                        {fieldEditable
                          ? fieldConfig.helper
                          : "Tap Edit to unlock."}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.fieldEditButton,
                      fieldEditable
                        ? styles.fieldEditButtonActive
                        : styles.fieldEditButtonLocked,
                    ]}
                    onPress={() => toggleFieldEditing(fieldConfig.field)}
                    disabled={loading || saving}
                    activeOpacity={0.88}
                  >
                    <MaterialCommunityIcons
                      name={
                        fieldEditable
                          ? "check-circle-outline"
                          : "square-edit-outline"
                      }
                      size={15}
                      color={
                        fieldEditable
                          ? agriPalette.fieldDeep
                          : agriPalette.inkSoft
                      }
                    />
                    <Text
                      style={[
                        styles.fieldEditButtonText,
                        fieldEditable
                          ? styles.fieldEditButtonTextActive
                          : styles.fieldEditButtonTextLocked,
                      ]}
                    >
                      {fieldEditable ? "Done" : "Edit"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  label={fieldConfig.label}
                  mode="outlined"
                  value={profile[fieldConfig.field]}
                  onChangeText={(value) =>
                    updateField(
                      fieldConfig.field,
                      fieldConfig.field === "contactNumber"
                        ? value.replace(/[^0-9]/g, "").slice(0, 11)
                        : value
                    )
                  }
                  style={[
                    styles.input,
                    fieldEditable ? styles.inputEditable : styles.inputLocked,
                  ]}
                  contentStyle={styles.inputContent}
                  outlineStyle={[
                    styles.inputOutline,
                    fieldEditable
                      ? styles.inputOutlineEditable
                      : styles.inputOutlineLocked,
                  ]}
                  theme={{
                    colors: {
                      primary: agriPalette.field,
                      outline: fieldEditable
                        ? agriPalette.field
                        : "#D9D7CB",
                      onSurfaceVariant: agriPalette.inkSoft,
                      background: fieldEditable
                        ? agriPalette.white
                        : "#F6F1E7",
                    },
                  }}
                  editable={fieldEditable}
                  keyboardType={fieldConfig.keyboardType}
                  autoCapitalize={fieldConfig.autoCapitalize}
                  secureTextEntry={fieldConfig.secureTextEntry}
                  placeholder={
                    isPasswordField && !fieldEditable
                      ? "Tap Edit profile to change password"
                      : undefined
                  }
                  textColor={agriPalette.ink}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.actionStack}>
          <AgriButton
            title={hasUnsavedChanges ? "Save changes" : "No changes"}
            icon="content-save-outline"
            variant="primary"
            loading={saving}
            disabled={loading || saving || !hasUnsavedChanges}
            onPress={handleSave}
          />
          {hasUnsavedChanges ? (
            <AgriButton
              title="Discard changes"
              icon="restore"
              variant="muted"
              lightText={false}
              onPress={handleDiscardChanges}
            />
          ) : null}
          <AgriButton
            title="Dashboard"
            icon="arrow-left"
            variant="secondary"
            onPress={() => router.replace(settingsMeta.dashboardRoute)}
          />
          <AgriButton
            title="Log out"
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
  settingsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  settingsHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F1E0",
    borderWidth: 1,
    borderColor: "#C5DDBF",
  },
  settingsHeaderCopy: {
    flex: 1,
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
  fieldHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  profilePhotoLabel: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  fieldEditButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fieldEditButtonLocked: {
    backgroundColor: "#FFF8ED",
    borderColor: "#E5D7BB",
  },
  fieldEditButtonActive: {
    backgroundColor: "#E3F1E0",
    borderColor: "#BED6BB",
  },
  fieldEditButtonText: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  fieldEditButtonTextLocked: {
    color: agriPalette.inkSoft,
  },
  fieldEditButtonTextActive: {
    color: agriPalette.fieldDeep,
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
  inputCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  inputCardLocked: {
    backgroundColor: "#FAF6EE",
    borderColor: "#E6DCC8",
  },
  inputCardEditable: {
    backgroundColor: "#F7FCF5",
    borderColor: "#D0E3D1",
  },
  inputCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  inputCardTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: 10,
  },
  inputCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  inputCardIconLocked: {
    backgroundColor: "#F0E6D4",
  },
  inputCardIconEditable: {
    backgroundColor: "#E1F1DE",
  },
  inputCardCopy: {
    flex: 1,
  },
  inputCardLabel: {
    color: agriPalette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  inputCardHint: {
    marginTop: 4,
    color: agriPalette.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: "transparent",
  },
  inputLocked: {
    backgroundColor: "#F6F1E7",
  },
  inputEditable: {
    backgroundColor: agriPalette.white,
  },
  inputContent: {
    fontSize: 15,
    fontWeight: "700",
  },
  inputOutline: {
    borderRadius: 18,
  },
  inputOutlineLocked: {
    borderWidth: 1.2,
  },
  inputOutlineEditable: {
    borderWidth: 1.5,
  },
  actionStack: {
    gap: 12,
    marginTop: 18,
  },
});
