import {
  environments,
  DEFAULT_ENVIRONMENT,
  getEnvironmentNames,
  getEnvironmentConfig,
  EnvironmentConfig
} from '../environments';

describe('Environment Configuration', () => {
  describe('environments object', () => {
    it('should contain all required environments', () => {
      const requiredEnvironments = [
        'dev',
        'android_dev',
        'ios_dev',
        'staging',
        'qa',
        'production',
        'eu_production',
        'us_production',
        'asia_production'
      ];

      requiredEnvironments.forEach(env => {
        expect(environments).toHaveProperty(env);
      });
    });

    it('should have valid configuration structure for each environment', () => {
      Object.entries(environments).forEach(([envName, config]) => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('apiBaseUrl');
        expect(typeof config.name).toBe('string');
        expect(typeof config.apiBaseUrl).toBe('string');
        
        // Validate URL format
        expect(config.apiBaseUrl).toMatch(/^https?:\/\/.+/);
        
        // Optional description should be string if present
        if (config.description) {
          expect(typeof config.description).toBe('string');
        }
      });
    });

    it('should use HTTPS for production environments', () => {
      const productionEnvs = ['production', 'eu_production', 'us_production', 'asia_production'];
      
      productionEnvs.forEach(env => {
        expect(environments[env].apiBaseUrl).toMatch(/^https:\/\//);
      });
    });

    it('should use appropriate URLs for development environments', () => {
      expect(environments.dev.apiBaseUrl).toBe('http://localhost:8000');
      expect(environments.android_dev.apiBaseUrl).toBe('http://10.0.2.2:8000');
      expect(environments.ios_dev.apiBaseUrl).toBe('http://localhost:8000');
    });
  });

  describe('DEFAULT_ENVIRONMENT', () => {
    it('should be defined and exist in environments', () => {
      expect(DEFAULT_ENVIRONMENT).toBeDefined();
      expect(typeof DEFAULT_ENVIRONMENT).toBe('string');
      expect(environments).toHaveProperty(DEFAULT_ENVIRONMENT);
    });
  });

  describe('getEnvironmentNames', () => {
    it('should return an array of all environment names', () => {
      const names = getEnvironmentNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      
      // Should match Object.keys(environments)
      expect(names.sort()).toEqual(Object.keys(environments).sort());
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return correct config for valid environment name', () => {
      const config = getEnvironmentConfig('dev');
      
      expect(config).toEqual(environments.dev);
      expect(config.name).toBe('Development');
      expect(config.apiBaseUrl).toBe('http://localhost:8000');
    });

    it('should return default environment config when no name provided', () => {
      const config = getEnvironmentConfig();
      
      expect(config).toEqual(environments[DEFAULT_ENVIRONMENT]);
    });

    it('should return default environment config when undefined name provided', () => {
      const config = getEnvironmentConfig(undefined);
      
      expect(config).toEqual(environments[DEFAULT_ENVIRONMENT]);
    });

    it('should fallback to default environment for invalid name', () => {
      // Mock console.warn to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config = getEnvironmentConfig('invalid_environment');
      
      expect(config).toEqual(environments[DEFAULT_ENVIRONMENT]);
      expect(consoleSpy).toHaveBeenCalledWith(
        `Environment 'invalid_environment' not found, falling back to '${DEFAULT_ENVIRONMENT}'`
      );
      
      consoleSpy.mockRestore();
    });

    it('should return proper EnvironmentConfig interface', () => {
      const config = getEnvironmentConfig('staging');
      
      // Type checking - these should not throw
      const name: string = config.name;
      const apiBaseUrl: string = config.apiBaseUrl;
      const description: string | undefined = config.description;
      
      expect(typeof name).toBe('string');
      expect(typeof apiBaseUrl).toBe('string');
      expect(description === undefined || typeof description === 'string').toBe(true);
    });
  });

  describe('Environment URLs', () => {
    it('should have unique URLs for different environments', () => {
      const urls = Object.values(environments).map(env => env.apiBaseUrl);
      const uniqueUrls = [...new Set(urls)];
      
      // Allow some duplication (like dev and ios_dev both using localhost:8000)
      // but ensure we have reasonable variety
      expect(uniqueUrls.length).toBeGreaterThan(5);
    });

    it('should use standard ports for development', () => {
      expect(environments.dev.apiBaseUrl).toMatch(/:8000$/);
      expect(environments.android_dev.apiBaseUrl).toMatch(/:8000$/);
      expect(environments.ios_dev.apiBaseUrl).toMatch(/:8000$/);
    });

    it('should not use ports for production URLs', () => {
      const productionEnvs = ['production', 'eu_production', 'us_production', 'asia_production'];
      
      productionEnvs.forEach(env => {
        // Should not end with :port
        expect(environments[env].apiBaseUrl).not.toMatch(/:\d+$/);
      });
    });
  });

  describe('Regional environments', () => {
    it('should have regional production environments with appropriate domains', () => {
      expect(environments.eu_production.apiBaseUrl).toContain('eu-api');
      expect(environments.us_production.apiBaseUrl).toContain('us-api');  
      expect(environments.asia_production.apiBaseUrl).toContain('asia-api');
    });

    it('should have descriptive names for regional environments', () => {
      expect(environments.eu_production.name).toContain('EU');
      expect(environments.us_production.name).toContain('US');
      expect(environments.asia_production.name).toContain('Asia');
    });
  });

  describe('Environment descriptions', () => {
    it('should have meaningful descriptions for key environments', () => {
      expect(environments.dev.description).toContain('Local');
      expect(environments.android_dev.description).toContain('Android emulator');
      expect(environments.production.description).toContain('Production');
      expect(environments.staging.description).toContain('Staging');
    });
  });
});