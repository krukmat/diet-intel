import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LoginCredentials } from '../types/auth';
import {
  Container,
  Section,
  Button,
  Input,
  tokens
} from '../components/ui';

interface LoginScreenProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  onNavigateToRegister: () => void;
  isLoading: boolean;
}

export default function LoginScreen({ onLogin, onNavigateToRegister, isLoading }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemo, setShowDemo] = useState(true);

  const handleLogin = async () => {
    // Validation is now handled by Input components with real-time feedback
    if (!canSubmit) {
      return;
    }

    try {
      await onLogin({ email: email.trim(), password });
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'An error occurred during login'
      );
    }
  };

  const handleDemoLogin = () => {
    setEmail('demo@dietintel.com');
    setPassword('demo123');
    setShowDemo(false);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const canSubmit = email.trim() && password.trim() && isValidEmail(email) && !isLoading;

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
              Sign in to your account
            </Text>
          </View>
        </Section>

        {/* Demo Account Info */}
        {showDemo && (
          <Section spacing="md" noDivider>
            <View style={{
              backgroundColor: `${tokens.colors.surface.card}20`,
              borderRadius: tokens.borderRadius.lg,
              padding: tokens.spacing.md,
              alignItems: 'center',
            }}>
              <Text style={{
                color: tokens.colors.surface.card,
                fontSize: tokens.typography.fontSize.md,
                fontWeight: tokens.typography.fontWeight.semibold,
                marginBottom: tokens.spacing.xs,
              }}>
                Demo Account Available
              </Text>
              <Text style={{
                color: tokens.colors.surface.card,
                fontSize: tokens.typography.fontSize.sm,
                marginBottom: tokens.spacing.sm,
                textAlign: 'center',
                opacity: 0.8,
              }}>
                Try the app with a demo account
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onPress={handleDemoLogin}
                title="Use Demo Account"
                style={{
                  backgroundColor: `${tokens.colors.surface.card}20`,
                  borderColor: tokens.colors.surface.card,
                  borderWidth: 1,
                }}
              />
            </View>
          </Section>
        )}

        {/* Login Form */}
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
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={!isLoading}
            state={!password.trim() && password.length > 0 ? 'error' : 'default'}
            errorMessage={!password.trim() && password.length > 0 ? 'Please enter your password' : undefined}
            required
          />

          <Button
            variant="primary"
            onPress={handleLogin}
            disabled={!canSubmit}
            loading={isLoading}
            title="Sign In"
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
              Don't have an account?
            </Text>
            <Button
              variant="tertiary"
              size="sm"
              onPress={onNavigateToRegister}
              disabled={isLoading}
              title="Create Account"
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
              🔒 Secure Authentication | 🌟 Welcome Back
            </Text>
          </View>
        </Section>
      </Container>
    </KeyboardAvoidingView>
  );
}