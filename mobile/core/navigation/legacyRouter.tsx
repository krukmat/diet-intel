import React from 'react';
import { Alert } from 'react-native';
import type { ScreenType, NavigationContext } from './NavigationTypes';
import UploadLabel from '../../screens/UploadLabel';
import PlanScreen from '../../screens/PlanScreen';
import PlanDetailScreen from '../../screens/PlanDetailScreen';
import TrackScreen from '../../screens/TrackScreen';
import SmartDietScreen from '../../screens/SmartDietScreen';
import VisionLogScreen from '../../screens/VisionLogScreen';
import RecipeHomeScreen from '../../screens/RecipeHomeScreen';
import RecipeGenerationScreen from '../../screens/RecipeGenerationScreen';
import RecipeSearchScreen from '../../screens/RecipeSearchScreen';
import MyRecipesScreen from '../../screens/MyRecipesScreen';
import RecipeDetailScreen from '../../screens/RecipeDetailScreen';
import TastePreferencesScreen from '../../screens/TastePreferencesScreen';
import ShoppingOptimizationScreen from '../../screens/ShoppingOptimizationScreen';
import IntelligentFlowScreen from '../../screens/IntelligentFlowScreen';
import { ProfileScreen } from '../../screens/ProfileScreen';
import { ProfileEditScreen } from '../../screens/ProfileEditScreen';
import { DiscoverFeedScreen } from '../../screens/DiscoverFeedScreen';
import { WeightScreen } from '../../screens/WeightScreen';
import { PhotoLogsScreen } from '../../screens/PhotoLogsScreen';
import RewardsScreen from '../../screens/RewardsScreen';

interface RenderScreenParams {
  currentScreen: ScreenType;
  navigationContext: NavigationContext;
  setCurrentScreen: (screen: ScreenType) => void;
  navigateToScreen: (screen: ScreenType, context?: NavigationContext) => void;
  user: any;
}

type ScreenRenderer = (params: RenderScreenParams) => React.ReactNode;

const renderUpload: ScreenRenderer = ({ setCurrentScreen }) => (
  <UploadLabel onBackPress={() => setCurrentScreen('scanner')} />
);

const renderPlan: ScreenRenderer = ({ setCurrentScreen, navigateToScreen, navigationContext }) => (
  <PlanScreen
    onBackPress={() => setCurrentScreen('scanner')}
    onViewPlan={(planId: string) => navigateToScreen('plan-detail', { planId })}
    navigationContext={navigationContext}
    navigateToSmartDiet={(context?: any) =>
      navigateToScreen('recommendations', {
        targetContext: 'optimize',
        sourceScreen: 'plan',
        ...context,
      })
    }
  />
);

const renderPlanDetail: ScreenRenderer = ({ setCurrentScreen, navigationContext }) => (
  <PlanDetailScreen
    onBackPress={() => setCurrentScreen('plan')}
    planId={navigationContext.planId}
  />
);

const renderTrack: ScreenRenderer = ({ setCurrentScreen }) => (
  <TrackScreen onBackPress={() => setCurrentScreen('scanner')} />
);

const renderRecommendations: ScreenRenderer = ({ setCurrentScreen, navigateToScreen, navigationContext }) => (
  <SmartDietScreen
    key={navigationContext?.targetContext ?? navigationContext?.planId ?? 'smart-diet'}
    onBackPress={() => setCurrentScreen('scanner')}
    navigationContext={navigationContext}
    navigateToTrack={() =>
      navigateToScreen('track', {
        sourceScreen: 'recommendations',
      })
    }
    navigateToPlan={() =>
      navigateToScreen('plan', {
        sourceScreen: 'recommendations',
      })
    }
  />
);

const renderIntelligentFlow: ScreenRenderer = ({ setCurrentScreen }) => (
  <IntelligentFlowScreen onBackPress={() => setCurrentScreen('scanner')} />
);

const renderVision: ScreenRenderer = ({ setCurrentScreen }) => (
  <VisionLogScreen onBackPress={() => setCurrentScreen('scanner')} />
);

const renderDiscoverFeed: ScreenRenderer = ({ setCurrentScreen }) => (
  <DiscoverFeedScreen onBackPress={() => setCurrentScreen('scanner')} />
);

const renderProfile: ScreenRenderer = () => <ProfileScreen />;

const renderProfileEdit: ScreenRenderer = ({ setCurrentScreen }) => (
  <ProfileEditScreen
    onSave={async () => {
      setCurrentScreen('profile');
      Alert.alert('Success', 'Profile updated successfully');
    }}
    onCancel={() => setCurrentScreen('profile')}
  />
);

