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

const getWebNotificationTimeouts = () => {
  if (typeof window === 'undefined') return [];

  // 아직 배열이 없으면 새로 만들어주기
  if (!Array.isArray(window.webNotificationTimeouts)) {
    window.webNotificationTimeouts = [];
  }

  return window.webNotificationTimeouts;
};

const clearWebNotifications = () => {
  const timeouts = getWebNotificationTimeouts();
  timeouts.forEach(timeout => clearTimeout(timeout));
  if (typeof window !== 'undefined') {
    window.webNotificationTimeouts = [];
  }
};

const requestWebNotificationPermission = async () => {
  if (Platform.OS !== 'web' || !('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

const showWebNotification = (title, body, data = {}) => {
  if (Platform.OS !== 'web' || !('Notification' in window)) {
    console.warn('웹 알림 표시 실패: Notification API를 사용할 수 없습니다');
    return;
  }
  
  if (Notification.permission !== 'granted') {
    console.warn('웹 알림 표시 실패: 권한이 없습니다', Notification.permission);
    return;
  }
  
  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.alarmId || 'default',
      requireInteraction: false,
    });
    
    console.log('웹 알림 표시 성공:', { title, body, alarmId: data.alarmId });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    notification.onerror = (error) => {
      console.error('웹 알림 에러:', error);
    };
    
    // 5초 후 자동 닫기
    setTimeout(() => {
      notification.close();
    }, 5000);
  } catch (error) {
    console.error('웹 알림 생성 실패:', error);
  }
};

