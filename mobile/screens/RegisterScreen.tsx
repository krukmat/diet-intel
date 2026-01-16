import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { RegisterData } from '../types/auth';
import { registerScreenStyles as styles } from '../components/styles/RegisterScreen.styles';

interface RegisterScreenProps {
  onRegister: (data: RegisterData) => Promise<void>;
  onNavigateToLogin: () => void;
  isLoading: boolean;
}

export default function RegisterScreen({ onRegister, onNavigateToLogin, isLoading }: RegisterScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [developerCode, setDeveloperCode] = useState('');
  const [showDeveloperCode, setShowDeveloperCode] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    if (!email.trim() || !isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      const registerData: RegisterData = {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      };

      if (showDeveloperCode && developerCode.trim()) {
        registerData.developer_code = developerCode.trim();
      }

      await onRegister(registerData);
    } catch (error) {
      Alert.alert(
        'Registration Failed',
        error instanceof Error ? error.message : 'An error occurred during registration'
      );
    }
  };

  const handleDeveloperCodeDemo = () => {
    if (!showDeveloperCode) {
      setDeveloperCode('DIETINTEL_DEV_2024');
    }
    setShowDeveloperCode(!showDeveloperCode);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isPasswordValid = password.length >= 8;
  const doPasswordsMatch = password === confirmPassword && password.length > 0;
  
  const canSubmit = 
    fullName.trim() && 
    email.trim() && 
    isValidEmail(email) && 
    isPasswordValid && 
    doPasswordsMatch && 
    !isLoading;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🍎 DietIntel</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        {/* Register Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, !isValidEmail(email) && email.length > 0 && styles.inputError]}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
            />
            {!isValidEmail(email) && email.length > 0 && (
              <Text style={styles.errorText}>Please enter a valid email address</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, !isPasswordValid && password.length > 0 && styles.inputError]}
              placeholder="Enter your password (min 8 characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
              editable={!isLoading}
            />
            {!isPasswordValid && password.length > 0 && (
              <Text style={styles.errorText}>Password must be at least 8 characters</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, !doPasswordsMatch && confirmPassword.length > 0 && styles.inputError]}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="password-new"
              editable={!isLoading}
            />
            {!doPasswordsMatch && confirmPassword.length > 0 && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {/* Developer Code Section */}
          <View style={styles.developerSection}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Developer Account</Text>
              <TouchableOpacity onPress={handleDeveloperCodeDemo}>
                <Text style={styles.demoLink}>Show Code</Text>
              </TouchableOpacity>
              <Switch
                value={showDeveloperCode}
                onValueChange={setShowDeveloperCode}
                trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                thumbColor="white"
                disabled={isLoading}
              />
            </View>
            
            {showDeveloperCode && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Developer Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter developer code (optional)"
                  value={developerCode}
                  onChangeText={setDeveloperCode}
                  autoCapitalize="characters"
                  editable={!isLoading}
                />
                <Text style={styles.helperText}>
                  Use "DIETINTEL_DEV_2024" for developer features
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.registerButton, !canSubmit && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={onNavigateToLogin} disabled={isLoading}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🔒 Your data is secure | 🌟 Join DietIntel
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
