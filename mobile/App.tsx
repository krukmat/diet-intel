import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import UploadLabel from './screens/UploadLabel';
import PlanScreen from './screens/PlanScreen';
import TrackScreen from './screens/TrackScreen';
import SmartDietScreen from './screens/SmartDietScreen';
import RecipeHomeScreen from './screens/RecipeHomeScreen';
import RecipeGenerationScreen from './screens/RecipeGenerationScreen';
import RecipeSearchScreen from './screens/RecipeSearchScreen';
import MyRecipesScreen from './screens/MyRecipesScreen';
import RecipeDetailScreen from './screens/RecipeDetailScreen';
import TastePreferencesScreen from './screens/TastePreferencesScreen';
import ShoppingOptimizationScreen from './screens/ShoppingOptimizationScreen';
import ProductDetail from './components/ProductDetail';
import ReminderSnippet from './components/ReminderSnippet';
import ApiConfigModal from './components/ApiConfigModal';
import DeveloperSettingsModal from './components/DeveloperSettingsModal';
import LanguageSwitcher from './components/LanguageSwitcher';
import AppHeader from './components/AppHeader';
import QuickActions from './components/QuickActions';
import { developerSettingsService, DeveloperConfig, FeatureToggle } from './services/DeveloperSettings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { notificationService } from './services/NotificationService';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import SplashScreen from './screens/SplashScreen';
import { LoginCredentials, RegisterData } from './types/auth';
import './i18n/config';

