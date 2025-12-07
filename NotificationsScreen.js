import React, { useEffect, useMemo, useRef, useState,useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import WeekDaySelect from './WeekDaySelect';
import { Feather } from '@expo/vector-icons';
import { saveAlarmsForUser, loadAlarmsForUser } from "./firestoreHelpers";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { AppContext } from "./AppContext";

// ---- 시간 계산 유틸 ----
const getNextTriggerDate = (hour, minute, ampm) => {
  const h24 = ampm === 'PM' ? (hour % 12) + 12 : hour % 12;

  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h24,
    minute,
    0,
    0
  );

  // 이미 지났으면 다음날
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
};

const scheduleDailyAlarm = async (alarm) => {
  const nextTime = getNextTriggerDate(alarm.hour, alarm.minute, alarm.ampm);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '마이에코 🌱',
      body: alarm.message,
      data: { alarmId: alarm.id },
    },
    trigger: { type: 'date', date: nextTime },
  });

  return notificationId;
};

const scheduleOneTimeAlarm = async (alarm) => {
  if (!alarm.selectedYMD) return null;
  const { year, month, day } = alarm.selectedYMD;
  const h24 = alarm.ampm === 'PM' ? (alarm.hour % 12) + 12 : alarm.hour % 12;

  const date = new Date(year, month, day, h24, alarm.minute, 0, 0);
  const now = new Date();

  if (date <= now) return null;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '마이에코 🌱',
      body: alarm.message,
      data: { alarmId: alarm.id },
    },
    trigger: {
      type: 'date',
      date,
    },
  });

  return notificationId;
};

const scheduleWeeklyAlarm = async (alarm) => {
  const notificationIds = [];
  const now = new Date();

  for (const dayOfWeek of alarm.repeatDays) {
    let next = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      alarm.ampm === 'PM' ? (alarm.hour % 12) + 12 : alarm.hour % 12,
      alarm.minute,
      0,
      0
    );

    const deltaDays = (dayOfWeek + 7 - next.getDay()) % 7;
    if (deltaDays === 0 && next <= now) next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + deltaDays);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '마이에코 🌱',
        body: alarm.message,
        data: { alarmId: alarm.id },
      },
      trigger: {
        type: 'weekly',
        weekday: dayOfWeek + 1, // 1=Sun, 2=Mon, ... 7=Sat
        hour: alarm.ampm === 'PM' ? (alarm.hour % 12) + 12 : alarm.hour % 12,
        minute: alarm.minute,
      },
    });

    notificationIds.push(id);
  }

  return notificationIds;
};

// ---- AsyncStorage 안전 import ----
let AsyncStorage;
try {
  const AsyncStorageModule = require('@react-native-async-storage/async-storage');
  AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
  if (!AsyncStorage) {
    throw new Error('AsyncStorage is null');
  }
} catch (e) {
  console.warn('AsyncStorage를 로드할 수 없습니다:', e);
  const memoryStorage = {};
  AsyncStorage = {
    _storage: memoryStorage,
    async getItem(key) {
      return this._storage[key] || null;
    },
    async setItem(key, value) {
      this._storage[key] = value;
    },
    async removeItem(key) {
      delete this._storage[key];
    },
  };
}

