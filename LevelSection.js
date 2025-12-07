import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getLevelInfo } from './utils/levelUtils';

export default function LevelSection({ label, unit, emoji, value, stages }) {
  const info = getLevelInfo(value, stages);


  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}{unit}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBackground}>
        <View
          style={[styles.progressFill, { width: `${info.progress}%` }]}
        />
      </View>

      {/* Level + result */}
      <View
       style={[(info.property == "waste") ? styles.statistics_card_waste : (info.property == "water") ? styles.statistics_card_water : styles.statistics_card_co2]}
      >
        <Text style={styles.levelText}>
            Lv.{info.currentStage} – {info.result}
        </Text>
      </View>

      {/* Amount to next level */}
      <Text style={styles.nextText}>
        {value}{unit} / {info.currentTarget}{unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#b4df7a'
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  emoji: { fontSize: 32, marginRight: 12 },
  label: { fontSize: 14, color: '#444', fontWeight: '600' },
  value: { fontSize: 16, color: '#4a7', fontWeight: '700' },
  progressBackground: {
    backgroundColor: '#eee',
    height: 10,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#68c060'
  },
  levelText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
    fontWeight: 600,
  },
  nextText: {
    fontSize: 12,
    color: '#777',
    textAlign: 'right'
  },
  statistics_card_waste: {
    borderRadius: 10,
    borderColor: "#ff9e61ff",
    borderWidth: 2,
    padding: 10,
    backgroundColor: '#ffefe2ff',
    marginTop: 5,
    marginBottom: 5,
  },
  statistics_card_water: {
    borderRadius: 10,
    borderColor: "#90e3ffff",
    borderWidth: 2,
    padding: 10,
    backgroundColor: '#eafbffff',
    marginTop: 5,
    marginBottom: 5,
  },
  statistics_card_co2: {
    borderRadius: 10,
    borderColor: '#81f77bff',
    borderWidth: 2,
    padding: 10,
    backgroundColor: '#e9ffe7ff',
    marginTop: 5,
    marginBottom: 5,
  },
});
