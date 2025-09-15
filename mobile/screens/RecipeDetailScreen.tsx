import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
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
      <SafeAreaView style={styles.cookingModeContainer}>
        {/* Cooking Mode Header */}
        <View style={styles.cookingModeHeader}>
          <TouchableOpacity style={styles.cookingModeClose} onPress={onClose}>
            <Text style={styles.cookingModeCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.cookingModeTitle}>{t('recipeDetail.cookingMode', '🔥 Cooking Mode')}</Text>
          <View style={styles.cookingModeProgress}>
            <Text style={styles.cookingModeProgressText}>
              {t('recipeDetail.stepProgress', '{{current}} / {{total}}', {
                current: currentStep + 1,
                total: recipe.instructions.length
              })}
            </Text>
          </View>
        </View>

        {/* Current Step Display */}
        <ScrollView style={styles.cookingModeContent}>
          <View style={styles.currentStepContainer}>
            <View style={styles.currentStepNumber}>
              <Text style={styles.currentStepNumberText}>{currentInstruction.step}</Text>
            </View>
            
            <Text style={styles.currentStepText}>
              {currentInstruction.instruction}
            </Text>

            {/* Step Meta Information */}
            {(currentInstruction.timeMinutes || currentInstruction.temperature) && (
              <View style={styles.currentStepMeta}>
                {currentInstruction.timeMinutes && (
                  <TouchableOpacity
                    style={styles.currentTimerButton}
                    onPress={() => startTimer(currentStep, currentInstruction.timeMinutes!)}
                  >
                    <Text style={styles.currentTimerText}>
                      {t('recipeDetail.setTimer', '⏰ Set {{time}} timer', {
                        time: formatRecipeTime(currentInstruction.timeMinutes!, currentLanguage)
                      })}
                    </Text>
                  </TouchableOpacity>
                )}
                {currentInstruction.temperature && (
                  <View style={styles.currentTempInfo}>
                    <Text style={styles.currentTempText}>
                      🌡️ {currentInstruction.temperature}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Step Completion */}
            <TouchableOpacity
              style={[
                styles.stepCompleteButton,
                completedSteps[currentStep] && styles.stepCompleteButtonCompleted
              ]}
              onPress={() => onStepComplete(currentStep, !completedSteps[currentStep])}
            >
              <Text style={[
                styles.stepCompleteText,
                completedSteps[currentStep] && styles.stepCompleteTextCompleted
              ]}>
                {completedSteps[currentStep] ?
                  t('recipeDetail.stepComplete', '✓ Step Complete') :
                  t('recipeDetail.markComplete', 'Mark as Complete')
                }
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Navigation Controls */}
        <View style={styles.cookingModeNavigation}>
          <TouchableOpacity
            style={[styles.cookingNavButton, currentStep === 0 && styles.cookingNavButtonDisabled]}
            onPress={prevStep}
            disabled={currentStep === 0}
          >
            <Text style={[
              styles.cookingNavButtonText,
              currentStep === 0 && styles.cookingNavButtonTextDisabled
            ]}>
              {t('common.previous', '← Previous')}
            </Text>
          </TouchableOpacity>

          <View style={styles.cookingModeStepIndicator}>
            <View style={styles.stepDots}>
              {recipe.instructions.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.stepDot,
                    index === currentStep && styles.stepDotActive,
                    completedSteps[index] && styles.stepDotCompleted,
                  ]}
                />
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.cookingNavButton,
              currentStep === recipe.instructions.length - 1 && styles.cookingNavButtonDisabled
            ]}
            onPress={nextStep}
            disabled={currentStep === recipe.instructions.length - 1}
          >
            <Text style={[
              styles.cookingNavButtonText,
              currentStep === recipe.instructions.length - 1 && styles.cookingNavButtonTextDisabled
            ]}>
              {t('common.next', 'Next →')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('recipeDetail.loading', 'Loading recipe...')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>← {t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('recipeDetail.title', 'Recipe Details')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content}
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
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ingredients' && styles.tabActive]}
            onPress={() => setActiveTab('ingredients')}
          >
            <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
              {t('recipeDetail.ingredientsTab', 'Ingredients')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'instructions' && styles.tabActive]}
            onPress={() => setActiveTab('instructions')}
          >
            <Text style={[styles.tabText, activeTab === 'instructions' && styles.tabTextActive]}>
              {t('recipeDetail.instructionsTab', 'Instructions')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'nutrition' && styles.tabActive]}
            onPress={() => setActiveTab('nutrition')}
          >
            <Text style={[styles.tabText, activeTab === 'nutrition' && styles.tabTextActive]}>
              {t('recipeDetail.nutritionTab', 'Nutrition')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
              {t('recipeDetail.reviewsTab', 'Reviews')}
            </Text>
          </TouchableOpacity>
        </View>

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
      </ScrollView>

      {/* Cooking Mode Modal */}
      <CookingMode
        recipe={recipe}
        visible={showCookingMode}
        onClose={() => setShowCookingMode(false)}
        completedSteps={completedSteps}
        onStepComplete={handleStepComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  
  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontSize: 18,
    color: '#8E8E93',
  },

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 80, // Same width as back button to center title
  },

  // Content Styles
  content: {
    flex: 1,
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: 'white',
  },

  // Cooking Mode Styles
  cookingModeContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E', // Dark background for cooking mode
  },
  cookingModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#2C2C2E',
  },
  cookingModeClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#48484A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cookingModeCloseText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  cookingModeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  cookingModeProgress: {
    backgroundColor: '#48484A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cookingModeProgressText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  cookingModeContent: {
    flex: 1,
    padding: 20,
  },
  currentStepContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  currentStepNumber: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  currentStepNumberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  currentStepText: {
    fontSize: 24,
    color: 'white',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 24,
  },
  currentStepMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  currentTimerButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  currentTimerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  currentTempInfo: {
    backgroundColor: '#48484A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  currentTempText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  stepCompleteButton: {
    backgroundColor: '#48484A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  stepCompleteButtonCompleted: {
    backgroundColor: '#34C759',
  },
  stepCompleteText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  stepCompleteTextCompleted: {
    color: 'white',
  },
  cookingModeNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#2C2C2E',
  },
  cookingNavButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cookingNavButtonDisabled: {
    backgroundColor: '#48484A',
    opacity: 0.5,
  },
  cookingNavButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cookingNavButtonTextDisabled: {
    color: '#8E8E93',
  },
  cookingModeStepIndicator: {
    flex: 1,
    alignItems: 'center',
  },
  stepDots: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#48484A',
  },
  stepDotActive: {
    backgroundColor: '#007AFF',
    width: 12,
    height: 8,
    borderRadius: 6,
  },
  stepDotCompleted: {
    backgroundColor: '#34C759',
  },
});