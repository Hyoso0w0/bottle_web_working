import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const LOCAL_NOTIFICATION_CHANNEL_ID = 'local-reminders';

export const ensureLocalNotificationsReady = async ({ showAlertOnDeny = false } = {}) => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(LOCAL_NOTIFICATION_CHANNEL_ID, {
      name: 'Local reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (showAlertOnDeny) {
      Alert.alert('알림 권한 필요', '로컬 알림을 사용하려면 기기 알림 권한을 허용해주세요.');
    }
    return false;
  }

  return true;
};

