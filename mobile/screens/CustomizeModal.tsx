import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

interface MealItem {
  barcode: string;
  name: string;
  serving: string;
  calories: number;
  macros: {
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    sugars_g?: number;
    salt_g?: number;
  };
}

interface CustomizeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (newItem: MealItem) => void;
  mealType: string;
  translateMealName: (mealName: string) => string;
}

export default function CustomizeModal({
  visible,
  onClose,
  onConfirm,
  mealType,
  translateMealName,
}: CustomizeModalProps) {
  const [itemName, setItemName] = useState('');
  const [calories, setCalories] = useState('');

  const handleAddItem = () => {
    if (!itemName.trim() || !calories.trim()) {
      Alert.alert('Error', 'Please enter item name and calories');
      return;
    }

    const newItem: MealItem = {
      barcode: `custom-${Date.now()}`,
      name: itemName.trim(),
      serving: '1 serving',
      calories: parseInt(calories) || 0,
      macros: {
        protein_g: 0,
        fat_g: 0,
        carbs_g: 0,
      },
    };

    onConfirm(newItem);
    setItemName('');
    setCalories('');
  };

  const handleClose = () => {
    setItemName('');
    setCalories('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            Customize {translateMealName(mealType)}
          </Text>

          <Text style={styles.subtitle}>
            Add a custom item to your meal plan
          </Text>

          {/* Simple form - could be enhanced later */}
          <View style={styles.form}>
            <Text style={styles.label}>Item Name:</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => Alert.alert('Info', 'Custom item creation - feature in development')}
            >
              <Text style={styles.inputText}>
                Tap to add custom item
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleClose}
            >
              <Text style={styles.confirmButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  inputText: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
