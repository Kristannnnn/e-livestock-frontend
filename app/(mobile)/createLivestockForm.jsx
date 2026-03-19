import AsyncStorage from "@react-native-async-storage/async-storage";
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
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const DEFAULT_CITY = "Sipocot";
const DEFAULT_PROVINCE = "Camarines Sur";
const DEFAULT_DESTINATION = "Sipocot Abattoir Impig Sipocot - Camarines Sur";
const DEFAULT_PURPOSE = "Slaughter";
const OWNER_SEARCH_URL = apiUrl(apiRoutes.profile.searchOwners);

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

const createBatchData = (inspector = "") => ({
  inspection_time_start: "",
  inspection_time_end: "",
  owner_name: "",
  owner_barangay: "",
  owner_city: DEFAULT_CITY,
  owner_province: DEFAULT_PROVINCE,
  animal_origin_barangay: "",
  animal_origin_city: DEFAULT_CITY,
  animal_origin_province: DEFAULT_PROVINCE,
  animal_destination: DEFAULT_DESTINATION,
  vehicle_used: "",
  paid_number: "",
  inspector_issued: inspector,
});

const createAnimalDraft = () => ({
  animal_species: "",
  animal_unique_identifier: "",
  live_weight: "",
  purpose: DEFAULT_PURPOSE,
  remarks: "",
});

const getDefaultExpiry = () =>
  new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

