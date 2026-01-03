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
});
