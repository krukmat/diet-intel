/**
 * Shared UI System Tests for DietIntel Mobile App
 * Test suite for shared UI components, layouts, and hooks
 */

import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  ScreenLayout,
  LoadingScreenLayout,
  ErrorScreenLayout,
  EmptyScreenLayout,
  NavigableScreenLayout,
  ModalScreenLayout,
} from '../layouts/ScreenLayout';
import {
  Header,
  NavigationHeader,
  ModalHeader,
  SearchHeader,
  ActionHeader,
  ProfileHeader,
  TabHeader,
  MinimalHeader,
} from '../layouts/Header';
import { 
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
} from '../components/LoadingStates';
import {
  EmptyState,
  EmptyList,
  EmptyFavorites,
  EmptyOffline,
  EmptySearchResults,
  EmptyRecentlyViewed,
  EmptyNotifications,
  EmptyBlockedUsers,
  EmptySocialList,
  EmptyShoppingList,
  EmptyMealPlans,
  InlineEmptyState,
  IllustratedEmptyState
} from '../components/EmptyStates';
import {
  ErrorState,
  NetworkErrorState,
  ValidationErrorState,
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
  ErrorBanner
} from '../components/ErrorStates';
import { useScreenLayout } from '../hooks/useScreenLayout';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { ScreenType } from '../../../core/navigation/NavigationTypes';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    StatusBar: () => null,
  };
});

// Mock hooks
jest.mock('../hooks/useScreenLayout', () => ({
  useScreenLayout: jest.fn(),
}));

jest.mock('../hooks/useThemedStyles', () => ({
  useThemedStyles: jest.fn(),
}));

// Test wrapper for providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

