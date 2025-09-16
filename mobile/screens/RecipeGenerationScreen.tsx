import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MultiSelect,
  CheckboxGroup,
  RadioGroup,
  NumberInput,
  ValidatedTextInput,
} from '../components/RecipeFormComponents';
import { RecipeLanguageToggle } from '../components/RecipeLanguageToggle';
import { useRecipeGeneration, usePersonalRecipes, useNetworkStatus } from '../hooks/useApiRecipes';
import { RecipeGenerationRequest } from '../services/RecipeApiService';
import {
  getCurrentRecipeLanguage,
  getLocalizedCuisineTypes,
  getLocalizedDietaryRestrictions,
  getLocalizedDifficultyLevels,
  enhanceRequestWithLanguage
} from '../utils/recipeLanguageHelper';
import {
  Container,
  Section,
  Button,
  Card,
  CardHeader,
  CardBody,
  Grid,
  tokens
} from '../components/ui';

interface RecipeGenerationScreenProps {
  onBackPress: () => void;
  onNavigateToDetail?: (recipe: any) => void;
}

interface RecipePreferences {
  cuisineTypes: string[];
  dietaryRestrictions: string[];
  difficultyLevel: string;
  servings: number;
  cookingTime: number;
  targetCalories: string;
  includeIngredients: string;
  excludeIngredients: string;
  specialGoals: string[];
}

interface GeneratedRecipe {
  id: string;
  name: string;
  description: string;
  cookingTime: number;
  servings: number;
  difficulty: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
  }>;
  instructions: Array<{
    step: number;
    instruction: string;
  }>;
  nutrition: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    score: number;
  };
}

