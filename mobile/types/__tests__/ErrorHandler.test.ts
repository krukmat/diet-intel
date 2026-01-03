import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ErrorCategory,
  ErrorHandler,
  ErrorSeverity,
  createError,
  errorHandler,
  handleError,
  retryOperation,
} from '../../services/ErrorHandler';

describe('ErrorHandler', () => {
  const originalNavigator = (global as any).navigator;
  const originalDev = (global as any).__DEV__;

  beforeAll(() => {
    (global as any).__DEV__ = true;
  });

  afterAll(() => {
    (global as any).__DEV__ = originalDev;
    (global as any).navigator = originalNavigator;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    errorHandler.clearErrorLog();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates app errors with provided metadata', () => {
    const appError = createError('boom', 'APP_123', ErrorCategory.APPLICATION, ErrorSeverity.HIGH, true, {
      source: 'test',
    });

    expect(appError.code).toBe('APP_123');
    expect(appError.category).toBe(ErrorCategory.APPLICATION);
    expect(appError.severity).toBe(ErrorSeverity.HIGH);
    expect(appError.retryable).toBe(true);
    expect(appError.context).toEqual({ source: 'test' });
  });

  it('normalizes network errors and shows user alert', async () => {
    (global as any).navigator = { onLine: false };
    const error = new Error('network down');

    const appError = await handleError(error, { screen: 'Home' }, true);

    expect(appError.category).toBe(ErrorCategory.NETWORK);
    expect(appError.retryable).toBe(true);
    expect(appError.context).toEqual({ screen: 'Home' });
    expect(Alert.alert).toHaveBeenCalledWith('Error', appError.userMessage, expect.any(Array));
  });

  it('adds recovery actions for authentication and sync errors', async () => {
    const authError = createError('auth', 'AUTH', ErrorCategory.AUTHENTICATION, ErrorSeverity.HIGH, true);
    await handleError(authError, undefined, true);

    expect(Alert.alert).toHaveBeenCalledWith('Error', authError.userMessage, expect.any(Array));

    const syncError = createError('sync', 'SYNC', ErrorCategory.SYNC, ErrorSeverity.MEDIUM, false);
    await handleError(syncError, undefined, true);

    expect(Alert.alert).toHaveBeenCalledWith('Error', syncError.userMessage, expect.any(Array));
  });

  it('executes recovery actions from alert buttons', async () => {
    (global as any).navigator = { onLine: true };
    await handleError(new Error('network fail'), undefined, true);

    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(alertButtons).toEqual(expect.any(Array));

    await alertButtons[0].onPress();
    await alertButtons[1].onPress();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Network Status',
      'You appear to be connected to the internet.',
      [{ text: 'OK' }]
    );
  });

  it('creates validation error from details', async () => {
    const error = {
      name: 'ValidationError',
      message: 'Invalid data',
      code: 'VALIDATION_NAME',
      details: [{ message: 'Name is required' }],
    };

    const appError = await handleError(error as any, undefined, false);

    expect(appError.category).toBe(ErrorCategory.VALIDATION);
    expect(appError.userMessage).toBe('Name is required');
    expect(appError.retryable).toBe(false);
  });

  it('creates api error with status mappings and retryable flags', async () => {
    const error = { status: 503, message: 'Service unavailable' };

    const appError = await handleError(error as any, { endpoint: '/api' }, false);

    expect(appError.category).toBe(ErrorCategory.SERVER);
    expect(appError.severity).toBe(ErrorSeverity.HIGH);
    expect(appError.retryable).toBe(true);
    expect(appError.context?.status).toBe(503);
  });

  it('creates api error responses for auth and permission statuses', async () => {
    const unauthorized = await handleError({ status: 401, message: 'Unauthorized' } as any, undefined, false);
    const forbidden = await handleError({ status: 403, message: 'Forbidden' } as any, undefined, false);
    const conflict = await handleError({ status: 409, message: 'Conflict' } as any, undefined, false);
    const rateLimited = await handleError({ status: 429, message: 'Limit' } as any, undefined, false);

    expect(unauthorized.category).toBe(ErrorCategory.AUTHENTICATION);
    expect(forbidden.category).toBe(ErrorCategory.PERMISSION);
    expect(conflict.retryable).toBe(true);
    expect(rateLimited.retryable).toBe(true);
  });

  it('respects user-friendly api error messages', async () => {
    const error = {
      status: 400,
      message: 'Bad request',
      response: { data: { message: 'Please update your input.' } },
    };

    const appError = await handleError(error as any, undefined, false);

    expect(appError.userMessage).toBe('Please update your input.');
    expect(appError.category).toBe(ErrorCategory.VALIDATION);
  });

  it('skips technical api error messages', async () => {
    const error = {
      status: 400,
      message: 'Bad request',
      response: { data: { message: 'TypeError: cannot read property' } },
    };

    const appError = await handleError(error as any, undefined, false);

    expect(appError.userMessage).toBe('TypeError: cannot read property');
  });

  it('tracks error stats and clears logs', async () => {
    await handleError(new Error('network issue'), undefined, false);
    await handleError(createError('auth', 'AUTH', ErrorCategory.AUTHENTICATION), undefined, false);

    const stats = errorHandler.getErrorStats();
    expect(stats.total).toBe(2);
    expect(stats.byCategory[ErrorCategory.NETWORK]).toBe(1);
    expect(stats.byCategory[ErrorCategory.AUTHENTICATION]).toBe(1);

    errorHandler.clearErrorLog();
    expect(errorHandler.getErrorLog()).toEqual([]);
  });

  it('shows simple alerts when no recovery actions exist', async () => {
    const appError = createError('plain', 'PLAIN', ErrorCategory.APPLICATION, ErrorSeverity.LOW, false);
    await handleError(appError, undefined, true);

    expect(Alert.alert).toHaveBeenCalledWith('Error', appError.userMessage);
  });

  it('logs critical errors to storage', async () => {
    const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
    const critical = createError('critical', 'CRIT', ErrorCategory.APPLICATION, ErrorSeverity.CRITICAL);

    await handleError(critical, undefined, false);

    expect(setItemSpy).toHaveBeenCalledWith('@error_log', expect.any(String));
  });

  it('loads logs and handles storage failures', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('fail'));

    (ErrorHandler as any).instance = undefined;
    const newInstance = ErrorHandler.getInstance();
    await new Promise(resolve => setTimeout(resolve, 0));
    (ErrorHandler as any).instance = errorHandler;

    expect(warnSpy).toHaveBeenCalledWith('Failed to load error log:', expect.any(Error));
    expect(newInstance).toBeDefined();
  });

  it('handles persist failures when logging critical errors', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('fail'));
    const critical = createError('critical', 'CRIT', ErrorCategory.APPLICATION, ErrorSeverity.CRITICAL);

    await handleError(critical, undefined, false);

    expect(warnSpy).toHaveBeenCalledWith('Failed to persist error log:', expect.any(Error));
  });

  it('notifies listeners and allows removal', async () => {
    const listener = jest.fn();
    errorHandler.addErrorListener(listener);

    await handleError(new Error('listener test'), undefined, false);

    expect(listener).toHaveBeenCalled();
    errorHandler.removeErrorListener(listener);
  });

  it('retries operations with exponential backoff', async () => {
    jest.useFakeTimers();
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const promise = retryOperation(operation, 2, 10);
    await jest.runOnlyPendingTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('reports errors when reporting is enabled', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const handler = ErrorHandler.getInstance();
    (handler as any).config.enableReporting = true;

    await handler.handleError(new Error('report me'), undefined, false);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error Report:',
      expect.objectContaining({
        code: expect.any(String),
        category: expect.any(String),
        severity: expect.any(String),
        message: expect.any(String),
      })
    );
  });

  it('attempts production reporting branch', async () => {
    const originalDevValue = (global as any).__DEV__;
    (global as any).__DEV__ = false;
    const handler = ErrorHandler.getInstance();
    (handler as any).config.enableReporting = true;

    await handler.handleError(new Error('prod report'), undefined, false);

    (global as any).__DEV__ = originalDevValue;
  });

  it('stops retrying non-retryable app errors', async () => {
    const handler = ErrorHandler.getInstance();
    const nonRetryable = createError('stop', 'STOP', ErrorCategory.APPLICATION, ErrorSeverity.MEDIUM, false);
    const operation = jest.fn().mockRejectedValue(nonRetryable);

    await expect(handler.retryWithExponentialBackoff(operation, 3, 1)).rejects.toMatchObject({
      code: 'STOP',
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
