import React, { useState, useContext } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppContext } from './AppContext'

const topHabits = [
  { icon: "☕", title: "텀블러 사용하기", count: 28 },
  { icon: "♻️", title: "분리수거 실천하기", count: 22 },
  { icon: "🛍️", title: "장바구니 사용하기", count: 18 },
];

const ReportScreen = ({ navigation }) => {
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const { completedMissions } = useContext(AppContext);
  const { stats } = useContext(AppContext);

  const handleShare = (platform) => {
    Alert.alert(`${platform}으로 공유하기`, "공유 기능 실행!");
  };

  const handleDownload = () => {
    Alert.alert("다운로드", "이미지가 저장되었습니다!");
  };

  //level implementation
  

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="chevron-left" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🌍 환경 임팩트 리포트</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShareModalVisible(true)}
        >
          <Feather name="share-2" size={22} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Achievement Badge */}
        <View style={styles.card}>
          <Text style={styles.bigEmoji}>🏆</Text>
          <Text style={styles.cardTitle}>이번 달 환경 영웅</Text>
          <Text style={styles.cardSubtitle}>7일 연속 실천 중! 계속 이어나가보세요 💪</Text>
        </View>

        {/* Mission Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: "#E8F5E9" }]}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={styles.statLabel}>완료한 미션</Text>
            <Text style={styles.statValue}>{completedMissions.length}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#FFF9C4" }]}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statLabel}>연속 실천</Text>
            <Text style={styles.statValue}>7일</Text>
          </View>
        </View>

        {/* Environmental Impact */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>환경에 끼친 영향</Text>

          {/* Waste Reduced */}
          <View style={styles.impactBox}>
            <Text style={styles.impactLabel}>쓰레기 절감량</Text>
            <Text style={styles.impactValue}>{stats.totalWaste} kg</Text>
          </View>

          {/* Water Saved */}
          <View style={styles.impactBox}>
            <Text style={styles.impactLabel}>절약한 물</Text>
            <Text style={styles.impactValue}>{stats.totalWater} mL</Text>
          </View>

          {/* Carbon Reduced */}
          <View style={styles.impactBox}>
            <Text style={styles.impactLabel}>절감한 탄소</Text>
            <Text style={styles.impactValue}>{stats.totalCO2} g</Text>
          </View>
        </View>

        {/* Habit Changes */}
        {/* Habit Changes */}
<View style={styles.card}>
  <Text style={styles.sectionTitle}>나의 습관 변화</Text>

  {completedMissions.length > 0 ? (
    // Compute top 3 most frequent missions
    (() => {
      const freqMap = {};
      completedMissions.forEach((mission) => {
        freqMap[mission.mission] = (freqMap[mission.mission] || 0) + 1;
      });
      // Convert to array and sort
          const top3 = Object.entries(freqMap)
            .map(([mission, count]) => ({ mission, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

          return top3.map((habit, idx) => (
            <View key={idx} style={styles.habitRow}>
               <Feather name="check-circle" size={20} color="#4CAF50" />
              <View>
                <Text style={styles.habitTitle}>{habit.mission}</Text>
                <Text style={[styles.habitSubtitle, {textAlign: 'center'}]}>꾸준히 실천 중!</Text>
              </View>
               <Text style={styles.habitCount}>{habit.count} 회</Text>
            </View>
          ));
        })()
      ) : (
        <Text style={{ fontSize: 12, color: "#777", textAlign: "center" }}>미션을 완료해보세요</Text>
      )}
</View>


        {/* Dog Character */}
        <View style={{ alignItems: "center", marginVertical: 20 }}>
          <Image source={{ uri: "https://via.placeholder.com/80" }} 
                style={{ width: 64, height: 64, borderRadius: 32 }}
          />
        </View>
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>나의 환경 임팩트를 공유!</Text>
            <View style={styles.shareRow}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare("Instagram")}
              >
                <Text>📸</Text>
                <Text style={styles.shareLabel}>Instagram</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare("카카오톡")}
              >
                <Text>💬</Text>
                <Text style={styles.shareLabel}>카카오톡</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare("X")}
              >
                <Text>🐦</Text>
                <Text style={styles.shareLabel}>X</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleDownload}
              >
                <Text>⬇️</Text>
                <Text style={styles.shareLabel}>저장</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.shareButton, { marginTop: 20 }]}
              onPress={() => setShareModalVisible(false)}
            >
              <Text style={{ color: "#fff" }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FFF4" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 2,
    borderColor: "#DCE775",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#4CAF50" },
  headerButton: {
    width: 40,
    height: 40,
    backgroundColor: "#DCEDC8",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  card: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bigEmoji: { fontSize: 50, textAlign: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", textAlign: "center", marginVertical: 4 },
  cardSubtitle: { fontSize: 12, color: "#777", textAlign: "center" },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16 },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statEmoji: { fontSize: 30 },
  statLabel: { fontSize: 12, color: "#555", marginTop: 4 },
  statValue: { fontSize: 18, fontWeight: "700", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#4CAF50", marginBottom: 10 },
  impactBox: {
    backgroundColor: "#F1F8E9",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  impactLabel: { fontSize: 12, color: "#555" },
  impactValue: { fontSize: 14, color: "#4CAF50", fontWeight: "700" },
  habitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  habitIcon: { fontSize: 24 },
  habitTitle: { fontSize: 14, fontWeight: "600" },
  habitSubtitle: { fontSize: 10, color: "#555" },
  habitCount: { fontSize: 16, fontWeight: "800", color: "#4CAF50" },
  modalBackground: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "85%",
    alignItems: "center",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 20, color: "#4CAF50" },
  shareRow: { flexDirection: "row", justifyContent: "space-around", width: "100%" },
  shareButton: { alignItems: "center" },
  shareLabel: { fontSize: 10, color: "#555", marginTop: 4 },
});

export default ReportScreen
