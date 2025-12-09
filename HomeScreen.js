// HomeScreen.js
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState, useContext, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import TreeForest from './TreeForest';
import * as Notifications from 'expo-notifications';
import { LOCAL_NOTIFICATION_CHANNEL_ID } from './localNotifications';
import { AppContext } from "./AppContext";
import { missions } from "./data/missions";
import { Alert } from "react-native" 
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { auth } from "./firebase";
import { saveMissionCompletion, loadAlarmsForUser, updateAlarmCompletion } from "./firestoreHelpers";
import { useIsFocused } from '@react-navigation/native'; // add to imports



const getTimeSlot = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
};

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const getDaysInMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const getFirstDayOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
};

const formatYearMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}년 ${month}월`;
};

const isSameDay = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const isToday = (date) => {
  return isSameDay(date, new Date());
};


const recommendedByTime = {
  morning: ['물 1컵 마시기', '가벼운 스트레칭 5분', '감사 3줄 적기'],
  afternoon: ['가볍게 산책 10분', '눈 휴식 3분', '책 5쪽 읽기'],
  evening: ['하루 회고 3줄', '방 정리 5분', '명상 3분'],
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];


const HomeScreen = ({ navigation }) => {
  const [selectedMission, setSelectedMission] = useState('물 1컵 마시기'); // 🔹 key와 맞추기
  //const [completed, setCompleted] = useState(0);
  const { completedMissions, setCompletedMissions, addCompletedMission, alarms, setAlarms, cookies, cookieStats, addCompletedAlarms } = useContext(AppContext);
  
  // 🎯 오늘의 미션 3개 상태
  const [dailyMissions, setDailyMissions] = useState([]);
  const [completedDailyIds, setCompletedDailyIds] = useState([]);

   const saveAlarmsToStorage = async (list) => {
    try {
      await AsyncStorage.setItem("@bottle_alarms", JSON.stringify(list));
    } catch (e) {
      console.log("AsyncStorage 저장 오류:", e);
    }
  };

  // 🔥 HomeScreen 진입 시 Firestore에서 알림 불러오기
useEffect(() => {
  const bootstrapFromFirestore = async () => {
    try {
      // 이미 context에 알람이 있으면 굳이 다시 안 불러옴
      if (alarms && alarms.length > 0) {
        console.log("✅ HomeScreen: 이미 context에 알람 있음, Firestore 호출 생략");
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        console.log("⚠️ HomeScreen: 로그인 유저 없음, 알람 로드 생략");
        return;
      }

      console.log("🔄 HomeScreen: Firestore에서 알람 로드 시도:", user.uid);

      // loadAlarmsForUser는 Firestore에서 alarms 배열을 리턴한다고 가정
      const loadedAlarms = await loadAlarmsForUser(user.uid);

      console.log("✅ HomeScreen: Firestore에서 불러온 알람:", loadedAlarms);

      if (Array.isArray(loadedAlarms)) {
        setAlarms(loadedAlarms); // ➜ AppContext 업데이트
      }
    } catch (e) {
      console.log("🔥 HomeScreen Firestore 알람 로드 오류:", e);
    }
  };

  bootstrapFromFirestore();
}, []); // HomeScreen 처음 마운트될 때 한 번만

 //helper that detects whether alarm applies today
  const isAlarmToday = (alarm) => {
  if (!alarm.enabled) return false;

  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();      // 0-based
  const todayD = now.getDate();
  const dayOfWeek = now.getDay();     // 0 = Sun ~ 6 = Sat

  // 요일 반복 알림 (repeatDays: [0~6])
  if (Array.isArray(alarm.repeatDays) && alarm.repeatDays.length > 0) {
    return alarm.repeatDays.includes(dayOfWeek);
  }

  // 그 외는 오늘 알림 아님
  return false;
};

// 🔔 context의 alarms를 기준으로 "오늘 알림"만 계산
const todayAlarms = useMemo(() => {
  console.log("🔍 HomeScreen에서 받은 alarms:", alarms);

  if (!Array.isArray(alarms) || alarms.length === 0) {
    return [];
  }

  const todayActive = alarms.filter(isAlarmToday);
  console.log("🟢 오늘 기준 필터된 알람:", todayActive);

  return todayActive;
}, [alarms]);

  const completeTask = async (alarmId) => {
    const now = new Date();
    const today = now.toISOString().split("T")[0]; // "2025-11-26"
    const user = auth.currentUser;

    const updated = alarms.map(a => {
      if (a.id !== alarmId) return a;
      if (a.completedDates?.includes(today)) return a;

      addCompletedAlarms(a);

      return {
        ...a,
        completedDates: [...(a.completedDates || []), today],
      };
    });

    setAlarms(updated);
     // update local cache
  try {
    await AsyncStorage.setItem("@bottle_alarms", JSON.stringify(updated));
    // update cache-date so Home won't reload mid-day
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    await AsyncStorage.setItem("@bottle_alarms_date", todayStr);
  } catch (e) {
    console.warn("AsyncStorage 저장 오류:", e);
  }

  // persist to Firestore on the same path as saveAlarmsForUser
  if (user) {
    await updateAlarmCompletion(user.uid, updated); // this now writes to meta/alarms
  }
  };


  // 🌳 나무 배열 상태
  const [forestTrees, setForestTrees] = useState(() => {
  return completedMissions.flatMap(m => {
    return Array.from({ length: m.trees || 1 }).map((_, idx) => ({
      id: `${m.id}-${idx}`,
      emoji: m.emoji || '🌳',
    }));
  });
});
  // 📝 완료 미션 기록
  const timeSlot = getTimeSlot();
  const [recommendVisible, setRecommendVisible] = useState(false);
  const recommendedMission = useMemo(
    () => pickRandom(recommendedByTime[timeSlot]),
    [timeSlot]
  );
 // 🔽🔽🔽 여기부터 달력 관련 상태 & 함수 추가 🔽🔽🔽
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  // 특정 날짜에 완료한 미션 수 계산
  const getMissionCountForDate = useCallback(
  (date) => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    return completedMissions.filter((mission) => {
      if (!mission) return false;

      const completedAt = mission.completedAt;

      // 📌 mission 텍스트가 없는 이상한 데이터는 카운트에서 제외
      if (!mission.mission) return false;
      if (!completedAt) return false;

      // 로컬 객체 형태인 경우
      if (typeof completedAt === 'object' && completedAt.year !== undefined) {
        return (
          completedAt.year === targetYear &&
          completedAt.month === targetMonth &&
          completedAt.date === targetDay
        );
      }

      // 혹시 ISO 문자열로 저장된 과거 데이터도 처리
      const missionDate = new Date(completedAt);
      if (Number.isNaN(missionDate.getTime())) return false;

      return (
        missionDate.getFullYear() === targetYear &&
        missionDate.getMonth() === targetMonth &&
        missionDate.getDate() === targetDay
      );
    }).length;
  },
  [completedMissions]
);

  // 미션 수에 따른 초록색 강도 계산
  const getGreenBackgroundColor = (missionCount) => {
    if (missionCount === 0) return null;

    const maxMissions = 5;
    const intensity = Math.min(missionCount / maxMissions, 1);

    const lightGreen = { r: 220, g: 252, b: 231 }; // #dcfce7
    const darkGreen = { r: 22, g: 163, b: 74 }; // #16a34a

    const r = Math.round(lightGreen.r + (darkGreen.r - lightGreen.r) * intensity);
    const g = Math.round(lightGreen.g + (darkGreen.g - lightGreen.g) * intensity);
    const b = Math.round(lightGreen.b + (darkGreen.b - lightGreen.b) * intensity);

    return `rgb(${r}, ${g}, ${b})`;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleDateSelect = (day) => {
    const newDate = new Date(year, month, day);
    setSelectedDate(newDate);

    const data = getMissionsForSelectedDate(newDate);
  
    setPopupData({
      missions: data.missions,
      totals: data.totals,
      date: newDate,
    });

    setPopupVisible(true);
  };

  const renderCalendarDays = () => {
    const days = [];
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    // 요일 헤더
    const weekDayHeaders = weekDays.map((day, index) => (
      <View key={`header-${index}`} style={styles.weekDayHeader}>
        <Text
          style={[
            styles.weekDayText,
            index === 0 && styles.sundayText,
            index === 6 && styles.saturdayText,
          ]}
        >
          {day}
        </Text>
      </View>
    ));

    // 첫 주 앞쪽 빈 칸
    const emptyDays = [];
    for (let i = 0; i < firstDay; i++) {
      emptyDays.push(
        <View key={`empty-${i}`} style={styles.dayCell}>
          <Text style={styles.emptyDayText}></Text>
        </View>
      );
    }

    // 실제 날짜 셀
    const dateCells = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = isSameDay(date, selectedDate);
      const isTodayDate = isToday(date);
      const missionCount = getMissionCountForDate(date);
      const greenBackgroundColor = getGreenBackgroundColor(missionCount);

      dateCells.push(
        <TouchableOpacity
          key={`day-${day}`}
          style={[
            styles.dayCell,
            isSelected && styles.selectedDayCell,
            isTodayDate && !isSelected && styles.todayCell,
            !isSelected && greenBackgroundColor && { backgroundColor: greenBackgroundColor },
          ]}
          onPress={() => handleDateSelect(day)}
        >
          <Text
            style={[
              styles.dayText,
              isSelected && styles.selectedDayText,
              isTodayDate && !isSelected && styles.todayText,
              (firstDay + day - 1) % 7 === 0 && styles.sundayText,
              (firstDay + day - 1) % 7 === 6 && styles.saturdayText,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    const allDays = [...emptyDays, ...dateCells];

    // 마지막 주도 7칸 맞추기
    const totalCells = allDays.length;
    const remainingCells = totalCells % 7;
    if (remainingCells > 0) {
      const emptyCellsNeeded = 7 - remainingCells;
      for (let i = 0; i < emptyCellsNeeded; i++) {
        allDays.push(
          <View key={`empty-end-${i}`} style={styles.dayCell}>
            <Text style={styles.emptyDayText}></Text>
          </View>
        );
      }
    }

    const weeks = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(
        <View key={`week-${i}`} style={styles.weekRow}>
          {allDays.slice(i, i + 7)}
        </View>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.weekDayRow}>{weekDayHeaders}</View>
        {weeks}
      </View>
    );
  };
  // 🔼🔼🔼 달력 관련 끝 🔼🔼🔼
  
  // ✅ 미션별 나무/식물 아이콘 정의 (통일감 있게)
  const missionConfigs = {
    '물 1컵 마시기': {
      trees: 1,
      emoji: '🌱',
    },
    '가벼운 스트레칭 5분': {
      trees: 2,
      emoji: '🌲',
    },
    '감사 3줄 적기': {
      trees: 1,
      emoji: '🌼',
    },
    '가볍게 산책 10분': {
      trees: 2,
      emoji: '🌳',
    },
    '눈 휴식 3분': {
      trees: 1,
      emoji: '🌾',
    },
    '책 5쪽 읽기': {
      trees: 2,
      emoji: '🌿',
    },
    '하루 회고 3줄': {
      trees: 1,
      emoji: '🍂',
    },
    '방 정리 5분': {
      trees: 2,
      emoji: '🪴',
    },
    '명상 3분': {
      trees: 1,
      emoji: '🪷',
    },
  };

  // ✅ 미션 완료 시: 기록 + 나무 추가
  const completeMission = () => {
    //setCompleted((c) => c + 1);

    const config = missionConfigs[selectedMission] || {
      trees: 1,
      emoji: '🌳',
    };

    // 나무 추가
    setForestTrees((prev) => {
      const maxTrees = 30;
      const remainingSlots = maxTrees - prev.length;
      if (remainingSlots <= 0) return prev;

      const treeCountToAdd = Math.min(config.trees, remainingSlots);

      const newTrees = Array.from({ length: treeCountToAdd }).map((_, idx) => ({
        id: `${Date.now()}-${idx}`,
        emoji: config.emoji || '🌳',
      }));

      return [...prev, ...newTrees];
    });

    // 🔹 미션 기록 추가 (로컬 시간 기준으로 저장)
    const now = new Date();
    // 로컬 시간 기준으로 연/월/일/시/분/초를 저장 (타임존 문제 방지)
    const localTime = {
      year: now.getFullYear(),
      month: now.getMonth(),
      date: now.getDate(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds(),
      timestamp: now.getTime(), // 정렬용
    };
    setCompletedMissions((prev) => [
      {
        id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
        mission: selectedMission,
        completedAt: localTime, // ISO 문자열 대신 로컬 시간 객체 사용
        timeSlot,
        emoji: config.emoji || '🌳',
      },
      ...prev,
    ]);

    setRecommendVisible(true);
  };


// 앱 실행 시 오늘의 미션 3개 추출
useEffect(() => {
  const shuffled = [...missions].sort(() => Math.random() - 0.5);
  setDailyMissions(shuffled.slice(0, 3));
}, []);
//미션 바꾸기 함수
const replaceMission = async (index) => {
  const usedIds = dailyMissions.map(m => m.id);
  const candidates = missions.filter(m => !usedIds.includes(m.id));

  if (candidates.length === 0) return;

  const newMission = candidates[Math.floor(Math.random() * candidates.length)];

  const newList = [...dailyMissions];
  newList[index] = newMission;
  
  setDailyMissions(newList);
  await AsyncStorage.setItem("dailyMissions", JSON.stringify(newList));
};


useEffect(() => {
  const loadCompleted = async () => {
    const stored = await AsyncStorage.getItem("completedDailyIds");
    if (stored) {
      setCompletedDailyIds(JSON.parse(stored));
    }
  };

  loadCompleted();
}, []);
//미션 저장
useEffect(() => {
  const loadDaily = async () => {
    const today = getToday();
    const storedDate = await AsyncStorage.getItem("dailyDate");
    const storedMissions = await AsyncStorage.getItem("dailyMissions");
    const storedCompleted = await AsyncStorage.getItem("completedDailyIds");

    // If it's the same day → load everything as-is
    if (storedDate === today && storedMissions) {
      setDailyMissions(JSON.parse(storedMissions));
      if (storedCompleted) {
        setCompletedDailyIds(JSON.parse(storedCompleted));
      }
      return;
    }

    // If date changed → generate NEW missions
    const shuffled = [...missions].sort(() => Math.random() - 0.5);
    const todayMissions = shuffled.slice(0, 3);

    setDailyMissions(todayMissions);
    setCompletedDailyIds([]);

    await AsyncStorage.setItem("dailyMissions", JSON.stringify(todayMissions));
    await AsyncStorage.setItem("completedDailyIds", JSON.stringify([]));
    await AsyncStorage.setItem("dailyDate", today);
  };

  loadDaily();
}, []);

const completeDailyMission = async (mission) => {
  Alert.alert(
    "미션 확인",
    "정말로 이 미션을 완료하셨나요?",
    [
      { text: "취소", style: "cancel" },
      {
        text: "네!",
        onPress: async () => {
          const now = new Date();
          const localTime = {
            year: now.getFullYear(),
            month: now.getMonth(),
            date: now.getDate(),
            hours: now.getHours(),
            minutes: now.getMinutes(),
            seconds: now.getSeconds(),
            timestamp: now.getTime(),
          };

          // 1) AppContext 로컬 상태 업데이트
          addCompletedMission({
            id: `${now.getTime()}-${Math.random()}`,
            mission: mission.name,
            completedAt: localTime,
            timeSlot,
            emoji: "🌱",
            water: mission.water,
            waste: mission.waste,
            co2: mission.co2,
          });
          
           // 2) Firestore에 사용자별 완료 기록 + 통계 저장
          await saveMissionCompletion(mission, localTime, timeSlot);
          
          const updated = [...completedDailyIds, mission.id];
          setCompletedDailyIds(updated);

          // SAVE CORRECTLY
          await AsyncStorage.setItem(
            "completedDailyIds",
            JSON.stringify(updated)
          );
        },
      },
    ]
  );
};

//캘린더 날짜 누르면 자세한 정보 나오는 기능
const [popupVisible, setPopupVisible] = useState(false);
const [popupData, setPopupData] = useState({
  missions: [],
  totals: { water: 0, waste: 0, co2: 0 },
  date: null,
});

const getMissionsForSelectedDate = (date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  // 1) 해당 날짜 + mission 텍스트가 있는 데이터만 남긴다
  const missionsOfDay = completedMissions.filter((item) => {
    if (!item) return false;

    const c = item.completedAt;
    // mission 텍스트 없는 이상한 데이터 제거
    if (!item.mission) return false;
    if (!c) return false;

    // 로컬 time 객체 형태
    if (typeof c === 'object' && c.year !== undefined) {
      return c.year === y && c.month === m && c.date === d;
    }

    // 혹시 문자열일 수도 있으니 방어적으로 처리
    const missionDate = new Date(c);
    if (Number.isNaN(missionDate.getTime())) return false;

    return (
      missionDate.getFullYear() === y &&
      missionDate.getMonth() === m &&
      missionDate.getDate() === d
    );
  });

  // 2) 총합 계산
  let totals = { water: 0, waste: 0, co2: 0 };

  missionsOfDay.forEach((m) => {
    totals.water += m.water || 0;
    totals.waste += m.waste || 0;
    totals.co2 += m.co2 || 0;
  });

  return { missions: missionsOfDay, totals };
};

// -----------------🔥 7일 연속 체크 함수 -----------------
const getConsecutiveStreak = () => {
  // completedMissions의 날짜만 뽑기
  const completedDates = completedMissions.map(m => {
    const d = m.completedAt;
    if (!d) return null;

    // 로컬 객체 형태
    if (typeof d === "object" && d.year !== undefined) {
      return new Date(d.year, d.month, d.date);
    }

    // 혹시 문자열 형식이면
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  }).filter(Boolean);

  if (completedDates.length === 0) return 0;

  // 날짜만 추출하고 중복 제거
  const uniqueDays = [
    ...new Set(completedDates.map(d => d.toDateString()))
  ].map(str => new Date(str));

  // 최신 날짜부터 정렬
  uniqueDays.sort((a, b) => b - a);

  let streak = 0;
  let current = new Date(); // 오늘부터

  for (let i = 0; i < uniqueDays.length; i++) {
    const d = uniqueDays[i];

    if (
      d.getFullYear() === current.getFullYear() &&
      d.getMonth() === current.getMonth() &&
      d.getDate() === current.getDate()
    ) {
      streak++;
      // 다음 체크할 날짜(어제)
      current.setDate(current.getDate() - 1);
    } else {
      break; // 연속이 끊기면 종료
    }
  }

  return streak;
};

// -----------------🔥 Progress % 계산 -----------------
const streak = getConsecutiveStreak();
const progress = Math.min(streak / 7, 1); // 0~1

//only reload alarms when day changes
const isFocused = useIsFocused();

useEffect(() => {
  const checkAndMaybeReloadAlarms = async () => {
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      const cachedDate = await AsyncStorage.getItem("@bottle_alarms_date");

      if (cachedDate === today) {
        // same day — do nothing, keep current context alarms
        console.log("Home focus: alarms cache date matches today, skip reload");
        return;
      }

      // date changed (or no cache) → reload from Firestore (or AsyncStorage fallback)
      console.log("Home focus: alarms cache date different or missing — reloading alarms");
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in, skip loading alarms");
        return;
      }
      const loaded = await loadAlarmsForUser(user.uid);
      if (Array.isArray(loaded)) {
        setAlarms(loaded);
        // also cache locally
        await AsyncStorage.setItem("@bottle_alarms", JSON.stringify(loaded));
        await AsyncStorage.setItem("@bottle_alarms_date", today);
      } else {
        // fallback: try async storage
        const stored = await AsyncStorage.getItem("@bottle_alarms");
        if (stored) {
          const parsed = JSON.parse(stored);
          setAlarms(parsed);
          await AsyncStorage.setItem("@bottle_alarms_date", today);
        } else {
          // nothing to load
          console.log("No alarms in Firestore nor AsyncStorage");
        }
      }
    } catch (e) {
      console.warn("Error in checkAndMaybeReloadAlarms:", e);
    }
  };

  if (isFocused) {
    checkAndMaybeReloadAlarms();
  }
}, [isFocused]); // runs when screen becomes focused



  return (
    <View style={{flex: 1}}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* 🔥 7일 연속 달성 Progress Bar */}
        <View style={{ marginTop: 5, marginBottom: 20}}>
          <View style={{  
            marginBottom: 10, 
            backgroundColor: '#eeffc5ff', 
            paddingVertical: 5, 
            paddingHorizontal: 10, 
            alignSelf: 'flex-start', 
            borderRadius: 20, 
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#86d28aff',
            }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#2E7D32' }}>
              🔥 7일 연속 미션 달성
            </Text>
          </View>

          {/* Progress Bar 배경 */}
          <View style={{
            width: '100%',
            height: 18,
            backgroundColor: '#E0E0E0',
            borderRadius: 20, 
            overflow: 'hidden'
          }}>
            {/* Progress 채워지는 부분 */}
            <View style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: '#66BB6A',
            }} />
          </View>

          <Text style={{ marginTop: 5, color: '#4CAF50', fontWeight: '600' }}>
            {streak >= 7
              ? "7일 연속 성공! 🌟"
              : `${streak}일 연속 달성 중`}
          </Text>
        </View>


          {/* 달력 (성과 시각화) */}
        <View style={[styles.card, {borderWidth: 1, borderColor: '#64DD17'}]}>
          {/* 달력 헤더 (월 이동 / 오늘 버튼) */}
          <View style={styles.header}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={[styles.monthYearText, {color: '#558B2F'}]}>{formatYearMonth(currentDate)}</Text>
              <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
                <Text style={styles.todayButtonText}>오늘</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* 달력 그리드 */}
          {renderCalendarDays()}

          {/* 선택된 날짜 정보 */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.cardHeader}>선택된 날짜</Text>
            <Text style={styles.selectedDateText}>
              {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일
            </Text>
            <Text style={styles.selectedDateSubtext}>
              {['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]}요일
            </Text>
            <Text style={styles.missionCountText}>
              완료한 미션: {getMissionCountForDate(selectedDate)}개
            </Text>
          </View>
        </View>
        
        {/* 알람 확인하기 버튼 */}
        <View style={[styles.card]}>
          <Text style={{fontWeight: 800, fontSize: 20, marginTop: 10, marginBottom: 10, color: '#27AE60'}}>🔔 오늘의 알림 목록</Text>

          {todayAlarms.length === 0 ? (
          <Text style={{ color: '#aaa', marginTop: 10 }}>
            오늘은 예정된 미션이 없어요 🌱
          </Text>
          ) : (
            todayAlarms.map((alarm) => {
              const now = new Date();
              const today = now.toISOString().split("T")[0];
              const alreadyCompleted = alarm.completedDates?.includes(today);

              return (
                <View
                  key={alarm.id}
                  style={[styles.alarmCard, {
                    padding: 16,
                    marginVertical: 8,
                    backgroundColor: "white",
                    borderRadius: 12,
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                  }]}
                >
                  <View style={{flexDirection: 'row'}}>
                    <Text style={{ fontSize: 16, fontWeight: "600" }}>
                      {alarm.message}
                    </Text>
                    <View style={[styles.missionTags, { backgroundColor: '#FFF59D', marginLeft: 'auto'}]}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: '#F57F17' }}>🔔 알림</Text>
                    </View>
                  </View>

                  <Text style={{ color: "#666", marginTop: 4 }}>
                    ⏰ {alarm.ampm} {alarm.hour}:{alarm.minute.toString().padStart(2, '0')}
                  </Text>

                  {!alreadyCompleted ? (
                    <TouchableOpacity
                      onPress={() => completeTask(alarm.id)}
                      style={[styles.btn,
                        {
                        borderColor: "#64DD17",
                        borderWidth: 2,
                        marginTop: 12,
                        alignSelf: "flex-end",
                      }]}
                    >
                      <Text style={{ color: "#64DD17", fontWeight: "600", marginLeft: 5, marginRight: 5 }}>실천완료</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{flexDirection: 'row'}}>
                      <View style={{flex: 1}}>
                        <Text style={{ marginTop: 10, color: "#4CAF50", fontWeight: "700", alignSelf: 'flex-end', fontSize: 15 }}>
                          ✅ 완료됨
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      
        {/* 오늘의 추가 미션 */}
        <View style={[styles.card, {marginTop: 20}]}>
          <Text style={[styles.cardHeader, {fontSize: 20, color: '#27AE60'}]}>✨ 오늘의 추가 미션</Text>
          {dailyMissions.map((m, index) => {
          const isDone = completedDailyIds.includes(m.id);
            return (
            
              <View 
              key={m.id}
              style={[styles.missionCard, {
              padding: 16,
              borderBottomWidth: index < 2 ? 1 : 0,
              shadowOpacity: 0.1,
              shadowRadius: 3,
              }]}>
                <View style={{flexDirection: 'row'}}>
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>{m.name}</Text>
                  <View style={[styles.missionTags, { backgroundColor: '#F3E5F5', marginLeft: 'auto'}]}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: '#7B1FA2' }}>✨미션</Text>
                  </View>
                </View>
                  <Text style={{ color: "#4b5563", marginVertical: 5}}>
                   {m.explanation}
                 </Text>
              <View style={{flexDirection: 'row', marginTop: 10}}>
                <View style={[styles.missionTags, { backgroundColor: '#BBDEFB'}]}>
                  <Text style={{color: '#1976D2'}}>물 {m.water} L</Text>
                </View>
                <View style={[styles.missionTags, { backgroundColor: '#EEEEEE'}]}>
                  <Text style={{color: '#616161'}}>쓰레기 {m.waste} kg</Text>
                </View>
                <View style={[styles.missionTags, { backgroundColor: '#F3E5F5'}]}>
                  <Text style={{color: '#7B1FA2'}}>CO₂ {m.co2}g 절약</Text>
                </View>
              </View>
              {isDone ? (
                <Text style={{ marginTop: 10, color: "#4CAF50", fontWeight: "700" }}>
                  완료! 🎉
                </Text>
              ) : (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost, { flex: 1 }, { borderWidth: 1}, {borderColor: '#64DD17'}, {borderRadius: 10}]}
                    onPress={() => replaceMission(index)}
                  >
                    <Text style={styles.btnGhostText}>바꾸기</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { flex: 1 }, {backgroundColor: '#64DD17'}, {marginLeft: 5}, {marginRight: 5}]}
                    onPress={() => completeDailyMission(m)}
                  >
                    <Text style={styles.btnPrimaryText}>실천완료</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            );
          })}
        </View>
        <StatusBar style="auto" />

        {/* 추천 미션 선물 모달 */}
        
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
            <Feather name="home" size={26} color="#4CAF50" />
            <Text style={[styles.bottomLabel, { color: '#4CAF50'}]}>홈</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Records')}
            style={styles.bottomButton}
          >
            <Feather name="user" size={22} color="#666" />
            <Text style={styles.bottomLabel}>마이</Text>
          </TouchableOpacity>
        </View>
        {popupVisible && (
        <View style={styles.popupOverlay}>
          <TouchableOpacity
            style={styles.popupOverlay}
            activeOpacity={1}
            onPress={() => setPopupVisible(false)}  // 🔥 Tap outside to close
          />

          {/* 캘린더 날짜 스크롤 */}
          

         <View style={styles.popupContainer}>
          <Text style={styles.popupTitle}>
            {popupData.date?.getFullYear()}년 {popupData.date?.getMonth() + 1}월 {popupData.date?.getDate()}일
          </Text>

          {popupData.missions.length === 0 ? (
            <Text style={{ color: '#777', marginTop: 10 }}>
              완료된 미션이 없어요 😢
            </Text>
          ) : (
            <>
              
              <View style={[styles.totalsBox, {marginTop: 5 }]}>
                <Text style={[styles.popupSubtitle, {marginTop: 1}]}>이 날 완료한 미션</Text>
                  <View style={[styles.totalBoxIndividual, {backgroundColor: '#f8fff4', flexDirection: 'column'}]}>
                    {popupData.missions.map((m, idx) => (
                      <Text key={m.id || idx} style={[styles.popupMission, {fontSize: 15, fontWeight: 600, color: '#558B2F'}]}>
                        • {m.mission}
                      </Text>
                    ))}
                    </View>
              </View>
              {/* Totals */}
              <Text style={[styles.popupSubtitle, {fontSize: 16, marginTop: 1, color: '#000' }]}>    환경 기여도</Text>
              <View style={[styles.totalsBox, {marginTop: 2}]}>
                <View style={[styles.totalBoxIndividual, {backgroundColor: '#F8FFF4'}]}>
                  <Text style={styles.totalText}>💧 물 절약: </Text>
                  <Text style={[styles.totalText, {fontSize: 16, fontWeight: 700, color: '#1976D2'}]}>{popupData.totals.water} L</Text>
                </View>
                <View style={[styles.totalBoxIndividual, {backgroundColor: '#F8FFF4'}]}>
                  <Text style={styles.totalText}>🗑 쓰레기 절감: </Text>
                  <Text style={[styles.totalText, {fontSize: 16, fontWeight: 700, color: '#F57C00'}]}>{popupData.totals.waste} kg</Text>
                </View>
                <View style={[styles.totalBoxIndividual, {backgroundColor: '#F8FFF4'}]}>
                  <Text style={styles.totalText}>🌍 탄소 감소: </Text>
                  <Text style={[styles.totalText, {fontSize: 16, fontWeight: 700, color: '#388E3C'}]}>{popupData.totals.co2} g</Text>
                </View>
              </View>
            </>
          )}
          </View>
        </View>
        )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 80,
    backgroundColor: '#F8FFF4',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  missionText: {
    fontSize: 20,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  recoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  recoHint: {
    flex: 1,
    color: '#4b5563',
  },
  navBtns: {
    flexDirection: 'row',
    marginTop: 6,
  },
  /** 버튼 공통 **/
  btn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#111827',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: '#2563eb22',
    borderWidth: 1,
    borderColor: '#2563eb66',
  },
  btnSecondaryText: {
    color: '#1f2937',
    fontWeight: '700',
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnGhostText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  btnOutlineText: {
    color: '#111827',
    fontWeight: '700',
  },
  expText: {
    marginTop: 4,
    color: '#4b5563',
    fontSize: 12,
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
    // ...기존 스타일들...

  /* Calendar styles */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  navButtonText: {
    fontSize: 20,
    color: '#111827',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  todayButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarContainer: {
    width: '100%',
  },
  weekDayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
  },
  selectedDayCell: {
    backgroundColor: '#111827',
  },
  todayCell: {
    backgroundColor: '#f3f4f6',
  },
  dayText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: '700',
  },
  todayText: {
    color: '#111827',
    fontWeight: '700',
  },
  sundayText: {
    color: '#ef4444',
  },
  saturdayText: {
    color: '#3b82f6',
  },
  emptyDayText: {
    color: 'transparent',
  },
  selectedDateText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  selectedDateSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  missionCountText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 8,
  },
  popupOverlay: {
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 50,
},

popupContainer: {
  width: "80%",
  padding: 20,
  backgroundColor: "#ffffffff",
  borderRadius: 16,
  borderWidth: 2,
  borderColor: '#7CB342',
  zIndex: 51,
},

popupTitle: {
  fontSize: 18,
  fontWeight: "700",
  marginBottom: 10,
  textAlign: "center",
},

popupSubtitle: {
  fontSize: 16,
  fontWeight: "800",
  marginTop: 5,
},

popupMission: {
  fontSize: 15,
  marginTop: 6,
},

totalsBox: {
  marginTop: 20,
  padding: 12,
  backgroundColor: "#ffffffff",
  borderRadius: 10,
},

totalText: {
  fontSize: 15,
  marginBottom: 5,
  fontWeight: "600",
},
totalBoxIndividual: {
  marginTop: 10,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#b7e098ff',
  flexDirection: 'row',
},
missionCard: {
  borderWidth: 1.5,
  borderRadius: 10,
  marginTop: 5,
  padding: 10,
  marginBottom: 5,
  borderColor: '#42A5F5',
},
missionTags: {
  borderRadius: 10,
  padding: 5,
  marginRight: 5,
},
alarmCard: {
  borderWidth: 2,
  borderColor: '#FDD835',
}

});

export default HomeScreen;
