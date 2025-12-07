// LoginScreen.js
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
      setError("로그인 실패: " + e.message);
    }
  };

  const handleSignup = async () => {
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
    } catch (e) {
      setError("회원가입 실패: " + e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isSignup ? "회원가입" : "로그인"}</Text>

      {error !== "" && <Text style={styles.errorText}>{error}</Text>}

      <TextInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#8BA293"
        style={styles.input}
      />

      <TextInput
        placeholder="비밀번호"
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        placeholderTextColor="#8BA293"
        style={styles.input}
      />

      {isSignup ? (
        <Pressable onPress={handleSignup} style={styles.mainButton}>
          <Text style={styles.mainButtonText}>회원가입</Text>
        </Pressable>
      ) : (
        <Pressable onPress={handleLogin} style={styles.mainButton}>
          <Text style={styles.mainButtonText}>로그인</Text>
        </Pressable>
      )}

      <Pressable onPress={() => setIsSignup(!isSignup)}>
        <Text style={styles.switchText}>
          {isSignup ? "로그인 화면으로" : "계정이 없나요? 회원가입"}
        </Text>
      </Pressable>
    </View>
  );
}

const PRIMARY = "#345943";   // 진한 초록
const BG = "#EFF5E8";        // 연한 연두

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    color: PRIMARY,
    marginBottom: 24,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 12,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C6D4C5",
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 14,
    color: PRIMARY,
  },
  mainButton: {
    backgroundColor: PRIMARY,
    padding: 14,
    borderRadius: 999,
    marginTop: 12,
  },
  mainButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  switchText: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 14,
    color: PRIMARY,
  },
});