// Simplified test setup without problematic React Native imports

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn()
}));

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

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn()
}));

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

// Mock TurboModuleRegistry before React Native loads
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  getEnforcing: jest.fn(() => ({
    settings: {},
    get: jest.fn(),
    set: jest.fn()
  }))
}));

// Mock Settings before React Native loads
jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  settings: {},
  get: jest.fn(),
  set: jest.fn()
}));

// Enhanced React Native mocking for better component testing
jest.mock('react-native', () => {
  const React = require('react');
  
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

  return {
    // Basic UI components
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    TextInput: mockComponent('TextInput'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    ScrollView: mockComponent('ScrollView'),
    SafeAreaView: mockComponent('SafeAreaView'),
    Image: mockComponent('Image'),
    Button: mockComponent('Button'),
    FlatList: mockComponent('FlatList'),
    Modal: React.forwardRef((props: any, ref: any) => {
      // Only render modal content when visible
      if (!props.visible) return null;
      return React.createElement('div', { 
        ...props, 
        'data-testid': 'modal',
        ref 
      }, props.children);
    }),
    ActivityIndicator: mockComponent('ActivityIndicator'),
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
        set: jest.fn()
      }
    },
    
    TurboModuleRegistry: {
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