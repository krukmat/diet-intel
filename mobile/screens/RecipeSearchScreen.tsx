import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SearchBar,
  QuickFilters,
  FilterModal,
  RecipeCard,
} from '../components/RecipeSearchComponents';

interface RecipeSearchScreenProps {
  onBackPress: () => void;
  onNavigateToDetail?: (recipe: any) => void;
}

interface SearchFilters {
  cuisineTypes: string[];
  dietaryRestrictions: string[];
  mealTypes: string[];
  difficulty: string[];
  cookingTime: { min: number; max: number };
  calories: { min: number; max: number };
  minRating: number;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  cookingTime: number;
  difficulty: string;
  rating: number;
  totalRatings: number;
  calories: number;
  cuisineType: string;
  tags: string[];
  imageUrl?: string;
}

export default function RecipeSearchScreen({
  onBackPress,
  onNavigateToDetail,
}: RecipeSearchScreenProps) {
  const { t } = useTranslation();
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter State
  const [filters, setFilters] = useState<SearchFilters>({
    cuisineTypes: [],
    dietaryRestrictions: [],
    mealTypes: [],
    difficulty: [],
    cookingTime: { min: 15, max: 180 },
    calories: { min: 100, max: 1000 },
    minRating: 0,
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'relevance' | 'rating' | 'time' | 'calories' | 'popularity'>('relevance');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [favoriteRecipes, setFavoriteRecipes] = useState<Set<string>>(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    loadSearchHistory();
    loadFavoriteRecipes();
    // Load initial popular recipes
    performSearch('', true);
  }, []);

  useEffect(() => {
    // Debounced search
    const debounceTimer = setTimeout(() => {
      if (searchQuery.length > 0) {
        performSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, filters, sortBy]);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('recipeSearchHistory');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const saveSearchHistory = async (query: string) => {
    try {
      const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
      setSearchHistory(newHistory);
      await AsyncStorage.setItem('recipeSearchHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  const loadFavoriteRecipes = async () => {
    try {
      const favorites = await AsyncStorage.getItem('favoriteRecipes');
      if (favorites) {
        setFavoriteRecipes(new Set(JSON.parse(favorites)));
      }
    } catch (error) {
      console.error('Error loading favorite recipes:', error);
    }
  };

  const toggleFavorite = async (recipeId: string) => {
    const newFavorites = new Set(favoriteRecipes);
    if (newFavorites.has(recipeId)) {
      newFavorites.delete(recipeId);
    } else {
      newFavorites.add(recipeId);
    }
    
    setFavoriteRecipes(newFavorites);
    
    try {
      await AsyncStorage.setItem('favoriteRecipes', JSON.stringify([...newFavorites]));
    } catch (error) {
      console.error('Error saving favorite recipes:', error);
    }
  };

  const performSearch = async (query: string, isInitialLoad = false) => {
    if (!isInitialLoad && loading) return;
    
    setLoading(true);
    if (isInitialLoad) {
      setSearchResults([]);
      setCurrentPage(1);
    }

    try {
      // TODO: Replace with actual API call in R.2.1.6
      // const response = await searchRecipes({ query, filters, sortBy, page: currentPage });
      
      // Mock search results for demonstration
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
      
      const mockResults: Recipe[] = generateMockSearchResults(query, filters, sortBy);
      
      if (isInitialLoad || currentPage === 1) {
        setSearchResults(mockResults);
      } else {
        setSearchResults(prev => [...prev, ...mockResults]);
      }
      
      setTotalResults(mockResults.length + (Math.random() > 0.5 ? 50 : 0)); // Simulate varying total counts
      setHasMoreResults(mockResults.length === 10); // Assume 10 per page
      
      // Generate suggestions based on query
      if (query.length > 2) {
        setSuggestions(generateSearchSuggestions(query));
      } else {
        setSuggestions([]);
      }
      
      // Save search to history if it's a user-initiated search
      if (query && !isInitialLoad) {
        saveSearchHistory(query);
      }
      
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to search recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateMockSearchResults = (query: string, filters: SearchFilters, sortBy: string): Recipe[] => {
    const baseRecipes: Recipe[] = [
      {
        id: '1',
        name: 'Mediterranean Quinoa Bowl',
        description: 'A healthy bowl packed with quinoa, vegetables, and Mediterranean flavors',
        cookingTime: 25,
        difficulty: 'intermediate',
        rating: 4.7,
        totalRatings: 89,
        calories: 385,
        cuisineType: 'mediterranean',
        tags: ['Mediterranean', 'Healthy', 'Vegetarian'],
      },
      {
        id: '2',
        name: 'Spicy Thai Basil Chicken',
        description: 'Authentic Thai stir-fry with fresh basil and chilies',
        cookingTime: 20,
        difficulty: 'beginner',
        rating: 4.9,
        totalRatings: 156,
        calories: 420,
        cuisineType: 'thai',
        tags: ['Thai', 'Spicy', 'Quick'],
      },
      {
        id: '3',
        name: 'Classic Italian Carbonara',
        description: 'Traditional Roman pasta with eggs, cheese, and pancetta',
        cookingTime: 18,
        difficulty: 'intermediate',
        rating: 4.8,
        totalRatings: 203,
        calories: 520,
        cuisineType: 'italian',
        tags: ['Italian', 'Pasta', 'Classic'],
      },
      {
        id: '4',
        name: 'Vegan Buddha Bowl',
        description: 'Colorful bowl with roasted vegetables, quinoa, and tahini dressing',
        cookingTime: 35,
        difficulty: 'beginner',
        rating: 4.6,
        totalRatings: 127,
        calories: 340,
        cuisineType: 'american',
        tags: ['Vegan', 'Healthy', 'Bowl'],
      },
      {
        id: '5',
        name: 'Indian Butter Chicken',
        description: 'Creamy tomato-based curry with tender chicken pieces',
        cookingTime: 45,
        difficulty: 'advanced',
        rating: 4.9,
        totalRatings: 312,
        calories: 480,
        cuisineType: 'indian',
        tags: ['Indian', 'Curry', 'Comfort Food'],
      },
      {
        id: '6',
        name: 'Mexican Street Tacos',
        description: 'Authentic corn tortilla tacos with cilantro and onions',
        cookingTime: 15,
        difficulty: 'beginner',
        rating: 4.5,
        totalRatings: 98,
        calories: 280,
        cuisineType: 'mexican',
        tags: ['Mexican', 'Quick', 'Street Food'],
      },
      {
        id: '7',
        name: 'French Ratatouille',
        description: 'Classic Provençal vegetable stew with fresh herbs',
        cookingTime: 60,
        difficulty: 'intermediate',
        rating: 4.4,
        totalRatings: 76,
        calories: 150,
        cuisineType: 'french',
        tags: ['French', 'Vegetarian', 'Traditional'],
      },
      {
        id: '8',
        name: 'Japanese Chicken Teriyaki',
        description: 'Glazed chicken with sweet and savory teriyaki sauce',
        cookingTime: 30,
        difficulty: 'beginner',
        rating: 4.7,
        totalRatings: 164,
        calories: 390,
        cuisineType: 'japanese',
        tags: ['Japanese', 'Chicken', 'Glazed'],
      },
    ];

    // Filter results based on search query and filters
    let filteredResults = baseRecipes.filter(recipe => {
      // Text search
      if (query) {
        const searchLower = query.toLowerCase();
        const matchesName = recipe.name.toLowerCase().includes(searchLower);
        const matchesDescription = recipe.description.toLowerCase().includes(searchLower);
        const matchesCuisine = recipe.cuisineType.toLowerCase().includes(searchLower);
        const matchesTags = recipe.tags.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!matchesName && !matchesDescription && !matchesCuisine && !matchesTags) {
          return false;
        }
      }

      // Apply filters
      if (filters.cuisineTypes.length > 0 && !filters.cuisineTypes.includes(recipe.cuisineType)) {
        return false;
      }
      
      if (filters.difficulty.length > 0 && !filters.difficulty.includes(recipe.difficulty)) {
        return false;
      }
      
      if (recipe.cookingTime < filters.cookingTime.min || recipe.cookingTime > filters.cookingTime.max) {
        return false;
      }
      
      if (recipe.calories < filters.calories.min || recipe.calories > filters.calories.max) {
        return false;
      }
      
      if (recipe.rating < filters.minRating) {
        return false;
      }

      return true;
    });

    // Sort results
    filteredResults.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating || b.totalRatings - a.totalRatings;
        case 'time':
          return a.cookingTime - b.cookingTime;
        case 'calories':
          return a.calories - b.calories;
        case 'popularity':
          return b.totalRatings - a.totalRatings;
        default: // relevance
          return b.rating - a.rating;
      }
    });

    return filteredResults.slice(0, 10); // Return first 10 results
  };

  const generateSearchSuggestions = (query: string): string[] => {
    const suggestions = [
      'Mediterranean chicken',
      'Vegetarian pasta',
      'Quick dinner recipes',
      'Healthy breakfast',
      'Thai curry',
      'Italian desserts',
      'Vegan lunch',
      'Low carb meals',
      'One pot recipes',
      'Gluten free options',
    ];

    return suggestions
      .filter(s => s.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
  };

  const handleVoiceSearch = () => {
    Alert.alert('🎤 Voice Search', 'Voice search will be available in the next update!');
  };

  const handleCameraSearch = () => {
    Alert.alert('📷 Visual Search', 'Camera-based ingredient search will be available in the next update!');
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
  };

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    performSearch(searchQuery, true);
  };

  const handleClearFilters = () => {
    setFilters({
      cuisineTypes: [],
      dietaryRestrictions: [],
      mealTypes: [],
      difficulty: [],
      cookingTime: { min: 15, max: 180 },
      calories: { min: 100, max: 1000 },
      minRating: 0,
    });
  };

  const handleRecipePress = (recipe: Recipe) => {
    if (onNavigateToDetail) {
      onNavigateToDetail(recipe);
    }
  };

  const handleRecipeShare = (recipe: Recipe) => {
    Alert.alert('🔗 Share Recipe', `Share "${recipe.name}" with friends!`);
  };

  const handleLoadMore = () => {
    if (!loading && hasMoreResults) {
      setCurrentPage(prev => prev + 1);
      performSearch(searchQuery);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    performSearch(searchQuery, true).finally(() => setRefreshing(false));
  }, [searchQuery, filters, sortBy]);

  const quickFilterOptions = [
    { key: 'cuisineTypes', label: '🇮🇹 Italian', value: ['italian'] },
    { key: 'cuisineTypes', label: '🇲🇽 Mexican', value: ['mexican'] },
    { key: 'dietaryRestrictions', label: '🌱 Vegan', value: ['vegan'] },
    { key: 'cookingTime', label: '⚡ Quick (< 30min)', value: { min: 15, max: 30 } },
    { key: 'difficulty', label: '👶 Beginner', value: ['beginner'] },
    { key: 'minRating', label: '⭐ 4+ Rating', value: 4 },
  ];

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <RecipeCard
      recipe={item}
      onPress={() => handleRecipePress(item)}
      onSave={() => toggleFavorite(item.id)}
      onShare={() => handleRecipeShare(item)}
      isFavorited={favoriteRecipes.has(item.id)}
      viewMode={viewMode}
    />
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading more recipes...</Text>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>🔍</Text>
        <Text style={styles.emptyStateTitle}>
          {searchQuery ? 'No recipes found' : 'Start searching for recipes'}
        </Text>
        <Text style={styles.emptyStateDescription}>
          {searchQuery 
            ? 'Try adjusting your search terms or filters' 
            : 'Use the search bar above to find delicious recipes'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔍 Search Recipes</Text>
        <TouchableOpacity 
          style={styles.viewToggleButton} 
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        >
          <Text style={styles.viewToggleText}>{viewMode === 'grid' ? '☰' : '⊞'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onVoiceSearch={handleVoiceSearch}
          onCameraSearch={handleCameraSearch}
          suggestions={suggestions}
          searchHistory={searchHistory}
          onSuggestionSelect={handleSuggestionSelect}
          loading={loading}
        />
      </View>

      {/* Quick Filters */}
      <View style={styles.filtersSection}>
        <QuickFilters
          activeFilters={filters}
          onFilterRemove={(key) => {
            setFilters(prev => ({
              ...prev,
              [key]: Array.isArray(prev[key as keyof SearchFilters]) ? [] : 
                    typeof prev[key as keyof SearchFilters] === 'object' ? { min: 15, max: 180 } : 
                    key === 'minRating' ? 0 : prev[key as keyof SearchFilters]
            }));
          }}
          onClearAll={handleClearFilters}
          quickFilterOptions={quickFilterOptions}
          onQuickFilterSelect={(key, value) => {
            setFilters(prev => ({ ...prev, [key]: value }));
          }}
        />
        
        <TouchableOpacity 
          style={styles.filterButton} 
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={styles.filterButtonText}>🎛️ More Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Results Header */}
      {searchResults.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            Found {totalResults} recipe{totalResults !== 1 ? 's' : ''}
          </Text>
          
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={() => {
              const sortOptions = ['relevance', 'rating', 'time', 'calories', 'popularity'];
              const currentIndex = sortOptions.indexOf(sortBy);
              const nextSort = sortOptions[(currentIndex + 1) % sortOptions.length] as typeof sortBy;
              setSortBy(nextSort);
            }}
          >
            <Text style={styles.sortButtonText}>
              Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)} ↕️
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recipe Results */}
      <FlatList
        data={searchResults}
        renderItem={renderRecipe}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // Force re-render when view mode changes
        contentContainerStyle={styles.recipesList}
        columnWrapperStyle={viewMode === 'grid' ? styles.recipeRow : undefined}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onFiltersChange={handleFilterChange}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    flex: 1,
    textAlign: 'center',
  },
  viewToggleButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  viewToggleText: {
    fontSize: 18,
    color: '#007AFF',
  },
  searchSection: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filtersSection: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  filterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  sortButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sortButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  recipesList: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  recipeRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});