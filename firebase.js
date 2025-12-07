// firebase.js
import { initializeApp } from "firebase/app";
import { Platform } from "react-native";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";

// 🔥 expo-config에서 firebase 키 불러오기
const {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
} = Constants.expoConfig.extra;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

// 🔥 앱 초기화
const app = initializeApp(firebaseConfig);

// 🔥 플랫폼별 Auth 초기화
let auth;
if (Platform.OS === 'web') {
  // 웹에서는 getAuth 사용
  const { getAuth } = require("firebase/auth");
  auth = getAuth(app);
} else {
  // React Native에서는 initializeAuth 사용
  const { initializeAuth, getReactNativePersistence } = require("firebase/auth");
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // 이미 초기화된 경우 getAuth 사용
    if (error.code === 'auth/already-initialized') {
      const { getAuth } = require("firebase/auth");
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
}

export { auth };

// Firestore
export const db = getFirestore(app);