const NotificationsScreen = ({ navigation }) => {
  // 알림 목록 관리
  const { alarms, setAlarms } = useContext(AppContext);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [outerScrollEnabled, setOuterScrollEnabled] = useState(true);

  // 권한 요청
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      console.log('알림 권한 상태:', status);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
    })();
  }, []);

  // 초기 시간 값
  const now = new Date();
  const init24 = now.getHours();
  const init12 = (init24 % 12) || 12;
  const initAmPm = init24 >= 12 ? 'PM' : 'AM';

  const [hour, setHour] = useState(init12);
  const [minute, setMinute] = useState(now.getMinutes());
  const [ampm, setAmPm] = useState(initAmPm);
  const [message, setMessage] = useState('작은 한 걸음, 지금 시작해요!');
  const [repeatDaily, setRepeatDaily] = useState(true);
  const [selectedYMD, setSelectedYMD] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [repeatDays, setRepeatDays] = useState([]);

  const STORAGE_KEY = '@bottle_alarms';

  const isAsyncStorageAvailable = () =>
    AsyncStorage !== null && AsyncStorage !== undefined;

  const saveAlarmsToStorage = async (alarmsList) => {
  try {
    console.log("🔥 [saveAlarmsToStorage] 호출");
    console.log("   - 저장하려는 알람 개수:", alarmsList.length);
    console.log(
      "   - 저장하려는 알람 목록:",
      alarmsList.map(a => ({
        id: a.id,
        time: `${a.ampm} ${a.hour}:${a.minute}`,
        repeatDaily: a.repeatDaily,
        repeatDays: a.repeatDays,
        selectedYMD: a.selectedYMD,
        enabled: a.enabled,
      }))
    );

    // AsyncStorage
    if (!isAsyncStorageAvailable()) {
      console.warn("⚠️ AsyncStorage를 사용할 수 없습니다. Firestore만 저장 시도");
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarmsList));
      console.log("   - ✅ AsyncStorage 저장 완료");
    }

    // Firestore
    console.log("   - 🔄 Firestore 저장 시도 (saveAlarmsForUser)");
    await saveAlarmsForUser(alarmsList);
    console.log("   - ✅ Firestore 저장 완료");

  } catch (e) {
    console.warn("❌ [saveAlarmsToStorage] 알림 저장 오류:", e);
  }
};

  const pad2 = (n) => String(n).padStart(2, '0');

  const applyAllSchedulesSafely = async (alarmsList) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const alarm of alarmsList) {
      if (!alarm.enabled) continue;

      if (alarm.repeatDaily) {
        await scheduleDailyAlarm(alarm);
      } else if (alarm.repeatDays?.length) {
        await scheduleWeeklyAlarm(alarm);
      } else {
        await scheduleOneTimeAlarm(alarm);
      }
    }
  };

  const loadAlarms = async () => {
  try {
    console.log("🔄 [loadAlarms] 알림 불러오기 시작");

    // 1) 먼저 Firestore에서 로드 시도
    const fromFirestore = await loadAlarmsForUser();
    console.log("   - Firestore에서 받은 값:", fromFirestore);

    if (fromFirestore && Array.isArray(fromFirestore)) {
      console.log("   - ✅ Firestore에서 알람 배열 로드 성공. 개수:", fromFirestore.length);
      setAlarms(fromFirestore);

      // 로컬에도 캐시
      if (isAsyncStorageAvailable()) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fromFirestore));
        console.log("   - ✅ Firestore 데이터로 AsyncStorage 캐시 업데이트 완료");
      } else {
        console.log("   - ⚠️ AsyncStorage 사용 불가, 캐시 스킵");
      }

      // (원하면 여기서 스케줄도 복구 가능)
      await applyAllSchedulesSafely(fromFirestore);
      console.log("   - 🔔 스케줄 재설정 완료");
      return;
    }

    console.log("   - ⚠️ Firestore에 알람 데이터가 없거나 배열이 아님. AsyncStorage로 fallback");

    // 2) Firestore에 없으면 로컬 AsyncStorage에서 로드
    if (!isAsyncStorageAvailable()) {
      console.warn("   - ⚠️ AsyncStorage를 사용할 수 없습니다. 로드 중단");
      return;
    }

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    console.log("   - AsyncStorage raw 값:", stored);

    if (stored) {
      const parsedAlarms = JSON.parse(stored);
      console.log("   - ✅ AsyncStorage에서 알람 로드. 개수:", parsedAlarms.length);
      setAlarms(parsedAlarms);

      // Firestore에 아직 없다면 저장
      console.log("   - 🔄 Firestore에 아직 없다면 저장 시도");
      await saveAlarmsForUser(parsedAlarms);
      console.log("   - ✅ Firestore 저장 완료 (AsyncStorage 데이터 기반)");
      
      await applyAllSchedulesSafely(parsedAlarms);
      console.log("   - 🔔 스케줄 재설정 완료");
    } else {
      console.log("   - ⚠️ AsyncStorage에도 저장된 알림 없음");
    }
  } catch (e) {
    console.warn("❌ [loadAlarms] 알림 불러오기 오류:", e);
  }
};


  useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ [Auth] 로그인된 유저 확인, 알림 로드:", user.uid);
      loadAlarms();   // 👉 이 시점에 Firestore에서 알림 읽기
    } else {
      console.log("⚠️ [Auth] 로그인 유저 없음, 알림 비우기");
      setAlarms([]);
    }
  });

  return () => unsub();
}, []);

  // 시간 wheel용 데이터
  const hours12 = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );
  const minutes60 = useMemo(
    () => Array.from({ length: 60 }, (_, i) => i),
    []
  );
  const REPEAT = 5;
  const hoursLoop = useMemo(
    () => Array.from({ length: REPEAT }).flatMap(() => hours12),
    [hours12]
  );
  const minutesLoop = useMemo(
    () => Array.from({ length: REPEAT }).flatMap(() => minutes60),
    [minutes60]
  );
  const MID_BLOCK = Math.floor(REPEAT / 2);

  const H_ITEM_H = 40;
  const M_ITEM_H = 40;
  const VISIBLE_ROWS = 5;
  const WHEEL_H = VISIBLE_ROWS * H_ITEM_H;

  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const [hourLoopIndex, setHourLoopIndex] = useState(0);
  const [minuteLoopIndex, setMinuteLoopIndex] = useState(0);

  // 수정 모드일 때 값 초기화
  useEffect(() => {
    if (editingId !== null) {
      const alarm = alarms.find((a) => a.id === editingId);
      if (alarm) {
        setHour(alarm.hour);
        setMinute(alarm.minute);
        setAmPm(alarm.ampm);
        setMessage(alarm.message || '작은 한 걸음, 지금 시작해요!');
        setRepeatDaily(alarm.repeatDaily);
        setRepeatDays(alarm.repeatDays || []);
        if (alarm.selectedYMD) {
          setSelectedYMD(alarm.selectedYMD);
        }
      }
    } else if (isAdding) {
      const now = new Date();
      const init24 = now.getHours();
      const init12 = (init24 % 12) || 12;
      const initAmPm = init24 >= 12 ? 'PM' : 'AM';
      setHour(init12);
      setMinute(now.getMinutes());
      setAmPm(initAmPm);
      setMessage('작은 한 걸음, 지금 시작해요!');
      setRepeatDaily(true);
      setRepeatDays([]);
      setSelectedYMD({
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
      });
    }
  }, [editingId, isAdding, alarms]);

  const startHourIndex = MID_BLOCK * hours12.length + (hour - 1);
  const startMinuteIndex = MID_BLOCK * minutes60.length + minute;

  const hasScrolledToInitial = useRef(false);

  useEffect(() => {
    if ((isAdding || editingId !== null) && !hasScrolledToInitial.current) {
      setTimeout(() => {
        hourRef.current?.scrollTo({
          y: startHourIndex * H_ITEM_H,
          animated: false,
        });
        minuteRef.current?.scrollTo({
          y: startMinuteIndex * M_ITEM_H,
          animated: false,
        });
        setHourLoopIndex(startHourIndex);
        setMinuteLoopIndex(startMinuteIndex);
        hasScrolledToInitial.current = true;
      }, 100);
    }
  }, [isAdding, editingId, startHourIndex, startMinuteIndex]);

  const snapToNearest = (y, itemH) => Math.round(y / itemH);

  const ensureMiddleBlock = (idx, baseLen, totalLen) => {
    const within = ((idx % baseLen) + baseLen) % baseLen;
    const nearEdge = idx <= baseLen || idx >= totalLen - baseLen;
    const middleIdx = MID_BLOCK * baseLen + within;
    return { within, nearEdge, middleIdx };
  };

  const isScrollingProgrammatically = useRef(false);

  const onHourScrollEnd = (e) => {
    if (isScrollingProgrammatically.current) {
      isScrollingProgrammatically.current = false;
      return;
    }
    const y = e.nativeEvent.contentOffset.y;
    let idx = snapToNearest(y, H_ITEM_H);

    const baseLen = hours12.length;
    const totalLen = hoursLoop.length;
    const { within, nearEdge, middleIdx } = ensureMiddleBlock(
      idx,
      baseLen,
      totalLen
    );
    const val = within + 1;
    setHour(val);
    setHourLoopIndex(nearEdge ? middleIdx : idx);

    if (nearEdge) {
      isScrollingProgrammatically.current = true;
      hourRef.current?.scrollTo({
        y: middleIdx * H_ITEM_H,
        animated: false,
      });
      return;
    }
    hourRef.current?.scrollTo({ y: idx * H_ITEM_H, animated: true });
  };

  const onMinuteScrollEnd = (e) => {
    if (isScrollingProgrammatically.current) {
      isScrollingProgrammatically.current = false;
      return;
    }
    const y = e.nativeEvent.contentOffset.y;
    let idx = snapToNearest(y, M_ITEM_H);

    const baseLen = minutes60.length;
    const totalLen = minutesLoop.length;
    const { within, nearEdge, middleIdx } = ensureMiddleBlock(
      idx,
      baseLen,
      totalLen
    );
    const val = within;
    setMinute(val);
    setMinuteLoopIndex(nearEdge ? middleIdx : idx);

    if (nearEdge) {
      isScrollingProgrammatically.current = true;
      minuteRef.current?.scrollTo({
        y: middleIdx * M_ITEM_H,
        animated: false,
      });
      return;
    }
    minuteRef.current?.scrollTo({ y: idx * M_ITEM_H, animated: true });
  };

  const toggleAmPm = (next) => setAmPm(next);

  // 알람 on/off 토글
  const toggleAlarm = async (id) => {
    const updated = alarms.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );

    setAlarms(updated);
    await saveAlarmsToStorage(updated);

    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const alarm of updated) {
      if (!alarm.enabled) continue;

      if (alarm.repeatDaily) {
        await scheduleDailyAlarm(alarm);
      } else if (alarm.repeatDays?.length) {
        await scheduleWeeklyAlarm(alarm);
      } else {
        await scheduleOneTimeAlarm(alarm);
      }
    }
  };

  // 알림 저장
  const saveAlarm = async () => {
    const newId = editingId || Date.now().toString();

    const isDaily = repeatDaily; // UI 토글 기준
    const isWeekly = !repeatDaily && repeatDays.length > 0;
    const isOneTime = !isDaily && !isWeekly;

    const newAlarm = {
      id: newId,
      hour,
      minute,
      ampm,
      message: message || '작은 한 걸음, 지금 시작해요!',

      repeatDaily: isDaily,
      repeatDays: isWeekly ? repeatDays : [],
      selectedYMD: isOneTime ? { ...selectedYMD } : null,

      enabled: editingId
        ? alarms.find((a) => a.id === editingId)?.enabled
        : true,
    };

    console.log('========================================');
    console.log('[알림 저장] 저장 시작');
    console.log(`  - 지정한 시간: ${ampm} ${pad2(hour)}:${pad2(minute)}`);
    console.log(
      `  - 저장할 데이터: hour=${hour}, minute=${minute}, ampm=${ampm}`
    );
    console.log(`  - 매일반복 토글: ${repeatDaily}`);
    console.log(`  - ID: ${newAlarm.id}`);

    let updatedAlarms;
    if (editingId) {
      updatedAlarms = alarms.map((a) =>
        a.id === editingId ? newAlarm : a
      );
      setAlarms(updatedAlarms);
      setEditingId(null);
    } else {
      updatedAlarms = [...alarms, newAlarm];
      setAlarms(updatedAlarms);
      setIsAdding(false);
    }

    const savedAlarm = updatedAlarms.find((a) => a.id === newAlarm.id);
    if (savedAlarm) {
      console.log(
        `  - 저장된 데이터 확인: hour=${savedAlarm.hour}, minute=${savedAlarm.minute}, ampm=${savedAlarm.ampm}`
      );
      if (
        savedAlarm.hour === hour &&
        savedAlarm.minute === minute &&
        savedAlarm.ampm === ampm
      ) {
        console.log(
          `  ✓ 저장 성공: 지정한 시간이 정확히 저장되었습니다`
        );
      } else {
        console.warn(
          `  ✗ 저장 실패: 지정한 시간과 저장된 시간이 일치하지 않습니다!`
        );
      }
    }

    await saveAlarmsToStorage(updatedAlarms);
    console.log(
      `  - AsyncStorage 저장 완료: 총 ${updatedAlarms.length}개`
    );
    console.log('========================================');

    console.log('저장된 알림 스케줄링 시작...');
    await applyAllSchedulesSafely(updatedAlarms);
    console.log('저장된 알림 스케줄링 완료');

    hasScrolledToInitial.current = false; // 다음 편집 시 초기 스크롤 다시 적용
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    hasScrolledToInitial.current = false;
  };

  const deleteAlarm = async (id) => {
    const newAlarms = alarms.filter((a) => a.id !== id);
    setAlarms(newAlarms);
    await saveAlarmsToStorage(newAlarms);

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await applyAllSchedulesSafely(newAlarms);
    } catch (e) {
      console.warn('알림 삭제 오류:', e);
    }
  };

  const clearAllSchedules = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setAlarms([]);
      if (isAsyncStorageAvailable()) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('알림 해제 오류:', e);
    }
  };

  // ---- UI ----

  // 알림이 없고 추가 모드도 아닐 때
  if (alarms.length === 0 && !isAdding && editingId === null) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.screenContainer}>
          <Text style={styles.title}>알림 시간 설정</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>저장된 알림이 없습니다</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => setIsAdding(true)}
            >
              <Text style={styles.btnPrimaryText}>알림 추가하기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.bottomButton}
          >
            <Feather name="bell" size={22} color="#4CAF50" />
            <Text style={[styles.bottomLabel, { color: '#4CAF50' }]}>
              알림
            </Text>
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
            <Feather name="user" size={22} color="#666" />
            <Text style={styles.bottomLabel}>마이</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 추가/수정 모드
  if (isAdding || editingId !== null) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.screenContainer}
          nestedScrollEnabled
          keyboardShouldPersistTaps="always"
          scrollEnabled={outerScrollEnabled}
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>
            {editingId ? '알림 수정' : '알림 추가'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>알림 설정</Text>

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="알림 내용 입력"
              style={styles.input}
              maxLength={80}
            />
            <View style={{ height: 8 }} />

            {/* 요일 선택 + 반복 방식 */}
            <WeekDaySelect
              repeatDays={repeatDays}
              setRepeatDays={setRepeatDays}
            />

            <View style={styles.rowBetween}>
              <TouchableOpacity
                onPress={() => setRepeatDaily(true)}
                style={[
                  styles.switchBtn,
                  repeatDaily && styles.switchBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.switchText,
                    repeatDaily && styles.switchTextActive,
                  ]}
                >
                  매일 반복
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRepeatDaily(false)}
                style={[
                  styles.switchBtn,
                  !repeatDaily && styles.switchBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.switchText,
                    !repeatDaily && styles.switchTextActive,
                  ]}
                >
                  특정 날짜
                </Text>
              </TouchableOpacity>
            </View>

            {!repeatDaily && (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnOutline]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.btnOutlineText}>
                    {selectedYMD.year}-{pad2(selectedYMD.month + 1)}-
                    {pad2(selectedYMD.day)} 날짜 선택
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={
                      new Date(
                        selectedYMD.year,
                        selectedYMD.month,
                        selectedYMD.day
                      )
                    }
                    mode="date"
                    display={
                      Platform.OS === 'ios' ? 'inline' : 'calendar'
                    }
                    onChange={(event, date) => {
                      if (Platform.OS !== 'ios') setShowDatePicker(false);
                      if (date) {
                        setSelectedYMD({
                          year: date.getFullYear(),
                          month: date.getMonth(),
                          day: date.getDate(),
                        });
                      }
                    }}
                    style={{ alignSelf: 'stretch' }}
                  />
                )}
              </View>
            )}

            {/* 시간 휠 */}
            <View
              style={[styles.wheelContainer, { height: WHEEL_H }]}
            >
              {/* AM/PM */}
              <View style={styles.ampmCol}>
                <TouchableOpacity
                  onPress={() => toggleAmPm('AM')}
                  style={[
                    styles.ampmBtn,
                    ampm === 'AM' && styles.ampmBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.ampmText,
                      ampm === 'AM' && styles.ampmTextActive,
                    ]}
                  >
                    AM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleAmPm('PM')}
                  style={[
                    styles.ampmBtn,
                    ampm === 'PM' && styles.ampmBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.ampmText,
                      ampm === 'PM' && styles.ampmTextActive,
                    ]}
                  >
                    PM
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 시 */}
              <View style={styles.wheel}>
                <ScrollView
                  ref={hourRef}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  onScrollBeginDrag={() =>
                    setOuterScrollEnabled(false)
                  }
                  onScrollEndDrag={() => setOuterScrollEnabled(true)}
                  onMomentumScrollEnd={(e) => {
                    setOuterScrollEnabled(true);
                    onHourScrollEnd(e);
                  }}
                  snapToInterval={H_ITEM_H}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                >
                  <View style={{ height: 2 * H_ITEM_H }} />
                  {hoursLoop.map((h, i) => (
                    <View
                      key={`h-${i}`}
                      style={[
                        styles.wheelItem,
                        { height: H_ITEM_H },
                      ]}
                    >
                      <Text
                        style={
                          i === hourLoopIndex
                            ? styles.wheelTextActive
                            : styles.wheelText
                        }
                      >
                        {pad2(h)}
                      </Text>
                    </View>
                  ))}
                  <View style={{ height: 2 * H_ITEM_H }} />
                </ScrollView>
              </View>

              <Text style={styles.wheelColon}>:</Text>

              {/* 분 */}
              <View style={styles.wheel}>
                <ScrollView
                  ref={minuteRef}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  onScrollBeginDrag={() =>
                    setOuterScrollEnabled(false)
                  }
                  onScrollEndDrag={() => setOuterScrollEnabled(true)}
                  onMomentumScrollEnd={(e) => {
                    setOuterScrollEnabled(true);
                    onMinuteScrollEnd(e);
                  }}
                  snapToInterval={M_ITEM_H}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                >
                  <View style={{ height: 2 * M_ITEM_H }} />
                  {minutesLoop.map((m, i) => (
                    <View
                      key={`m-${i}`}
                      style={[
                        styles.wheelItem,
                        { height: M_ITEM_H },
                      ]}
                    >
                      <Text
                        style={
                          i === minuteLoopIndex
                            ? styles.wheelTextActive
                            : styles.wheelText
                        }
                      >
                        {pad2(m)}
                      </Text>
                    </View>
                  ))}
                  <View style={{ height: 2 * M_ITEM_H }} />
                </ScrollView>
              </View>

              <View
                pointerEvents="none"
                style={styles.selectorBar}
              />
            </View>

            {/* 미리보기 */}
            <View style={styles.iosPreviewContainer}>
              <Text style={styles.previewSectionLabel}>
                🔔 미리보기
              </Text>
              <View style={styles.iosNotificationCard}>
                <View style={styles.iosRow}>
                  <Text style={styles.iosAppName}>마이에코</Text>
                  <Text style={styles.iosAppName}>🌱</Text>
                  <Text style={styles.iosTimestamp}>지금</Text>
                </View>
                <Text style={styles.iosMessage} numberOfLines={2}>
                  {message || '알림 내용이 여기에 표시됩니다.'}
                </Text>
              </View>
            </View>

            {/* 버튼 */}
            <View
              style={{
                flexDirection: 'row',
                zIndex: 10,
                elevation: 10,
              }}
            >
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, { flex: 1 }]}
                onPress={cancelEdit}
              >
                <Text style={styles.btnOutlineText}>취소</Text>
              </TouchableOpacity>
              <View style={{ width: 8 }} />
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
                onPress={saveAlarm}
              >
                <Text style={styles.btnPrimaryText}>저장</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 8 }} />
            <Text style={styles.notifyHint}>
              {repeatDaily
                ? `매일 ${ampm} ${pad2(hour)}:${pad2(
                    minute
                  )}에 알림이 전송됩니다.`
                : selectedYMD
                ? `${selectedYMD.year}-${pad2(
                    selectedYMD.month + 1
                  )}-${pad2(selectedYMD.day)} ${ampm} ${pad2(
                    hour
                  )}:${pad2(minute)}에 한 번 전송됩니다.`
                : repeatDays?.length
                ? `매주 ${repeatDays
                    .map((d) =>
                      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
                        d
                      ]
                    )
                    .join(', ')} 반복`
                : '한 번 반복'}
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.bottomButton}
          >
            <Feather name="bell" size={22} color="#4CAF50" />
            <Text style={[styles.bottomLabel, { color: '#4CAF50' }]}>
              알림
            </Text>
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
            <Feather name="user" size={22} color="#666" />
            <Text style={styles.bottomLabel}>마이</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 저장된 알림 목록 표시
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.screenContainer}>
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🔔 알림 시간 설정</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              setIsAdding(true);
              hasScrolledToInitial.current = false;
            }}
          >
            <Text style={styles.btnPrimaryText}>+ 추가</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.listHeader}>
            <Text style={styles.cardHeader}>
              저장된 알림 ({alarms.length}개)
            </Text>
          </View>

          {alarms.map((alarm) => (
            <View key={alarm.id} style={styles.alarmItem}>
              <View style={styles.alarmInfo}>
                {alarm.message && (
                  <Text style={styles.alarmMessage}>
                    {alarm.message}
                  </Text>
                )}

                <Text style={styles.alarmDesc}>
                  {alarm.repeatDaily
                    ? '매일 반복'
                    : alarm.selectedYMD
                    ? `${alarm.selectedYMD.year}-${pad2(
                        alarm.selectedYMD.month + 1
                      )}-${pad2(alarm.selectedYMD.day)} 한 번`
                    : alarm.repeatDays?.length
                    ? `매주 ${alarm.repeatDays
                        .map((d) =>
                          [
                            'Sun',
                            'Mon',
                            'Tue',
                            'Wed',
                            'Thu',
                            'Fri',
                            'Sat',
                          ][d]
                        )
                        .join(', ')} 반복`
                    : '한 번 반복'}
                </Text>

                <Text style={styles.alarmTime}>
                  {alarm.ampm} {pad2(alarm.hour)}:{pad2(alarm.minute)}
                </Text>
              </View>
              <View style={styles.alarmActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => {
                    setEditingId(alarm.id);
                    hasScrolledToInitial.current = false;
                  }}
                >
                  <Text style={styles.btnGhostText}>수정</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => toggleAlarm(alarm.id)}
                  style={[
                    styles.toggle,
                    alarm.enabled
                      ? styles.toggleOn
                      : styles.toggleOff,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleCircle,
                      alarm.enabled
                        ? styles.toggleCircleOn
                        : styles.toggleCircleOff,
                    ]}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnDelete}
                  onPress={() => deleteAlarm(alarm.id)}
                >
                  <Text style={styles.btnDeleteText}>❌</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={{ height: 8 }} />
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={clearAllSchedules}
          >
            <Text style={styles.btnOutlineText}>모두 해제</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.bottomButton}
        >
          <Feather name="bell" size={22} color="#4CAF50" />
          <Text style={[styles.bottomLabel, { color: '#4CAF50' }]}>
            알림
          </Text>
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
          <Feather name="user" size={22} color="#666" />
          <Text style={styles.bottomLabel}>마이</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---- 스타일 ----
