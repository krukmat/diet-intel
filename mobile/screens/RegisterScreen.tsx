/**
 * RegisterScreen Component - Refactorizado
 * Componente principal de registro con complejidad reducida
 */

import React from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useRegister } from '../hooks/useRegister';
import {
  RegisterHeader,
  EmailInput,
  PasswordInput,
  ConfirmPasswordInput,
  RegisterButton,
  RegisterFooter,
} from '../components/RegisterScreen';
import { registerScreenStyles as styles } from '../components/styles/RegisterScreen.styles';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

/**
 * Pantalla de registro completamente refactorizada
 * Complejidad ciclomática: <5 (objetivo cumplido)
 */
export default function RegisterScreen({ onNavigateToLogin }: RegisterScreenProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    errors,
    register,
  } = useRegister();

  const handleRegister = async () => {
    const result = await register();

    if (!result.success) {
      Alert.alert('Registration Failed', result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <RegisterHeader />

        <RegisterForm
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          errors={errors}
          loading={loading}
          onRegister={handleRegister}
        />

        <RegisterFooter onLoginPress={onNavigateToLogin} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Componente del formulario de registro
 * Extraído para mantener la separación de responsabilidades
 */
function RegisterForm({
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  errors,
  loading,
  onRegister,
}: {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (confirmPassword: string) => void;
  errors: any;
  loading: boolean;
  onRegister: () => void;
}) {
  return (
    <View style={styles.formContainer}>
      <EmailInput
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        disabled={loading}
      />

      <PasswordInput
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        disabled={loading}
      />

      <ConfirmPasswordInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        disabled={loading}
      />

      <RegisterButton
        onPress={onRegister}
        loading={loading}
      />
    </View>
  );
}
