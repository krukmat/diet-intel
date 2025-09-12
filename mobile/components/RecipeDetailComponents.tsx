import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';

// Enhanced Recipe Header with Hero Section
interface RecipeHeaderProps {
  recipe: {
    name: string;
    description: string;
    cookingTime: number;
    servings: number;
    difficulty: string;
    rating?: number;
    totalRatings?: number;
    cuisineType?: string;
    tags?: string[];
  };
  onShare: () => void;
  onSave: () => void;
  onOptimize: () => void;
  onGenerateShoppingList: () => void;
  isFavorited: boolean;
}

export const RecipeHeader: React.FC<RecipeHeaderProps> = ({
  recipe,
  onShare,
  onSave,
  onOptimize,
  onGenerateShoppingList,
  isFavorited,
}) => {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return '#34C759';
      case 'intermediate': return '#FF9500';
      case 'advanced': return '#FF3B30';
      case 'expert': return '#AF52DE';
      default: return '#8E8E93';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Text key={i} style={styles.star}>
        {i < Math.floor(rating) ? '⭐' : '☆'}
      </Text>
    ));
  };

  return (
    <View style={styles.recipeHeader}>
      {/* Hero Image Placeholder */}
      <View style={styles.heroImageContainer}>
        <View style={[styles.heroImage, { backgroundColor: getDifficultyColor(recipe.difficulty) }]}>
          <Text style={styles.heroImageText}>🍳</Text>
        </View>
        
        {/* Floating Action Buttons */}
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.heroActionButton} onPress={onSave}>
            <Text style={styles.heroActionText}>{isFavorited ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroActionButton} onPress={onShare}>
            <Text style={styles.heroActionText}>🔗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recipe Info */}
      <View style={styles.recipeInfo}>
        <Text style={styles.recipeName}>{recipe.name}</Text>
        <Text style={styles.recipeDescription}>{recipe.description}</Text>
        
        {/* Rating */}
        {recipe.rating && (
          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {renderStars(recipe.rating)}
            </View>
            <Text style={styles.ratingText}>
              {recipe.rating.toFixed(1)} ({recipe.totalRatings || 0} reviews)
            </Text>
          </View>
        )}

        {/* Quick Metrics */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <Text style={styles.metricIcon}>⏱️</Text>
            <Text style={styles.metricValue}>{recipe.cookingTime}min</Text>
            <Text style={styles.metricLabel}>Cook Time</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricIcon}>👥</Text>
            <Text style={styles.metricValue}>{recipe.servings}</Text>
            <Text style={styles.metricLabel}>Servings</Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricIcon}>📊</Text>
            <Text style={[styles.metricValue, { color: getDifficultyColor(recipe.difficulty) }]}>
              {recipe.difficulty}
            </Text>
            <Text style={styles.metricLabel}>Difficulty</Text>
          </View>
        </View>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {recipe.tags.slice(0, 4).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {recipe.tags.length > 4 && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>+{recipe.tags.length - 4}</Text>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.primaryActionButton} onPress={onGenerateShoppingList}>
            <Text style={styles.primaryActionText}>🛒 Shopping List</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryActionButton} onPress={onOptimize}>
            <Text style={styles.secondaryActionText}>⚡ Optimize</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Interactive Ingredients Section with Scaling
interface InteractiveIngredientsProps {
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    category?: string;
  }>;
  originalServings: number;
  onServingsChange: (servings: number) => void;
  onIngredientToggle: (index: number, checked: boolean) => void;
  checkedIngredients: boolean[];
}

