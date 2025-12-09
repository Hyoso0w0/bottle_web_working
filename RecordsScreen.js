import React, { useState, useContext } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { AppContext } from "./AppContext";
import LevelSection from "./LevelSection";
import { levelStages } from "./data/levels"
import { signOut } from "firebase/auth";
import { auth } from "./firebase";



const RecordsScreen = ({ navigation }) => {
  const { completedMissions, stats } = useContext(AppContext);
  const [showCompleted, setShowCompleted] = useState(false);
  const handleLogout = async () => {
    try {
      await signOut(auth);          // ✅ Firebase에서 로그아웃
      // App.js에서 onAuthStateChanged로 로그인 상태를 보고
      // 로그인 안 된 상태면 자동으로 LoginScreen을 보여주도록 돼 있다면
      // 여기서 추가 네비게이션은 안 해도 돼!
      // 만약 직접 가고 싶으면 아래처럼도 가능
      // navigation.replace("Login");
    } catch (e) {
      console.log("로그아웃 실패: ", e);
    }
  };

  // -----------------🔥 1달 연속 체크 함수 -----------------
  const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

  const getMonthlySuccessCount = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // 이번 달에 해당하는 mission만 필터링
  const thisMonthMissions = completedMissions.filter(mis => {
    const d = mis.completedAt;
    if (!d) return false;

    const dateObj =
      typeof d === "object" && d.year !== undefined
        ? new Date(d.year, d.month, d.date)
        : new Date(d);

    return (
      dateObj.getFullYear() === y &&
      dateObj.getMonth() === m
    );
  });

  // 날짜별로 몇 개 미션을 했는지 집계
  const dailyCount = {};

  thisMonthMissions.forEach(mis => {
    const d = mis.completedAt;
    const dateObj =
      typeof d === "object" && d.year !== undefined
        ? new Date(d.year, d.month, d.date)
        : new Date(d);

    const dayKey = dateObj.getDate();

    dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;
  });

  // 하루에 3개 미션 완료한 날짜만 카운트
  let fullSuccessDays = 0;
  Object.values(dailyCount).forEach(count => {
    if (count >= 3) fullSuccessDays++;
  });

  return fullSuccessDays;
};
const fullSuccessDays = getMonthlySuccessCount();

const now = new Date();
const totalDays = getDaysInMonth(
  now.getFullYear(),
  now.getMonth()
);

