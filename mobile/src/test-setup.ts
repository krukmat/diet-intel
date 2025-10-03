// Simplified test setup without problematic React Native imports

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('../__tests__/testUtils');
  return {
    __esModule: true,
    default: mockedAsyncStorage,
    ...mockedAsyncStorage,
  };
});

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    defaults: { baseURL: 'http://localhost:8000' }
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn()
}));

// Mock Expo modules without importing React Native
jest.mock('expo-status-bar', () => ({
  StatusBar: () => 'StatusBar'
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn()
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ cancelled: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ cancelled: true })),
  MediaTypeOptions: { Images: 'Images' }
}));

jest.mock('expo-notifications', () => {
  const api = {
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    cancelAllScheduledNotificationsAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    removeNotificationSubscription: jest.fn(),
  };

  return {
    __esModule: true,
    default: api,
    ...api,
  };
});

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() => Promise.resolve({ uri: 'mock-uri' })),
  SaveFormat: { JPEG: 'JPEG' }
}));

jest.mock('expo-barcode-scanner', () => ({
  BarCodeScanner: {
    Constants: {
      BarCodeType: {
        ean13: 'ean13',
        ean8: 'ean8',
        upc_a: 'upc_a'
      }
    }
  },
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' }))
}));

jest.mock('expo-localization', () => ({
  locale: 'en-US',
  locales: ['en-US'],
  timezone: 'America/New_York',
  isoCurrencyCodes: ['USD'],
  region: 'US',
  isRTL: false,
  getLocales: jest.fn(() => [
    {
      languageCode: 'en',
      languageTag: 'en-US',
      regionCode: 'US',
      currencyCode: 'USD',
      currencySymbol: '$',
      decimalSeparator: '.',
      digitGroupingSeparator: ','
    }
  ])
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: jest.fn((key) => key),
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(() => Promise.resolve())
    }
  })),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn()
  }
}));

// Mock TurboModuleRegistry before React Native loads
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  get: jest.fn(() => ({
    settings: {},
    get: jest.fn(),
    set: jest.fn(),
  })),
  getEnforcing: jest.fn(() => ({
    settings: {},
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

// Mock Settings before React Native loads
jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  settings: {},
  get: jest.fn(),
  set: jest.fn(),
  getConstants: jest.fn(() => ({
    ForceTouchCapability: 'unknown',
    AppleTVRemoteEnabled: false,
  })),
}));

// Mock NativeDeviceInfo before React Native loads
jest.mock('react-native/Libraries/Utilities/NativeDeviceInfo', () => ({
  getConstants: jest.fn(() => ({
    Dimensions: {
      window: { width: 375, height: 812, scale: 2, fontScale: 1 },
      screen: { width: 375, height: 812, scale: 2, fontScale: 1 }
    },
    isIPhoneX_deprecated: false
  }))
}));

jest.mock('react-native/Libraries/Utilities/NativePlatformConstantsIOS', () => ({
  __esModule: true,
  default: {
    getConstants: jest.fn(() => ({
      interfaceIdiom: 'phone',
      forceTouchAvailable: false,
      systemName: 'iOS',
      osVersion: '14.0',
      constants: {},
    })),
  },
}));

jest.mock('react-native/Libraries/ReactNative/NativeI18nManager', () => ({
  __esModule: true,
  default: {
    allowRTL: jest.fn(),
    forceRTL: jest.fn(),
    setPreferredLanguageRTL: jest.fn(),
    swapLeftAndRightInRTL: jest.fn(),
    getConstants: jest.fn(() => ({
      allowRTL: false,
      forceRTL: false,
      doLeftAndRightSwapInRTL: false,
    })),
  },
}));