const styles = StyleSheet.create({
  screenContainer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f7faf3',
    minHeight: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    marginBottom: 16,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
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
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alarmItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  alarmInfo: {
    flex: 1,
  },
  alarmTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  alarmDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  alarmMessage: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  alarmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  switchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  switchBtnActive: {
    backgroundColor: '#3c8c4c',
    borderColor: '#3c8c4c',
  },
  switchText: {
    color: '#111827',
    fontWeight: '700',
  },
  switchTextActive: {
    color: '#fff',
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#3c8c4c',
  },
  btnPrimaryText: {
    color: '#fff',
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
  btnDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe1e7ff',
    borderWidth: 1,
    borderColor: '#f78497ff',
  },
  btnDeleteText: {
    color: '#e9576fff',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 16,
  },
  notifyHint: {
    color: '#6b7280',
    marginTop: 4,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  wheelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    position: 'relative',
  },
  wheel: {
    width: 100,
    height: 5 * 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 18,
    color: '#6b7280',
  },
  wheelTextActive: {
    fontSize: 20,
    color: '#111827',
    fontWeight: '700',
  },
  wheelColon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 8,
  },
  selectorBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 40 * 2,
    height: 40,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    opacity: 0.6,
  },
  ampmCol: {
    marginLeft: 8,
    height: 5 * 40,
    justifyContent: 'center',
  },
  ampmBtn: {
    width: 70,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 4,
    alignItems: 'center',
  },
  ampmBtnActive: {
    backgroundColor: '#3c8c4c',
    borderColor: '#3c8c4c',
  },
  ampmText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  ampmTextActive: {
    color: '#fff',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 20,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#3c8c4c',
    alignItems: 'flex-end',
  },
  toggleOff: {
    backgroundColor: '#d1d5db',
    alignItems: 'flex-start',
  },
  toggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  iosPreviewContainer: {
    marginTop: 40,
    marginBottom: 20,
  },
  previewSectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  iosNotificationCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e6e6e6',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iosAppName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginRight: 6,
  },
  iosTimestamp: {
    fontSize: 13,
    color: '#8e8e93',
    marginLeft: 'auto',
  },
  iosMessage: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
  },
  /* Bottom Nav */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  bottomButton: { alignItems: 'center' },
  bottomLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  bottomHome: { alignItems: 'center' },
});

export default NotificationsScreen;
