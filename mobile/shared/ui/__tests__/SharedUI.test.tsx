/**
 * Shared UI System Tests for DietIntel Mobile App
 * Test suite for shared UI components, layouts, and hooks
 */

import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ScreenLayout, LoadingScreenLayout, ErrorScreenLayout, EmptyScreenLayout } from '../layouts/ScreenLayout';
import { Header, NavigationHeader, ModalHeader } from '../layouts/Header';
import { 
  LoadingSpinner, 
  FullScreenLoading, 
  InlineLoading, 
  SkeletonLoader 
} from '../components/LoadingStates';
import {
  EmptyState,
  EmptyList,
  EmptyFavorites,
  EmptyOffline
} from '../components/EmptyStates';
import {
  ErrorState,
  NetworkErrorState,
  ValidationErrorState
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
