/**
 * Header Component for DietIntel Mobile App
 * Consistent header component across all screens with navigation integration
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { ScreenType } from '../../../core/navigation/NavigationTypes';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  testID?: string;
}

/**
 * Back button component
 */
const BackButton: React.FC<{
  onPress: () => void;
  color?: string;
  testID?: string;
}> = ({ onPress, color = 'white', testID = 'header-back-button' }) => (
  <TouchableOpacity onPress={onPress} testID={testID} style={styles.backButton}>
    <Text style={[styles.backButtonText, { color }]}>←</Text>
  </TouchableOpacity>
);

/**
 * Close button for modal headers
 */
const CloseButton: React.FC<{
  onPress: () => void;
  color?: string;
  testID?: string;
}> = ({ onPress, color = 'white', testID = 'header-close-button' }) => (
  <TouchableOpacity onPress={onPress} testID={testID} style={styles.closeButton}>
    <Text style={[styles.closeButtonText, { color }]}>×</Text>
  </TouchableOpacity>
);

/**
 * Main Header component
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  rightComponent,
  backgroundColor = '#007AFF',
  titleColor = 'white',
  subtitleColor = 'rgba(255, 255, 255, 0.8)',
  testID = 'header'
}) => {
  return (
    <View style={[styles.header, { backgroundColor }]} testID={testID}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      
      <View style={styles.headerContent}>
        {/* Left side */}
        <View style={styles.headerLeft}>
          {showBackButton && onBackPress && (
            <BackButton onPress={onBackPress} />
          )}
        </View>

        {/* Center - Title and subtitle */}
        <View style={styles.headerCenter}>
          {title && (
            <Text 
              style={[styles.headerTitle, { color: titleColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text 
              style={[styles.headerSubtitle, { color: subtitleColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right side */}
        <View style={styles.headerRight}>
          {rightComponent}
        </View>
      </View>
    </View>
  );
};

/**
 * Navigation Header with screen integration
 */
export const NavigationHeader: React.FC<HeaderProps & {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
}> = (props) => {
  const { currentScreen, onNavigate, showBackButton, onBackPress, ...headerProps } = props;

  // Auto-show back button for non-root screens
  const shouldShowBack = showBackButton ?? !['splash', 'login', 'register'].includes(currentScreen);

  // Default back navigation
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      // Default back behavior based on screen
      const backTarget = currentScreen === 'splash' ? 'splash' : 'splash';
      onNavigate(backTarget);
    }
  };

  return (
    <Header
      {...headerProps}
      showBackButton={shouldShowBack}
      onBackPress={handleBackPress}
    />
  );
};

/**
 * Modal Header with close button
 */
export const ModalHeader: React.FC<Omit<HeaderProps, 'showBackButton'> & {
  onClose: () => void;
  showCloseButton?: boolean;
}> = ({
  onClose,
  showCloseButton = true,
  rightComponent,
  ...props
}) => {
  const combinedRightComponent = (
    <>
      {rightComponent}
      {showCloseButton && <CloseButton onPress={onClose} />}
    </>
  );

  return (
    <Header
      {...props}
      rightComponent={combinedRightComponent}
    />
  );
};

/**
 * Search Header with search bar
 */
export const SearchHeader: React.FC<HeaderProps & {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
}> = ({
  searchValue = '',
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search...',
  ...props
}) => {
  const searchComponent = (
    <View style={styles.searchContainer}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={styles.searchInput}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
        placeholder={searchPlaceholder}
        value={searchValue}
      />
    </View>
  );

  return (
    <Header
      {...props}
      rightComponent={searchComponent}
    />
  );
};

/**
 * Action Header with action buttons
 */
export const ActionHeader: React.FC<HeaderProps & {
  actionButtons?: Array<{
    icon: string;
    onPress: () => void;
    testID?: string;
  }>;
}> = ({
  actionButtons = [],
  ...props
}) => {
  const actionsComponent = actionButtons.map((action, index) => (
    <TouchableOpacity
      key={index}
      onPress={action.onPress}
      testID={action.testID || `header-action-${index}`}
      style={styles.actionButton}
    >
      <Text style={styles.actionButtonText}>{action.icon}</Text>
    </TouchableOpacity>
  ));

  return (
    <Header
      {...props}
      rightComponent={actionsComponent}
    />
  );
};

/**
 * Profile Header with user info
 */
export const ProfileHeader: React.FC<HeaderProps & {
  userName?: string;
  userAvatar?: string;
  onProfilePress?: () => void;
}> = ({
  userName,
  userAvatar,
  onProfilePress,
  ...props
}) => {
  const profileComponent = (
    <TouchableOpacity 
      onPress={onProfilePress} 
      style={styles.profileContainer}
      testID="header-profile"
    >
      {userAvatar ? (
        <Text style={styles.profileAvatar}>{userAvatar}</Text>
      ) : (
        <View style={styles.profileAvatarPlaceholder}>
          <Text style={styles.profileAvatarText}>
            {userName ? userName.charAt(0).toUpperCase() : '👤'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Header
      {...props}
      rightComponent={profileComponent}
    />
  );
};

/**
 * Tab Header for tab navigation
 */
export const TabHeader: React.FC<HeaderProps & {
  tabs: Array<{
    label: string;
    isActive?: boolean;
    onPress: () => void;
    testID?: string;
  }>;
}> = ({
  tabs,
  ...props
}) => {
  const tabsComponent = (
    <View style={styles.tabsContainer}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={index}
          onPress={tab.onPress}
          testID={tab.testID || `header-tab-${index}`}
          style={[
            styles.tabButton,
            tab.isActive && styles.tabButtonActive
          ]}
        >
          <Text style={[
            styles.tabButtonText,
            tab.isActive && styles.tabButtonTextActive
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Header
      {...props}
      rightComponent={tabsComponent}
    />
  );
};

/**
 * Minimal Header for full-screen content
 */
export const MinimalHeader: React.FC<HeaderProps> = (props) => {
  return (
    <Header
      {...props}
      backgroundColor="transparent"
      titleColor="#333333"
      subtitleColor="#666666"
    />
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
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
    padding: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '300',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    padding: 0,
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  profileContainer: {
    padding: 4,
  },
  profileAvatar: {
    fontSize: 24,
    width: 32,
    height: 32,
    textAlign: 'center',
    lineHeight: 32,
  },
  profileAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
});

export default {
  Header,
  NavigationHeader,
  ModalHeader,
  SearchHeader,
  ActionHeader,
  ProfileHeader,
  TabHeader,
  MinimalHeader
};