const renderRecipes: ScreenRenderer = ({ setCurrentScreen, navigationContext }) => (
  <RecipeHomeScreen
    onBackPress={() => setCurrentScreen('scanner')}
    navigateToGeneration={() => setCurrentScreen('recipe-generation')}
    navigateToSearch={() => setCurrentScreen('recipe-search')}
    navigateToMyRecipes={() => setCurrentScreen('my-recipes')}
    navigationContext={navigationContext}
  />
);

const renderRecipeGeneration: ScreenRenderer = ({ setCurrentScreen, navigateToScreen }) => (
  <RecipeGenerationScreen
    onBackPress={() => setCurrentScreen('recipes')}
    onNavigateToDetail={(recipe: any) => {
      navigateToScreen('recipe-detail', {
        recipeData: recipe,
        sourceScreen: 'recipe-generation',
      });
    }}
  />
);

const renderRecipeSearch: ScreenRenderer = ({ setCurrentScreen }) => (
  <RecipeSearchScreen onBackPress={() => setCurrentScreen('recipes')} />
);

const renderMyRecipes: ScreenRenderer = ({ setCurrentScreen }) => (
  <MyRecipesScreen onBackPress={() => setCurrentScreen('recipes')} />
);

const getRecipeDetailBackTarget = (sourceScreen?: string): ScreenType => {
  if (sourceScreen && ['recipe-generation', 'recipe-search', 'my-recipes'].includes(sourceScreen)) {
    return sourceScreen as ScreenType;
  }
  return 'recipes';
};

const renderRecipeDetail: ScreenRenderer = ({ setCurrentScreen, navigateToScreen, navigationContext }) => (
  <RecipeDetailScreen
    recipeId={navigationContext.recipeId}
    recipe={navigationContext.recipeData}
    onBackPress={() => setCurrentScreen(getRecipeDetailBackTarget(navigationContext.sourceScreen))}
    onNavigateToOptimize={(recipe: any) => {
      navigateToScreen('recipe-generation', {
        recipeData: recipe,
        sourceScreen: 'recipe-detail',
      });
    }}
  />
);

const renderTastePreferences: ScreenRenderer = ({ setCurrentScreen, user }) => (
  <TastePreferencesScreen onBackPress={() => setCurrentScreen('recipes')} userId={user?.id || 'user-demo'} />
);

const renderShoppingOptimization: ScreenRenderer = ({ setCurrentScreen, navigationContext, user }) => (
  <ShoppingOptimizationScreen
    onBackPress={() => setCurrentScreen('recipes')}
    selectedRecipes={navigationContext.selectedRecipes || []}
    userId={user?.id || 'user-demo'}
  />
);


const renderWeight: ScreenRenderer = ({ setCurrentScreen }) => {
  const handleBack = () => setCurrentScreen("scanner");
  return (
    <WeightScreen onBackPress={handleBack} />
  );
};

const renderPhotos: ScreenRenderer = ({ setCurrentScreen }) => {
  const handleBack = () => setCurrentScreen("scanner");
  return (
    <PhotoLogsScreen onBackPress={handleBack} />
  );
};

const renderRewards: ScreenRenderer = ({ setCurrentScreen }) => (
  <RewardsScreen navigation={{ goBack: () => setCurrentScreen('scanner') }} />
);

const screenRenderers: Partial<Record<ScreenType, ScreenRenderer>> = {
  upload: renderUpload,
  plan: renderPlan,
  'plan-detail': renderPlanDetail,
  track: renderTrack,
  recommendations: renderRecommendations,
  'intelligent-flow': renderIntelligentFlow,
  vision: renderVision,
  'discover-feed': renderDiscoverFeed,
  profile: renderProfile,
  'profile-edit': renderProfileEdit,
  recipes: renderRecipes,
  'recipe-generation': renderRecipeGeneration,
  'recipe-search': renderRecipeSearch,
  'my-recipes': renderMyRecipes,
  'recipe-detail': renderRecipeDetail,
  'taste-preferences': renderTastePreferences,
  'shopping-optimization': renderShoppingOptimization,
  weight: renderWeight,
  photos: renderPhotos,
  rewards: renderRewards,
};

export const renderScreen = (params: RenderScreenParams): React.ReactNode | null => {
  if (params.currentScreen === 'scanner') {
    return null;
  }

  const renderer = screenRenderers[params.currentScreen];
  return renderer ? renderer(params) : null;
};
