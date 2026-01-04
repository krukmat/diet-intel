import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import type { BaseRecipe } from '../types/RecipeTypes';

const { width: screenWidth } = Dimensions.get('window');

// Advanced Search Bar with Voice Search
interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onVoiceSearch: () => void;
  onCameraSearch: () => void;
  suggestions: string[];
  searchHistory: string[];
  onSuggestionSelect: (suggestion: string) => void;
  loading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  onVoiceSearch,
  onCameraSearch,
  suggestions,
  searchHistory,
  onSuggestionSelect,
  loading,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const handleInputFocus = () => {
    setInputFocused(true);
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    // Delay hiding suggestions to allow for suggestion selection
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const displaySuggestions = searchQuery.length > 0 ? suggestions : searchHistory.slice(0, 5);

  return (
    <View style={styles.searchContainer}>
      <View style={[styles.searchBar, inputFocused && styles.searchBarFocused]}>
        <Text style={styles.searchIcon}>🔍</Text>
        
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          value={searchQuery}
          onChangeText={onSearchChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholderTextColor="#8E8E93"
          autoCorrect={false}
          autoCapitalize="none"
        />

        {loading && (
          <View style={styles.loadingIndicator}>
            <Text style={styles.loadingText}>⏳</Text>
          </View>
        )}

        <TouchableOpacity style={styles.voiceButton} onPress={onVoiceSearch}>
          <Text style={styles.voiceIcon}>🎤</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cameraButton} onPress={onCameraSearch}>
          <Text style={styles.cameraIcon}>📷</Text>
        </TouchableOpacity>
      </View>

      {/* Search Suggestions */}
      {showSuggestions && displaySuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>
            {searchQuery.length > 0 ? 'Suggestions' : 'Recent Searches'}
          </Text>
          {displaySuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => {
                onSuggestionSelect(suggestion);
                setShowSuggestions(false);
              }}
            >
              <Text style={styles.suggestionIcon}>
                {searchQuery.length > 0 ? '🔍' : '⏱️'}
              </Text>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Quick Filter Chips
interface QuickFiltersProps {
  activeFilters: Record<string, any>;
  onFilterRemove: (filterKey: string) => void;
  onClearAll: () => void;
  quickFilterOptions: Array<{
    key: string;
    label: string;
    value: any;
  }>;
  onQuickFilterSelect: (key: string, value: any) => void;
}

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  activeFilters,
  onFilterRemove,
  onClearAll,
  quickFilterOptions,
  onQuickFilterSelect,
}) => {
  const activeFilterCount = Object.keys(activeFilters).filter(key => {
    const value = activeFilters[key];
    return value && (Array.isArray(value) ? value.length > 0 : true);
  }).length;

  const renderActiveFilterChip = (key: string, value: any) => {
    let displayText = '';
    
    if (Array.isArray(value) && value.length > 0) {
      displayText = value.length === 1 ? value[0] : `${value[0]} +${value.length - 1}`;
    } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
      displayText = `${value.min}-${value.max}`;
    } else if (value) {
      displayText = value.toString();
    }

    if (!displayText) return null;

    return (
      <View key={key} style={styles.filterChip}>
        <Text style={styles.filterChipText}>{displayText}</Text>
        <TouchableOpacity onPress={() => onFilterRemove(key)}>
          <Text style={styles.filterChipRemove}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.quickFiltersContainer}>
      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsScroll}>
            {Object.entries(activeFilters).map(([key, value]) => 
              renderActiveFilterChip(key, value)
            )}
          </ScrollView>
          
          {activeFilterCount > 1 && (
            <TouchableOpacity style={styles.clearAllButton} onPress={onClearAll}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Quick Filter Options */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickFilterScroll}>
        {quickFilterOptions.map((option) => {
          const isActive = activeFilters[option.key] === option.value;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.quickFilterButton, isActive && styles.quickFilterButtonActive]}
              onPress={() => onQuickFilterSelect(option.key, option.value)}
            >
              <Text style={[styles.quickFilterText, isActive && styles.quickFilterTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Comprehensive Filter Modal
interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const updateFilter = (key: string, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onApplyFilters();
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({});
    onClearFilters();
  };

  const cuisineOptions = [
    { value: 'italian', label: '🇮🇹 Italian' },
    { value: 'mexican', label: '🇲🇽 Mexican' },
    { value: 'asian', label: '🥢 Asian' },
    { value: 'mediterranean', label: '🫒 Mediterranean' },
    { value: 'american', label: '🇺🇸 American' },
    { value: 'indian', label: '🇮🇳 Indian' },
    { value: 'french', label: '🇫🇷 French' },
    { value: 'thai', label: '🇹🇭 Thai' },
  ];

  const dietaryOptions = [
    { value: 'vegetarian', label: '🥬 Vegetarian' },
    { value: 'vegan', label: '🌱 Vegan' },
    { value: 'gluten_free', label: '🚫 Gluten-Free' },
    { value: 'dairy_free', label: '🥛 Dairy-Free' },
    { value: 'keto', label: '⚡ Keto' },
    { value: 'paleo', label: '🦕 Paleo' },
  ];

  const mealTypeOptions = [
    { value: 'breakfast', label: '🌅 Breakfast' },
    { value: 'lunch', label: '🌞 Lunch' },
    { value: 'dinner', label: '🌙 Dinner' },
    { value: 'snack', label: '🍿 Snack' },
    { value: 'dessert', label: '🍰 Dessert' },
  ];

  const difficultyOptions = [
    { value: 'beginner', label: '👶 Beginner' },
    { value: 'intermediate', label: '👨‍🍳 Intermediate' },
    { value: 'advanced', label: '🧑‍🍳 Advanced' },
    { value: 'expert', label: '👨‍💼 Expert' },
  ];

  const RangeSlider: React.FC<{
    title: string;
    min: number;
    max: number;
    step: number;
    value: { min: number; max: number };
    onValueChange: (value: { min: number; max: number }) => void;
    unit?: string;
  }> = ({ title, min, max, step, value, onValueChange, unit = '' }) => {
    return (
      <View style={styles.rangeSliderContainer}>
        <Text style={styles.filterSectionTitle}>{title}</Text>
        <View style={styles.rangeSliderValues}>
          <Text style={styles.rangeValue}>{value.min}{unit}</Text>
          <Text style={styles.rangeValue}>{value.max}{unit}</Text>
        </View>
        
        {/* Simplified range selector with buttons */}
        <View style={styles.rangeButtonsContainer}>
          <View style={styles.rangeButtonGroup}>
            <Text style={styles.rangeLabel}>Min:</Text>
            <TouchableOpacity 
              style={styles.rangeButton}
              onPress={() => onValueChange({ ...value, min: Math.max(min, value.min - step) })}
            >
              <Text style={styles.rangeButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.rangeDisplayValue}>{value.min}{unit}</Text>
            <TouchableOpacity 
              style={styles.rangeButton}
              onPress={() => onValueChange({ ...value, min: Math.min(max, value.min + step) })}
            >
              <Text style={styles.rangeButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.rangeButtonGroup}>
            <Text style={styles.rangeLabel}>Max:</Text>
            <TouchableOpacity 
              style={styles.rangeButton}
              onPress={() => onValueChange({ ...value, max: Math.max(min, value.max - step) })}
            >
              <Text style={styles.rangeButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.rangeDisplayValue}>{value.max}{unit}</Text>
            <TouchableOpacity 
              style={styles.rangeButton}
              onPress={() => onValueChange({ ...value, max: Math.min(max, value.max + step) })}
            >
              <Text style={styles.rangeButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const MultiSelectSection: React.FC<{
    title: string;
    options: Array<{ value: string; label: string }>;
    selectedValues: string[];
    onSelectionChange: (values: string[]) => void;
  }> = ({ title, options, selectedValues, onSelectionChange }) => {
    const toggleOption = (value: string) => {
      const newSelection = selectedValues.includes(value)
        ? selectedValues.filter(v => v !== value)
        : [...selectedValues, value];
      onSelectionChange(newSelection);
    };

    return (
      <View style={styles.multiSelectContainer}>
        <Text style={styles.filterSectionTitle}>{title}</Text>
        <View style={styles.optionsGrid}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                selectedValues.includes(option.value) && styles.optionButtonSelected
              ]}
              onPress={() => toggleOption(option.value)}
            >
              <Text style={[
                styles.optionButtonText,
                selectedValues.includes(option.value) && styles.optionButtonTextSelected
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const StarRating: React.FC<{
    rating: number;
    onRatingChange: (rating: number) => void;
  }> = ({ rating, onRatingChange }) => {
    return (
      <View style={styles.starRatingContainer}>
        <Text style={styles.filterSectionTitle}>Minimum Rating</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => onRatingChange(star)}
            >
              <Text style={[
                styles.star,
                star <= rating && styles.starSelected
              ]}>
                ⭐
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingText}>{rating > 0 ? `${rating}+ stars` : 'Any rating'}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.filterModal,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                }),
              }],
            },
          ]}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter Recipes</Text>
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.modalClearText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Cuisine Types */}
            <MultiSelectSection
              title="🌍 Cuisine Types"
              options={cuisineOptions}
              selectedValues={localFilters.cuisineTypes || []}
              onSelectionChange={(values) => updateFilter('cuisineTypes', values)}
            />

            {/* Dietary Restrictions */}
            <MultiSelectSection
              title="🥗 Dietary Restrictions"
              options={dietaryOptions}
              selectedValues={localFilters.dietaryRestrictions || []}
              onSelectionChange={(values) => updateFilter('dietaryRestrictions', values)}
            />

            {/* Meal Types */}
            <MultiSelectSection
              title="🍽️ Meal Types"
              options={mealTypeOptions}
              selectedValues={localFilters.mealTypes || []}
              onSelectionChange={(values) => updateFilter('mealTypes', values)}
            />

            {/* Difficulty Level */}
            <MultiSelectSection
              title="📈 Difficulty Level"
              options={difficultyOptions}
              selectedValues={localFilters.difficulty || []}
              onSelectionChange={(values) => updateFilter('difficulty', values)}
            />

            {/* Cooking Time Range */}
            <RangeSlider
              title="⏱️ Cooking Time"
              min={15}
              max={180}
              step={15}
              value={localFilters.cookingTime || { min: 15, max: 180 }}
              onValueChange={(value) => updateFilter('cookingTime', value)}
              unit=" min"
            />

            {/* Calorie Range */}
            <RangeSlider
              title="🔥 Calories per Serving"
              min={100}
              max={1000}
              step={50}
              value={localFilters.calories || { min: 100, max: 1000 }}
              onValueChange={(value) => updateFilter('calories', value)}
              unit=" cal"
            />

            {/* Rating Filter */}
            <StarRating
              rating={localFilters.minRating || 0}
              onRatingChange={(rating) => updateFilter('minRating', rating)}
            />
          </ScrollView>

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Recipe Card Component
interface RecipeCardProps {
  recipe: BaseRecipe;
  onPress: () => void;
  onSave: () => void;
  onShare: () => void;
  isFavorited: boolean;
  viewMode: 'grid' | 'list';
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onPress,
  onSave,
  onShare,
  isFavorited,
  viewMode,
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

  if (viewMode === 'list') {
    return (
      <TouchableOpacity style={styles.recipeCardList} onPress={onPress}>
        {/* Recipe Image Placeholder */}
        <View style={styles.recipeImageList}>
          <Text style={styles.recipeImagePlaceholder}>🍳</Text>
        </View>

        {/* Recipe Info */}
        <View style={styles.recipeInfoList}>
          <Text style={styles.recipeNameList} numberOfLines={1}>{recipe.name}</Text>
          <Text style={styles.recipeDescriptionList} numberOfLines={2}>{recipe.description}</Text>
          
          <View style={styles.recipeMetaList}>
            <Text style={styles.recipeMetaText}>⏱️ {recipe.cookingTime}min</Text>
            <Text style={styles.recipeMetaText}>⭐ {recipe.rating.toFixed(1)}</Text>
            <Text style={[styles.recipeMetaText, { color: getDifficultyColor(recipe.difficulty) }]}>
              {recipe.difficulty}
            </Text>
            <Text style={styles.recipeMetaText}>🔥 {recipe.calories}cal</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.recipeActionsList}>
          <TouchableOpacity style={styles.quickActionButton} onPress={onSave}>
            <Text style={styles.quickActionIcon}>{isFavorited ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton} onPress={onShare}>
            <Text style={styles.quickActionIcon}>🔗</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.recipeCardGrid} onPress={onPress}>
      {/* Recipe Image Placeholder */}
      <View style={styles.recipeImageGrid}>
        <Text style={styles.recipeImagePlaceholder}>🍳</Text>
        
        {/* Floating Actions */}
        <View style={styles.floatingActions}>
          <TouchableOpacity style={styles.floatingActionButton} onPress={onSave}>
            <Text style={styles.floatingActionIcon}>{isFavorited ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        {/* Difficulty Badge */}
        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(recipe.difficulty) }]}>
          <Text style={styles.difficultyBadgeText}>{recipe.difficulty}</Text>
        </View>
      </View>

      {/* Recipe Info */}
      <View style={styles.recipeInfoGrid}>
        <Text style={styles.recipeNameGrid} numberOfLines={2}>{recipe.name}</Text>
        
        <View style={styles.recipeMetaGrid}>
          <Text style={styles.recipeMetaText}>⏱️ {recipe.cookingTime}min</Text>
          <Text style={styles.recipeMetaText}>⭐ {recipe.rating.toFixed(1)} ({recipe.totalRatings})</Text>
          <Text style={styles.recipeMetaText}>🔥 {recipe.calories}cal</Text>
        </View>

        {/* Tags */}
        <View style={styles.tagsContainer}>
          {recipe.tags.slice(0, 2).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {recipe.tags.length > 2 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>+{recipe.tags.length - 2}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Search Bar Styles
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  searchBarFocused: {
    borderColor: '#007AFF',
    shadowOpacity: 0.2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 12,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  loadingIndicator: {
    marginRight: 8,
  },
  loadingText: {
    fontSize: 16,
  },
  voiceButton: {
    padding: 4,
    marginLeft: 8,
  },
  voiceIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  cameraButton: {
    padding: 4,
    marginLeft: 8,
  },
  cameraIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  suggestionsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: 12,
    opacity: 0.6,
  },
  suggestionText: {
    fontSize: 16,
    color: '#1C1C1E',
  },

  // Quick Filters Styles
  quickFiltersContainer: {
    marginBottom: 16,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterChipsScroll: {
    flex: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  filterChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 6,
  },
  filterChipRemove: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clearAllButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearAllText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  quickFilterScroll: {
    flexGrow: 0,
  },
  quickFilterButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  quickFilterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  quickFilterText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  quickFilterTextActive: {
    color: 'white',
  },

  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  modalClearText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Filter Section Styles
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 24,
    marginBottom: 16,
  },
  multiSelectContainer: {
    marginBottom: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  optionButtonTextSelected: {
    color: 'white',
  },

  // Range Slider Styles
  rangeSliderContainer: {
    marginBottom: 8,
  },
  rangeSliderValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rangeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  rangeButtonsContainer: {
    gap: 16,
  },
  rangeButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rangeLabel: {
    fontSize: 16,
    color: '#1C1C1E',
    minWidth: 40,
  },
  rangeButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  rangeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  rangeDisplayValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    minWidth: 60,
    textAlign: 'center',
  },

  // Star Rating Styles
  starRatingContainer: {
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  star: {
    fontSize: 24,
    opacity: 0.3,
  },
  starSelected: {
    opacity: 1,
  },
  ratingText: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Recipe Card Styles - Grid View
  recipeCardGrid: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  recipeImageGrid: {
    height: 120,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  recipeImagePlaceholder: {
    fontSize: 48,
    opacity: 0.6,
  },
  floatingActions: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  floatingActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingActionIcon: {
    fontSize: 16,
  },
  difficultyBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  recipeInfoGrid: {
    padding: 12,
  },
  recipeNameGrid: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
    lineHeight: 22,
  },
  recipeMetaGrid: {
    marginBottom: 8,
  },
  recipeMetaText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Recipe Card Styles - List View
  recipeCardList: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeImageList: {
    width: 80,
    height: 80,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipeInfoList: {
    flex: 1,
  },
  recipeNameList: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  recipeDescriptionList: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
    lineHeight: 18,
  },
  recipeMetaList: {
    flexDirection: 'row',
    gap: 12,
  },
  recipeActionsList: {
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingLeft: 8,
  },
  quickActionButton: {
    padding: 8,
  },
  quickActionIcon: {
    fontSize: 20,
  },
});
