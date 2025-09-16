import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Container } from '../components/ui/Container';
import { Section } from '../components/ui/Section';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { tokens } from '../theme/tokens';
import {
  RecipeHeader,
  InteractiveIngredients,
  Instructions,
  NutritionDisplay,
  RatingSystem,
} from '../components/RecipeDetailComponents';
import {
  getCurrentRecipeLanguage,
  formatRecipeTime,
} from '../utils/recipeLanguageHelper';

interface RecipeDetailScreenProps {
  recipeId?: string;
  recipe?: any; // Recipe data passed from generation screen
  onBackPress: () => void;
  onNavigateToOptimize?: (recipe: any) => void;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  cookingTime: number;
  servings: number;
  difficulty: string;
  cuisineType: string;
  rating: number;
  totalRatings: number;
  tags: string[];
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    category?: string;
  }>;
  instructions: Array<{
    step: number;
    instruction: string;
    timeMinutes?: number;
    temperature?: string;
  }>;
  nutrition: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
    sugar: number;
    sodium: number;
    score: number;
  };
}

interface CookingModeProps {
  recipe: Recipe;
  visible: boolean;
  onClose: () => void;
  completedSteps: boolean[];
  onStepComplete: (stepIndex: number, completed: boolean) => void;
}

const CookingMode: React.FC<CookingModeProps> = ({
  recipe,
  visible,
  onClose,
  completedSteps,
  onStepComplete,
}) => {
  const { t } = useTranslation();
  const currentLanguage = getCurrentRecipeLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [timers, setTimers] = useState<Record<number, { time: number; active: boolean }>>({});

  const nextStep = () => {
    if (currentStep < recipe.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const startTimer = (stepIndex: number, minutes: number) => {
    setTimers(prev => ({
      ...prev,
      [stepIndex]: { time: minutes * 60, active: true }
    }));
  };

  const currentInstruction = recipe.instructions[currentStep];

  return (
    <Modal visible={visible} animationType="slide">
      <Container
        padding="none"
        backgroundColor={tokens.colors.surface.dark}
        safeArea
      >
        {/* Cooking Mode Header */}
        <Section
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          padding="lg"
          backgroundColor={tokens.colors.surface.darkSecondary}
          noDivider
        >
          <Button
            variant="tertiary"
            size="sm"
            onPress={onClose}
            title="✕"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: tokens.colors.surface.darkTertiary,
            }}
          />
          <Text style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.text.dark,
          }}>
            {t('recipeDetail.cookingMode', '🔥 Cooking Mode')}
          </Text>
          <View style={{
            backgroundColor: tokens.colors.surface.darkTertiary,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: tokens.spacing.xs,
            borderRadius: tokens.borderRadius.lg,
          }}>
            <Text style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.text.dark,
              fontWeight: tokens.typography.fontWeight.semiBold,
            }}>
              {t('recipeDetail.stepProgress', '{{current}} / {{total}}', {
                current: currentStep + 1,
                total: recipe.instructions.length
              })}
            </Text>
          </View>
        </Section>

        {/* Current Step Display */}
        <Container
          scrollable
          padding="lg"
          backgroundColor={tokens.colors.surface.dark}
        >
          <Card
            padding="xl"
            backgroundColor={tokens.colors.surface.darkSecondary}
            style={{ alignItems: 'center' }}
          >
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: tokens.colors.primary[500],
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: tokens.spacing.lg,
            }}>
              <Text style={{
                fontSize: tokens.typography.fontSize.xxl,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.dark,
              }}>
                {currentInstruction.step}
              </Text>
            </View>

            <Text style={{
              fontSize: tokens.typography.fontSize.xxl,
              color: tokens.colors.text.dark,
              textAlign: 'center',
              lineHeight: 32,
              marginBottom: tokens.spacing.xl,
            }}>
              {currentInstruction.instruction}
            </Text>

            {/* Step Meta Information */}
            {(currentInstruction.timeMinutes || currentInstruction.temperature) && (
              <Section
                flexDirection="row"
                gap={tokens.spacing.md}
                style={{ marginBottom: tokens.spacing.xxl }}
                noDivider
              >
                {currentInstruction.timeMinutes && (
                  <Button
                    variant="secondary"
                    size="md"
                    onPress={() => startTimer(currentStep, currentInstruction.timeMinutes!)}
                    title={t('recipeDetail.setTimer', '⏰ Set {{time}} timer', {
                      time: formatRecipeTime(currentInstruction.timeMinutes!, currentLanguage)
                    })}
                    style={{
                      backgroundColor: tokens.colors.secondary[500],
                    }}
                  />
                )}
                {currentInstruction.temperature && (
                  <View style={{
                    backgroundColor: tokens.colors.surface.darkTertiary,
                    paddingHorizontal: tokens.spacing.lg,
                    paddingVertical: tokens.spacing.sm,
                    borderRadius: tokens.borderRadius.md,
                  }}>
                    <Text style={{
                      color: tokens.colors.text.dark,
                      fontSize: tokens.typography.fontSize.md,
                      fontWeight: tokens.typography.fontWeight.semiBold,
                    }}>
                      🌡️ {currentInstruction.temperature}
                    </Text>
                  </View>
                )}
              </Section>
            )}

            {/* Step Completion */}
            <Button
              variant={completedSteps[currentStep] ? "primary" : "tertiary"}
              size="lg"
              onPress={() => onStepComplete(currentStep, !completedSteps[currentStep])}
              title={completedSteps[currentStep] ?
                t('recipeDetail.stepComplete', '✓ Step Complete') :
                t('recipeDetail.markComplete', 'Mark as Complete')
              }
              style={{
                minWidth: 200,
                backgroundColor: completedSteps[currentStep] ?
                  tokens.colors.success[500] :
                  tokens.colors.surface.darkTertiary,
              }}
            />
          </Card>
        </Container>

        {/* Navigation Controls */}
        <Section
          flexDirection="row"
          alignItems="center"
          padding="lg"
          backgroundColor={tokens.colors.surface.darkSecondary}
          noDivider
        >
          <Button
            variant={currentStep === 0 ? "disabled" : "primary"}
            size="md"
            onPress={prevStep}
            disabled={currentStep === 0}
            title={t('common.previous', '← Previous')}
            style={{
              minWidth: 100,
              backgroundColor: currentStep === 0 ?
                tokens.colors.surface.darkTertiary :
                tokens.colors.primary[500],
              opacity: currentStep === 0 ? 0.5 : 1,
            }}
          />

          <View style={{
            flex: 1,
            alignItems: 'center',
          }}>
            <View style={{
              flexDirection: 'row',
              gap: tokens.spacing.xs,
            }}>
              {recipe.instructions.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index === currentStep ? 12 : 8,
                    height: 8,
                    borderRadius: index === currentStep ? 6 : 4,
                    backgroundColor: completedSteps[index] ?
                      tokens.colors.success[500] :
                      index === currentStep ?
                        tokens.colors.primary[500] :
                        tokens.colors.surface.darkTertiary,
                  }}
                />
              ))}
            </View>
          </View>

          <Button
            variant={currentStep === recipe.instructions.length - 1 ? "disabled" : "primary"}
            size="md"
            onPress={nextStep}
            disabled={currentStep === recipe.instructions.length - 1}
            title={t('common.next', 'Next →')}
            style={{
              minWidth: 100,
              backgroundColor: currentStep === recipe.instructions.length - 1 ?
                tokens.colors.surface.darkTertiary :
                tokens.colors.primary[500],
              opacity: currentStep === recipe.instructions.length - 1 ? 0.5 : 1,
            }}
          />
        </Section>
      </Container>
    </Modal>
  );
};