// Main App Component wrapped with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
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
function MainApp({ user, onLogout }: { user: any; onLogout: () => void }) {
  const { t } = useTranslation();
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  type ScreenType = 'scanner' | 'upload' | 'plan' | 'track' | 'recommendations' | 'recipes' | 'recipe-generation' | 'recipe-search' | 'my-recipes' | 'recipe-detail' | 'taste-preferences' | 'shopping-optimization';
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('scanner');
  const [navigationContext, setNavigationContext] = useState<{
    targetContext?: string;
    sourceScreen?: string;
    planId?: string;
    recipeId?: string;
    recipeData?: any;
    selectedRecipes?: any[];
  }>({});
  const [showReminders, setShowReminders] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);
  const [developerConfig, setDeveloperConfig] = useState<DeveloperConfig | null>(null);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggle | null>(null);
  
  // Map screens to feature toggles for simple gating (Option A)
  const isScreenEnabled = (screen: ScreenType): boolean => {
    switch (screen) {
      case 'scanner':
        return !!featureToggles?.barcodeScanner;
      case 'upload':
        return !!featureToggles?.uploadLabelFeature;
      case 'plan':
        return !!featureToggles?.mealPlanFeature;
      case 'track':
        return !!featureToggles?.trackingFeature;
      // These screens currently have no feature toggle and remain available
      case 'recommendations':
      case 'recipes':
      case 'recipe-generation':
      case 'recipe-search':
      case 'my-recipes':
      case 'recipe-detail':
      case 'taste-preferences':
      case 'shopping-optimization':
      default:
        return true;
    }
  };

  // Centralized navigation helper with feature toggle validation
  const navigateToScreenSafely = (screen: ScreenType, context?: {
    targetContext?: string;
    sourceScreen?: string;
    planId?: string;
  }) => {
    if (isScreenEnabled(screen)) {
      setCurrentScreen(screen);
      setNavigationContext(context || {});
    } else {
      console.warn(`Navigation to ${screen} blocked: feature toggle disabled`);
      Alert.alert(
        'Feature Disabled',
        `The ${screen} feature is currently disabled in settings.`,
        [{ text: 'OK' }]
      );
    }
  };
  
  // Debug logging
  console.log('Current screen:', currentScreen);
  
  const isActiveScreen = (screen: ScreenType) => currentScreen === screen;
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);

  // Navigation helper for cross-feature navigation
  const navigateToScreen = (screen: ScreenType, context?: {
    targetContext?: string;
    sourceScreen?: string;
    planId?: string;
  }) => {
    setCurrentScreen(screen);
    setNavigationContext(context || {});
  };

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
    
    // Initialize developer settings
    const initializeDeveloperSettings = async () => {
      await developerSettingsService.initialize();
      setDeveloperConfig(developerSettingsService.getDeveloperConfig());
      setFeatureToggles(developerSettingsService.getFeatureToggles());
    };
    
    initializeDeveloperSettings();
    
    // Subscribe to developer settings changes
    const unsubscribeConfig = developerSettingsService.subscribeToConfigChanges(setDeveloperConfig);
    const unsubscribeFeatures = developerSettingsService.subscribeToFeatureChanges(setFeatureToggles);
    
    // Initialize notification service and handle pending navigation intents
    const initializeNotifications = async () => {
      const initialized = await notificationService.initialize();
      if (initialized) {
        // Check for pending navigation intents from notifications
        const intent = await notificationService.getPendingNavigationIntent();
        if (intent && intent.type === 'smart_diet_navigation') {
          console.log('📱 Handling notification navigation intent:', intent);
          navigateToScreen('recommendations', {
            targetContext: intent.context,
            sourceScreen: 'notification'
          });
        }
      }
    };
    
    initializeNotifications();
    
    return () => {
      unsubscribeConfig();
      unsubscribeFeatures();
    };
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowCamera(false);
    processBarcode(data);
  };

  const processBarcode = async (barcode: string) => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      if (barcode === '1234567890123') {
        const mockProduct = {
          code: '1234567890123',
          product_name: 'Coca Cola Classic',
          brands: 'Coca-Cola',
          serving_size: '330ml',
          nutriments: {
            energy_kcal_100g: 42,
            proteins_100g: 0,
            fat_100g: 0,
            carbohydrates_100g: 10.6,
            sugars_100g: 10.6,
            salt_100g: 0,
          },
          image_front_url: 'https://images.openfoodfacts.org/images/products/123/456/789/0123/front_en.3.400.jpg'
        };
        setCurrentProduct(mockProduct);
        setShowProductDetail(true);
      } else if (barcode === '7622210081551') {
        const mockProduct = {
          code: '7622210081551',
          product_name: 'Nutella',
          brands: 'Ferrero',
          serving_size: '15g',
          nutriments: {
            energy_kcal_100g: 546,
            proteins_100g: 6.3,
            fat_100g: 31,
            carbohydrates_100g: 57,
            sugars_100g: 57,
            salt_100g: 0.107,
          },
          image_front_url: 'https://images.openfoodfacts.org/images/products/762/221/008/1551/front_en.3.400.jpg'
        };
        setCurrentProduct(mockProduct);
        setShowProductDetail(true);
      } else {
        Alert.alert(
          t('product.notFound.title'),
          t('product.notFound.message'),
          [{ text: t('common.ok') }]
        );
      }
    }, 2000);
  };

  const handleSubmit = () => {
    if (manualBarcode.trim()) {
      processBarcode(manualBarcode.trim());
    }
  };

  const resetInput = () => {
    setManualBarcode('');
    setLoading(false);
    setScanned(false);
  };

  const startCamera = () => {
    if (hasPermission === null) {
      Alert.alert(t('permissions.title'), t('permissions.requesting'));
      return;
    }
    if (hasPermission === false) {
      Alert.alert(t('permissions.noAccess.title'), t('permissions.noAccess.message'));
      return;
    }
    setShowCamera(true);
    setScanned(false);
  };

  const stopCamera = () => {
    setShowCamera(false);
  };

  if (showProductDetail && currentProduct) {
    return (
      <ProductDetail 
        product={currentProduct} 
        onClose={() => {
          setShowProductDetail(false);
          setCurrentProduct(null);
        }} 
      />
    );
  }

  if (currentScreen === 'upload') {
    return <UploadLabel onBackPress={() => setCurrentScreen('scanner')} />;
  }

  if (currentScreen === 'plan') {
    console.log('Rendering PlanScreen...');
    return <PlanScreen 
      onBackPress={() => setCurrentScreen('scanner')} 
      navigateToSmartDiet={(context?: any) => navigateToScreen('recommendations', {
        targetContext: 'optimize',
        sourceScreen: 'plan',
        ...context
      })}
    />;
  }

  if (currentScreen === 'track') {
    return <TrackScreen onBackPress={() => setCurrentScreen('scanner')} />;
  }

  if (currentScreen === 'recommendations') {
    console.log('Rendering SmartDietScreen...');
    return <SmartDietScreen 
      onBackPress={() => setCurrentScreen('scanner')}
      navigationContext={navigationContext}
      navigateToTrack={() => navigateToScreen('track', {
        sourceScreen: 'recommendations'
      })}
      navigateToPlan={() => navigateToScreen('plan', {
        sourceScreen: 'recommendations'
      })}
    />;
  }

  // Recipe AI Screens
  if (currentScreen === 'recipes') {
    console.log('Rendering RecipeHomeScreen...');
    return <RecipeHomeScreen 
      onBackPress={() => setCurrentScreen('scanner')}
      navigateToGeneration={() => setCurrentScreen('recipe-generation')}
      navigateToSearch={() => setCurrentScreen('recipe-search')}
      navigateToMyRecipes={() => setCurrentScreen('my-recipes')}
      navigationContext={navigationContext}
    />;
  }

  if (currentScreen === 'recipe-generation') {
    console.log('Rendering RecipeGenerationScreen...');
    return <RecipeGenerationScreen 
      onBackPress={() => setCurrentScreen('recipes')}
      onNavigateToDetail={(recipe: any) => {
        setNavigationContext({ recipeData: recipe, sourceScreen: 'recipe-generation' });
        setCurrentScreen('recipe-detail');
      }}
    />;
  }

  if (currentScreen === 'recipe-search') {
    console.log('Rendering RecipeSearchScreen...');
    return <RecipeSearchScreen 
      onBackPress={() => setCurrentScreen('recipes')}
    />;
  }

  if (currentScreen === 'my-recipes') {
    console.log('Rendering MyRecipesScreen...');
    return <MyRecipesScreen 
      onBackPress={() => setCurrentScreen('recipes')}
    />;
  }

  if (currentScreen === 'recipe-detail') {
    console.log('Rendering RecipeDetailScreen...');
    return <RecipeDetailScreen 
      recipeId={navigationContext.recipeId}
      recipe={navigationContext.recipeData}
      onBackPress={() => {
        // Navigate back to source screen or recipes home
        const sourceScreen = navigationContext.sourceScreen;
        if (sourceScreen && ['recipe-generation', 'recipe-search', 'my-recipes'].includes(sourceScreen)) {
          setCurrentScreen(sourceScreen as ScreenType);
        } else {
          setCurrentScreen('recipes');
        }
      }}
      onNavigateToOptimize={(recipe: any) => {
        setNavigationContext({ recipeData: recipe, sourceScreen: 'recipe-detail' });
        setCurrentScreen('recipe-generation'); // Use generation screen for optimization
      }}
    />;
  }

  if (currentScreen === 'taste-preferences') {
    return <TastePreferencesScreen
      onBackPress={() => setCurrentScreen('recipes')}
      userId={user?.id || 'user-demo'}
    />;
  }

  if (currentScreen === 'shopping-optimization') {
    return <ShoppingOptimizationScreen
      onBackPress={() => setCurrentScreen('recipes')}
      selectedRecipes={navigationContext.selectedRecipes || []}
      userId={user?.id || 'user-demo'}
    />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="#007AFF" />
      
      {/* Header */}
      <AppHeader
        onLogout={onLogout}
        onLanguageToggle={() => setShowLanguageSwitcher(true)}
        onDeveloperSettings={() => setShowDeveloperSettings(true)}
        onRemindersToggle={() => setShowReminders(true)}
        developerConfig={developerConfig}
        featureToggles={featureToggles}
      />

      {/* Navigation */}
      <View style={styles.navigationSection}>
        {featureToggles?.barcodeScanner && (
          <TouchableOpacity
            style={[styles.navButton, isActiveScreen('scanner') && styles.navButtonActive]}
            onPress={() => navigateToScreenSafely('scanner')}
          >
            <Text style={[styles.navButtonText, isActiveScreen('scanner') && styles.navButtonTextActive]}>
              {t('navigation.barcodeScanner')}
            </Text>
          </TouchableOpacity>
        )}

        {featureToggles?.uploadLabelFeature && (
          <TouchableOpacity
            style={[styles.navButton, isActiveScreen('upload') && styles.navButtonActive]}
            onPress={() => navigateToScreenSafely('upload')}
          >
            <Text style={[styles.navButtonText, isActiveScreen('upload') && styles.navButtonTextActive]}>
              {t('navigation.uploadLabel')}
            </Text>
          </TouchableOpacity>
        )}

        {featureToggles?.mealPlanFeature && (
          <TouchableOpacity
            style={[styles.navButton, isActiveScreen('plan') && styles.navButtonActive]}
            onPress={() => {
              console.log('Meal Plan tab pressed!');
              navigateToScreenSafely('plan');
            }}
          >
            <Text style={[styles.navButtonText, isActiveScreen('plan') && styles.navButtonTextActive]}>
              {t('navigation.mealPlan')}
            </Text>
          </TouchableOpacity>
        )}

        {featureToggles?.trackingFeature && (
          <TouchableOpacity
            style={[styles.navButton, isActiveScreen('track') && styles.navButtonActive]}
            onPress={() => navigateToScreenSafely('track')}
          >
            <Text style={[styles.navButtonText, isActiveScreen('track') && styles.navButtonTextActive]}>
              {t('navigation.track')}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.navButton, isActiveScreen('recommendations') && styles.navButtonActive]}
          onPress={() => {
            console.log('Smart Recommendations tab pressed!');
            setCurrentScreen('recommendations');
          }}
        >
          <Text style={[styles.navButtonText, isActiveScreen('recommendations') && styles.navButtonTextActive]}>
            {t('navigation.smartDiet')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navButton, isActiveScreen('recipes') && styles.navButtonActive]}
          onPress={() => {
            console.log('Recipe AI tab pressed!');
            setCurrentScreen('recipes');
          }}
        >
          <Text style={[styles.navButtonText, isActiveScreen('recipes') && styles.navButtonTextActive]}>
            {t('navigation.recipes')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions Section (respect feature toggles) */}
      {(() => {
        const actions = [] as Array<{
          id: string;
          title: string;
          subtitle: string;
          icon: string;
          color: string;
          onPress: () => void;
        }>;

        if (isScreenEnabled('scanner')) {
          actions.push({
            id: 'scan',
            title: 'Scan Product',
            subtitle: 'Barcode scanner',
            icon: '📷',
            color: '#007AFF',
            onPress: () => navigateToScreenSafely('scanner')
          });
        }

        if (isScreenEnabled('track')) {
          actions.push({
            id: 'log',
            title: 'Log Meal',
            subtitle: 'Track food',
            icon: '🍽️',
            color: '#34C759',
            onPress: () => navigateToScreenSafely('track')
          });
        }

        if (isScreenEnabled('plan')) {
          actions.push({
            id: 'plan',
            title: 'View Plan',
            subtitle: 'Today\'s meals',
            icon: '📋',
            color: '#FF9500',
            onPress: () => navigateToScreenSafely('plan')
          });
        }

        // Recipes currently has no feature toggle in DeveloperSettings
        actions.push({
          id: 'recipes',
          title: 'Get Recipe',
          subtitle: 'AI suggestions',
          icon: '👨‍🍳',
          color: '#AF52DE',
          onPress: () => setCurrentScreen('recipes')
        });

        return actions.length > 0 ? <QuickActions actions={actions} /> : null;
      })()}

      {/* Scanner Status in Top Left Corner */}
      <View style={styles.statusIndicator}>
        {hasPermission === null && <Text style={styles.statusText}>📷 Requesting...</Text>}
        {hasPermission === false && <Text style={[styles.statusText, {color: '#FF3B30'}]}>📷 Permission denied</Text>}
        {hasPermission === true && <Text style={[styles.statusText, {color: '#34C759'}]}>📷 Ready</Text>}
      </View>

      {/* Camera Section */}
      <View style={styles.cameraSection}>
        {showCamera ? (
          <View style={styles.cameraContainer}>
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={styles.camera}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame}>
                <Text style={styles.scanText}>Position barcode in frame</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={stopCamera}
            >
              <Text style={styles.closeCameraText}>✕ Close Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <TouchableOpacity
              style={[styles.cameraButton, hasPermission !== true && styles.buttonDisabled]}
              onPress={startCamera}
              disabled={hasPermission !== true}
            >
              <Text style={styles.cameraButtonText}>📷 Start Camera</Text>
            </TouchableOpacity>

            <View style={styles.exampleContainer}>
              <Text style={styles.exampleTitle}>Try these demo barcodes:</Text>
              <Text style={styles.exampleItem}>• 1234567890123 (Coca Cola)</Text>
              <Text style={styles.exampleItem}>• 7622210081551 (Nutella)</Text>
              <Text style={styles.exampleItem}>• 0000000000000 (Not Found)</Text>
            </View>
          </View>
        )}
      </View>

      {/* Manual Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputTitle}>{t('scanner.input.title')}</Text>
        
        <TextInput
          style={styles.input}
          placeholder={t('scanner.input.placeholder')}
          value={manualBarcode}
          onChangeText={setManualBarcode}
          keyboardType="numeric"
          maxLength={13}
          editable={!loading}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, (!manualBarcode.trim() || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!manualBarcode.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('scanner.input.lookUp')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={resetInput}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>{t('scanner.input.reset')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔒 Privacy Protected | 📡 Connected to DietIntel API
        </Text>
        <Text style={styles.footerSubtext}>
          Camera processing is local. No images stored.
        </Text>
      </View>

      {featureToggles?.reminderNotifications && (
        <ReminderSnippet 
          visible={showReminders} 
          onClose={() => setShowReminders(false)} 
        />
      )}
      
      <DeveloperSettingsModal
        visible={showDeveloperSettings}
        onClose={() => setShowDeveloperSettings(false)}
        onOpenApiConfig={() => {
          setShowDeveloperSettings(false);
          setShowApiConfig(true);
        }}
      />
      
      <ApiConfigModal
        visible={showApiConfig}
        onClose={() => setShowApiConfig(false)}
      />
      
      <LanguageSwitcher
        visible={showLanguageSwitcher}
        onClose={() => setShowLanguageSwitcher(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 30,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 40 : 30,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginLeft: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonText: {
    color: 'white',
    fontSize: 18,
  },
  title: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  version: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  statusIndicator: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 50 : 40,
    left: 5,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraSection: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeCameraButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeCameraText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  scanFrame: {
    width: 300,
    height: 200,
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,123,255,0.1)',
    marginBottom: 30,
    padding: 20,
  },
  cameraIcon: {
    fontSize: 80,
    marginBottom: 15,
  },
  cameraText: {
    color: '#007AFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 5,
  },
  demoText: {
    color: '#007AFF',
    fontSize: 14,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  successText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  scanText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    fontWeight: '500',
  },
  exampleContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    maxWidth: 320,
  },
  exampleTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  exampleItem: {
    color: '#4FC3F7',
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginVertical: 3,
  },
  inputSection: {
    backgroundColor: 'white',
    padding: 25,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  inputTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#E3F2FD',
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#F8F9FA',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: 'transparent',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    alignItems: 'center',
  },
  footerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  navigationSection: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 15,
    flexDirection: 'row',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  navButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  navButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  navButtonTextActive: {
    color: 'white',
  },
});
