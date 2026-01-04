/**
 * Loading States Components for DietIntel Mobile App
 * Reusable loading indicators and skeletons for consistent UX
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, type ViewStyle, type DimensionValue } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  testID?: string;
}

/**
 * Simple loading spinner with optional message
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = '#007AFF',
  message,
  testID = 'loading-spinner'
}) => {
  return (
    <View style={styles.spinnerContainer} testID={testID}>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text style={[styles.loadingMessage, { color }]}>
          {message}
        </Text>
      )}
    </View>
  );
};

/**
 * Full-screen loading state
 */
export const FullScreenLoading: React.FC<{
  message?: string;
  backgroundColor?: string;
  testID?: string;
}> = ({
  message = 'Loading...',
  backgroundColor = '#FFFFFF',
  testID = 'full-screen-loading'
}) => {
  return (
    <View 
      style={[styles.fullScreenContainer, { backgroundColor }]} 
      testID={testID}
    >
      <LoadingSpinner message={message} />
    </View>
  );
};

/**
 * Inline loading state for list items, cards, etc.
 */
export const InlineLoading: React.FC<{
  message?: string;
  size?: 'small' | 'large';
  testID?: string;
}> = ({
  message,
  size = 'small',
  testID = 'inline-loading'
}) => {
  return (
    <View style={styles.inlineContainer} testID={testID}>
      <ActivityIndicator size={size} color="#007AFF" />
      {message && (
        <Text style={styles.inlineMessage}>{message}</Text>
      )}
    </View>
  );
};

/**
 * Skeleton loading for content placeholders
 */
export const SkeletonLoader: React.FC<{
  height?: number;
  width?: DimensionValue;
  borderRadius?: number;
  backgroundColor?: string;
  style?: ViewStyle;
  testID?: string;
}> = ({
  height = 20,
  width = '100%',
  borderRadius = 4,
  backgroundColor = '#E0E0E0',
  style,
  testID = 'skeleton-loader'
}) => {
  return (
    <View
      style={[
        styles.skeleton,
        style,
        {
          height,
          width,
          borderRadius,
          backgroundColor,
        }
      ]}
      testID={testID}
    />
  );
};

/**
 * Text skeleton loader
 */
export const TextSkeleton: React.FC<{
  lines?: number;
  lineHeight?: number;
  lineSpacing?: number;
  testID?: string;
}> = ({
  lines = 3,
  lineHeight = 16,
  lineSpacing = 8,
  testID = 'text-skeleton'
}) => {
  return (
    <View testID={testID}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLoader
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? '70%' : '100%'}
          style={index < lines - 1 ? { marginBottom: lineSpacing } : undefined}
        />
      ))}
    </View>
  );
};

/**
 * Card skeleton for loading cards
 */
export const CardSkeleton: React.FC<{
  showImage?: boolean;
  imageHeight?: number;
  showContent?: boolean;
  contentLines?: number;
  testID?: string;
}> = ({
  showImage = true,
  imageHeight = 200,
  showContent = true,
  contentLines = 3,
  testID = 'card-skeleton'
}) => {
  return (
    <View style={styles.cardSkeleton} testID={testID}>
      {showImage && (
        <SkeletonLoader
          height={imageHeight}
          width="100%"
          borderRadius={8}
          style={styles.cardImageSkeleton}
        />
      )}
      {showContent && (
        <View style={styles.cardContent}>
          <SkeletonLoader height={20} width="80%" style={styles.cardTitleSkeleton} />
          <SkeletonLoader height={16} width="60%" style={styles.cardSubtitleSkeleton} />
          <TextSkeleton lines={contentLines} />
        </View>
      )}
    </View>
  );
};

/**
 * List skeleton for loading lists
 */
export const ListSkeleton: React.FC<{
  itemCount?: number;
  showImage?: boolean;
  imageSize?: number;
  testID?: string;
}> = ({
  itemCount = 3,
  showImage = true,
  imageSize = 60,
  testID = 'list-skeleton'
}) => {
  return (
    <View testID={testID}>
      {Array.from({ length: itemCount }, (_, index) => (
        <View key={index} style={styles.listItemSkeleton}>
          {showImage && (
            <SkeletonLoader
              height={imageSize}
              width={imageSize}
              borderRadius={imageSize / 2}
              style={styles.listItemImage}
            />
          )}
          <View style={styles.listItemContent}>
            <SkeletonLoader height={18} width="80%" />
            <SkeletonLoader height={14} width="60%" style={{ marginTop: 4 }} />
            <SkeletonLoader height={14} width="40%" style={{ marginTop: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Pull-to-refresh loading indicator
 */
export const PullToRefreshLoading: React.FC<{
  message?: string;
  testID?: string;
}> = ({
  message = 'Pull to refresh',
  testID = 'pull-to-refresh-loading'
}) => {
  return (
    <View style={styles.pullToRefreshContainer} testID={testID}>
      <LoadingSpinner size="small" />
      <Text style={styles.pullToRefreshMessage}>{message}</Text>
    </View>
  );
};

/**
 * Button loading state
 */
export const ButtonLoading: React.FC<{
  size?: 'small' | 'large';
  color?: string;
  testID?: string;
}> = ({
  size = 'small',
  color = 'white',
  testID = 'button-loading'
}) => {
  return (
    <LoadingSpinner 
      size={size} 
      color={color} 
      testID={testID}
    />
  );
};

/**
 * Page loading state with spinner and message
 */
export const PageLoading: React.FC<{
  title?: string;
  subtitle?: string;
  message?: string;
  backgroundColor?: string;
  testID?: string;
}> = ({
  title = 'Loading',
  subtitle,
  message = 'Please wait while we load your content...',
  backgroundColor = '#FFFFFF',
  testID = 'page-loading'
}) => {
  return (
    <View 
      style={[styles.pageContainer, { backgroundColor }]} 
      testID={testID}
    >
      <View style={styles.pageContent}>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle && (
          <Text style={styles.pageSubtitle}>{subtitle}</Text>
        )}
        <LoadingSpinner 
          size="large" 
          message={message}
          testID="page-spinner"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  spinnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingMessage: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  inlineMessage: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
  skeleton: {
    backgroundColor: '#E0E0E0',
  },
  cardSkeleton: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageSkeleton: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  cardContent: {
    padding: 16,
  },
  cardTitleSkeleton: {
    marginBottom: 8,
  },
  cardSubtitleSkeleton: {
    marginBottom: 12,
  },
  listItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  listItemImage: {
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
  },
  pullToRefreshContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  pullToRefreshMessage: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  pageContent: {
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
  },
});

export default {
  LoadingSpinner,
  FullScreenLoading,
  InlineLoading,
  SkeletonLoader,
  TextSkeleton,
  CardSkeleton,
  ListSkeleton,
  PullToRefreshLoading,
  ButtonLoading,
  PageLoading
};
