import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "./firebase"; // adjust path if needed
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";

// helper: month labels
const MONTH_LABELS = [
  "1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"
];

// range of years to display in dropdown (2023 .. current year)
const makeYearsRange = (start = 2023) => {
  const y = new Date().getFullYear();
  const arr = [];
  for (let year = start; year <= y; year++) arr.push(String(year));
  return arr.reverse(); // newest first
};

// --- conversions & formatters ---
const toKg = (grams) => (grams);
const toL = (milliLiters) => Math.floor(milliLiters / 1000);
const fmtKg = (grams) => `${(grams).toFixed(1)}kg`;
const fmtL = (mL) => `${toL(mL)}L`;
const fmtCarbon = (grams) => `${toKg(grams).toFixed(1)}g`;

// simple equivalence heuristics (approx)
const eqWasteCups = (grams) => Math.floor(toKg(grams) * 100); // kg *100 -> cups
const eqWaterShowers = (mL) => Math.floor(toL(mL) / 60); // L / 10 -> showers
const eqCarbonTrees = (grams) => (Math.floor(toKg(grams) / 1000)).toFixed(1); // kg /10 -> trees

// zero template for one month
const emptyMonthly = () => ({ waste: 0, water: 0, co2: 0 });

const CumulativeReportScreen = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agg, setAgg] = useState({ total: { waste: 0, water: 0, co2: 0 }, byYear: {} });

  const yearsRange = makeYearsRange(2023);
  const [viewMode, setViewMode] = useState("total"); // total | monthly
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth()); // 0..11

  const [yearOpen, setYearOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  // Listen to auth and load data
  useEffect(() => {
    setLoading(true);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadCompletedMissions(user.uid).finally(() => setLoading(false));
      } else {
        setUserId(null);
        // reset
        setAgg({ total: { waste: 0, water: 0, co2: 0 }, byYear: {} });
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // LOAD + AGGREGATE
  const loadCompletedMissions = async (uid) => {
    setLoading(true);
    try {
      const userRef = collection(db, "users", uid, "completedMissions");
      const snap = await getDocs(userRef);

      // prepare aggregator
      const byYear = {};
      const total = { waste: 0, water: 0, co2: 0 };

      // initialize years range in byYear with empty months
      for (const y of yearsRange) {
        byYear[y] = Array.from({ length: 12 }, () => emptyMonthly());
      }

      snap.forEach((doc) => {
        const data = doc.data();
        // expect data.water, data.waste, data.co2 numbers
        const w = Number(data.water || 0);
        const wa = Number(data.waste || 0); // careful naming: waste -> wa
        const c = Number(data.co2 || 0);

        // get year & month from completedAt or createdAt
        let year = null;
        let monthIndex = null; // 0..11

        if (data.completedAt && typeof data.completedAt === "object") {
            if (typeof data.completedAt.year === "number") {
                year = String(data.completedAt.year);
            }

            if (typeof data.completedAt.month === "number") {
                let m = data.completedAt.month;

                // 🔥 강제 정규화: 저장값이 1~12면 0~11로 변환
                if (m >= 1 && m <= 12) monthIndex = m - 1;
                // 🔥 저장값이 이미 0~11이면 그대로 사용
                else if (m >= 0 && m <= 11) monthIndex = m;
            }
        }


        // fallback to createdAt Timestamp (Firestore)
        if ((year === null || monthIndex === null) && data.createdAt && typeof data.createdAt.toDate === "function") {
        const d = data.createdAt.toDate();
        if (year === null) year = String(d.getFullYear());
        if (monthIndex === null) monthIndex = d.getMonth(); // Firestore 기본이 0~11
        }


        // if still null, try a createdAtRaw or similar fields (string)
        if ((year === null || monthIndex === null) && data.completedAt && typeof data.completedAt === "string") {
          // try parse ISO
          const parsed = new Date(data.completedAt);
          if (!isNaN(parsed)) {
            if (year === null) year = String(parsed.getFullYear());
            if (monthIndex === null) monthIndex = parsed.getMonth();
          }
        }

        // If both present, aggregate
        if (year !== null && monthIndex !== null && monthIndex >= 0 && monthIndex < 12) {
          if (!byYear[year]) {
            // create entry for year with empty months
            byYear[year] = Array.from({ length: 12 }, () => emptyMonthly());
          }
          const monthSlot = byYear[year][monthIndex];
          monthSlot.waste += wa;
          monthSlot.water += w;
          monthSlot.co2 += c;

          // add to totals
          total.waste += wa;
          total.water += w;
          total.co2 += c;
        } else {
          // doc couldn't be parsed to a month/year -> still add to total to not lose
          total.waste += wa;
          total.water += w;
          total.co2 += c;
        }
      });

      setAgg({ total, byYear });
      // if selected year not in byYear, set to current
      if (!byYear[selectedYear]) {
        setSelectedYear(Object.keys(byYear).length ? Object.keys(byYear)[0] : String(new Date().getFullYear()));
      }
    } catch (e) {
      console.warn("Failed to load completed missions:", e);
      Alert.alert("데이터 로드 실패", "완료한 미션을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Choose displayed data
  const displayed = (() => {
    if (viewMode === "total") {
      return {
        waste: agg.total.waste,
        water: agg.total.water,
        co2: agg.total.co2,
      };
    } else {
      const yearMap = agg.byYear[selectedYear] || Array.from({ length: 12 }, () => emptyMonthly());
      return yearMap[selectedMonthIndex] || emptyMonthly();
    }
  })();

  // formatted strings to display
  const wasteStr = fmtKg(displayed.waste);
  const waterStr = fmtL(displayed.water);
  const co2Str = fmtCarbon(displayed.co2);

  const wasteEq = `${eqWasteCups(displayed.waste).toLocaleString()}개`;
  const waterEq = `${eqWaterShowers(displayed.water)}회분`;
  const co2Eq = `${eqCarbonTrees(displayed.co2)}그루`;

  // years list to show in selector (2023..current)
  const yearsList = makeYearsRange(2023);

  // months labels (1월..12월)
  const monthsList = MONTH_LABELS;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={24} color="#4CAF50" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>📊 누적 환경 임팩트</Text>

        <TouchableOpacity onPress={() => setShareVisible(true)} style={{ padding: 6 }}>
          <Feather name="share-2" size={22} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === "total" && styles.activeToggle]}
              onPress={() => setViewMode("total")}
            >
              <Text style={[styles.toggleLabel, viewMode === "total" && styles.activeToggleLabel]}>전체 누적</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === "monthly" && styles.activeToggle]}
              onPress={() => setViewMode("monthly")}
            >
              <Text style={[styles.toggleLabel, viewMode === "monthly" && styles.activeToggleLabel]}>월별 보기</Text>
            </TouchableOpacity>
          </View>

          {/* Year/Month selectors only for monthly */}
          {viewMode === "monthly" && (
            <View style={{ paddingHorizontal: 16 }}>
              <TouchableOpacity style={styles.dropdown} onPress={() => setYearOpen((s) => !s)}>
                <Text style={styles.dropdownLabel}>{selectedYear}년</Text>
                <Feather name="chevron-down" size={18} color="#4CAF50" />
              </TouchableOpacity>
              {yearOpen &&
                yearsList.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedYear(y);
                      setSelectedMonthIndex( new Date().getMonth() ); // default month: current
                      setYearOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemLabel}>{y}년</Text>
                  </TouchableOpacity>
                ))}
              <TouchableOpacity style={[styles.dropdown, { marginTop: 10 }]} onPress={() => setMonthOpen((s) => !s)}>
                <Text style={styles.dropdownLabel}>{monthsList[selectedMonthIndex]}</Text>
                <Feather name="chevron-down" size={18} color="#4CAF50" />
              </TouchableOpacity>
              {monthOpen &&
                monthsList.map((m, idx) => (
                  <TouchableOpacity
                    key={m}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedMonthIndex(idx);
                      setMonthOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemLabel}>{m}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* Big summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryBadge}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {viewMode === "total" ? "🌍 전체 누적" : `📅 ${selectedYear} ${monthsList[selectedMonthIndex]}`}
              </Text>
            </View>

            <Text style={styles.summaryTitle}>보들보틀과 함께한{'\n'}환경 보호 💚</Text>
            <Text style={styles.summarySubtitle}>작은 실천이 모여 큰 변화를 만들었어요!</Text>

            <View style={styles.quickGrid}>
              <View style={[styles.quickBox, { backgroundColor: "#b3ec40", borderColor: "#cff3d3" }]}>
                <Text style={styles.quickEmoji}>🗑️</Text>
                <Text style={styles.quickLabel}>쓰레기</Text>
                <Text style={styles.quickValue}>{wasteStr}</Text>
              </View>
              <View style={[styles.quickBox, { backgroundColor: "#b3ec40", borderColor: "#d7edff" }]}>
                <Text style={styles.quickEmoji}>💧</Text>
                <Text style={styles.quickLabel}>물</Text>
                <Text style={styles.quickValue}>{waterStr}</Text>
              </View>
              <View style={[styles.quickBox, { backgroundColor: "#b3ec40", borderColor: "#dff7e3" }]}>
                <Text style={styles.quickEmoji}>🌳</Text>
                <Text style={styles.quickLabel}>탄소</Text>
                <Text style={styles.quickValue}>{co2Str}</Text>
              </View>
            </View>
          </View>

          {/* Detailed impact sections */}
          <View style={styles.detailContainer}>
            {/* Waste */}
            <View style={[styles.detailCard, { backgroundColor: "#fff6f0", borderColor: "#caf27a" }]}>
              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { borderColor: "#ffd8c0" }]}>
                   <Feather name="trash" size={24} color="#d35400" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.detailTitle, { color: "#d35400" }]}>쓰레기 절감량 {fmtKg(displayed.waste)}</Text>
                  <View style={[styles.eqBadge, {backgroundColor: '#fb7324ff'}]}>
                    <Text style={[styles.eqBadgeText, {color: '#fff'}]}>= 일회용컵 {wasteEq}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.detailNote, {backgroundColor: '#ffedd4'}]}>
                <Text style={{ color: "#8b5f36" }}>
                  💡 쓰레기 매립장으로 향하던 종량제 봉투 20개를 없앴어요!
                </Text>
              </View>
            </View>

            {/* Water */}
            <View style={[styles.detailCard, { backgroundColor: "#f0f8ff", borderColor: "#caf27a" }]}>
              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { borderColor: "#d8ecff" }]}>
                  <Feather name="droplet" size={24} color="#0b6edc" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.detailTitle, { color: "#0b6edc" }]}>절약한 물 {fmtL(displayed.water)}</Text>
                  <View style={[styles.eqBadge, { backgroundColor: "#0b6edc", borderColor: "#0b6edc" }]}>
                    <Text style={[styles.eqBadgeText, { color: "#fff" }]}>= 샤워 {waterEq}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.detailNote, {backgroundColor: '#dbeafe'}]}>
                <Text style={{ color: "#174b8a" }}>
                  💡 작은 화분 2~3개에 충분히 물을 줄 수 있는 양을 아꼈어요.
                </Text>
              </View>
            </View>

            {/* Carbon */}
            <View style={[styles.detailCard, { backgroundColor: "#f0fff3", borderColor: "#caf27a" }]}>
              <View style={styles.detailRow}>
                <View style={[styles.iconCircle, { borderColor: "#d8f8de" }]}>
                  <Feather name="wind" size={24} color="#4CAF50" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.detailTitle, { color: "#0b8a3d" }]}>절감한 탄소 {fmtCarbon(displayed.co2)}</Text>
                  <View style={[styles.eqBadge, { backgroundColor: "#0b8a3d", borderColor: "#0b8a3d" }]}>
                    <Text style={[styles.eqBadgeText, { color: "#fff" }]}>= 나무 {co2Eq}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.detailNote, {backgroundColor: '#dcfce7'}]}>
                <Text style={{ color: "#1b7a40" }}>
                  💡 어린 나무 5그루를 심는 효과가 있어요.
                </Text>
              </View>
            </View>
          </View>

          {/* Encouragement & share */}
          <View style={styles.encourageCard}>
            <Text style={{ fontSize: 36 }}>🎉</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 8 }}>정말 대단해요!</Text>
            <Text style={{ textAlign: "center", marginTop: 8, color: "#6b4b00" }}>
              {viewMode === "total" ? (
                "지금까지의 모든 노력이 지구를 더 건강하게 만들고 있어요. 앞으로도 보들이와 함께 환경을 지켜주세요! 🐶💚"
              ) : (
                `${selectedYear}년 ${monthsList[selectedMonthIndex]}에도 꾸준히 실천해주셔서 감사합니다. 앞으로도 보들이와 함께 환경을 지켜주세요! 🐶💚`
              )}
            </Text>

            <TouchableOpacity style={styles.shareButton} onPress={() => setShareVisible(true)}>
              <Feather name="share-2" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>나의 환경 임팩트 공유하기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* SHARE modal */}
      <Modal visible={shareVisible} transparent animationType="fade" onRequestClose={() => setShareVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>공유하기</Text>
            <View style={styles.shareRow}>
              <TouchableOpacity onPress={() => Alert.alert("Instagram", "공유 실행 (샘플)")}>
                <Text>📸 Instagram</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("카카오톡", "공유 실행 (샘플)")}>
                <Text>💬 카카오톡</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert("저장", "이미지 저장 (샘플)")}>
                <Text>⬇️ 저장</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShareVisible(false)}>
              <Text style={{ color: "#fff" }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CumulativeReportScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FFF4" },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 2,
    borderColor: "#DCE775",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerButton: {
    width: 40, height: 40, backgroundColor: "#DCEDC8", borderRadius: 20, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#4CAF50" },

  toggleContainer: { flexDirection: "row", marginTop: 16, paddingHorizontal: 16 },
  toggleButton: {
    flex: 1, paddingVertical: 10, backgroundColor: "#E8F5E9", borderRadius: 12, marginHorizontal: 4, alignItems: "center",
  },
  activeToggle: { backgroundColor: "#4CAF50" },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: "#4CAF50" },
  activeToggleLabel: { color: "#fff" },

  dropdown: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginTop: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#AED581"
  },
  dropdownItem: { backgroundColor: "#F1F8E9", padding: 10, marginTop: 4, borderRadius: 8 },
  dropdownLabel: { fontSize: 14, fontWeight: "600", color: "#4CAF50" },
  dropdownItemLabel: { fontSize: 14, color: "#4CAF50" },

  summaryCard: {
    backgroundColor: "#9ae600", margin: 16, padding: 18, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4,
  },
  summaryBadge: {
    alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 10,
  },
  summaryTitle: { fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 6 },
  summarySubtitle: { color: "#f6fff6", marginTop: 6, marginBottom: 12 },

  quickGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  quickBox: {
    flex: 1, marginHorizontal: 6, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  quickEmoji: { fontSize: 26 },
  quickLabel: { color: "#666", marginTop: 6 },
  quickValue: { fontSize: 18, fontWeight: "800", marginTop: 6 },

  detailContainer: { paddingHorizontal: 16, marginTop: 8 },
  detailCard: { borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1 },
  detailRow: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", borderWidth: 2, backgroundColor: "#fff" },
  detailTitle: { fontSize: 16, fontWeight: "700" },
  eqBadge: { marginTop: 8, alignSelf: "flex-start", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#eee" },
  eqBadgeText: { fontWeight: "700" },
  detailNote: { marginTop: 10, padding: 10, backgroundColor: "#fff", borderRadius: 10 },

  encourageCard: { margin: 16, borderRadius: 16, padding: 18, backgroundColor: "#fffbe6", alignItems: "center", borderWidth: 1, borderColor: "#f0e2b3" },
  shareButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#4CAF50", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginTop: 12 },

  modalBackground: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 12, padding: 18, width: "80%", alignItems: "center" },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  shareRow: { width: "100%", flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  closeButton: { backgroundColor: "#4CAF50", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }
});
