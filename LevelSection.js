import React, { useMemo, useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppContext } from "./AppContext";

// THEME MAP
const themes = {
  "물 절약 미션": {
    dark: "#3B82F6",
    mid: "#60A5FA",
    light: "#93C5FD",
    container_background: '#dbeafe',
  },
  "쓰레기 절감 미션": {
    dark: "#F59E0B",
    mid: "#fb7324ff",
    light: "#ffd7a2ff",
    container_background: '#ffedd4',
  },
  "탄소 절감 미션": {
    dark: "#22C55E",
    mid: "#4ADE80",
    light: "#86EFAC",
    container_background: '#dcfce7',
  },
};

const LevelSection = ({ label, emoji, unit, value, stages }) => {
  const { completedMissions, stats, cookieStats } = useContext(AppContext);

  // Pick theme by label
  const theme =
    themes[label] || { dark: "#555", mid: "#999", light: "#ddd" };

  // --- Compute current level ---
  const { levelIndex, levelMin, levelMax, overflow, nextGoal } = useMemo(() => {
    let idx = 0;

    while (idx < stages.length && value >= stages[idx].target) {
      idx++;
    }
 const current = Math.min(idx, stages.length - 1);

    const prevTarget = current === 0 ? 0 : stages[current - 1].target;
    const target = stages[current].target;

    return {
      levelIndex: current,
      levelMin: prevTarget,
      levelMax: target,
      overflow: value - prevTarget,
      nextGoal: target,
    };
  }, [value, stages]);

  const progressRatio = Math.min(overflow / (levelMax - levelMin), 1);

  return (
     <View style={styles.card}>

      {/* Header */}

      {/* Bubble Chain */}
      <View style={styles.chainRow}>
        {stages.map((s, idx) => {
          const isFinished = idx < levelIndex;
          const isCurrent = idx === levelIndex;
          const isFuture = idx > levelIndex;

          const bubbleStyle = [
            styles.bubble,
            { borderColor: theme.dark },
            isFinished && { backgroundColor: theme.dark },
            isCurrent && { backgroundColor: "#fff" },
            isFuture && { backgroundColor: theme.light },
          ];

          const textStyle = [
            styles.bubbleText,
            isFinished && { color: "#fff" },
            isCurrent && { color: theme.dark },
          ];

          return (
            <React.Fragment key={idx}>
              <View style={bubbleStyle}>
                <Text style={textStyle}>{idx + 1}</Text>
              </View>

              {/* Connecting Bar */}
              {idx < stages.length - 1 && (
                <View
                  style={[
                    styles.bar,
                    { backgroundColor: isFinished ? theme.dark : theme.light },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
<View style={[styles.container, {backgroundColor: theme.container_background, borderColor: theme.dark}]}>

        {/* Level Badge + Result */}
        <View
          style={{ flexDirection: "row", marginTop: 10 }}
        >
          <Text style={[styles.levelText, {color: theme.dark}]}>Lv.{levelIndex + 1}</Text>

       {/* Add stage.result here */}
          <Text style={[styles.resultText, { color: theme.dark, flex: 1, fontSize: 14 }]}>
            {"  -  "}
            {stages[levelIndex].result}
          </Text>
        </View>

        {/* Progress Bar */}
        <View
          style={[
            styles.progressBackground,
            { backgroundColor: theme.light },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${progressRatio * 100}%`, backgroundColor: theme.dark },
            ]}
          />
        </View>

        {/* Progress Numbers */}
        <Text style={styles.progressLabel}>
          {value.toLocaleString()} {unit} / {nextGoal.toLocaleString()} {unit}
        </Text>
      </View>

     
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 18 },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  emoji: { fontSize: 22, marginRight: 8 },
  label: { fontSize: 20, fontWeight: "700" },

  levelBadge: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  levelText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
   resultText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 4,
  },
   chainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleText: {
    fontSize: 16,
    fontWeight: "600",
  },
  bar: {
    height: 4,
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 2,
  },

  progressBackground: {
    height: 14,
    marginTop: 15,
    borderRadius: 8,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
  },

  progressLabel: {
    marginTop: 8,
    fontSize: 14,
    color: "#555",
    textAlign: "right",
  },

  container: {
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginTop: 15,
    marginBottom: 10,
    borderWidth: 1,
  }
});
export default LevelSection;