function normalizeValue(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseAddress(address) {
  const [barangay = "", city = DEFAULT_CITY, province = DEFAULT_PROVINCE] =
    String(address || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

  return { barangay, city, province };
}

function formatAddress(barangay, city, province) {
  return [barangay, city, province].filter(Boolean).join(", ");
}

function hasDraftValues(animalDraft) {
  return (
    normalizeValue(animalDraft.animal_species) ||
    normalizeValue(animalDraft.animal_unique_identifier) ||
    normalizeValue(animalDraft.live_weight) ||
    normalizeValue(animalDraft.remarks) ||
    normalizeValue(animalDraft.purpose) !== normalizeValue(DEFAULT_PURPOSE)
  );
}

function isHighSeverityResult(result) {
  const severityLabel = String(result?.severity_label || "").trim().toLowerCase();
  const severityRating = Number(result?.severity_rating);

  return severityLabel === "severe" || severityRating >= 5;
}

export default function AddLivestockForm() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;

  const [batchData, setBatchData] = useState(createBatchData());
  const [animalDraft, setAnimalDraft] = useState(createAnimalDraft());
  const [queuedAnimals, setQueuedAnimals] = useState([]);
  const [savedAnimals, setSavedAnimals] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [qrExpiry, setQrExpiry] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timeKey, setTimeKey] = useState("");
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerMatches, setOwnerMatches] = useState([]);
  const [ownerLookupLoading, setOwnerLookupLoading] = useState(false);
  const [activeDssId, setActiveDssId] = useState(null);

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const [storedId, firstName, lastName] = await Promise.all([
          AsyncStorage.getItem("account_id"),
          AsyncStorage.getItem("first_name"),
          AsyncStorage.getItem("last_name"),
        ]);

        const inspector =
          firstName && lastName ? `${firstName} ${lastName}` : "";

        if (storedId) {
          setAccountId(parseInt(storedId, 10));
        }

        setBatchData(createBatchData(inspector));
      } catch (error) {
        console.error("Load account error:", error);
      } finally {
        setLoadingAccount(false);
      }
    };

    loadAccount();
  }, []);

  useEffect(() => {
    if (submitted) {
      setOwnerMatches([]);
      setOwnerLookupLoading(false);
      return undefined;
    }

    const query = normalizeValue(batchData.owner_name);
    const selectedName = normalizeValue(selectedOwner?.full_name);

    if (query.length < 2 || (selectedOwner && query === selectedName)) {
      setOwnerMatches([]);
      setOwnerLookupLoading(false);
      return undefined;
    }

    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        setOwnerLookupLoading(true);
        const response = await fetch(OWNER_SEARCH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: batchData.owner_name }),
        });

        const data = await parseJsonResponse(
          response,
          "Unable to search registered owners."
        );

        if (active && data.status === "success") {
          setOwnerMatches(Array.isArray(data.users) ? data.users : []);
        } else if (active) {
          setOwnerMatches([]);
        }
      } catch (error) {
        if (active) {
          console.error("Owner search error:", error);
          setOwnerMatches([]);
        }
      } finally {
        if (active) {
          setOwnerLookupLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [batchData.owner_name, selectedOwner, submitted]);

  const ownerAddress = formatAddress(
    batchData.owner_barangay,
    batchData.owner_city,
    batchData.owner_province
  );
  const originAddress = formatAddress(
    batchData.animal_origin_barangay,
    batchData.animal_origin_city,
    batchData.animal_origin_province
  );
  const reviewedCount = savedAnimals.filter((animal) => animal.dssChecked).length;
  const urgentCount = savedAnimals.filter((animal) => animal.urgent).length;

  const updateBatchData = (key, value) =>
    setBatchData((prev) => ({ ...prev, [key]: value }));

  const updateAnimalDraft = (key, value) =>
    setAnimalDraft((prev) => ({ ...prev, [key]: value }));

  const onOwnerChange = (value) => {
    updateBatchData("owner_name", value);

    if (
      selectedOwner &&
      normalizeValue(selectedOwner.full_name) !== normalizeValue(value)
    ) {
      setSelectedOwner(null);
    }
  };

  const onOwnerSelect = (owner) => {
    const parsed = parseAddress(owner.address);
    setSelectedOwner(owner);
    setOwnerMatches([]);
    setBatchData((prev) => ({
      ...prev,
      owner_name: owner.full_name || prev.owner_name,
      owner_barangay: parsed.barangay || prev.owner_barangay,
      owner_city: parsed.city || prev.owner_city,
      owner_province: parsed.province || prev.owner_province,
    }));
  };

  const resetAnimalDraft = () => {
    setAnimalDraft(createAnimalDraft());
    setEditingId(null);
  };

  const validateAnimalDraft = () => {
    const required = [
      ["animal_species", "Animal species"],
      ["animal_unique_identifier", "Unique identifier"],
      ["live_weight", "Live weight"],
      ["purpose", "Purpose"],
      ["remarks", "Remarks"],
    ];

    for (const [key, label] of required) {
      if (!String(animalDraft[key] || "").trim()) {
        Alert.alert("Error", `Please fill the field: ${label}`);
        return false;
      }
    }

    const duplicate = queuedAnimals.find(
      (animal) =>
        animal.id !== editingId &&
        normalizeValue(animal.animal_unique_identifier) ===
          normalizeValue(animalDraft.animal_unique_identifier)
    );

    if (duplicate) {
      Alert.alert(
        "Duplicate identifier",
        "This animal identifier is already queued in the batch."
      );
      return false;
    }

    return true;
  };

  const queueAnimal = () => {
    if (!validateAnimalDraft()) {
      return;
    }

    const nextAnimal = {
      id: editingId || `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      ...animalDraft,
      animal_species: animalDraft.animal_species.trim(),
      animal_unique_identifier: animalDraft.animal_unique_identifier.trim(),
      live_weight: animalDraft.live_weight.trim(),
      purpose: animalDraft.purpose.trim(),
      remarks: animalDraft.remarks.trim(),
    };

    setQueuedAnimals((prev) =>
      editingId
        ? prev.map((animal) => (animal.id === editingId ? nextAnimal : animal))
        : [...prev, nextAnimal]
    );
    resetAnimalDraft();
  };

  const editQueuedAnimal = (animal) => {
    setEditingId(animal.id);
    setAnimalDraft({
      animal_species: animal.animal_species,
      animal_unique_identifier: animal.animal_unique_identifier,
      live_weight: animal.live_weight,
      purpose: animal.purpose,
      remarks: animal.remarks,
    });
  };

  const removeQueuedAnimal = (animalId) => {
    setQueuedAnimals((prev) => prev.filter((animal) => animal.id !== animalId));

    if (editingId === animalId) {
      resetAnimalDraft();
    }
  };

  const validateBatch = () => {
    const required = [
      ["inspection_time_start", "Inspection start time"],
      ["inspection_time_end", "Inspection end time"],
      ["owner_name", "Owner name"],
      ["owner_barangay", "Owner barangay"],
      ["animal_origin_barangay", "Animal origin barangay"],
      ["animal_destination", "Animal destination"],
      ["vehicle_used", "Vehicle used"],
      ["paid_number", "Paid number"],
    ];

    for (const [key, label] of required) {
      if (!String(batchData[key] || "").trim()) {
        Alert.alert("Error", `Please fill the field: ${label}`);
        return false;
      }
    }

    if (!accountId) {
      Alert.alert("Error", "Account ID not retrieved.");
      return false;
    }

    if (queuedAnimals.length === 0) {
      Alert.alert("No animals queued", "Add at least one animal first.");
      return false;
    }

    if (hasDraftValues(animalDraft)) {
      Alert.alert(
        "Unsaved animal entry",
        "Add or clear the current animal draft before submitting."
      );
      return false;
    }

    return true;
  };

  const submitBatch = async () => {
    if (!validateBatch()) {
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(apiUrl(apiRoutes.inspector.createForm), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          account_id: accountId,
          inspector: batchData.inspector_issued,
          inspection_time_start: batchData.inspection_time_start,
          inspection_time_end: batchData.inspection_time_end,
          animals: queuedAnimals.map((animal) => ({
            animal_species: animal.animal_species,
            animal_unique_identifier: animal.animal_unique_identifier,
            live_weight: animal.live_weight,
            purpose: animal.purpose,
            owner_name: batchData.owner_name,
            owner_account_id: selectedOwner?.account_id ?? null,
            owner_address: ownerAddress,
            animal_origin: originAddress,
            animal_destination: batchData.animal_destination,
            vehicle_used: batchData.vehicle_used,
            paid_number: batchData.paid_number,
            inspector_issued: batchData.inspector_issued,
            remarks: animal.remarks,
          })),
        }),
      });

      const data = await parseJsonResponse(
        response,
        "Invalid JSON response from API."
      );

      if (data.status !== "success") {
        Alert.alert("Submission Failed", data.message || "Unknown error.");
        return;
      }

      const forms = Array.isArray(data.forms) ? data.forms : [];
      setSavedAnimals(
        forms.map((animal) => ({
          ...animal,
          dssChecked: false,
          dssMatches: [],
          severityLabel: "",
          severityScore: null,
          severityRating: null,
          urgent: false,
        }))
      );
      setBatchId(data.batch_id || "");
      setQrExpiry(data.qr_expiration || getDefaultExpiry());
      setSubmitted(true);
      resetAnimalDraft();

      Alert.alert(
        "Success",
        `Batch submitted successfully for ${forms.length} animal${
          forms.length === 1 ? "" : "s"
        }.`
      );
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert("Error", error.message || "Something went wrong.");
    }
  };

  const checkDss = async (animal) => {
    if (!animal.form_id) {
      Alert.alert("Error", "This animal does not have a saved form ID yet.");
      return;
    }

    try {
      setActiveDssId(animal.form_id);
      const response = await fetch(apiUrl(apiRoutes.inspector.suggestions), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remarks: animal.remarks,
          form_id: animal.form_id,
        }),
      });

      const data = await parseJsonResponse(
        response,
        "Invalid DSS response from API."
      );

      if (data.status === "success") {
        const isHighSeverity = isHighSeverityResult(data);

        setSavedAnimals((prev) =>
          prev.map((item) =>
            item.form_id !== animal.form_id
              ? item
              : {
                  ...item,
                  dssChecked: true,
                  dssMatches: Array.isArray(data.matches) ? data.matches : [],
                  severityLabel: data.severity_label || "",
                  severityScore:
                    data.severity_score !== undefined
                      ? Number(data.severity_score)
                      : null,
                  severityRating:
                    data.severity_rating !== undefined
                      ? Number(data.severity_rating)
                      : null,
                  urgent: isHighSeverity,
                }
          )
        );

        if (isHighSeverity) {
          Alert.alert(
            "High severity detected",
            "This animal was marked as high severity. Do you want to open urgent scheduling now?",
            [
              { text: "Later", style: "cancel" },
              { text: "Open urgent schedule", onPress: () => openUrgentSchedule(animal) },
            ]
          );
        } else {
          Alert.alert("DSS Checked", "Suggestions updated for this animal.");
        }
      } else if (data.message === "No matches found") {
        setSavedAnimals((prev) =>
          prev.map((item) =>
            item.form_id !== animal.form_id
              ? item
              : {
                  ...item,
                  dssChecked: true,
                  dssMatches: [],
                  severityLabel: "",
                  severityScore: null,
                  severityRating: null,
                  urgent: false,
                }
          )
        );
        Alert.alert("No DSS match", "No suggestion matched this animal.");
      } else {
        Alert.alert("Error", data.message || "Failed to check DSS.");
      }
    } catch (error) {
      console.error("DSS error:", error);
      Alert.alert("Error", error.message || "Failed to check DSS.");
    } finally {
      setActiveDssId(null);
    }
  };

  const openUrgentSchedule = async (animal) => {
    try {
      await AsyncStorage.multiSet([
        ["selected_form_id", String(animal.form_id)],
        ["selected_form_owner", animal.owner_name || batchData.owner_name],
        ["selected_form_eartag", animal.animal_unique_identifier || ""],
        ["selected_form_address", animal.owner_address || ownerAddress],
        [
          "selected_form_expiration",
          animal.qr_expiration || qrExpiry || getDefaultExpiry(),
        ],
      ]);

      router.push("/appointment");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to open urgent scheduling.");
    }
  };

  const resetAll = () => {
    const inspector = batchData.inspector_issued;
    setBatchData(createBatchData(inspector));
    setAnimalDraft(createAnimalDraft());
    setQueuedAnimals([]);
    setSavedAnimals([]);
    setEditingId(null);
    setSubmitted(false);
    setBatchId("");
    setQrExpiry("");
    setSelectedOwner(null);
    setOwnerMatches([]);
    setOwnerLookupLoading(false);
    setActiveDssId(null);
  };

  if (loadingAccount) {
    return (
      <DashboardShell
        eyebrow="Field form creation"
        title="Create livestock form"
        subtitle="Preparing the inspection workspace."
        summary="Loading account information for the issuing inspector."
      >
        <View style={styles.card}>
          <ActivityIndicator size="large" color={agriPalette.field} />
        </View>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow="Field form creation"
      title="Create livestock form"
      subtitle="Submit one batch of animals while keeping DSS and scheduling linked to each animal."
      summary={
        submitted
          ? `${savedAnimals.length} animals submitted${batchId ? ` under ${batchId}` : ""}. ${reviewedCount} reviewed by DSS and ${urgentCount} marked urgent.`
          : `${queuedAnimals.length} animals queued. Shared owner, origin, transport, and inspection details will apply to every animal in this batch.`
      }
    >
      <View style={styles.card}>
        <Text style={styles.heading}>Batch Details</Text>
        <TextInput
          style={styles.input}
          placeholder="Owner name"
          value={batchData.owner_name}
          editable={!submitted}
          onChangeText={onOwnerChange}
        />
        {ownerLookupLoading ? <Text style={styles.helper}>Searching owners...</Text> : null}
        {!submitted && ownerMatches.length > 0 ? (
          <View style={styles.listGap}>
            {ownerMatches.map((owner) => (
              <TouchableOpacity
                key={owner.account_id}
                style={styles.rowCard}
                onPress={() => onOwnerSelect(owner)}
              >
                <Text style={styles.rowTitle}>{owner.full_name}</Text>
                <Text style={styles.helper}>{owner.address || "No address"}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Owner barangay</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={batchData.owner_barangay}
                enabled={!submitted}
                onValueChange={(value) => updateBatchData("owner_barangay", value)}
              >
                <Picker.Item label="Select Barangay" value="" />
                {BARANGAYS.map((barangay) => (
                  <Picker.Item key={barangay} label={barangay} value={barangay} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Origin barangay</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={batchData.animal_origin_barangay}
                enabled={!submitted}
                onValueChange={(value) =>
                  updateBatchData("animal_origin_barangay", value)
                }
              >
                <Picker.Item label="Select Barangay" value="" />
                {BARANGAYS.map((barangay) => (
                  <Picker.Item key={barangay} label={barangay} value={barangay} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Inspection start</Text>
            <TouchableOpacity
              style={styles.input}
              disabled={submitted}
              onPress={() => {
                setTimeKey("inspection_time_start");
                setTimePickerVisible(true);
              }}
            >
              <Text>{batchData.inspection_time_start || "Select time"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Inspection end</Text>
            <TouchableOpacity
              style={styles.input}
              disabled={submitted}
              onPress={() => {
                setTimeKey("inspection_time_end");
                setTimePickerVisible(true);
              }}
            >
              <Text>{batchData.inspection_time_end || "Select time"}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Animal destination"
          value={batchData.animal_destination}
          editable={!submitted}
          onChangeText={(value) => updateBatchData("animal_destination", value)}
        />
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Vehicle used</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={batchData.vehicle_used}
                enabled={!submitted}
                onValueChange={(value) => updateBatchData("vehicle_used", value)}
              >
                <Picker.Item label="Select Vehicle" value="" />
                <Picker.Item label="Jeep" value="Jeep" />
                <Picker.Item label="Hauler" value="Hauler" />
              </Picker>
            </View>
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Paid number</Text>
            <TextInput
              style={styles.input}
              value={batchData.paid_number}
              editable={!submitted}
              onChangeText={(value) => updateBatchData("paid_number", value)}
            />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{editingId ? "Edit Animal" : "Add Animal"}</Text>
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Species</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={animalDraft.animal_species}
                enabled={!submitted}
                onValueChange={(value) => updateAnimalDraft("animal_species", value)}
              >
                <Picker.Item label="Select Species" value="" />
                <Picker.Item label="Hog" value="Hog" />
                <Picker.Item label="Bovine" value="Bovine" />
                <Picker.Item label="Cattle" value="Cattle" />
              </Picker>
            </View>
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Unique identifier</Text>
            <TextInput
              style={styles.input}
              value={animalDraft.animal_unique_identifier}
              editable={!submitted}
              onChangeText={(value) =>
                updateAnimalDraft("animal_unique_identifier", value)
              }
            />
          </View>
        </View>
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Live weight</Text>
            <TextInput
              style={styles.input}
              value={animalDraft.live_weight}
              editable={!submitted}
              keyboardType="numeric"
              onChangeText={(value) => updateAnimalDraft("live_weight", value)}
            />
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Purpose</Text>
            <TextInput
              style={styles.input}
              value={animalDraft.purpose}
              editable={!submitted}
              onChangeText={(value) => updateAnimalDraft("purpose", value)}
            />
          </View>
        </View>
        <Text style={styles.label}>Remarks</Text>
        <TextInput
          style={[styles.input, styles.remarks]}
          value={animalDraft.remarks}
          editable={!submitted}
          multiline
          onChangeText={(value) => updateAnimalDraft("remarks", value)}
        />
        {!submitted ? (
          <View style={styles.listGap}>
            <AgriButton
              title={editingId ? "Update queued animal" : "Add animal to batch"}
              subtitle="Keep DSS linked to this animal by saving its own remarks"
              icon="plus-circle-outline"
              compact
              onPress={queueAnimal}
            />
            {editingId ? (
              <TouchableOpacity onPress={resetAnimalDraft}>
                <Text style={styles.linkText}>Cancel edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>
          {submitted ? "Submitted Animals" : "Queued Animals"}
        </Text>
        {(submitted ? savedAnimals : queuedAnimals).length === 0 ? (
          <Text style={styles.helper}>No animals added yet.</Text>
        ) : (
          <View style={styles.listGap}>
            {(submitted ? savedAnimals : queuedAnimals).map((animal) => (
              <View key={animal.form_id || animal.id} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <View style={styles.flexItem}>
                    <Text style={styles.rowTitle}>
                      {animal.animal_species} • {animal.animal_unique_identifier}
                    </Text>
                    <Text style={styles.helper}>
                      {animal.live_weight} kg | {animal.purpose}
                      {animal.form_id ? ` | Form #${animal.form_id}` : ""}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chip,
                      animal.urgent && styles.chipDanger,
                    ]}
                  >
                    <Text style={styles.chipText}>
                      {animal.urgent
                        ? "Urgent"
                        : animal.dssChecked
                        ? animal.severityLabel || "Reviewed"
                        : submitted
                        ? "Awaiting DSS"
                        : "Queued"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.helper}>{animal.remarks}</Text>
                {!submitted ? (
                  <View style={styles.inlineActions}>
                    <TouchableOpacity onPress={() => editQueuedAnimal(animal)}>
                      <Text style={styles.linkText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeQueuedAnimal(animal.id)}
                    >
                      <Text style={[styles.linkText, styles.linkDanger]}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.listGap}>
                    <AgriButton
                      title={animal.dssChecked ? "Check DSS again" : "Check DSS"}
                      subtitle="Save DSS findings for this specific animal"
                      icon="stethoscope"
                      variant="secondary"
                      compact
                      loading={activeDssId === animal.form_id}
                      onPress={() => checkDss(animal)}
                    />
                    {animal.urgent ? (
                      <AgriButton
                        title="Urgent schedule"
                        subtitle="Open appointment booking for this animal"
                        icon="alarm-light-outline"
                        variant="danger"
                        compact
                        onPress={() => openUrgentSchedule(animal)}
                      />
                    ) : null}
                    {animal.dssChecked && animal.dssMatches.length > 0 ? (
                      <View style={styles.listGap}>
                        {animal.dssMatches.map((match, index) => (
                          <View key={`${animal.form_id}-${index}`} style={styles.matchCard}>
                            <Text style={styles.rowTitle}>{match.keyword}</Text>
                            <Text style={styles.helper}>{match.suggestion}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.listGap}>
        {!submitted ? (
          <AgriButton
            title="Submit batch"
            subtitle={`Create ${queuedAnimals.length} livestock record${
              queuedAnimals.length === 1 ? "" : "s"
            } in one submission`}
            icon="file-check-outline"
            onPress={submitBatch}
            disabled={queuedAnimals.length === 0}
          />
        ) : (
          <AgriButton
            title="Start new batch"
            subtitle="Reset this workspace for another group of animals"
            icon="note-plus-outline"
            variant="sky"
            onPress={resetAll}
          />
        )}
        {!submitted ? (
          <AgriButton
            title="Reset draft"
            subtitle="Clear the current batch and animal entry"
            icon="refresh"
            variant="muted"
            lightText={false}
            onPress={resetAll}
            disabled={
              queuedAnimals.length === 0 &&
              !hasDraftValues(animalDraft) &&
              !normalizeValue(batchData.owner_name)
            }
          />
        ) : null}
      </View>

      <DateTimePickerModal
        isVisible={timePickerVisible}
        mode="time"
        onConfirm={(date) => {
          const timeString = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          updateBatchData(timeKey, timeString);
          setTimePickerVisible(false);
          setTimeKey("");
        }}
        onCancel={() => {
          setTimePickerVisible(false);
          setTimeKey("");
        }}
      />
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: agriPalette.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 18,
    marginBottom: 16,
  },
  heading: {
    color: agriPalette.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  label: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: agriPalette.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FCFAF4",
    marginBottom: 12,
  },
  remarks: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: agriPalette.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FCFAF4",
    marginBottom: 12,
  },
  row: {
    gap: 12,
  },
  rowWide: {
    flexDirection: "row",
  },
  flexItem: {
    flex: 1,
  },
  helper: {
    color: agriPalette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  listGap: {
    gap: 12,
  },
  rowCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: "#FCF9F1",
    padding: 14,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  rowTitle: {
    color: agriPalette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: "#F2E4BD",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipDanger: {
    backgroundColor: agriPalette.redClay,
  },
  chipText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 18,
    marginTop: 10,
  },
  linkText: {
    color: agriPalette.field,
    fontSize: 13,
    fontWeight: "800",
  },
  linkDanger: {
    color: agriPalette.redClay,
  },
  matchCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: "#FCF7EB",
    padding: 12,
  },
});
