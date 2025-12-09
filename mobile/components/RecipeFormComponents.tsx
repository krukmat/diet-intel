import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';

// Multi-Select Component for Cuisine Types
interface MultiSelectProps {
  title: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  title,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options"
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  const selectedLabels = options
    .filter(option => selectedValues.includes(option.value))
    .map(option => option.label);

  return (
    <View style={styles.multiSelectContainer}>
      <Text style={styles.label}>{title}</Text>
      <TouchableOpacity
        style={styles.multiSelectButton}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.multiSelectText}>
          {selectedLabels.length > 0 
            ? selectedLabels.join(', ') 
            : placeholder}
        </Text>
        <Text style={styles.multiSelectArrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsOpen(false)}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalOption}
                  onPress={() => toggleOption(option.value)}
                >
                  <Text style={styles.modalOptionText}>{option.label}</Text>
                  <Text style={styles.modalOptionCheck}>
                    {selectedValues.includes(option.value) ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Checkbox Group Component for Dietary Restrictions
interface CheckboxGroupProps {
  title: string;
  options: { value: string; label: string; description?: string }[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  title,
  options,
  selectedValues,
  onSelectionChange
}) => {
  const toggleOption = (value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  return (
    <View style={styles.checkboxGroupContainer}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.checkboxGrid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.checkboxItem,
              selectedValues.includes(option.value) && styles.checkboxItemSelected
            ]}
            onPress={() => toggleOption(option.value)}
          >
            <View style={styles.checkboxContent}>
              <Text style={[
                styles.checkboxText,
                selectedValues.includes(option.value) && styles.checkboxTextSelected
              ]}>
                {option.label}
              </Text>
              <Text style={styles.checkboxCheck}>
                {selectedValues.includes(option.value) ? '✓' : ''}
              </Text>
            </View>
            {option.description && (
              <Text style={styles.checkboxDescription}>{option.description}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Radio Button Group for Difficulty Level
interface RadioGroupProps {
  title: string;
  options: { value: string; label: string; description?: string }[];
  selectedValue: string;
  onSelectionChange: (value: string) => void;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  title,
  options,
  selectedValue,
  onSelectionChange
}) => {
  return (
    <View style={styles.radioGroupContainer}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.radioGrid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioItem,
              selectedValue === option.value && styles.radioItemSelected
            ]}
            onPress={() => onSelectionChange(option.value)}
          >
            <View style={styles.radioContent}>
              <View style={[
                styles.radioCircle,
                selectedValue === option.value && styles.radioCircleSelected
              ]}>
                {selectedValue === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={[
                styles.radioText,
                selectedValue === option.value && styles.radioTextSelected
              ]}>
                {option.label}
              </Text>
            </View>
            {option.description && (
              <Text style={styles.radioDescription}>{option.description}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Number Input with Increment/Decrement
interface NumberInputProps {
  title: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  title,
  value,
  onValueChange,
  min = 1,
  max = 12,
  step = 1,
  suffix = ""
}) => {
  const increment = () => {
    if (value < max) {
      onValueChange(value + step);
    }
  };

  const decrement = () => {
    if (value > min) {
      onValueChange(value - step);
    }
  };

  return (
    <View style={styles.numberInputContainer}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.numberInputRow}>
        <TouchableOpacity
          style={[styles.numberButton, value <= min && styles.numberButtonDisabled]}
          onPress={decrement}
          disabled={value <= min}
        >
          <Text style={[styles.numberButtonText, value <= min && styles.numberButtonTextDisabled]}>−</Text>
        </TouchableOpacity>
        
        <View style={styles.numberDisplay}>
          <Text style={styles.numberValue}>{value}{suffix}</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.numberButton, value >= max && styles.numberButtonDisabled]}
          onPress={increment}
          disabled={value >= max}
        >
          <Text style={[styles.numberButtonText, value >= max && styles.numberButtonTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Text Input with Validation
interface ValidatedTextInputProps {
  title: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  error?: string;
  maxLength?: number;
}

export const ValidatedTextInput: React.FC<ValidatedTextInputProps> = ({
  title,
  value,
  onValueChange,
  placeholder = "",
  keyboardType = 'default',
  error,
  maxLength
}) => {
  return (
    <View style={styles.textInputContainer}>
      <Text style={styles.label}>{title}</Text>
      <TextInput
        style={[styles.textInput, error && styles.textInputError]}
        value={value}
        onChangeText={onValueChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholderTextColor="#8E8E93"
      />
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Multi-Select Styles
  multiSelectContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  multiSelectButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  multiSelectText: {
    fontSize: 16,
    color: '#1C1C1E',
    flex: 1,
  },
  multiSelectArrow: {
    fontSize: 12,
    color: '#8E8E93',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  modalOptionCheck: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },

  // Checkbox Group Styles
  checkboxGroupContainer: {
    marginBottom: 16,
  },
  checkboxGrid: {
    gap: 8,
  },
  checkboxItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    padding: 12,
  },
  checkboxItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  checkboxContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxText: {
    fontSize: 16,
    color: '#1C1C1E',
    flex: 1,
  },
  checkboxTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkboxCheck: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
    minWidth: 20,
  },
  checkboxDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },

  // Radio Group Styles
  radioGroupContainer: {
    marginBottom: 16,
  },
  radioGrid: {
    gap: 8,
  },
  radioItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    padding: 12,
  },
  radioItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  radioContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioText: {
    fontSize: 16,
    color: '#1C1C1E',
    flex: 1,
  },
  radioTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  radioDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    marginLeft: 32,
  },

  // Number Input Styles
  numberInputContainer: {
    marginBottom: 16,
  },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    overflow: 'hidden',
  },
  numberButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButtonDisabled: {
    backgroundColor: '#F8F8F8',
  },
  numberButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  numberButtonTextDisabled: {
    color: '#C7C7CC',
  },
  numberDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  numberValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },

  // Text Input Styles
  textInputContainer: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  textInputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
});