// Mock Dimensions native module
jest.mock('react-native/Libraries/Utilities/Dimensions', () => ({
  getConstants: jest.fn(() => ({
    window: { width: 375, height: 812, scale: 2, fontScale: 1 },
    screen: { width: 375, height: 812, scale: 2, fontScale: 1 }
  })),
  get: jest.fn(() => ({ width: 375, height: 812 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

// Mock PixelRatio
jest.mock('react-native/Libraries/Utilities/PixelRatio', () => {
  const pixelRatio = {
    get: jest.fn(() => 2),
    getFontScale: jest.fn(() => 1),
    getPixelSizeForLayoutSize: jest.fn((size) => Math.round(size * 2)),
    roundToNearestPixel: jest.fn((size) => Math.round(size * 2) / 2),
  };

  return {
    __esModule: true,
    default: pixelRatio,
    ...pixelRatio,
  };
});

// Enhanced React Native mocking for better component testing
jest.mock('react-native', () => {
  const React = require('react');
  const pixelRatioModule = require('react-native/Libraries/Utilities/PixelRatio');
  const PixelRatio = pixelRatioModule.default || pixelRatioModule;
  
  // Create mock components that render properly
  const mockComponent = (name: string) => {
    const MockedComponent = React.forwardRef((props: any, ref: any) => {
      return React.createElement('div', { 
        ...props, 
        'data-testid': props.testID || name.toLowerCase(),
        ref 
      }, props.children);
    });
    MockedComponent.displayName = name;
    return MockedComponent;
  };

  const ActivityIndicator = React.forwardRef((props: any, ref: any) => {
    const { size = 'small', color = '#000', ...rest } = props || {};
    return React.createElement('div', {
      ...rest,
      'data-testid': rest.testID || 'activity-indicator',
      role: 'status',
      'aria-busy': true,
      'aria-label': rest.accessibilityLabel || 'loading',
      'data-size': size,
      'data-color': color,
      ref,
    }, rest.children);
  });
  ActivityIndicator.displayName = 'ActivityIndicator';

  return {
    // Basic UI components
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    TextInput: mockComponent('TextInput'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    ScrollView: mockComponent('ScrollView'),
    SafeAreaView: mockComponent('SafeAreaView'),
    KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
    Image: mockComponent('Image'),
    Button: mockComponent('Button'),
    FlatList: mockComponent('FlatList'),
    Modal: React.forwardRef((props: any, ref: any) => {
      // Always render modal to fix RNTL detection issue
      return React.createElement('div', { 
        ...props, 
        'data-testid': 'modal',
        ref,
        style: { display: props.visible !== false ? 'block' : 'none' }
      }, props.children);
    }),
    ActivityIndicator,
    Switch: mockComponent('Switch'),
    Picker: mockComponent('Picker'),
    
    // APIs and utilities
    Alert: {
      alert: jest.fn()
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 }))
    },
    Platform: {
      OS: 'ios',
      select: jest.fn((obj) => obj.ios || obj.default)
    },
    StyleSheet: {
      create: jest.fn((styles) => styles),
      flatten: jest.fn()
    },
    Keyboard: {
      dismiss: jest.fn()
    },

    I18nManager: {
      allowRTL: jest.fn(),
      forceRTL: jest.fn(),
      swapLeftAndRightInRTL: jest.fn(),
      setPreferredLanguageRTL: jest.fn(),
      isRTL: false,
    },

    PixelRatio,
    
    // Animated API
    Animated: {
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        setOffset: jest.fn(),
        flattenOffset: jest.fn(),
        extractOffset: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        interpolate: jest.fn(() => ({
          interpolate: jest.fn(),
          setValue: jest.fn(),
          setOffset: jest.fn(),
          flattenOffset: jest.fn(),
          extractOffset: jest.fn(),
          addListener: jest.fn(),
          removeListener: jest.fn(),
          removeAllListeners: jest.fn()
        }))
      })),
      timing: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      spring: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      decay: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      sequence: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      parallel: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      stagger: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      loop: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      delay: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn()
      })),
      View: mockComponent('AnimatedView'),
      Text: mockComponent('AnimatedText'),
      ScrollView: mockComponent('AnimatedScrollView'),
      Image: mockComponent('AnimatedImage'),
      createAnimatedComponent: jest.fn((component) => component)
    },
    
    // Mocked native modules
    NativeModules: {
      SettingsManager: {
        settings: {},
        get: jest.fn(),
        set: jest.fn(),
        getConstants: jest.fn(() => ({
          ForceTouchCapability: 'unknown',
          AppleTVRemoteEnabled: false,
        })),
      }
    },
    
    TurboModuleRegistry: {
      get: jest.fn(() => ({
        settings: {},
        get: jest.fn(),
        set: jest.fn(),
      })),
      getEnforcing: jest.fn(() => ({
        settings: {},
        get: jest.fn(),
        set: jest.fn()
      }))
    }
  };
});

// Global React mock for component testing
global.React = require('react');


// Silence console during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};
