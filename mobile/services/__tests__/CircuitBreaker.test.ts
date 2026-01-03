import { errorHandler, ErrorCategory } from '../ErrorHandler';
import {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  CachedResponseFallback,
  DefaultValueFallback,
  RetryFallback,
  ResilientOperation,
} from '../CircuitBreaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(errorHandler, 'handleError').mockResolvedValue(undefined as any);
  });

  it('opens after failures and blocks requests', async () => {
    const breaker = new CircuitBreaker('api', {
      failureThreshold: 2,
      recoveryTimeout: 1000,
      successThreshold: 1,
      timeout: 50,
      monitoringPeriod: 1000,
    });

    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toBeDefined();
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toBeDefined();

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toMatchObject({
      code: 'CIRCUIT_BREAKER_OPEN',
    });
  });

  it('transitions to half-open then closed on success', async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker('api', {
      failureThreshold: 1,
      recoveryTimeout: 100,
      successThreshold: 1,
      timeout: 50,
      monitoringPeriod: 1000,
    });

    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toBeDefined();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(110);
    await expect(breaker.execute(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    jest.useRealTimers();
  });

  it('rejects with timeout error when operation times out', async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker('api', { timeout: 10 });

    const promise = breaker.execute(() => new Promise(() => undefined));
    jest.advanceTimersByTime(11);

    await expect(promise).rejects.toMatchObject({
      code: 'CIRCUIT_BREAKER_TIMEOUT',
      category: ErrorCategory.NETWORK,
    });
    jest.useRealTimers();
  });

  it('tracks stats and allows forced state changes', async () => {
    const breaker = new CircuitBreaker('stats', { failureThreshold: 1, monitoringPeriod: 1000 });
    expect(breaker.getStats().isHealthy).toBe(true);

    breaker.forceState(CircuitState.OPEN);
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.forceState(CircuitState.CLOSED);
    expect(breaker.getStats().failureCount).toBe(0);
  });
});

describe('CircuitBreakerManager', () => {
  it('manages breakers and health summary', async () => {
    const manager = CircuitBreakerManager.getInstance();
    manager.resetAll();

    const breaker = manager.getCircuitBreaker('service', { failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toBeDefined();

    const summary = manager.getHealthSummary();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.failed).toBeGreaterThan(0);
  });
});

describe('Fallbacks and ResilientOperation', () => {
  it('returns cached fallback data', async () => {
    const fallback = new CachedResponseFallback({ ok: true });
    const op = new ResilientOperation('cache', () => Promise.reject(new Error('fail')), {
      fallbackStrategy: fallback,
    });

    await expect(op.execute()).resolves.toEqual({ ok: true });
  });

  it('returns default fallback data', async () => {
    const fallback = new DefaultValueFallback('default');
    const op = new ResilientOperation('default', () => Promise.reject(new Error('fail')), {
      fallbackStrategy: fallback,
    });

    await expect(op.execute()).resolves.toBe('default');
  });

  it('retries with fallback strategy', async () => {
    jest.useFakeTimers();
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');
    const fallback = new RetryFallback(operation, 2, 5);

    const promise = fallback.execute();
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