const progress = Math.min(fullSuccessDays/totalDays, 1);

  

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.replace('Home')}
            style={styles.backButton}
          >
            <Feather name="chevron-left" size={22} color="#444" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>🌿 나의 대시보드</Text>

          {/* 🔥 오른쪽 끝에 로그아웃 텍스트 버튼 */}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.profileImage}>
              <Image
                  source={require("./assets/default_profile_picture.png")}
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                />
            </View>

            <View style={styles.userInfo}>
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>🌈</Text>
                <Text style={styles.badgeText}>Lvl.19 제로웨이스트 미션 마스터</Text>
              </View>
              <Text style={styles.username}>이그린님</Text>
            </View>

            {/* Settings */}
            <TouchableOpacity
              onPress={() => onNavigate("settings")}
              style={styles.settingsButton}
            >
              <Feather name="settings" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Progress */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={styles.progressLeft}>
                <Text style={styles.progressIcon}>🎯</Text>
                <Text style={styles.progressLabel}>이번 달 실천율</Text>
              </View>

              <View style={styles.progressPercentBox}>
                <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
              </View>
            </View>

            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>

            {/* Cookies */}

        </View>

        {/* Navigation Icons */}

        {/* Completed Missions List (Toggle) */}
        {showCompleted && (
          <View style={[styles.completedContainer, {marginBottom: 10}]}>
            <Text style={styles.completedTitle}>🎉 완료한 미션</Text>

            {completedMissions.length === 0 ? (
              <Text style={styles.noMissions}>아직 완료한 미션이 없어요!</Text>
            ) : (
              completedMissions.map((mission, index) => (
                <View key={index} style={styles.completedItem}>
                  <Feather name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.completedText}>{mission.mission}</Text>
                </View>
              ))
            )}
          </View>
        )}
        <View style={styles.statistics_card}>
           <Text style={styles.statistics_title}> 나의 환경 절약 기록</Text>
          <View style={styles.statistics_card_water}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View
                  style={[styles.statistics_circle, { backgroundColor: "#dbeafe", borderColor: "#90e3ffff", borderWidth: 2 }]}
                >
                  <Text style={styles.statistics_icon}>💧</Text>
                </View>
                <View>
                  <Text style={[styles.statistics_value, {marginLeft: 10}, {marginTop: 10}, {fontWeight: 700}, {color: '#3B82F6'}]}> 물 절약 미션 {Math.round(stats.totalWater)/1000} L</Text>
                  <View style={
                    [styles.button, {
                    backgroundColor: '#60A5FA',
                    borderRadius: 15,
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    marginLeft: 10,
                    alignSelf: 'flex-start',
                    
                    }]}>
                      <Text style={{fontWeight: 700, color: '#fff', fontSize: 12,}}>
                       = 샤워 {Math.floor(stats.totalWater / 60000)} 회분
                      </Text>
                    </View>
                </View>
              
            </View>
              <LevelSection
                label="물 절약 미션"
                emoji="💧"
                unit="L"
                value={stats.totalWater/1000}
                stages={levelStages.water}
              />
          </View>
          <View style={styles.statistics_card_waste}>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View
                  style={[styles.statistics_circle, { backgroundColor: "#ffedd4", borderColor: "#ff9e61ff", borderWidth: 2 }]}
                >
                  <Text style={styles.statistics_icon}>🗑️</Text>
                </View>
              <View>
                < Text style={[styles.statistics_value, {marginLeft: 10}, {marginTop: 10}, {fontWeight: 700}, {color: '#fb7324ff'}]}>쓰레기 절감 미션 {stats.totalWaste}kg</Text>
                <View style={
                [styles.button, {
                backgroundColor: '#fb7324ff',
                borderRadius: 15,
                padding: 10,
                marginLeft: 10,
                alignSelf: 'flex-start',
                }]}> 
                  <Text style={{fontWeight: 700, color: '#fff', fontSize: 12,}}>
                  = 일회용컵 {Math.floor(stats.totalWaste * 100)} 개
                  </Text>
                </View>
              </View>
            </View>
            <LevelSection
              label="쓰레기 절감 미션"
              emoji="🗑️"
              unit="kg"
              value={stats.totalWaste}
              stages={levelStages.waste}
            />
          </View>
          <View style={styles.statistics_card_co2}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View
                  style={[styles.statistics_circle, { backgroundColor: "#dcfce7", borderColor: "#81f77bff", borderWidth: 2 }]}
                >
                  <Text style={styles.statistics_icon}>🌳</Text>
                </View>
                <View>
                  <Text style={[styles.statistics_value, {marginLeft: 10}, {marginTop: 10}, {fontWeight: 700}, {color: '#22C55E'}]}>탄소 절감 미션 {stats.totalCO2} g</Text>
                  <View style={
                  [styles.button, {
                  backgroundColor: '#4ADE80',
                  borderRadius: 15,
                  padding: 10,
                  marginLeft: 10,
                  alignSelf: 'flex-start',
                  }]}> 
                    <Text style={{fontWeight: 700, color: '#fff', fontSize: 12,}}>
                    = 나무 {Math.floor(stats.totalCO2 / 1000)} 개
                    </Text>
                  </View>
                </View>
            </View>
               <LevelSection
                label="탄소 절감 미션"
                emoji="🌳"
                unit="g"
                value={stats.totalCO2}
                stages={levelStages.carbon}
              />
          </View>
        </View>

        <View>
          <View style={[styles.statistics_card, {marginTop: 10, marginBottom: 10}]}>
            <Text style={[styles.statistics_title, {marginBottom: 10}]}> 📈 나의 습관 변화</Text>
            <Text style={[{fontSize: 17}, {color: '#666'}, {marginBottom: 15}]}> 가장 많이 완료한 미션 Top 3</Text>
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
                    <View key={idx} style={[styles.statistics_card, { 
                      flexDirection: "row", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      marginBottom: 8, 
                      backgroundColor: '#f7fee7',
                      borderWidth: 2, }]}>
                        <View
                          style={[styles.statistics_circle, { backgroundColor: "#fff", borderColor: "#81f77bff", borderWidth: 2 }]}
                        >
                          <Text style={styles.habitIcon}>🌳</Text>
                        </View>
                        <View style={{ flexDirection: 'column' }}>
                          <Text style={[styles.habitTitle, { fontSize: 16, fontWeight: "600" }]}>{habit.mission}</Text>
                          <Text style={[styles.habitSubtitle, {textAlign: 'center'}]}>꾸준히 실천 중!</Text>
                        </View>
                       <Feather name="check-circle" size={20} color="#4CAF50" />
                      <Text style={styles.habitCount}>{habit.count}회</Text>
                    </View>
                  ));
                })()
              ) : (
                <Text style={{ fontSize: 12, color: "#777", textAlign: "center" }}>미션을 완료해보세요</Text>
              )}
              </View>
        </View> 
        
        <View 
        style={[
          styles.statistics_card, {
            borderWidth: 1,
            borderColor: '#d8f999',
            padding: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
        }]}>
          <Text style={{fontSize: 20}}>📊</Text>
          <View style={{ flex: 1, marginLeft: 10, marginRight: 10 }}>
            <Text style={[{ fontSize: 17, fontWeight: 600, color: '#616161' }]}>지금까지 보들보틀과 함께 줄인 쓰레기 양은?</Text>
          </View>
          <TouchableOpacity
              onPress={() => navigation.navigate('CumulativeReport')}
            >
              <View
                style={[styles.button]}
              >
                <Text style={{fontSize: 15, fontWeight: 600, color: '#fff'}}>확인하기</Text>
              </View>
            </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.bottomButton}
        >
          <Feather name="bell" size={22} color="#666" />
          <Text style={styles.bottomLabel}>알림</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.bottomHome}
        >
          <Feather name="home" size={26} color="#666" />
          <Text style={styles.bottomLabel}>홈</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Records')}
          style={styles.bottomButton}
        >
          <Feather name="user" size={22} color="#4CAF50" />
          <Text style={[styles.bottomLabel, { color: "#4CAF50" }]}>마이</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------------------------------------- */
