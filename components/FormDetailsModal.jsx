import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import AgriButton from "./AgriButton";
import { agriPalette } from "../constants/agriTheme";

function getOwnerInitials(ownerName) {
  const parts = String(ownerName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "OW";
}

export default function FormDetailsModal({ visible, onClose, form }) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 760;

  if (!form) return null;

  const getDaysRemaining = (expirationDate) => {
    if (!expirationDate) return "";
    const today = new Date();
    const exp = new Date(expirationDate);
    const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    return diff < 0 ? "Expired" : `${diff} day(s) remaining`;
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "Not provided";
    }
    return String(value);
  };

  const detailEntries = Object.entries(form).filter(
    ([key]) => !["qr_code", "qr_expiration", "owner_profile_picture"].includes(key)
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={34}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={styles.blurBackdrop}
        />
        <View style={styles.overlayTint} />
        <View
          style={[
            styles.modalContainer,
            {
              width: Math.min(width - 24, 920),
              maxHeight: height * 0.88,
            },
          ]}
        >
          <LinearGradient
            colors={[agriPalette.fieldDeep, agriPalette.field]}
            style={styles.hero}
          >
            {form.owner_profile_picture ? (
              <Image
                source={{ uri: form.owner_profile_picture }}
                style={styles.heroAvatar}
              />
            ) : (
              <View style={styles.heroIconWrap}>
                <Text style={styles.heroAvatarFallbackText}>
                  {getOwnerInitials(form.owner_name)}
                </Text>
              </View>
            )}

            <View style={styles.heroTextWrap}>
              <Text style={styles.heroEyebrow}>Submitted livestock form</Text>
              <Text style={styles.heroTitle}>
                {form.form_id ? `Form #${form.form_id}` : "Form details"}
              </Text>
              <Text style={styles.heroSubtitle}>
                Review the QR, owner, and inspection details for{" "}
                {form.owner_name || "this owner"}.
              </Text>
            </View>
          </LinearGradient>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={[styles.topSection, isWide && styles.topSectionWide]}>
              {form.qr_code ? (
                <View style={[styles.qrCard, isWide && styles.topPanelWide]}>
                  <Text style={styles.panelEyebrow}>QR Code</Text>
                  <Text style={styles.panelTitle}>Permit QR</Text>
                  <View style={styles.qrSurface}>
                    <QRCode
                      value={form.qr_code}
                      size={isWide ? 154 : 132}
                      backgroundColor="#fff"
                    />
                  </View>
                  <Text style={styles.qrText}>{form.qr_code}</Text>
                </View>
              ) : null}

              <View style={[styles.expiryCard, isWide && styles.topPanelWide]}>
                <Text style={styles.panelEyebrow}>Status</Text>
                <Text style={styles.panelTitle}>QR status</Text>

                <View style={styles.statusRow}>
                  <View style={styles.statusPill}>
                    <MaterialCommunityIcons
                      name="calendar-clock-outline"
                      size={16}
                      color={agriPalette.fieldDeep}
                    />
                    <Text style={styles.statusPillText}>
                      {form.qr_expiration
                        ? getDaysRemaining(form.qr_expiration)
                        : "No expiration provided"}
                    </Text>
                  </View>
                </View>

                {form.qr_expiration ? (
                  <Text style={styles.expiryText}>
                    Expires on {new Date(form.qr_expiration).toLocaleString()}
                  </Text>
                ) : (
                  <Text style={styles.expiryText}>No expiration set.</Text>
                )}
              </View>
            </View>

            <View style={styles.detailsHeader}>
              <Text style={styles.sectionEyebrow}>Field details</Text>
              <Text style={styles.sectionTitle}>Full record</Text>
            </View>

            <View style={[styles.detailsGrid, isWide && styles.detailsGridWide]}>
              {detailEntries.map(([key, value]) => (
                <View
                  key={key}
                  style={[styles.detailCard, isWide && styles.detailCardWide]}
                >
                  <Text style={styles.detailKey}>
                    {key.replace(/_/g, " ").toUpperCase()}
                  </Text>
                  <Text style={styles.detailValue}>{formatValue(value)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <AgriButton
              title="Close"
              icon="arrow-left"
              variant="earth"
              trailingIcon={null}
              compact
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  blurBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 22, 18, 0.42)",
  },
  modalContainer: {
    backgroundColor: agriPalette.cream,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  hero: {
    paddingHorizontal: 22,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    marginRight: 14,
  },
  heroAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 14,
    backgroundColor: agriPalette.cream,
  },
  heroAvatarFallbackText: {
    color: agriPalette.white,
    fontSize: 18,
    fontWeight: "900",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroEyebrow: {
    color: "rgba(255,244,214,0.9)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 8,
    color: agriPalette.white,
    fontSize: 28,
    fontWeight: "900",
  },
  heroSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 21,
  },
  content: {
    padding: 18,
    paddingBottom: 10,
  },
  topSection: {
    gap: 14,
  },
  topSectionWide: {
    flexDirection: "row",
  },
  topPanelWide: {
    flex: 1,
  },
  qrCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 18,
    alignItems: "center",
  },
  qrSurface: {
    marginTop: 16,
    padding: 16,
    borderRadius: 24,
    backgroundColor: agriPalette.white,
  },
  qrText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: agriPalette.inkSoft,
    textAlign: "center",
  },
  expiryCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 18,
  },
  panelEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  panelTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "900",
    color: agriPalette.ink,
  },
  statusRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: agriPalette.mist,
  },
  statusPillText: {
    marginLeft: 8,
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  expiryText: {
    marginTop: 16,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  detailsHeader: {
    marginTop: 22,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: agriPalette.ink,
  },
  detailsGrid: {
    gap: 12,
  },
  detailsGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 16,
  },
  detailCardWide: {
    width: "48.4%",
  },
  detailKey: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  detailValue: {
    marginTop: 8,
    color: agriPalette.ink,
    fontSize: 16,
    lineHeight: 23,
  },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: agriPalette.border,
    backgroundColor: agriPalette.surface,
  },
});
