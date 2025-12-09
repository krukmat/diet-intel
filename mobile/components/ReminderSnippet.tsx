import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  ScrollView,
  SafeAreaView,
  Switch,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = 'http://10.0.2.2:8000';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface Reminder {
  id: string;
  type: 'meal' | 'weigh-in';
  label: string;
  time: string; // HH:MM format
  days: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  enabled: boolean;
  notificationId?: string;
}

interface ReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id'>) => void;
  editingReminder?: Reminder | null;
}

const ReminderModal: React.FC<ReminderModalProps> = ({
  visible,
  onClose,
  onSave,
  editingReminder,
}) => {
  const [type, setType] = useState<'meal' | 'weigh-in'>('meal');
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('08:00');
  const [days, setDays] = useState([false, true, true, true, true, true, false]); // Default: weekdays
  const [enabled, setEnabled] = useState(true);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (editingReminder) {
      setType(editingReminder.type);
      setLabel(editingReminder.label);
      setTime(editingReminder.time);
      setDays([...editingReminder.days]);
      setEnabled(editingReminder.enabled);
    } else {
      setType('meal');
      setLabel('');
      setTime('08:00');
      setDays([false, true, true, true, true, true, false]);
      setEnabled(true);
    }
  }, [editingReminder, visible]);

  const toggleDay = (index: number) => {
    const newDays = [...days];
    newDays[index] = !newDays[index];
    setDays(newDays);
  };

  const handleSave = () => {
    if (!label.trim()) {
      Alert.alert('Error', 'Please enter a reminder label');
      return;
    }

    if (!days.some(day => day)) {
      Alert.alert('Error', 'Please select at least one day');
      return;
    }

    const reminderData: Omit<Reminder, 'id'> = {
      type,
      label: label.trim(),
      time,
      days: [...days],
      enabled,
    };

    onSave(reminderData);
    handleClose();
  };

  const handleClose = () => {
    setType('meal');
    setLabel('');
    setTime('08:00');
    setDays([false, true, true, true, true, true, false]);
    setEnabled(true);
    onClose();
  };

  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  };

  const formatTime = (hours: number, minutes: number) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const adjustTime = (increment: number, type: 'hour' | 'minute') => {
    const { hours, minutes } = parseTime(time);
    
    if (type === 'hour') {
      const newHours = (hours + increment + 24) % 24;
      setTime(formatTime(newHours, minutes));
    } else {
      const newMinutes = (minutes + increment + 60) % 60;
      setTime(formatTime(hours, newMinutes));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {editingReminder ? 'Edit Reminder' : 'New Reminder'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Reminder Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reminder Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeButton, type === 'meal' && styles.typeButtonActive]}
                onPress={() => setType('meal')}
              >
                <Text style={[styles.typeButtonText, type === 'meal' && styles.typeButtonTextActive]}>
                  🍽️ Meal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, type === 'weigh-in' && styles.typeButtonActive]}
                onPress={() => setType('weigh-in')}
              >
                <Text style={[styles.typeButtonText, type === 'weigh-in' && styles.typeButtonTextActive]}>
                  ⚖️ Weigh-in
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Label */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Label</Text>
            <TextInput
              style={styles.textInput}
              value={label}
              onChangeText={setLabel}
              placeholder={type === 'meal' ? 'e.g., Breakfast time' : 'e.g., Daily weigh-in'}
              maxLength={50}
            />
          </View>

          {/* Time Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time</Text>
            <View style={styles.timePicker}>
              <View style={styles.timeComponent}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => adjustTime(1, 'hour')}
                >
                  <Text style={styles.timeButtonText}>+</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{parseTime(time).hours.toString().padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => adjustTime(-1, 'hour')}
                >
                  <Text style={styles.timeButtonText}>-</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.timeSeparator}>:</Text>
              
              <View style={styles.timeComponent}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => adjustTime(15, 'minute')}
                >
                  <Text style={styles.timeButtonText}>+</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{parseTime(time).minutes.toString().padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => adjustTime(-15, 'minute')}
                >
                  <Text style={styles.timeButtonText}>-</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Days Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repeat Days</Text>
            <View style={styles.daysContainer}>
              {dayNames.map((dayName, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayButton, days[index] && styles.dayButtonActive]}
                  onPress={() => toggleDay(index)}
                >
                  <Text style={[styles.dayButtonText, days[index] && styles.dayButtonTextActive]}>
                    {dayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Enable/Disable */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.sectionTitle}>Enable Reminder</Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={enabled ? '#ffffff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>
              {editingReminder ? 'Update Reminder' : 'Create Reminder'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

interface ReminderSnippetProps {
  visible: boolean;
  onClose: () => void;
}

export default function ReminderSnippet({ visible, onClose }: ReminderSnippetProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>('undetermined');

  useEffect(() => {
    if (visible) {
      loadReminders();
      checkNotificationPermissions();
    }
  }, [visible]);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationPermission(status);
    
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(newStatus);
    }
  };

  const loadReminders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reminder`);
      const apiReminders = response.data.reminders.map((reminder: any) => ({
        id: reminder.id,
        type: reminder.type,
        label: reminder.label,
        time: reminder.time,
        days: reminder.days,
        enabled: reminder.enabled,
        notificationId: undefined // Will be set when scheduling local notifications
      }));
      setReminders(apiReminders);
    } catch (error) {
      console.error('Failed to load reminders from API:', error);
      setReminders([]); // Start with empty array if API fails
    }
  };

  const saveReminders = async (newReminders: Reminder[]) => {
    try {
      await AsyncStorage.setItem('reminders', JSON.stringify(newReminders));
      setReminders(newReminders);
    } catch (error) {
      console.error('Failed to save reminders:', error);
    }
  };

  const scheduleNotification = async (reminder: Reminder) => {
    if (notificationPermission !== 'granted') {
      Alert.alert('Permission Required', 'Notification permission is required to set reminders');
      return null;
    }

    try {
      const activeDays = reminder.days
        .map((active, index) => ({ active, day: index }))
        .filter(item => item.active)
        .map(item => item.day);

      if (activeDays.length === 0) {
        return null;
      }

      const { hours, minutes } = parseTime(reminder.time);
      
      const notificationIds: string[] = [];
      
      for (const dayOfWeek of activeDays) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.type === 'meal' ? '🍽️ Meal Reminder' : '⚖️ Weigh-in Reminder',
            body: reminder.label,
            sound: 'default',
            data: {
              reminderId: reminder.id,
              type: reminder.type,
            },
          },
          trigger: {
            weekday: dayOfWeek === 0 ? 1 : dayOfWeek + 1, // Convert to iOS format
            hour: hours,
            minute: minutes,
            repeats: true,
          },
        });
        notificationIds.push(notificationId);
      }
      
      return notificationIds.join(',');
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  };

  const cancelNotification = async (notificationId: string) => {
    try {
      const ids = notificationId.split(',');
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  };

  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  };

  const handleSaveReminder = async (reminderData: Omit<Reminder, 'id'>) => {
    try {
      let updatedReminders: Reminder[];
      
      if (editingReminder) {
        // Cancel existing notification
        if (editingReminder.notificationId) {
          await cancelNotification(editingReminder.notificationId);
        }
        
        // Update existing reminder
        const updatedReminder: Reminder = {
          ...editingReminder,
          ...reminderData,
          notificationId: reminderData.enabled ? 
            await scheduleNotification({ ...editingReminder, ...reminderData }) || undefined :
            undefined,
        };
        
        updatedReminders = reminders.map(r => 
          r.id === editingReminder.id ? updatedReminder : r
        );
      } else {
        // Create new reminder
        const newReminder: Reminder = {
          id: Date.now().toString(),
          ...reminderData,
          notificationId: reminderData.enabled ? 
            await scheduleNotification({ id: Date.now().toString(), ...reminderData }) || undefined :
            undefined,
        };
        
        updatedReminders = [...reminders, newReminder];
      }

      // Save to server
      if (editingReminder) {
        await axios.put(`${API_BASE_URL}/reminder/${editingReminder.id}`, reminderData);
      } else {
        await axios.post(`${API_BASE_URL}/reminder`, reminderData);
      }

      await saveReminders(updatedReminders);
      setEditingReminder(null);
      Alert.alert('Success', `Reminder ${editingReminder ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Failed to save reminder:', error);
      Alert.alert('Error', 'Failed to save reminder. Please try again.');
    }
  };

  const handleToggleReminder = async (reminder: Reminder) => {
    try {
      const updatedReminder = { ...reminder, enabled: !reminder.enabled };
      
      if (updatedReminder.enabled) {
        // Enable: schedule notification
        updatedReminder.notificationId = await scheduleNotification(updatedReminder) || undefined;
      } else {
        // Disable: cancel notification
        if (reminder.notificationId) {
          await cancelNotification(reminder.notificationId);
        }
        updatedReminder.notificationId = undefined;
      }
      
      const updatedReminders = reminders.map(r => 
        r.id === reminder.id ? updatedReminder : r
      );
      
      await saveReminders(updatedReminders);
      
      // Update server
      await axios.put(`${API_BASE_URL}/reminder/${reminder.id}`, {
        ...reminder,
        enabled: updatedReminder.enabled,
      });
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const handleDeleteReminder = async (reminder: Reminder) => {
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (reminder.notificationId) {
                await cancelNotification(reminder.notificationId);
              }
              
              const updatedReminders = reminders.filter(r => r.id !== reminder.id);
              await saveReminders(updatedReminders);
              
              // Delete from server
              await axios.delete(`${API_BASE_URL}/reminder/${reminder.id}`);
              
              Alert.alert('Success', 'Reminder deleted successfully');
            } catch (error) {
              console.error('Failed to delete reminder:', error);
              Alert.alert('Error', 'Failed to delete reminder');
            }
          },
        },
      ]
    );
  };

  const formatDays = (days: boolean[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activeDays = days
      .map((active, index) => ({ active, name: dayNames[index] }))
      .filter(day => day.active)
      .map(day => day.name);
    
    if (activeDays.length === 7) return 'Every day';
    if (activeDays.length === 5 && !days[0] && !days[6]) return 'Weekdays';
    if (activeDays.length === 2 && days[0] && days[6]) return 'Weekends';
    return activeDays.join(', ');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🔔 Reminders</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {notificationPermission !== 'granted' && (
            <View style={styles.permissionWarning}>
              <Text style={styles.permissionWarningText}>
                📵 Notification permission is required for reminders to work properly.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={checkNotificationPermissions}
              >
                <Text style={styles.permissionButtonText}>Enable Notifications</Text>
              </TouchableOpacity>
            </View>
          )}

          {reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No reminders set</Text>
              <Text style={styles.emptyStateSubtext}>
                Create reminders for meals and weigh-ins to stay on track
              </Text>
            </View>
          ) : (
            <View style={styles.remindersList}>
              {reminders.map((reminder) => (
                <View key={reminder.id} style={styles.reminderCard}>
                  <View style={styles.reminderHeader}>
                    <View style={styles.reminderInfo}>
                      <Text style={styles.reminderLabel}>
                        {reminder.type === 'meal' ? '🍽️' : '⚖️'} {reminder.label}
                      </Text>
                      <Text style={styles.reminderTime}>{reminder.time}</Text>
                      <Text style={styles.reminderDays}>{formatDays(reminder.days)}</Text>
                    </View>
                    
                    <View style={styles.reminderActions}>
                      <Switch
                        value={reminder.enabled}
                        onValueChange={() => handleToggleReminder(reminder)}
                        trackColor={{ false: '#767577', true: '#007AFF' }}
                        thumbColor={reminder.enabled ? '#ffffff' : '#f4f3f4'}
                        style={styles.reminderSwitch}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.reminderButtonRow}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        setEditingReminder(reminder);
                        setModalVisible(true);
                      }}
                    >
                      <Text style={styles.editButtonText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteReminder(reminder)}
                    >
                      <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingReminder(null);
              setModalVisible(true);
            }}
          >
            <Text style={styles.addButtonText}>+ Add Reminder</Text>
          </TouchableOpacity>
        </View>

        <ReminderModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setEditingReminder(null);
          }}
          onSave={handleSaveReminder}
          editingReminder={editingReminder}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  permissionWarning: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    marginBottom: 10,
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  remindersList: {
    paddingTop: 20,
  },
  reminderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reminderTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 2,
  },
  reminderDays: {
    fontSize: 12,
    color: '#666',
  },
  reminderActions: {
    marginLeft: 10,
  },
  reminderSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  reminderButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 30,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  typeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#007AFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  timeComponent: {
    alignItems: 'center',
    gap: 10,
  },
  timeButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 60,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  daysContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
    minWidth: 42,
    alignItems: 'center',
  },
  dayButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextActive: {
    color: 'white',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});