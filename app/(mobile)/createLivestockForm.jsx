import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import QRCode from "react-native-qrcode-svg";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import { agriPalette } from "../../constants/agriTheme";

const BARANGAYS = [
  "Aldezar",
  "Alteza",
  "Anib",
  "Awayan",
  "Azucena",
  "Bagong Sirang",
  "Binahian",
  "Bolo Norte",
  "Bolo Sur",
  "Bulan",
  "Bulawan",
  "Cabuyao",
  "Caima",
  "Calagbangan",
  "Calampinay",
  "Carayrayan",
  "Cotmo",
  "Gabi",
  "Gaongan",
  "Impig",
  "Lipilip",
  "Lubigan Jr.",
  "Lubigan Sr.",
  "Malaguico",
  "Malubago",
  "Manangle",
  "Mangapo",
  "Mangga",
  "Manlubang",
  "Mantila",
  "North Centro",
  "North Villazar",
  "Sagrada Familia",
  "Salanda",
  "Salvacion",
  "San Isidro",
  "San Vicente",
  "Serranzana",
  "South Centro",
  "South Villazar",
  "Taisan",
  "Tara",
  "Tible",
  "Tula-tula",
  "Vigaan",
  "Yabo",
];

const createInitialFormData = (inspectorIssued = "") => ({
  animal_species: "",
  animal_unique_identifier: "",
  live_weight: "",
  purpose: "Slaughter",
  inspection_time_start: "",
  inspection_time_end: "",
  owner_name: "",
  owner_barangay: "",
  owner_city: "Sipocot",
  owner_province: "Camarines Sur",
  animal_origin_barangay: "",
  animal_origin_city: "Sipocot",
  animal_origin_province: "Camarines Sur",
  animal_destination: "Sipocot Abattoir Impig Sipocot - Camarines Sur",
  vehicle_used: "",
  paid_number: "",
  inspector_issued: inspectorIssued,
  remarks: "",
});

const getDefaultExpiry = () =>
  new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

