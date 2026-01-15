import {
  ApiWithFallbackStrategy,
  MockOnlyStrategy,
  CacheFirstStrategy,
  DataLoadingManager,
  type DataLoadingResult,
} from '../dataLoadingStrategies';

describe('DataLoadingStrategies', () => {
  describe('ApiWithFallbackStrategy', () => {
    it('should return API data when API succeeds', async () => {
      const apiLoader = jest.fn().mockResolvedValue('api-data');
      const mockLoader = jest.fn().mockResolvedValue('mock-data');

      const strategy = new ApiWithFallbackStrategy(apiLoader, mockLoader);
      const result = await strategy.load();

      expect(result.data).toBe('api-data');
      expect(result.error).toBeNull();
      expect(result.source).toBe('api');
      expect(apiLoader).toHaveBeenCalledTimes(1);
      expect(mockLoader).not.toHaveBeenCalled();
    });

    it('should fallback to mock when API fails', async () => {
      const apiLoader = jest.fn().mockRejectedValue(new Error('API Error'));
      const mockLoader = jest.fn().mockResolvedValue('mock-data');

      const strategy = new ApiWithFallbackStrategy(apiLoader, mockLoader);
      const result = await strategy.load();

      expect(result.data).toBe('mock-data');
      expect(result.error).toBeNull();
      expect(result.source).toBe('api'); // Still reports as api source for fallback
      expect(apiLoader).toHaveBeenCalledTimes(1);
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should return error when both API and mock fail', async () => {
      const apiLoader = jest.fn().mockRejectedValue(new Error('API Error'));
      const mockLoader = jest.fn().mockRejectedValue(new Error('Mock Error'));

      const strategy = new ApiWithFallbackStrategy(apiLoader, mockLoader);
      const result = await strategy.load();

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Mock Error');
      expect(result.source).toBe('api');
    });

    it('should have high priority', () => {
      const strategy = new ApiWithFallbackStrategy(() => Promise.resolve(''), () => Promise.resolve(''));
      expect(strategy.getPriority()).toBe(10);
    });
  });

  describe('MockOnlyStrategy', () => {
    it('should return mock data when successful', async () => {
      const mockLoader = jest.fn().mockResolvedValue('mock-data');
      const strategy = new MockOnlyStrategy(mockLoader);
      const result = await strategy.load();

      expect(result.data).toBe('mock-data');
      expect(result.error).toBeNull();
      expect(result.source).toBe('mock');
    });

    it('should return error when mock fails', async () => {
      const mockLoader = jest.fn().mockRejectedValue(new Error('Mock Error'));
      const strategy = new MockOnlyStrategy(mockLoader);
      const result = await strategy.load();

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Mock Error');
      expect(result.source).toBe('mock');
    });

    it('should have medium priority', () => {
      const strategy = new MockOnlyStrategy(() => Promise.resolve(''));
      expect(strategy.getPriority()).toBe(5);
    });
  });

  describe('CacheFirstStrategy', () => {
    it('should return cached data when available', async () => {
      const cacheLoader = jest.fn().mockResolvedValue('cached-data');
      const fallbackLoader = jest.fn().mockResolvedValue('fallback-data');

      const strategy = new CacheFirstStrategy(cacheLoader, fallbackLoader);
      const result = await strategy.load();

      expect(result.data).toBe('cached-data');
      expect(result.error).toBeNull();
      expect(result.source).toBe('cache');
      expect(cacheLoader).toHaveBeenCalledTimes(1);
      expect(fallbackLoader).not.toHaveBeenCalled();
    });

    it('should use fallback when cache is empty', async () => {
      const cacheLoader = jest.fn().mockResolvedValue(null);
      const fallbackLoader = jest.fn().mockResolvedValue('fallback-data');

      const strategy = new CacheFirstStrategy(cacheLoader, fallbackLoader);
      const result = await strategy.load();

      expect(result.data).toBe('fallback-data');
      expect(result.error).toBeNull();
      expect(result.source).toBe('cache');
      expect(cacheLoader).toHaveBeenCalledTimes(1);
      expect(fallbackLoader).toHaveBeenCalledTimes(1);
    });

    it('should return error when cache and fallback both fail', async () => {
      const cacheLoader = jest.fn().mockRejectedValue(new Error('Cache Error'));
      const fallbackLoader = jest.fn().mockRejectedValue(new Error('Fallback Error'));

      const strategy = new CacheFirstStrategy(cacheLoader, fallbackLoader);
      const result = await strategy.load();

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Cache Error');
      expect(result.source).toBe('cache');
    });

    it('should have medium-high priority', () => {
      const strategy = new CacheFirstStrategy(() => Promise.resolve(null), () => Promise.resolve(''));
      expect(strategy.getPriority()).toBe(8);
    });
  });

  describe('DataLoadingManager', () => {
    it('should return error when no strategies configured', async () => {
      const manager = new DataLoadingManager<string>();
      const result = await manager.load();

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('No strategies configured');
      expect(result.source).toBe('mock');
    });

    it('should try strategies in priority order', async () => {
      const manager = new DataLoadingManager<string>();

      // High priority API strategy (fails)
      const apiStrategy = new ApiWithFallbackStrategy(
        () => Promise.reject(new Error('API failed')),
        () => Promise.reject(new Error('Mock failed'))
      );

      // Medium priority cache strategy (succeeds)
      const cacheStrategy = new CacheFirstStrategy(
        () => Promise.resolve('cached-data'),
        () => Promise.resolve('fallback-data')
      );

      manager.addStrategy(apiStrategy);
      manager.addStrategy(cacheStrategy);

      const result = await manager.load();

      expect(result.data).toBe('cached-data');
      expect(result.error).toBeNull();
      expect(result.source).toBe('cache');
    });

    it('should return result from first successful strategy', async () => {
      const manager = new DataLoadingManager<string>();

      // Strategy 1: fails
      const strategy1 = new MockOnlyStrategy(() => Promise.reject(new Error('Failed')));
      // Strategy 2: succeeds
      const strategy2 = new MockOnlyStrategy(() => Promise.resolve('success-data'));
      // Strategy 3: would succeed but shouldn't be called
      const strategy3 = new MockOnlyStrategy(() => Promise.resolve('unused-data'));

      manager.addStrategy(strategy1);
      manager.addStrategy(strategy2);
      manager.addStrategy(strategy3);

      const result = await manager.load();

      expect(result.data).toBe('success-data');
      expect(result.source).toBe('mock');
    });

    it('should return last error when all strategies fail', async () => {
      const manager = new DataLoadingManager<string>();

      const strategy1 = new MockOnlyStrategy(() => Promise.reject(new Error('Error 1')));
      const strategy2 = new MockOnlyStrategy(() => Promise.reject(new Error('Error 2')));

      manager.addStrategy(strategy1);
      manager.addStrategy(strategy2);

      const result = await manager.load();

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Error 2'); // Last error
      expect(result.source).toBe('mock');
    });

    it('should sort strategies by priority when added', async () => {
      const manager = new DataLoadingManager<string>();

      // Add in reverse priority order
      const lowPriority = new MockOnlyStrategy(() => Promise.resolve('low'));
      const highPriority = new ApiWithFallbackStrategy(
        () => Promise.resolve('high'),
        () => Promise.resolve('')
      );

      // Override priority for testing
      (lowPriority as any).getPriority = () => 1;
      (highPriority as any).getPriority = () => 10;

      manager.addStrategy(lowPriority);
      manager.addStrategy(highPriority);

      const result = await manager.load();

      expect(result.data).toBe('high'); // High priority should win
      expect(result.source).toBe('api');
    });

    it('should clear strategies', async () => {
      const manager = new DataLoadingManager<string>();
      const strategy = new MockOnlyStrategy(() => Promise.resolve('data'));

      manager.addStrategy(strategy);
      expect((manager as any).strategies.length).toBe(1);

      manager.clearStrategies();
      const result = await manager.load();

      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('No strategies configured');
    });
  });
});
