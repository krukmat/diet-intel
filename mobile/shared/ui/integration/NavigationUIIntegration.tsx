/**
 * Navigation UI Integration for DietIntel Mobile App
 * Demonstrates integration between Navigation Core and Shared UI System
 */

import React from 'react';
import { NavigationProvider, useSafeNavigation } from '../../../core/navigation/NavigationCore';
import { ScreenType } from '../../../core/navigation/NavigationTypes';
import { 
  ScreenLayout, 
  LoadingScreenLayout, 
  ErrorScreenLayout, 
  EmptyScreenLayout 
} from '../layouts/ScreenLayout';
import { NavigationHeader, ModalHeader, SearchHeader } from '../layouts/Header';
import { 
  LoadingSpinner, 
  FullScreenLoading, 
  EmptyState,
  NetworkErrorState
} from '../components';
import { useScreenLayout } from '../hooks/useScreenLayout';
import { useThemedStyles } from '../hooks/useThemedStyles';

/**
 * Example screen component using shared UI system
 */
interface ExampleScreenProps {
  screen: ScreenType;
  title: string;
  children?: React.ReactNode;
}

const ExampleScreen: React.FC<ExampleScreenProps> = ({ 
  screen, 
  title, 
  children 
}) => {
  const navigation = useSafeNavigation();
  const { layoutConfig, applyScreenLayout } = useScreenLayout(screen);
  const { theme, toggleTheme } = useThemedStyles();

  // Apply screen-specific layout
  React.useEffect(() => {
    applyScreenLayout(screen);
  }, [screen, applyScreenLayout]);

  return (
    <ScreenLayout
      title={title}
      showBackButton={layoutConfig.showBackButton}
      onBackPress={() => navigation.goBack()}
      backgroundColor={layoutConfig.backgroundColor}
      contentPadding={layoutConfig.contentPadding}
    >
      {children || (
        <div>
          <p>Current screen: {screen}</p>
          <button onClick={toggleTheme}>
            Toggle {theme ? 'Dark' : 'Light'} Theme
          </button>
        </div>
      )}
    </ScreenLayout>
  );
};

/**
 * Loading state screen
 */
const LoadingScreen: React.FC = () => {
  const navigation = useSafeNavigation();
  
  return (
    <LoadingScreenLayout 
      message="Loading screen..."
      backgroundColor="#007AFF"
    />
  );
};

/**
 * Error state screen
 */
const ErrorScreen: React.FC = () => {
  const navigation = useSafeNavigation();
  
  return (
    <ErrorScreenLayout
      message="This is a demo error screen"
      onRetry={() => navigation.navigate('track')}
      retryText="Retry"
    />
  );
};

/**
 * Empty state screen
 */
const EmptyScreen: React.FC = () => {
  const navigation = useSafeNavigation();
  
  return (
    <EmptyScreenLayout
      title="No Data Available"
      message="This screen demonstrates empty state UI"
      actionText="Go to Track"
      onAction={() => navigation.navigate('track')}
    />
  );
};

/**
 * Main app container integrating navigation and UI
 */