const scheduleWebNotification = (alarm, triggerDate) => {
  if (Platform.OS !== 'web') return null;
  
  const now = new Date();
  const delay = triggerDate.getTime() - now.getTime();
  
  if (delay <= 0) {
    console.log('웹 알림 스케줄링 실패: 시간이 이미 지났습니다', {
      alarmId: alarm.id,
      triggerDate: triggerDate.toLocaleString(),
      now: now.toLocaleString(),
      delay,
    });
    return null;
  }
  
  console.log('웹 알림 스케줄링:', {
    alarmId: alarm.id,
    message: alarm.message,
    triggerDate: triggerDate.toLocaleString(),
    delayMs: delay,
    delayMinutes: Math.round(delay / 1000 / 60),
  });
  
  const timeoutId = setTimeout(() => {
    console.log('웹 알림 표시:', {
      alarmId: alarm.id,
      message: alarm.message,
      permission: Notification.permission,
    });
    
    showWebNotification(
      '마이에코 🌱',
      alarm.message || '알림 시간이에요!',
      { alarmId: alarm.id }
    );
    
    // 매일 반복인 경우 다음날 알림도 스케줄링
    if (alarm.repeatDaily) {
      const nextDay = new Date(triggerDate.getTime() + 24 * 60 * 60 * 1000);
      const nextTimeoutId = scheduleWebNotification(alarm, nextDay);
      if (nextTimeoutId && typeof window !== 'undefined') {
        const timeouts = getWebNotificationTimeouts();
        timeouts.push(nextTimeoutId);
        if (typeof window !== 'undefined') {
          window.webNotificationTimeouts = timeouts;
        }
      }
    }
  }, delay);
  
  const timeouts = getWebNotificationTimeouts();
  timeouts.push(timeoutId);
  if (typeof window !== 'undefined') {
    window.webNotificationTimeouts = timeouts;
  }
  
  return timeoutId;
};

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

  // 웹에서는 브라우저 Notification API 사용
  if (Platform.OS === 'web') {
    const hasPermission = await requestWebNotificationPermission();
    if (!hasPermission) {
      console.warn('웹 알림 권한이 없어 알림을 스케줄링할 수 없습니다:', alarm.id);
      return null;
    }
    const timeoutId = scheduleWebNotification(alarm, nextTime);
    return timeoutId;
  }

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

  // 웹에서는 브라우저 Notification API 사용
  if (Platform.OS === 'web') {
    const hasPermission = await requestWebNotificationPermission();
    if (!hasPermission) {
      console.warn('웹 알림 권한이 없어 알림을 스케줄링할 수 없습니다:', alarm.id);
      return null;
    }
    const timeoutId = scheduleWebNotification(alarm, date);
    return timeoutId;
  }

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

    // 웹에서는 브라우저 Notification API 사용
    if (Platform.OS === 'web') {
      const hasPermission = await requestWebNotificationPermission();
      if (!hasPermission) {
        console.warn('웹 알림 권한이 없어 알림을 스케줄링할 수 없습니다:', alarm.id);
        continue;
      }
      const timeoutId = scheduleWebNotification(alarm, next);
      if (timeoutId) {
        notificationIds.push(timeoutId);
      }
    } else {
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
  const [message, setMessage] = useState('예: 출근 전 텀블러 챙기기');
  const [repeatDays, setRepeatDays] = useState([]);
  const [selectedEmoji, setSelectedEmoji] = useState('🌱');

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
        repeatDays: a.repeatDays,
        enabled: a.enabled,
        emoji: a.emoji,
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
    // 웹에서는 브라우저 Notification API 사용
    if (Platform.OS === 'web') {
      console.log('웹 알림 스케줄링 시작, 알림 개수:', alarmsList.length);
      clearWebNotifications();
      const hasPermission = await requestWebNotificationPermission();
      console.log('웹 알림 권한:', hasPermission ? 'granted' : 'denied');
      
      if (!hasPermission) {
        console.warn('웹 알림 권한이 없어 알림을 표시할 수 없습니다.');
        return;
      }
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }

    let scheduledCount = 0;
    for (const alarm of alarmsList) {
      if (!alarm.enabled) {
        console.log('알림 스킵 (비활성화):', alarm.id);
        continue;
      }

      try {
        if (alarm.repeatDaily) {
          const id = await scheduleDailyAlarm(alarm);
          if (id) scheduledCount++;
          console.log('매일 반복 알림 스케줄링:', alarm.id, id ? '성공' : '실패');
        } else if (alarm.repeatDays?.length) {
          const ids = await scheduleWeeklyAlarm(alarm);
          scheduledCount += ids.length;
          console.log('주간 반복 알림 스케줄링:', alarm.id, ids.length, '개');
        } else {
          const id = await scheduleOneTimeAlarm(alarm);
          if (id) scheduledCount++;
          console.log('한 번 알림 스케줄링:', alarm.id, id ? '성공' : '실패');
        }
      } catch (error) {
        console.error('알림 스케줄링 에러:', alarm.id, error);
      }
    }
    
    if (Platform.OS === 'web') {
      const timeouts = getWebNotificationTimeouts();
      console.log('웹 알림 스케줄링 완료:', {
        총알림개수: alarmsList.length,
        스케줄된개수: scheduledCount,
        timeout개수: timeouts.length,
      });
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

  // 웹에서 마우스 휠 및 드래그 스크롤 활성화
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let wheelTimeout = null;
    let isDragging = { hour: false, minute: false };
    let dragStartY = { hour: 0, minute: 0 };
    let dragStartScrollTop = { hour: 0, minute: 0 };

    const findDomNode = (ref) => {
      if (!ref.current) return null;
      
      const scrollView = ref.current;
      
      // 여러 방법으로 DOM 노드 찾기 시도
      let domNode = null;
      
      // 방법 1: _component._nativeNode
      if (scrollView._component?._nativeNode) {
        domNode = scrollView._component._nativeNode;
      }
      // 방법 2: _component
      else if (scrollView._component) {
        domNode = scrollView._component;
      }
      // 방법 3: _nativeNode
      else if (scrollView._nativeNode) {
        domNode = scrollView._nativeNode;
      }
      // 방법 4: getNode()
      else if (scrollView.getNode) {
        domNode = scrollView.getNode();
      }
      
      // 실제 스크롤 가능한 요소 찾기 (div 또는 스크롤 컨테이너)
      if (domNode) {
        // scrollTop 속성이 있는지 확인
        if (typeof domNode.scrollTop !== 'undefined') {
          return domNode;
        }
        
        // 자식 요소 중 스크롤 가능한 요소 찾기
        if (domNode.querySelector) {
          const scrollable = domNode.querySelector('[data-scrollable]') || 
                            domNode.querySelector('div[style*="overflow"]') ||
                            domNode.firstElementChild;
          if (scrollable && typeof scrollable.scrollTop !== 'undefined') {
            return scrollable;
          }
        }
        
        // 직접 자식 요소 확인
        if (domNode.children && domNode.children.length > 0) {
          for (let i = 0; i < domNode.children.length; i++) {
            const child = domNode.children[i];
            if (typeof child.scrollTop !== 'undefined') {
              return child;
            }
          }
        }
      }
      
      return domNode;
    };

    const setupScrollHandler = (ref, isHour) => {
      if (!ref.current) return null;

      const key = isHour ? 'hour' : 'minute';

      // 마우스 휠 핸들러
      const handleWheel = (e) => {
        const domNode = findDomNode(ref);
        if (!domNode || typeof domNode.scrollTop === 'undefined') return;

        e.preventDefault();
        e.stopPropagation();

        const currentScrollTop = domNode.scrollTop || 0;
        const deltaY = e.deltaY * 0.5; // 스크롤 속도 조절
        const maxScroll = domNode.scrollHeight - domNode.clientHeight;
        const newScrollTop = Math.max(0, Math.min(
          currentScrollTop + deltaY,
          maxScroll
        ));
        
        domNode.scrollTop = newScrollTop;
        
        // 스크롤이 끝난 후 스냅 처리
        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
          const scrollEvent = {
            nativeEvent: {
              contentOffset: {
                y: domNode.scrollTop,
                x: 0,
              },
            },
          };
          
          if (isHour) {
            onHourScrollEnd(scrollEvent);
          } else {
            onMinuteScrollEnd(scrollEvent);
          }
        }, 200);
      };

      // 마우스 드래그 핸들러
      const handleMouseDown = (e) => {
        const domNode = findDomNode(ref);
        if (!domNode || typeof domNode.scrollTop === 'undefined') {
          console.log('DOM 노드를 찾을 수 없거나 스크롤 불가능:', isHour ? 'hour' : 'minute', domNode);
          return;
        }

        isDragging[key] = true;
        dragStartY[key] = e.clientY;
        dragStartScrollTop[key] = domNode.scrollTop || 0;
        
        if (domNode.style) {
          domNode.style.cursor = 'grabbing';
          domNode.style.userSelect = 'none';
        }
        
        e.preventDefault();
        e.stopPropagation();
      };

      const handleMouseMove = (e) => {
        if (!isDragging[key]) return;

        const domNode = findDomNode(ref);
        if (!domNode || typeof domNode.scrollTop === 'undefined') {
          isDragging[key] = false;
          return;
        }

        const deltaY = dragStartY[key] - e.clientY;
        const newScrollTop = dragStartScrollTop[key] + deltaY;
        const maxScroll = domNode.scrollHeight - domNode.clientHeight;
        
        domNode.scrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));
        
        e.preventDefault();
        e.stopPropagation();
      };

      const handleMouseUp = (e) => {
        if (!isDragging[key]) return;

        const domNode = findDomNode(ref);
        if (domNode) {
          domNode.style.cursor = 'grab';
          domNode.style.userSelect = '';
        }

        isDragging[key] = false;
        
        // 스크롤이 끝난 후 스냅 처리
        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
          if (domNode) {
            const scrollEvent = {
              nativeEvent: {
                contentOffset: {
                  y: domNode.scrollTop,
                  x: 0,
                },
              },
            };
            
            if (isHour) {
              onHourScrollEnd(scrollEvent);
            } else {
              onMinuteScrollEnd(scrollEvent);
            }
          }
        }, 150);
        
        e.preventDefault();
      };

      const handleMouseLeave = (e) => {
        if (isDragging[key]) {
          const domNode = findDomNode(ref);
          if (domNode) {
            domNode.style.cursor = 'grab';
            domNode.style.userSelect = '';
          }
          isDragging[key] = false;
        }
      };

      // 전역 마우스 이벤트 (드래그가 휠 밖으로 나갔을 때)
      const handleGlobalMouseMove = (e) => {
        if (isDragging[key]) {
          handleMouseMove(e);
        }
      };

      const handleGlobalMouseUp = (e) => {
        if (isDragging[key]) {
          handleMouseUp(e);
        }
      };

      // 약간의 지연 후 DOM 노드 찾기 (렌더링 완료 후)
      let timeoutId = null;
      let retryCount = 0;
      const maxRetries = 15;
      
      const trySetup = () => {
        const domNode = findDomNode(ref);
        
        // 더 깊이 탐색 - React Native Web의 ScrollView 구조
        let scrollableNode = domNode;
        if (domNode) {
          // ScrollView의 실제 스크롤 컨테이너 찾기
          if (domNode.querySelector) {
            // overflow-y: auto 또는 scroll이 있는 요소 찾기
            const allDivs = domNode.querySelectorAll('div');
            for (let div of allDivs) {
              const style = window.getComputedStyle(div);
              if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && 
                  typeof div.scrollTop !== 'undefined') {
                scrollableNode = div;
                break;
              }
            }
          }
          
          // 여전히 scrollTop이 없으면 첫 번째 자식 요소 시도
          if (typeof scrollableNode.scrollTop === 'undefined' && scrollableNode.firstElementChild) {
            scrollableNode = scrollableNode.firstElementChild;
          }
        }
        
        if (scrollableNode && typeof scrollableNode.addEventListener === 'function' && typeof scrollableNode.scrollTop !== 'undefined') {
          scrollableNode.addEventListener('wheel', handleWheel, { passive: false });
          scrollableNode.addEventListener('mousedown', handleMouseDown, { passive: false });
          scrollableNode.addEventListener('mouseleave', handleMouseLeave, { passive: false });
          if (scrollableNode.style) {
            scrollableNode.style.cursor = 'grab';
            scrollableNode.style.userSelect = 'none';
          }
          
          // 전역 이벤트 (드래그가 요소 밖으로 나갔을 때)
          document.addEventListener('mousemove', handleGlobalMouseMove);
          document.addEventListener('mouseup', handleGlobalMouseUp);
          
          console.log('드래그 핸들러 설정 완료:', isHour ? 'hour' : 'minute', scrollableNode);
          return true;
        } else if (retryCount < maxRetries) {
          retryCount++;
          timeoutId = setTimeout(trySetup, 200);
          return false;
        } else {
          console.warn('DOM 노드를 찾을 수 없습니다:', isHour ? 'hour' : 'minute', {
            domNode,
            scrollableNode,
            hasAddEventListener: domNode && typeof domNode.addEventListener === 'function',
            hasScrollTop: domNode && typeof domNode.scrollTop !== 'undefined',
          });
          return false;
        }
      };
      
      timeoutId = setTimeout(trySetup, 300);

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(wheelTimeout);
        const domNode = findDomNode(ref);
        let scrollableNode = domNode;
        
        // cleanup 시에도 같은 방식으로 노드 찾기
        if (domNode && domNode.querySelector) {
          const allDivs = domNode.querySelectorAll('div');
          for (let div of allDivs) {
            const style = window.getComputedStyle(div);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && 
                typeof div.scrollTop !== 'undefined') {
              scrollableNode = div;
              break;
            }
          }
        }
        
        if (scrollableNode && typeof scrollableNode.removeEventListener === 'function') {
          scrollableNode.removeEventListener('wheel', handleWheel);
          scrollableNode.removeEventListener('mousedown', handleMouseDown);
          scrollableNode.removeEventListener('mouseleave', handleMouseLeave);
        }
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    };

    const cleanupHour = setupScrollHandler(hourRef, true);
    const cleanupMinute = setupScrollHandler(minuteRef, false);

    return () => {
      if (cleanupHour) cleanupHour();
      if (cleanupMinute) cleanupMinute();
      clearTimeout(wheelTimeout);
    };
  }, []);

  // 수정 모드일 때 값 초기화
  useEffect(() => {
    if (editingId !== null) {
      const alarm = alarms.find((a) => a.id === editingId);
      if (alarm) {
        setHour(alarm.hour);
        setMinute(alarm.minute);
        setAmPm(alarm.ampm);
        setMessage(alarm.message || '예: 출근 전 텀블러 챙기기');
        setRepeatDays(alarm.repeatDays || []);
        setSelectedEmoji(alarm.emoji || '🌱');
      }
    } else if (isAdding) {
      const now = new Date();
      const init24 = now.getHours();
      const init12 = (init24 % 12) || 12;
      const initAmPm = init24 >= 12 ? 'PM' : 'AM';
      setHour(init12);
      setMinute(now.getMinutes());
      setAmPm(initAmPm);
      setMessage('예: 출근 전 텀블러 챙기기');
      setRepeatDays([]);
      setSelectedEmoji('🌱');
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

    // 웹에서는 알림 스케줄링 건너뛰기
    if (Platform.OS === 'web') {
      return;
    }
    
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const alarm of updated) {
      if (!alarm.enabled) continue;

        if (alarm.repeatDays?.length) {
        await scheduleWeeklyAlarm(alarm);
      }
    }
  };

  // 알림 저장
  const saveAlarm = async () => {
    const newId = editingId || Date.now().toString();

    if (repeatDays.length === 0) {
    alert("요일을 하나 이상 선택해주세요!");
    return; 
    }

    const newAlarm = {
      id: newId,
      hour,
      minute,
      ampm,
      message: message || '예: 출근 전 텀블러 챙기기',
      repeatDays: repeatDays,

      enabled: editingId
        ? alarms.find((a) => a.id === editingId)?.enabled
        : true,
      emoji: selectedEmoji || '🌱',
    };

    console.log('========================================');
    console.log('[알림 저장] 저장 시작');
    console.log(`  - 지정한 시간: ${ampm} ${pad2(hour)}:${pad2(minute)}`);
    console.log(
      `  - 저장할 데이터: hour=${hour}, minute=${minute}, ampm=${ampm}`
    );
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
      // 웹에서는 알림 스케줄링 건너뛰기
      if (Platform.OS === 'web') {
        return;
      }
      
      await Notifications.cancelAllScheduledNotificationsAsync();
      await applyAllSchedulesSafely(newAlarms);
    } catch (e) {
      console.warn('알림 삭제 오류:', e);
    }
  };

   //추천 알림