export default function RecipeDetailScreen({
  recipeId,
  recipe: initialRecipe,
  onBackPress,
  onNavigateToOptimize,
}: RecipeDetailScreenProps) {
  const { t } = useTranslation();
  
  // Recipe state
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // User interaction state
  const [currentServings, setCurrentServings] = useState(4);
  const [checkedIngredients, setCheckedIngredients] = useState<boolean[]>([]);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions' | 'nutrition' | 'reviews'>('ingredients');
  const [showCookingMode, setShowCookingMode] = useState(false);

  useEffect(() => {
    if (initialRecipe) {
      // Recipe passed from generation screen
      setRecipe({
        ...initialRecipe,
        rating: 4.5,
        totalRatings: 128,
        tags: initialRecipe.tags || ['AI Generated', 'Personalized'],
      });
      setCurrentServings(initialRecipe.servings);
      setCheckedIngredients(new Array(initialRecipe.ingredients.length).fill(false));
      setCompletedSteps(new Array(initialRecipe.instructions.length).fill(false));
    } else if (recipeId) {
      // Load recipe from API
      loadRecipe();
    }
  }, [recipeId, initialRecipe]);

  const loadRecipe = async () => {
    if (!recipeId) return;
    
    setLoading(true);
    try {
      // TODO: Replace with actual API call in R.2.1.6
      // const response = await fetch(`/api/recipe/${recipeId}`);
      // const recipeData = await response.json();
      
      // Mock recipe data for now
      const mockRecipe: Recipe = {
        id: recipeId,
        name: "Mediterranean Quinoa Bowl",
        description: "A healthy, colorful bowl packed with Mediterranean flavors and quinoa",
        cookingTime: 25,
        servings: 4,
        difficulty: "intermediate",
        cuisineType: "mediterranean",
        rating: 4.7,
        totalRatings: 89,
        tags: ["Mediterranean", "Healthy", "Vegetarian", "High Protein"],
        ingredients: [
          { name: "Quinoa", quantity: 1, unit: "cup", category: "Grains" },
          { name: "Cherry Tomatoes", quantity: 200, unit: "g", category: "Vegetables" },
          { name: "Cucumber", quantity: 1, unit: "medium", category: "Vegetables" },
          { name: "Red Onion", quantity: 0.5, unit: "small", category: "Vegetables" },
          { name: "Kalamata Olives", quantity: 0.5, unit: "cup", category: "Vegetables" },
          { name: "Feta Cheese", quantity: 100, unit: "g", category: "Dairy" },
          { name: "Olive Oil", quantity: 3, unit: "tbsp", category: "Oils" },
          { name: "Lemon Juice", quantity: 2, unit: "tbsp", category: "Condiments" },
          { name: "Fresh Herbs", quantity: 0.25, unit: "cup", category: "Herbs" },
        ],
        instructions: [
          { step: 1, instruction: "Rinse quinoa under cold water until water runs clear", timeMinutes: 2 },
          { step: 2, instruction: "Bring 2 cups water to boil, add quinoa, reduce heat and simmer covered", timeMinutes: 15 },
          { step: 3, instruction: "Meanwhile, dice tomatoes, cucumber, and red onion into small pieces" },
          { step: 4, instruction: "Whisk together olive oil, lemon juice, salt, and pepper for dressing" },
          { step: 5, instruction: "Fluff cooked quinoa with a fork and let cool for 5 minutes", timeMinutes: 5 },
          { step: 6, instruction: "Combine quinoa with vegetables, olives, and feta cheese" },
          { step: 7, instruction: "Drizzle with dressing, add fresh herbs, and toss gently to combine" },
        ],
        nutrition: {
          calories: 385,
          protein: 12,
          fat: 18,
          carbs: 45,
          fiber: 6,
          sugar: 8,
          sodium: 420,
          score: 0.89,
        },
      };

      setRecipe(mockRecipe);
      setCurrentServings(mockRecipe.servings);
      setCheckedIngredients(new Array(mockRecipe.ingredients.length).fill(false));
      setCompletedSteps(new Array(mockRecipe.instructions.length).fill(false));
    } catch (error) {
      console.error('Error loading recipe:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('recipeDetail.loadError', 'Failed to load recipe. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecipe();
    setRefreshing(false);
  };

  const handleServingsChange = (newServings: number) => {
    setCurrentServings(newServings);
  };

  const handleIngredientToggle = (index: number, checked: boolean) => {
    const newCheckedIngredients = [...checkedIngredients];
    newCheckedIngredients[index] = checked;
    setCheckedIngredients(newCheckedIngredients);
  };

  const handleStepComplete = (stepIndex: number, completed: boolean) => {
    const newCompletedSteps = [...completedSteps];
    newCompletedSteps[stepIndex] = completed;
    setCompletedSteps(newCompletedSteps);
  };

  const handleShare = () => {
    Alert.alert(
      t('recipeDetail.shareRecipe', '🔗 Share Recipe'),
      t('recipeDetail.shareMessage', 'Share "{{recipeName}}" with friends!', { recipeName: recipe?.name })
    );
  };

  const handleSave = () => {
    setIsFavorited(!isFavorited);
    Alert.alert(
      isFavorited ?
        t('recipeDetail.removedFromFavorites', '💔 Removed from Favorites') :
        t('recipeDetail.addedToFavorites', '❤️ Added to Favorites'),
      t('recipeDetail.favoritesMessage', '"{{recipeName}}" {{action}} your favorites', {
        recipeName: recipe?.name,
        action: isFavorited ?
          t('recipeDetail.removedFrom', 'removed from') :
          t('recipeDetail.addedTo', 'added to')
      })
    );
  };

  const handleOptimize = () => {
    if (recipe && onNavigateToOptimize) {
      onNavigateToOptimize(recipe);
    } else {
      Alert.alert(
        t('recipeDetail.optimizeRecipe', '⚡ Optimize Recipe'),
        t('recipeDetail.optimizeComingSoon', 'Recipe optimization will be available in the next update!')
      );
    }
  };

  const handleGenerateShoppingList = () => {
    const missingIngredients = recipe?.ingredients.filter((_, index) => !checkedIngredients[index]) || [];
    Alert.alert(
      t('recipeDetail.shoppingList', '🛒 Shopping List'),
      t('recipeDetail.generateShoppingListMessage', 'Generate shopping list for {{count}} missing ingredients?', {
        count: missingIngredients.length
      }),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('common.generate', 'Generate'), onPress: () => {
          Alert.alert(
            t('recipeDetail.shoppingListCreated', '✅ Shopping List Created!'),
            t('recipeDetail.shoppingListCreatedMessage', 'Added missing ingredients to your shopping list')
          );
        }},
      ]
    );
  };

  const handleRatingSubmit = (rating: number, review?: string) => {
    setUserRating(rating);
    Alert.alert(
      t('recipeDetail.ratingSubmitted', '⭐ Rating Submitted'),
      t('recipeDetail.ratingThankYou', 'Thank you for rating "{{recipeName}}" {{rating}} {{stars}}!{{reviewNote}}', {
        recipeName: recipe?.name,
        rating: rating,
        stars: rating !== 1 ? t('common.stars', 'stars') : t('common.star', 'star'),
        reviewNote: review ? ` ${t('recipeDetail.reviewSubmitted', 'Your review has been submitted.')}` : ''
      })
    );
  };

  const handleStartCookingMode = () => {
    setShowCookingMode(true);
  };

  if (loading || !recipe) {
    return (
      <Container
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor={tokens.colors.background.primary}
      >
        <Text style={{
          fontSize: tokens.typography.fontSize.lg,
          color: tokens.colors.text.secondary,
        }}>
          {t('recipeDetail.loading', 'Loading recipe...')}
        </Text>
      </Container>
    );
  }

  return (
    <Container
      flex={1}
      backgroundColor={tokens.colors.background.primary}
    >
      {/* Header */}
      <Section
        flexDirection="row"
        alignItems="center"
        padding="md"
        backgroundColor={tokens.colors.surface.primary}
        style={{
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.primary,
        }}
        noDivider
      >
        <Button
          variant="tertiary"
          size="sm"
          onPress={onBackPress}
          title={`← ${t('common.back', 'Back')}`}
          style={{
            paddingVertical: tokens.spacing.xs,
            paddingHorizontal: tokens.spacing.sm,
            borderRadius: tokens.borderRadius.sm,
            backgroundColor: tokens.colors.background.primary,
          }}
        />
        <Text style={{
          flex: 1,
          fontSize: tokens.typography.fontSize.lg,
          fontWeight: tokens.typography.fontWeight.bold,
          color: tokens.colors.text.primary,
          textAlign: 'center',
        }}>
          {t('recipeDetail.title', 'Recipe Details')}
        </Text>
        <View style={{ width: 80 }} />
      </Section>

      <Container
        scrollable
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Recipe Header */}
        <RecipeHeader
          recipe={recipe}
          onShare={handleShare}
          onSave={handleSave}
          onOptimize={handleOptimize}
          onGenerateShoppingList={handleGenerateShoppingList}
          isFavorited={isFavorited}
        />

        {/* Tab Navigation */}
        <Card
          padding="xs"
          margin="md"
          style={{
            flexDirection: 'row',
            backgroundColor: tokens.colors.surface.primary,
          }}
        >
          <Button
            variant={activeTab === 'ingredients' ? 'primary' : 'ghost'}
            size="sm"
            onPress={() => setActiveTab('ingredients')}
            title={t('recipeDetail.ingredientsTab', 'Ingredients')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'ingredients' ?
                tokens.colors.primary[500] : 'transparent',
              borderRadius: tokens.borderRadius.sm,
            }}
          />

          <Button
            variant={activeTab === 'instructions' ? 'primary' : 'ghost'}
            size="sm"
            onPress={() => setActiveTab('instructions')}
            title={t('recipeDetail.instructionsTab', 'Instructions')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'instructions' ?
                tokens.colors.primary[500] : 'transparent',
              borderRadius: tokens.borderRadius.sm,
            }}
          />

          <Button
            variant={activeTab === 'nutrition' ? 'primary' : 'ghost'}
            size="sm"
            onPress={() => setActiveTab('nutrition')}
            title={t('recipeDetail.nutritionTab', 'Nutrition')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'nutrition' ?
                tokens.colors.primary[500] : 'transparent',
              borderRadius: tokens.borderRadius.sm,
            }}
          />

          <Button
            variant={activeTab === 'reviews' ? 'primary' : 'ghost'}
            size="sm"
            onPress={() => setActiveTab('reviews')}
            title={t('recipeDetail.reviewsTab', 'Reviews')}
            style={{
              flex: 1,
              backgroundColor: activeTab === 'reviews' ?
                tokens.colors.primary[500] : 'transparent',
              borderRadius: tokens.borderRadius.sm,
            }}
          />
        </Card>

        {/* Tab Content */}
        {activeTab === 'ingredients' && (
          <InteractiveIngredients
            ingredients={recipe.ingredients}
            originalServings={recipe.servings}
            onServingsChange={handleServingsChange}
            onIngredientToggle={handleIngredientToggle}
            checkedIngredients={checkedIngredients}
          />
        )}

        {activeTab === 'instructions' && (
          <Instructions
            instructions={recipe.instructions}
            onStartCookingMode={handleStartCookingMode}
            completedSteps={completedSteps}
            onStepComplete={handleStepComplete}
          />
        )}

        {activeTab === 'nutrition' && (
          <NutritionDisplay
            nutrition={recipe.nutrition}
            servings={currentServings}
          />
        )}

        {activeTab === 'reviews' && (
          <RatingSystem
            currentRating={recipe.rating}
            totalRatings={recipe.totalRatings}
            userRating={userRating}
            onRatingSubmit={handleRatingSubmit}
          />
        )}
      </Container>

      {/* Cooking Mode Modal */}
      <CookingMode
        recipe={recipe}
        visible={showCookingMode}
        onClose={() => setShowCookingMode(false)}
        completedSteps={completedSteps}
        onStepComplete={handleStepComplete}
      />
    </Container>
  );
}

// Styles removed - now using systematic components with design tokens