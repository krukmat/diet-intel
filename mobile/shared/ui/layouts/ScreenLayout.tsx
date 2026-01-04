/**
 * ScreenLayout Component for DietIntel Mobile App
 * Consistent layout wrapper for all screens with header, content, and footer areas
 */

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { ScreenType } from '../../../core/navigation/NavigationTypes';

interface ScreenLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  backgroundColor?: string;
  contentPadding?: number;
  testID?: string;
}

// Header component
const ScreenHeader: React.FC<{
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  right?: React.ReactNode;
  backgroundColor?: string;
}> = ({ title, subtitle, showBackButton, onBackPress, right, backgroundColor = '#007AFF' }) => (
  <View style={[styles.header, { backgroundColor }]}>
    <SafeAreaView style={styles.headerSafeArea}>
      <View style={styles.headerContent}>
        {/* Left side - Back button */}
        <View style={styles.headerLeft}>
          {showBackButton && onBackPress && (
            <Text style={styles.backButton} onPress={onBackPress}>
              ← Back
            </Text>
          )}
        </View>

        {/* Center - Title and subtitle */}
        <View style={styles.headerCenter}>
          {title && <Text style={styles.headerTitle}>{title}</Text>}
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>

        {/* Right side - Custom content */}
        <View style={styles.headerRight}>
          {right}
        </View>
      </View>
    </SafeAreaView>
  </View>
);

// Footer component
const ScreenFooter: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  if (!children) return null;
  
  return (
    <View style={styles.footer}>
      {children}
    </View>
  );
};

/**
 * Main ScreenLayout component
 * Provides consistent layout structure across all screens
 */
export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  children,
  title,
  subtitle,
  showHeader = true,
  showBackButton = false,
  onBackPress,
  headerRight,
  footer,
  backgroundColor = '#FFFFFF',
  contentPadding = 20,
  testID = 'screen-layout'
}) => {
  return (
    <View style={[styles.container, { backgroundColor }]} testID={testID}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
      
      {/* Header */}
      {showHeader && (title || showBackButton || headerRight) && (
        <ScreenHeader
          title={title}
          subtitle={subtitle}
          showBackButton={showBackButton}
          onBackPress={onBackPress}
          right={headerRight}
          backgroundColor="#007AFF"
        />
      )}

      {/* Content */}
      <View style={[styles.content, { padding: contentPadding }]}>
        {children}
      </View>

      {/* Footer */}
      {footer && <ScreenFooter>{footer}</ScreenFooter>}
    </View>
  );
};

/**
 * Specialized layout for screens with navigation integration
 */
export const NavigableScreenLayout: React.FC<ScreenLayoutProps & {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
}> = (props) => {
  const { currentScreen, onNavigate, ...layoutProps } = props;

  // Auto-show back button if not on root screens
  const shouldShowBack = !['splash', 'login', 'register'].includes(currentScreen);

  return (
    <ScreenLayout
      {...layoutProps}
      showBackButton={shouldShowBack}
      onBackPress={() => onNavigate('splash')} // Default back behavior
    />
  );
};

/**
 * Layout for modal screens
 */
export const ModalScreenLayout: React.FC<ScreenLayoutProps & {
  onClose: () => void;
  showCloseButton?: boolean;
}> = ({
  children,
  title,
  onClose,
  showCloseButton = true,
  headerRight,
  ...props
}) => {
  return (
    <ScreenLayout
      {...props}
      title={title}
      showBackButton={showCloseButton}
      onBackPress={onClose}
      headerRight={headerRight}
    >
      {children}
    </ScreenLayout>
  );
};

/**
 * Loading layout for async states
 */
export const LoadingScreenLayout: React.FC<{
  message?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}> = ({ 
  message = 'Loading...', 
  backgroundColor = '#FFFFFF',
  children,
}) => {
  return (
    <ScreenLayout backgroundColor={backgroundColor}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{message}</Text>
        <View style={styles.loadingSpinner}>
          {/* You can replace this with actual spinner component */}
          <Text style={styles.spinner}>⏳</Text>
        </View>
        {children}
      </View>
    </ScreenLayout>
  );
};

/**
 * Error layout for error states
 */
export const ErrorScreenLayout: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
  backgroundColor?: string;
}> = ({
  title = 'Oops! Something went wrong',
  message,
  onRetry,
  retryText = 'Try Again',
  backgroundColor = '#FFFFFF'
}) => {
  return (
    <ScreenLayout backgroundColor={backgroundColor}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.errorMessage}>{message}</Text>
        
        {onRetry && (
          <Text style={styles.retryButton} onPress={onRetry}>
            {retryText}
          </Text>
        )}
      </View>
    </ScreenLayout>
  );
};

/**
 * Empty state layout for no data scenarios
 */
export const EmptyScreenLayout: React.FC<{
  title?: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  icon?: string;
  backgroundColor?: string;
}> = ({
  title = 'Nothing here yet',
  message,
  actionText,
  onAction,
  icon = '📭',
  backgroundColor = '#FFFFFF'
}) => {
  return (
    <ScreenLayout backgroundColor={backgroundColor}>
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{icon}</Text>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyMessage}>{message}</Text>
        
        {actionText && onAction && (
          <Text style={styles.actionButton} onPress={onAction}>
            {actionText}
          </Text>
        )}
      </View>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerSafeArea: {
    backgroundColor: '#007AFF',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 56,
  },
  headerLeft: {
    width: 80,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 80,
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  backButton: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingSpinner: {
    marginTop: 8,
  },
  spinner: {
    fontSize: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    color: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    color: 'white',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ScreenLayout;
