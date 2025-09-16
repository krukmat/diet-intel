// Optimized My Recipes Library Screen
// Using React hooks optimization, custom hooks, and performance patterns

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { RecipeLanguageToggle } from '../components/RecipeLanguageToggle';
import {
  getCurrentRecipeLanguage,
  getLocalizedDifficultyLevels,
  formatRecipeTime,
} from '../utils/recipeLanguageHelper';
import {
  CollectionCard,
  PersonalRecipeCard,
  LibrarySearchBar,
  CollectionSelectorModal,
  CreateCollectionModal,
  EmptyLibraryState,
  RecipeManagementModal,
  LibraryStats,
  BackupExportModal,
} from '../components/RecipeLibraryComponents';
import { usePersonalRecipes, useNetworkStatus } from '../hooks/useApiRecipes';
import { SyncStatusIndicator, SyncStatusBanner } from '../components/SyncStatusComponents';
import { recipeStorage } from '../services/RecipeStorageService';
import {
  RecipeCollection,
  RecipeListItem,
  LibrarySearchFilters,
  LibrarySortOptions,
  PaginatedRecipeResult,
  PersonalRecipe,
  SYSTEM_COLLECTIONS,
} from '../types/RecipeTypes';

interface MyRecipesScreenProps {
  onBackPress: () => void;
  onNavigateToDetail?: (recipe: RecipeListItem) => void;
  onNavigateToGeneration?: () => void;
}

