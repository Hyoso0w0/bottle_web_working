import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Props:
// - repeatDays: array of numbers 0-6 (0=Sun, 6=Sat)
// - setRepeatDays: function to update repeatDays state
const WeekdayPicker = ({ repeatDays, setRepeatDays }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (index) => {
    if (repeatDays.includes(index)) {
      setRepeatDays(repeatDays.filter(d => d !== index));
    } else {
      setRepeatDays([...repeatDays, index]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>반복 요일 선택</Text>
      <View style={styles.row}>
        {days.map((day, idx) => {
          const isActive = repeatDays.includes(idx);
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayBtn, isActive && styles.dayBtnActive]}
              onPress={() => toggleDay(idx)}
            >
              <Text style={[styles.dayText, isActive && styles.dayTextActive]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dayBtnActive: {
    backgroundColor: '#3c8c4c',
    borderColor: '#3c8c4c',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  dayTextActive: {
    color: '#fff',
  },
});

export default WeekdayPicker;
