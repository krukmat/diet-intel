import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from '../ApiClient';

// Mock react-native modules before any imports to avoid hook conflicts
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    Alert: { alert: jest.fn() },
  };
});

const buildFetchResponse = (data: any, ok: boolean = true, status: number = 200) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  json: jest.fn(async () => data)
});

const resetClient = (dev?: boolean) => {
  if (dev !== undefined) {
    (global as any).__DEV__ = dev;
  }

  const existing = (ApiClient as any).instance;
  if (existing?.unsubscribeNetInfo) {
    existing.unsubscribeNetInfo();
  }

  (ApiClient as any).instance = undefined;
  return ApiClient.getInstance();
};

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (!(global as any).AbortSignal) {
      (global as any).AbortSignal = { timeout: jest.fn(() => undefined) };
    } else if (!(global as any).AbortSignal.timeout) {
      (global as any).AbortSignal.timeout = jest.fn(() => undefined);
    }

    (global as any).fetch = jest.fn();
  });

  it('returns a singleton instance', () => {
    resetClient(true);
    const client = ApiClient.getInstance();
    const clientAgain = ApiClient.getInstance();

    expect(client).toBe(clientAgain);
  });

  it('sets and clears auth tokens', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@auth_token') {
        return Promise.resolve('access-1');
      }
      if (key === '@refresh_token') {
        return Promise.resolve('refresh-1');
      }
      return Promise.resolve(null);
    });
    const client = resetClient(true);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    await client.setAuthTokens('access-1', 'refresh-1');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@auth_token', 'access-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@refresh_token', 'refresh-1');
    expect(client.isAuthenticated()).toBe(true);

    await client.clearAuthTokens();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@refresh_token');
  });

  it('returns mock response in development mode', async () => {
    const client = resetClient(true);

    const result = await client.request({
      method: 'GET',
      url: '/mock',
      mockResponse: { ok: true }
    });

    expect(result.status).toBe('success');
    expect(result.message).toBe('Mock response');
    expect(result.data).toEqual({ ok: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('caches GET responses', async () => {
    const client = resetClient(false);
    (global.fetch as jest.Mock).mockResolvedValue(buildFetchResponse({ value: 1 }));

    const first = await client.get('/cached');
    const second = await client.get('/cached');

    expect(first.data).toEqual({ value: 1 });
    expect(second.data).toEqual({ value: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('queues request when offline', async () => {
    const client = resetClient(false);
    (client as any).networkState.isConnected = false;

    await expect(client.get('/offline')).rejects.toThrow('No internet connection. Request has been queued.');
    expect(client.getQueuedRequestCount()).toBe(1);
  });

  it('retries retryable requests with backoff', async () => {
    jest.useFakeTimers();
    const client = resetClient(false);

    (client as any).executeRequest = jest
      .fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValueOnce({ data: { ok: true }, status: 'success', timestamp: 't' });

    const promise = client.request({ method: 'POST', url: '/retry', data: { a: 1 } });

    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual({ data: { ok: true }, status: 'success', timestamp: 't' });
    expect((client as any).executeRequest).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  }, 15000);

  it('normalizes API errors with code', async () => {
    const client = resetClient(false);
    (client as any).executeRequest = jest.fn().mockRejectedValue({
      data: { code: 'BAD_REQUEST', message: 'Nope', details: { field: 'name' } }
    });

    await expect(client.request({ method: 'POST', url: '/fail', retryable: false })).rejects.toEqual({
      code: 'BAD_REQUEST',
      message: 'Nope',
      details: { field: 'name' },
      timestamp: expect.any(String)
    });
  });

  it('builds query string with filtered params', () => {
    const client = resetClient(false);
    const query = (client as any).buildQueryString({ a: 1, b: undefined, c: null, d: 'ok' });

    expect(query).toBe('a=1&d=ok');
  });

  it('refreshes token on unauthorized response and retries request', async () => {
    const client = resetClient(false);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (client as any).refreshToken = 'refresh-old';

    const executeRequest = jest.fn()
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce({
        data: { accessToken: 'access-new', refreshToken: 'refresh-new' },
        status: 'success',
        timestamp: 't',
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        status: 'success',
        timestamp: 't2',
      });

    (client as any).executeRequest = executeRequest;

    await expect(client.request({ method: 'GET', url: '/secure' })).resolves.toEqual({
      data: { ok: true },
      status: 'success',
      timestamp: 't2',
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@auth_token', 'access-new');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@refresh_token', 'refresh-new');
    expect(executeRequest).toHaveBeenCalledTimes(3);
  });

  it('clears auth tokens when refresh fails', async () => {
    const client = resetClient(false);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (client as any).refreshToken = 'refresh-old';

    (client as any).executeRequest = jest.fn().mockRejectedValue({ status: 401 });
    (client as any).refreshAccessToken = jest.fn().mockRejectedValue(new Error('nope'));

    await expect(client.request({ method: 'GET', url: '/secure' })).rejects.toEqual({
      code: 'AUTH_FAILED',
      message: 'Authentication failed. Please login again.',
      timestamp: expect.any(String),
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@refresh_token');
  });

  it('executes request with auth header and query params', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@auth_token') {
        return Promise.resolve('access-token');
      }
      if (key === '@refresh_token') {
        return Promise.resolve('refresh-token');
      }
      return Promise.resolve(null);
    });
    const client = resetClient(true);
    (global.fetch as jest.Mock).mockResolvedValue(buildFetchResponse({ ok: true }));
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await client.setAuthTokens('access-token', 'refresh-token');

    await client.get('/search', { q: 'hello world', limit: 2 });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/search?q=hello%20world&limit=2',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('expires cached entries based on ttl', async () => {
    const client = resetClient(false);
    (global.fetch as jest.Mock).mockResolvedValue(buildFetchResponse({ value: 2 }));

    const cacheKey = (client as any).getCacheKey('/cached', undefined);
    (client as any).cache.set(cacheKey, {
      data: { data: { value: 1 }, status: 'success', timestamp: 't' },
      timestamp: Date.now() - 10 * 60 * 1000,
      ttl: 1000,
    });

    const result = await client.get('/cached');

    expect(result.data).toEqual({ value: 2 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('processes queued requests when back online', async () => {
    const client = resetClient(false);
    const executeRequest = jest.fn().mockResolvedValue({ data: { ok: true } });
    (client as any).executeRequest = executeRequest;
    (client as any).networkState.isConnected = false;

    await expect(client.get('/offline')).rejects.toThrow('No internet connection. Request has been queued.');
    expect(client.getQueuedRequestCount()).toBe(1);

    (client as any).networkState.isConnected = true;
    await (client as any).processRequestQueue();

    expect(executeRequest).toHaveBeenCalledTimes(1);
    expect(client.getQueuedRequestCount()).toBe(0);
  });

  it('considers abort errors retryable', () => {
    const client = resetClient(false);

    expect((client as any).isRetryableError({ name: 'AbortError' })).toBe(true);
  });

  it('throws a network error when unauthorized without refresh token', async () => {
    const client = resetClient(false);
    (client as any).executeRequest = jest.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' });

    await expect(client.request({ method: 'GET', url: '/secure' })).rejects.toEqual({
      code: 'NETWORK_ERROR',
      message: 'Unauthorized',
      timestamp: expect.any(String),
    });
  });

  it('queues up to 50 requests when offline', async () => {
    const client = resetClient(false);
    (client as any).networkState.isConnected = false;

    for (let i = 0; i < 55; i += 1) {
      await expect(client.get(`/offline-${i}`)).rejects.toThrow('Request has been queued.');
    }

    expect(client.getQueuedRequestCount()).toBe(50);
  });

  it('respects non-retryable offline requests', async () => {
    const client = resetClient(false);
    (client as any).networkState.isConnected = false;

    await expect(client.request({ method: 'GET', url: '/offline', retryable: false })).rejects.toThrow(
      'No internet connection.',
    );
    expect(client.getQueuedRequestCount()).toBe(0);
  });

  it('clears cache when requested', async () => {
    const client = resetClient(false);
    (global.fetch as jest.Mock).mockResolvedValue(buildFetchResponse({ value: 1 }));

    await client.get('/cached');
    expect((client as any).cache.size).toBeGreaterThan(0);

    client.clearCache();
    expect((client as any).cache.size).toBe(0);
  });

  it('exposes network state snapshot', () => {
    const client = resetClient(false);
    (client as any).networkState = { isConnected: false, type: 'wifi', isInternetReachable: false };

    expect(client.getNetworkState()).toEqual({
      isConnected: false,
      type: 'wifi',
      isInternetReachable: false,
    });
  });

  it('sends payloads with post/put/delete helpers', async () => {
    const client = resetClient(true);
    (global.fetch as jest.Mock).mockResolvedValue(buildFetchResponse({ ok: true }));

    await client.post('/items', { name: 'A' });
    await client.put('/items/1', { name: 'B' });
    await client.delete('/items/1');

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'A' }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8000/items/1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'B' }),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:8000/items/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