const recommendedAlarms = [
  {
    id: "rec1",
    hour: 7,
    minute: 30,
    ampm: "AM",
    message: "아침에 텀블러 챙기기",
    repeatDays: [1,2,3,4,5],
    emoji: "🌱",
  },
  {
    id: "rec2",
    hour: 14,
    minute: 0,
    ampm: "PM",
    message: "점심 후 산책하기",
    repeatDays: [1,2,3,4,5],
    emoji: "🌿",
  },
  {
    id: "rec3",
    hour: 21,
    minute: 0,
    ampm: "PM",
    message: "하루 물 섭취 마무리",
    repeatDays: [0,1,2,3,4,5,6],
    emoji: "💧",
  },
];

const addRecommendedAlarm = async (rec) => {
  const newAlarm = {
    id: Date.now().toString(),
    hour: rec.hour,
    minute: rec.minute,
    ampm: rec.ampm,
    message: rec.message,
    repeatDays: rec.repeatDays,
    enabled: true,
    emoji: rec.emoji,
  };

  const updated = [...alarms, newAlarm];
  setAlarms(updated);

  await saveAlarmsToStorage(updated);
  await applyAllSchedulesSafely(updated);
};

  const clearAllSchedules = async () => {
    try {
      // 웹에서는 브라우저 알림 클리어
      if (Platform.OS === 'web') {
        clearWebNotifications();
      } else if (Notifications) {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
      
      setAlarms([]);
      if (isAsyncStorageAvailable()) {
        await AsyncStorage.setItem("@bottle_alarms", JSON.stringify([]));
      }
      
      if (Platform.OS === 'web') {
        return;
      }
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
            {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.replace('Home')}
              style={styles.backButton}
            >
              <Feather name="chevron-left" size={22} color="#444" />
            </TouchableOpacity>
  
            <Text style={styles.headerTitle}>🌿 나의 알림 화면</Text>
          </View>

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
          contentContainerStyle={[styles.screenContainer, { paddingBottom: 100 }]}
          nestedScrollEnabled={Platform.OS !== 'web'}
          keyboardShouldPersistTaps="always"
          scrollEnabled={outerScrollEnabled}
          keyboardDismissMode="on-drag"
        >
           <Text style={[styles.title, {color: '#3c6300'}]}>
            {editingId ? '알림 수정' : '새 알림 추가'}
          </Text>

          <View>
            <View style={[styles.card, {borderWidth: 2, borderColor: '#d8f999'}]}>
              <Text style={[styles.cardHeader, { marginTop: 5 }]}>
                😊 아이콘 선택
              </Text>

             <View style={styles.emojiRow}>
                {['🌱', '☕', '⚡', '🍱', '♻️', '💧', '🌍', '🌿', '🚴', '🥤'].map((em) => (
                  <TouchableOpacity
                    key={em}
                    onPress={() => setSelectedEmoji(em)}
                    style={[
                      styles.emojiButton,
                      selectedEmoji === em && styles.emojiButtonActive
                    ]}
                  >
                    <Text style={{ fontSize: 30 }}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.card, {
              borderRadius: 10,
              borderWidth: 2,
              borderColor: '#d8f999',
              marginBottom: 5,
            }]}>
              <Text style={styles.cardHeader}>📝 알림 제목</Text>

              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="알림 내용 입력"
                style={styles.input}
                maxLength={80}
              />
            </View>
            <View style={{ height: 8 }} />

            {/* 요일 선택 + 반복 방식 */}
            <WeekDaySelect
              repeatDays={repeatDays}
              setRepeatDays={setRepeatDays}
            />

            {/* 시간 휠 */}
<Text
  style={[
    styles.cardHeader,
    { fontSize: 20, marginTop: 10, marginBottom: 10, color: '#3c6300' },
  ]}
>
  알림 시간
</Text>

<View
  style={[
    styles.wheelContainer,
    {
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#d8f999',
      paddingVertical: 20,
      backgroundColor: '#fff',
    },
  ]}
>
  {/* AM/PM */}
  <View style={styles.ampmCol}>
    <TouchableOpacity
      onPress={() => toggleAmPm('AM')}
      style={[styles.ampmBtn, ampm === 'AM' && styles.ampmBtnActive]}
    >
      <Text
        style={[styles.ampmText, ampm === 'AM' && styles.ampmTextActive]}
      >
        AM
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => toggleAmPm('PM')}
      style={[styles.ampmBtn, ampm === 'PM' && styles.ampmBtnActive]}
    >
      <Text
        style={[styles.ampmText, ampm === 'PM' && styles.ampmTextActive]}
      >
        PM
      </Text>
    </TouchableOpacity>
  </View>

  {/* 시/분 휠 묶음 */}
  <View style={styles.hmWrapper}>
    {/* 시 */}
    <View style={styles.wheel}>
      <ScrollView
        ref={hourRef}
        nestedScrollEnabled={Platform.OS !== 'web'}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setOuterScrollEnabled(false)}
        onScrollEndDrag={(e) => {
          setOuterScrollEnabled(true);
          if (Platform.OS === 'web') {
            onHourScrollEnd(e);
          }
        }}
        onMomentumScrollEnd={(e) => {
          setOuterScrollEnabled(true);
          onHourScrollEnd(e);
        }}
        onScroll={(e) => {
          if (Platform.OS === 'web') {
            const offsetY = e.nativeEvent.contentOffset.y;
            const index = Math.round(offsetY / H_ITEM_H);
            if (index >= 0 && index < hoursLoop.length) {
              setHourLoopIndex(index);
            }
          }
        }}
        snapToInterval={Platform.OS !== 'web' ? H_ITEM_H : undefined}
        decelerationRate="fast"
        scrollEventThrottle={16}
        style={
          Platform.OS === 'web'
            ? {
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                cursor: 'grab',
              }
            : {}
        }
      >
        <View style={{ height: 2 * H_ITEM_H }} />
        {hoursLoop.map((h, i) => (
          <TouchableOpacity
            key={`h-${i}`}
            activeOpacity={0.7}
            style={[styles.wheelItem, { height: H_ITEM_H }]}
            onPress={() => {
              if (hourRef.current) {
                hourRef.current.scrollTo({
                  y: i * H_ITEM_H,
                  animated: true,
                });
                setHourLoopIndex(i);
                setTimeout(() => {
                  const scrollEvent = {
                    nativeEvent: {
                      contentOffset: { y: i * H_ITEM_H, x: 0 },
                    },
                  };
                  onHourScrollEnd(scrollEvent);
                }, 300);
              }
            }}
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
          </TouchableOpacity>
        ))}
        <View style={{ height: 2 * H_ITEM_H }} />
      </ScrollView>
    </View>

    <Text style={styles.wheelColon}>:</Text>

    {/* 분 */}
    <View style={styles.wheel}>
      <ScrollView
        ref={minuteRef}
        nestedScrollEnabled={Platform.OS !== 'web'}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setOuterScrollEnabled(false)}
        onScrollEndDrag={(e) => {
          setOuterScrollEnabled(true);
          if (Platform.OS === 'web') {
            onMinuteScrollEnd(e);
          }
        }}
        onMomentumScrollEnd={(e) => {
          setOuterScrollEnabled(true);
          onMinuteScrollEnd(e);
        }}
        onScroll={(e) => {
          if (Platform.OS === 'web') {
            const offsetY = e.nativeEvent.contentOffset.y;
            const index = Math.round(offsetY / M_ITEM_H);
            if (index >= 0 && index < minutesLoop.length) {
              setMinuteLoopIndex(index);
            }
          }
        }}
        snapToInterval={Platform.OS !== 'web' ? M_ITEM_H : undefined}
        decelerationRate="fast"
        scrollEventThrottle={16}
        style={
          Platform.OS === 'web'
            ? {
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                cursor: 'grab',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }
            : {}
        }
      >
        <View style={{ height: 2 * M_ITEM_H }} />
        {minutesLoop.map((m, i) => (
          <TouchableOpacity
            key={`m-${i}`}
            activeOpacity={0.7}
            style={[styles.wheelItem, { height: M_ITEM_H }]}
            onPress={() => {
              if (minuteRef.current) {
                minuteRef.current.scrollTo({
                  y: i * M_ITEM_H,
                  animated: true,
                });
                setMinuteLoopIndex(i);
                setTimeout(() => {
                  const scrollEvent = {
                    nativeEvent: {
                      contentOffset: { y: i * M_ITEM_H, x: 0 },
                    },
                  };
                  onMinuteScrollEnd(scrollEvent);
                }, 300);
              }
            }}
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
          </TouchableOpacity>
        ))}
        <View style={{ height: 2 * M_ITEM_H }} />
      </ScrollView>
    </View>
  </View>

  {/* 가운데 하이라이트 바 */}
  <View
    pointerEvents="none"
    style={{
      position: 'absolute',
      top: (WHEEL_H - H_ITEM_H) / 2,
      height: H_ITEM_H,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(216, 249, 153, 0.3)',
      borderRadius: 8,
      borderWidth: 3,
      borderColor: 'rgba(216, 249, 153, 0.5)',
      zIndex: 10,
    }}
  />
</View>

            {/* 미리보기 */}
            <View style={[styles.card, { borderColor: '#d8f999', padding: 15, marginTop: 20, borderWidth: 2 }]}>
              <View style={styles.iosPreviewContainer}>
                <Text style={styles.previewSectionLabel}>
                  🔔 알림 미리보기
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
            </View>

            {/* 버튼 */}
            <View
              style={{
                flexDirection: 'column',
                zIndex: 10,
                elevation: 10,
              }}
            >
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1, marginBottom: 10, paddingVertical: 20, backgroundColor: '#9ae600' }]}
                onPress={saveAlarm}
              >
                <Text style={styles.btnPrimaryText}>💾 저장</Text>
              </TouchableOpacity>
              <View style={{ width: 8 }} />
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, { flex: 1, paddingVertical: 20 }]}
                onPress={cancelEdit}
              >
                <Text style={styles.btnOutlineText}>취소</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 8 }} />
            <Text style={styles.notifyHint}>
               {`매주 ${repeatDays
                    .map((d) =>
                      ['일', '월', '화', '수', '목', '금', '토'][
                        d
                      ]
                    )
                   .join(', ')} 반복`}
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
      <ScrollView contentContainerStyle={[styles.screenContainer, {paddingBottom: 100}]}>
        {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.replace('Home')}
              style={styles.backButton}
            >
              <Feather name="chevron-left" size={22} color="#444" />
            </TouchableOpacity>
  
            <Text style={styles.headerTitle}>🌿 나의 알림 화면</Text>
          </View>
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🔔 알림 시간 설정</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, {paddingVertical: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9ae600'}]}
            onPress={() => {
              setIsAdding(true);
              hasScrolledToInitial.current = false;
            }}
          >
            <Text style={styles.btnPrimaryText}>+ 새 알림 추가</Text>
          </TouchableOpacity>
        </View>

         <View style={{padding: 16}}>
          <View style={[styles.listHeader, {justifyContent: 'left'}]}>
            <Feather name="bell" size={22} color="#388E3C" />
            <Text style={[styles.cardHeader, {fontSize: 20, marginBottom: 5, color: '#388E3C', marginLeft: 5}]}>
              저장된 알림 ({alarms.length}개)
            </Text>
          </View>

          {alarms.map((alarm) => (
            <View key={alarm.id} style={[styles.alarmItem, 
              {borderWidth: 1, 
              borderColor: '#EEEEEE', 
              backgroundColor: '#fff',
              borderRadius: 15, 
              padding: 10, 
              marginBottom: 10}]}>
              <Text style={{ fontSize: 28, marginRight: 6 }}>
                {alarm.emoji}
              </Text>
              <View style={styles.alarmInfo}>
                {alarm.message && (
                  <Text style={[styles.alarmMessage, { marginBottom: 5 }]}>
                    {alarm.message}
                  </Text>
                )}

                <Text style={styles.alarmDesc}>
                   {`매주 ${alarm.repeatDays
                        .map((d) =>
                          [
                            '일',
                            '월',
                            '화',
                            '수',
                            '목',
                            '금',
                            '토',
                          ][d]
                        )
                        .join(', ')} 반복`}
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
          
          {/* ----------------- 추천 알림 Section ----------------- */}
          <View>
            <View style={{flexDirection: 'row'}}>
              <Feather name="gift" size={22} color="#388E3C" />
              <Text style={[styles.cardHeader, {fontSize: 20, marginBottom: 5, color: '#388E3C', marginLeft: 5}]}> 추천 알림</Text>
            </View>
          </View>
          <View>

            {recommendedAlarms.map((rec) => (
              <View
                key={rec.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderWidth: 2,
                  borderRadius: 10,
                  marginBottom: 10,
                  borderColor: "#d8f999",
                  padding: 10,
                  backgroundColor: '#f7fee7',
                  shadowColor: '#000',
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <View style={{ flexDirection: 'row' }}>
                  <Text style={{ fontSize: 28, marginRight: 6, alignItems: 'center' }}>
                    {rec.emoji}
                  </Text>
                  <View style={{ flexDirection: 'column' }}>
                    <Text style={{ fontSize: 16, fontWeight: 600, marginBottom: 5 }}>{rec.message}</Text>
                    <Text style={styles.alarmDesc}>
                      {`매주 ${rec.repeatDays
                            .map((d) =>
                              [
                                '일',
                                '월',
                                '화',
                                '수',
                                '목',
                                '금',
                                '토',
                              ][d]
                            )
                            .join(', ')} 반복`}
                    </Text>
                    
                    <Text style={[styles.alarmTime]}>
                      {rec.ampm} {String(rec.hour).padStart(2, "0")} : {String(rec.minute).padStart(2, "0")}
                    </Text>
                  </View>
                </View>
                  <TouchableOpacity
                    onPress={() => addRecommendedAlarm(rec)}
                    style={{
                      backgroundColor: "#9ae600",
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: 'center',
                  }}
                   >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>추가</Text>
                  </TouchableOpacity>
              </View>
            ))}
          </View>  
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
    backgroundColor: '#f7fee7',
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
    ...(Platform.OS === 'web' && {
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      cursor: 'grab',
      position: 'relative',
    }),
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      userSelect: 'none',
      WebkitUserSelect: 'none',
      pointerEvents: 'auto',
    }),
  },
  wheelText: {
    fontSize: 18,
    color: '#6b7280',
  },
  wheelTextActive: {
    fontSize: 22,
    color: '#4c8032',
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
    backgroundColor: '#9ae600',
    borderColor: '#9ae600',
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
    backgroundColor: '#9ae600',
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
    marginTop: 5,
    marginBottom: 10,
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
  hmWrapper: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "65%",          // <-- IMPORTANT: only H+M columns width
  alignSelf: "center",
  position: "relative",
  },
  wheelHighlight: {
    position: "absolute",
    top: (40 * 5 - 40) / 2,  // (WHEEL_H - ITEM_H)/2
    height: 40,
    width: "100%",
    backgroundColor: "rgba(216, 249, 153, 0.35)",
    borderRadius: 8,
    zIndex: -1,
  },
  emojiRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "felx-start",
  alignItmes: "center",
  marginVertical: 10,
 },

  emojiButton: {
    padding: 8,
    borderRadius: 10,
    marginRight: 8,          // spacing between items (fallback if gap not supported)
    marginBottom: 8,         // spacing between rows when wrapped
    minWidth: 48,            // keeps touch targets reasonable
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },

  emojiButtonActive: {
    backgroundColor: "#d8f999",
    borderRadius: 12,
    transform: [{ scale: 1.05 }], // subtle emphasis
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 6,
    marginBottom: 10,
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
});

export default NotificationsScreen;
