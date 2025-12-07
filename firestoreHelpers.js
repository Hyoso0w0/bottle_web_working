// firestoreHelpers.js
import { auth, db } from "./firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  increment,
  serverTimestamp,
  getDoc, 
} from "firebase/firestore";


/**
 * 미션 완료 기록 + 누적 통계 업데이트
 * mission: { id, name, water, waste, co2, ... }
 * localTime: HomeScreen에서 이미 만들고 있는 {year, month, date, ...} 객체
 * timeSlot: morning/afternoon/evening
 */
export const saveMissionCompletion = async (mission, localTime, timeSlot) => {
  const user = auth.currentUser;
  if (!user) return; // 로그인 안 됐으면 그냥 로컬에만 저장

  const userRef = doc(db, "users", user.uid);
  const completedRef = collection(userRef, "completedMissions");

  // 1) 완료 기록 하나 추가
  await addDoc(completedRef, {
    missionId: mission.id,
    missionName: mission.name,
    water: mission.water,
    waste: mission.waste,
    co2: mission.co2,
    completedAt: localTime,      // 네가 쓰던 로컬 시간 객체 그대로 저장
    timeSlot,
    createdAt: serverTimestamp() // Firestore 서버 타임스탬프
  });

  // 2) 누적 통계 stats 업데이트
  const statsRef = doc(userRef, "stats", "env");
  await setDoc(
    statsRef,
    {
      totalWater: increment(mission.water || 0),
      totalWaste: increment(mission.waste || 0),
      totalCO2: increment(mission.co2 || 0),
      totalCompleted: increment(1),
    },
    { merge: true }
  );
};


// 알림 저장
export const saveAlarmsForUser = async (alarmsList) => {
  const user = auth.currentUser;
  if (!user) {
    console.log("⚠️ [saveAlarmsForUser] user 없음, 저장 스킵");
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const alarmsDocRef = doc(userRef, "meta", "alarms");

  console.log("🔥 [saveAlarmsForUser] Firestore 저장 시작");
  console.log("   - uid:", user.uid);
  console.log("   - 전달받은 알람 개수:", alarmsList.length);
  console.log(
    "   - 전달받은 알람 목록:",
    alarmsList.map(a => ({
      id: a.id,
      enabled: a.enabled,
      time: `${a.ampm} ${a.hour}:${a.minute}`,
      repeatDaily: a.repeatDaily,
      repeatDays: a.repeatDays,
      selectedYMD: a.selectedYMD,
    }))
  );

  await setDoc(
    alarmsDocRef,
    {
      alarms: alarmsList,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log("   - ✅ setDoc 완료, 바로 getDoc으로 확인해봄");

  const snap = await getDoc(alarmsDocRef);
  if (!snap.exists()) {
    console.log("   - ❌ setDoc 후에도 문서가 존재하지 않음 (이상함)");
  } else {
    const data = snap.data();
    const arr = Array.isArray(data.alarms) ? data.alarms : [];
    console.log("   - 📄 setDoc 직후 문서 내용 확인");
    console.log("     · alarms 필드 타입:", Array.isArray(data.alarms) ? "array" : typeof data.alarms);
    console.log("     · alarms 개수:", arr.length);
    console.log(
      "     · alarms 목록:",
      arr.map(a => ({
        id: a.id,
        enabled: a.enabled,
        time: `${a.ampm} ${a.hour}:${a.minute}`,
      }))
    );
  }

  console.log("✅ [saveAlarmsForUser] Firestore 저장 + 검증 완료");
};

// 🔔 알림 불러오기
export const loadAlarmsForUser = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.log("⚠️ [loadAlarmsForUser] user 없음, null 반환");
    return null;
  }

  const userRef = doc(db, "users", user.uid);
  const alarmsDocRef = doc(userRef, "meta", "alarms");
  const snap = await getDoc(alarmsDocRef);

  if (!snap.exists()) {
    console.log("ℹ️ [loadAlarmsForUser] 문서 없음 (처음일 수 있음)");
    return null;
  }

  const data = snap.data();
  console.log("✅ [loadAlarmsForUser] 문서 존재. 필드:", Object.keys(data));
  console.log("   - alarms 필드 타입:", Array.isArray(data.alarms) ? "array" : typeof data.alarms);
  console.log("   - alarms 개수:", Array.isArray(data.alarms) ? data.alarms.length : "N/A");

  return data.alarms || [];
};