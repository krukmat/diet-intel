/**
 * Empty States Components for DietIntel Mobile App
 * Reusable empty state components for consistent UX when no data is available
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  backgroundColor?: string;
  testID?: string;
}

/**
 * Basic empty state component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  message,
  actionText,
  onAction,
  backgroundColor = '#FFFFFF',
  testID = 'empty-state'
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
        
        {actionText && onAction && (
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={onAction}
            testID="empty-state-action"
          >
            <Text style={styles.actionButtonText}>{actionText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * Empty state for search results with no matches
 */
export const EmptySearchResults: React.FC<{
  searchTerm?: string;
  onClearSearch?: () => void;
  onTryAgain?: () => void;
  testID?: string;
}> = ({
  searchTerm = '',
  onClearSearch,
  onTryAgain,
  testID = 'empty-search-results'
}) => {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      message={
        searchTerm 
          ? `We couldn't find any results for "${searchTerm}"`
          : 'No results match your current search'
      }
      actionText={searchTerm ? 'Clear search' : 'Try again'}
      onAction={searchTerm ? onClearSearch : onTryAgain}
      testID={testID}
    />
  );
};

/**
 * Empty state for lists with no items
 */
export const EmptyList: React.FC<{
  itemType?: string;
  onAddItem?: () => void;
  onRefresh?: () => void;
  testID?: string;
}> = ({
  itemType = 'items',
  onAddItem,
  onRefresh,
  testID = 'empty-list'
}) => {
  return (
    <EmptyState
      icon="📝"
      title={`No ${itemType} yet`}
      message={`Start by adding your first ${itemType.slice(0, -1)} or check back later`}
      actionText={`Add ${itemType.slice(0, -1)}`}
      onAction={onAddItem}
      testID={testID}
    />
  );
};

/**
 * Empty state for favorites when nothing is saved
 */
export const EmptyFavorites: React.FC<{
  onExplore?: () => void;
  testID?: string;
}> = ({
  onExplore,
  testID = 'empty-favorites'
}) => {
  return (
    <EmptyState
      icon="❤️"
      title="No favorites yet"
      message="Save your favorite recipes, meals, or content to see them here"
      actionText="Explore content"
      onAction={onExplore}
      testID={testID}
    />
  );
};

/**
 * Empty state for offline mode
 */
export const EmptyOffline: React.FC<{
  onRetry?: () => void;
  testID?: string;
}> = ({
  onRetry,
  testID = 'empty-offline'
}) => {
  return (
    <EmptyState
      icon="📡"
      title="You're offline"
      message="Check your internet connection and try again"
      actionText="Retry"
      onAction={onRetry}
      testID={testID}
    />
  );
};

/**
 * Empty state for recently viewed items
 */
export const EmptyRecentlyViewed: React.FC<{
  onExplore?: () => void;
  testID?: string;
}> = ({
  onExplore,
  testID = 'empty-recently-viewed'
}) => {
  return (
    <EmptyState
      icon="🕒"
      title="No recent activity"
      message="Start browsing to see your recently viewed items here"
      actionText="Start browsing"
      onAction={onExplore}
      testID={testID}
    />
  );
};

/**
 * Empty state for notifications
 */
export const EmptyNotifications: React.FC<{
  onRefresh?: () => void;
  testID?: string;
}> = ({
  onRefresh,
  testID = 'empty-notifications'
}) => {
  return (
    <EmptyState
      icon="🔔"
      title="No notifications"
      message="You're all caught up! New notifications will appear here"
      actionText="Refresh"
      onAction={onRefresh}
      testID={testID}
    />
  );
};

/**
 * Empty state for blocked users list
 */
export const EmptyBlockedUsers: React.FC<{
  testID?: string;
}> = ({
  testID = 'empty-blocked-users'
}) => {
  return (
    <EmptyState
      icon="🚫"
      title="No blocked users"
      message="You haven't blocked anyone yet"
      testID={testID}
    />
  );
};

/**
 * Empty state for followers/following lists
 */
export const EmptySocialList: React.FC<{
  type: 'followers' | 'following';
  onFindPeople?: () => void;
  testID?: string;
}> = ({
  type,
  onFindPeople,
  testID = 'empty-social-list'
}) => {
  const title = type === 'followers' ? 'No followers yet' : 'Not following anyone';
  const message = type === 'followers' 
    ? 'When people follow you, they\'ll appear here'
    : 'Find and follow people to see them here';
  const actionText = 'Find people';
  
  return (
    <EmptyState
      icon={type === 'followers' ? '👥' : '👤'}
      title={title}
      message={message}
      actionText={actionText}
      onAction={onFindPeople}
      testID={testID}
    />
  );
};

/**
 * Empty state for shopping lists
 */
export const EmptyShoppingList: React.FC<{
  onCreateList?: () => void;
  onBrowseRecipes?: () => void;
  testID?: string;
}> = ({
  onCreateList,
  onBrowseRecipes,
  testID = 'empty-shopping-list'
}) => {
  return (
    <EmptyState
      icon="🛒"
      title="No shopping lists"
      message="Create a shopping list from your recipes or start from scratch"
      actionText="Create list"
      onAction={onCreateList}
      testID={testID}
    />
  );
};

/**
 * Empty state for meal plans
 */
export const EmptyMealPlans: React.FC<{
  onCreatePlan?: () => void;
  onBrowseRecipes?: () => void;
  testID?: string;
}> = ({
  onCreatePlan,
  onBrowseRecipes,
  testID = 'empty-meal-plans'
}) => {
  return (
    <EmptyState
      icon="🍽️"
      title="No meal plans yet"
      message="Create a meal plan to organize your weekly meals"
      actionText="Create plan"
      onAction={onCreatePlan}
      testID={testID}
    />
  );
};

/**
 * Compact empty state for inline use
 */
export const InlineEmptyState: React.FC<{
  icon?: string;
  message: string;
  testID?: string;
}> = ({
  icon = '📭',
  message,
  testID = 'inline-empty-state'
}) => {
  return (
    <View style={styles.inlineContainer} testID={testID}>
      <Text style={styles.inlineIcon}>{icon}</Text>
      <Text style={styles.inlineMessage}>{message}</Text>
    </View>
  );
};

/**
 * Empty state with illustration (placeholder for future image support)
 */
export const IllustratedEmptyState: React.FC<{
  illustration?: string;
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  backgroundColor?: string;
  testID?: string;
}> = ({
  illustration = '🎨',
  title,
  message,
  actionText,
  onAction,
  backgroundColor = '#FFFFFF',
  testID = 'illustrated-empty-state'
}) => {
  return (
    <View 
      style={[styles.illustratedContainer, { backgroundColor }]} 
      testID={testID}
    >
      <View style={styles.illustrationArea}>
        <Text style={styles.illustration}>{illustration}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        
        {actionText && onAction && (
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={onAction}
            testID="illustrated-empty-state-action"
          >
            <Text style={styles.actionButtonText}>{actionText}</Text>
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
  illustrationArea: {
    marginBottom: 24,
  },
  illustration: {
    fontSize: 80,
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
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  inlineIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  inlineMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    flex: 1,
  },
  illustratedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
});

export default {
  EmptyState,
  EmptySearchResults,
  EmptyList,
  EmptyFavorites,
  EmptyOffline,
  EmptyRecentlyViewed,
  EmptyNotifications,
  EmptyBlockedUsers,
  EmptySocialList,
  EmptyShoppingList,
  EmptyMealPlans,
  InlineEmptyState,
  IllustratedEmptyState
};
