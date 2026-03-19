import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
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

function removeErrorKey(errors, key) {
  if (!errors[key]) {
    return errors;
  }

  const nextErrors = { ...errors };
  delete nextErrors[key];
  return nextErrors;
}

function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}

function parseTimeValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`1970-01-01 ${value}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getHours() * 60 + parsed.getMinutes();
}

function validateAnimalFields(animalDraft, queuedAnimals, editingId) {
  const errors = {};
  const uniqueIdentifier = String(animalDraft.animal_unique_identifier || "").trim();
  const liveWeight = String(animalDraft.live_weight || "").trim();
  const remarks = String(animalDraft.remarks || "").trim();

  if (!String(animalDraft.animal_species || "").trim()) {
    errors.animal_species = "Select the animal species.";
  }

  if (!uniqueIdentifier) {
    errors.animal_unique_identifier = "Enter the animal identifier.";
  } else if (uniqueIdentifier.length < 3) {
    errors.animal_unique_identifier =
      "Identifier must be at least 3 characters long.";
  }

  if (!liveWeight) {
    errors.live_weight = "Enter the live weight.";
  } else if (!/^\d+(\.\d{1,2})?$/.test(liveWeight) || Number(liveWeight) <= 0) {
    errors.live_weight = "Enter a valid weight greater than 0.";
  }

  if (!String(animalDraft.purpose || "").trim()) {
    errors.purpose = "Enter the transport purpose.";
  }

  if (!remarks) {
    errors.remarks = "Enter remarks for DSS checking.";
  } else if (remarks.length < 3) {
    errors.remarks = "Remarks must be at least 3 characters long.";
  }

  const duplicate = queuedAnimals.find(
    (animal) =>
      animal.id !== editingId &&
      normalizeValue(animal.animal_unique_identifier) ===
        normalizeValue(uniqueIdentifier)
  );

  if (duplicate) {
    errors.animal_unique_identifier =
      "This animal identifier is already queued in the batch.";
  }

  return errors;
}

function validateBatchFields(batchData, accountId, queuedAnimals, animalDraft) {
  const errors = {};
  const ownerName = String(batchData.owner_name || "").trim();
  const destination = String(batchData.animal_destination || "").trim();
  const paidNumber = String(batchData.paid_number || "").trim();
  const startMinutes = parseTimeValue(batchData.inspection_time_start);
  const endMinutes = parseTimeValue(batchData.inspection_time_end);

  if (!String(batchData.inspection_time_start || "").trim()) {
    errors.inspection_time_start = "Select the inspection start time.";
  }

  if (!String(batchData.inspection_time_end || "").trim()) {
    errors.inspection_time_end = "Select the inspection end time.";
  }

  if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
    errors.inspection_time_end = "Inspection end time must be later than start time.";
  }

  if (!ownerName) {
    errors.owner_name = "Enter the owner name.";
  } else if (ownerName.length < 3) {
    errors.owner_name = "Owner name must be at least 3 characters long.";
  }

  if (!String(batchData.owner_barangay || "").trim()) {
    errors.owner_barangay = "Select the owner's barangay.";
  }

  if (!String(batchData.animal_origin_barangay || "").trim()) {
    errors.animal_origin_barangay = "Select the animal origin barangay.";
  }

  if (!destination) {
    errors.animal_destination = "Enter the animal destination.";
  } else if (destination.length < 6) {
    errors.animal_destination = "Destination must be at least 6 characters long.";
  }

  if (!String(batchData.vehicle_used || "").trim()) {
    errors.vehicle_used = "Select the vehicle used.";
  }

  if (!paidNumber) {
    errors.paid_number = "Enter the paid number.";
  } else if (!/^\d+$/.test(paidNumber)) {
    errors.paid_number = "Paid number must contain digits only.";
  }

  if (!accountId) {
    errors.account_id = "Account ID could not be retrieved.";
  }

  if (queuedAnimals.length === 0) {
    errors.queued_animals = "Add at least one animal before submitting the batch.";
  }

  if (hasDraftValues(animalDraft)) {
    errors.animal_draft = "Save or clear the current animal draft before submitting.";
  }

  return errors;
}

export default function AddLivestockForm() {
  const router = useRouter();
  const { renewalRequestId: renewalRequestIdParam } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const renewalRequestId = Array.isArray(renewalRequestIdParam)
    ? renewalRequestIdParam[0]
    : renewalRequestIdParam;

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
  const [batchErrors, setBatchErrors] = useState({});
  const [animalErrors, setAnimalErrors] = useState({});
  const [focusedField, setFocusedField] = useState("");
  const [renewalContext, setRenewalContext] = useState(null);
  const [loadingRenewal, setLoadingRenewal] = useState(false);

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
    if (!renewalRequestId || loadingAccount) {
      if (!renewalRequestId) {
        setRenewalContext(null);
      }
      return undefined;
    }

    let active = true;

    const loadRenewalRequest = async () => {
      try {
        setLoadingRenewal(true);
        const response = await fetch(apiUrl(apiRoutes.renewals.details), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            renewal_request_id: Number.parseInt(renewalRequestId, 10),
          }),
        });

        const data = await parseJsonResponse(
          response,
          "Unable to load the renewal request details."
        );

        if (!active) {
          return;
        }

        if (data.status !== "success" || !data.request) {
          Alert.alert(
            "Renewal unavailable",
            data.message || "The renewal request is no longer available."
          );
          router.replace("/renewalRequests");
          return;
        }

        const request = data.request;
        const ownerAddress = parseAddress(request.owner_address);
        const originAddress = parseAddress(request.animal_origin);

        setRenewalContext({
          renewal_request_id: request.renewal_request_id,
          form_id: request.form_id,
          requested_date: request.requested_date,
          owner_name: request.owner_name || "",
          owner_account_id: Number(request.owner_account_id || 0),
        });
        setSelectedOwner(
          Number(request.owner_account_id || 0) > 0
            ? {
                account_id: Number(request.owner_account_id || 0),
                full_name: request.owner_name || "",
                address: request.owner_address || "",
              }
            : null
        );
        setBatchData((current) => ({
          ...createBatchData(request.inspector_issued || current.inspector_issued),
          inspection_time_start: request.inspection_time_start || "",
          inspection_time_end: request.inspection_time_end || "",
          owner_name: request.owner_name || "",
          owner_barangay: ownerAddress.barangay || "",
          owner_city: ownerAddress.city || DEFAULT_CITY,
          owner_province: ownerAddress.province || DEFAULT_PROVINCE,
          animal_origin_barangay: originAddress.barangay || "",
          animal_origin_city: originAddress.city || DEFAULT_CITY,
          animal_origin_province: originAddress.province || DEFAULT_PROVINCE,
          animal_destination: request.animal_destination || DEFAULT_DESTINATION,
          vehicle_used: request.vehicle_used || "",
          paid_number: request.paid_number || "",
          inspector_issued: request.inspector_issued || current.inspector_issued,
        }));
        setQueuedAnimals([
          {
            id: `renewal-${request.renewal_request_id}`,
            animal_species: request.animal_species || "",
            animal_unique_identifier: request.animal_unique_identifier || "",
            live_weight: String(request.live_weight || ""),
            purpose: request.purpose || DEFAULT_PURPOSE,
            remarks: request.remarks || "",
          },
        ]);
        setAnimalDraft(createAnimalDraft());
        setEditingId(null);
        setSavedAnimals([]);
        setSubmitted(false);
        setBatchId("");
        setQrExpiry("");
        setBatchErrors({});
        setAnimalErrors({});
      } catch (error) {
        console.error(error);
        if (active) {
          Alert.alert(
            "Renewal unavailable",
            error.message || "Unable to load the renewal request."
          );
          router.replace("/renewalRequests");
        }
      } finally {
        if (active) {
          setLoadingRenewal(false);
        }
      }
    };

    loadRenewalRequest();

    return () => {
      active = false;
    };
  }, [loadingAccount, renewalRequestId, router]);

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
  const isRenewalMode = Boolean(renewalContext?.renewal_request_id);

  const updateBatchData = (key, value) => {
    setBatchData((prev) => ({ ...prev, [key]: value }));
    setBatchErrors((prev) => removeErrorKey(prev, key));
  };

  const updateAnimalDraft = (key, value) => {
    setAnimalDraft((prev) => ({ ...prev, [key]: value }));
    setAnimalErrors((prev) => removeErrorKey(prev, key));
  };

  const getFieldShellStyle = (fieldKey, errorMessage, kind = "input") => [
    kind === "picker" ? styles.pickerWrap : styles.inputShell,
    focusedField === fieldKey && styles.fieldShellFocused,
    errorMessage && styles.fieldShellError,
    submitted && styles.fieldShellDisabled,
  ];

  const renderError = (message) =>
    message ? <Text style={styles.errorText}>{message}</Text> : null;

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
    setBatchErrors((prev) => {
      let next = removeErrorKey(prev, "owner_name");
      next = removeErrorKey(next, "owner_barangay");
      return next;
    });
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
    setAnimalErrors({});
    setBatchErrors((prev) => removeErrorKey(prev, "animal_draft"));
  };

  const validateAnimalDraft = () => {
    const errors = validateAnimalFields(animalDraft, queuedAnimals, editingId);
    setAnimalErrors(errors);

    if (hasValidationErrors(errors)) {
      Alert.alert(
        "Complete the animal details",
        "Please review the highlighted animal fields before saving to the batch."
      );
      return false;
    }

    return true;
  };

  const queueAnimal = () => {
    if (isRenewalMode && !editingId && queuedAnimals.length >= 1) {
      Alert.alert(
        "Single renewal record",
        "A renewal request can only reuse one animal record at a time."
      );
      return;
    }

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
    setBatchErrors((prev) => {
      let next = removeErrorKey(prev, "queued_animals");
      next = removeErrorKey(next, "animal_draft");
      return next;
    });
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
    const errors = validateBatchFields(
      batchData,
      accountId,
      queuedAnimals,
      animalDraft
    );
    setBatchErrors(errors);

    if (hasValidationErrors(errors)) {
      Alert.alert(
        "Complete the batch details",
        "Please review the highlighted batch fields before submitting."
      );
      return false;
    }

    return true;
  };

  const submitBatch = async () => {
    if (!validateBatch()) {
      return;
    }

    if (isRenewalMode && queuedAnimals.length !== 1) {
      Alert.alert(
        "Renewal needs one animal",
        "A renewal request can only submit one reusable animal record."
      );
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
          renewal_request_id: renewalContext?.renewal_request_id ?? null,
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
      setBatchErrors({});
      resetAnimalDraft();

      Alert.alert(
        "Success",
        isRenewalMode
          ? `Renewal completed successfully for form #${renewalContext?.form_id}.`
          : `Batch submitted successfully for ${forms.length} animal${
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
          account_id: accountId,
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
    setBatchErrors({});
    setAnimalErrors({});
    setFocusedField("");
    setRenewalContext(null);

    if (renewalRequestId) {
      router.replace("/createLivestockForm");
    }
  };

  if (loadingAccount || loadingRenewal) {
    return (
      <DashboardShell
        eyebrow="Field form creation"
        title={renewalRequestId ? "Load renewal form" : "Create livestock form"}
        subtitle="Preparing the inspection workspace."
        summary={
          loadingRenewal
            ? "Loading the original renewal record for inspector reuse."
            : "Loading account information for the issuing inspector."
        }
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
      title={isRenewalMode ? "Renew livestock form" : "Create livestock form"}
      subtitle={
        isRenewalMode
          ? "Reuse the expired record, edit the details, and submit one renewed livestock form for the scheduled owner request."
          : "Submit one batch of animals while keeping DSS and scheduling linked to each animal."
      }
      summary={
        submitted
          ? isRenewalMode
            ? `Renewal request #${renewalContext?.renewal_request_id} completed. ${reviewedCount} reviewed by DSS and ${urgentCount} marked urgent.`
            : `${savedAnimals.length} animals submitted${batchId ? ` under ${batchId}` : ""}. ${reviewedCount} reviewed by DSS and ${urgentCount} marked urgent.`
          : isRenewalMode
            ? `Renewal scheduled for ${renewalContext?.requested_date || "the selected day"}. Review the reused record, edit what changed, and submit the renewal.`
            : `${queuedAnimals.length} animals queued. Shared owner, origin, transport, and inspection details will apply to every animal in this batch.`
      }
    >
      <View style={styles.card}>
        {isRenewalMode ? (
          <View style={styles.renewalBanner}>
            <Text style={styles.renewalBannerEyebrow}>Renewal request</Text>
            <Text style={styles.renewalBannerTitle}>
              Reusing form #{renewalContext?.form_id} for {renewalContext?.owner_name || "the owner"}
            </Text>
            <Text style={styles.renewalBannerCopy}>
              This request is scheduled for {renewalContext?.requested_date || "the selected day"}. Keep one animal record in the queue, edit the details that changed, and then submit the renewed form.
            </Text>
          </View>
        ) : null}

        <Text style={styles.heading}>Batch Details</Text>
        <Text style={styles.sectionLead}>
          {isRenewalMode
            ? "Shared owner, route, and inspection details were prefilled from the old form and can still be updated before you submit the renewed record."
            : "Shared owner, route, and inspection information will apply to every animal in this batch."}
        </Text>
        {renderError(batchErrors.account_id)}
        <Text style={styles.label}>Owner name</Text>
        <TextInput
          style={getFieldShellStyle("owner_name", batchErrors.owner_name)}
          placeholder="Owner name"
          placeholderTextColor={agriPalette.inkSoft}
          value={batchData.owner_name}
          editable={!submitted}
          onFocus={() => setFocusedField("owner_name")}
          onBlur={() => setFocusedField("")}
          onChangeText={onOwnerChange}
        />
        {renderError(batchErrors.owner_name)}
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
            <View
              style={getFieldShellStyle(
                "owner_barangay",
                batchErrors.owner_barangay,
                "picker"
              )}
            >
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
            {renderError(batchErrors.owner_barangay)}
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Origin barangay</Text>
            <View
              style={getFieldShellStyle(
                "animal_origin_barangay",
                batchErrors.animal_origin_barangay,
                "picker"
              )}
            >
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
            {renderError(batchErrors.animal_origin_barangay)}
          </View>
        </View>
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Inspection start</Text>
            <TouchableOpacity
              style={getFieldShellStyle(
                "inspection_time_start",
                batchErrors.inspection_time_start
              )}
              disabled={submitted}
              onPress={() => {
                setFocusedField("inspection_time_start");
                setTimeKey("inspection_time_start");
                setTimePickerVisible(true);
              }}
            >
              <Text
                style={[
                  styles.inputValue,
                  !batchData.inspection_time_start && styles.placeholderText,
                ]}
              >
                {batchData.inspection_time_start || "Select time"}
              </Text>
            </TouchableOpacity>
            {renderError(batchErrors.inspection_time_start)}
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Inspection end</Text>
            <TouchableOpacity
              style={getFieldShellStyle(
                "inspection_time_end",
                batchErrors.inspection_time_end
              )}
              disabled={submitted}
              onPress={() => {
                setFocusedField("inspection_time_end");
                setTimeKey("inspection_time_end");
                setTimePickerVisible(true);
              }}
            >
              <Text
                style={[
                  styles.inputValue,
                  !batchData.inspection_time_end && styles.placeholderText,
                ]}
              >
                {batchData.inspection_time_end || "Select time"}
              </Text>
            </TouchableOpacity>
            {renderError(batchErrors.inspection_time_end)}
          </View>
        </View>
        <Text style={styles.label}>Animal destination</Text>
        <TextInput
          style={getFieldShellStyle(
            "animal_destination",
            batchErrors.animal_destination
          )}
          placeholder="Animal destination"
          placeholderTextColor={agriPalette.inkSoft}
          value={batchData.animal_destination}
          editable={!submitted}
          onFocus={() => setFocusedField("animal_destination")}
          onBlur={() => setFocusedField("")}
          onChangeText={(value) => updateBatchData("animal_destination", value)}
        />
        {renderError(batchErrors.animal_destination)}
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Vehicle used</Text>
            <View
              style={getFieldShellStyle(
                "vehicle_used",
                batchErrors.vehicle_used,
                "picker"
              )}
            >
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
            {renderError(batchErrors.vehicle_used)}
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Paid number</Text>
            <TextInput
              style={getFieldShellStyle("paid_number", batchErrors.paid_number)}
              value={batchData.paid_number}
              editable={!submitted}
              keyboardType="number-pad"
              placeholder="Paid number"
              placeholderTextColor={agriPalette.inkSoft}
              onFocus={() => setFocusedField("paid_number")}
              onBlur={() => setFocusedField("")}
              onChangeText={(value) => updateBatchData("paid_number", value)}
            />
            {renderError(batchErrors.paid_number)}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>
          {editingId ? "Edit Animal" : isRenewalMode ? "Renewal Animal" : "Add Animal"}
        </Text>
        <Text style={styles.sectionLead}>
          {isRenewalMode
            ? "Renewals reuse one editable animal record so the inspector can update the old form before filing the new permit."
            : "Save one animal at a time so remarks, DSS results, and scheduling stay linked to the correct record."}
        </Text>
        {renderError(batchErrors.animal_draft)}
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Species</Text>
            <View
              style={getFieldShellStyle(
                "animal_species",
                animalErrors.animal_species,
                "picker"
              )}
            >
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
            {renderError(animalErrors.animal_species)}
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Unique identifier</Text>
            <TextInput
              style={getFieldShellStyle(
                "animal_unique_identifier",
                animalErrors.animal_unique_identifier
              )}
              value={animalDraft.animal_unique_identifier}
              editable={!submitted}
              placeholder="Ear tag or animal code"
              placeholderTextColor={agriPalette.inkSoft}
              onFocus={() => setFocusedField("animal_unique_identifier")}
              onBlur={() => setFocusedField("")}
              onChangeText={(value) =>
                updateAnimalDraft("animal_unique_identifier", value)
              }
            />
            {renderError(animalErrors.animal_unique_identifier)}
          </View>
        </View>
        <View style={[styles.row, isTablet && styles.rowWide]}>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Live weight</Text>
            <TextInput
              style={getFieldShellStyle("live_weight", animalErrors.live_weight)}
              value={animalDraft.live_weight}
              editable={!submitted}
              keyboardType="numeric"
              placeholder="Weight in kilograms"
              placeholderTextColor={agriPalette.inkSoft}
              onFocus={() => setFocusedField("live_weight")}
              onBlur={() => setFocusedField("")}
              onChangeText={(value) => updateAnimalDraft("live_weight", value)}
            />
            {renderError(animalErrors.live_weight)}
          </View>
          <View style={styles.flexItem}>
            <Text style={styles.label}>Purpose</Text>
            <TextInput
              style={getFieldShellStyle("purpose", animalErrors.purpose)}
              value={animalDraft.purpose}
              editable={!submitted}
              placeholder="Transport purpose"
              placeholderTextColor={agriPalette.inkSoft}
              onFocus={() => setFocusedField("purpose")}
              onBlur={() => setFocusedField("")}
              onChangeText={(value) => updateAnimalDraft("purpose", value)}
            />
            {renderError(animalErrors.purpose)}
          </View>
        </View>
        <Text style={styles.label}>Remarks</Text>
        <TextInput
          style={[
            ...getFieldShellStyle("remarks", animalErrors.remarks),
            styles.remarks,
          ]}
          value={animalDraft.remarks}
          editable={!submitted}
          multiline
          placeholder="Describe the animal condition for DSS checking"
          placeholderTextColor={agriPalette.inkSoft}
          onFocus={() => setFocusedField("remarks")}
          onBlur={() => setFocusedField("")}
          onChangeText={(value) => updateAnimalDraft("remarks", value)}
        />
        {renderError(animalErrors.remarks)}
        {!submitted ? (
          <View style={styles.listGap}>
            <AgriButton
              title={
                editingId
                  ? "Update queued animal"
                  : isRenewalMode
                    ? "Save renewal animal"
                    : "Add animal to batch"
              }
              subtitle={
                isRenewalMode
                  ? "Renewals reuse one animal record at a time"
                  : "Keep DSS linked to this animal by saving its own remarks"
              }
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
        {!submitted ? renderError(batchErrors.queued_animals) : null}
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
            title={isRenewalMode ? "Submit renewal" : "Submit batch"}
            subtitle={
              isRenewalMode
                ? "Create one renewed livestock record from this scheduled request"
                : `Create ${queuedAnimals.length} livestock record${
                    queuedAnimals.length === 1 ? "" : "s"
                  } in one submission`
            }
            icon="file-check-outline"
            onPress={submitBatch}
            disabled={queuedAnimals.length === 0}
          />
        ) : (
          <AgriButton
            title={isRenewalMode ? "Open another renewal" : "Start new batch"}
            subtitle={
              isRenewalMode
                ? "Return to a clean form workspace"
                : "Reset this workspace for another group of animals"
            }
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
          setFocusedField("");
        }}
        onCancel={() => {
          setTimePickerVisible(false);
          setTimeKey("");
          setFocusedField("");
        }}
      />
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: agriPalette.surface,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  renewalBanner: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E7D2A1",
    backgroundColor: "#FFF4D6",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  renewalBannerEyebrow: {
    color: "#8A6510",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  renewalBannerTitle: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  renewalBannerCopy: {
    marginTop: 8,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  heading: {
    color: agriPalette.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  sectionLead: {
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  label: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  inputShell: {
    minHeight: 58,
    borderWidth: 2,
    borderColor: "#BCC8AE",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: agriPalette.white,
    marginBottom: 12,
    color: agriPalette.ink,
    fontSize: 15,
    shadowColor: "#173223",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  fieldShellFocused: {
    borderColor: agriPalette.field,
    backgroundColor: "#FFFDF8",
  },
  fieldShellError: {
    borderColor: agriPalette.redClay,
    backgroundColor: "#FFF8F4",
  },
  fieldShellDisabled: {
    opacity: 0.72,
  },
  remarks: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  pickerWrap: {
    minHeight: 58,
    borderWidth: 2,
    borderColor: "#BCC8AE",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: agriPalette.white,
    marginBottom: 12,
    justifyContent: "center",
    shadowColor: "#173223",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  inputValue: {
    color: agriPalette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  placeholderText: {
    color: agriPalette.inkSoft,
    fontWeight: "600",
  },
  errorText: {
    marginTop: -4,
    marginBottom: 12,
    color: agriPalette.redClay,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
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
