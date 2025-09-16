import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { RegisterData } from '../types/auth';
import {
  Container,
  Section,
  Button,
  Input,
  tokens
} from '../components/ui';

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
    // Validation is now handled by Input components with real-time feedback
    if (!canSubmit) {
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
      style={{ flex: 1, backgroundColor: tokens.colors.primary[500] }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ExpoStatusBar style="light" backgroundColor={tokens.colors.primary[500]} />

      <Container padding="md" scrollable safeArea keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Section spacing="lg" noDivider>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              color: tokens.colors.surface.card,
              fontSize: tokens.typography.fontSize['4xl'],
              fontWeight: tokens.typography.fontWeight.bold,
              marginBottom: tokens.spacing.xs,
            }}>
              🍎 DietIntel
            </Text>
            <Text style={{
              color: tokens.colors.surface.card,
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.medium,
              opacity: 0.9,
            }}>
              Create your account
            </Text>
          </View>
        </Section>

        {/* Register Form */}
        <Section spacing="md" style={{
          backgroundColor: tokens.colors.surface.card,
          borderRadius: tokens.borderRadius.xl,
          padding: tokens.spacing.lg,
          shadowColor: tokens.colors.neutral[900],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            editable={!isLoading}
            state={!fullName.trim() && fullName.length > 0 ? 'error' : 'default'}
            errorMessage={!fullName.trim() && fullName.length > 0 ? 'Please enter your full name' : undefined}
            required
          />

          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
            state={!isValidEmail(email) && email.length > 0 ? 'error' : 'default'}
            errorMessage={!isValidEmail(email) && email.length > 0 ? 'Please enter a valid email address' : undefined}
            required
          />

          <Input
            label="Password"
            placeholder="Enter your password (min 8 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            editable={!isLoading}
            state={!isPasswordValid && password.length > 0 ? 'error' : 'default'}
            errorMessage={!isPasswordValid && password.length > 0 ? 'Password must be at least 8 characters' : undefined}
            required
          />

          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="password-new"
            editable={!isLoading}
            state={!doPasswordsMatch && confirmPassword.length > 0 ? 'error' : 'default'}
            errorMessage={!doPasswordsMatch && confirmPassword.length > 0 ? 'Passwords do not match' : undefined}
            required
          />

          {/* Developer Code Section */}
          <View style={{
            backgroundColor: tokens.colors.neutral[50],
            borderRadius: tokens.borderRadius.lg,
            padding: tokens.spacing.md,
            marginBottom: tokens.spacing.md,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: tokens.spacing.sm,
            }}>
              <Text style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.text.primary,
                flex: 1,
              }}>
                Developer Account
              </Text>
              <Button
                variant="tertiary"
                size="sm"
                onPress={handleDeveloperCodeDemo}
                title="Show Code"
                style={{ marginRight: tokens.spacing.sm }}
              />
              <Switch
                value={showDeveloperCode}
                onValueChange={setShowDeveloperCode}
                trackColor={{ false: tokens.colors.neutral[200], true: tokens.colors.primary[500] }}
                thumbColor={tokens.colors.surface.card}
                disabled={isLoading}
              />
            </View>

            {showDeveloperCode && (
              <Input
                label="Developer Code"
                placeholder="Enter developer code (optional)"
                value={developerCode}
                onChangeText={setDeveloperCode}
                autoCapitalize="characters"
                editable={!isLoading}
                helperText='Use "DIETINTEL_DEV_2024" for developer features'
              />
            )}
          </View>

          <Button
            variant="primary"
            onPress={handleRegister}
            disabled={!canSubmit}
            loading={isLoading}
            title="Create Account"
            style={{ marginTop: tokens.spacing.sm }}
          />

          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: tokens.spacing.md,
            gap: tokens.spacing.xs,
          }}>
            <Text style={{
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.fontSize.sm,
            }}>
              Already have an account?
            </Text>
            <Button
              variant="tertiary"
              size="sm"
              onPress={onNavigateToLogin}
              disabled={isLoading}
              title="Sign In"
            />
          </View>
        </Section>

        {/* Footer */}
        <Section spacing="md" noDivider>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              color: tokens.colors.surface.card,
              fontSize: tokens.typography.fontSize.xs,
              textAlign: 'center',
              opacity: 0.8,
            }}>
              🔒 Your data is secure | 🌟 Join DietIntel
            </Text>
          </View>
        </Section>
      </Container>
    </KeyboardAvoidingView>
  );
}