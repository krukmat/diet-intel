/**
 * App.tsx - Versión Modular con Navigation Core + Shared UI System
 * Migración gradual del App.tsx monolítico al sistema modular
 */

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

// ✅ IMPORTAMOS EL SISTEMA MODULAR
import { NavigationProvider, useSafeNavigation } from './core/navigation/NavigationCore';
import { ScreenType } from './core/navigation/NavigationTypes';

// ✅ IMPORTAMOS COMPONENTES SHARED UI
import { 
  ScreenLayout, 
  LoadingScreenLayout, 
  ErrorScreenLayout, 
  EmptyScreenLayout 
} from './shared/ui/layouts/ScreenLayout';
import { 
  NavigationHeader, 
  ModalHeader, 
  SearchHeader 
} from './shared/ui/layouts/Header';
import {
  LoadingSpinner,
  EmptyState,
  NetworkErrorState,
  ErrorState
} from './shared/ui/components';

// ✅ IMPORTAMOS HOOKS ESPECIALIZADOS
import { useScreenLayout } from './shared/ui/hooks/useScreenLayout';
import { useThemedStyles } from './shared/ui/hooks/useThemedStyles';

// Screens originales (mantenemos por ahora)
import UploadLabel from './screens/UploadLabel';
import PlanScreen from './screens/PlanScreen';
import TrackScreen from './screens/TrackScreen';
import SmartDietScreen from './screens/SmartDietScreen';
import VisionLogScreen from './screens/VisionLogScreen';
import RecipeHomeScreen from './screens/RecipeHomeScreen';
import RecipeGenerationScreen from './screens/RecipeGenerationScreen';
import RecipeSearchScreen from './screens/RecipeSearchScreen';
import MyRecipesScreen from './screens/MyRecipesScreen';
import RecipeDetailScreen from './screens/RecipeDetailScreen';
import TastePreferencesScreen from './screens/TastePreferencesScreen';
import ShoppingOptimizationScreen from './screens/ShoppingOptimizationScreen';
import IntelligentFlowScreen from './screens/IntelligentFlowScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { DiscoverFeedScreen } from './screens/DiscoverFeedScreen';
import ProductDetail from './components/ProductDetail';
import ReminderSnippet from './components/ReminderSnippet';
import ApiConfigModal from './components/ApiConfigModal';
import DeveloperSettingsModal from './components/DeveloperSettingsModal';
import LanguageSwitcher, { LanguageToggle } from './components/LanguageSwitcher';
import { developerSettingsService, DeveloperConfig, FeatureToggle } from './services/DeveloperSettings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { notificationService } from './services/NotificationService';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import SplashScreen from './screens/SplashScreen';
import { LoginCredentials, RegisterData } from './types/auth';
import './i18n/config';

// ✅ MAIN APP CON NAVIGATION PROVIDER
export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        {/* ✅ NAVIGATION PROVIDER ENVUELVE TODA LA APP */}
        <NavigationProvider initialScreen="scanner">
          <AppContent />
        </NavigationProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

// ✅ APP CONTENT USANDO SISTEMA MODULAR
function AppContent() {
  const { user, isLoading, isAuthenticated, login, register, logout } = useAuth();
  const { t } = useTranslation();
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [showSplash, setShowSplash] = useState(true);

  // ✅ LOADING STATE CON SHARED UI
  if (isLoading && showSplash) {
    return (
      <LoadingScreenLayout 
        message="Loading DietIntel..."
        backgroundColor="#007AFF"
      />
    );
  }

  // ✅ AUTH SCREENS CON SHARED UI
  if (!isAuthenticated) {
    if (authScreen === 'register') {
      return (
        <ScreenLayout showHeader={false} backgroundColor="#007AFF">
          <RegisterScreen
            onRegister={register}
            onNavigateToLogin={() => setAuthScreen('login')}
            isLoading={isLoading}
          />
        </ScreenLayout>
      );
    }

    return (
      <ScreenLayout showHeader={false} backgroundColor="#007AFF">
        <LoginScreen
          onLogin={login}
          onNavigateToRegister={() => setAuthScreen('register')}
          isLoading={isLoading}
        />
      </ScreenLayout>
    );
  }

  // ✅ MAIN APP CON NAVIGATION MODULAR
  return <MainAppModular user={user} onLogout={logout} />;
}

