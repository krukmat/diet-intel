// Circuit Breaker Pattern Implementation
// Prevents cascading failures and provides graceful degradation

import { errorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Blocking requests
  HALF_OPEN = 'half-open' // Testing if service is back
}

interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures to open circuit
  recoveryTimeout: number;     // Time to wait before half-open (ms)
  successThreshold: number;    // Successes needed to close circuit
  timeout: number;             // Request timeout (ms)
  monitoringPeriod: number;    // Time window for failure counting (ms)
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  recentRequests: { timestamp: number; success: boolean }[];
}

export class CircuitBreaker {
  private name: string;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private listeners: Array<(state: CircuitState) => void> = [];

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      successThreshold: 3,
      timeout: 30000, // 30 seconds
      monitoringPeriod: 300000, // 5 minutes
      ...config,
    };

    this.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      recentRequests: [],
    };
  }

  // Execute a request through the circuit breaker
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.state === CircuitState.OPEN) {
      if (Date.now() < this.state.nextAttemptTime) {
        throw this.createCircuitOpenError();
      } else {
        // Move to half-open state
        this.setState(CircuitState.HALF_OPEN);
      }
    }

    // Clean up old requests
    this.cleanupOldRequests();

    try {
      // Set timeout for the operation
      const result = await Promise.race<T>([
        operation(),
        this.createTimeoutPromise<T>(),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  // Handle successful request
  private onSuccess(): void {
    this.addRequest(true);

    if (this.state.state === CircuitState.HALF_OPEN) {
      this.state.successCount++;
      
      if (this.state.successCount >= this.config.successThreshold) {
        this.setState(CircuitState.CLOSED);
        this.state.failureCount = 0;
        this.state.successCount = 0;
      }
    } else if (this.state.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.state.failureCount = 0;
    }
  }

  // Handle failed request
  private onFailure(error: any): void {
    this.addRequest(false);
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === CircuitState.HALF_OPEN) {
      // Go back to open state on any failure in half-open
      this.setState(CircuitState.OPEN);
      this.state.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      this.state.successCount = 0;
    } else if (this.state.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      const recentFailures = this.getRecentFailureCount();
      
      if (recentFailures >= this.config.failureThreshold) {
        this.setState(CircuitState.OPEN);
        this.state.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      }
    }

    // Log error with circuit breaker context
    errorHandler.handleError(error, {
      circuitBreaker: this.name,
      circuitState: this.state.state,
      failureCount: this.state.failureCount,
      recentFailures: this.getRecentFailureCount(),
    }, false);
  }

  // Add request to recent requests tracking
  private addRequest(success: boolean): void {
    this.state.recentRequests.push({
      timestamp: Date.now(),
      success,
    });

    // Keep only recent requests
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.state.recentRequests = this.state.recentRequests.filter(
      req => req.timestamp > cutoff
    );
  }

  // Get count of recent failures
  private getRecentFailureCount(): number {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    return this.state.recentRequests
      .filter(req => req.timestamp > cutoff && !req.success)
      .length;
  }

  // Clean up old request records
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.state.recentRequests = this.state.recentRequests.filter(
      req => req.timestamp > cutoff
    );
  }

  // Create timeout promise
  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(errorHandler.createError(
          'Request timeout',
          'CIRCUIT_BREAKER_TIMEOUT',
          ErrorCategory.NETWORK,
          ErrorSeverity.MEDIUM,
          true,
          { circuitBreaker: this.name, timeout: this.config.timeout }
        ));
      }, this.config.timeout);
    });
  }

  // Create circuit open error
  private createCircuitOpenError(): Error {
    return errorHandler.createError(
      `Service "${this.name}" is temporarily unavailable. Please try again later.`,
      'CIRCUIT_BREAKER_OPEN',
      ErrorCategory.SERVER,
      ErrorSeverity.MEDIUM,
      true,
      {
        circuitBreaker: this.name,
        nextAttemptTime: this.state.nextAttemptTime,
        failureCount: this.state.failureCount,
      }
    );
  }

  // Change circuit state and notify listeners
  private setState(newState: CircuitState): void {
    if (this.state.state !== newState) {
      const oldState = this.state.state;
      this.state.state = newState;
      
      console.log(`Circuit breaker "${this.name}" changed from ${oldState} to ${newState}`);
      
      this.listeners.forEach(listener => {
        try {
          listener(newState);
        } catch (error) {
          console.error('Error in circuit breaker listener:', error);
        }
      });
    }
  }

  // Public getters
  public getState(): CircuitState {
    return this.state.state;
  }

  public getName(): string {
    return this.name;
  }

  public getStats() {
    return {
      name: this.name,
      state: this.state.state,
      failureCount: this.state.failureCount,
      successCount: this.state.successCount,
      recentFailures: this.getRecentFailureCount(),
      totalRequests: this.state.recentRequests.length,
      nextAttemptTime: this.state.nextAttemptTime,
      isHealthy: this.state.state === CircuitState.CLOSED,
    };
  }

  // Force circuit state (for testing/manual control)
  public forceState(state: CircuitState): void {
    this.setState(state);
    
    if (state === CircuitState.OPEN) {
      this.state.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    } else if (state === CircuitState.CLOSED) {
      this.state.failureCount = 0;
      this.state.successCount = 0;
    }
  }

  // Reset circuit breaker
  public reset(): void {
    this.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      recentRequests: [],
    };
  }

  // Event listeners
  public addStateListener(listener: (state: CircuitState) => void): void {
    this.listeners.push(listener);
  }

  public removeStateListener(listener: (state: CircuitState) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
}

