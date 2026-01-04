/**
 * Error States Components for DietIntel Mobile App
 * Reusable error state components for consistent error handling UX
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ErrorStateProps {
  icon?: string;
  title: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
  backgroundColor?: string;
  testID?: string;
}

/**
 * Basic error state component
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  icon = '❌',
  title = 'Something went wrong',
  message,
  onRetry,
  retryText = 'Try Again',
  backgroundColor = '#FFFFFF',
  testID = 'error-state'
}) => {
  return (
    <View 
      style={[styles.container, { backgroundColor }]} 
      testID={testID}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        
        {onRetry && (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={onRetry}
            testID="error-state-retry"
          >
            <Text style={styles.retryButtonText}>{retryText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * Network error state
 */
export const NetworkErrorState: React.FC<{
  onRetry?: () => void;
  onOfflineMode?: () => void;
  testID?: string;
}> = ({
  onRetry,
  onOfflineMode,
  testID = 'network-error-state'
}) => {
  return (
    <ErrorState
      icon="📡"
      title="Connection problem"
      message="Please check your internet connection and try again"
      onRetry={onRetry}
      retryText="Retry"
      testID={testID}
    />
  );
};

/**
 * Server error state
 */
export const ServerErrorState: React.FC<{
  onRetry?: () => void;
  onContactSupport?: () => void;
  testID?: string;
}> = ({
  onRetry,
  onContactSupport,
  testID = 'server-error-state'
}) => {
  return (
    <ErrorState
      icon="🛠️"
      title="Server error"
      message="Our servers are having trouble right now. Please try again later"
      onRetry={onRetry}
      retryText="Try Again"
      testID={testID}
    />
  );
};

/**
 * Authentication error state
 */
export const AuthErrorState: React.FC<{
  onLogin?: () => void;
  onSignUp?: () => void;
  testID?: string;
}> = ({
  onLogin,
  onSignUp,
  testID = 'auth-error-state'
}) => {
  return (
    <ErrorState
      icon="🔐"
      title="Authentication required"
      message="Please sign in to access this content"
      onRetry={onLogin}
      retryText="Sign In"
      testID={testID}
    />
  );
};

/**
 * Permission denied error state
 */
export const PermissionErrorState: React.FC<{
  permission: string;
  onGrantPermission?: () => void;
  onContinueWithout?: () => void;
  testID?: string;
}> = ({
  permission,
  onGrantPermission,
  onContinueWithout,
  testID = 'permission-error-state'
}) => {
  return (
    <ErrorState
      icon="🚫"
      title="Permission required"
      message={`This feature needs access to ${permission} to work properly`}
      onRetry={onGrantPermission}
      retryText="Grant Permission"
      testID={testID}
    />
  );
};

/**
 * Not found error state
 */
export const NotFoundErrorState: React.FC<{
  item?: string;
  onGoBack?: () => void;
  onGoHome?: () => void;
  testID?: string;
}> = ({
  item = 'content',
  onGoBack,
  onGoHome,
  testID = 'not-found-error-state'
}) => {
  return (
    <ErrorState
      icon="🔍"
      title="Not found"
      message={`We couldn't find the ${item} you're looking for`}
      onRetry={onGoBack}
      retryText="Go Back"
      testID={testID}
    />
  );
};

/**
 * Generic API error state
 */
export const ApiErrorState: React.FC<{
  errorCode?: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
  testID?: string;
}> = ({
  errorCode,
  onRetry,
  onContactSupport,
  testID = 'api-error-state'
}) => {
  const title = errorCode ? `Error ${errorCode}` : 'Request failed';
  const message = errorCode 
    ? `Something went wrong with your request (${errorCode})`
    : 'There was a problem processing your request';
    
  return (
    <ErrorState
      icon="⚠️"
      title={title}
      message={message}
      onRetry={onRetry}
      retryText="Try Again"
      testID={testID}
    />
  );
};

/**
 * Payment error state
 */
export const PaymentErrorState: React.FC<{
  onRetry?: () => void;
  onUpdatePayment?: () => void;
  testID?: string;
}> = ({
  onRetry,
  onUpdatePayment,
  testID = 'payment-error-state'
}) => {
  return (
    <ErrorState
      icon="💳"
      title="Payment failed"
      message="There was a problem processing your payment. Please check your payment method"
      onRetry={onRetry}
      retryText="Try Again"
      testID={testID}
    />
  );
};