export default function RecipeGenerationScreen({
  onBackPress,
  onNavigateToDetail,
}: RecipeGenerationScreenProps) {
  const { t } = useTranslation();

  // API Integration Hooks
  const { generateRecipe, cancelGeneration, data, loading, error, progress, isGenerating } = useRecipeGeneration();
  const { saveRecipe } = usePersonalRecipes();
  const networkStatus = useNetworkStatus();

  // Get current language for Recipe AI
  const currentLanguage = getCurrentRecipeLanguage();
  const localizedCuisineTypes = getLocalizedCuisineTypes(currentLanguage);
  const localizedDietaryRestrictions = getLocalizedDietaryRestrictions(currentLanguage);
  const localizedDifficultyLevels = getLocalizedDifficultyLevels(currentLanguage);

  const [preferences, setPreferences] = useState<RecipePreferences>({
    cuisineTypes: [],
    dietaryRestrictions: [],
    difficultyLevel: 'beginner',
    servings: 4,
    cookingTime: 30,
    targetCalories: '',
    includeIngredients: '',
    excludeIngredients: '',
    specialGoals: [],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSaveOptions, setShowSaveOptions] = useState(false);

  // Animation values for progress (now using real API progress)
  const progressAnimation = new Animated.Value(0);

  // Handle language changes
  const handleLanguageChange = (language: string) => {
    // Refresh form options when language changes
    setTimeout(() => {
      // Force re-render with new language
      setPreferences(prev => ({ ...prev }));
    }, 100);
  };

  // Form options data - now using i18n translations
  const cuisineOptions = [
    { value: 'italian', label: `🇮🇹 ${localizedCuisineTypes.italian}` },
    { value: 'mexican', label: `🇲🇽 ${localizedCuisineTypes.mexican}` },
    { value: 'spanish', label: `🇪🇸 ${localizedCuisineTypes.spanish}` },
    { value: 'mediterranean', label: `🫒 ${localizedCuisineTypes.mediterranean}` },
    { value: 'american', label: `🇺🇸 ${localizedCuisineTypes.american}` },
    { value: 'chinese', label: `🇨🇳 ${localizedCuisineTypes.chinese}` },
    { value: 'japanese', label: `🇯🇵 ${localizedCuisineTypes.japanese}` },
    { value: 'indian', label: `🇮🇳 ${localizedCuisineTypes.indian}` },
    { value: 'thai', label: `🇹🇭 ${localizedCuisineTypes.thai}` },
    { value: 'french', label: `🇫🇷 ${localizedCuisineTypes.french}` },
    { value: 'greek', label: `🇬🇷 ${localizedCuisineTypes.greek}` },
    { value: 'korean', label: `🇰🇷 ${localizedCuisineTypes.korean}` },
    { value: 'middle_eastern', label: `🕌 ${localizedCuisineTypes.middle_eastern}` },
    { value: 'other', label: `🌍 ${localizedCuisineTypes.other}` },
  ];

  const dietaryOptions = [
    { value: 'vegetarian', label: `🥬 ${localizedDietaryRestrictions.vegetarian}`, description: t('recipeAI.dietaryRestrictions.vegetarian_desc', 'No meat or fish') },
    { value: 'vegan', label: `🌱 ${localizedDietaryRestrictions.vegan}`, description: t('recipeAI.dietaryRestrictions.vegan_desc', 'No animal products') },
    { value: 'gluten_free', label: `🚫 ${localizedDietaryRestrictions.gluten_free}`, description: t('recipeAI.dietaryRestrictions.gluten_free_desc', 'No gluten-containing ingredients') },
    { value: 'dairy_free', label: `🥛 ${localizedDietaryRestrictions.dairy_free}`, description: t('recipeAI.dietaryRestrictions.dairy_free_desc', 'No milk or dairy products') },
    { value: 'nut_free', label: `🥜 ${localizedDietaryRestrictions.nut_free}`, description: t('recipeAI.dietaryRestrictions.nut_free_desc', 'No nuts or nut products') },
    { value: 'low_carb', label: `📉 ${localizedDietaryRestrictions.low_carb}`, description: t('recipeAI.dietaryRestrictions.low_carb_desc', 'Reduced carbohydrate content') },
    { value: 'low_fat', label: `🍃 ${localizedDietaryRestrictions.low_fat}`, description: t('recipeAI.dietaryRestrictions.low_fat_desc', 'Reduced fat content') },
    { value: 'keto', label: `⚡ ${localizedDietaryRestrictions.keto}`, description: t('recipeAI.dietaryRestrictions.keto_desc', 'Very low carb, high fat') },
    { value: 'paleo', label: `🦕 ${localizedDietaryRestrictions.paleo}`, description: t('recipeAI.dietaryRestrictions.paleo_desc', 'Stone-age inspired ingredients') },
  ];

  const difficultyOptions = [
    { value: 'beginner', label: `👶 ${localizedDifficultyLevels.beginner}`, description: t('recipeAI.difficulty.beginner_desc', '15-30 min, basic techniques') },
    { value: 'intermediate', label: `👨‍🍳 ${localizedDifficultyLevels.intermediate}`, description: t('recipeAI.difficulty.intermediate_desc', '30-60 min, some skills needed') },
    { value: 'advanced', label: `🧑‍🍳 ${localizedDifficultyLevels.advanced}`, description: t('recipeAI.difficulty.advanced_desc', '60+ min, complex techniques') },
  ];

  const specialGoalOptions = [
    { value: 'high_protein', label: t('recipeAI.specialGoals.high_protein', '💪 High Protein'), description: t('recipeAI.specialGoals.high_protein_desc', 'Focus on protein content') },
    { value: 'heart_healthy', label: t('recipeAI.specialGoals.heart_healthy', '❤️ Heart Healthy'), description: t('recipeAI.specialGoals.heart_healthy_desc', 'Low sodium, good fats') },
    { value: 'weight_loss', label: t('recipeAI.specialGoals.weight_loss', '⚖️ Weight Loss'), description: t('recipeAI.specialGoals.weight_loss_desc', 'Lower calorie options') },
    { value: 'muscle_gain', label: t('recipeAI.specialGoals.muscle_gain', '🏋️ Muscle Gain'), description: t('recipeAI.specialGoals.muscle_gain_desc', 'High protein and calories') },
    { value: 'quick_prep', label: t('recipeAI.specialGoals.quick_prep', '⚡ Quick Prep'), description: t('recipeAI.specialGoals.quick_prep_desc', 'Minimal preparation time') },
    { value: 'budget_friendly', label: t('recipeAI.specialGoals.budget_friendly', '💰 Budget Friendly'), description: t('recipeAI.specialGoals.budget_friendly_desc', 'Affordable ingredients') },
  ];

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (preferences.cuisineTypes.length === 0) {
      errors.cuisineTypes = t('recipeAI.validation.selectCuisineType', 'Please select at least one cuisine type');
    }

    if (preferences.targetCalories && (
      isNaN(parseInt(preferences.targetCalories)) ||
      parseInt(preferences.targetCalories) < 100 ||
      parseInt(preferences.targetCalories) > 3000
    )) {
      errors.targetCalories = t('recipeAI.validation.targetCaloriesRange', 'Target calories should be between 100 and 3000');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGenerateRecipe = async () => {
    if (!validateForm()) {
      Alert.alert(
        t('recipeAI.validation.formValidationTitle', '⚠️ Form Validation'),
        t('recipeAI.validation.formValidationMessage', 'Please fix the form errors before generating a recipe.')
      );
      return;
    }

    // Check network connectivity
    if (!networkStatus.isConnected) {
      Alert.alert(
        t('recipeAI.errors.noInternetTitle', '📶 No Internet Connection'),
        t('recipeAI.errors.noInternetMessage', 'Recipe generation requires an internet connection. Please check your network and try again.'),
        [
          { text: t('common.ok', 'OK'), style: 'default' },
          { text: t('common.retry', 'Retry'), style: 'default', onPress: handleGenerateRecipe }
        ]
      );
      return;
    }

    try {
      // Prepare API request from form preferences with language support
      const generationRequest: RecipeGenerationRequest = {
        cuisineTypes: preferences.cuisineTypes,
        dietaryRestrictions: preferences.dietaryRestrictions,
        mealType: 'dinner', // Default, could be made configurable
        difficulty: preferences.difficultyLevel as 'beginner' | 'intermediate' | 'advanced',
        cookingTime: preferences.cookingTime,
        servings: preferences.servings,
        ingredients: preferences.includeIngredients ?
          preferences.includeIngredients.split(',').map(i => i.trim()).filter(i => i.length > 0) :
          undefined,
        allergies: preferences.excludeIngredients ?
          preferences.excludeIngredients.split(',').map(i => i.trim()).filter(i => i.length > 0) :
          undefined,
        nutritionalTargets: preferences.targetCalories ? {
          calories: parseInt(preferences.targetCalories),
        } : undefined,
      };

      // Enhance request with automatic language detection
      const enhancedRequest = enhanceRequestWithLanguage(generationRequest);

      // Call the API through our custom hook with language support
      const response = await generateRecipe(enhancedRequest);

      if (response) {
        Alert.alert(
          t('recipeAI.success.generatedTitle', '🎉 Recipe Generated!'),
          t('recipeAI.success.generatedMessage', `"{{recipeName}}" has been created successfully!`, { recipeName: response.recipe.name })
        );
        setShowSaveOptions(true);
      }
    } catch (error: any) {
      console.error('Recipe generation error:', error);

      let errorMessage = t('recipeAI.errors.defaultError', 'Something went wrong during recipe generation. Please try again.');
      if (error?.code === 'GENERATION_FAILED') {
        errorMessage = t('recipeAI.errors.generationFailed', 'The AI recipe generator is currently unavailable. Please try again later.');
      } else if (error?.code === 'NETWORK_ERROR') {
        errorMessage = t('recipeAI.errors.networkError', 'Network error occurred. Please check your connection and try again.');
      }

      Alert.alert(
        t('recipeAI.errors.generationErrorTitle', '❌ Generation Error'),
        errorMessage
      );
    }
  };

  const handleSaveRecipe = async () => {
    if (data?.recipe) {
      Alert.alert(
        t('recipeAI.save.saveRecipeTitle', '💾 Save Recipe'),
        t('recipeAI.save.saveRecipeMessage', 'Save "{{recipeName}}" to your personal recipe collection?', { recipeName: data.recipe.name }),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('common.save', 'Save'),
            style: 'default',
            onPress: async () => {
              try {
                await saveRecipe(data.recipe, {
                  source: 'generated',
                  collections: ['recently_added'],
                  personalTags: ['AI Generated'],
                  notes: `Generated with preferences: ${preferences.cuisineTypes.join(', ')}`,
                });

                Alert.alert(
                  t('recipeAI.save.savedTitle', '✅ Saved!'),
                  t('recipeAI.save.savedMessage', '"{{recipeName}}" has been saved to your recipe collection!', { recipeName: data.recipe.name })
                );
                setShowSaveOptions(false);
              } catch (error: any) {
                Alert.alert(
                  t('recipeAI.errors.saveErrorTitle', '❌ Save Error'),
                  error.message || t('recipeAI.errors.saveErrorMessage', 'Failed to save recipe')
                );
              }
            }
          },
        ]
      );
    }
  };

  const handleShareRecipe = () => {
    if (data?.recipe) {
      Alert.alert(
        t('recipeAI.share.shareTitle', '🔗 Share Recipe'),
        t('recipeAI.share.comingSoon', 'Recipe sharing will be available in the next update!')
      );
    }
  };

  // Animation effect for progress
  useEffect(() => {
    if (progress) {
      Animated.timing(progressAnimation, {
        toValue: progress.progress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress]);

  // Show results when recipe is generated
  if (data && !isGenerating) {
    return (
      <Container padding="md" scrollable safeArea>
        {/* Header */}
        <Section spacing="sm" noDivider>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Button
              variant="tertiary"
              size="sm"
              onPress={onBackPress}
              title={`← ${t('common.back', 'Back')}`}
            />
            <Text style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.bold,
              color: tokens.colors.text.primary,
              flex: 1,
              textAlign: 'center',
            }}>
              {t('recipeAI.results.title', '✨ Generated Recipe')}
            </Text>
            <RecipeLanguageToggle
              onLanguageChange={handleLanguageChange}
            />
          </View>
        </Section>

        {/* Recipe Preview */}
        <Section spacing="md">
          <Card variant="default" padding="lg">
            <CardHeader>
              <Text style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                textAlign: 'center',
                marginBottom: tokens.spacing.xs,
              }}>
                {data.recipe.name}
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.md,
                color: tokens.colors.text.secondary,
                textAlign: 'center',
                lineHeight: tokens.typography.fontSize.md * tokens.typography.lineHeight.normal,
                marginBottom: tokens.spacing.md,
              }}>
                {data.recipe.description}
              </Text>

              <Grid columns={3} gap="sm">
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.primary[500],
                  }}>
                    ⏱️ {data.recipe.cookingTime}min
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.primary[500],
                  }}>
                    👥 {preferences.servings} {t('recipeAI.results.servings', 'servings')}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.primary[500],
                  }}>
                    📊 {data.recipe.rating.toFixed(1)}★ {t('recipeAI.results.rating', 'rating')}
                  </Text>
                </View>
              </Grid>

              {/* AI Generation Metadata */}
              <View style={{
                backgroundColor: tokens.colors.neutral[50],
                padding: tokens.spacing.sm,
                borderRadius: tokens.borderRadius.md,
                marginTop: tokens.spacing.md,
              }}>
                <Text style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.text.secondary,
                  textAlign: 'center',
                }}>
                  🤖 {t('recipeAI.results.generatedBy', 'Generated by {{model}} in {{time}}s', {
                    model: data.generationMetadata.aiModel,
                    time: data.generationMetadata.processingTime.toFixed(1)
                  })}
                </Text>
                <Text style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.success[600],
                  textAlign: 'center',
                  fontWeight: tokens.typography.fontWeight.semibold,
                  marginTop: tokens.spacing.xs,
                }}>
                  {t('recipeAI.results.confidence', 'Confidence: {{confidence}}%', {
                    confidence: Math.round(data.generationMetadata.confidence * 100)
                  })}
                </Text>
              </View>
            </CardHeader>
          </Card>

          {/* Ingredients */}
          <Card variant="default" padding="md">
            <CardHeader>
              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                marginBottom: tokens.spacing.sm,
              }}>
                {t('recipeAI.results.ingredientsTitle', '🛒 Ingredients')}
              </Text>
            </CardHeader>
            <CardBody>
              {data.recipe.ingredients?.map((ingredient, index) => (
                <View key={index} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: tokens.spacing.xs,
                  borderBottomWidth: index < data.recipe.ingredients.length - 1 ? 1 : 0,
                  borderBottomColor: tokens.colors.neutral[100],
                }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.md,
                    color: tokens.colors.text.primary,
                  }}>
                    {ingredient.amount} {ingredient.unit} {ingredient.name}
                  </Text>
                </View>
              )) || (
                <Text style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.text.secondary,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: tokens.spacing.md,
                }}>
                  {t('recipeAI.results.ingredientsPlaceholder', 'Ingredients will be provided by the AI')}
                </Text>
              )}
            </CardBody>
          </Card>

          {/* Instructions */}
          <Card variant="default" padding="md">
            <CardHeader>
              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                marginBottom: tokens.spacing.sm,
              }}>
                {t('recipeAI.results.instructionsTitle', '👨‍🍳 Instructions')}
              </Text>
            </CardHeader>
            <CardBody>
              {data.recipe.instructions?.map((instruction, index) => (
                <View key={index} style={{
                  flexDirection: 'row',
                  marginBottom: tokens.spacing.sm,
                  alignItems: 'flex-start',
                }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: tokens.colors.primary[100],
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: tokens.spacing.sm,
                  }}>
                    <Text style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.bold,
                      color: tokens.colors.primary[500],
                    }}>
                      {instruction.step}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: tokens.typography.fontSize.md,
                      color: tokens.colors.text.primary,
                      lineHeight: tokens.typography.fontSize.md * tokens.typography.lineHeight.normal,
                    }}>
                      {instruction.instruction}
                    </Text>
                    {instruction.timeMinutes && (
                      <Text style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.warning[600],
                        marginTop: tokens.spacing.xs,
                      }}>
                        ⏱️ {instruction.timeMinutes}min
                      </Text>
                    )}
                  </View>
                </View>
              )) || (
                <Text style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.text.secondary,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: tokens.spacing.md,
                }}>
                  {t('recipeAI.results.instructionsPlaceholder', 'Instructions will be provided by the AI')}
                </Text>
              )}
            </CardBody>
          </Card>

          {/* Nutrition */}
          <Card variant="default" padding="md">
            <CardHeader>
              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                marginBottom: tokens.spacing.sm,
              }}>
                {t('recipeAI.results.nutritionTitle', '📊 Nutrition (per serving)')}
              </Text>
            </CardHeader>
            <CardBody>
              <Grid columns={4} gap="sm">
                <View style={{ alignItems: 'center', padding: tokens.spacing.sm }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.primary[500],
                    marginBottom: tokens.spacing.xs,
                  }}>
                    {data.recipe.calories || t('common.na', 'N/A')}
                  </Text>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {t('recipeAI.results.calories', 'Calories')}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', padding: tokens.spacing.sm }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.primary[500],
                    marginBottom: tokens.spacing.xs,
                  }}>
                    {t('common.estimated', 'Est.')} {Math.round((data.recipe.calories || 0) * 0.3 / 4)}g
                  </Text>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {t('recipeAI.results.protein', 'Protein')}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', padding: tokens.spacing.sm }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.primary[500],
                    marginBottom: tokens.spacing.xs,
                  }}>
                    {t('common.estimated', 'Est.')} {Math.round((data.recipe.calories || 0) * 0.3 / 9)}g
                  </Text>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {t('recipeAI.results.fat', 'Fat')}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', padding: tokens.spacing.sm }}>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: tokens.colors.primary[500],
                    marginBottom: tokens.spacing.xs,
                  }}>
                    {t('common.estimated', 'Est.')} {Math.round((data.recipe.calories || 0) * 0.4 / 4)}g
                  </Text>
                  <Text style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.text.secondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {t('recipeAI.results.carbs', 'Carbs')}
                  </Text>
                </View>
              </Grid>
            </CardBody>
          </Card>

          {/* Action Buttons */}
          <Section spacing="md" noDivider>
            <Button
              variant="primary"
              onPress={() => {
                if (onNavigateToDetail && data?.recipe) {
                  onNavigateToDetail(data.recipe);
                }
              }}
              title={t('recipeAI.actions.viewFullRecipe', '📖 View Full Recipe')}
              style={{ marginBottom: tokens.spacing.sm }}
            />

            <Grid columns={3} gap="sm">
              <Button
                variant="secondary"
                onPress={handleSaveRecipe}
                title={t('recipeAI.actions.save', '💾 Save')}
              />
              <Button
                variant="secondary"
                onPress={handleShareRecipe}
                title={t('recipeAI.actions.share', '🔗 Share')}
              />
              <Button
                variant="secondary"
                onPress={() => {
                  onBackPress();
                }}
                title={t('recipeAI.actions.new', '🔄 New')}
              />
            </Grid>
          </Section>
        </Section>
      </Container>
    );
  }

  return (
    <Container padding="md" scrollable safeArea>
      {/* Header */}
      <Section spacing="sm" noDivider>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Button
            variant="tertiary"
            size="sm"
            onPress={onBackPress}
            title={`← ${t('common.back', 'Back')}`}
          />
          <Text style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.text.primary,
            flex: 1,
            textAlign: 'center',
          }}>
            {t('recipeAI.title', '🤖 Generate Recipe')}
          </Text>
          <RecipeLanguageToggle
            onLanguageChange={handleLanguageChange}
          />
        </View>
      </Section>

      {/* Generation Progress */}
      {isGenerating && (
        <Section spacing="md">
          <Card variant="default" padding="lg">
            <CardBody spacing="md">
              <Text style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.text.primary,
                textAlign: 'center',
                marginBottom: tokens.spacing.xs,
              }}>
                {t('recipeAI.generation.title', '🤖 AI Recipe Generation')}
              </Text>
              <Text style={{
                fontSize: tokens.typography.fontSize.md,
                color: tokens.colors.text.secondary,
                textAlign: 'center',
                marginBottom: tokens.spacing.md,
                minHeight: 20,
              }}>
                {progress?.message || t('recipeAI.generation.initializing', 'Initializing AI recipe generation...')}
              </Text>

              <View style={{
                width: '100%',
                height: 8,
                backgroundColor: tokens.colors.neutral[100],
                borderRadius: tokens.borderRadius.sm,
                overflow: 'hidden',
                marginBottom: tokens.spacing.sm,
              }}>
                <Animated.View
                  style={[
                    {
                      height: '100%',
                      backgroundColor: tokens.colors.primary[500],
                      borderRadius: tokens.borderRadius.sm,
                    },
                    {
                      width: progressAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>

              <Text style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.primary[500],
                textAlign: 'center',
                marginBottom: tokens.spacing.md,
              }}>
                {progress?.progress || 0}%
              </Text>

              {progress?.estimatedTimeRemaining && (
                <Text style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.text.secondary,
                  textAlign: 'center',
                  marginBottom: tokens.spacing.xs,
                }}>
                  {t('recipeAI.generation.estimatedTime', 'Estimated time remaining: {{time}}s', {
                    time: progress.estimatedTimeRemaining
                  })}
                </Text>
              )}

              {progress?.currentStep && (
                <Text style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.primary[500],
                  textAlign: 'center',
                  fontWeight: tokens.typography.fontWeight.medium,
                  marginBottom: tokens.spacing.md,
                }}>
                  {progress.currentStep}
                </Text>
              )}

              <Button
                variant="destructive"
                onPress={cancelGeneration}
                title={t('recipeAI.generation.cancel', 'Cancel Generation')}
              />

              {/* Network Status Indicator */}
              {!networkStatus.isConnected && (
                <View style={{
                  backgroundColor: `${tokens.colors.error[500]}20`,
                  padding: tokens.spacing.sm,
                  borderRadius: tokens.borderRadius.md,
                  marginTop: tokens.spacing.md,
                }}>
                  <Text style={{
                    color: tokens.colors.error[500],
                    fontSize: tokens.typography.fontSize.sm,
                    textAlign: 'center',
                    fontWeight: tokens.typography.fontWeight.semibold,
                  }}>
                    {t('recipeAI.errors.noConnectionWarning', '⚠️ No internet connection - Generation paused')}
                  </Text>
                </View>
              )}
            </CardBody>
          </Card>
        </Section>
      )}

      {/* Recipe Preferences Form */}
      {!isGenerating && (
        <Section spacing="md">
          {/* Cuisine Types */}
          <View style={{ marginBottom: tokens.spacing.md }}>
            <MultiSelect
              title={t('recipeAI.form.cuisineTypes', '🌍 Cuisine Types')}
              options={cuisineOptions}
              selectedValues={preferences.cuisineTypes}
              onSelectionChange={(values) =>
                setPreferences(prev => ({ ...prev, cuisineTypes: values }))
              }
              placeholder={t('recipeAI.form.selectCuisines', 'Select your favorite cuisines')}
            />
            {formErrors.cuisineTypes && (
              <Text style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.error[500],
                marginTop: tokens.spacing.xs,
                marginLeft: tokens.spacing.xs,
              }}>
                {formErrors.cuisineTypes}
              </Text>
            )}
          </View>

          {/* Dietary Restrictions */}
          <View style={{ marginBottom: tokens.spacing.md }}>
            <CheckboxGroup
              title={t('recipeAI.form.dietaryRestrictions', '🥗 Dietary Restrictions')}
              options={dietaryOptions}
              selectedValues={preferences.dietaryRestrictions}
              onSelectionChange={(values) =>
                setPreferences(prev => ({ ...prev, dietaryRestrictions: values }))
              }
            />
          </View>

          {/* Difficulty Level */}
          <View style={{ marginBottom: tokens.spacing.md }}>
            <RadioGroup
              title={t('recipeAI.form.difficulty', '📈 Difficulty Level')}
              options={difficultyOptions}
              selectedValue={preferences.difficultyLevel}
              onSelectionChange={(value) =>
                setPreferences(prev => ({ ...prev, difficultyLevel: value }))
              }
            />
          </View>

          {/* Servings and Cooking Time */}
          <View style={{ marginBottom: tokens.spacing.md }}>
            <Grid columns={2} gap="sm">
              <NumberInput
                title={t('recipeAI.form.servings', '👥 Servings')}
                value={preferences.servings}
                onValueChange={(value) =>
                  setPreferences(prev => ({ ...prev, servings: value }))
                }
                min={1}
                max={12}
              />
              <NumberInput
                title={t('recipeAI.form.maxCookingTime', '⏱️ Max Cooking Time')}
                value={preferences.cookingTime}
                onValueChange={(value) =>
                  setPreferences(prev => ({ ...prev, cookingTime: value }))
                }
                min={15}
                max={180}
                step={15}
                suffix={t('common.minutes', 'min')}
              />
            </Grid>
          </View>

          {/* Target Calories */}
          <View style={{ marginBottom: tokens.spacing.md }}>
            <ValidatedTextInput
              title={t('recipeAI.form.targetCalories', '🎯 Target Calories (per serving)')}
              value={preferences.targetCalories}
              onValueChange={(value) =>
                setPreferences(prev => ({ ...prev, targetCalories: value }))
              }
              placeholder={t('recipeAI.form.caloriesPlaceholder', 'e.g., 400')}
              keyboardType="numeric"
              error={formErrors.targetCalories}
            />
          </View>

          {/* Special Goals */}
          <View style={{ marginBottom: tokens.spacing.md }}>
            <CheckboxGroup
              title={t('recipeAI.form.specialGoals', '🎯 Special Goals')}
              options={specialGoalOptions}
              selectedValues={preferences.specialGoals}
              onSelectionChange={(values) =>
                setPreferences(prev => ({ ...prev, specialGoals: values }))
              }
            />
          </View>

          {/* Include/Exclude Ingredients */}
          <View style={{ marginBottom: tokens.spacing.md }}>
            <ValidatedTextInput
              title={t('recipeAI.form.includeIngredients', '✅ Include Ingredients (optional)')}
              value={preferences.includeIngredients}
              onValueChange={(value) =>
                setPreferences(prev => ({ ...prev, includeIngredients: value }))
              }
              placeholder={t('recipeAI.form.includeIngredientsPlaceholder', 'e.g., chicken, tomatoes, basil')}
            />

            <ValidatedTextInput
              title={t('recipeAI.form.excludeIngredients', '❌ Exclude Ingredients (optional)')}
              value={preferences.excludeIngredients}
              onValueChange={(value) =>
                setPreferences(prev => ({ ...prev, excludeIngredients: value }))
              }
              placeholder={t('recipeAI.form.excludeIngredientsPlaceholder', 'e.g., nuts, shellfish, dairy')}
            />
          </View>

          {/* Generate Button */}
          <Section spacing="md" noDivider>
            <View style={{ alignItems: 'center' }}>
              <Button
                variant="primary"
                onPress={handleGenerateRecipe}
                disabled={preferences.cuisineTypes.length === 0}
                title={t('recipeAI.form.generateButton', '🤖 Generate AI Recipe')}
                style={{ marginBottom: tokens.spacing.sm }}
              />

              <Text style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.text.secondary,
                textAlign: 'center',
                paddingHorizontal: tokens.spacing.md,
              }}>
                {t('recipeAI.form.generateHint', 'Your preferences will be used to create a personalized recipe')}
              </Text>
            </View>
          </Section>
        </Section>
      )}
    </Container>
  );
}