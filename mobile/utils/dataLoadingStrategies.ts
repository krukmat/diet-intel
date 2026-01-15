// Strategy Pattern for data loading with fallback mechanisms
// Provides different strategies for loading data (API vs Mock vs Cache)

export interface DataLoadingResult<T> {
  data: T | null;
  error: Error | null;
  source: 'api' | 'mock' | 'cache';
}

export interface DataLoadingStrategy<T> {
  load(): Promise<DataLoadingResult<T>>;
  getPriority(): number; // Higher number = higher priority
}

export abstract class BaseDataStrategy<T> implements DataLoadingStrategy<T> {
  protected abstract source: 'api' | 'mock' | 'cache';

  abstract load(): Promise<DataLoadingResult<T>>;
  abstract getPriority(): number;

  protected createResult(data: T | null, error: Error | null = null): DataLoadingResult<T> {
    return {
      data,
      error,
      source: this.source,
    };
  }
}

// API-first strategy with fallback to mock data
export class ApiWithFallbackStrategy<T> extends BaseDataStrategy<T> {
  protected source: 'api' | 'mock' | 'cache' = 'api';

  constructor(
    private apiLoader: () => Promise<T>,
    private mockLoader: () => Promise<T>
  ) {
    super();
  }

  async load(): Promise<DataLoadingResult<T>> {
    try {
      const data = await this.apiLoader();
      return this.createResult(data);
    } catch (error) {
      console.warn('API loading failed, falling back to mock data:', error);
      try {
        const mockData = await this.mockLoader();
        return this.createResult(mockData, null); // Don't propagate API error for fallback
      } catch (mockError) {
        return this.createResult(null, mockError as Error);
      }
    }
  }

  getPriority(): number {
    return 10; // High priority for API
  }
}

// Mock-only strategy for development/testing
export class MockOnlyStrategy<T> extends BaseDataStrategy<T> {
  protected source: 'api' | 'mock' | 'cache' = 'mock';

  constructor(private mockLoader: () => Promise<T>) {
    super();
  }

  async load(): Promise<DataLoadingResult<T>> {
    try {
      const data = await this.mockLoader();
      return this.createResult(data);
    } catch (error) {
      return this.createResult(null, error as Error);
    }
  }

  getPriority(): number {
    return 5; // Medium priority
  }
}

// Cache-first strategy
export class CacheFirstStrategy<T> extends BaseDataStrategy<T> {
  protected source: 'api' | 'mock' | 'cache' = 'cache';

  constructor(
    private cacheLoader: () => Promise<T | null>,
    private fallbackLoader: () => Promise<T>
  ) {
    super();
  }

  async load(): Promise<DataLoadingResult<T>> {
    try {
      const cachedData = await this.cacheLoader();
      if (cachedData !== null) {
        return this.createResult(cachedData);
      }

      // Cache miss, load from fallback
      const data = await this.fallbackLoader();
      return this.createResult(data);
    } catch (error) {
      return this.createResult(null, error as Error);
    }
  }

  getPriority(): number {
    return 8; // Between API and mock
  }
}

// Strategy manager that selects the best strategy
export class DataLoadingManager<T> {
  private strategies: DataLoadingStrategy<T>[] = [];

  addStrategy(strategy: DataLoadingStrategy<T>): void {
    this.strategies.push(strategy);
    // Sort by priority (highest first)
    this.strategies.sort((a, b) => b.getPriority() - a.getPriority());
  }

  async load(): Promise<DataLoadingResult<T>> {
    if (this.strategies.length === 0) {
      return {
        data: null,
        error: new Error('No strategies configured'),
        source: 'mock',
      };
    }

    // Try strategies in priority order
    for (const strategy of this.strategies) {
      const result = await strategy.load();
      if (result.data !== null) {
        return result;
      }
    }

    // All strategies failed, return the last error
    const lastResult = await this.strategies[this.strategies.length - 1].load();
    return lastResult;
  }

  clearStrategies(): void {
    this.strategies = [];
  }
}