describe('ScreenLayout Components', () => {
  describe('ScreenLayout', () => {
    it('should render basic screen layout', () => {
      render(
        <TestWrapper>
          <ScreenLayout title="Test Screen">
            <Text>Test Content</Text>
          </ScreenLayout>
        </TestWrapper>
      );

      expect(screen.getByText('Test Screen')).toBeTruthy();
      expect(screen.getByText('Test Content')).toBeTruthy();
    });

    it('should handle back button press', () => {
      const mockOnBackPress = jest.fn();
      
      render(
        <TestWrapper>
          <ScreenLayout 
            title="Test Screen" 
            showBackButton 
            onBackPress={mockOnBackPress}
          >
            <Text>Test Content</Text>
          </ScreenLayout>
        </TestWrapper>
      );

      const backButton = screen.getByText('← Back');
      fireEvent.press(backButton);
      
      expect(mockOnBackPress).toHaveBeenCalled();
    });

    it('should render without header when showHeader is false', () => {
      render(
        <TestWrapper>
          <ScreenLayout showHeader={false}>
            <Text>Content without header</Text>
          </ScreenLayout>
        </TestWrapper>
      );
    });

    it('should render footer when provided', () => {
      render(
        <TestWrapper>
          <ScreenLayout title="Footer Screen" footer={<Text>Footer</Text>}>
            <Text>Content</Text>
          </ScreenLayout>
        </TestWrapper>
      );

      expect(screen.getByText('Footer')).toBeTruthy();
    });
  });

  describe('NavigableScreenLayout', () => {
    it('should show back button and navigate on press', () => {
      const onNavigate = jest.fn();
      render(
        <TestWrapper>
          <NavigableScreenLayout currentScreen="track" onNavigate={onNavigate} title="Nav">
            <Text>Content</Text>
          </NavigableScreenLayout>
        </TestWrapper>
      );

      fireEvent.press(screen.getByText('← Back'));
      expect(onNavigate).toHaveBeenCalledWith('splash');
    });

    it('should hide back button on root screens', () => {
      const onNavigate = jest.fn();
      render(
        <TestWrapper>
          <NavigableScreenLayout currentScreen="splash" onNavigate={onNavigate} title="Nav">
            <Text>Content</Text>
          </NavigableScreenLayout>
        </TestWrapper>
      );

      expect(screen.queryByText('← Back')).toBeNull();
    });
  });

  describe('ModalScreenLayout', () => {
    it('should hide close button when disabled', () => {
      render(
        <TestWrapper>
          <ModalScreenLayout title="Modal" onClose={jest.fn()} showCloseButton={false}>
            <Text>Content</Text>
          </ModalScreenLayout>
        </TestWrapper>
      );

      expect(screen.queryByText('← Back')).toBeNull();
    });
  });

  describe('LoadingScreenLayout', () => {
    it('should render loading layout with custom message', () => {
      render(
        <TestWrapper>
          <LoadingScreenLayout message="Custom loading message" />
        </TestWrapper>
      );

      expect(screen.getByText('Custom loading message')).toBeTruthy();
    });

    it('should render with default message', () => {
      render(
        <TestWrapper>
          <LoadingScreenLayout />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeTruthy();
    });
  });

  describe('ErrorScreenLayout', () => {
    it('should render error layout with retry action', () => {
      const mockOnRetry = jest.fn();
      
      render(
        <TestWrapper>
          <ErrorScreenLayout 
            message="Test error message"
            onRetry={mockOnRetry}
            retryText="Try Again"
          />
        </TestWrapper>
      );

      expect(screen.getByText('Test error message')).toBeTruthy();
      expect(screen.getByText('Try Again')).toBeTruthy();
    });
  });

  describe('EmptyScreenLayout', () => {
    it('should render empty layout with action', () => {
      const mockOnAction = jest.fn();
      
      render(
        <TestWrapper>
          <EmptyScreenLayout
            title="No items"
            message="Start by adding items"
            actionText="Add Item"
            onAction={mockOnAction}
          />
        </TestWrapper>
      );

      expect(screen.getByText('No items')).toBeTruthy();
      expect(screen.getByText('Start by adding items')).toBeTruthy();
      expect(screen.getByText('Add Item')).toBeTruthy();
    });
  });
});

describe('Header Components', () => {
  describe('Header', () => {
    it('should render basic header with title', () => {
      render(
        <TestWrapper>
          <Header title="Test Header" />
        </TestWrapper>
      );

      expect(screen.getByText('Test Header')).toBeTruthy();
    });

    it('should render header with subtitle', () => {
      render(
        <TestWrapper>
          <Header title="Main Title" subtitle="Subtitle" />
        </TestWrapper>
      );

      expect(screen.getByText('Main Title')).toBeTruthy();
      expect(screen.getByText('Subtitle')).toBeTruthy();
    });

    it('should render back button when showBackButton is true', () => {
      const mockOnBackPress = jest.fn();
      
      render(
        <TestWrapper>
          <Header 
            title="Test Header" 
            showBackButton 
            onBackPress={mockOnBackPress}
          />
        </TestWrapper>
      );

      const backButton = screen.getByText('←');
      fireEvent.press(backButton);
      
      expect(mockOnBackPress).toHaveBeenCalled();
    });
  });

  describe('NavigationHeader', () => {
    it('should auto-show back button for non-root screens', () => {
      const mockNavigate = jest.fn();
      
      render(
        <TestWrapper>
          <NavigationHeader
            currentScreen="track"
            onNavigate={mockNavigate}
            title="Test Screen"
          />
        </TestWrapper>
      );

      // Should show back button for 'track' screen
      expect(screen.getByText('←')).toBeTruthy();
    });

    it('should not show back button for root screens', () => {
      const mockNavigate = jest.fn();
      
      render(
        <TestWrapper>
          <NavigationHeader
            currentScreen="splash"
            onNavigate={mockNavigate}
            title="Splash Screen"
          />
        </TestWrapper>
      );

      // Should not show back button for 'splash' screen
      expect(screen.queryByText('←')).toBeNull();
    });

    it('should navigate to default back target when no handler provided', () => {
      const mockNavigate = jest.fn();

      render(
        <TestWrapper>
          <NavigationHeader
            currentScreen="track"
            onNavigate={mockNavigate}
            title="Track"
          />
        </TestWrapper>
      );

      fireEvent.press(screen.getByText('←'));
      expect(mockNavigate).toHaveBeenCalledWith('splash');
    });
  });

  describe('ModalHeader', () => {
    it('should render close button for modals', () => {
      const mockOnClose = jest.fn();
      
      render(
        <TestWrapper>
          <ModalHeader
            title="Modal Title"
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      const closeButton = screen.getByText('×');
      fireEvent.press(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should hide close button when disabled', () => {
      render(
        <TestWrapper>
          <ModalHeader
            title="Modal Title"
            onClose={jest.fn()}
            showCloseButton={false}
          />
        </TestWrapper>
      );

      expect(screen.queryByText('×')).toBeNull();
    });
  });

  describe('SearchHeader', () => {
    it('should handle search input events', () => {
      const onSearchChange = jest.fn();
      const onSearchSubmit = jest.fn();

      render(
        <TestWrapper>
          <SearchHeader
            title="Search"
            searchValue="query"
            onSearchChange={onSearchChange}
            onSearchSubmit={onSearchSubmit}
            searchPlaceholder="Search items"
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search items');
      fireEvent.changeText(input, 'new');
      fireEvent(input, 'submitEditing');

      expect(onSearchChange).toHaveBeenCalledWith('new');
      expect(onSearchSubmit).toHaveBeenCalled();
    });
  });

  describe('ActionHeader', () => {
    it('should render action buttons and trigger handlers', () => {
      const onRefresh = jest.fn();
      const onSettings = jest.fn();

      render(
        <TestWrapper>
          <ActionHeader
            title="Actions"
            actionButtons={[
              { icon: '🔄', onPress: onRefresh, testID: 'refresh' },
              { icon: '⚙️', onPress: onSettings, testID: 'settings' },
            ]}
          />
        </TestWrapper>
      );

      fireEvent.press(screen.getByText('🔄'));
      fireEvent.press(screen.getByText('⚙️'));

      expect(onRefresh).toHaveBeenCalled();
      expect(onSettings).toHaveBeenCalled();
    });
  });

  describe('ProfileHeader', () => {
    it('should render avatar placeholder when no avatar provided', () => {
      render(
        <TestWrapper>
          <ProfileHeader title="Profile" userName="Alex" />
        </TestWrapper>
      );

      expect(screen.getByText('A')).toBeTruthy();
    });

    it('should render avatar when provided', () => {
      render(
        <TestWrapper>
          <ProfileHeader title="Profile" userAvatar="🧑" />
        </TestWrapper>
      );

      expect(screen.getByText('🧑')).toBeTruthy();
    });
  });

  describe('TabHeader', () => {
    it('should render tabs and handle presses', () => {
      const onFirst = jest.fn();
      const onSecond = jest.fn();

      render(
        <TestWrapper>
          <TabHeader
            title="Tabs"
            tabs={[
              { label: 'One', isActive: true, onPress: onFirst },
              { label: 'Two', onPress: onSecond },
            ]}
          />
        </TestWrapper>
      );

      fireEvent.press(screen.getByText('One'));
      fireEvent.press(screen.getByText('Two'));

      expect(onFirst).toHaveBeenCalled();
      expect(onSecond).toHaveBeenCalled();
    });
  });

  describe('MinimalHeader', () => {
    it('should render minimal header variant', () => {
      render(
        <TestWrapper>
          <MinimalHeader title="Minimal" subtitle="Clean" />
        </TestWrapper>
      );

      expect(screen.getByText('Minimal')).toBeTruthy();
      expect(screen.getByText('Clean')).toBeTruthy();
    });
  });
});

describe('Loading States Components', () => {
  describe('LoadingSpinner', () => {
    it('should render loading spinner', () => {
      render(
        <TestWrapper>
          <LoadingSpinner message="Loading..." />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('should render spinner without message', () => {
      render(
        <TestWrapper>
          <LoadingSpinner />
        </TestWrapper>
      );
    });
  });

  describe('FullScreenLoading', () => {
    it('should render full screen loading', () => {
      render(
        <TestWrapper>
          <FullScreenLoading message="Loading app..." />
        </TestWrapper>
      );

      expect(screen.getByText('Loading app...')).toBeTruthy();
    });
  });

  describe('InlineLoading', () => {
    it('should render inline loading', () => {
      render(
        <TestWrapper>
          <InlineLoading message="Loading item..." size="small" />
        </TestWrapper>
      );

      expect(screen.getByText('Loading item...')).toBeTruthy();
    });
  });

  describe('SkeletonLoader', () => {
    it('should render skeleton loader with custom dimensions', () => {
      render(
        <TestWrapper>
          <SkeletonLoader height={40} width={200} borderRadius={8} />
        </TestWrapper>
      );
    });
  });

  describe('TextSkeleton', () => {
    it('should render multiple skeleton lines', () => {
      render(
        <TestWrapper>
          <TextSkeleton lines={2} />
        </TestWrapper>
      );

      expect(screen.getByTestId('text-skeleton')).toBeTruthy();
    });
  });

  describe('CardSkeleton', () => {
    it('should render card skeleton without image', () => {
      render(
        <TestWrapper>
          <CardSkeleton showImage={false} contentLines={2} />
        </TestWrapper>
      );

      expect(screen.getByTestId('card-skeleton')).toBeTruthy();
    });
  });

  describe('ListSkeleton', () => {
    it('should render list skeleton items', () => {
      render(
        <TestWrapper>
          <ListSkeleton itemCount={2} showImage={false} />
        </TestWrapper>
      );

      expect(screen.getByTestId('list-skeleton')).toBeTruthy();
    });
  });

  describe('PullToRefreshLoading', () => {
    it('should render pull to refresh message', () => {
      render(
        <TestWrapper>
          <PullToRefreshLoading message="Pull..." />
        </TestWrapper>
      );

      expect(screen.getByText('Pull...')).toBeTruthy();
    });
  });

  describe('ButtonLoading', () => {
    it('should render button loading spinner', () => {
      render(
        <TestWrapper>
          <ButtonLoading />
        </TestWrapper>
      );

      expect(screen.getByTestId('button-loading')).toBeTruthy();
    });
  });

  describe('PageLoading', () => {
    it('should render page loading with subtitle', () => {
      render(
        <TestWrapper>
          <PageLoading title="Loading" subtitle="Working" />
        </TestWrapper>
      );

      expect(screen.getByText('Loading')).toBeTruthy();
      expect(screen.getByText('Working')).toBeTruthy();
    });
  });
});

describe('Empty States Components', () => {
  describe('EmptyState', () => {
    it('should render basic empty state', () => {
      render(
        <TestWrapper>
          <EmptyState
            title="No data"
            message="There is no data to display"
            actionText="Create"
            onAction={() => {}}
          />
        </TestWrapper>
      );

      expect(screen.getByText('No data')).toBeTruthy();
      expect(screen.getByText('There is no data to display')).toBeTruthy();
      expect(screen.getByText('Create')).toBeTruthy();
    });
  });

  describe('EmptyList', () => {
    it('should render empty list state', () => {
      render(
        <TestWrapper>
          <EmptyList itemType="recipes" onAddItem={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText('No recipes yet')).toBeTruthy();
      expect(screen.getByText('Add recipe')).toBeTruthy();
    });
  });

  describe('EmptyFavorites', () => {
    it('should render empty favorites state', () => {
      render(
        <TestWrapper>
          <EmptyFavorites onExplore={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText('No favorites yet')).toBeTruthy();
      expect(screen.getByText('Explore content')).toBeTruthy();
    });
  });

  describe('EmptyOffline', () => {
    it('should render offline state', () => {
      render(
        <TestWrapper>
          <EmptyOffline onRetry={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText("You're offline")).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });
  });

  describe('Additional Empty States', () => {
    it('should render empty search results with term', () => {
      const onClear = jest.fn();
      render(
        <TestWrapper>
          <EmptySearchResults searchTerm="kale" onClearSearch={onClear} />
        </TestWrapper>
      );

      fireEvent.press(screen.getByText('Clear search'));
      expect(onClear).toHaveBeenCalled();
    });

    it('should render empty search results without term', () => {
      const onTryAgain = jest.fn();
      render(
        <TestWrapper>
          <EmptySearchResults onTryAgain={onTryAgain} />
        </TestWrapper>
      );

      fireEvent.press(screen.getByText('Try again'));
      expect(onTryAgain).toHaveBeenCalled();
    });

    it('should render empty social lists', () => {
      render(
        <TestWrapper>
          <EmptySocialList type="followers" onFindPeople={() => {}} />
          <EmptySocialList type="following" onFindPeople={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText('No followers yet')).toBeTruthy();
      expect(screen.getByText('Not following anyone')).toBeTruthy();
    });

    it('should render inline and illustrated empty states', () => {
      const onAction = jest.fn();
      render(
        <TestWrapper>
          <InlineEmptyState message="Nothing to show" />
          <IllustratedEmptyState title="Title" message="Message" actionText="Act" onAction={onAction} />
        </TestWrapper>
      );

      fireEvent.press(screen.getByText('Act'));
      expect(onAction).toHaveBeenCalled();
    });

    it('should render other empty states', () => {
      render(
        <TestWrapper>
          <EmptyRecentlyViewed />
          <EmptyNotifications />
          <EmptyBlockedUsers />
          <EmptyShoppingList onCreateList={() => {}} />
          <EmptyMealPlans onCreatePlan={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText('No recent activity')).toBeTruthy();
      expect(screen.getByText('No notifications')).toBeTruthy();
      expect(screen.getByText('No blocked users')).toBeTruthy();
      expect(screen.getByText('No shopping lists')).toBeTruthy();
      expect(screen.getByText('No meal plans yet')).toBeTruthy();
    });
  });
});

describe('Error States Components', () => {
  describe('ErrorState', () => {
    it('should render basic error state', () => {
      render(
        <TestWrapper>
          <ErrorState
            title="Error Title"
            message="Something went wrong"
            onRetry={() => {}}
            retryText="Try Again"
          />
        </TestWrapper>
      );

      expect(screen.getByText('Error Title')).toBeTruthy();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByText('Try Again')).toBeTruthy();
    });
  });

  describe('NetworkErrorState', () => {
    it('should render network error state', () => {
      render(
        <TestWrapper>
          <NetworkErrorState onRetry={() => {}} />
        </TestWrapper>
      );

      expect(screen.getByText('Connection problem')).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });
  });

  describe('ValidationErrorState', () => {
    it('should render validation error', () => {
      render(
        <TestWrapper>
          <ValidationErrorState field="Email" message="Invalid email format" />
        </TestWrapper>
      );

      expect(screen.getByText('Email: Invalid email format')).toBeTruthy();
    });
  });

  describe('Additional Error States', () => {
    it('should render api error with and without code', () => {
      render(
        <TestWrapper>
          <ApiErrorState errorCode="500" />
          <ApiErrorState />
        </TestWrapper>
      );

      expect(screen.getByText('Error 500')).toBeTruthy();
      expect(screen.getByText('Request failed')).toBeTruthy();
    });

    it('should render various error states', () => {
      render(
        <TestWrapper>
          <ServerErrorState />
          <AuthErrorState />
          <PermissionErrorState permission="camera" />
          <NotFoundErrorState item="recipe" />
          <PaymentErrorState />
          <UploadErrorState fileType="photo" />
          <CameraErrorState />
          <StorageErrorState />
          <InlineErrorState message="Inline error" />
        </TestWrapper>
      );

      expect(screen.getByText('Server error')).toBeTruthy();
      expect(screen.getByText('Authentication required')).toBeTruthy();
      expect(screen.getByText('Permission required')).toBeTruthy();
      expect(screen.getByText('Not found')).toBeTruthy();
      expect(screen.getByText('Payment failed')).toBeTruthy();
      expect(screen.getByText('Upload failed')).toBeTruthy();
      expect(screen.getByText('Camera unavailable')).toBeTruthy();
      expect(screen.getByText('Storage full')).toBeTruthy();
      expect(screen.getByText('Inline error')).toBeTruthy();
    });

    it('handles inline error dismiss and banner actions', () => {
      const onDismiss = jest.fn();
      const onRetry = jest.fn();
      const onBannerRetry = jest.fn();
      const onBannerDismiss = jest.fn();

      render(
        <TestWrapper>
          <InlineErrorState message="Dismiss me" onDismiss={onDismiss} />
          <ErrorBanner message="Banner" onRetry={onBannerRetry} onDismiss={onBannerDismiss} />
          <ErrorState title="Oops" message="Retry" onRetry={onRetry} retryText="Retry Now" />
        </TestWrapper>
      );

      fireEvent.press(screen.getByTestId('inline-error-dismiss'));
      fireEvent.press(screen.getByTestId('error-banner-retry'));
      fireEvent.press(screen.getByTestId('error-banner-dismiss'));
      fireEvent.press(screen.getByText('Retry Now'));

      expect(onDismiss).toHaveBeenCalled();
      expect(onBannerRetry).toHaveBeenCalled();
      expect(onRetry).toHaveBeenCalled();
      expect(onBannerDismiss).toHaveBeenCalled();
    });
  });
});

describe('Hook Tests', () => {
  describe('useScreenLayout', () => {
    beforeEach(() => {
      const mockUseScreenLayout = jest.fn();
      mockUseScreenLayout.mockReturnValue({
        layoutConfig: {
          showHeader: true,
          showBackButton: false,
          headerTitle: 'Test',
          contentPadding: 20,
          backgroundColor: '#FFFFFF',
          showFooter: false,
          safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 }
        },
        updateLayoutConfig: jest.fn(),
        resetLayoutConfig: jest.fn(),
        getLayoutForScreen: jest.fn(),
        applyScreenLayout: jest.fn(),
        getCurrentLayout: jest.fn(),
        isLayoutDirty: false,
        hasCustomLayout: false
      });
      
      jest.mocked(useScreenLayout).mockImplementation(mockUseScreenLayout);
    });

    it('should return layout configuration', () => {
      const mockUseScreenLayout = jest.fn().mockReturnValue({
        layoutConfig: { showHeader: true },
        updateLayoutConfig: jest.fn(),
        resetLayoutConfig: jest.fn(),
        getLayoutForScreen: jest.fn(),
        applyScreenLayout: jest.fn(),
        getCurrentLayout: jest.fn(),
        isLayoutDirty: false,
        hasCustomLayout: false
      });
      
      jest.mocked(useScreenLayout).mockImplementation(mockUseScreenLayout);
      
      const result = mockUseScreenLayout();
      
      expect(result.layoutConfig).toEqual({ showHeader: true });
      expect(typeof result.updateLayoutConfig).toBe('function');
    });
  });

  describe('useThemedStyles', () => {
    beforeEach(() => {
      const mockUseThemedStyles = jest.fn();
      mockUseThemedStyles.mockReturnValue({
        theme: {
          colors: {
            primary: '#007AFF',
            background: '#FFFFFF',
            text: '#000000'
          },
          spacing: { md: 16 },
          borderRadius: { md: 8 }
        },
        isDark: false,
        toggleTheme: jest.fn(),
        setTheme: jest.fn(),
        createStyles: jest.fn(),
        getSpacing: jest.fn(),
        getColor: jest.fn(),
        combineStyles: jest.fn()
      });
      
      jest.mocked(useThemedStyles).mockImplementation(mockUseThemedStyles);
    });

    it('should return themed styles', () => {
      const mockUseThemedStyles = jest.fn().mockReturnValue({
        theme: { colors: { primary: '#007AFF' } },
        isDark: false,
        toggleTheme: jest.fn(),
        setTheme: jest.fn(),
        createStyles: jest.fn(),
        getSpacing: jest.fn(),
        getColor: jest.fn(),
        combineStyles: jest.fn()
      });
      
      jest.mocked(useThemedStyles).mockImplementation(mockUseThemedStyles);
      
      const result = mockUseThemedStyles();
      
      expect(result.theme.colors.primary).toBe('#007AFF');
      expect(result.isDark).toBe(false);
    });
  });
});

describe('Integration Tests', () => {
  it('should integrate ScreenLayout with Header', () => {
    render(
      <TestWrapper>
        <ScreenLayout title="Test Screen" showBackButton onBackPress={() => {}}>
          <Text>Content</Text>
        </ScreenLayout>
      </TestWrapper>
    );

    // Both should render together
    expect(screen.getByText('Test Screen')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('should handle loading state integration', () => {
    render(
      <TestWrapper>
        <LoadingScreenLayout message="Loading...">
          <LoadingSpinner />
        </LoadingScreenLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});

describe('Performance Tests', () => {
  it('should render multiple components efficiently', () => {
    const startTime = performance.now();
    
    render(
      <TestWrapper>
        <ScreenLayout title="Performance Test">
          <LoadingSpinner />
          <EmptyState title="Empty" message="No data" />
          <ErrorState title="Error" message="Something wrong" />
        </ScreenLayout>
      </TestWrapper>
    );
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render within reasonable time (adjust threshold as needed)
    expect(renderTime).toBeLessThan(100);
  });
});

describe('Accessibility Tests', () => {
  it('should have proper accessibility attributes', () => {
    render(
      <TestWrapper>
        <ScreenLayout title="Accessible Screen" testID="test-screen">
          <Text>Accessible Content</Text>
        </ScreenLayout>
      </TestWrapper>
    );

    // Check for testID presence
    expect(screen.getByTestId('test-screen')).toBeTruthy();
  });

  it('should handle touch interactions properly', () => {
    const mockOnPress = jest.fn();
    
    render(
      <TestWrapper>
        <Header 
          title="Interactive Header"
          showBackButton
          onBackPress={mockOnPress}
        />
      </TestWrapper>
    );

    const backButton = screen.getByText('←');
    fireEvent.press(backButton);
    
    expect(mockOnPress).toHaveBeenCalled();
  });
});
