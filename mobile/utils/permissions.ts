import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'This feature requires camera access to take photos. Please enable camera permissions in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to request camera permission:', error);
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Notification Permission Required',
        'This feature requires notification permissions to send reminders. Please enable notifications in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}