import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { apiRoutes, apiUrl, parseJsonResponse } from "../../lib/api";

const VERIFY_URL = apiUrl(apiRoutes.antemortem.verifyQr);

const DETAIL_LABELS = {
  form_id: "Form ID",
  owner_name: "Owner",
  animal_species: "Species",
  animal_identifier: "Animal ID",
  purpose: "Purpose",
  animal_origin: "Origin",
  animal_destination: "Destination",
  inspector_issued: "Issued by",
  qr_expiration: "Permit expiry",
};

function getParamValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatDetailLabel(key) {
  return (
    DETAIL_LABELS[key] ||
    key
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatDetailValue(key, value) {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }

  if (key === "qr_expiration") {
    const parsed = new Date(String(value).replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }

  return String(value);
}

function buildStatusMeta(ok, reason) {
  if (ok) {
    return {
      title: "QR Verified",
      icon: "check-decagram",
      accent: "#1B5E20",
      surface: "#E8F5E9",
      border: "#B7D8BE",
    };
  }

  if (reason === "qr_expired") {
    return {
      title: "Permit Expired",
      icon: "clock-alert-outline",
      accent: "#B42318",
      surface: "#FEECEA",
      border: "#F4C7C3",
    };
  }

  if (reason === "qr_mismatch") {
    return {
      title: "Record Mismatch",
      icon: "qrcode-remove",
      accent: "#B54708",
      surface: "#FFF2E8",
      border: "#F5CBA7",
    };
  }

  if (reason === "qr_not_found") {
    return {
      title: "QR Not Found",
      icon: "qrcode-search",
      accent: "#9A3412",
      surface: "#FFF4ED",
      border: "#FED7AA",
    };
  }

  if (reason === "form_not_found") {
    return {
      title: "Form Missing",
      icon: "file-alert-outline",
      accent: "#7F1D1D",
      surface: "#FEE4E2",
      border: "#F3B7B2",
    };
  }

  if (reason === "missing_qr_data") {
    return {
      title: "Scan Incomplete",
      icon: "camera-off-outline",
      accent: "#7F1D1D",
      surface: "#FEE4E2",
      border: "#F3B7B2",
    };
  }

  return {
    title: "Verification Failed",
    icon: "alert-circle-outline",
    accent: "#7A271A",
    surface: "#FDEDEC",
    border: "#F0C7C2",
  };
}

function buildStatusNote(payload) {
  if (payload.reason === "qr_expired") {
    const days = Number(payload.days_since_expiration || 0);
    if (days <= 1) {
      return "Expired 1 day ago";
    }

    return `Expired ${days} days ago`;
  }

  if (payload.valid) {
    const days = Number(payload.days_until_expiration);
    if (!Number.isNaN(days)) {
      if (days <= 0) {
        return "Expires today";
      }

      if (days === 1) {
        return "Expires in 1 day";
      }

      return `Expires in ${days} days`;
    }

    return "Permit ready for inspection";
  }

  if (payload.reason === "qr_mismatch") {
    return "Scanned code belongs to a different livestock record";
  }

  if (payload.reason === "qr_not_found") {
    return "No matching permit was found in the system";
  }

  if (payload.reason === "form_not_found") {
    return "The scheduled form could not be loaded";
  }

  if (payload.reason === "missing_qr_data") {
    return "The camera did not capture a usable QR value";
  }

  return "Review the details below before trying again";
}

function buildResultState(payload) {
  const ok = payload.status === "success" && !!payload.valid;
  const meta = buildStatusMeta(ok, payload.reason);

  return {
    ok,
    title: meta.title,
    icon: meta.icon,
    accent: meta.accent,
    surface: meta.surface,
    border: meta.border,
    message:
      payload.message ||
      (ok
        ? "QR verification completed successfully."
        : "QR verification could not be completed."),
    reason: payload.reason || "",
    reasonLabel: payload.reason_label || "Validation result",
    statusNote: buildStatusNote(payload),
    guidanceTitle: payload.guidance_title || "What to do next",
    guidanceSteps: Array.isArray(payload.guidance_steps)
      ? payload.guidance_steps
      : [],
    details: payload.details ?? null,
    detectedDetails: payload.detected_details ?? null,
    formId: payload.form_id ?? null,
  };
}

export default function AntemortemScanQRcode() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const incomingFormId = parseInt(getParamValue(params?.form_id), 10) || 0;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [lastScannedData, setLastScannedData] = useState(null);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.infoText}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>
          Camera access is required to scan QR codes.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }) => {
    if (scanned || verifying) return;

    setScanned(true);
    setVerifying(true);
    setLastScannedData(data);

    try {
      const payload = { qr_data: data };

      if (incomingFormId > 0) {
        payload.form_id = incomingFormId;
      }

      const response = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await parseJsonResponse(response, "Unable to verify QR.");
      setResult(buildResultState(json));
    } catch (error) {
      console.error("QR verification error:", error);

      setResult({
        ok: false,
        title: "Verification Failed",
        icon: "alert-circle-outline",
        accent: "#7A271A",
        surface: "#FDEDEC",
        border: "#F0C7C2",
        message:
          error?.message || "Network error while verifying QR.",
        reason: "network_error",
        reasonLabel: "Connection problem",
        statusNote: "The app could not reach the verification service",
        guidanceTitle: "What to do next",
        guidanceSteps: [
          "Check that your phone has an active network connection.",
          "Try scanning the QR again after reopening the scanner.",
          "If the problem continues, ask an administrator to check the verification API.",
        ],
        details: null,
        detectedDetails: null,
      });
    } finally {
      setVerifying(false);
    }
  };

  const onRescan = () => {
    setScanned(false);
    setResult(null);
    setLastScannedData(null);
  };

  const onDone = () =>
    router.replace(
      incomingFormId > 0 ? "/antemortemSchedules" : "/antemortemDashboard"
    );

  return (
    <View style={styles.container}>
      {!scanned && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          <View style={styles.scanOverlay}>
            <View style={styles.scanShade} />
            <View style={styles.scanCenterRow}>
              <View style={styles.scanSideShade} />
              <View style={styles.scanFrame}>
                <View
                  style={[styles.scanCorner, styles.scanCornerTopLeft]}
                />
                <View
                  style={[styles.scanCorner, styles.scanCornerTopRight]}
                />
                <View
                  style={[styles.scanCorner, styles.scanCornerBottomLeft]}
                />
                <View
                  style={[styles.scanCorner, styles.scanCornerBottomRight]}
                />
                <View style={styles.scanFrameBadge}>
                  <MaterialCommunityIcons
                    name="qrcode-scan"
                    size={34}
                    color="#F7F2D8"
                  />
                </View>
              </View>
              <View style={styles.scanSideShade} />
            </View>
            <View style={styles.scanBottomShade}>
              <View style={styles.scanHintCard}>
                <Text style={styles.scanHintEyebrow}>QR Verification</Text>
                <Text style={styles.scanHint}>
                  Place the permit QR inside the box
                </Text>
                <Text style={styles.scanSubhint}>
                  Hold your phone steady for automatic scanning
                </Text>
              </View>
            </View>
          </View>
        </CameraView>
      )}

      {scanned && verifying && (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.infoText}>Verifying QR...</Text>
        </View>
      )}

      {scanned && !verifying && result && (
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={36}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.blurBackdrop}
          />
          <View style={styles.modalTint} />
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              {lastScannedData && (
                <View style={styles.qrWrapper}>
                  <QRCode value={lastScannedData} size={140} />
                </View>
              )}

              <View
                style={[
                  styles.statusHero,
                  {
                    backgroundColor: result.surface,
                    borderColor: result.border,
                  },
                ]}
              >
                <View style={styles.statusIconWrap}>
                  <MaterialCommunityIcons
                    name={result.icon}
                    size={28}
                    color={result.accent}
                  />
                </View>

                <Text style={[styles.resultTitle, { color: result.accent }]}>
                  {result.title}
                </Text>

                <View
                  style={[
                    styles.reasonChip,
                    {
                      borderColor: result.border,
                    },
                  ]}
                >
                  <Text style={[styles.reasonChipText, { color: result.accent }]}>
                    {result.reasonLabel}
                  </Text>
                </View>

                <Text style={styles.statusNote}>{result.statusNote}</Text>
                <Text style={styles.resultMessage}>{result.message}</Text>
              </View>

              {result.details ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    {result.ok ? "Matched record" : "Expected record"}
                  </Text>
                  <View style={styles.detailList}>
                    {Object.entries(result.details).map(([key, value]) => (
                      <View key={key} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          {formatDetailLabel(key)}
                        </Text>
                        <Text style={styles.detailValue}>
                          {formatDetailValue(key, value)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {result.detectedDetails ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Scanned record</Text>
                  <View style={styles.detailList}>
                    {Object.entries(result.detectedDetails).map(([key, value]) => (
                      <View key={key} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>
                          {formatDetailLabel(key)}
                        </Text>
                        <Text style={styles.detailValue}>
                          {formatDetailValue(key, value)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {result.guidanceSteps?.length ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>{result.guidanceTitle}</Text>
                  <View style={styles.guidanceStack}>
                    {result.guidanceSteps.map((step, index) => (
                      <View key={`${step}-${index}`} style={styles.guidanceRow}>
                        <View style={styles.guidanceIndex}>
                          <Text style={styles.guidanceIndexText}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text style={styles.guidanceText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={onRescan}
                >
                  <Text style={styles.secondaryButtonText}>Re-scan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    !result.ok && { backgroundColor: "#8D8D8D" },
                  ]}
                  onPress={onDone}
                >
                  <Text style={styles.primaryButtonText}>
                    {incomingFormId > 0
                      ? "Back to schedules"
                      : "Back to dashboard"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E8F5E9" },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scanShade: {
    flex: 1,
    backgroundColor: "rgba(5, 25, 12, 0.56)",
  },
  scanCenterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scanSideShade: {
    flex: 1,
    height: 270,
    backgroundColor: "rgba(5, 25, 12, 0.56)",
  },
  scanFrame: {
    width: 270,
    height: 270,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  scanCorner: {
    position: "absolute",
    width: 42,
    height: 42,
    borderColor: "#F2D56B",
  },
  scanCornerTopLeft: {
    top: 16,
    left: 16,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 16,
  },
  scanCornerTopRight: {
    top: 16,
    right: 16,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 16,
  },
  scanCornerBottomLeft: {
    bottom: 16,
    left: 16,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 16,
  },
  scanCornerBottomRight: {
    bottom: 16,
    right: 16,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 16,
  },
  scanFrameBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(14, 43, 24, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanBottomShade: {
    flex: 1,
    backgroundColor: "rgba(5, 25, 12, 0.56)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  scanHintCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "rgba(9, 34, 19, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  scanHintEyebrow: {
    color: "#CDE6CE",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  scanHint: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  scanSubhint: {
    marginTop: 6,
    color: "#D5E6D7",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  infoText: { marginTop: 10, fontSize: 16, color: "#24412D" },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  blurBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },

  modalScroll: { flexGrow: 1, justifyContent: "center" },

  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
  },

  qrWrapper: { alignItems: "center", marginBottom: 16 },

  statusHero: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },

  statusIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "#FFFFFFCC",
  },

  resultTitle: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  reasonChip: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#FFFFFFCC",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  reasonChipText: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  statusNote: {
    marginTop: 10,
    color: "#1C3B2B",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  resultMessage: {
    marginTop: 10,
    color: "#486150",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  sectionCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: "#F9FCF7",
    borderWidth: 1,
    borderColor: "#D9E8DA",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  sectionTitle: {
    color: "#17311F",
    fontSize: 16,
    fontWeight: "900",
  },

  detailList: {
    marginTop: 12,
    gap: 10,
  },

  detailRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E4EEE4",
  },

  detailLabel: {
    color: "#5C7264",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  detailValue: {
    marginTop: 5,
    color: "#1B2F21",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },

  guidanceStack: {
    marginTop: 12,
    gap: 12,
  },

  guidanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  guidanceIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DFF0DE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  guidanceIndexText: {
    color: "#1B5E20",
    fontSize: 13,
    fontWeight: "900",
  },

  guidanceText: {
    flex: 1,
    color: "#365243",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },

  primaryButton: {
    flex: 1,
    marginLeft: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#2E7D32",
    alignItems: "center",
  },

  primaryButtonText: { color: "#FFFFFF", fontWeight: "bold" },

  secondaryButton: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#C8E6C9",
    alignItems: "center",
  },

  secondaryButtonText: { color: "#2E7D32", fontWeight: "bold" },
});
