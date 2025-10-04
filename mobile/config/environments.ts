export interface EnvironmentConfig {
  name: string;
  apiBaseUrl: string;
  description?: string;
}

export const environments: Record<string, EnvironmentConfig> = {
  // Development - Local backend
  dev: {
    name: 'Development',
    apiBaseUrl: 'http://localhost:8000',
    description: 'Local development server'
  },
  
  // Android Emulator - Special localhost mapping
  android_dev: {
    name: 'Android Development',
    apiBaseUrl: 'http://192.168.1.13:8000',
    description: 'Local server accessible from Android emulator via host IP'
  },
  
  // iOS Simulator - Local network
  ios_dev: {
    name: 'iOS Development', 
    apiBaseUrl: 'http://localhost:8000',
    description: 'Local server accessible from iOS simulator'
  },
  
  // Staging environment
  staging: {
    name: 'Staging',
    apiBaseUrl: 'https://staging-api.dietintel.com',
    description: 'Staging environment for testing'
  },
  
  // QA environment
  qa: {
    name: 'QA',
    apiBaseUrl: 'https://qa-api.dietintel.com', 
    description: 'QA environment for testing'
  },
  
  // Production
  production: {
    name: 'Production',
    apiBaseUrl: 'https://api.dietintel.com',
    description: 'Production environment'
  },
  
  // Regional endpoints (examples)
  eu_production: {
    name: 'EU Production',
    apiBaseUrl: 'https://eu-api.dietintel.com',
    description: 'European production server'
  },
  
  us_production: {
    name: 'US Production', 
    apiBaseUrl: 'https://us-api.dietintel.com',
    description: 'US production server'
  },
  
  asia_production: {
    name: 'Asia Production',
    apiBaseUrl: 'https://asia-api.dietintel.com',
    description: 'Asia Pacific production server'
  }
};

// Default environment - easily changeable
export const DEFAULT_ENVIRONMENT = 'android_dev';

// Get available environment names
export const getEnvironmentNames = (): string[] => {
  return Object.keys(environments);
};

// Get environment config by name
export const getEnvironmentConfig = (envName?: string): EnvironmentConfig => {
  const selectedEnv = envName || DEFAULT_ENVIRONMENT;
  
  if (!environments[selectedEnv]) {
    console.warn(`Environment '${selectedEnv}' not found, falling back to '${DEFAULT_ENVIRONMENT}'`);
    return environments[DEFAULT_ENVIRONMENT];
  }
  
  return environments[selectedEnv];
};
