import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from "@expo/vector-icons";

// Props:
// - repeatDays: array of numbers 0-6 (0=Sun, 6=Sat)
// - setRepeatDays: function to update repeatDays state
const WeekdayPicker = ({ repeatDays, setRepeatDays }) => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  const toggleDay = (index) => {
    if (repeatDays.includes(index)) {
      setRepeatDays(repeatDays.filter(d => d !== index));
    } else {
      setRepeatDays([...repeatDays, index]);
    }
  };

  return (
    <View style={[styles.container, { 
      backgroundColor: '#fff',
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#d8f999',
      padding: 20
       }]}>
      <View style={{flexDirection: 'row', marginBottom: 10}}>
        <Feather name="calendar" size={22} color="#689F38" />
        <Text style={styles.label}>  알림 요일</Text>
      </View>
      
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
    fontSize: 16,
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
    backgroundColor: '#9ae600',
    borderColor: '#9ae600',
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
