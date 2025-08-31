# Testing Documentation - API Configuration System

This document describes the comprehensive testing setup for the API configuration system implemented in the DietIntel mobile app.

## 🧪 Test Framework Setup

The mobile app now uses **Jest** with **React Native Testing Library** for comprehensive testing:

- **Jest**: JavaScript testing framework with built-in mocking and coverage
- **React Native Testing Library**: Testing utilities for React Native components
- **Jest Expo**: Expo-specific Jest configuration and mocks

### Dependencies Added

```json
{
  "@types/jest": "^29.5.5",
  "@testing-library/react-native": "^12.3.0", 
  "@testing-library/jest-native": "^5.4.3",
  "jest": "^29.7.0",
  "jest-expo": "~49.0.0",
  "react-test-renderer": "18.2.0"
}
```

## 🏗️ Test Structure

### Unit Tests

#### 1. Environment Configuration (`config/__tests__/environments.test.ts`)
Tests the environment configuration system:

- ✅ **Environment Object Validation**: Ensures all required environments exist with proper structure
- ✅ **URL Format Validation**: Verifies HTTPS for production, appropriate development URLs
- ✅ **Default Environment**: Validates default environment configuration
- ✅ **Environment Getters**: Tests `getEnvironmentNames()` and `getEnvironmentConfig()`
- ✅ **Fallback Handling**: Ensures graceful fallback for invalid environments
- ✅ **Regional Environments**: Validates regional production environment configurations

```bash
npm test -- config/__tests__/environments.test.ts
```

#### 2. API Service (`services/__tests__/ApiService.test.ts`)
Comprehensive testing of the API service class:

- ✅ **Constructor & Initialization**: Tests instance creation with different environments
- ✅ **Environment Management**: Tests `switchEnvironment()` and `getCurrentEnvironment()`
- ✅ **HTTP Methods**: Tests all generic HTTP methods (GET, POST, PUT, DELETE, PATCH)
- ✅ **DietIntel-Specific Methods**: Tests all app-specific API methods
- ✅ **Health Check**: Tests connectivity testing functionality
- ✅ **Error Handling**: Tests error propagation and handling
- ✅ **Request/Response Interceptors**: Tests logging and monitoring
- ✅ **Singleton Instance**: Tests the exported singleton instance

```bash
npm test -- services/__tests__/ApiService.test.ts
```

### Integration Tests

#### 3. API Configuration Modal (`components/__tests__/ApiConfigModal.test.tsx`)
Tests the configuration UI component:

- ✅ **Rendering**: Tests modal visibility and content display
- ✅ **Environment Display**: Tests current environment highlighting and information
- ✅ **Health Testing**: Tests individual and bulk environment health checks
- ✅ **Environment Switching**: Tests the environment switching workflow
- ✅ **Error Handling**: Tests graceful error handling in UI
- ✅ **State Management**: Tests modal state persistence and updates

```bash
npm test -- components/__tests__/ApiConfigModal.test.tsx
```

#### 4. Screen Integration Tests
Tests updated screens with new API service:

**PlanScreen (`screens/__tests__/PlanScreen.test.tsx`)**:
- ✅ **API Service Integration**: Tests meal plan generation via API service
- ✅ **Error Handling**: Tests error scenarios and user feedback
- ✅ **Customization Flow**: Tests meal customization with API calls
- ✅ **Product Search**: Tests barcode and text search functionality

**UploadLabel (`screens/__tests__/UploadLabel.test.tsx`)**:
- ✅ **OCR Integration**: Tests nutrition label scanning via API service
- ✅ **External OCR**: Tests external OCR service integration
- ✅ **Image Handling**: Tests camera and gallery image selection
- ✅ **Permission Management**: Tests camera and storage permissions
- ✅ **Manual Editing**: Tests manual nutrition data entry

```bash
npm test -- screens/__tests__/
```

### End-to-End Tests

#### 5. Full Workflow (`__tests__/ApiConfiguration.e2e.test.tsx`)
Tests complete API configuration workflows:

- ✅ **Main App Integration**: Tests accessing config from main app
- ✅ **Environment Switching**: Tests complete environment switch workflow
- ✅ **Feature Integration**: Tests that features use configured environments
- ✅ **Multi-Environment Testing**: Tests testing multiple environments
- ✅ **Regional Support**: Tests regional environment configurations
- ✅ **Error Resilience**: Tests app stability during configuration errors