/*                 STYLES                  */
/* ---------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FFF4",
  },
  scrollArea: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  backButton: {
    padding: 6,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
  },

  /* Profile */
  profileCard: {
    backgroundColor: "#9ae600",
    margin: 16,
    padding: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  badgeIcon: { fontSize: 14 },
  badgeText: { fontSize: 12, marginLeft: 4, color: "#4CAF50" },

  username: { fontSize: 25, fontWeight: "600", marginTop: 5, color: "#fff" },

  settingsButton: {
    backgroundColor: "#4CAF50",
    padding: 8,
    borderRadius: 12,
  },

  /* Progress */
  progressCard: { 
    marginTop: 16,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#b3ec40',
    borderColor: '#caf27a',
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
   },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLeft: { flexDirection: "row", alignItems: "center" },
  progressIcon: { fontSize: 18, marginRight: 6 },
  progressLabel: { fontSize: 16, fontWeight: "600", color: "#ffffffff" },

  progressPercentBox: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  progressPercent: { color: "#4CAF50", fontWeight: "700" },

  progressBarBackground: {
    backgroundColor: "#E0E0E0",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 6,
  },
  progressEmoji: {
    position: "absolute",
    right: -4,
    top: -18,
    fontSize: 18,
  },

  /* Navigation Grid */
  navGridCard: {
    marginHorizontal: 16,
    marginTop: 6,
  },
  navGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  navButton: {
    alignItems: "center",
    width: "33%",
  },
  navIconCircle: {
    width: 70,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 35,
    marginBottom: 8,
  },
  navText: { fontSize: 14, color: "#444" },

  /* Stats */
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    margin: 16,
  },
  statBoxYellow: {
    backgroundColor: "#FFF9C4",
    padding: 16,
    width: "48%",
    borderRadius: 16,
  },
  statBoxGreen: {
    backgroundColor: "#E8F5E9",
    padding: 16,
    width: "48%",
    borderRadius: 16,
  },
  statLabel: { fontSize: 14, color: "#555" },
  statValue: { fontSize: 20, fontWeight: "700", marginTop: 8 },

  /* Completed Missions */
  completedContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  completedItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  completedText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#333",
  },
  noMissions: {
    fontSize: 15,
    color: "#777",
    textAlign: "center",
    paddingVertical: 8,
  },

  /* Bottom Nav */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  bottomButton: { alignItems: "center" },
  bottomLabel: { fontSize: 12, color: "#666", marginTop: 2 },
  bottomHome: { alignItems: "center" },
  statistics_container: {
    padding: 20,
    paddingBottom: 40,
  },
  statistics_title: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  statistics_card: {
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 15,
    borderRadius: 16,
    padding: 20,
    borderColor: "#cdf78d",
    borderWidth: 1,
    backgroundColor: "#fff",
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statistics_card_waste: {
    borderRadius: 10,
    borderColor: "#d8f999",
    borderWidth: 2,
    padding: 10,
    backgroundColor: '#fff7ed',
    marginTop: 5,
    marginBottom: 5,
  },
  statistics_card_water: {
    borderRadius: 10,
    borderColor: "#d8f999",
    borderWidth: 2,
    padding: 10,
    backgroundColor: '#eff6ff',
    marginTop: 5,
    marginBottom: 5,
  },
  statistics_card_co2: {
    borderRadius: 10,
    borderColor: '#d8f999',
    borderWidth: 2,
    padding: 10,
    backgroundColor: '#f0fdf4',
    marginTop: 5,
    marginBottom: 5,
  },
  statistics_value: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  statistics_circle: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 35,
    marginBottom: 8,
  },
  statistics_icon: {
    fontSize: 15,
    fontWeight: "600",
  },
  statistics_mission_text: {
    fontSize: 15,
    fontWeight: 600,
  },
  cookieCard: {
    borderRadius: 10,
    backgroundColor: '#f1d4a5ff',
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
  },
  cookieText: {
    fontWeight: "600",
    fontSize: 15,
    color: '#8b5f36ff',
  },
  logoutButton: {
  marginLeft: "auto",
  paddingHorizontal: 10,
  paddingVertical: 4,
},

logoutText: {
  fontSize: 14,
  color: "#444",
  fontWeight: "600",
},
button: {
  borderRadius: 12,
  paddingVertical: 10,
  paddingHorizontal: 14,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#9ae600',
},
habitCount: { fontSize: 16, fontWeight: "600", color: "#4CAF50" },
habitTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4, },
habitSubtitle: { fontSize: 12, color: "#555" },
habitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
habitIcon: { fontSize: 22 },
});

export default RecordsScreen
