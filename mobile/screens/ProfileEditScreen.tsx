import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useProfile } from '../contexts/ProfileContext';
import { apiService } from '../services/ApiService';
import { ProfileUpdatePayload } from '../types/profile';

/**
 * EPIC_A.A1: Formulario edición de perfil controlado
 * CORREGIDO V2: Completamente compatible con Expo SDK 49 - sin dependencias externas
 * - Picker → Custom visibility selector (botones)
 * - Navigation → Callback props para máxima flexibilidad
 */

interface ProfileEditScreenProps {
  onSave?: (profileData: ProfileUpdatePayload) => Promise<void>;
  onCancel?: () => void;
  initialProfile?: any;
}

export const ProfileEditScreen: React.FC<ProfileEditScreenProps> = ({
  onSave,
  onCancel,
  initialProfile
}) => {
  const { profile, refreshProfile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [handle, setHandle] = useState(profile?.handle || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [visibility, setVisibility] = useState<'public' | 'followers_only'>(
    profile?.visibility || 'public'
  );

  // Validation state
  const [handleError, setHandleError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  const validateHandle = (value: string): boolean => {
    const regex = /^[a-z0-9_]{3,30}$/;
    if (!regex.test(value)) {
      setHandleError('Handle must be 3-30 characters (letters, numbers, underscores only)');
      return false;
    }
    setHandleError(null);
    return true;
  };

  const validateBio = (value: string): boolean => {
    if (value.length > 280) {
      setBioError('Bio must be 280 characters or less');
      return false;
    }
    setBioError(null);
    return true;
  };

  const handleHandleChange = (value: string) => {
    setHandle(value);
    if (handleError) validateHandle(value); // Clear error on typing
  };

  const handleBioChange = (value: string) => {
    setBio(value);
    if (bioError) validateBio(value); // Clear error on typing
  };

  const handleSave = async () => {
    // Validate all fields
    const handleValid = validateHandle(handle);
    const bioValid = validateBio(bio);

    if (!handleValid || !bioValid) return;

    setIsLoading(true);

    try {
      const updateData: ProfileUpdatePayload = {
        handle,
        bio,
        visibility,
      };

      await apiService.updateProfile(updateData);

      // Refresh local profile state
      await refreshProfile();

      // Use callback or default completion
      if (onSave) {
        await onSave(updateData);
      } else {
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error: any) {
      console.error('Profile update error:', error);

      // Handle backend validation errors
      const errorMessage = error?.response?.data?.detail ||
        'Failed to update profile. Please try again.';

      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      // Default: show confirmation
      Alert.alert('Cancel', 'Changes will be lost. Confirm?', [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          onPress: () => Alert.alert('Cancelled', 'Profile editing cancelled.')
        }
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Edit Profile</Text>

      {/* Handle Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Handle (@username)</Text>
        <TextInput
          style={[styles.input, handleError && styles.inputError]}
          value={handle}
          onChangeText={handleHandleChange}
          placeholder="your_handle"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          onBlur={() => validateHandle(handle)} // Validate on blur
        />
        {handleError && <Text style={styles.errorText}>{handleError}</Text>}
        <Text style={styles.helperText}>3-30 characters (letters, numbers, underscores)</Text>
      </View>

      {/* Bio Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.multilineInput, bioError && styles.inputError]}
          value={bio}
          onChangeText={handleBioChange}
          placeholder="Tell others about yourself..."
          multiline
          numberOfLines={4}
          maxLength={280}
          textAlignVertical="top"
        />
        {bioError && <Text style={styles.errorText}>{bioError}</Text>}
        <Text style={styles.charCount}>{bio.length}/280</Text>
      </View>

      {/* CUSTOM VISIBILITY SELECTOR - Compatible sin dependencias externas */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Profile Visibility</Text>
        <View style={styles.visibilityButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.visibilityButton,
              visibility === 'public' && styles.visibilityButtonSelected
            ]}
            onPress={() => setVisibility('public')}
          >
            <Text style={[
              styles.visibilityButtonText,
              visibility === 'public' && styles.visibilityButtonTextSelected
            ]}>
              Public
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.visibilityButton,
              visibility === 'followers_only' && styles.visibilityButtonSelected
            ]}
            onPress={() => setVisibility('followers_only')}
          >
            <Text style={[
              styles.visibilityButtonText,
              visibility === 'followers_only' && styles.visibilityButtonTextSelected
            ]}>
              Followers Only
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>
          Public: Anyone can see your posts. Followers Only: Only followers can see posts.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, isLoading && styles.disabledButton]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.saveButtonText]}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#d9534f',
  },
  errorText: {
    color: '#d9534f',
    fontSize: 14,
    marginTop: 5,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#333',
  },
  saveButtonText: {
    color: '#fff',
  },
  // NEW: Custom visibility selector styles
  visibilityButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visibilityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  visibilityButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  visibilityButtonText: {
    fontSize: 16,
    color: '#666',
  },
  visibilityButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