export const IntegratedApp: React.FC = () => {
  const navigation = useSafeNavigation();

  const handleScreenNavigation = (screen: ScreenType) => {
    navigation.navigate(screen);
  };

  const currentScreen = navigation.currentScreen;

  // Handle loading states
  if (navigation.navigationContext?.loading) {
    return <LoadingScreen />;
  }

  // Handle error states
  if (navigation.navigationContext?.error) {
    return (
      <ErrorScreenLayout
        message={navigation.navigationContext.error}
        onRetry={() => navigation.reset('track')}
      />
    );
  }

  // Render screen based on current navigation state
  switch (currentScreen) {
    case 'splash':
      return (
        <ExampleScreen screen="splash" title="Welcome">
          <div style={{ textAlign: 'center' }}>
            <h1>🎉 DietIntel Mobile</h1>
            <p>Your intelligent nutrition companion</p>
            <button onClick={() => handleScreenNavigation('track')}>
              Get Started
            </button>
          </div>
        </ExampleScreen>
      );

    case 'track':
      return (
        <ExampleScreen screen="track" title="Track Food">
          <div>
            <p>Track your daily food intake</p>
            <button onClick={() => handleScreenNavigation('plan')}>
              View Meal Plans
            </button>
            <button onClick={() => handleScreenNavigation('recipes')}>
              Browse Recipes
            </button>
          </div>
        </ExampleScreen>
      );

    case 'plan':
      return (
        <ExampleScreen screen="plan" title="Meal Plans">
          <div>
            <EmptyState
              title="No meal plans yet"
              message="Create your first meal plan to get started"
              actionText="Create Plan"
              onAction={() => handleScreenNavigation('track')}
            />
          </div>
        </ExampleScreen>
      );

    case 'recipes':
      return (
        <ExampleScreen screen="recipes" title="Recipes">
          <div>
            <SearchHeader
              title="Recipe Search"
              searchValue=""
              onSearchChange={(value) => console.log('Search:', value)}
              onSearchSubmit={() => console.log('Search submitted')}
            />
            <div style={{ padding: 16 }}>
              <p>Search for delicious recipes</p>
              <LoadingSpinner message="Loading recipes..." />
            </div>
          </div>
        </ExampleScreen>
      );

    case 'vision':
      return (
        <ExampleScreen screen="vision" title="Vision Analysis">
          <div style={{ textAlign: 'center' }}>
            <p>📷 Use your camera to analyze food</p>
            <NetworkErrorState
              onRetry={() => navigation.navigate('track')}
              onOfflineMode={() => console.log('Offline mode')}
            />
          </div>
        </ExampleScreen>
      );

    case 'profile':
      return (
        <ExampleScreen screen="profile" title="Profile">
          <div>
            <p>User Profile Settings</p>
            <button onClick={() => handleScreenNavigation('splash')}>
              Back to Home
            </button>
          </div>
        </ExampleScreen>
      );

    default:
      return (
        <ExampleScreen screen={currentScreen} title={`Screen: ${currentScreen}`}>
          <div>
            <p>Unknown screen: {currentScreen}</p>
            <button onClick={() => navigation.navigate('track')}>
              Go to Track
            </button>
          </div>
        </ExampleScreen>
      );
  }
};

/**
 * Navigation UI Integration Demo
 * Shows how to integrate Navigation Core with Shared UI System
 */
export const NavigationUIDemo: React.FC = () => {
  return (
    <NavigationProvider initialScreen="splash">
      <IntegratedApp />
    </NavigationProvider>
  );
};

/**
 * Example of feature-specific integration
 */
export const RecipeFeatureIntegration: React.FC = () => {
  const navigation = useSafeNavigation();
  const { layoutConfig } = useScreenLayout('recipes');

  return (
    <ScreenLayout
      title="Recipe Feature"
      showBackButton={layoutConfig.showBackButton}
      onBackPress={() => navigation.goBack()}
      contentPadding={layoutConfig.contentPadding}
    >
      <div>
        <SearchHeader
          title="Find Recipes"
          searchValue=""
          onSearchChange={(value) => console.log('Recipe search:', value)}
          onSearchSubmit={() => console.log('Search submitted')}
        />
        
        <div style={{ padding: 16 }}>
          <EmptyState
            title="No recipes found"
            message="Try adjusting your search terms"
            actionText="Clear Search"
            onAction={() => console.log('Clear search')}
          />
        </div>
      </div>
    </ScreenLayout>
  );
};

/**
 * Example of modal integration
 */
export const ModalIntegrationExample: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const navigation = useSafeNavigation();

  return (
    <ScreenLayout title="Modal Demo">
      <div>
        <button onClick={() => setIsModalVisible(true)}>
          Open Modal
        </button>
        
        {isModalVisible && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 8,
              maxWidth: 300
            }}>
              <ModalHeader
                title="Recipe Details"
                onClose={() => setIsModalVisible(false)}
                showCloseButton={true}
              />
              <div style={{ padding: 16 }}>
                <p>This is a modal dialog example</p>
                <button onClick={() => setIsModalVisible(false)}>
                  Close Modal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
};

export default {
  NavigationUIDemo,
  RecipeFeatureIntegration,
  ModalIntegrationExample,
  IntegratedApp
};
