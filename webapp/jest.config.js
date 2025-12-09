module.exports = {
  // Jest configuration for webapp unit tests
  testEnvironment: 'node',
  
  // Test file patterns - exclude E2E tests
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Exclude E2E test files from Jest
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',
    '.spec.js$'  // Playwright tests use .spec.js
  ],
  
  // Coverage settings
  collectCoverage: true,
  collectCoverageFrom: [
    'routes/**/*.js',
    'views/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    'app.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // Coverage thresholds (disabled for initial setup)
  // coverageThreshold: {
  //   global: {
  //     branches: 10,
  //     functions: 10,
  //     lines: 10,
  //     statements: 10
  //   }
  // },
  
  // Test setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Mock static assets
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg)$': '<rootDir>/tests/mocks/fileMock.js'
  },
  
  // Verbose output for better debugging
  verbose: true,
  
  // Transform configuration
  testEnvironment: 'node',
  transform: {}
};