// Toast Notifications React Hook
// Provides easy-to-use toast notifications with queue management

import { useState, useCallback, useRef, useEffect } from 'react';

export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading',
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
  dismissible?: boolean;
  icon?: string;
  timestamp: number;
}

interface ToastConfig {
  maxToasts: number;
  defaultDuration: number;
  stackLimit: number;
  position: 'top' | 'bottom';
}

const DEFAULT_CONFIG: ToastConfig = {
  maxToasts: 5,
  defaultDuration: 4000,
  stackLimit: 3,
  position: 'top',
};

const DURATION_BY_TYPE: Record<ToastType, number> = {
  [ToastType.SUCCESS]: 3000,
  [ToastType.ERROR]: 6000,
  [ToastType.WARNING]: 5000,
  [ToastType.INFO]: 4000,
  [ToastType.LOADING]: 0, // Persist until manually dismissed
};

export function useToast(config: Partial<ToastConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Generate unique ID
  const generateId = useCallback(() => {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Auto-dismiss toast
  const scheduleAutoDismiss = useCallback((toast: Toast) => {
    if (toast.duration === 0 || toast.type === ToastType.LOADING) {
      return; // Don't auto-dismiss
    }

    const duration = toast.duration ?? DURATION_BY_TYPE[toast.type];
    
    const timeoutId = setTimeout(() => {
      dismissToast(toast.id);
    }, duration);

    timeoutRefs.current.set(toast.id, timeoutId);
  }, []);

  // Clear timeout
  const clearToastTimeout = useCallback((toastId: string) => {
    const timeoutId = timeoutRefs.current.get(toastId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(toastId);
    }
  }, []);

  // Add toast to queue
  const addToast = useCallback((toastData: Omit<Toast, 'id' | 'timestamp'>) => {
    const toast: Toast = {
      ...toastData,
      id: generateId(),
      timestamp: Date.now(),
      dismissible: toastData.dismissible !== false, // Default to true
    };

    setToasts(prev => {
      // Remove oldest toasts if we exceed the limit
      const newToasts = prev.length >= finalConfig.maxToasts 
        ? prev.slice(-(finalConfig.maxToasts - 1))
        : prev;
      
      // Add new toast
      return [...newToasts, toast];
    });

    // Schedule auto-dismiss
    scheduleAutoDismiss(toast);

    return toast.id;
  }, [generateId, finalConfig.maxToasts, scheduleAutoDismiss]);

  // Dismiss specific toast
  const dismissToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
    clearToastTimeout(toastId);
  }, [clearToastTimeout]);

  // Dismiss all toasts
  const dismissAll = useCallback(() => {
    setToasts([]);
    timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
  }, []);

  // Update existing toast
  const updateToast = useCallback((toastId: string, updates: Partial<Omit<Toast, 'id' | 'timestamp'>>) => {
    setToasts(prev => prev.map(toast => 
      toast.id === toastId 
        ? { ...toast, ...updates }
        : toast
    ));

    // If duration changed, reschedule auto-dismiss
    if (updates.duration !== undefined) {
      clearToastTimeout(toastId);
      const toast = toasts.find(t => t.id === toastId);
      if (toast) {
        scheduleAutoDismiss({ ...toast, ...updates } as Toast);
      }
    }
  }, [toasts, clearToastTimeout, scheduleAutoDismiss]);

  // Convenience methods for different toast types
  const success = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: ToastType.SUCCESS,
      title,
      message,
      icon: '✅',
      ...options,
    });
  }, [addToast]);

  const error = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: ToastType.ERROR,
      title,
      message,
      icon: '❌',
      ...options,
    });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: ToastType.WARNING,
      title,
      message,
      icon: '⚠️',
      ...options,
    });
  }, [addToast]);

  const info = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: ToastType.INFO,
      title,
      message,
      icon: 'ℹ️',
      ...options,
    });
  }, [addToast]);

  const loading = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({
      type: ToastType.LOADING,
      title,
      message,
      icon: '⏳',
      duration: 0,
      dismissible: false,
      ...options,
    });
  }, [addToast]);

  // Helper for API operations
  const promise = useCallback(<T,>(
    promiseValue: Promise<T>,
    {
      loading: loadingMessage = 'Loading...',
      success: successMessage = 'Success!',
      error: errorMessage = 'Something went wrong',
    }: {
      loading?: string;
      success?: string | ((data: T) => string);
      error?: string | ((error: Error) => string);
    } = {}
  ): Promise<T> => {
    const loadingId = loading(loadingMessage);

    return promiseValue
      .then((data) => {
        dismissToast(loadingId);
        const message = typeof successMessage === 'function' 
          ? successMessage(data) 
          : successMessage;
        success(message);
        return data;
      })
      .catch((err) => {
        dismissToast(loadingId);
        const message = typeof errorMessage === 'function' 
          ? errorMessage(err) 
          : errorMessage;
        error(message);
        throw err;
      });
  }, [loading, dismissToast, success, error]);

  // Recipe-specific convenience methods
  const recipeSuccess = useCallback((action: string, recipeName?: string) => {
    const title = recipeName ? `${action} "${recipeName}"` : action;
    return success(title, 'Recipe operation completed successfully');
  }, [success]);

  const recipeError = useCallback((action: string, recipeName?: string, err?: Error) => {
    const title = recipeName ? `Failed to ${action.toLowerCase()} "${recipeName}"` : `Failed to ${action.toLowerCase()}`;
    const message = err?.message || 'Please try again or check your connection';
    return error(title, message);
  }, [error]);

  const syncNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const methods = { success, error, info };
    return methods[type]('Sync Update', message, {
      icon: type === 'success' ? '🔄✅' : type === 'error' ? '🔄❌' : '🔄',
    });
  }, [success, error, info]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutRefs.current.clear();
    };
  }, []);

  return {
    // State
    toasts,
    
    // Core methods
    addToast,
    dismissToast,
    dismissAll,
    updateToast,
    
    // Type-specific methods
    success,
    error,
    warning,
    info,
    loading,
    
    // Utility methods
    promise,
    recipeSuccess,
    recipeError,
    syncNotification,
    
    // Configuration
    config: finalConfig,
  };
}