// ✅ MAIN APP MODULAR - VERSIÓN CON SISTEMA NAVIGATION + SHARED UI
function MainAppModular({ user, onLogout }: { user: any; onLogout: () => void }) {
  const { t } = useTranslation();
  const navigation = useSafeNavigation(); // ✅ NAVIGATION HOOK
  const { layoutConfig } = useScreenLayout(navigation.currentScreen); // ✅ LAYOUT HOOK
  const { theme, toggleTheme } = useThemedStyles(); // ✅ THEME HOOK
  
  // Estados locales para funcionalidades específicas
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);

  // ✅ DEVELOPER SETTINGS
  const [developerConfig, setDeveloperConfig] = useState<DeveloperConfig | null>(null);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggle | null>(null);
  const [showReminders, setShowReminders] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(false);

  // ✅ INICIALIZACIÓN
  useEffect(() => {
    // Permisos de cámara
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getBarCodeScannerPermissions();
    
    // Developer settings
    const initializeDeveloperSettings = async () => {
      await developerSettingsService.initialize();
      setDeveloperConfig(developerSettingsService.getDeveloperConfig());
      setFeatureToggles(developerSettingsService.getFeatureToggles());
    };
    initializeDeveloperSettings();
    
    // ✅ NAVEGACIÓN DESDE NOTIFICACIONES
    const initializeNotifications = async () => {
      const initialized = await notificationService.initialize();
      if (initialized) {
        const intent = await notificationService.getPendingNavigationIntent();
        if (intent && intent.type === 'smart_diet_navigation') {
          console.log('📱 Handling notification navigation intent:', intent);
          navigation.navigate('recommendations', {
            targetContext: intent.context,
            sourceScreen: 'notification'
          });
        }
      }
    };
    initializeNotifications();
  }, [navigation]);

  // ✅ MANEJO DE BARCODE
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
        // ✅ USANDO ERROR STATE COMPONENT
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

  // ✅ RENDER SCREENS USANDO NAVIGATION STATE
  if (showProductDetail && currentProduct) {
    return (
      <View style={styles.modalContainer}>
        <ModalHeader
          title="Product Details"
          onClose={() => {
            setShowProductDetail(false);
            setCurrentProduct(null);
          }}
        />
        <ProductDetail 
          product={currentProduct} 
          onClose={() => {
            setShowProductDetail(false);
            setCurrentProduct(null);
          }} 
        />
      </View>
    );
  }

  // ✅ MAIN CONTENT AREA
  const currentScreen = navigation.currentScreen;

  // ✅ SCREEN-SPECIFIC RENDERING
  const renderScreenContent = () => {
    switch (currentScreen) {
      case 'upload':
        return <UploadLabel onBackPress={() => navigation.goBack()} />;
      
      case 'plan':
        return (
          <PlanScreen 
            onBackPress={() => navigation.goBack()} 
            navigateToSmartDiet={(context?: any) => navigation.navigate('recommendations', {
              targetContext: 'optimize',
              sourceScreen: 'plan',
              ...context
            })}
          />
        );
      
      case 'track':
        return <TrackScreen onBackPress={() => navigation.goBack()} />;
      
      case 'recommendations':
        return (
          <SmartDietScreen 
            onBackPress={() => navigation.goBack()}
            navigationContext={navigation.navigationContext}
            navigateToTrack={() => navigation.navigate('track', {
              sourceScreen: 'recommendations'
            })}
            navigateToPlan={() => navigation.navigate('plan', {
              sourceScreen: 'recommendations'
            })}
          />
        );
      
      case 'intelligent-flow':
        return (
          <IntelligentFlowScreen
            onBackPress={() => navigation.goBack()}
          />
        );
      
      case 'vision':
        return (
          <VisionLogScreen
            onBackPress={() => navigation.goBack()}
          />
        );
      
      case 'discover-feed':
        return <DiscoverFeedScreen onBackPress={() => navigation.goBack()} />;
      
      case 'profile':
        return <ProfileScreen />;
      
      case 'profile-edit':
        return (
          <ProfileEditScreen
            onSave={async () => {
              navigation.navigate('profile');
              Alert.alert('Success', 'Profile updated successfully');
            }}
            onCancel={() => navigation.navigate('profile')}
          />
        );
      
      case 'recipes':
        return (
          <RecipeHomeScreen 
            onBackPress={() => navigation.goBack()}
            navigateToGeneration={() => navigation.navigate('recipe-generation')}
            navigateToSearch={() => navigation.navigate('recipe-search')}
            navigateToMyRecipes={() => navigation.navigate('my-recipes')}
            navigationContext={navigation.navigationContext}
          />
        );
      
      case 'recipe-generation':
        return (
          <RecipeGenerationScreen 
            onBackPress={() => navigation.goBack()}
            onNavigateToDetail={(recipe: any) => {
              navigation.navigate('recipe-detail', {
                recipeData: recipe,
                sourceScreen: 'recipe-generation'
              });
            }}
          />
        );
      
      case 'recipe-search':
        return (
          <RecipeSearchScreen 
            onBackPress={() => navigation.goBack()}
          />
        );
      
      case 'my-recipes':
        return (
          <MyRecipesScreen 
            onBackPress={() => navigation.goBack()}
          />
        );
      
      case 'recipe-detail':
        return (
          <RecipeDetailScreen 
            recipeId={navigation.navigationContext.recipeId}
            recipe={navigation.navigationContext.recipeData}
            onBackPress={() => {
              const sourceScreen = navigation.navigationContext.sourceScreen;
              if (sourceScreen && ['recipe-generation', 'recipe-search', 'my-recipes'].includes(sourceScreen)) {
                navigation.navigate(sourceScreen as ScreenType);
              } else {
                navigation.navigate('recipes');
              }
            }}
            onNavigateToOptimize={(recipe: any) => {
              navigation.navigate('recipe-generation', {
                recipeData: recipe,
                sourceScreen: 'recipe-detail'
              });
            }}
          />
        );
      
      case 'taste-preferences':
        return (
          <TastePreferencesScreen
            onBackPress={() => navigation.navigate('recipes')}
            userId={user?.id || 'user-demo'}
          />
        );
      
      case 'shopping-optimization':
        return (
          <ShoppingOptimizationScreen
            onBackPress={() => navigation.navigate('recipes')}
            selectedRecipes={navigation.navigationContext.selectedRecipes || []}
            userId={user?.id || 'user-demo'}
          />
        );
      
      default:
        return (
          <EmptyState
            title="Screen Not Found"
            message={`Screen "${currentScreen}" is not implemented yet`}
            actionText="Go to Scanner"
            onAction={() => navigation.navigate('scanner')}
          />
        );
    }
  };

  // ✅ LAYOUT PRINCIPAL USANDO SHARED UI
  return (
    <ScreenLayout
      title={layoutConfig.headerTitle || t('app.title')}
      showBackButton={layoutConfig.showBackButton}
      onBackPress={() => navigation.goBack()}
      backgroundColor={layoutConfig.backgroundColor}
      contentPadding={layoutConfig.contentPadding}
      headerRight={
        <View style={styles.headerButtons}>
          <LanguageToggle onPress={() => setShowLanguageSwitcher(true)} />
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={onLogout}
          >
            <Text style={styles.headerActionButtonText}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* ✅ CONTENT AREA */}
      <View style={styles.content}>
        {/* ✅ CAMERA SECTION (solo para scanner) */}
        {currentScreen === 'scanner' && (
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
        )}

        {/* Manual Input */}
        {currentScreen === 'scanner' && (
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
        )}

        {/* Footer */}
        {currentScreen === 'scanner' && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              🔒 Privacy Protected | 📡 Connected to DietIntel API
            </Text>
            <Text style={styles.footerSubtext}>
              Camera processing is local. No images stored.
            </Text>
          </View>
        )}
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
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  content: {
    flex: 1,
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
  modalContainer: {
    flex: 1,
  },
});
