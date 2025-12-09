import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Text style={styles.backButtonText}>← {t('common.back', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('recipeAI.results.title', '✨ Generated Recipe')}</Text>
          <RecipeLanguageToggle
            style={styles.languageToggle}
            onLanguageChange={handleLanguageChange}
          />
        </View>

        {/* Recipe Preview */}
        <View style={styles.recipeContainer}>
          <View style={styles.recipeHeader}>
            <Text style={styles.recipeName}>{data.recipe.name}</Text>
            <Text style={styles.recipeDescription}>{data.recipe.description}</Text>
            
            <View style={styles.recipeMetrics}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>⏱️ {data.recipe.cookingTime}min</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>👥 {preferences.servings} {t('recipeAI.results.servings', 'servings')}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>📊 {data.recipe.rating.toFixed(1)}★ {t('recipeAI.results.rating', 'rating')}</Text>
              </View>
            </View>
            
            {/* AI Generation Metadata */}
            <View style={styles.aiMetadata}>
              <Text style={styles.aiMetadataText}>
                🤖 {t('recipeAI.results.generatedBy', 'Generated by {{model}} in {{time}}s', {
                  model: data.generationMetadata.aiModel,
                  time: data.generationMetadata.processingTime.toFixed(1)
                })}
              </Text>
              <Text style={styles.confidenceText}>
                {t('recipeAI.results.confidence', 'Confidence: {{confidence}}%', {
                  confidence: Math.round(data.generationMetadata.confidence * 100)
                })}
              </Text>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>{t('recipeAI.results.ingredientsTitle', '🛒 Ingredients')}</Text>
            {data.recipe.ingredients?.map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
                <Text style={styles.ingredientText}>
                  {ingredient.amount} {ingredient.unit} {ingredient.name}
                </Text>
              </View>
            )) || (
              <Text style={styles.noDataText}>{t('recipeAI.results.ingredientsPlaceholder', 'Ingredients will be provided by the AI')}</Text>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>{t('recipeAI.results.instructionsTitle', '👨‍🍳 Instructions')}</Text>
            {data.recipe.instructions?.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>{instruction.step}</Text>
                <Text style={styles.instructionText}>{instruction.instruction}</Text>
                {instruction.timeMinutes && (
                  <Text style={styles.instructionTime}>⏱️ {instruction.timeMinutes}min</Text>
                )}
              </View>
            )) || (
              <Text style={styles.noDataText}>{t('recipeAI.results.instructionsPlaceholder', 'Instructions will be provided by the AI')}</Text>
            )}
          </View>

          {/* Nutrition */}
          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>{t('recipeAI.results.nutritionTitle', '📊 Nutrition (per serving)')}</Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{data.recipe.calories || t('common.na', 'N/A')}</Text>
                <Text style={styles.nutritionLabel}>{t('recipeAI.results.calories', 'Calories')}</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{t('common.estimated', 'Est.')} {Math.round((data.recipe.calories || 0) * 0.3 / 4)}g</Text>
                <Text style={styles.nutritionLabel}>{t('recipeAI.results.protein', 'Protein')}</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{t('common.estimated', 'Est.')} {Math.round((data.recipe.calories || 0) * 0.3 / 9)}g</Text>
                <Text style={styles.nutritionLabel}>{t('recipeAI.results.fat', 'Fat')}</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{t('common.estimated', 'Est.')} {Math.round((data.recipe.calories || 0) * 0.4 / 4)}g</Text>
                <Text style={styles.nutritionLabel}>{t('recipeAI.results.carbs', 'Carbs')}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => {
              if (onNavigateToDetail && data?.recipe) {
                onNavigateToDetail(data.recipe);
              }
            }}>
              <Text style={styles.primaryButtonText}>{t('recipeAI.actions.viewFullRecipe', '📖 View Full Recipe')}</Text>
            </TouchableOpacity>
            
            <View style={styles.secondaryButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveRecipe}>
                <Text style={styles.secondaryButtonText}>{t('recipeAI.actions.save', '💾 Save')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleShareRecipe}>
                <Text style={styles.secondaryButtonText}>{t('recipeAI.actions.share', '🔗 Share')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => {
                onBackPress();
              }}>
                <Text style={styles.secondaryButtonText}>{t('recipeAI.actions.new', '🔄 New')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>← {t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('recipeAI.title', '🤖 Generate Recipe')}</Text>
        <RecipeLanguageToggle
          style={styles.languageToggle}
          onLanguageChange={handleLanguageChange}
        />
      </View>

      {/* Generation Progress */}
      {isGenerating && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>{t('recipeAI.generation.title', '🤖 AI Recipe Generation')}</Text>
          <Text style={styles.progressStage}>
            {progress?.message || t('recipeAI.generation.initializing', 'Initializing AI recipe generation...')}
          </Text>
          
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]} 
            />
          </View>
          
          <Text style={styles.progressPercent}>
            {progress?.progress || 0}%
          </Text>
          
          {progress?.estimatedTimeRemaining && (
            <Text style={styles.estimatedTime}>
              {t('recipeAI.generation.estimatedTime', 'Estimated time remaining: {{time}}s', {
                time: progress.estimatedTimeRemaining
              })}
            </Text>
          )}
          
          {progress?.currentStep && (
            <Text style={styles.currentStep}>
              {progress.currentStep}
            </Text>
          )}
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelGeneration}
          >
            <Text style={styles.cancelButtonText}>{t('recipeAI.generation.cancel', 'Cancel Generation')}</Text>
          </TouchableOpacity>

          {/* Network Status Indicator */}
          {!networkStatus.isConnected && (
            <View style={styles.networkWarning}>
              <Text style={styles.networkWarningText}>
                {t('recipeAI.errors.noConnectionWarning', '⚠️ No internet connection - Generation paused')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Recipe Preferences Form */}
      {!isGenerating && (
        <View style={styles.formContainer}>
          {/* Cuisine Types */}
          <View style={styles.formSection}>
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
              <Text style={styles.errorText}>{formErrors.cuisineTypes}</Text>
            )}
          </View>

          {/* Dietary Restrictions */}
          <View style={styles.formSection}>
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
          <View style={styles.formSection}>
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
          <View style={styles.formSection}>
            <View style={styles.numberInputRow}>
              <View style={styles.numberInputHalf}>
                <NumberInput
                  title={t('recipeAI.form.servings', '👥 Servings')}
                  value={preferences.servings}
                  onValueChange={(value) =>
                    setPreferences(prev => ({ ...prev, servings: value }))
                  }
                  min={1}
                  max={12}
                />
              </View>
              
              <View style={styles.numberInputHalf}>
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
              </View>
            </View>
          </View>

          {/* Target Calories */}
          <View style={styles.formSection}>
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
          <View style={styles.formSection}>
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
          <View style={styles.formSection}>
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
          <View style={styles.generateSection}>
            <TouchableOpacity 
              style={[
                styles.generateButton,
                preferences.cuisineTypes.length === 0 && styles.generateButtonDisabled
              ]}
              onPress={handleGenerateRecipe}
              disabled={preferences.cuisineTypes.length === 0}
            >
              <Text style={[
                styles.generateButtonText,
                preferences.cuisineTypes.length === 0 && styles.generateButtonTextDisabled
              ]}>
                {t('recipeAI.form.generateButton', '🤖 Generate AI Recipe')}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.generateHint}>
              {t('recipeAI.form.generateHint', 'Your preferences will be used to create a personalized recipe')}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  
  // Header Styles
  header: {
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
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    flex: 1,
  },
  languageToggle: {
    marginLeft: 8,
  },

  // Progress Styles
  progressContainer: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  progressStage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
    minHeight: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 20,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Form Styles
  formContainer: {
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  numberInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  numberInputHalf: {
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },

  // Generate Button Styles
  generateSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  generateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  generateButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  generateButtonTextDisabled: {
    color: '#8E8E93',
  },
  generateHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Recipe Preview Styles
  recipeContainer: {
    margin: 16,
  },
  recipeHeader: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recipeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  recipeDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  recipeMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },

  // Recipe Section Styles
  recipeSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 12,
  },

  // Ingredients Styles
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  ingredientText: {
    fontSize: 16,
    color: '#1C1C1E',
  },

  // Instructions Styles
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: '#F0F8FF',
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12,
    overflow: 'hidden',
  },
  instructionText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
    flex: 1,
  },

  // Nutrition Styles
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
    padding: 12,
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Action Button Styles
  actionButtons: {
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#34C759',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 0, // Allow buttons to shrink
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  estimatedTime: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  currentStep: {
    fontSize: 13,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  networkWarning: {
    backgroundColor: '#FF3B3020',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  networkWarningText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  aiMetadata: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  aiMetadataText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  confidenceText: {
    fontSize: 13,
    color: '#34C759',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
  noDataText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  instructionTime: {
    fontSize: 11,
    color: '#FF9500',
    marginTop: 4,
  },
});