import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import HomeModals from './components/HomeModals';
import { developerSettingsService, DeveloperConfig, FeatureToggle, DEFAULT_DEVELOPER_CONFIG, DEFAULT_FEATURE_TOGGLES } from './services/DeveloperSettings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { GamificationProvider } from './contexts/GamificationContext';
import HomeDashboard from './components/HomeDashboard';
import { useHomeActions } from './hooks/useHomeActions';
import { useHomeHero } from './hooks/useHomeHero';
import { useNotifications } from './hooks/useNotifications';
import { resolveScreenTarget } from './core/navigation/ScreenRegistry';
import type { ScreenType, NavigationContext } from './core/navigation/NavigationTypes';
import { renderScreen } from './core/navigation/legacyRouter';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import SplashScreen from './screens/SplashScreen';
import { LoginCredentials, RegisterData } from './types/auth';
import './i18n/config';

// Main App Component wrapped with AuthProvider + ProfileProvider + GamificationProvider
export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <GamificationProvider>
          <AppContent />
        </GamificationProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

// Authentication-aware app content
function AppContent() {
  const { user, isLoading, isAuthenticated, login, register, logout } = useAuth();
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [showSplash, setShowSplash] = useState(true);

  // If still loading authentication state, show splash
  if (isLoading && showSplash) {
    return <SplashScreen onLoadingComplete={() => setShowSplash(false)} />;
  }

  // If not authenticated, show auth screens
  if (!isAuthenticated) {
    if (authScreen === 'register') {
      return (
        <RegisterScreen
          onRegister={register}
          onNavigateToLogin={() => setAuthScreen('login')}
          isLoading={isLoading}
        />
      );
    }

    return (
      <LoginScreen
        onLogin={login}
        onNavigateToRegister={() => setAuthScreen('register')}
        isLoading={isLoading}
      />
    );
  }

  // User is authenticated, show main app
  return <MainApp user={user} onLogout={logout} />;
}

// Main application component (existing functionality)
const getWelcomeName = (user: any) => user?.full_name || 'User';
const getDeveloperModeVisible = (user: any, developerConfig: DeveloperConfig | null) =>
  Boolean(user?.is_developer || developerConfig?.isDeveloperModeEnabled);
const getNotificationsVisible = (featureToggles: FeatureToggle | null) =>
  Boolean(featureToggles?.reminderNotifications);
const getReminderSnippetVisible = (featureToggles: FeatureToggle | null) =>
  Boolean(featureToggles?.reminderNotifications);
const getNavigationContext = (context?: NavigationContext) => context ?? {};

function MainApp({ user, onLogout }: { user: any; onLogout: () => void }) {
  const { t } = useTranslation();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('scanner');
  const [navigationContext, setNavigationContext] = useState<NavigationContext>({});
  const [showReminders, setShowReminders] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);
  // Initialize with defaults to ensure feature flags work immediately
  const [developerConfig, setDeveloperConfig] = useState<DeveloperConfig>(DEFAULT_DEVELOPER_CONFIG);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggle>(DEFAULT_FEATURE_TOGGLES);
  const { primaryActions, secondaryActions, toolActions } = useHomeActions(featureToggles);
  const { dailyCalories, plannedCalories, consumedCalories, planActive } = useHomeHero(user?.id);
  
  // Debug logging
  console.log('Current screen:', currentScreen);
  
  // Navigation helper for cross-feature navigation
  const navigateToScreen = (screen: ScreenType, context?: NavigationContext) => {
    setCurrentScreen(screen);
    setNavigationContext(getNavigationContext(context));
  };

  const handleHomeActionPress = (action: { target: string }) => {
    const target = resolveScreenTarget(action.target as ScreenType, 'scanner');
    setCurrentScreen(target);
  };

  useNotifications(navigateToScreen);

  useEffect(() => {
    // Initialize developer settings (async, but UI already has defaults)
    const initializeDeveloperSettings = async () => {
      await developerSettingsService.initialize();
      setDeveloperConfig(developerSettingsService.getDeveloperConfig());
      setFeatureToggles(developerSettingsService.getFeatureToggles());
    };

    initializeDeveloperSettings();

    // Subscribe to developer settings changes
    const unsubscribeConfig = developerSettingsService.subscribeToConfigChanges(setDeveloperConfig);
    const unsubscribeFeatures = developerSettingsService.subscribeToFeatureChanges(setFeatureToggles);

    return () => {
      unsubscribeConfig();
      unsubscribeFeatures();
    };
  }, []);
  const routedScreen = renderScreen({
    currentScreen,
    navigationContext,
    setCurrentScreen,
    navigateToScreen,
    user,
  });
  if (routedScreen) {
    return routedScreen;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      <HomeDashboard
        title={t('app.title')}
        subtitle={t('auth.welcome', { name: getWelcomeName(user) })}
        version={t('app.version')}
        heroDailyCalories={dailyCalories}
        heroPlannedCalories={plannedCalories}
        heroConsumedCalories={consumedCalories}
        heroPlanActive={planActive}
        toolActions={toolActions.map(action => ({
          id: action.id,
          label: t(action.labelKey),
          subtitle: action.subtitleKey ? t(action.subtitleKey) : undefined,
          icon: action.icon,
          onPress: () => handleHomeActionPress(action),
        }))}
        primaryActions={primaryActions.map(action => ({
          id: action.id,
          label: t(action.labelKey),
          subtitle: action.subtitleKey ? t(action.subtitleKey) : undefined,
          icon: action.icon,
          onPress: () => handleHomeActionPress(action),
        }))}
        secondaryActions={secondaryActions.map(action => ({
          id: action.id,
          label: t(action.labelKey),
          subtitle: action.subtitleKey ? t(action.subtitleKey) : undefined,
          icon: action.icon,
          onPress: () => handleHomeActionPress(action),
        }))}
        showDeveloperSettings={getDeveloperModeVisible(user, developerConfig)}
        showNotifications={getNotificationsVisible(featureToggles)}
        onLogout={onLogout}
        onShowDeveloperSettings={() => setShowDeveloperSettings(true)}
        onShowNotifications={() => setShowReminders(true)}
        onShowLanguageSwitcher={() => setShowLanguageSwitcher(true)}
      />

      <HomeModals
        showReminderSnippet={getReminderSnippetVisible(featureToggles)}
        showReminders={showReminders}
        onCloseReminders={() => setShowReminders(false)}
        showDeveloperSettings={showDeveloperSettings}
        onCloseDeveloperSettings={() => setShowDeveloperSettings(false)}
        onOpenApiConfig={() => {
          setShowDeveloperSettings(false);
          setShowApiConfig(true);
        }}
        showApiConfig={showApiConfig}
        onCloseApiConfig={() => setShowApiConfig(false)}
        showLanguageSwitcher={showLanguageSwitcher}
        onCloseLanguageSwitcher={() => setShowLanguageSwitcher(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
