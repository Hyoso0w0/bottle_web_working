// HomeScreen.js
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState, useContext, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import TreeForest from './TreeForest';
import { AppContext } from "./AppContext";

// 웹에서는 알림 모듈을 조건부로 import
let Notifications = null;
let LOCAL_NOTIFICATION_CHANNEL_ID = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    LOCAL_NOTIFICATION_CHANNEL_ID = require('./localNotifications').LOCAL_NOTIFICATION_CHANNEL_ID;
  } catch (e) {
    console.warn('expo-notifications를 로드할 수 없습니다:', e);
  }
}

// missions import 안전하게 처리 - 웹 호환성 고려
import { missions as missionsImport } from "./data/missions";

let missions = [];
try {
  // ES6 import가 제대로 작동하는지 확인
  if (Array.isArray(missionsImport) && missionsImport.length > 0) {
    missions = missionsImport;
  } else {
    // require 방식도 시도 (fallback)
    try {
      const missionsModule = require("./data/missions");
      const loaded = missionsModule.missions || missionsModule.default || [];
      if (Array.isArray(loaded) && loaded.length > 0) {
        missions = loaded;
      }
    } catch (reqErr) {
      console.error('missions require 실패:', reqErr);
    }
  }
  
  // 경고 메시지 제거 - useEffect에서 동적 로드 처리
} catch (e) {
  console.error('missions를 로드할 수 없습니다:', e);
  missions = [];
}
import { Alert } from "react-native" 
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { auth } from "./firebase";
import { saveMissionCompletion, loadAlarmsForUser } from "./firestoreHelpers";



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
  const [missionsLoaded, setMissionsLoaded] = useState(Array.isArray(missions) && missions.length > 0);
  const [availableMissions, setAvailableMissions] = useState(Array.isArray(missions) && missions.length > 0 ? missions : []);

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

  // 1) 매일 반복 알림
  if (alarm.repeatDaily) {
    return true;
  }

  // 2) 요일 반복 알림 (repeatDays: [0~6])
  if (Array.isArray(alarm.repeatDays) && alarm.repeatDays.length > 0) {
    return alarm.repeatDays.includes(dayOfWeek);
  }

  // 3) 특정 날짜 한 번 알림 (selectedYMD: {year, month, day})
  if (alarm.selectedYMD) {
    const { year, month, day } = alarm.selectedYMD;
    return year === todayY && month === todayM && day === todayD;
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
    await saveAlarmsToStorage(updated);
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
        const completedAt = mission.completedAt;
        // 로컬 시간 객체인 경우
        if (completedAt && typeof completedAt === 'object' && completedAt.year !== undefined) {
          return (
            completedAt.year === targetYear &&
            completedAt.month === targetMonth &&
            completedAt.date === targetDay
          );
        }
        // ISO 문자열인 경우 (하위 호환)
        const missionDate = new Date(completedAt);
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


// missions 로드 확인 및 동적 로드
useEffect(() => {
  const checkAndLoadMissions = async () => {
    // missions가 이미 로드되어 있으면 사용
    if (Array.isArray(missions) && missions.length > 0) {
      console.log('missions 로드 성공 (초기):', missions.length);
      setAvailableMissions(missions);
      setMissionsLoaded(true);
      return;
    }

    // missions가 비어있으면 동적으로 다시 로드 시도
    try {
      console.log('missions 동적 import 시도...');
      const missionsModule = await import("./data/missions");
      const loadedMissions = missionsModule.missions || missionsModule.default || [];
      
      console.log('동적 import 결과:', loadedMissions);
      
      if (Array.isArray(loadedMissions) && loadedMissions.length > 0) {
        console.log('missions 동적 로드 성공:', loadedMissions.length);
        setAvailableMissions(loadedMissions);
        setMissionsLoaded(true);
      } else {
        console.warn('missions가 비어있습니다:', loadedMissions);
        // require 방식도 시도
        try {
          const reqModule = require("./data/missions");
          const reqMissions = reqModule.missions || reqModule.default || [];
          if (Array.isArray(reqMissions) && reqMissions.length > 0) {
            console.log('missions require 로드 성공:', reqMissions.length);
            setAvailableMissions(reqMissions);
            setMissionsLoaded(true);
          }
        } catch (reqErr) {
          console.error('missions require 실패:', reqErr);
        }
      }
    } catch (e) {
      console.error('missions 동적 로드 실패:', e);
      // require 방식도 시도
      try {
        const reqModule = require("./data/missions");
        const reqMissions = reqModule.missions || reqModule.default || [];
        if (Array.isArray(reqMissions) && reqMissions.length > 0) {
          console.log('missions require 로드 성공 (fallback):', reqMissions.length);
          setAvailableMissions(reqMissions);
          setMissionsLoaded(true);
        }
      } catch (reqErr) {
        console.error('missions require 실패 (fallback):', reqErr);
      }
    }
  };
  
  checkAndLoadMissions();
}, []);
//미션 바꾸기 함수
const replaceMission = async (index) => {
  if (!Array.isArray(availableMissions) || availableMissions.length === 0) {
    console.warn('missions가 비어있거나 배열이 아닙니다');
    return;
  }
  const usedIds = dailyMissions.map(m => m.id);
  const candidates = availableMissions.filter(m => !usedIds.includes(m.id));

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
//미션 저장 및 로드
useEffect(() => {
  // missions가 로드될 때까지 대기
  if (!missionsLoaded || !Array.isArray(availableMissions) || availableMissions.length === 0) {
    console.log('missions 로드 대기 중...', {
      missionsLoaded,
      availableMissionsLength: availableMissions.length,
    });
    return;
  }

  console.log('dailyMissions 설정 시작, availableMissions:', availableMissions.length);

  const loadDaily = async () => {
    const today = getToday();
    const storedDate = await AsyncStorage.getItem("dailyDate");
    const storedMissions = await AsyncStorage.getItem("dailyMissions");
    const storedCompleted = await AsyncStorage.getItem("completedDailyIds");

    // If it's the same day → load everything as-is
    if (storedDate === today && storedMissions) {
      try {
        const parsed = JSON.parse(storedMissions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('저장된 미션 로드:', parsed.length);
          setDailyMissions(parsed);
          if (storedCompleted) {
            setCompletedDailyIds(JSON.parse(storedCompleted));
          }
          return;
        }
      } catch (e) {
        console.log('저장된 미션 파싱 실패:', e);
      }
    }

    // If date changed → generate NEW missions
    console.log('새 미션 생성, availableMissions:', availableMissions.length);
    const shuffled = [...availableMissions].sort(() => Math.random() - 0.5);
    const todayMissions = shuffled.slice(0, 3);
    console.log('생성된 오늘의 미션:', todayMissions.map(m => m.name));

    setDailyMissions(todayMissions);
    setCompletedDailyIds([]);

    try {
      await AsyncStorage.setItem("dailyMissions", JSON.stringify(todayMissions));
      await AsyncStorage.setItem("completedDailyIds", JSON.stringify([]));
      await AsyncStorage.setItem("dailyDate", today);
      console.log('미션 저장 완료');
    } catch (e) {
      console.log('미션 저장 실패:', e);
    }
  };

  loadDaily();
}, [missionsLoaded, availableMissions]);

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

  // 1) Filter missions completed on that date
  const missionsOfDay = completedMissions.filter((item) => {
    const c = item.completedAt;
    if (!c) return false;

    return c.year === y && c.month === m && c.date === d;
  });

  // 2) Calculate totals
  let totals = { water: 0, waste: 0, co2: 0 };

  missionsOfDay.forEach((m) => {
    totals.water += m.water || 0;
    totals.waste += m.waste || 0;
    totals.co2 += m.co2 || 0;
  });

  return { missions: missionsOfDay, totals };
};


  return (
    <View style={{flex: 1}}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>마이에코</Text>

        {/* 미션 (선택한 미션) */}
        {/*기존 미션 부분 삭제*/}
        {/* 추천 미션(시간대/게임 선물 UI) */}
        {/*기존 추천 미션 부분 삭제*/}
          {/* 달력 (성과 시각화) */}
        <View style={styles.card}>
          {/* 달력 헤더 (월 이동 / 오늘 버튼) */}
          <View style={styles.header}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.monthYearText}>{formatYearMonth(currentDate)}</Text>
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
          <Text style={{fontWeight: 800, fontSize: 20, marginTop: 10, marginBottom: 10}}>🔔 오늘의 알림 목록</Text>

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
                  style={{
                    padding: 16,
                    marginVertical: 8,
                    backgroundColor: "white",
                    borderRadius: 12,
                    ...(Platform.OS === 'web' ? {
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                    } : {
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    }),
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>
                    {alarm.message}
                  </Text>

                  <Text style={{ color: "#666", marginTop: 4 }}>
                    {alarm.ampm} {alarm.hour}:{alarm.minute.toString().padStart(2, '0')}
                  </Text>

                  {!alreadyCompleted ? (
                    <TouchableOpacity
                      onPress={() => completeTask(alarm.id)}
                      style={{
                        backgroundColor: "#4CAF50",
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 8,
                        marginTop: 12,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "600" }}>완료하기</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{flexDirection: 'row'}}>
                      <View style={{flex: 1}}>
                        <Text style={{ marginTop: 10, color: "#4CAF50", fontWeight: "700" }}>
                          ✔ 완료됨
                        </Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={{ marginTop: 10, color: "#8b5f36ff", fontWeight: "600" }}>
                            + 🍪쿠키 10개 적립!
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* 캘린더 버튼
        <View style={{ marginTop: 16 }}>
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Text style={styles.btnOutlineText}>📅 캘린더 보기</Text>
          </TouchableOpacity>
        </View> */}
        {/* 🔔 알림 테스트 버튼 */}
      
        {/* 오늘의 추가 미션 */}
        <View style={[styles.card, {marginTop: 20}]}>
          <Text style={[styles.cardHeader, {fontSize: 20}]}>✨ 오늘의 추가 미션</Text>
          {dailyMissions.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#666', marginBottom: 10 }}>미션을 불러오는 중...</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>잠시만 기다려주세요</Text>
            </View>
          ) : (
            dailyMissions.map((m, index) => {
              const isDone = completedDailyIds.includes(m.id);
              return (
                <View 
                  key={m.id}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: index < 2 ? 1 : 0,
                    borderColor: "#eee",
                  }}>
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>{m.name}</Text>
                  <Text style={{ color: "#4b5563", marginVertical: 4 }}>
                    {m.explanation}
                  </Text>

                  <Text style={{ fontSize: 12, color: "#6b7280" }}>
                    💧 물 {m.water}mL | 🗑️ 쓰레기 {m.waste} kg | 🌍 CO₂ {m.co2}g 절약
                  </Text>
                  {isDone ? (
                    <Text style={{ marginTop: 10, color: "#4CAF50", fontWeight: "700" }}>
                      완료! 🎉
                    </Text>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnGhost, { flex: 1 }]}
                        onPress={() => replaceMission(index)}
                      >
                        <Text style={styles.btnGhostText}>바꾸기</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
                        onPress={() => completeDailyMission(m)}
                      >
                        <Text style={styles.btnPrimaryText}>완료하기</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
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
              <Text style={[styles.popupSubtitle, {fontSize: 20, textAlign: 'center', marginTop: 1}]}>환경 기여도</Text>
              <View style={styles.totalsBox}>
                <Text style={styles.popupSubtitle}>이 날 완료한 미션</Text>
                  <View style={[styles.totalBoxIndividual, {backgroundColor: '#f8fff4', flexDirection: 'column'}]}>
                    {popupData.missions.map((m, idx) => (
                      <Text key={m.id || idx} style={styles.popupMission}>
                        • {m.mission}
                      </Text>
                    ))}
                    </View>
              </View>
              {/* Totals */}
              <View style={styles.totalsBox}>
                <View style={[styles.totalBoxIndividual, {backgroundColor: '#F8FFF4'}]}>
                  <Text style={styles.totalText}>💧 물 절약: </Text>
                  <Text style={[styles.totalText, {fontSize: 16, fontWeight: 700, color: '#68c036ff'}]}>{popupData.totals.water} ml</Text>
                </View>
                <View style={[styles.totalBoxIndividual, {backgroundColor: '#F8FFF4'}]}>
                  <Text style={styles.totalText}>🗑 쓰레기 절감: </Text>
                  <Text style={[styles.totalText, {fontSize: 16, fontWeight: 700, color: '#68c036ff'}]}>{popupData.totals.waste} g</Text>
                </View>
                <View style={[styles.totalBoxIndividual, {backgroundColor: '#F8FFF4'}]}>
                  <Text style={styles.totalText}>🌍 탄소 감소: </Text>
                  <Text style={[styles.totalText, {fontSize: 16, fontWeight: 700, color: '#68c036ff'}]}>{popupData.totals.co2} g</Text>
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
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    } : {
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    }),
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
  backgroundColor: "#e7fff0ff",
  borderRadius: 16,
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
}

});

export default HomeScreen;
