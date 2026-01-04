import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import App from '../App';

const mockUseAuth = jest.fn();
const mockUseBarcodeFlow = jest.fn();
const mockRenderScreen = jest.fn();
const mockResolveScreenTarget = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockUseAuth(),
}));

jest.mock('../contexts/ProfileContext', () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../i18n/config', () => ({
  getCurrentLanguage: jest.fn(() => 'en'),
  changeLanguage: jest.fn(),
  getSupportedLanguages: jest.fn(() => ['en', 'es']),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

jest.mock('../services/DeveloperSettings', () => ({
  developerSettingsService: {
    initialize: jest.fn(),
    getDeveloperConfig: jest.fn(() => ({ isDeveloperModeEnabled: false })),
    getFeatureToggles: jest.fn(() => ({ reminderNotifications: false })),
    subscribeToConfigChanges: jest.fn(() => jest.fn()),
    subscribeToFeatureChanges: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../hooks/useHomeActions', () => ({
  useHomeActions: () => ({
    primaryActions: [],
    secondaryActions: [],
    toolActions: [],
  }),
}));

jest.mock('../hooks/useBarcodeFlow', () => ({
  useBarcodeFlow: () => mockUseBarcodeFlow(),
}));

jest.mock('../hooks/useNotifications', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('../core/navigation/ScreenRegistry', () => ({
  resolveScreenTarget: (target: string) => mockResolveScreenTarget(target),
}));

jest.mock('../core/navigation/legacyRouter', () => ({
  renderScreen: () => mockRenderScreen(),
}));

jest.mock('../components/HomeDashboard', () => {
  const { Text } = require('react-native');
  return () => <Text>HomeDashboard</Text>;
});
jest.mock('../components/ScannerExperience', () => {
  const { Text } = require('react-native');
  return () => <Text>ScannerExperience</Text>;
});
jest.mock('../components/ProductDetail', () => {
  const { Text } = require('react-native');
  return () => <Text>ProductDetail</Text>;
});

jest.mock('../screens/SplashScreen', () => {
  const { Text } = require('react-native');
  return ({ onLoadingComplete }: any) => (
    <Text onPress={onLoadingComplete}>SplashScreen</Text>
  );
});
jest.mock('../screens/LoginScreen', () => {
  const { Text } = require('react-native');
  return ({ onNavigateToRegister }: any) => (
    <Text onPress={onNavigateToRegister}>LoginScreen</Text>
  );
});
jest.mock('../screens/RegisterScreen', () => {
  const { Text } = require('react-native');
  return ({ onNavigateToLogin }: any) => (
    <Text onPress={onNavigateToLogin}>RegisterScreen</Text>
  );
});

describe('App', () => {
  it('renders splash screen while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText } = render(<App />);
    expect(getByText('SplashScreen')).toBeTruthy();
  });

  it('renders login and navigates to register', () => {
    mockUseBarcodeFlow.mockReturnValue({
      manualBarcode: '',
      setManualBarcode: jest.fn(),
      loading: false,
      hasPermission: true,
      scanned: false,
      showCamera: false,
      currentProduct: null,
      showProductDetail: false,
      handleBarCodeScanned: jest.fn(),
      handleSubmit: jest.fn(),
      resetInput: jest.fn(),
      startCamera: jest.fn(),
      stopCamera: jest.fn(),
      closeProductDetail: jest.fn(),
    });
    mockRenderScreen.mockReturnValue(null);
    mockResolveScreenTarget.mockImplementation((target: string) => target);
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText } = render(<App />);
    fireEvent.press(getByText('LoginScreen'));
    expect(getByText('RegisterScreen')).toBeTruthy();
  });

  it('renders main app when authenticated', () => {
    mockUseBarcodeFlow.mockReturnValue({
      manualBarcode: '',
      setManualBarcode: jest.fn(),
      loading: false,
      hasPermission: true,
      scanned: false,
      showCamera: false,
      currentProduct: null,
      showProductDetail: false,
      handleBarCodeScanned: jest.fn(),
      handleSubmit: jest.fn(),
      resetInput: jest.fn(),
      startCamera: jest.fn(),
      stopCamera: jest.fn(),
      closeProductDetail: jest.fn(),
    });
    mockRenderScreen.mockReturnValue(null);
    mockResolveScreenTarget.mockImplementation((target: string) => target);
    mockUseAuth.mockReturnValue({
      user: { full_name: 'Test' },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText } = render(<App />);
    expect(getByText('HomeDashboard')).toBeTruthy();
  });

  it('falls back to login after splash completes', () => {
    mockUseBarcodeFlow.mockReturnValue({
      manualBarcode: '',
      setManualBarcode: jest.fn(),
      loading: false,
      hasPermission: true,
      scanned: false,
      showCamera: false,
      currentProduct: null,
      showProductDetail: false,
      handleBarCodeScanned: jest.fn(),
      handleSubmit: jest.fn(),
      resetInput: jest.fn(),
      startCamera: jest.fn(),
      stopCamera: jest.fn(),
      closeProductDetail: jest.fn(),
    });
    mockRenderScreen.mockReturnValue(null);
    mockResolveScreenTarget.mockImplementation((target: string) => target);
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText, queryByText } = render(<App />);
    fireEvent.press(getByText('SplashScreen'));
    expect(queryByText('SplashScreen')).toBeNull();
    expect(getByText('LoginScreen')).toBeTruthy();
  });

  it('renders product detail when barcode flow has product', () => {
    mockUseBarcodeFlow.mockReturnValue({
      manualBarcode: '',
      setManualBarcode: jest.fn(),
      loading: false,
      hasPermission: true,
      scanned: false,
      showCamera: false,
      currentProduct: { id: '1' },
      showProductDetail: true,
      handleBarCodeScanned: jest.fn(),
      handleSubmit: jest.fn(),
      resetInput: jest.fn(),
      startCamera: jest.fn(),
      stopCamera: jest.fn(),
      closeProductDetail: jest.fn(),
    });
    mockRenderScreen.mockReturnValue(null);
    mockResolveScreenTarget.mockImplementation((target: string) => target);
    mockUseAuth.mockReturnValue({
      user: { full_name: 'Test' },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    const { getByText } = render(<App />);
    expect(getByText('ProductDetail')).toBeTruthy();
  });

  it('renders routed screens when provided', () => {
    mockUseBarcodeFlow.mockReturnValue({
      manualBarcode: '',
      setManualBarcode: jest.fn(),
      loading: false,
      hasPermission: true,
      scanned: false,
      showCamera: false,
      currentProduct: null,
      showProductDetail: false,
      handleBarCodeScanned: jest.fn(),
      handleSubmit: jest.fn(),
      resetInput: jest.fn(),
      startCamera: jest.fn(),
      stopCamera: jest.fn(),
      closeProductDetail: jest.fn(),
    });
    mockResolveScreenTarget.mockImplementation((target: string) => target);
    mockRenderScreen.mockReturnValue(<></>);
    mockUseAuth.mockReturnValue({
      user: { full_name: 'Test' },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    const { queryByText } = render(<App />);
    expect(queryByText('HomeDashboard')).toBeNull();
  });
});
