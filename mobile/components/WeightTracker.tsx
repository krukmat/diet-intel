import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WeightRecordingState, UseWeightTrackingResult } from '../hooks/useWeightTracking';
import { weightTrackerStyles } from './styles/WeightTracker.styles';

export interface WeightTrackerProps {
  weightTracking: UseWeightTrackingResult;
  onWeightRecorded?: (weight: number) => void;
}

export const WeightTracker: React.FC<WeightTrackerProps> = ({
  weightTracking,
  onWeightRecorded,
}) => {
  const [weightInput, setWeightInput] = useState('');
  const [showPhotoOption, setShowPhotoOption] = useState(false);

  const handleRecordWeight = async () => {
    const validation = weightTracking.validateWeightInput(weightInput);
    if (!validation.isValid) {
      Alert.alert('Invalid Weight', validation.error);
      return;
    }

    const weight = parseFloat(weightInput);
    const success = await weightTracking.recordWeight(weight);

    if (success) {
      setWeightInput('');
      setShowPhotoOption(false);
      onWeightRecorded?.(weight);
      Alert.alert('Success', 'Weight recorded successfully!');
    } else {
      Alert.alert('Error', weightTracking.recordingState.error || 'Failed to record weight');
    }
  };

  const handleClearState = () => {
    weightTracking.clearRecordingState();
  };

  const getStatusColor = (): string => {
    switch (weightTracking.recordingState.status) {
      case 'recorded':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      case 'recording':
        return '#FF9800';
      default:
        return '#666666';
    }
  };

  const getStatusMessage = (): string => {
    switch (weightTracking.recordingState.status) {
      case 'recording':
        return 'Recording weight...';
      case 'recorded':
        return `Weight recorded: ${weightTracking.recordingState.lastWeight} kg`;
      case 'failed':
        return 'Failed to record weight';
      default:
        return 'Enter your weight';
    }
  };

  return (
    <View style={weightTrackerStyles.container}>
      <View style={weightTrackerStyles.header}>
        <Text style={weightTrackerStyles.title}>Record Weight</Text>
        <Text style={[weightTrackerStyles.status, { color: getStatusColor() }]}>
          {getStatusMessage()}
        </Text>
      </View>

      <View style={weightTrackerStyles.inputContainer}>
        <TextInput
          testID="weight-input"
          style={weightTrackerStyles.weightInput}
          placeholder="Enter weight (kg)"
          value={weightInput}
          onChangeText={setWeightInput}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          autoCorrect={false}
          editable={weightTracking.recordingState.status !== 'recording'}
          maxLength={6}
        />

        {weightInput ? (
          <Text style={weightTrackerStyles.formattedWeight}>
            {weightTracking.formatWeightDisplay(parseFloat(weightInput) || 0)}
          </Text>
        ) : null}
      </View>

      <View style={weightTrackerStyles.validationContainer}>
        {weightInput && (() => {
          const validation = weightTracking.validateWeightInput(weightInput);
          return (
            <Text style={[
              weightTrackerStyles.validationText,
              validation.isValid
                ? weightTrackerStyles.validationValid
                : weightTrackerStyles.validationInvalid
            ]}>
              {validation.error || 'Valid weight'}
            </Text>
          );
        })()}
      </View>

      <View style={weightTrackerStyles.actionsContainer}>
        <TouchableOpacity
          testID="record-weight-button"
          style={[
            weightTrackerStyles.recordButton,
            (!weightInput || weightTracking.recordingState.status === 'recording') && weightTrackerStyles.buttonDisabled,
          ]}
          onPress={handleRecordWeight}
          disabled={!weightInput || weightTracking.recordingState.status === 'recording'}
        >
          {weightTracking.recordingState.status === 'recording' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={weightTrackerStyles.recordButtonText}>Record Weight</Text>
          )}
        </TouchableOpacity>

        {weightTracking.recordingState.status === 'failed' && (
          <TouchableOpacity
            testID="clear-error-button"
            style={weightTrackerStyles.clearButton}
            onPress={handleClearState}
          >
            <Text style={weightTrackerStyles.clearButtonText}>Clear Error</Text>
          </TouchableOpacity>
        )}
      </View>

      {weightTracking.recordingState.error && (
        <View style={weightTrackerStyles.errorContainer}>
          <Text style={weightTrackerStyles.errorText}>
            {weightTracking.recordingState.error}
          </Text>
        </View>
      )}

      {weightTracking.recordingState.lastWeight && (
        <View style={weightTrackerStyles.lastWeightContainer}>
          <Text style={weightTrackerStyles.lastWeightLabel}>Last recorded:</Text>
          <Text style={weightTrackerStyles.lastWeightValue}>
            {weightTracking.formatWeightDisplay(weightTracking.recordingState.lastWeight)}
          </Text>
          <Text style={weightTrackerStyles.lastWeightDate}>
            {weightTracking.recordingState.lastRecordedAt?.toLocaleDateString()}
          </Text>
        </View>
      )}
    </View>
  );
};

export default WeightTracker;