/**
 * Upload error state
 */
export const UploadErrorState: React.FC<{
  fileType?: string;
  onRetry?: () => void;
  onChooseDifferent?: () => void;
  testID?: string;
}> = ({
  fileType = 'file',
  onRetry,
  onChooseDifferent,
  testID = 'upload-error-state'
}) => {
  return (
    <ErrorState
      icon="📤"
      title="Upload failed"
      message={`There was a problem uploading your ${fileType}. Please try again`}
      onRetry={onRetry}
      retryText="Try Again"
      testID={testID}
    />
  );
};

/**
 * Camera error state
 */
export const CameraErrorState: React.FC<{
  onRetry?: () => void;
  onChooseFromGallery?: () => void;
  testID?: string;
}> = ({
  onRetry,
  onChooseFromGallery,
  testID = 'camera-error-state'
}) => {
  return (
    <ErrorState
      icon="📷"
      title="Camera unavailable"
      message="Unable to access camera. Please check permissions or try a different method"
      onRetry={onRetry}
      retryText="Try Camera"
      testID={testID}
    />
  );
};

/**
 * Storage full error state
 */
export const StorageErrorState: React.FC<{
  onClearCache?: () => void;
  onUpgrade?: () => void;
  testID?: string;
}> = ({
  onClearCache,
  onUpgrade,
  testID = 'storage-error-state'
}) => {
  return (
    <ErrorState
      icon="💾"
      title="Storage full"
      message="Your device storage is full. Free up some space or upgrade your storage"
      onRetry={onClearCache}
      retryText="Clear Cache"
      testID={testID}
    />
  );
};

/**
 * Inline error state for forms
 */
export const InlineErrorState: React.FC<{
  message: string;
  onDismiss?: () => void;
  testID?: string;
}> = ({
  message,
  onDismiss,
  testID = 'inline-error-state'
}) => {
  return (
    <View style={styles.inlineContainer} testID={testID}>
      <Text style={styles.inlineIcon}>⚠️</Text>
      <Text style={styles.inlineMessage}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} testID="inline-error-dismiss">
          <Text style={styles.dismissButton}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Form validation error state
 */
export const ValidationErrorState: React.FC<{
  field?: string;
  message: string;
  testID?: string;
}> = ({
  field,
  message,
  testID = 'validation-error-state'
}) => {
  const displayMessage = field ? `${field}: ${message}` : message;
  
  return (
    <InlineErrorState
      message={displayMessage}
      testID={testID}
    />
  );
};

/**
 * Banner error state for top of screen
 */
export const ErrorBanner: React.FC<{
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  testID?: string;
}> = ({
  message,
  onDismiss,
  onRetry,
  testID = 'error-banner'
}) => {
  return (
    <View style={styles.bannerContainer} testID={testID}>
      <View style={styles.bannerContent}>
        <Text style={styles.bannerIcon}>⚠️</Text>
        <Text style={styles.bannerMessage}>{message}</Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} testID="error-banner-retry">
            <Text style={styles.bannerAction}>Retry</Text>
          </TouchableOpacity>
        )}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} testID="error-banner-dismiss">
            <Text style={styles.bannerDismiss}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
  },
  inlineIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#D70015',
  },
  inlineMessage: {
    fontSize: 14,
    color: '#D70015',
    flex: 1,
  },
  dismissButton: {
    fontSize: 18,
    color: '#D70015',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bannerContainer: {
    backgroundColor: '#FFE5E5',
    borderBottomWidth: 1,
    borderBottomColor: '#D70015',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#D70015',
  },
  bannerMessage: {
    fontSize: 14,
    color: '#D70015',
    flex: 1,
  },
  bannerAction: {
    fontSize: 14,
    color: '#D70015',
    fontWeight: '600',
    marginRight: 16,
  },
  bannerDismiss: {
    fontSize: 18,
    color: '#D70015',
    fontWeight: 'bold',
  },
});

export default {
  ErrorState,
  NetworkErrorState,
  ServerErrorState,
  AuthErrorState,
  PermissionErrorState,
  NotFoundErrorState,
  ApiErrorState,
  PaymentErrorState,
  UploadErrorState,
  CameraErrorState,
  StorageErrorState,
  InlineErrorState,
  ValidationErrorState,
  ErrorBanner
};