```bash
npm test -- __tests__/ApiConfiguration.e2e.test.tsx
```

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- environments.test.ts

# Run all API configuration related tests
./test-runner.sh
```

### Test Runner Script

The included `test-runner.sh` script provides a comprehensive test run:

```bash
# Make executable (first time only)
chmod +x test-runner.sh

# Run comprehensive test suite
./test-runner.sh
```

This script will:
1. Install dependencies
2. Run all tests with coverage
3. Run specific test suites individually
4. Display coverage summary
5. Generate detailed coverage report

## 📊 Test Coverage

### Coverage Targets

The test suite aims for high coverage across all API configuration components:

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### Coverage Report

After running tests with coverage, view the detailed report:

```bash
open coverage/lcov-report/index.html
```

### Key Coverage Areas

1. **Environment Configuration**: 100% coverage of all environment functions
2. **API Service**: >95% coverage including error scenarios
3. **UI Components**: >90% coverage of user interactions
4. **Integration Flows**: >85% coverage of complete workflows

## 🔧 Test Configuration

### Jest Configuration (`package.json`)

```json
{
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["<rootDir>/src/test-setup.ts"],
    "testPathIgnorePatterns": [
      "<rootDir>/node_modules/",
      "<rootDir>/.expo/"
    ],
    "collectCoverageFrom": [
      "**/*.{ts,tsx}",
      "!**/coverage/**",
      "!**/node_modules/**",
      "!**/babel.config.js",
      "!**/expo-env.d.ts",
      "!**/.expo/**"
    ],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

### Test Setup (`src/test-setup.ts`)

Provides common mocks and utilities:
- React Native module mocks
- Expo module mocks
- Axios mocking setup
- Console log suppression
- AsyncStorage mocking

## 🐛 Debugging Tests

### Common Issues

1. **Module Resolution**: Ensure proper `transformIgnorePatterns` in Jest config
2. **Async Operations**: Use `waitFor()` for async operations
3. **Mock Issues**: Clear mocks with `jest.clearAllMocks()` in `beforeEach`
4. **Expo Modules**: Ensure expo modules are properly mocked

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with debug info
npm test -- --verbose environments.test.ts

# Run tests without coverage (faster)
npm test -- --no-coverage

# Run single test case
npm test -- --testNamePattern="should switch environment correctly"
```

## 🔄 Continuous Integration

### Pre-commit Testing

Add to your git hooks or CI pipeline:

```bash
# Run before commit
npm run test:coverage
```

### CI Pipeline Integration

Example GitHub Actions workflow:

```yaml
name: Mobile Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v1
```

## 📋 Test Checklist

Before deployment, ensure:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] End-to-end tests pass
- [ ] Coverage targets met
- [ ] No console errors during test runs
- [ ] Mock APIs properly configured
- [ ] Test environments properly isolated

## 🎯 Best Practices

### Writing New Tests

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Test names should explain what's being tested
3. **Test Behavior, Not Implementation**: Focus on user-facing behavior
4. **Mock External Dependencies**: Use mocks for API calls, file system, etc.
5. **Clean Up**: Use `beforeEach`/`afterEach` for test isolation

### Example Test Structure

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mocks
  });

  describe('Specific Functionality', () => {
    it('should perform expected behavior when condition is met', async () => {
      // Arrange
      const mockData = { test: 'data' };
      mockApiService.method.mockResolvedValue(mockData);

      // Act
      render(<Component />);
      const button = screen.getByText('Click Me');
      fireEvent.press(button);

      // Assert
      await waitFor(() => {
        expect(mockApiService.method).toHaveBeenCalledWith(expectedParams);
      });
    });
  });
});
```

## 🚀 Deployment Testing

### Pre-deployment Checklist

1. **Run Full Test Suite**: `./test-runner.sh`
2. **Verify Coverage**: Check coverage report meets targets
3. **Test Environment Switching**: Manually verify environment switching works
4. **Test API Connectivity**: Verify actual API connectivity to staging/production
5. **Performance Testing**: Ensure tests complete within reasonable time

### Environment-Specific Testing

```bash
# Test with different default environments
EXPO_PUBLIC_API_ENVIRONMENT=staging npm test
EXPO_PUBLIC_API_ENVIRONMENT=production npm test
```

This comprehensive testing setup ensures the API configuration system is robust, reliable, and ready for production deployment! 🎉