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
import { useRecipeSearch, useNetworkStatus } from '../hooks/useApiRecipes';
import { RecipeSearchRequest } from '../services/RecipeApiService';
import { SyncStatusIndicator } from '../components/SyncStatusComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BaseRecipe } from '../types/RecipeTypes';
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

type Recipe = BaseRecipe;

export default function RecipeSearchScreen({
  onBackPress,
  onNavigateToDetail,
}: RecipeSearchScreenProps) {
  const { t } = useTranslation();
  
  // API Integration Hooks
  const { searchRecipes, data, loading, error, hasMore, totalCount, searchMetadata, loadMore, refresh, isSearching } = useRecipeSearch();
  const networkStatus = useNetworkStatus();
  
  // Local State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [favoriteRecipes, setFavoriteRecipes] = useState<Set<string>>(new Set());
  
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

  // Initialize data and perform search
  useEffect(() => {
    loadSearchHistory();
    loadFavoriteRecipes();
    // Load initial popular recipes
    handleSearch('', true);
  }, []);

  // Debounced search effect
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, filters, sortBy]);

  // Update suggestions when search metadata is available
  useEffect(() => {
    if (searchMetadata?.relatedQueries) {
      setSuggestions(searchMetadata.relatedQueries.slice(0, 5));
    }
  }, [searchMetadata]);

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

  const handleSearch = async (query: string, isInitialLoad = false) => {
    if (!networkStatus.isConnected && query.trim()) {
      Alert.alert(
        '📶 No Internet Connection', 
        'Recipe search requires an internet connection. Please check your network and try again.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Retry', style: 'default', onPress: () => handleSearch(query, isInitialLoad) }
        ]
      );
      return;
    }

    try {
      // Prepare API search request
      const searchRequest: RecipeSearchRequest = {
        query: query.trim() || undefined,
        cuisineTypes: filters.cuisineTypes.length > 0 ? filters.cuisineTypes : undefined,
        dietaryRestrictions: filters.dietaryRestrictions.length > 0 ? filters.dietaryRestrictions : undefined,
        mealTypes: filters.mealTypes.length > 0 ? filters.mealTypes : undefined,
        difficulty: filters.difficulty.length > 0 ? filters.difficulty : undefined,
        cookingTimeRange: {
          min: filters.cookingTime.min,
          max: filters.cookingTime.max,
        },
        calorieRange: {
          min: filters.calories.min,
          max: filters.calories.max,
        },
        minRating: filters.minRating > 0 ? filters.minRating : undefined,
        sortBy: sortBy as 'relevance' | 'rating' | 'popularity' | 'date' | 'cookingTime' | 'calories',
        sortDirection: 'desc',
      };

      // Call API through our custom hook
      await searchRecipes(searchRequest, false);
      
      // Save search to history if it's a user-initiated search
      if (query.trim() && !isInitialLoad) {
        saveSearchHistory(query.trim());
      }
      
    } catch (error: any) {
      console.error('Search error:', error);
      
      let errorMessage = 'Failed to search recipes. Please try again.';
      if (error?.code === 'SEARCH_FAILED') {
        errorMessage = 'Search service is currently unavailable. Please try again later.';
      } else if (error?.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
      }
      
      Alert.alert('Search Error', errorMessage);
    }
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
    handleSearch(searchQuery, true);
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
    if (!loading && hasMore) {
      loadMore();
    }
  };

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

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
        <SyncStatusIndicator />
        <TouchableOpacity 
          style={styles.viewToggleButton} 
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        >
          <Text style={styles.viewToggleText}>{viewMode === 'grid' ? '☰' : '⊞'}</Text>
        </TouchableOpacity>
      </View>

      {/* Network Status */}
      {!networkStatus.isConnected && (
        <View style={styles.networkStatus}>
          <Text style={styles.networkStatusText}>
            📶 Offline Mode - {networkStatus.queuedRequests > 0 ? `${networkStatus.queuedRequests} requests queued` : 'No internet connection'}
          </Text>
        </View>
      )}

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
          loading={isSearching}
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
      {data.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            Found {totalCount} recipe{totalCount !== 1 ? 's' : ''}
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
        data={data}
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
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
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
  networkStatus: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  networkStatusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
