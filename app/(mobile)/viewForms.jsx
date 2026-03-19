import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import AgriButton from "../../components/AgriButton";
import DashboardShell from "../../components/DashboardShell";
import FormDetailsModal from "../../components/FormDetailsModal";
import { apiRoutes, apiUrl } from "../../lib/api";
import { agriPalette } from "../../constants/agriTheme";

const API_URL = apiUrl(apiRoutes.inspector.forms);

const FILTER_OPTIONS = [
  { value: "all", label: "All Forms", icon: "file-cabinet" },
  { value: "today", label: "Today", icon: "calendar-today" },
  { value: "week", label: "This Week", icon: "calendar-week" },
  { value: "month", label: "This Month", icon: "calendar-month" },
];

function getRouteParamValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

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

export default function ViewForms() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [allGroupedForms, setAllGroupedForms] = useState({});
  const [allFilteredForms, setAllFilteredForms] = useState([]);
  const [groupedForms, setGroupedForms] = useState({});
  const [filteredForms, setFilteredForms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForm, setSelectedForm] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState("all");
  const [autoOpenedFormId, setAutoOpenedFormId] = useState(0);
  const highlightedFormId =
    parseInt(getRouteParamValue(params?.form_id), 10) || 0;

  useEffect(() => {
    const loadForms = async () => {
      try {
        const accountId = await AsyncStorage.getItem("account_id");
        if (!accountId) {
          Alert.alert("Error", "User not logged in.");
          return;
        }

        const response = await fetch(
          `${API_URL}?filter=${filter}&account_id=${accountId}`
        );
        const data = await response.json();

        if (data.status === "success") {
          if (filter === "all") {
            setAllGroupedForms(data.forms || {});
            setGroupedForms(data.forms || {});
            setAllFilteredForms([]);
            setFilteredForms([]);
          } else {
            setAllFilteredForms(data.forms || []);
            setFilteredForms(data.forms || []);
            setAllGroupedForms({});
            setGroupedForms({});
          }
        } else {
          Alert.alert("Error", data.message || "Failed to load forms.");
        }
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to fetch forms.");
      }
    };

    loadForms();
  }, [filter]);

  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase().trim();

    if (filter === "all") {
      if (!lowerQuery) {
        setGroupedForms(allGroupedForms);
        return;
      }

      const nextGroups = {};
      Object.keys(allGroupedForms).forEach((date) => {
        const matches = allGroupedForms[date].filter(
          (item) =>
            item.owner_name.toLowerCase().includes(lowerQuery) ||
            item.animal_unique_identifier.toLowerCase().includes(lowerQuery) ||
            item.form_id.toString().includes(lowerQuery)
        );

        if (matches.length > 0) {
          nextGroups[date] = matches;
        }
      });

      setGroupedForms(nextGroups);
      return;
    }

    if (!lowerQuery) {
      setFilteredForms(allFilteredForms);
      return;
    }

    setFilteredForms(
      allFilteredForms.filter(
        (item) =>
          item.owner_name.toLowerCase().includes(lowerQuery) ||
          item.animal_unique_identifier.toLowerCase().includes(lowerQuery) ||
          item.form_id.toString().includes(lowerQuery)
      )
    );
  }, [searchQuery, filter, allGroupedForms, allFilteredForms]);

  const viewFormDetails = async (formId) => {
    try {
      const response = await fetch(
        apiUrl(apiRoutes.inspector.formDetails),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form_id: formId }),
        }
      );

      const data = await response.json();

      if (data.status === "success") {
        setSelectedForm(data.form);
        setModalVisible(true);
      } else {
        Alert.alert("Error", data.message || "Failed to get form details.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to fetch form details.");
    }
  };

  useEffect(() => {
    if (!highlightedFormId || autoOpenedFormId === highlightedFormId) {
      return;
    }

    let active = true;

    const openHighlightedForm = async () => {
      try {
        const response = await fetch(apiUrl(apiRoutes.inspector.formDetails), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form_id: highlightedFormId }),
        });

        const data = await response.json();

        if (!active) {
          return;
        }

        if (data.status === "success") {
          setSelectedForm(data.form);
          setModalVisible(true);
          setAutoOpenedFormId(highlightedFormId);
        }
      } catch (error) {
        console.error("Highlighted form open error:", error);
      }
    };

    openHighlightedForm();

    return () => {
      active = false;
    };
  }, [autoOpenedFormId, highlightedFormId]);

  const groupedEntries = Object.entries(groupedForms);
  const totalForms =
    filter === "all"
      ? groupedEntries.reduce((sum, [, items]) => sum + items.length, 0)
      : filteredForms.length;
  const selectedFilterLabel =
    FILTER_OPTIONS.find((option) => option.value === filter)?.label || "All";

  return (
    <DashboardShell
      eyebrow="Submitted records"
      title="View submitted forms"
      subtitle="Use this page to search submitted livestock records, narrow the reporting window, and open the exact form details you need."
      summary={`${totalForms} form${totalForms === 1 ? "" : "s"} visible for ${selectedFilterLabel.toLowerCase()}.`}
    >
      <View style={styles.controlCard}>
        <Text style={styles.cardEyebrow}>Search and filter</Text>
        <Text style={styles.cardTitle}>Find a livestock form quickly</Text>
        <Text style={styles.cardCopy}>
          Search by owner, eartag, or form number, then switch the reporting
          filter to surface the records you need to review next.
        </Text>

        <View style={[styles.searchBox, isWide && styles.searchBoxWide]}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={agriPalette.field}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by owner, eartag, or form ID"
            placeholderTextColor="#70806F"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const active = option.value === filter;

            return (
              <Pressable
                key={option.value}
                onPress={() => setFilter(option.value)}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                ]}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={18}
                  color={active ? agriPalette.white : agriPalette.fieldDeep}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.metricsRow, isWide && styles.metricsRowWide]}>
          <MetricPill
            icon="clipboard-text-outline"
            label="Visible forms"
            value={String(totalForms)}
          />
          <MetricPill
            icon="tune-variant"
            label="Filter"
            value={selectedFilterLabel}
          />
          <MetricPill
            icon="magnify-scan"
            label="Search"
            value={searchQuery.trim() ? "Active" : "All records"}
          />
        </View>
      </View>

      {totalForms === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons
            name="sprout-outline"
            size={36}
            color={agriPalette.field}
          />
          <Text style={styles.emptyTitle}>No forms found</Text>
          <Text style={styles.emptyText}>
            Try another filter or search term to reveal the form you need to
            inspect.
          </Text>
        </View>
      ) : (
        <View style={styles.listContent}>
          {filter === "all" ? (
            groupedEntries.map(([date, items]) => (
              <View key={date} style={styles.dateSection}>
                <View style={styles.dateHeader}>
                  <View>
                    <Text style={styles.dateEyebrow}>Record date</Text>
                    <Text style={styles.dateTitle}>{date}</Text>
                  </View>
                  <View style={styles.dateCountPill}>
                    <Text style={styles.dateCountText}>
                      {items.length} form{items.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardsGrid, isWide && styles.cardsGridWide]}>
                  {items.map((item) => (
                    <FormCard
                      key={item.form_id}
                      item={item}
                      isWide={isWide}
                      isHighlighted={Number(item.form_id) === highlightedFormId}
                      onView={viewFormDetails}
                    />
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.cardsGrid, isWide && styles.cardsGridWide]}>
              {filteredForms.map((item) => (
                <FormCard
                  key={item.form_id}
                  item={item}
                  isWide={isWide}
                  isHighlighted={Number(item.form_id) === highlightedFormId}
                  onView={viewFormDetails}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <FormDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        form={selectedForm}
      />
    </DashboardShell>
  );
}

function FormCard({ item, onView, isWide, isHighlighted = false }) {
  return (
    <View
      style={[
        styles.formCard,
        isWide && styles.formCardWide,
        isHighlighted && styles.formCardHighlighted,
      ]}
    >
      <View style={styles.formCardTop}>
        <View style={styles.ownerIdentity}>
          {item.owner_profile_picture ? (
            <Image
              source={{ uri: item.owner_profile_picture }}
              style={styles.ownerAvatar}
            />
          ) : (
            <View style={styles.ownerAvatarFallback}>
              <Text style={styles.ownerAvatarFallbackText}>
                {getOwnerInitials(item.owner_name)}
              </Text>
            </View>
          )}

          <View style={styles.ownerTextWrap}>
            <View style={styles.formBadge}>
              <Text style={styles.formBadgeText}>Form #{item.form_id}</Text>
            </View>
            <Text style={styles.formCardTitle}>{item.owner_name}</Text>
            <Text style={styles.formCardSubtitle}>
              Eartag: {item.animal_unique_identifier}
            </Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name="barn"
          size={22}
          color={agriPalette.fieldDeep}
        />
      </View>

      <View style={styles.detailPillRow}>
        <DetailPill
          icon="account-outline"
          text={item.owner_name}
        />
        <DetailPill
          icon="tag-outline"
          text={item.animal_unique_identifier}
        />
      </View>

      <View style={styles.formActionWrap}>
        <AgriButton
          title="View details"
          subtitle="Open QR, expiry, and record data"
          icon="file-eye-outline"
          compact
          variant="primary"
          onPress={() => onView(item.form_id)}
        />
      </View>
    </View>
  );
}

function MetricPill({ icon, label, value }) {
  return (
    <View style={styles.metricPill}>
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={agriPalette.fieldDeep}
      />
      <View style={styles.metricTextWrap}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function DetailPill({ icon, text }) {
  return (
    <View style={styles.detailPill}>
      <MaterialCommunityIcons
        name={icon}
        size={16}
        color={agriPalette.fieldDeep}
      />
      <Text style={styles.detailPillText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  controlCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 22,
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
    fontSize: 26,
    fontWeight: "900",
  },
  searchBox: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCFAF4",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: agriPalette.border,
    paddingHorizontal: 14,
    minHeight: 58,
  },
  searchBoxWide: {
    maxWidth: 620,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 10,
    color: agriPalette.ink,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: agriPalette.mist,
  },
  filterChipActive: {
    backgroundColor: agriPalette.field,
  },
  filterChipText: {
    marginLeft: 8,
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: agriPalette.white,
  },
  metricsRow: {
    gap: 10,
    marginTop: 16,
  },
  metricsRowWide: {
    flexDirection: "row",
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F0E3",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  metricTextWrap: {
    marginLeft: 10,
  },
  metricLabel: {
    color: agriPalette.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  metricValue: {
    color: agriPalette.fieldDeep,
    fontSize: 15,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 14,
    color: agriPalette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 10,
    textAlign: "center",
    color: agriPalette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  listContent: {
    paddingBottom: 20,
  },
  dateSection: {
    marginBottom: 18,
  },
  dateHeader: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateEyebrow: {
    color: agriPalette.field,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  dateTitle: {
    marginTop: 6,
    color: agriPalette.ink,
    fontSize: 26,
    fontWeight: "900",
  },
  dateCountPill: {
    borderRadius: 999,
    backgroundColor: "#F2E4BD",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateCountText: {
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "800",
  },
  cardsGrid: {
    gap: 12,
  },
  cardsGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  formCard: {
    backgroundColor: agriPalette.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: agriPalette.border,
    padding: 18,
    shadowColor: "#203126",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  formCardHighlighted: {
    borderColor: agriPalette.field,
    borderWidth: 2,
    shadowColor: agriPalette.fieldDeep,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  formCardWide: {
    width: "48.8%",
  },
  formCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  ownerIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  ownerAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: agriPalette.cream,
  },
  ownerAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: agriPalette.fieldDeep,
    borderWidth: 1,
    borderColor: agriPalette.border,
  },
  ownerAvatarFallbackText: {
    color: agriPalette.white,
    fontSize: 18,
    fontWeight: "900",
  },
  ownerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  formBadge: {
    borderRadius: 999,
    backgroundColor: agriPalette.mist,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  formBadgeText: {
    color: agriPalette.fieldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  formCardTitle: {
    marginTop: 10,
    color: agriPalette.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  formCardSubtitle: {
    marginTop: 6,
    color: agriPalette.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  detailPillRow: {
    marginTop: 16,
    gap: 10,
  },
  detailPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#F9F4E8",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailPillText: {
    marginLeft: 8,
    color: agriPalette.fieldDeep,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  formActionWrap: {
    marginTop: 16,
  },
});
