/**
 * Test setup file with comprehensive mocking for React Native/Expo components
 */

// Mock AuthService BEFORE any other imports to prevent initialization issues
jest.mock('../services/AuthService', () => ({
  authService: {
    registerUser: jest.fn(),
    loginUser: jest.fn(),
    logoutUser: jest.fn(),
    getToken: jest.fn(),
    saveToken: jest.fn(),
    removeToken: jest.fn(),
    clearTokens: jest.fn(),
    isAuthenticated: jest.fn(),
    setEnvironment: jest.fn(),
  },
}));

// Mock SyncManager to prevent auto-start in tests
jest.mock('../services/SyncManager', () => ({
  syncManager: {
    startAutoSync: jest.fn(),
    stopAutoSync: jest.fn(),
    cleanupForTests: jest.fn(),
    addStatusListener: jest.fn(),
    removeStatusListener: jest.fn(),
    getStatus: jest.fn(() => ({
      isOnline: true,
      lastSync: null,
      pendingChanges: 0,
      errors: [],
      conflicts: []
    })),
    updateConfig: jest.fn(),
    clearSyncQueue: jest.fn(),
    performSync: jest.fn(),
    queueRecipeChange: jest.fn(() => Promise.resolve()),
    forcePullFromServer: jest.fn(() => Promise.reject(new Error('Cannot pull from server while offline'))),
    forcePushToServer: jest.fn(() => Promise.reject(new Error('Cannot push to server while offline'))),
    resolveManualConflict: jest.fn(() => Promise.resolve()),
  },
  SyncManager: {
    getInstance: jest.fn(() => ({
      startAutoSync: jest.fn(),
      stopAutoSync: jest.fn(),
      cleanupForTests: jest.fn(),
      addStatusListener: jest.fn(),
      removeStatusListener: jest.fn(),
      getStatus: jest.fn(() => ({
        isOnline: true,
        lastSync: null,
        pendingChanges: 0,
        errors: [],
        conflicts: []
      })),
      updateConfig: jest.fn(),
      clearSyncQueue: jest.fn(),
      performSync: jest.fn(),
      queueRecipeChange: jest.fn(() => Promise.resolve()),
      forcePullFromServer: jest.fn(() => Promise.reject(new Error('Cannot pull from server while offline'))),
      forcePushToServer: jest.fn(() => Promise.reject(new Error('Cannot push to server while offline'))),
      resolveManualConflict: jest.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock expo-camera completely to avoid native module errors
jest.mock('expo-camera', () => {
  const React = require('react');
  const mockComponent = require('../testUtils').createMockComponent || ((name: string) =>
    React.forwardRef((props: any, ref: any) => React.createElement('div', {
      ...props,
      'data-testid': props.testID || name.toLowerCase(),
      ref
    }, props.children))
  );

  const CameraMockComponent = mockComponent('Camera');

  // Add static methods to Camera component
  CameraMockComponent.requestCameraPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
  CameraMockComponent.requestMicrophonePermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
  CameraMockComponent.getCameraPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
  CameraMockComponent.getMicrophonePermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
  CameraMockComponent.takePictureAsync = jest.fn(() => Promise.resolve({
    uri: 'mock-camera-uri',
    base64: undefined,
    exif: {},
    height: 3024,
    width: 4032,
    takenAt: Date.now(),
    type: 'image' as const
  }));
  CameraMockComponent.Constants = {
    BarCodeType: 'org.iso.Code128',
    Type: { front: 'front', back: 'back' },
    FlashMode: { on: 'on', off: 'off', auto: 'auto' },
    CameraMode: { picture: 'picture', video: 'video' },
    VideoQuality: { '2160p': '2160p' },
    VideoCodec: { AppleProRes422: 'AppleProRes422' },
    AutoFocus: { on: 'on', off: 'off' },
    WhiteBalance: { auto: 'auto' },
    VideoStabilization: { off: 'off' }
  };

  return {
    __esModule: true,
    Camera: CameraMockComponent,
    CameraCapturedPicture: {},
    requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestMicrophonePermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getMicrophonePermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    takePictureAsync: jest.fn(() => Promise.resolve({
      uri: 'mock-camera-uri',
      base64: undefined,
      exif: {},
      height: 3024,
      width: 4032,
      takenAt: Date.now(),
      type: 'image' as const
    })),
    CameraView: mockComponent('ExpoCameraView'),
    useCameraPermissions: jest.fn(() => [null, jest.fn(), jest.fn()]),
    useMicrophonePermissions: jest.fn(() => [null, jest.fn(), jest.fn()]),
    BarcodeScanningResult: {
      type: 'org.iso.Code128',
      data: 'test-barcode',
      cornerPoints: [],
      bounds: null,
    },
    Constants: CameraMockComponent.Constants
  };
});

// Mock expo-media-library
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  createAssetAsync: jest.fn(() => Promise.resolve({ id: 'mock-asset-id' })),
  MediaLibraryPermissionResponse: {
    canAskAgain: true,
    expires: 'never',
    granted: true,
    status: 'granted'
  }
}));

// Mock expo-screen-capture
jest.mock('expo-screen-capture', () => ({
  addScreenshotListener: jest.fn(() => ({ remove: jest.fn() })),
  removeScreenshotListeners: jest.fn()
}));

// Simplified test setup without problematic React Native imports

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const { mockedAsyncStorage } = require('../testUtils');
  return {
    __esModule: true,
    default: mockedAsyncStorage,
    ...mockedAsyncStorage,
  };
});

// Mock NetInfo with minimal connectivity helpers
jest.mock('@react-native-community/netinfo', () => {
  const defaultState = {
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: null,
  };

  let currentState = { ...defaultState };
  const listeners = new Set<any>();

  const notifyListeners = () => {
    const snapshot = { ...currentState };
    listeners.forEach(listener => listener(snapshot));
  };

  const addEventListener = jest.fn((listener?: any) => {
    if (listener) {
      listener({ ...currentState });
      listeners.add(listener);
    }

    return () => {
      if (listener) {
        listeners.delete(listener);
      }
    };
  });

  const fetch = jest.fn(() => Promise.resolve({ ...currentState }));
  const refresh = jest.fn(() => Promise.resolve({ ...currentState }));
  const configure = jest.fn();
  const useNetInfo = jest.fn(() => ({ ...currentState }));

  return {
    __esModule: true,
    addEventListener,
    fetch,
    refresh,
    configure,
    useNetInfo,
    __setState: (state: Record<string, any>) => {
      currentState = { ...currentState, ...state };
      notifyListeners();
    },
    __reset: () => {
      currentState = { ...defaultState };
      listeners.clear();
    },
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
    t: jest.fn((key: string, fallback?: string) => {
      // Return fallback if provided, otherwise return key for debugging
      return fallback || key;
    }),
    i18n: {
      language: 'es',
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

  const TouchableOpacity = React.forwardRef((props: any, ref: any) => {
    const { testID, onPress, onClick, disabled, ...rest } = props;
    const handlePress = (event: any) => {
      if (typeof onPress === 'function') {
        onPress(event);
      }
      if (typeof onClick === 'function') {
        onClick(event);
      }
    };

    return React.createElement('div', {
      ...rest,
      testID,
      'data-testid': testID || 'touchableopacity',
      onPress: handlePress,
      onClick: handlePress,
      'aria-disabled': disabled,
      disabled,
      ref
    }, props.children);
  });

  const renderOptionalComponent = (component: any) => {
    if (!component) {
      return null;
    }

    return typeof component === 'function'
      ? React.createElement(component)
      : component;
  };

  const FlatList = React.forwardRef((props: any, ref: any) => {
    const {
      data = [],
      renderItem,
      ListHeaderComponent,
      ListFooterComponent,
      ListEmptyComponent,
      keyExtractor: keyExtractorProp,
      ItemSeparatorComponent,
      testID,
      ...rest
    } = props;

    const keyExtractor = keyExtractorProp || ((_: any, index: number) => index.toString());
    const children: React.ReactNode[] = [];

    const header = renderOptionalComponent(ListHeaderComponent);
    if (header) {
      children.push(header);
    }

    if (!data || data.length === 0) {
      const empty = renderOptionalComponent(ListEmptyComponent);
      if (empty) {
        children.push(empty);
      }
    } else if (renderItem) {
      data.forEach((item: any, index: number) => {
        const separators = {
          highlight: () => {},
          unhighlight: () => {},
          updateProps: () => {}
        };

        const renderedItem = renderItem({ item, index, separators });
        if (!renderedItem) {
          return;
        }

        const key = keyExtractor(item, index);
        if (React.isValidElement(renderedItem)) {
          children.push(
            React.cloneElement(renderedItem, {
              key: key ?? renderedItem.key ?? index,
            })
          );
        } else {
          children.push(renderedItem);
        }

        if (ItemSeparatorComponent) {
          const separator = renderOptionalComponent(ItemSeparatorComponent);
          if (separator) {
            children.push(separator);
          }
        }
      });
    }

    const footer = renderOptionalComponent(ListFooterComponent);
    if (footer) {
      children.push(footer);
    }

    return React.createElement('div', {
      ...rest,
      data,
      testID,
      'data-testid': testID || 'flatlist',
      ref
    }, children);
  });

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
    TouchableOpacity,
    ScrollView: mockComponent('ScrollView'),
    SafeAreaView: mockComponent('SafeAreaView'),
    KeyboardAvoidingView: mockComponent('KeyboardAvoidingView'),
    StatusBar: mockComponent('StatusBar'),
    Image: mockComponent('Image'),
    Button: mockComponent('Button'),
    FlatList,
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

// Global test cleanup to prevent memory leaks and handle timers
let activeTimeouts: Set<NodeJS.Timeout> = new Set();
let activeIntervals: Set<NodeJS.Timeout> = new Set();

// Override setTimeout/setInterval to track them
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

const wrappedSetTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
  const timeoutId = originalSetTimeout(handler, timeout, ...args) as any;
  activeTimeouts.add(timeoutId);
  return timeoutId;
}) as typeof setTimeout;

(wrappedSetTimeout as any).__promisify__ = (originalSetTimeout as any).__promisify__;
global.setTimeout = wrappedSetTimeout;

global.setInterval = ((handler: TimerHandler, interval?: number, ...args: any[]) => {
  const intervalId = originalSetInterval(handler, interval, ...args) as any;
  activeIntervals.add(intervalId);
  return intervalId;
});

global.clearTimeout = ((timeoutId: any) => {
  activeTimeouts.delete(timeoutId);
  return originalClearTimeout(timeoutId);
});

global.clearInterval = ((intervalId: any) => {
  activeIntervals.delete(intervalId);
  return originalClearInterval(intervalId);
});

// Global test cleanup
const globalTestCleanup = () => {
  // Clean up any remaining timers
  for (const timeoutId of activeTimeouts) {
    try {
      originalClearTimeout(timeoutId);
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  for (const intervalId of activeIntervals) {
    try {
      originalClearInterval(intervalId);
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  activeTimeouts.clear();
  activeIntervals.clear();

  // Clean up SyncManager
  try {
    const syncManager = require('../services/SyncManager').syncManager;
    if (syncManager && typeof syncManager.cleanupForTests === 'function') {
      syncManager.cleanupForTests();
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
};

// Add global afterEach for automatic cleanup
if (typeof afterEach === 'function') {
  afterEach(() => {
    globalTestCleanup();
  });
}

// Note: Removed global hook setup to prevent "Hooks cannot be defined inside tests" error
// Tests should handle their own cleanup if needed

// Silence console during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};
