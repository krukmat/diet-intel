# DietIntel Mobile - React Native Barcode Scanner

A React Native component for scanning product barcodes using the device camera or manual input.

![Android Emulator](screenshots/android-home-screen.png)

## Screenshots

See detailed screenshots and UI mockups in [screenshots/README.md](screenshots/README.md)

## Features

- **Camera Barcode Scanning**: Uses expo-barcode-scanner for EAN/UPC barcode detection
- **Manual Input Fallback**: Text input for devices without camera or when camera permission is denied
- **API Integration**: Connects to DietIntel backend API with retry/backoff logic
- **Navigation Support**: Handles product found/not found scenarios with navigation
- **Privacy-First**: Clear microcopy about local processing and data privacy
- **Error Handling**: Comprehensive error states with user-friendly messages
- **Loading States**: Visual feedback during API calls
- **Responsive UI**: Works across different screen sizes and orientations

## Android Setup

### Prerequisites

1. **Android Studio**: Install with Android SDK
2. **Android Emulator**: Create AVD (Pixel 7 API 33+ recommended)
3. **Node.js**: Version 16+ with npm

### Installation

```bash
# Clone and setup
cd mobile
npm install

# Install additional dependencies
npm install expo-barcode-scanner expo-camera axios @react-navigation/native
```

### Android Configuration

The app includes Android-specific optimizations:

```json
// app.json - Android permissions
"android": {
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.INTERNET", 
    "android.permission.ACCESS_NETWORK_STATE"
  ],
  "package": "com.dietintel.mobile"
}
```

### Running on Android

```bash
# Start Android emulator
emulator -avd Pixel_7_API_33

# Start development server
npx expo start --android

# Or start in offline mode
npx expo start --offline
```

## Dependencies

- `expo-barcode-scanner`: Camera barcode scanning
- `expo-camera`: Camera permissions and access
- `axios`: HTTP client with retry logic
- `@react-navigation/native`: Navigation between screens

## Usage

```tsx
import { ScanBarcode } from './components/ScanBarcode';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="ScanBarcode" 
          component={ScanBarcode}
          options={{ title: 'Scan Product' }}
        />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="UploadLabel" component={UploadLabelScreen} />
        <Stack.Screen name="ManualEntry" component={ManualEntryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## API Configuration

Update the base URL in `utils/apiHelper.ts`:

```tsx
export const apiHelper = new ApiHelper({
  baseURL: __DEV__ 
    ? 'http://localhost:8000'  // Development
    : 'https://your-production-api.com',  // Production
});
```

## Android-Specific Features

### Hardware Integration
- **Camera Permissions**: Auto-request with user-friendly explanations
- **Haptic Feedback**: Vibration on successful barcode scan (Android)  
- **Back Button**: Hardware back button handling during loading states
- **Status Bar**: Dynamic color management for dark camera view

### UI Optimizations
- **Material Design**: Consistent with Android design language
- **Safe Area**: StatusBar.currentHeight padding for notched displays
- **Touch Targets**: 48dp minimum for accessibility compliance
- **Typography**: System font with appropriate scaling

### Performance
- **Memory Management**: Optimized for mid-range Android devices
- **Battery Usage**: Efficient camera handling with proper lifecycle management
- **Background States**: Proper handling when app moves to background

## Permissions

The component handles camera permissions automatically:

1. **Camera Available + Permission Granted**: Shows camera scanner
2. **Camera Available + Permission Denied**: Shows manual input with option to re-request permission  
3. **Camera Not Available**: Shows manual input only

## API Integration

The component integrates with these DietIntel API endpoints:

- `POST /product/by-barcode`: Product lookup by barcode
- `POST /product/scan-label`: OCR label scanning (local)
- `POST /product/scan-label-external`: OCR with external service fallback

## Error Handling

- **404 Product Not Found**: Shows options to upload label photo or manual entry
- **Network Errors**: Shows retry option with exponential backoff
- **Camera Errors**: Graceful fallback to manual input
- **Timeout Errors**: Configurable timeout with retry logic

## Privacy Features

- Clear microcopy about local processing
- No image sharing externally mentioned
- Local OCR processing preference
- Secure API communication

## Styling

The component uses React Native StyleSheet with:

- Dark camera overlay for better barcode visibility
- Clean manual input interface
- Accessible button states and loading indicators
- Responsive design for various screen sizes

## Customization

You can customize the component by:

1. **Styling**: Modify the StyleSheet object
2. **API Config**: Update apiHelper configuration
3. **Barcode Types**: Add/remove supported barcode formats
4. **Navigation**: Customize screen navigation logic
5. **Error Messages**: Update user-facing error messages

## Android Development Troubleshooting

### Common Issues

**Emulator Won't Start**
```bash
# Check AVD list
emulator -list-avds