// Custom hook for library state management with API integration
function useRecipeLibrary() {
  const {
    recipes,
    collections,
    loading,
    error,
    loadRecipes,
    loadCollections,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    toggleFavorite,
    createCollection,
    addToCollection,
    removeFromCollection,
    refresh,
  } = usePersonalRecipes();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<LibrarySearchFilters>({});
  const [sortOptions, setSortOptions] = useState<LibrarySortOptions>({
    field: 'dateAdded',
    direction: 'desc',
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [filteredRecipes, setFilteredRecipes] = useState<PersonalRecipe[]>([]);

  // Filter and sort recipes based on current settings
  useEffect(() => {
    let filtered = [...recipes];
    
    // Apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe.name.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query) ||
        recipe.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply collection filter
    if (selectedCollection) {
      filtered = filtered.filter(recipe =>
        recipe.personalMetadata.collections.includes(selectedCollection)
      );
    }
    
    // Apply other filters
    if (activeFilters.cuisineTypes?.length) {
      filtered = filtered.filter(recipe =>
        activeFilters.cuisineTypes!.includes(recipe.cuisineType)
      );
    }
    
    if (activeFilters.dietaryRestrictions?.length) {
      filtered = filtered.filter(recipe =>
        activeFilters.dietaryRestrictions!.some(restriction =>
          recipe.dietaryRestrictions?.includes(restriction)
        )
      );
    }
    
    if (activeFilters.difficulty?.length) {
      filtered = filtered.filter(recipe =>
        activeFilters.difficulty!.includes(recipe.difficulty)
      );
    }
    
    if (activeFilters.cookingTimeRange) {
      const { min, max } = activeFilters.cookingTimeRange;
      filtered = filtered.filter(recipe =>
        recipe.cookingTime >= min && recipe.cookingTime <= max
      );
    }
    
    if (activeFilters.minRating) {
      filtered = filtered.filter(recipe =>
        (recipe.personalMetadata.personalRating || 0) >= activeFilters.minRating!
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const { field, direction } = sortOptions;
      let comparison = 0;
      
      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'dateAdded':
          comparison = new Date(a.personalMetadata.dateAdded).getTime() - new Date(b.personalMetadata.dateAdded).getTime();
          break;
        case 'personalRating':
          comparison = (a.personalMetadata.personalRating || 0) - (b.personalMetadata.personalRating || 0);
          break;
        case 'timesCooked':
          comparison = (a.personalMetadata.timesCooked || 0) - (b.personalMetadata.timesCooked || 0);
          break;
        case 'lastCooked':
          const aLastCooked = a.personalMetadata.lastCookedDate ? new Date(a.personalMetadata.lastCookedDate).getTime() : 0;
          const bLastCooked = b.personalMetadata.lastCookedDate ? new Date(b.personalMetadata.lastCookedDate).getTime() : 0;
          comparison = aLastCooked - bLastCooked;
          break;
        case 'cookingTime':
          comparison = a.cookingTime - b.cookingTime;
          break;
        default:
          comparison = 0;
      }
      
      return direction === 'desc' ? -comparison : comparison;
    });
    
    setFilteredRecipes(filtered);
  }, [recipes, searchQuery, activeFilters, sortOptions, selectedCollection]);

  // Convert to legacy format for compatibility
  const recipeResults = {
    items: filteredRecipes.map(recipe => ({
      id: recipe.id,
      name: recipe.name,
      description: recipe.description || '',
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty,
      rating: recipe.personalMetadata?.personalRating || 0,
      totalRatings: 1,
      calories: recipe.calories || 0,
      cuisineType: recipe.cuisineType,
      tags: recipe.tags || [],
      imageUrl: recipe.image,
      personalMetadata: recipe.personalMetadata,
    })),
    totalCount: filteredRecipes.length,
    hasMore: false,
    currentPage: 1,
  };

  const handleRefresh = async () => {
    await refresh();
  };

  return {
    initialized: true,
    collections,
    setCollections: () => {}, // Managed by API hook
    searchQuery,
    setSearchQuery,
    activeFilters,
    setActiveFilters,
    sortOptions,
    setSortOptions,
    viewMode,
    setViewMode,
    selectedCollection,
    setSelectedCollection,
    recipeResults,
    loading,
    refreshing: loading,
    searchRecipes: () => {}, // Not needed with real-time filtering
    handleRefresh,
    apiHooks: {
      saveRecipe,
      updateRecipe,
      deleteRecipe,
      toggleFavorite,
      createCollection,
      addToCollection,
      removeFromCollection,
    },
  };
}

export default function MyRecipesScreen({
  onBackPress,
  onNavigateToDetail,
  onNavigateToGeneration,
}: MyRecipesScreenProps) {
  const { t } = useTranslation();
  const {
    initialized,
    collections,
    setCollections,
    searchQuery,
    setSearchQuery,
    activeFilters,
    setActiveFilters,
    sortOptions,
    setSortOptions,
    viewMode,
    setViewMode,
    selectedCollection,
    setSelectedCollection,
    recipeResults,
    loading,
    refreshing,
    searchRecipes,
    handleRefresh,
    apiHooks,
  } = useRecipeLibrary();
  
  const networkStatus = useNetworkStatus();

  // Modal states
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [selectedRecipeForManagement, setSelectedRecipeForManagement] = useState<RecipeListItem | null>(null);

  // Memoized computed values
  const selectedCollectionData = useMemo(() => {
    if (!selectedCollection) return null;
    return collections.find(c => c.id === selectedCollection);
  }, [selectedCollection, collections]);

  const activeFiltersCount = useMemo(() => {
    return Object.keys(activeFilters).filter(key => {
      const value = activeFilters[key as keyof LibrarySearchFilters];
      return Array.isArray(value) ? value.length > 0 : value !== undefined;
    }).length;
  }, [activeFilters]);

  // Event handlers
  const handleCollectionPress = useCallback((collection: RecipeCollection) => {
    if (selectedCollection === collection.id) {
      setSelectedCollection(null); // Deselect if already selected
    } else {
      setSelectedCollection(collection.id);
    }
  }, [selectedCollection]);

  const handleRecipePress = useCallback((recipe: RecipeListItem) => {
    onNavigateToDetail?.(recipe);
  }, [onNavigateToDetail]);

  const handleRecipeFavorite = useCallback(async (recipeId: string) => {
    try {
      await apiHooks.toggleFavorite(recipeId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('myRecipes.failedToUpdateFavorite', 'Failed to update recipe favorite status.')
      );
    }
  }, [apiHooks]);

  const handleRecipeShare = useCallback((recipe: RecipeListItem) => {
    Alert.alert(
      t('myRecipes.shareRecipe', '🔗 Share Recipe'),
      t('myRecipes.shareMessage', 'Share "{{recipeName}}" with friends!', { recipeName: recipe.name })
    );
  }, []);

  const handleAddToMealPlan = useCallback((recipe: RecipeListItem) => {
    Alert.alert(
      t('myRecipes.addToMealPlan', '📅 Add to Meal Plan'),
      t('myRecipes.addToMealPlanMessage', 'Add "{{recipeName}}" to your meal plan!', { recipeName: recipe.name })
    );
  }, []);

  const handleLanguageChange = useCallback((language: string) => {
    // Refresh data when language changes
    setTimeout(() => {
      apiHooks.refresh();
    }, 100);
  }, [apiHooks]);

  const handleCreateCollection = useCallback(async (
    name: string,
    description: string,
    color: string,
    icon: string
  ) => {
    try {
      await apiHooks.createCollection(name, description, color, icon);
      setShowCreateCollection(false);
      Alert.alert(
        t('common.success', '✅ Success'),
        t('myRecipes.collectionCreated', 'Collection "{{name}}" created!', { name })
      );
    } catch (error) {
      console.error('Failed to create collection:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('myRecipes.failedToCreateCollection', 'Failed to create collection. Please try again.')
      );
    }
  }, [apiHooks]);

  const handleLoadMore = useCallback(() => {
    // With real-time filtering, no need for pagination
  }, []);

  const onRefresh = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  const handleSortChange = useCallback((field: LibrarySortOptions['field']) => {
    const direction = sortOptions.field === field && sortOptions.direction === 'desc' ? 'asc' : 'desc';
    setSortOptions({ field, direction });
    setShowSortModal(false);
  }, [sortOptions, setSortOptions]);

  // Recipe Management Handlers
  const handleRecipeLongPress = useCallback((recipe: RecipeListItem) => {
    setSelectedRecipeForManagement(recipe);
    setShowManagementModal(true);
  }, []);

  const handleEditRecipe = useCallback((recipe: RecipeListItem) => {
    Alert.alert(
      t('myRecipes.editRecipe', '✏️ Edit Recipe'),
      t('myRecipes.editComingSoon', 'Edit functionality for "{{recipeName}}" will be available in the next update!', { recipeName: recipe.name })
    );
  }, []);

  const handleExportRecipe = useCallback((recipe: RecipeListItem) => {
    Alert.alert(
      t('myRecipes.exportRecipe', '📥 Export Recipe'),
      t('myRecipes.exportComingSoon', 'Export functionality for "{{recipeName}}" will be integrated with external apps!', { recipeName: recipe.name })
    );
  }, []);

  const handleDuplicateRecipe = useCallback(async (recipe: RecipeListItem) => {
    try {
      const duplicatedRecipe = {
        name: `${recipe.name} (${t('myRecipes.copy', 'Copy')})`,
        description: recipe.description,
        cookingTime: recipe.cookingTime,
        difficulty: recipe.difficulty,
        cuisineType: recipe.cuisineType,
        tags: recipe.tags,
        ingredients: [],
        instructions: [],
        nutrition: { calories: recipe.calories },
        personalNotes: t('myRecipes.duplicatedRecipe', 'Duplicated recipe'),
      };
      
      await apiHooks.saveRecipe(duplicatedRecipe, {
        source: 'custom',
        personalTags: recipe.tags,
      });
      
      Alert.alert(
        t('myRecipes.recipeDuplicated', '✅ Recipe Duplicated'),
        t('myRecipes.recipeDuplicatedMessage', '"{{recipeName}}" has been added to your library!', { recipeName: duplicatedRecipe.name })
      );
    } catch (error) {
      console.error('Failed to duplicate recipe:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('myRecipes.failedToDuplicate', 'Failed to duplicate recipe. Please try again.')
      );
    }
  }, [apiHooks]);

  const handleDeleteRecipe = useCallback(async (recipeId: string) => {
    try {
      await apiHooks.deleteRecipe(recipeId);
      Alert.alert(
        t('myRecipes.recipeDeleted', '✅ Recipe Deleted'),
        t('myRecipes.recipeDeletedMessage', 'Recipe has been removed from your library.')
      );
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      Alert.alert(
        t('common.error', 'Error'),
        t('myRecipes.failedToDelete', 'Failed to delete recipe. Please try again.')
      );
    }
  }, [apiHooks]);

  // Backup & Export Handlers
  const handleBackupAll = useCallback(() => {
    Alert.alert(
      t('myRecipes.fullBackup', '💾 Full Backup'),
      t('myRecipes.fullBackupMessage', 'Full backup functionality will create a JSON file with all your recipes and collections!')
    );
  }, []);

  const handleExportCollection = useCallback((collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    Alert.alert(
      t('myRecipes.exportCollection', '📤 Export Collection'),
      t('myRecipes.exportCollectionMessage', 'Export "{{collectionName}}" collection functionality will be available soon!', { collectionName: collection?.name })
    );
  }, [collections]);

  const handleImportRecipes = useCallback(() => {
    Alert.alert(
      t('myRecipes.importRecipes', '📥 Import Recipes'),
      t('myRecipes.importRecipesMessage', 'Import functionality will support JSON, CSV, and other recipe formats!')
    );
  }, []);

  // Render functions
  const renderCollectionCard = useCallback(({ item }: { item: RecipeCollection }) => {
    // Calculate recipe count for collection (this would be optimized in real implementation)
    const recipeCount = item.id === selectedCollection ? recipeResults.totalCount : 0;
    
    return (
      <CollectionCard
        collection={item}
        recipeCount={recipeCount}
        onPress={handleCollectionPress}
        isSelected={selectedCollection === item.id}
      />
    );
  }, [selectedCollection, recipeResults.totalCount, handleCollectionPress]);

  const renderRecipeItem = useCallback(({ item }: { item: RecipeListItem }) => (
    <Button
      variant="ghost"
      onPress={() => handleRecipePress(item)}
      onLongPress={() => handleRecipeLongPress(item)}
      style={{
        padding: 0,
        margin: 0,
        backgroundColor: 'transparent',
      }}
    >
      <PersonalRecipeCard
        recipe={item}
        viewMode={viewMode}
        onPress={handleRecipePress}
        onFavorite={handleRecipeFavorite}
        onShare={handleRecipeShare}
        onAddToMealPlan={handleAddToMealPlan}
      />
    </Button>
  ), [viewMode, handleRecipePress, handleRecipeFavorite, handleRecipeShare, handleAddToMealPlan, handleRecipeLongPress]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    
    if (recipeResults.items.length === 0) {
      if (selectedCollection) {
        return (
          <EmptyLibraryState
            title={t('myRecipes.noRecipesInCollection', 'No recipes in collection')}
            message={t('myRecipes.collectionEmpty', '"{{collectionName}}" collection is empty. Add some recipes to get started!', { collectionName: selectedCollectionData?.name })}
            actionText={t('myRecipes.browseRecipes', 'Browse Recipes')}
            onAction={() => {
              setSelectedCollection(null);
              onNavigateToGeneration?.();
            }}
            icon="📂"
          />
        );
      } else {
        return (
          <EmptyLibraryState
            title={t('myRecipes.libraryEmpty', 'Your recipe library is empty')}
            message={t('myRecipes.libraryEmptyMessage', 'Start building your personal recipe collection by generating or saving recipes!')}
            actionText={t('myRecipes.generateRecipe', 'Generate Recipe')}
            onAction={onNavigateToGeneration}
            icon="📚"
          />
        );
      }
    }
    return null;
  }, [loading, recipeResults.items.length, selectedCollection, selectedCollectionData, onNavigateToGeneration]);

  const renderFooter = useCallback(() => {
    if (!loading || recipeResults.items.length === 0) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>{t('myRecipes.loadingMoreRecipes', 'Loading more recipes...')}</Text>
      </View>
    );
  }, [loading, recipeResults.items.length]);

  // Show loading state during initialization
  if (!initialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{t('myRecipes.loadingLibrary', 'Loading your recipe library...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>← {t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('myRecipes.title', '📚 My Recipes')}</Text>
        <View style={styles.headerActions}>
          <RecipeLanguageToggle
            style={styles.languageToggle}
            onLanguageChange={handleLanguageChange}
          />
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => setShowStatsModal(true)}
          >
            <Text style={styles.statsButtonText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backupButton}
            onPress={() => setShowBackupModal(true)}
          >
            <Text style={styles.backupButtonText}>💾</Text>
          </TouchableOpacity>
          <SyncStatusIndicator />
          <TouchableOpacity 
            style={styles.viewToggle}
            onPress={() => {
              const modes: Array<'grid' | 'list' | 'compact'> = ['grid', 'list', 'compact'];
              const currentIndex = modes.indexOf(viewMode);
              const nextMode = modes[(currentIndex + 1) % modes.length];
              setViewMode(nextMode);
            }}
          >
            <Text style={styles.viewToggleText}>
              {viewMode === 'grid' ? '⊞' : viewMode === 'list' ? '☰' : '≡'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Network Status */}
      {!networkStatus.isConnected && (
        <View style={styles.networkStatus}>
          <Text style={styles.networkStatusText}>
            {t('myRecipes.offlineMode', '📱 Offline Mode - Personal recipes available from local storage')}
          </Text>
        </View>
      )}

      {/* Sync Status Banner */}
      <SyncStatusBanner />

      {/* Collections Header */}
      {collections.length > 0 && (
        <View style={styles.collectionsSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={collections}
            renderItem={renderCollectionCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.collectionsContainer}
          />
          <TouchableOpacity
            style={styles.addCollectionButton}
            onPress={() => setShowCreateCollection(true)}
          >
            <Text style={styles.addCollectionText}>+ New Collection</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      <LibrarySearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterPress={() => setShowFilterModal(true)}
        onSortPress={() => setShowSortModal(true)}
        activeFiltersCount={activeFiltersCount}
        currentSort={sortOptions}
        loading={loading}
      />

      {/* Results Header */}
      {recipeResults.items.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {selectedCollectionData
              ? `${selectedCollectionData.icon} ${selectedCollectionData.name}`
              : '📚 All Recipes'
            }
          </Text>
          <Text style={styles.resultsCount}>
            {recipeResults.totalCount} recipe{recipeResults.totalCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Recipe List */}
      <FlatList
        data={recipeResults.items}
        renderItem={renderRecipeItem}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode} // Force re-render when view mode changes
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.recipesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Modals */}
      <CreateCollectionModal
        visible={showCreateCollection}
        onClose={() => setShowCreateCollection(false)}
        onSubmit={handleCreateCollection}
      />

      {/* Sort Modal */}
      <Modal visible={showSortModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sortModalContainer}>
          <View style={styles.sortModalHeader}>
            <TouchableOpacity onPress={() => setShowSortModal(false)}>
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Sort By</Text>
            <View style={styles.placeholder} />
          </View>
          
          <View style={styles.sortOptions}>
            {[
              { field: 'dateAdded' as const, label: '📅 Date Added' },
              { field: 'name' as const, label: '🔤 Name' },
              { field: 'personalRating' as const, label: '⭐ Rating' },
              { field: 'timesCooked' as const, label: '🔥 Times Cooked' },
              { field: 'lastCooked' as const, label: '⏰ Last Cooked' },
              { field: 'cookingTime' as const, label: '⏱️ Cooking Time' },
            ].map(({ field, label }) => (
              <Section
                key={field}
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                padding="md"
                style={{
                  borderRadius: tokens.borderRadius.sm,
                  marginBottom: tokens.spacing.xs,
                  backgroundColor: sortOptions.field === field ?
                    tokens.colors.primary[50] : 'transparent',
                }}
                noDivider
              >
                <Button
                  variant="ghost"
                  size="md"
                  onPress={() => handleSortChange(field)}
                  title={label}
                  style={{
                    flex: 1,
                    alignItems: 'flex-start',
                    backgroundColor: 'transparent',
                    color: sortOptions.field === field ?
                      tokens.colors.primary[500] :
                      tokens.colors.text.primary,
                    fontWeight: sortOptions.field === field ?
                      tokens.typography.fontWeight.semiBold :
                      tokens.typography.fontWeight.normal,
                  }}
                />
                {sortOptions.field === field && (
                  <Text style={{
                    fontSize: tokens.typography.fontSize.md,
                    color: tokens.colors.primary[500],
                    fontWeight: tokens.typography.fontWeight.semiBold,
                  }}>
                    {sortOptions.direction === 'desc' ? '↓' : '↑'}
                  </Text>
                )}
              </Section>
            ))}
          </View>
        </View>
      </Modal>

      {/* Recipe Management Modal */}
      <RecipeManagementModal
        visible={showManagementModal}
        onClose={() => {
          setShowManagementModal(false);
          setSelectedRecipeForManagement(null);
        }}
        recipe={selectedRecipeForManagement}
        onEdit={handleEditRecipe}
        onShare={handleRecipeShare}
        onExport={handleExportRecipe}
        onDelete={handleDeleteRecipe}
        onDuplicate={handleDuplicateRecipe}
        onAddToMealPlan={handleAddToMealPlan}
      />

      {/* Statistics Modal */}
      <Modal visible={showStatsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sortModalContainer}>
          <View style={styles.sortModalHeader}>
            <TouchableOpacity onPress={() => setShowStatsModal(false)}>
              <Text style={styles.modalCloseButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Library Statistics</Text>
            <View style={styles.placeholder} />
          </View>
          <ScrollView style={styles.sortOptions}>
            <LibraryStats
              totalRecipes={recipeResults.totalCount}
              favoriteCount={collections.find(c => c.id === SYSTEM_COLLECTIONS.FAVORITES)?.recipeCount || 0}
              recentlyAddedCount={collections.find(c => c.id === SYSTEM_COLLECTIONS.RECENTLY_ADDED)?.recipeCount || 0}
              mostCookedRecipe={"Mediterranean Quinoa Bowl"}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Backup & Export Modal */}
      <BackupExportModal
        visible={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onBackupAll={handleBackupAll}
        onExportCollection={handleExportCollection}
        onImportRecipes={handleImportRecipes}
        collections={collections}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageToggle: {
    marginRight: 4,
  },
  statsButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
  },
  statsButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  backupButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
  },
  backupButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  viewToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  viewToggleText: {
    fontSize: 18,
    color: '#007AFF',
  },
  
  // Collections Section
  collectionsSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 12,
  },
  collectionsContainer: {
    paddingHorizontal: 12,
  },
  addCollectionButton: {
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 8,
  },
  addCollectionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Results Section
  resultsHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  resultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  resultsCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  
  // Recipe List
  recipesList: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  
  // Sort Modal
  sortModalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  sortModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  placeholder: {
    width: 60, // Balance the header
  },
  sortOptions: {
    flex: 1,
    padding: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  sortOptionSelected: {
    backgroundColor: '#007AFF15',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#1C1C1E',
    flex: 1,
  },
  sortOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  sortDirection: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  networkStatus: {
    backgroundColor: '#34C759',
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