// Enhanced Error Handler Service
// Centralized error handling with user-friendly messages and recovery suggestions

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Error Categories
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  SERVER = 'server',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  APPLICATION = 'application',
  SYNC = 'sync',
  STORAGE = 'storage',
}

// Error Severity Levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Enhanced Error Interface
export interface AppError extends Error {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  technicalMessage: string;
  retryable: boolean;
  context?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

// Recovery Actions
export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  type: 'primary' | 'secondary' | 'destructive';
}

// Error Handler Configuration
interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableReporting: boolean;
  maxErrorLogs: number;
  retryAttempts: number;
  retryBaseDelay: number;
  showUserFriendlyMessages: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private config: ErrorHandlerConfig;
  private errorLog: AppError[] = [];
  private listeners: Array<(error: AppError) => void> = [];

  private constructor() {
    this.config = {
      enableLogging: true,
      enableReporting: __DEV__ ? false : true,
      maxErrorLogs: 100,
      retryAttempts: 3,
      retryBaseDelay: 1000,
      showUserFriendlyMessages: true,
    };
    this.loadErrorLog();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Main error handling method
  public async handleError(
    error: Error | AppError,
    context?: Record<string, any>,
    showToUser: boolean = true
  ): Promise<AppError> {
    const appError = this.normalizeError(error, context);
    
    // Log error
    if (this.config.enableLogging) {
      await this.logError(appError);
    }

    // Report error (analytics/crash reporting)
    if (this.config.enableReporting) {
      await this.reportError(appError);
    }

    // Notify listeners
    this.notifyListeners(appError);

    // Show user-friendly message
    if (showToUser && this.config.showUserFriendlyMessages) {
      this.showUserError(appError);
    }

    return appError;
  }

  // Normalize various error types to AppError
  private normalizeError(error: Error | AppError, context?: Record<string, any>): AppError {
    if (this.isAppError(error)) {
      return { ...error, context: { ...error.context, ...context } };
    }

    // Handle network errors
    if (this.isNetworkError(error)) {
      return this.createNetworkError(error, context);
    }

    // Handle API errors
    if (this.isApiError(error)) {
      return this.createApiError(error, context);
    }

    // Handle validation errors
    if (this.isValidationError(error)) {
      return this.createValidationError(error, context);
    }

    // Default application error
    return this.createApplicationError(error, context);
  }

  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'category' in error && 'severity' in error;
  }

  private isNetworkError(error: any): boolean {
    return error?.name === 'NetworkError' || 
           error?.code === 'NETWORK_ERROR' ||
           error?.message?.includes('network') ||
           error?.message?.includes('fetch');
  }

  private isApiError(error: any): boolean {
    return error?.status >= 400 || 
           error?.response?.status >= 400 ||
           error?.code?.startsWith('API_');
  }

  private isValidationError(error: any): boolean {
    return error?.code?.startsWith('VALIDATION_') ||
           error?.name === 'ValidationError' ||
           error?.status === 422;
  }

  // Error creation methods
  private createNetworkError(error: Error, context?: Record<string, any>): AppError {
    const isOffline = !navigator?.onLine;
    
    return {
      ...error,
      code: 'NETWORK_ERROR',
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      userMessage: isOffline 
        ? 'You appear to be offline. Please check your internet connection and try again.'
        : 'Unable to connect to our servers. Please check your internet connection and try again.',
      technicalMessage: error.message,
      retryable: true,
      context,
      timestamp: Date.now(),
    };
  }

  private createApiError(error: any, context?: Record<string, any>): AppError {
    const status = error?.status || error?.response?.status || 500;
    const errorData = error?.data || error?.response?.data || {};
    
    let userMessage = 'Something went wrong. Please try again.';
    let category = ErrorCategory.SERVER;
    let severity = ErrorSeverity.MEDIUM;
    let retryable = false;

    switch (status) {
      case 400:
        userMessage = 'Invalid request. Please check your input and try again.';
        category = ErrorCategory.VALIDATION;
        break;
      case 401:
        userMessage = 'Your session has expired. Please log in again.';
        category = ErrorCategory.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
        break;
      case 403:
        userMessage = 'You don\'t have permission to perform this action.';
        category = ErrorCategory.PERMISSION;
        break;
      case 404:
        userMessage = 'The requested item could not be found.';
        break;
      case 409:
        userMessage = 'This action conflicts with existing data. Please refresh and try again.';
        retryable = true;
        break;
      case 429:
        userMessage = 'Too many requests. Please wait a moment and try again.';
        retryable = true;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        userMessage = 'Our servers are experiencing issues. Please try again in a few moments.';
        retryable = true;
        severity = ErrorSeverity.HIGH;
        break;
    }

    // Use server-provided message if available and user-friendly
    if (errorData.message && this.isUserFriendlyMessage(errorData.message)) {
      userMessage = errorData.message;
    }

    return {
      name: error.name || 'ApiError',
      message: error.message || `API Error ${status}`,
      code: errorData.code || `API_ERROR_${status}`,
      category,
      severity,
      userMessage,
      technicalMessage: `${status}: ${error.message || 'Unknown API error'}`,
      retryable,
      context: { ...context, status, errorData },
      timestamp: Date.now(),
    };
  }

  private createValidationError(error: any, context?: Record<string, any>): AppError {
    const validationDetails = error?.details || error?.errors || [];
    const fieldErrors = Array.isArray(validationDetails) ? validationDetails : [validationDetails];
    
    let userMessage = 'Please check your input and try again.';
    if (fieldErrors.length > 0) {
      const firstError = fieldErrors[0];
      if (typeof firstError === 'string') {
        userMessage = firstError;
      } else if (firstError?.message) {
        userMessage = firstError.message;
      }
    }

    return {
      name: 'ValidationError',
      message: error.message || 'Validation failed',
      code: error.code || 'VALIDATION_ERROR',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      userMessage,
      technicalMessage: `Validation error: ${JSON.stringify(fieldErrors)}`,
      retryable: false,
      context: { ...context, validationDetails: fieldErrors },
      timestamp: Date.now(),
    };
  }

  private createApplicationError(error: Error, context?: Record<string, any>): AppError {
    return {
      ...error,
      code: 'APP_ERROR',
      category: ErrorCategory.APPLICATION,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: error.message,
      retryable: true,
      context,
      timestamp: Date.now(),
    };
  }

  // User-friendly message validation
  private isUserFriendlyMessage(message: string): boolean {
    const technicalTerms = ['null', 'undefined', 'NaN', 'TypeError', 'ReferenceError', 'stack trace'];
    const lowerMessage = message.toLowerCase();
    return !technicalTerms.some(term => lowerMessage.includes(term)) && 
           message.length < 200 && 
           !message.includes('{') && 
           !message.includes('[');
  }

  // Show error to user
  private showUserError(error: AppError): void {
    const actions = this.getRecoveryActions(error);
    
    if (actions.length === 0) {
      Alert.alert('Error', error.userMessage);
      return;
    }

    const alertButtons = actions.map(action => ({
      text: action.label,
      style: action.type === 'destructive' ? 'destructive' as const : 'default' as const,
      onPress: action.action,
    }));

    // Add dismiss button
    alertButtons.push({
      text: 'Dismiss',
      style: 'cancel' as const,
    });

    Alert.alert('Error', error.userMessage, alertButtons);
  }

  // Get recovery actions based on error type
  private getRecoveryActions(error: AppError): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Add retry action for retryable errors
    if (error.retryable) {
      actions.push({
        label: 'Retry',
        action: () => this.retryLastOperation(error),
        type: 'primary',
      });
    }

    // Category-specific actions
    switch (error.category) {
      case ErrorCategory.NETWORK:
        actions.push({
          label: 'Check Connection',
          action: () => this.checkNetworkConnection(),
          type: 'secondary',
        });
        break;
      
      case ErrorCategory.AUTHENTICATION:
        actions.push({
          label: 'Login Again',
          action: () => this.handleAuthenticationError(),
          type: 'primary',
        });
        break;

      case ErrorCategory.SYNC:
        actions.push({
          label: 'View Sync Status',
          action: () => this.showSyncStatus(),
          type: 'secondary',
        });
        break;
    }

    return actions;
  }

  // Recovery action implementations
  private async retryLastOperation(error: AppError): Promise<void> {
    // This would be implemented based on the specific operation
    console.log('Retrying operation for error:', error.code);
  }

  private async checkNetworkConnection(): Promise<void> {
    Alert.alert(
      'Network Status',
      navigator?.onLine ? 'You appear to be connected to the internet.' : 'You appear to be offline.',
      [{ text: 'OK' }]
    );
  }

  private async handleAuthenticationError(): Promise<void> {
    // This would trigger the authentication flow
    console.log('Triggering authentication flow');
  }

  private async showSyncStatus(): Promise<void> {
    // This would open the sync status modal
    console.log('Opening sync status');
  }

  // Error logging
  private async logError(error: AppError): Promise<void> {
    this.errorLog.unshift(error);
    
    // Limit log size
    if (this.errorLog.length > this.config.maxErrorLogs) {
      this.errorLog = this.errorLog.slice(0, this.config.maxErrorLogs);
    }

    // Persist critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      await this.persistErrorLog();
    }
  }

  private async loadErrorLog(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@error_log');
      if (stored) {
        this.errorLog = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load error log:', error);
    }
  }

  private async persistErrorLog(): Promise<void> {
    try {
      await AsyncStorage.setItem('@error_log', JSON.stringify(this.errorLog.slice(0, 50)));
    } catch (error) {
      console.warn('Failed to persist error log:', error);
    }
  }

  // Error reporting (for analytics)
  private async reportError(error: AppError): Promise<void> {
    if (__DEV__) {
      console.error('Error Report:', {
        code: error.code,
        category: error.category,
        severity: error.severity,
        message: error.technicalMessage,
        context: error.context,
      });
      return;
    }

    // In production, this would send to analytics service
    try {
      // Example: await analyticsService.reportError(error);
    } catch (reportingError) {
      console.warn('Failed to report error:', reportingError);
    }
  }

  // Public API methods
  public createError(
    message: string,
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    retryable: boolean = false,
    context?: Record<string, any>
  ): AppError {
    return {
      name: 'AppError',
      message,
      code,
      category,
      severity,
      userMessage: message,
      technicalMessage: message,
      retryable,
      context,
      timestamp: Date.now(),
    };
  }

  public async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    attempts: number = this.config.retryAttempts,
    baseDelay: number = this.config.retryBaseDelay
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === attempts - 1) {
          break; // Last attempt failed
        }

        // Don't retry non-retryable errors
        if (this.isAppError(error) && !error.retryable) {
          break;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // Event listeners
  public addErrorListener(listener: (error: AppError) => void): void {
    this.listeners.push(listener);
  }

  public removeErrorListener(listener: (error: AppError) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.warn('Error in error listener:', listenerError);
      }
    });
  }

  // Getters
  public getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  public getErrorStats(): { total: number; bySeverity: Record<string, number>; byCategory: Record<string, number> } {
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    this.errorLog.forEach(error => {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
    });

    return {
      total: this.errorLog.length,
      bySeverity,
      byCategory,
    };
  }

  public clearErrorLog(): void {
    this.errorLog = [];
    AsyncStorage.removeItem('@error_log');
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const handleError = (error: Error, context?: Record<string, any>, showToUser?: boolean) =>
  errorHandler.handleError(error, context, showToUser);

export const createError = (
  message: string,
  code: string,
  category: ErrorCategory,
  severity?: ErrorSeverity,
  retryable?: boolean,
  context?: Record<string, any>
) => errorHandler.createError(message, code, category, severity, retryable, context);

export const retryOperation = <T>(operation: () => Promise<T>, attempts?: number, baseDelay?: number) =>
  errorHandler.retryWithExponentialBackoff(operation, attempts, baseDelay);