// StartScreen.js
import React from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";

export default function StartScreen({ navigation }) {
  const goToLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <View style={styles.container}>
      {/* 가운데 요소 전체 묶음 */}
      <View style={styles.centerBox}>
        <Image
          source={require("./assets/bottle.png")}
          style={styles.bottleImage}
          resizeMode="contain"
        />

        <Text style={styles.logoText}>마이에코</Text>

        {/* 여기로 이동시킴 ✔ */}
        <Text style={styles.subText}>하루의 제로웨이스트</Text>

        <Pressable onPress={goToLogin} style={styles.startButton}>
          <Text style={styles.startButtonText}>시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EFF5E8",
    justifyContent: "center", // ↓ 전체를 더 중앙에
    alignItems: "center",
  },
  centerBox: {
    alignItems: "center",
    gap: 10,
    marginBottom: 40,
  },
  bottleImage: {
    width: 240,
    height: 300,
    marginBottom: -40,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#345943",
    marginBottom: 6,
  },
  subText: {
    fontSize: 16,
    color: "#4F6D57",
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: "#345943",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 999,
  },
  startButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});