export const InteractiveIngredients: React.FC<InteractiveIngredientsProps> = ({
  ingredients,
  originalServings,
  onServingsChange,
  onIngredientToggle,
  checkedIngredients,
}) => {
  const [currentServings, setCurrentServings] = useState(originalServings);

  const adjustServings = (newServings: number) => {
    if (newServings >= 1 && newServings <= 20) {
      setCurrentServings(newServings);
      onServingsChange(newServings);
    }
  };

  const scaleIngredient = (quantity: number) => {
    const scaledQuantity = (quantity * currentServings) / originalServings;
    return scaledQuantity % 1 === 0 ? scaledQuantity.toString() : scaledQuantity.toFixed(2);
  };

  // Group ingredients by category
  const groupedIngredients = ingredients.reduce((groups, ingredient, index) => {
    const category = ingredient.category || 'Main Ingredients';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({ ...ingredient, originalIndex: index });
    return groups;
  }, {} as Record<string, any[]>);

  return (
    <View style={styles.ingredientsContainer}>
      {/* Servings Adjuster */}
      <View style={styles.servingsAdjuster}>
        <Text style={styles.sectionTitle}>🛒 Ingredients</Text>
        <View style={styles.servingsControls}>
          <TouchableOpacity
            style={[styles.servingsButton, currentServings <= 1 && styles.servingsButtonDisabled]}
            onPress={() => adjustServings(currentServings - 1)}
            disabled={currentServings <= 1}
          >
            <Text style={[styles.servingsButtonText, currentServings <= 1 && styles.servingsButtonTextDisabled]}>−</Text>
          </TouchableOpacity>
          
          <View style={styles.servingsDisplay}>
            <Text style={styles.servingsValue}>{currentServings}</Text>
            <Text style={styles.servingsLabel}>servings</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.servingsButton, currentServings >= 20 && styles.servingsButtonDisabled]}
            onPress={() => adjustServings(currentServings + 1)}
            disabled={currentServings >= 20}
          >
            <Text style={[styles.servingsButtonText, currentServings >= 20 && styles.servingsButtonTextDisabled]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ingredient Categories */}
      {Object.entries(groupedIngredients).map(([category, categoryIngredients]) => (
        <View key={category} style={styles.ingredientCategory}>
          <Text style={styles.categoryTitle}>{category}</Text>
          
          {categoryIngredients.map((ingredient, categoryIndex) => {
            const originalIndex = ingredient.originalIndex;
            const isChecked = checkedIngredients[originalIndex] || false;
            
            return (
              <TouchableOpacity
                key={categoryIndex}
                style={[styles.ingredientItem, isChecked && styles.ingredientItemChecked]}
                onPress={() => onIngredientToggle(originalIndex, !isChecked)}
              >
                <View style={styles.ingredientCheckbox}>
                  <Text style={styles.checkboxIcon}>{isChecked ? '✅' : '⬜'}</Text>
                </View>
                
                <View style={styles.ingredientInfo}>
                  <Text style={[styles.ingredientText, isChecked && styles.ingredientTextChecked]}>
                    <Text style={styles.ingredientQuantity}>
                      {scaleIngredient(ingredient.quantity)} {ingredient.unit}
                    </Text>
                    {' '}
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                  </Text>
                </View>
                
                <TouchableOpacity style={styles.substitutionButton}>
                  <Text style={styles.substitutionText}>🔄</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Shopping List Actions */}
      <View style={styles.shoppingActions}>
        <TouchableOpacity style={styles.shoppingActionButton}>
          <Text style={styles.shoppingActionText}>📝 Add Missing to Shopping List</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Enhanced Step-by-Step Instructions with Cooking Mode
interface InstructionsProps {
  instructions: Array<{
    step: number;
    instruction: string;
    timeMinutes?: number;
    temperature?: string;
  }>;
  onStartCookingMode: () => void;
  completedSteps: boolean[];
  onStepComplete: (stepIndex: number, completed: boolean) => void;
}

export const Instructions: React.FC<InstructionsProps> = ({
  instructions,
  onStartCookingMode,
  completedSteps,
  onStepComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <View style={styles.instructionsContainer}>
      {/* Instructions Header */}
      <View style={styles.instructionsHeader}>
        <Text style={styles.sectionTitle}>👨‍🍳 Instructions</Text>
        <TouchableOpacity style={styles.cookingModeButton} onPress={onStartCookingMode}>
          <Text style={styles.cookingModeText}>🔥 Cooking Mode</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(completedSteps.filter(Boolean).length / instructions.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {completedSteps.filter(Boolean).length} of {instructions.length} steps completed
        </Text>
      </View>

      {/* Instruction Steps */}
      {instructions.map((instruction, index) => {
        const isCompleted = completedSteps[index] || false;
        const isActive = index === activeStep;

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.instructionStep,
              isCompleted && styles.instructionStepCompleted,
              isActive && styles.instructionStepActive,
            ]}
            onPress={() => setActiveStep(index)}
          >
            <TouchableOpacity
              style={styles.stepCheckbox}
              onPress={() => onStepComplete(index, !isCompleted)}
            >
              <View style={[styles.stepNumber, isCompleted && styles.stepNumberCompleted]}>
                <Text style={[styles.stepNumberText, isCompleted && styles.stepNumberTextCompleted]}>
                  {isCompleted ? '✓' : instruction.step}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.stepContent}>
              <Text style={[styles.stepText, isCompleted && styles.stepTextCompleted]}>
                {instruction.instruction}
              </Text>
              
              {(instruction.timeMinutes || instruction.temperature) && (
                <View style={styles.stepMeta}>
                  {instruction.timeMinutes && (
                    <View style={styles.stepMetaItem}>
                      <Text style={styles.stepMetaText}>⏱️ {instruction.timeMinutes} min</Text>
                    </View>
                  )}
                  {instruction.temperature && (
                    <View style={styles.stepMetaItem}>
                      <Text style={styles.stepMetaText}>🌡️ {instruction.temperature}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {instruction.timeMinutes && (
              <TouchableOpacity style={styles.timerButton}>
                <Text style={styles.timerButtonText}>⏰</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Enhanced Nutrition Display with Visual Charts
interface NutritionDisplayProps {
  nutrition: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    score?: number;
  };
  servings: number;
}

export const NutritionDisplay: React.FC<NutritionDisplayProps> = ({
  nutrition,
  servings,
}) => {
  const totalCalories = nutrition.calories * servings;
  const proteinCalories = nutrition.protein * 4;
  const fatCalories = nutrition.fat * 9;
  const carbCalories = nutrition.carbs * 4;
  
  const proteinPercent = (proteinCalories / nutrition.calories) * 100;
  const fatPercent = (fatCalories / nutrition.calories) * 100;
  const carbPercent = (carbCalories / nutrition.calories) * 100;

  const MacroChart: React.FC<{ percent: number; color: string; label: string }> = ({ percent, color, label }) => (
    <View style={styles.macroChart}>
      <View style={styles.macroCircleContainer}>
        <View style={[styles.macroCircle, { borderColor: color }]}>
          <Text style={[styles.macroPercent, { color }]}>{Math.round(percent)}%</Text>
        </View>
      </View>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.nutritionContainer}>
      <Text style={styles.sectionTitle}>📊 Nutrition Facts</Text>
      
      {/* Calories Summary */}
      <View style={styles.caloriesSummary}>
        <View style={styles.caloriesMain}>
          <Text style={styles.caloriesValue}>{nutrition.calories}</Text>
          <Text style={styles.caloriesLabel}>calories per serving</Text>
        </View>
        
        {nutrition.score && (
          <View style={styles.nutritionScore}>
            <Text style={styles.scoreValue}>{Math.round(nutrition.score * 100)}%</Text>
            <Text style={styles.scoreLabel}>nutrition score</Text>
          </View>
        )}
      </View>

      {/* Macro Charts */}
      <View style={styles.macroChartsContainer}>
        <MacroChart percent={proteinPercent} color="#007AFF" label="Protein" />
        <MacroChart percent={fatPercent} color="#FF9500" label="Fat" />
        <MacroChart percent={carbPercent} color="#34C759" label="Carbs" />
      </View>

      {/* Detailed Breakdown */}
      <View style={styles.nutritionDetails}>
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>Protein</Text>
          <Text style={styles.nutritionValue}>{nutrition.protein}g</Text>
        </View>
        
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>Fat</Text>
          <Text style={styles.nutritionValue}>{nutrition.fat}g</Text>
        </View>
        
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>Carbohydrates</Text>
          <Text style={styles.nutritionValue}>{nutrition.carbs}g</Text>
        </View>
        
        {nutrition.fiber && (
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Fiber</Text>
            <Text style={styles.nutritionValue}>{nutrition.fiber}g</Text>
          </View>
        )}
        
        {nutrition.sugar && (
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Sugar</Text>
            <Text style={styles.nutritionValue}>{nutrition.sugar}g</Text>
          </View>
        )}
        
        {nutrition.sodium && (
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Sodium</Text>
            <Text style={styles.nutritionValue}>{nutrition.sodium}mg</Text>
          </View>
        )}
      </View>

      {/* Daily Values */}
      <View style={styles.dailyValues}>
        <Text style={styles.dailyValuesTitle}>% Daily Value*</Text>
        <Text style={styles.dailyValuesNote}>
          *Based on a 2000 calorie diet. Your daily values may be higher or lower.
        </Text>
      </View>
    </View>
  );
};

// Rating and Review System
interface RatingSystemProps {
  currentRating: number;
  totalRatings: number;
  userRating?: number;
  onRatingSubmit: (rating: number, review?: string) => void;
}

export const RatingSystem: React.FC<RatingSystemProps> = ({
  currentRating,
  totalRatings,
  userRating,
  onRatingSubmit,
}) => {
  const [selectedRating, setSelectedRating] = useState(userRating || 0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewText, setReviewText] = useState('');

  const handleStarPress = (rating: number) => {
    setSelectedRating(rating);
    if (userRating) {
      // User has already rated, submit immediately
      onRatingSubmit(rating);
    } else {
      // New rating, show review modal
      setShowReviewModal(true);
    }
  };

  const submitReview = () => {
    onRatingSubmit(selectedRating, reviewText);
    setShowReviewModal(false);
    setReviewText('');
  };

  return (
    <View style={styles.ratingSystemContainer}>
      <Text style={styles.sectionTitle}>⭐ Rate This Recipe</Text>
      
      {/* Current Rating Display */}
      <View style={styles.currentRating}>
        <Text style={styles.currentRatingValue}>{currentRating.toFixed(1)}</Text>
        <View style={styles.currentStars}>
          {Array.from({ length: 5 }, (_, i) => (
            <Text key={i} style={styles.currentStar}>
              {i < Math.floor(currentRating) ? '⭐' : '☆'}
            </Text>
          ))}
        </View>
        <Text style={styles.totalRatings}>({totalRatings} reviews)</Text>
      </View>

      {/* User Rating Interface */}
      <View style={styles.userRating}>
        <Text style={styles.userRatingLabel}>
          {userRating ? 'Your Rating:' : 'Rate this recipe:'}
        </Text>
        <View style={styles.userStars}>
          {Array.from({ length: 5 }, (_, i) => (
            <TouchableOpacity key={i} onPress={() => handleStarPress(i + 1)}>
              <Text style={[styles.userStar, selectedRating > i && styles.userStarSelected]}>
                ⭐
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.reviewModalOverlay}>
          <View style={styles.reviewModal}>
            <Text style={styles.reviewModalTitle}>Add a Review</Text>
            
            <View style={styles.reviewStars}>
              {Array.from({ length: 5 }, (_, i) => (
                <Text key={i} style={[styles.reviewStar, selectedRating > i && styles.reviewStarSelected]}>
                  ⭐
                </Text>
              ))}
            </View>

            <TextInput
              style={styles.reviewTextInput}
              placeholder="Share your experience with this recipe..."
              multiline
              numberOfLines={4}
              value={reviewText}
              onChangeText={setReviewText}
              textAlignVertical="top"
            />

            <View style={styles.reviewModalButtons}>
              <TouchableOpacity
                style={styles.reviewModalCancel}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.reviewModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.reviewModalSubmit}
                onPress={submitReview}
              >
                <Text style={styles.reviewModalSubmitText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // Recipe Header Styles
  recipeHeader: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  heroImageContainer: {
    position: 'relative',
    height: 200,
  },
  heroImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroImageText: {
    fontSize: 48,
    opacity: 0.8,
  },
  heroActions: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  heroActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroActionText: {
    fontSize: 20,
  },
  recipeInfo: {
    padding: 20,
  },
  recipeName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 22,
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 16,
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F2F2F7',
    marginBottom: 16,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Interactive Ingredients Styles
  ingredientsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  servingsAdjuster: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  servingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    overflow: 'hidden',
  },
  servingsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
  },
  servingsButtonDisabled: {
    opacity: 0.3,
  },
  servingsButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  servingsButtonTextDisabled: {
    color: '#8E8E93',
  },
  servingsDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    minWidth: 80,
    alignItems: 'center',
  },
  servingsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  servingsLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  ingredientCategory: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  ingredientItemChecked: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  ingredientCheckbox: {
    marginRight: 12,
  },
  checkboxIcon: {
    fontSize: 20,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  ingredientTextChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  ingredientQuantity: {
    fontWeight: '600',
    color: '#007AFF',
  },
  ingredientName: {
    color: '#1C1C1E',
  },
  substitutionButton: {
    padding: 8,
  },
  substitutionText: {
    fontSize: 16,
    opacity: 0.6,
  },
  shoppingActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  shoppingActionButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  shoppingActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Instructions Styles
  instructionsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cookingModeButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cookingModeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  instructionStepCompleted: {
    opacity: 0.6,
  },
  instructionStepActive: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  stepCheckbox: {
    marginRight: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberCompleted: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  stepNumberTextCompleted: {
    color: 'white',
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
    marginBottom: 8,
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
  },
  stepMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  stepMetaItem: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  stepMetaText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  timerButton: {
    padding: 8,
    marginLeft: 8,
  },
  timerButtonText: {
    fontSize: 20,
  },

  // Nutrition Display Styles
  nutritionContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  caloriesSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  caloriesMain: {
    alignItems: 'center',
  },
  caloriesValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  caloriesLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  nutritionScore: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  macroChartsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  macroChart: {
    alignItems: 'center',
  },
  macroCircleContainer: {
    marginBottom: 8,
  },
  macroCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroPercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  macroLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  nutritionDetails: {
    gap: 12,
    marginBottom: 16,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  nutritionLabel: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  dailyValues: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 16,
  },
  dailyValuesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  dailyValuesNote: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },

  // Rating System Styles
  ratingSystemContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentRating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  currentRatingValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginRight: 16,
  },
  currentStars: {
    flexDirection: 'row',
    marginRight: 12,
  },
  currentStar: {
    fontSize: 20,
    marginRight: 2,
  },
  totalRatings: {
    fontSize: 14,
    color: '#8E8E93',
  },
  userRating: {
    alignItems: 'center',
  },
  userRatingLabel: {
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 12,
  },
  userStars: {
    flexDirection: 'row',
    gap: 8,
  },
  userStar: {
    fontSize: 32,
    opacity: 0.3,
  },
  userStarSelected: {
    opacity: 1,
  },

  // Review Modal Styles
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  reviewModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  reviewModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 16,
  },
  reviewStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  reviewStar: {
    fontSize: 32,
    opacity: 0.3,
  },
  reviewStarSelected: {
    opacity: 1,
  },
  reviewTextInput: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1C1C1E',
    minHeight: 100,
    marginBottom: 20,
  },
  reviewModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewModalCancel: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewModalCancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  reviewModalSubmit: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewModalSubmitText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});