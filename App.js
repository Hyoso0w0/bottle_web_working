// App.js
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 🔥 Firebase Auth 관련
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

// 로그인/시작 화면
import LoginScreen from './LoginScreen';
import StartScreen from './StartScreen';

// 전역 Context
import AppProvider from './AppContext';

// AsyncStorage 안전하게 import
let AsyncStorage;
try {
  const AsyncStorageModule = require('@react-native-async-storage/async-storage');
  AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
  if (!AsyncStorage || AsyncStorage === null) {
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

// 화면들
import HomeScreen from './HomeScreen';
import RecordsScreen from './RecordsScreen';
import NotificationsScreen from './NotificationsScreen';
import CalendarScreen from './CalendarScreen';
import ReportScreen from './ReportScreen';

// 알림 핸들러 설정 (앱이 foreground일 때 어떻게 보일지)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** ---------- 네비게이션 ---------- **/
const Stack = createNativeStackNavigator();

// 스케줄링 시작 시간을 전역으로 관리 (알림 필터링용)
// NotificationsScreen에서 설정하고 App.js에서 사용
if (typeof global !== 'undefined') {
  global.lastSchedulingStartTime = 0;
}

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  // ✅ 로그인 상태
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ✅ Firebase auth 구독
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const onLogout = () => signOut(auth);

  // 알림 스케줄링 헬퍼 함수 (필요하면 NotificationsScreen 등에서 import해서 써도 됨)
  const scheduleAlarms = async (alarmsList) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      const pad2 = (n) => String(n).padStart(2, '0');
      const as24h = (h12, meridiem) => {
        if (meridiem === 'AM') return h12 % 12;
        return (h12 % 12) + 12;
      };

      for (const alarm of alarmsList) {
        // 저장된 시간 데이터 확인 (hour, minute, ampm)
        if (!alarm.hour || alarm.minute === undefined || !alarm.ampm) {
          console.warn(
            `알림 시간 데이터 누락: ID ${alarm.id}, hour: ${alarm.hour}, minute: ${alarm.minute}, ampm: ${alarm.ampm}`
          );
          continue;
        }

        const hour24 = as24h(alarm.hour, alarm.ampm);
        const content = {
          title: '마이에코 🌱',
          body:
            alarm.message ||
            `${alarm.ampm} ${pad2(alarm.hour)}:${pad2(
              alarm.minute
            )} 알림이에요.`,
          data: { screen: 'Home', alarmId: alarm.id },
        };

        if (alarm.repeatDaily) {
          // 매일 반복
          const now = new Date();
          const todayAtTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hour24,
            alarm.minute,
            0,
            0
          );

          let firstNotificationTime = todayAtTime;
          if (todayAtTime <= now) {
            // 오늘 시간이 지났으면 내일
            firstNotificationTime = new Date(
              todayAtTime.getTime() + 24 * 60 * 60 * 1000
            );
          }

          try {
            const notificationId =
              await Notifications.scheduleNotificationAsync({
                content,
                trigger: {
                  date: firstNotificationTime,
                  repeats: true,
                },
              });
            const timeDesc =
              firstNotificationTime > todayAtTime ? '내일부터' : '오늘부터';
            console.log(
              `알림 스케줄링 완료: ${alarm.ampm} ${pad2(
                alarm.hour
              )}:${pad2(
                alarm.minute
              )} (${timeDesc} 시작, 첫 알림: ${firstNotificationTime.toLocaleString()}, 매일 반복, ID: ${notificationId})`
            );
          } catch (e) {
            console.warn(
              `알림 스케줄링 실패: ${alarm.ampm} ${pad2(
                alarm.hour
              )}:${pad2(alarm.minute)}`,
              e
            );
          }
        } else if (alarm.selectedYMD) {
          // 특정 날짜 한 번
          const when = new Date(
            alarm.selectedYMD.year,
            alarm.selectedYMD.month,
            alarm.selectedYMD.day,
            hour24,
            alarm.minute,
            0,
            0
          );
          const now = new Date();
          if (when > now) {
            await Notifications.scheduleNotificationAsync({
              content,
              trigger: { date: when },
            });
          }
        }
      }
    } catch (e) {
      console.warn('알림 예약 오류:', e);
    }
  };

  useEffect(() => {
    // 1) 권한 요청 및 안드로이드 채널 설정
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          sound: true,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    })();

    // 2) 알림 수신 리스너(앱 열려 있을 때)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const notificationData = notification.request.content;
        const alarmId = notificationData.data?.alarmId || '알 수 없음';
        const notificationTime = new Date(notification.date);
        const identifier = notification.request.identifier;

        const now = Date.now();
        const lastSchedulingStartTime =
          typeof global !== 'undefined'
            ? global.lastSchedulingStartTime || 0
            : 0;
        const timeSinceLastScheduling = now - lastSchedulingStartTime;

        // 스케줄링 직후 30초 이내 알림은 무시
        if (lastSchedulingStartTime > 0 && timeSinceLastScheduling < 30000) {
          console.log('========================================');
          console.log('[알림 필터링] 스케줄링 직후 발송된 알림을 무시합니다');
          console.log(`  - 알림 식별자: ${identifier}`);
          console.log(
            `  - 발송 시간: ${notificationTime.toLocaleString()}`
          );
          console.log(
            `  - 마지막 스케줄링 후 경과 시간: ${Math.floor(
              timeSinceLastScheduling / 1000
            )}초`
          );
          console.log(
            `  - 이 알림은 설정한 시간(${alarmId})에 발송된 것이 아닙니다`
          );
          console.log(
            `  - 설정한 시간에 정확히 발송된 알림만 표시됩니다`
          );
          console.log('========================================');
          return;
        }

        console.log('========================================');
        console.log('[알림 발송] 알림이 설정한 시간에 발송되었습니다!');
        console.log(
          `  - 실제 발송 시간: ${notificationTime.toLocaleString()}`
        );
        console.log(`  - 알림 제목: ${notificationData.title}`);
        console.log(`  - 알림 내용: ${notificationData.body}`);
        console.log(`  - 알림 ID: ${alarmId}`);
        console.log(`  - 알림 식별자: ${identifier}`);
        console.log('========================================');
      });

    // 3) 알림 클릭 리스너
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('알림 눌렀다!', response);
        // 필요하면 여기서 특정 화면으로 네비게이션
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // ✅ 앱 시작 시 매일미션 완료 상태 리셋 (원래 App.js에 있던 것 유지)
  // useEffect(() => {
  //   const resetDailyCompletion = async () => {
  //     await AsyncStorage.removeItem('completedDailyIds');
  //   };
  //   resetDailyCompletion();
  // }, []);

  // 🔄 아직 auth 상태 로딩 중이면 아무것도 렌더링 안 함
  if (authLoading) return null;

  return (
    <AppProvider>
      <NavigationContainer>
        {user ? (
          // 🔓 로그인 O → 기존 앱 스택
          <Stack.Navigator
            screenOptions={{
              headerTitleAlign: 'center',
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: '첫 화면' }}
            />
            <Stack.Screen
              name="Records"
              component={RecordsScreen}
              options={{ title: '내 기록' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: '알림 설정' }}
            />
            <Stack.Screen
              name="Calendar"
              component={CalendarScreen}
              options={{ title: '캘린더' }}
            />
            <Stack.Screen
              name="Report"
              component={ReportScreen}
              options={{ title: '리포트' }}
            />
          </Stack.Navigator>
        ) : (
          // 🔐 로그인 X → 시작/로그인 스택
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Start" component={StartScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </AppProvider>
  );
}
