// AppContext.js
import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🔥 Firestore / Auth import
import { db, auth } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export const AppContext = createContext();

export default function AppProvider({ children }) {
  const [user, setUser] = useState(null);

  const [completedMissions, setCompletedMissions] = useState([]);
  const [stats, setStats] = useState({
    totalWater: 0,
    totalWaste: 0,
    totalCO2: 0,
  });

  // 알람
  const [alarms, setAlarms] = useState([]);

  // 쿠키
  const [cookieStats, setCookieStats] = useState({ totalCookies: 0 });

  /* =========================================
   *  0. Firebase Auth 상태 구독
   * =======================================*/
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser || null);

      if (!fbUser) {
        // 로그아웃 상태면 로컬(AsyncStorage)만 사용
        await loadLocalOnlyData();
        return;
      }

      // 로그인 상태면 Firestore 우선 로드
      await loadUserDataFromFirestore(fbUser.uid);
    });

    return () => unsub();
  }, []);

  /* =========================================
   *  1. Firestore에서 사용자 데이터 로드
   * =======================================*/
  const loadUserDataFromFirestore = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);

      // 1) 통계 stats
      const statsRef = doc(userRef, "stats", "env");
      const statsSnap = await getDoc(statsRef);
      if (statsSnap.exists()) {
        const data = statsSnap.data();
        setStats({
          totalWater: data.totalWater || 0,
          totalWaste: data.totalWaste || 0,
          totalCO2: data.totalCO2 || 0,
        });
      }

      // 2) 완료된 미션 목록
      const completedRef = collection(userRef, "completedMissions");
      const qCompleted = query(
        completedRef,
        orderBy("completedAt.timestamp", "desc")
      );
      const completedSnap = await getDocs(qCompleted);
      const missions = completedSnap.docs.map((d) => d.data());
      setCompletedMissions(missions);

      // // 3) 알림 목록 (meta/alarms 문서)
      // const alarmsRef = doc(userRef, "meta", "alarms");
      // const alarmsSnap = await getDoc(alarmsRef);
      // if (alarmsSnap.exists()) {
      //   const data = alarmsSnap.data();
      //   if (Array.isArray(data.alarms)) {
      //     setAlarms(data.alarms);
      //   }
      // } else {
      //   // Firestore에 없으면 로컬에서 가져와서 Firestore에 한 번 업로드
      //   const localAlarms = await loadAlarmsFromAsyncStorage();
      //   if (localAlarms.length > 0) {
      //     await setDoc(alarmsRef, { alarms: localAlarms }, { merge: true });
      //     setAlarms(localAlarms);
      //   }
      // }

      // 4) 쿠키 (옵션: meta/cookies 문서로 저장)
      const cookieRef = doc(userRef, "meta", "cookies");
      const cookieSnap = await getDoc(cookieRef);
      if (cookieSnap.exists()) {
        const data = cookieSnap.data();
        setCookieStats({
          totalCookies: data.totalCookies || 0,
        });
      } else {
        // 없으면 로컬 값 업로드
        const localCookiesString = await AsyncStorage.getItem("@cookies");
        if (localCookiesString) {
          const localCookies = JSON.parse(localCookiesString);
          setCookieStats(localCookies);
          await setDoc(cookieRef, localCookies, { merge: true });
        }
      }
    } catch (err) {
      console.log("🔥 Firestore 데이터 로드 중 오류:", err);
      // 혹시 실패하면 로컬 데이터라도 사용
      await loadLocalOnlyData();
    }
  };

  /* =========================================
   *  2. 로컬(AsyncStorage)에서만 로드 (비로그인용)
   * =======================================*/
  const loadLocalOnlyData = async () => {
    // completedMissions & stats는 지금은 Firestore에서만 관리한다고 가정해도 되고,
    // 필요하면 AsyncStorage로도 별도 저장 가능.
    // 여기서는 알람/쿠키만 로컬용으로 유지.
    const localAlarms = await loadAlarmsFromAsyncStorage();
    setAlarms(localAlarms);

    const localCookiesString = await AsyncStorage.getItem("@cookies");
    if (localCookiesString) {
      setCookieStats(JSON.parse(localCookiesString));
    }
  };

  const loadAlarmsFromAsyncStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem("@bottle_alarms");
      if (stored) return JSON.parse(stored);
      return [];
    } catch (err) {
      console.log("Failed to load alarms from AsyncStorage: ", err);
      return [];
    }
  };

  /* =========================================
   *  3. 미션 완료 시 처리 + Firestore 저장
   *  (HomeScreen에서 사용)
   * =======================================*/
  const addCompletedMission = async (mission) => {
    // mission은 HomeScreen에서 넘겨준 그대로 (completedAt, timeSlot, water, waste, co2 포함)
    setCompletedMissions((prev) => [...prev, mission]);

    const water = Number(mission.water || 0);
    const waste = Number(mission.waste || 0);
    const co2 = Number(mission.co2 || 0);

    // 로컬 stats 즉시 업데이트 (UX용)
    setStats((prev) => ({
      totalWater: prev.totalWater + water,
      totalWaste: prev.totalWaste + waste,
      totalCO2: prev.totalCO2 + co2,
    }));

    // Firestore에 저장
    try {
      if (!user) return; // 로그인 안 되어 있으면 그냥 로컬만

      const userRef = doc(db, "users", user.uid);

      // 1) 완료 미션 하나 추가 (완료 날짜 객체 포함)
      const completedRef = collection(userRef, "completedMissions");
      await addDoc(completedRef, mission);

      // 2) 누적 stats 업데이트 (increment 사용)
      const statsRef = doc(userRef, "stats", "env");
      await setDoc(
        statsRef,
        {
          totalWater: increment(water),
          totalWaste: increment(waste),
          totalCO2: increment(co2),
        },
        { merge: true }
      );
    } catch (err) {
      console.log("🔥 Firestore에 미션 저장 중 오류:", err);
    }
  };

  /* =========================================
   *  4. 알람 상태 → AsyncStorage + Firestore 동기화
   * =======================================*/

  // 기존: 앱 시작 시 AsyncStorage에서 load (비로그인 대비)
  useEffect(() => {
    const init = async () => {
      // 로그인 되어 있다면 loadUserDataFromFirestore에서 알람을 세팅해주므로
      // 여기서는 "비로그인 상태"일 때만 역할.
      if (!user) {
        const local = await loadAlarmsFromAsyncStorage();
        setAlarms(local);
      }
    };
    init();
    // ⚠ user가 바뀔 때 Firestore 로드를 다시 함. (위 onAuthStateChanged에서 처리)
  }, [user]);

  // 알람이 바뀔 때마다 AsyncStorage + Firestore에 저장
  useEffect(() => {
  const saveAlarms = async () => {
    try {
      await AsyncStorage.setItem("@bottle_alarms", JSON.stringify(alarms));
    } catch (err) {
      console.log("Failed to save alarms: ", err);
    }
  };
  saveAlarms();
}, [alarms]);

  /* =========================================
   *  5. 쿠키(알람 완료 → 쿠키 +10) Firestore 동기화
   * =======================================*/
  const addCompletedAlarms = (alarm) => {
    setCookieStats((prev) => ({
      totalCookies: prev.totalCookies + 10,
    }));
  };

  useEffect(() => {
    const saveCookies = async () => {
      await AsyncStorage.setItem("@cookies", JSON.stringify(cookieStats));

      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const cookieRef = doc(userRef, "meta", "cookies");
          await setDoc(
            cookieRef,
            { totalCookies: cookieStats.totalCookies },
            { merge: true }
          );
        } catch (err) {
          console.log("🔥 쿠키 Firestore 저장 오류:", err);
        }
      }
    };
    saveCookies();
  }, [cookieStats, user]);

  /* =========================================
   *  Context 값 제공
   * =======================================*/
  return (
    <AppContext.Provider
      value={{
        completedMissions,
        setCompletedMissions,
        stats,
        addCompletedMission,

        alarms,
        setAlarms,

        cookieStats,
        addCompletedAlarms,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