# Start with verbose logging
emulator -avd Pixel_7_API_33 -verbose
```

**ADB Connection Issues**
```bash
# Restart ADB server
adb kill-server && adb start-server

# Check connected devices
adb devices
```

**Metro Bundler Errors**
```bash
# Clear cache
npx expo start --clear

# Fix dependency versions
npx expo install --fix
```

**Camera Permissions**
- Ensure `android.permission.CAMERA` in app.json
- Test on physical device if emulator camera fails
- Check AVD has camera enabled in settings

### Performance Optimization

**Android Build Config**
```json
// app.json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#FFFFFF"
  }
}
```

**Memory Management**
- Use React.memo for expensive components
- Implement proper camera cleanup in useEffect
- Handle app lifecycle events for background states

### Testing

**Physical Device Setup**
```bash
# Enable USB debugging
adb devices

# Install debug build
npx expo run:android
```

**Emulator Configuration**
- **RAM**: 3GB minimum for smooth performance
- **Storage**: 6GB for app installation space
- **Camera**: Enable front/back cameras in AVD settings

## Smart Diet Navigation Integration (Phase 9.2.3)

**Date**: 2025-01-10  
**Status**: Complete - Mobile Testing & Quality Assurance

### Phase 9.2.3 Implementation Summary

Successfully implemented comprehensive mobile testing and quality assurance for Smart Diet navigation features:

#### Navigation Flow Testing Infrastructure
- **52 comprehensive navigation flow tests** covering all user interaction scenarios
- **Deep linking validation** for meal plan to Smart Diet optimization workflows
- **Cross-feature navigation testing** between Smart Diet, Track, and Plan features
- **User journey flow validation** for complete end-to-end workflows
- **Navigation state management** with context preservation across transitions
- **Performance testing** with 2-second load targets and responsive UI validation
- **Error handling** with graceful recovery and retry scenarios

#### Test Coverage Achievement
- **Component Tests**: 36 comprehensive SmartDietScreen test cases
- **Integration Tests**: 17 real API integration validations
- **Navigation Tests**: 52 navigation flow and user journey tests
- **Total Coverage**: 105+ test cases across all Smart Diet functionality

#### Key Features Validated
- **Deep Linking**: Meal plan → Smart Diet optimization with automatic context switching
- **Navigation Context**: State preservation across screen transitions and feature navigation
- **Cross-Feature Integration**: Smart Diet → Track/Plan navigation with data passing
- **User Workflows**: Daily routine, discovery, insights, and optimization journeys
- **Mobile UX**: Touch interactions, gesture handling, and mobile-specific patterns
- **Performance**: Time-sensitive operations meeting <2 second load targets
- **Accessibility**: Navigation patterns optimized for mobile accessibility

#### Testing Infrastructure
- **React Native Testing Library** integration with comprehensive mocking
- **Jest test framework** with async/await patterns and realistic delays  
- **Navigation context simulation** for deep linking and state management
- **API service integration** testing with real backend validation
- **Mobile-specific interaction** patterns and touch event handling

#### Quality Assurance Results
- ✅ All navigation flows validated and tested
- ✅ Deep linking from meal plans to Smart Diet optimization working
- ✅ Cross-feature navigation with proper data context passing
- ✅ Complete user journey workflows validated end-to-end
- ✅ Performance targets met with <2 second load times
- ✅ Error handling and recovery scenarios tested
- ✅ Mobile UX patterns and accessibility compliance verified

### Phase 9.2.3 Achievement Metrics
- **Test Execution**: 105+ comprehensive test cases
- **Coverage Areas**: Navigation, Integration, Performance, Accessibility
- **User Workflows**: 11 complete end-to-end journey validations
- **Navigation Scenarios**: 52 flow tests covering all interaction patterns
- **Quality Gates**: All Phase 9.2.3 requirements met and validated

The Smart Diet mobile navigation integration is now production-ready with comprehensive testing coverage ensuring robust user experience and reliable cross-feature functionality.