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
import { useRecipeGeneration, usePersonalRecipes, useNetworkStatus } from '../hooks/useApiRecipes';
import { RecipeGenerationRequest } from '../services/RecipeApiService';

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

  // Form options data
  const cuisineOptions = [
    { value: 'italian', label: '🇮🇹 Italian' },
    { value: 'mexican', label: '🇲🇽 Mexican' },
    { value: 'asian', label: '🥢 Asian' },
    { value: 'mediterranean', label: '🫒 Mediterranean' },
    { value: 'american', label: '🇺🇸 American' },
    { value: 'indian', label: '🇮🇳 Indian' },
    { value: 'french', label: '🇫🇷 French' },
    { value: 'thai', label: '🇹🇭 Thai' },
    { value: 'japanese', label: '🇯🇵 Japanese' },
    { value: 'middle_eastern', label: '🕌 Middle Eastern' },
  ];

  const dietaryOptions = [
    { value: 'vegetarian', label: '🥬 Vegetarian', description: 'No meat or fish' },
    { value: 'vegan', label: '🌱 Vegan', description: 'No animal products' },
    { value: 'gluten_free', label: '🚫 Gluten-Free', description: 'No gluten-containing ingredients' },
    { value: 'dairy_free', label: '🥛 Dairy-Free', description: 'No milk or dairy products' },
    { value: 'low_carb', label: '📉 Low-Carb', description: 'Reduced carbohydrate content' },
    { value: 'keto', label: '⚡ Keto', description: 'Very low carb, high fat' },
    { value: 'paleo', label: '🦕 Paleo', description: 'Stone-age inspired ingredients' },
    { value: 'whole30', label: '💯 Whole30', description: 'No processed foods' },
  ];

  const difficultyOptions = [
    { value: 'beginner', label: '👶 Beginner', description: '15-30 min, basic techniques' },
    { value: 'intermediate', label: '👨‍🍳 Intermediate', description: '30-60 min, some skills needed' },
    { value: 'advanced', label: '🧑‍🍳 Advanced', description: '60+ min, complex techniques' },
    { value: 'expert', label: '👨‍💼 Expert', description: 'Professional level cooking' },
  ];

  const specialGoalOptions = [
    { value: 'high_protein', label: '💪 High Protein', description: 'Focus on protein content' },
    { value: 'heart_healthy', label: '❤️ Heart Healthy', description: 'Low sodium, good fats' },
    { value: 'weight_loss', label: '⚖️ Weight Loss', description: 'Lower calorie options' },
    { value: 'muscle_gain', label: '🏋️ Muscle Gain', description: 'High protein and calories' },
    { value: 'quick_prep', label: '⚡ Quick Prep', description: 'Minimal preparation time' },
    { value: 'budget_friendly', label: '💰 Budget Friendly', description: 'Affordable ingredients' },
  ];

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (preferences.cuisineTypes.length === 0) {
      errors.cuisineTypes = 'Please select at least one cuisine type';
    }
    
    if (preferences.targetCalories && (
      isNaN(parseInt(preferences.targetCalories)) || 
      parseInt(preferences.targetCalories) < 100 || 
      parseInt(preferences.targetCalories) > 3000
    )) {
      errors.targetCalories = 'Target calories should be between 100 and 3000';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const simulateRecipeGeneration = async () => {
    const stages = [
      { progress: 25, stage: 'Analyzing your preferences...' },
      { progress: 50, stage: 'Selecting perfect ingredients...' },
      { progress: 75, stage: 'Creating recipe instructions...' },
      { progress: 100, stage: 'Calculating nutrition information...' },
    ];

    for (const { progress, stage } of stages) {
      setGenerationProgress(progress);
      setGenerationStage(stage);
      
      Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 800,
        useNativeDriver: false,
      }).start();

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Generate mock recipe based on preferences
    const mockRecipe: GeneratedRecipe = {
      id: 'generated_' + Date.now(),
      name: `${preferences.cuisineTypes[0]?.charAt(0).toUpperCase() + preferences.cuisineTypes[0]?.slice(1) || 'Delicious'} ${preferences.difficultyLevel === 'beginner' ? 'Simple' : 'Gourmet'} Bowl`,
      description: `A ${preferences.difficultyLevel} ${preferences.cuisineTypes.join(' & ')} recipe perfect for ${preferences.servings} people`,
      cookingTime: preferences.cookingTime,
      servings: preferences.servings,
      difficulty: preferences.difficultyLevel,
      ingredients: [
        { name: 'Olive Oil', quantity: '2', unit: 'tbsp' },
        { name: 'Onion', quantity: '1', unit: 'medium' },
        { name: 'Garlic', quantity: '3', unit: 'cloves' },
        { name: 'Main Protein', quantity: '400', unit: 'g' },
        { name: 'Vegetables', quantity: '300', unit: 'g' },
        { name: 'Herbs & Spices', quantity: '1', unit: 'tsp each' },
      ],
      instructions: [
        { step: 1, instruction: 'Heat olive oil in a large pan over medium heat' },
        { step: 2, instruction: 'Add diced onion and cook until translucent, about 5 minutes' },
        { step: 3, instruction: 'Add minced garlic and cook for 1 minute until fragrant' },
        { step: 4, instruction: 'Add main protein and cook according to type and preference' },
        { step: 5, instruction: 'Add vegetables and seasonings, cook until tender' },
        { step: 6, instruction: 'Adjust seasoning to taste and serve immediately' },
      ],
      nutrition: {
        calories: parseInt(preferences.targetCalories) || 450,
        protein: 28,
        fat: 18,
        carbs: 42,
        score: 0.87,
      },
    };

    setGeneratedRecipe(mockRecipe);
  };

  const handleGenerateRecipe = async () => {
    if (!validateForm()) {
      Alert.alert('⚠️ Form Validation', 'Please fix the form errors before generating a recipe.');
      return;
    }

    // Check network connectivity
    if (!networkStatus.isConnected) {
      Alert.alert(
        '📶 No Internet Connection', 
        'Recipe generation requires an internet connection. Please check your network and try again.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Retry', style: 'default', onPress: handleGenerateRecipe }
        ]
      );
      return;
    }

    try {
      // Prepare API request from form preferences
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

      // Call the API through our custom hook
      const response = await generateRecipe(generationRequest);
      
      if (response) {
        Alert.alert('🎉 Recipe Generated!', `"${response.recipe.name}" has been created successfully!`);
        setShowSaveOptions(true);
      }
    } catch (error: any) {
      console.error('Recipe generation error:', error);
      
      let errorMessage = 'Something went wrong during recipe generation. Please try again.';
      if (error?.code === 'GENERATION_FAILED') {
        errorMessage = 'The AI recipe generator is currently unavailable. Please try again later.';
      } else if (error?.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
      }
      
      Alert.alert('❌ Generation Error', errorMessage);
    }
  };

  const handleSaveRecipe = async () => {
    if (data?.recipe) {
      Alert.alert(
        '💾 Save Recipe',
        `Save "${data.recipe.name}" to your personal recipe collection?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Save', 
            style: 'default', 
            onPress: async () => {
              try {
                await saveRecipe(data.recipe, {
                  source: 'generated',
                  collections: ['recently_added'],
                  personalTags: ['AI Generated'],
                  notes: `Generated with preferences: ${preferences.cuisineTypes.join(', ')}`,
                });
                
                Alert.alert('✅ Saved!', `"${data.recipe.name}" has been saved to your recipe collection!`);
                setShowSaveOptions(false);
              } catch (error: any) {
                Alert.alert('❌ Save Error', error.message || 'Failed to save recipe');
              }
            }
          },
        ]
      );
    }
  };

  const handleShareRecipe = () => {
    if (generatedRecipe) {
      Alert.alert('🔗 Share Recipe', 'Recipe sharing will be available in the next update!');
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
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>✨ Generated Recipe</Text>
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
                <Text style={styles.metricValue}>👥 {preferences.servings} servings</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>📊 {data.recipe.rating.toFixed(1)}★ rating</Text>
              </View>
            </View>
            
            {/* AI Generation Metadata */}
            <View style={styles.aiMetadata}>
              <Text style={styles.aiMetadataText}>
                🤖 Generated by {data.generationMetadata.aiModel} in {data.generationMetadata.processingTime.toFixed(1)}s
              </Text>
              <Text style={styles.confidenceText}>
                Confidence: {Math.round(data.generationMetadata.confidence * 100)}%
              </Text>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>🛒 Ingredients</Text>
            {data.recipe.ingredients?.map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
                <Text style={styles.ingredientText}>
                  {ingredient.amount} {ingredient.unit} {ingredient.name}
                </Text>
              </View>
            )) || (
              <Text style={styles.noDataText}>Ingredients will be provided by the AI</Text>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>👨‍🍳 Instructions</Text>
            {data.recipe.instructions?.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>{instruction.step}</Text>
                <Text style={styles.instructionText}>{instruction.instruction}</Text>
                {instruction.timeMinutes && (
                  <Text style={styles.instructionTime}>⏱️ {instruction.timeMinutes}min</Text>
                )}
              </View>
            )) || (
              <Text style={styles.noDataText}>Instructions will be provided by the AI</Text>
            )}
          </View>

          {/* Nutrition */}
          <View style={styles.recipeSection}>
            <Text style={styles.sectionTitle}>📊 Nutrition (per serving)</Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.calories}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.protein}g</Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.fat}g</Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{generatedRecipe.nutrition.carbs}g</Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => {
              if (onNavigateToDetail && generatedRecipe) {
                onNavigateToDetail(generatedRecipe);
              }
            }}>
              <Text style={styles.primaryButtonText}>📖 View Full Recipe</Text>
            </TouchableOpacity>
            
            <View style={styles.secondaryButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveRecipe}>
                <Text style={styles.secondaryButtonText}>💾 Save</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} onPress={handleShareRecipe}>
                <Text style={styles.secondaryButtonText}>🔗 Share</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} onPress={() => {
                setGeneratedRecipe(null);
                setGenerationProgress(0);
              }}>
                <Text style={styles.secondaryButtonText}>🔄 New</Text>
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
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔧 Generate Recipe</Text>
      </View>

      {/* Generation Progress */}
      {isGenerating && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>🤖 AI Recipe Generation</Text>
          <Text style={styles.progressStage}>
            {progress?.message || 'Initializing AI recipe generation...'}
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
              Estimated time remaining: {progress.estimatedTimeRemaining}s
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
            <Text style={styles.cancelButtonText}>Cancel Generation</Text>
          </TouchableOpacity>

          {/* Network Status Indicator */}
          {!networkStatus.isConnected && (
            <View style={styles.networkWarning}>
              <Text style={styles.networkWarningText}>
                ⚠️ No internet connection - Generation paused
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
              title="🌍 Cuisine Types"
              options={cuisineOptions}
              selectedValues={preferences.cuisineTypes}
              onSelectionChange={(values) => 
                setPreferences(prev => ({ ...prev, cuisineTypes: values }))
              }
              placeholder="Select your favorite cuisines"
            />
            {formErrors.cuisineTypes && (
              <Text style={styles.errorText}>{formErrors.cuisineTypes}</Text>
            )}
          </View>

          {/* Dietary Restrictions */}
          <View style={styles.formSection}>
            <CheckboxGroup
              title="🥗 Dietary Restrictions"
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
              title="📈 Difficulty Level"
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
                  title="👥 Servings"
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
                  title="⏱️ Max Cooking Time"
                  value={preferences.cookingTime}
                  onValueChange={(value) =>
                    setPreferences(prev => ({ ...prev, cookingTime: value }))
                  }
                  min={15}
                  max={180}
                  step={15}
                  suffix="min"
                />
              </View>
            </View>
          </View>

          {/* Target Calories */}
          <View style={styles.formSection}>
            <ValidatedTextInput
              title="🎯 Target Calories (per serving)"
              value={preferences.targetCalories}
              onValueChange={(value) =>
                setPreferences(prev => ({ ...prev, targetCalories: value }))
              }
              placeholder="e.g., 400"
              keyboardType="numeric"
              error={formErrors.targetCalories}
            />
          </View>

          {/* Special Goals */}
          <View style={styles.formSection}>
            <CheckboxGroup
              title="🎯 Special Goals"
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
              title="✅ Include Ingredients (optional)"
              value={preferences.includeIngredients}
              onValueChange={(value) =>
                setPreferences(prev => ({ ...prev, includeIngredients: value }))
              }
              placeholder="e.g., chicken, tomatoes, basil"
            />
            
            <ValidatedTextInput
              title="❌ Exclude Ingredients (optional)"
              value={preferences.excludeIngredients}
              onValueChange={(value) =>
                setPreferences(prev => ({ ...prev, excludeIngredients: value }))
              }
              placeholder="e.g., nuts, shellfish, dairy"
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
                🤖 Generate AI Recipe
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.generateHint}>
              Your preferences will be used to create a personalized recipe
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