// Circuit Breaker Manager
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers = new Map<string, CircuitBreaker>();

  private constructor() {}

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  // Get or create circuit breaker
  public getCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  // Execute operation with circuit breaker
  public async execute<T>(
    breakerName: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(breakerName, config);
    return breaker.execute(operation);
  }

  // Get all circuit breaker stats
  public getAllStats() {
    const stats: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  // Get health summary
  public getHealthSummary() {
    const allStats = this.getAllStats();
    const breakerNames = Object.keys(allStats);
    
    const healthy = breakerNames.filter(name => allStats[name].isHealthy).length;
    const degraded = breakerNames.filter(name => allStats[name].state === CircuitState.HALF_OPEN).length;
    const failed = breakerNames.filter(name => allStats[name].state === CircuitState.OPEN).length;

    return {
      total: breakerNames.length,
      healthy,
      degraded,
      failed,
      overallHealth: failed === 0 ? (degraded === 0 ? 'healthy' : 'degraded') : 'unhealthy',
    };
  }

  // Reset all circuit breakers
  public resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Fallback Strategy Interface
export interface FallbackStrategy<T> {
  execute(): Promise<T> | T;
}

// Common Fallback Strategies
export class CachedResponseFallback<T> implements FallbackStrategy<T> {
  constructor(private cachedData: T) {}

  execute(): T {
    return this.cachedData;
  }
}

export class DefaultValueFallback<T> implements FallbackStrategy<T> {
  constructor(private defaultValue: T) {}

  execute(): T {
    return this.defaultValue;
  }
}

export class RetryFallback<T> implements FallbackStrategy<T> {
  constructor(
    private operation: () => Promise<T>,
    private maxRetries: number = 3,
    private delay: number = 1000
  ) {}

  async execute(): Promise<T> {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await this.operation();
      } catch (error) {
        if (i === this.maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, this.delay * (i + 1)));
      }
    }
    throw new Error('All retry attempts failed');
  }
}

// Resilient Operation Wrapper
export class ResilientOperation<T> {
  private circuitBreaker: CircuitBreaker;
  private fallbackStrategy?: FallbackStrategy<T>;

  constructor(
    name: string,
    private operation: () => Promise<T>,
    config?: {
      circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
      fallbackStrategy?: FallbackStrategy<T>;
    }
  ) {
    this.circuitBreaker = CircuitBreakerManager.getInstance()
      .getCircuitBreaker(name, config?.circuitBreakerConfig);
    this.fallbackStrategy = config?.fallbackStrategy;
  }

  async execute(): Promise<T> {
    try {
      return await this.circuitBreaker.execute(this.operation);
    } catch (error) {
      if (this.fallbackStrategy) {
        console.log(`Using fallback for ${this.circuitBreaker.getName()}`);
        return await this.fallbackStrategy.execute();
      }
      throw error;
    }
  }
}

// Export singleton
export const circuitBreakerManager = CircuitBreakerManager.getInstance();