export default function AddLivestockForm() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isTablet = width >= 700;

  const [formData, setFormData] = useState(createInitialFormData());
  const [accountId, setAccountId] = useState(null);
  const [formId, setFormId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [qrExpiry, setQrExpiry] = useState("");
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [currentTimeKey, setCurrentTimeKey] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [urgent, setUrgent] = useState(false);
  const [showNewFormButton, setShowNewFormButton] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [dssClicked, setDssClicked] = useState(false);

  useEffect(() => {
    const loadAccountInfo = async () => {
      try {
        const [storedId, firstName, lastName] = await Promise.all([
          AsyncStorage.getItem("account_id"),
          AsyncStorage.getItem("first_name"),
          AsyncStorage.getItem("last_name"),
        ]);

        const inspectorIssued =
          firstName && lastName ? `${firstName} ${lastName}` : "";

        if (storedId) setAccountId(parseInt(storedId, 10));
        setFormData(createInitialFormData(inspectorIssued));
      } catch (err) {
        console.error("Error loading account info:", err);
      } finally {
        setLoadingAccount(false);
      }
    };

    loadAccountInfo();
  }, []);

  const handleChange = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const openTimePicker = (key) => {
    setCurrentTimeKey(key);
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (date) => {
    if (!currentTimeKey) return;

    const timeString = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setFormData((prev) => ({ ...prev, [currentTimeKey]: timeString }));
    setTimePickerVisible(false);
    setCurrentTimeKey("");
  };

  const validateForm = () => {
    for (const key in formData) {
      if (!formData[key] || formData[key].trim() === "") {
        Alert.alert(
          "Error",
          `Please fill the field: ${key.replace(/_/g, " ")}`
        );
        return false;
      }
    }

    if (!accountId) {
      Alert.alert("Error", "Account ID not retrieved.");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const payload = {
        account_id: accountId,
        inspector: formData.inspector_issued,
        inspection_time_start: formData.inspection_time_start,
        inspection_time_end: formData.inspection_time_end,
        animals: [
          {
            animal_species: formData.animal_species,
            animal_unique_identifier: formData.animal_unique_identifier,
            live_weight: formData.live_weight,
            purpose: formData.purpose,
            owner_name: formData.owner_name,
            owner_address: `${formData.owner_barangay}, ${formData.owner_city}, ${formData.owner_province}`,
            animal_origin: `${formData.animal_origin_barangay}, ${formData.animal_origin_city}, ${formData.animal_origin_province}`,
            animal_destination: formData.animal_destination,
            vehicle_used: formData.vehicle_used,
            paid_number: formData.paid_number,
            inspector_issued: formData.inspector_issued,
            remarks: formData.remarks,
          },
        ],
      };

      const token = await AsyncStorage.getItem("token");
      const response = await fetch(
        "https://e-livestock.tulongkabataanbicol.com/eLiveStockAPI/API/create_form.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify(payload),
        }
      );

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (_err) {
        throw new Error("Invalid JSON response from API.");
      }

      if (data.status === "success") {
        setQrValue(data.qr_code || "");
        setQrExpiry(data.qr_expiration || getDefaultExpiry());
        setFormId(data.form_id);
        setSubmitted(true);
        Alert.alert("Success", "Form submitted successfully.");
      } else {
        Alert.alert("Submission Failed", data.message || "Unknown error.");
      }
    } catch (err) {
      console.error("Submit error:", err);
      Alert.alert("Error", err.message || "Something went wrong.");
    }
  };

  const checkDSS = async () => {
    if (!formData.remarks || !formId) {
      Alert.alert(
        "Error",
        "Please submit the form first and provide remarks."
      );
      return;
    }

    try {
      const response = await fetch(
        "https://e-livestock.tulongkabataanbicol.com/eLiveStockAPI/API/check_suggestion.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: formData.remarks, form_id: formId }),
        }
      );

      const data = await response.json();
      if (data.status === "success") {
        setSuggestions(data.matches || []);
        setUrgent(
          data.severity_label === "Severe" || data.severity_score >= 0.6
        );
        setShowNewFormButton(true);
        setDssClicked(true);
        Alert.alert("DSS Checked", "DSS suggestions retrieved.");
      } else {
        Alert.alert("Error", data.message || "No suggestions found.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to check DSS suggestions.");
    }
  };

  const handleUrgentSchedule = async () => {
    try {
      await AsyncStorage.multiSet([
        ["selected_form_id", String(formId)],
        ["selected_form_owner", formData.owner_name],
        ["selected_form_eartag", formData.animal_unique_identifier],
        [
          "selected_form_address",
          `${formData.owner_barangay}, ${formData.owner_city}, ${formData.owner_province}`,
        ],
        ["selected_form_expiration", qrExpiry || getDefaultExpiry()],
      ]);
      router.push("/appointment");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to open urgent scheduling.");
    }
  };

  const resetForm = () => {
    setFormData((prev) => createInitialFormData(prev.inspector_issued));
    setFormId(null);
    setSuggestions([]);
    setQrValue("");
    setQrExpiry("");
    setUrgent(false);
    setShowNewFormButton(false);
    setSubmitted(false);
    setDssClicked(false);
  };

  const isEditable = !submitted;
  const statusText = submitted
    ? urgent
      ? "Urgent case flagged"
      : dssClicked
      ? "DSS reviewed"
      : "Submitted"
    : "Draft form";

  if (loadingAccount) {
    return (
      <DashboardShell
        eyebrow="Field form creation"
        title="Create livestock form"
        subtitle="Preparing the inspection form workspace."
        summary="Loading account information for the issuing inspector."
      >
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={agriPalette.field} />
          <Text style={styles.loadingTitle}>Loading account information...</Text>
        </View>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow="Field form creation"
      title="Create livestock form"
      subtitle="Capture livestock details, origin, and movement information in a cleaner mobile-first layout."
      summary={`${statusText}. ${submitted ? "You can review DSS guidance or continue to scheduling." : "Complete the sections below to submit a new record."}`}
    >
      <View style={[styles.metricRow, isTablet && styles.metricRowWide]}>
        <MetricCard icon="clipboard-text-outline" label="Form status" value={statusText} />
        <MetricCard
          icon="account-tie-outline"
          label="Inspector issued"
          value={formData.inspector_issued || "Awaiting inspector"}
        />
        <MetricCard
          icon="map-marker-radius-outline"
          label="Destination"
          value="Sipocot Abattoir"
        />
      </View>

      <View style={[styles.grid, isWide && styles.gridWide]}>
        <View style={[styles.card, isWide && styles.half]}>
          <SectionHeader
            icon="cow"
            title="Livestock information"
            subtitle="Species, identification, and inspection timing."
          />

          <View style={[styles.formRow, isTablet && styles.formRowWide]}>
            <View style={styles.formCol}>
              <Text style={styles.label}>Animal species</Text>
              <View style={[styles.pickerWrap, !isEditable && styles.disabled]}>
                <Picker
                  selectedValue={formData.animal_species}
                  onValueChange={(value) => handleChange("animal_species", value)}
                  enabled={isEditable}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Species" value="" />
                  <Picker.Item label="Hog" value="Hog" />
                  <Picker.Item label="Bovine" value="Bovine" />
                  <Picker.Item label="Cattle" value="Cattle" />
                </Picker>
              </View>
            </View>

            <View style={styles.formCol}>
              <Text style={styles.label}>Unique identifier</Text>
              <TextInput
                style={styles.input}
                placeholder="Animal unique identifier"
                placeholderTextColor="#6F7C67"
                value={formData.animal_unique_identifier}
                editable={isEditable}
                onChangeText={(value) =>
                  handleChange("animal_unique_identifier", value)
                }
              />
            </View>
          </View>

          <View style={[styles.formRow, isTablet && styles.formRowWide]}>
            <View style={styles.formCol}>
              <Text style={styles.label}>Live weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="Live weight"
                placeholderTextColor="#6F7C67"
                keyboardType="numeric"
                value={formData.live_weight}
                editable={isEditable}
                onChangeText={(value) => handleChange("live_weight", value)}
              />
            </View>

            <View style={styles.formCol}>
              <Text style={styles.label}>Purpose</Text>
              <TextInput
                style={styles.input}
                placeholder="Purpose"
                placeholderTextColor="#6F7C67"
                value={formData.purpose}
                editable={isEditable}
                onChangeText={(value) => handleChange("purpose", value)}
              />
            </View>
          </View>

          <View style={[styles.formRow, isTablet && styles.formRowWide]}>
            <View style={styles.formCol}>
              <Text style={styles.label}>Inspection start time</Text>
              <TouchableOpacity
                style={[styles.timeField, !isEditable && styles.disabled]}
                onPress={isEditable ? () => openTimePicker("inspection_time_start") : undefined}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={18}
                  color={agriPalette.field}
                />
                <Text style={styles.timeText}>
                  {formData.inspection_time_start || "Select time"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCol}>
              <Text style={styles.label}>Inspection end time</Text>
              <TouchableOpacity
                style={[styles.timeField, !isEditable && styles.disabled]}
                onPress={isEditable ? () => openTimePicker("inspection_time_end") : undefined}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={18}
                  color={agriPalette.field}
                />
                <Text style={styles.timeText}>
                  {formData.inspection_time_end || "Select time"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.card, isWide && styles.half]}>
          <SectionHeader
            icon="home-city-outline"
            title="Owner and origin"
            subtitle="Owner identity and barangay information."
          />

          <Text style={styles.label}>Owner name</Text>
          <TextInput
            style={styles.input}
            placeholder="Owner name"
            placeholderTextColor="#6F7C67"
            value={formData.owner_name}
            editable={isEditable}
            onChangeText={(value) => handleChange("owner_name", value)}
          />

          <View style={[styles.formRow, isTablet && styles.formRowWide]}>
            <View style={styles.formCol}>
              <Text style={styles.label}>Owner barangay</Text>
              <View style={[styles.pickerWrap, !isEditable && styles.disabled]}>
                <Picker
                  selectedValue={formData.owner_barangay}
                  onValueChange={(value) => handleChange("owner_barangay", value)}
                  enabled={isEditable}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Barangay" value="" />
                  {BARANGAYS.map((barangay) => (
                    <Picker.Item
                      key={barangay}
                      label={barangay}
                      value={barangay}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.formCol}>
              <Text style={styles.label}>Animal origin barangay</Text>
              <View style={[styles.pickerWrap, !isEditable && styles.disabled]}>
                <Picker
                  selectedValue={formData.animal_origin_barangay}
                  onValueChange={(value) =>
                    handleChange("animal_origin_barangay", value)
                  }
                  enabled={isEditable}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Barangay" value="" />
                  {BARANGAYS.map((barangay) => (
                    <Picker.Item
                      key={barangay}
                      label={barangay}
                      value={barangay}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, isWide && styles.full]}>
          <SectionHeader
            icon="truck-delivery-outline"
            title="Vehicle, payment, and remarks"
            subtitle="Transport details, issuing inspector, and clinical notes."
          />

          <View style={[styles.formRow, isTablet && styles.formRowWide]}>
            <View style={styles.formCol}>
              <Text style={styles.label}>Vehicle used</Text>
              <View style={[styles.pickerWrap, !isEditable && styles.disabled]}>
                <Picker
                  selectedValue={formData.vehicle_used}
                  onValueChange={(value) => handleChange("vehicle_used", value)}
                  enabled={isEditable}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Vehicle" value="" />
                  <Picker.Item label="Jeep" value="Jeep" />
                  <Picker.Item label="Hauler" value="Hauler" />
                </Picker>
              </View>
            </View>

            <View style={styles.formCol}>
              <Text style={styles.label}>Paid number</Text>
              <TextInput
                style={styles.input}
                placeholder="Paid number"
                placeholderTextColor="#6F7C67"
                value={formData.paid_number}
                editable={isEditable}
                onChangeText={(value) => handleChange("paid_number", value)}
              />
            </View>
          </View>

          <Text style={styles.label}>Inspector issued</Text>
          <TextInput
            style={[styles.input, styles.disabled]}
            placeholder="Inspector issued"
            placeholderTextColor="#6F7C67"
            value={formData.inspector_issued}
            editable={false}
          />

          <Text style={styles.label}>Remarks</Text>
          <TextInput
            style={[styles.input, styles.remarks]}
            placeholder="Describe animal condition, symptoms, or field notes"
            placeholderTextColor="#6F7C67"
            multiline
            value={formData.remarks}
            editable={isEditable}
            onChangeText={(value) => handleChange("remarks", value)}
          />
        </View>
      </View>

      <View style={styles.actionCard}>
        <Text style={styles.cardEyebrow}>Next actions</Text>
        <Text style={styles.cardTitle}>Submit, assess, and continue</Text>
        <View style={styles.actionStack}>
          {!submitted ? (
            <AgriButton
              title="Submit form"
              subtitle="Create the livestock record and generate the QR permit"
              icon="file-check-outline"
              onPress={handleSubmit}
            />
          ) : null}

          {submitted && !dssClicked ? (
            <AgriButton
              title="Check DSS"
              subtitle="Review symptom suggestions and severity guidance"
              icon="stethoscope"
              variant="secondary"
              onPress={checkDSS}
            />
          ) : null}

          {urgent ? (
            <AgriButton
              title="Urgent schedule"
              subtitle="Open the appointment screen with this form preloaded"
              icon="alarm-light-outline"
              variant="danger"
              onPress={handleUrgentSchedule}
            />
          ) : null}

          {showNewFormButton ? (
            <AgriButton
              title="Create new form"
              subtitle="Reset this workspace for another livestock record"
              icon="note-plus-outline"
              variant="sky"
              onPress={resetForm}
            />
          ) : null}
        </View>
      </View>

      {dssClicked ? (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>DSS result</Text>
          <Text style={styles.cardTitle}>Clinical suggestion panel</Text>
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <View key={`${suggestion.keyword}-${index}`} style={styles.suggestionCard}>
                <Text style={styles.suggestionTitle}>Keyword: {suggestion.keyword}</Text>
                <Text style={styles.suggestionStrength}>
                  Match strength: {(suggestion.match_strength * 100).toFixed(1)}%
                </Text>
                <Text style={styles.suggestionText}>{suggestion.suggestion}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No matching symptoms were found for the provided remarks.
            </Text>
          )}
        </View>
      ) : null}

      {qrValue ? (
        <View style={[styles.card, styles.qrCard]}>
          <Text style={styles.cardEyebrow}>Generated QR</Text>
          <Text style={styles.cardTitle}>Permit token ready for use</Text>
          <Text style={styles.qrCopy}>
            Keep this code available for verification and scheduling. It is
            valid until {new Date(qrExpiry).toLocaleString()}.
          </Text>
          <View style={styles.qrSurface}>
            <QRCode
              value={String(qrValue)}
              size={width >= 600 ? 180 : 148}
              color={agriPalette.fieldDeep}
              backgroundColor="#fff"
            />
          </View>
        </View>
      ) : null}

      <DateTimePickerModal
        isVisible={timePickerVisible}
        mode="time"
        onConfirm={handleTimeConfirm}
        onCancel={() => setTimePickerVisible(false)}
      />
    </DashboardShell>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialCommunityIcons name={icon} size={22} color={agriPalette.fieldDeep} />
      </View>
      <View style={styles.sectionText}>
        <Text style={styles.cardEyebrow}>Form section</Text>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <View style={styles.metricCard}>
      <MaterialCommunityIcons name={icon} size={20} color={agriPalette.fieldDeep} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 28,
    alignItems: "center",
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "900",
    color: agriPalette.ink,
  },
  metricRow: {
    gap: 12,
    marginBottom: 18,
  },
  metricRowWide: {
    flexDirection: "row",
  },
  metricCard: {
    flex: 1,
    minWidth: 170,
    backgroundColor: agriPalette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 16,
  },
  metricLabel: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "800",
    color: agriPalette.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metricValue: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  grid: {
    gap: 16,
  },
  gridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  half: {
    width: "48.9%",
  },
  full: {
    width: "100%",
  },
  card: {
    backgroundColor: agriPalette.surface,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1E7CF",
    marginRight: 12,
  },
  sectionText: {
    flex: 1,
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
    fontSize: 24,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  formRow: {
    gap: 12,
  },
  formRowWide: {
    flexDirection: "row",
  },
  formCol: {
    flex: 1,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: agriPalette.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FCFAF4",
    color: agriPalette.ink,
    fontSize: 15,
  },
  remarks: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: agriPalette.border,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FCFAF4",
  },
  picker: {
    height: 52,
    width: "100%",
  },
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: agriPalette.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: "#FCFAF4",
  },
  timeText: {
    marginLeft: 10,
    color: agriPalette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.72,
  },
  actionCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 22,
    marginTop: 18,
  },
  actionStack: {
    gap: 12,
    marginTop: 14,
  },
  suggestionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: "#FCF7EB",
    padding: 16,
    marginTop: 14,
  },
  suggestionTitle: {
    color: agriPalette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  suggestionStrength: {
    marginTop: 6,
    color: agriPalette.field,
    fontSize: 13,
    fontWeight: "700",
  },
  suggestionText: {
    marginTop: 10,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyText: {
    marginTop: 14,
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  qrCard: {
    alignItems: "center",
    marginTop: 18,
  },
  qrCopy: {
    marginTop: 10,
    textAlign: "center",
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  qrSurface: {
    marginTop: 20,
    padding: 18,
    borderRadius: 28,
    backgroundColor: agriPalette.white,
  },
});
