// Jest setup file for webapp unit tests

// Global test setup
beforeEach(() => {
  // Clear any mocks before each test
  jest.clearAllMocks();
});

// Global teardown
afterEach(() => {
  // Clean up after each test
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to silence logs in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:8000';