// Optimized Recipe Library Components
// Using React.memo, useMemo, useCallback for performance optimization
// Implementing Compound Component and Render Props patterns

import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  FlatList,
  Switch,
} from 'react-native';
import {
  RecipeCollection,
  PersonalRecipe,
  RecipeListItem,
  LibrarySearchFilters,
  LibrarySortOptions,
  SYSTEM_COLLECTIONS,
} from '../types/RecipeTypes';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 8;
const GRID_CARD_WIDTH = (width - 48) / 2; // 2 columns with margins

// Collection Card Component (Memoized for performance)
export const CollectionCard = memo<{
  collection: RecipeCollection;
  recipeCount: number;
  onPress: (collection: RecipeCollection) => void;
  onLongPress?: (collection: RecipeCollection) => void;
  isSelected?: boolean;
}>(({ collection, recipeCount, onPress, onLongPress, isSelected }) => {
  const handlePress = useCallback(() => {
    onPress(collection);
  }, [collection, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(collection);
  }, [collection, onLongPress]);

  return (
    <TouchableOpacity
      style={[
        styles.collectionCard,
        { backgroundColor: collection.color + '15' },
        isSelected && styles.collectionCardSelected,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.collectionHeader}>
        <Text style={styles.collectionIcon}>{collection.icon}</Text>
        <Text style={[styles.collectionName, { color: collection.color }]}>
          {collection.name}
        </Text>
      </View>
      
      <Text style={styles.collectionDescription} numberOfLines={2}>
        {collection.description || 'No description'}
      </Text>
      
      <View style={styles.collectionFooter}>
        <Text style={styles.recipeCount}>
          {recipeCount} recipe{recipeCount !== 1 ? 's' : ''}
        </Text>
        {collection.isSystem && (
          <Text style={styles.systemBadge}>System</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// Personal Recipe Card (Optimized with image loading)
export const PersonalRecipeCard = memo<{
  recipe: RecipeListItem;
  viewMode: 'grid' | 'list' | 'compact';
  onPress: (recipe: RecipeListItem) => void;
  onFavorite: (recipeId: string) => void;
  onShare?: (recipe: RecipeListItem) => void;
  onAddToMealPlan?: (recipe: RecipeListItem) => void;
}>(({ recipe, viewMode, onPress, onFavorite, onShare, onAddToMealPlan }) => {
  const handlePress = useCallback(() => {
    onPress(recipe);
  }, [recipe, onPress]);

  const handleFavorite = useCallback(() => {
    onFavorite(recipe.id);
  }, [recipe.id, onFavorite]);

  const handleShare = useCallback(() => {
    onShare?.(recipe);
  }, [recipe, onShare]);

  const handleAddToMealPlan = useCallback(() => {
    onAddToMealPlan?.(recipe);
  }, [recipe, onAddToMealPlan]);

  const cardStyle = useMemo(() => {
    switch (viewMode) {
      case 'grid':
        return [styles.recipeCard, styles.recipeCardGrid];
      case 'list':
        return [styles.recipeCard, styles.recipeCardList];
      case 'compact':
        return [styles.recipeCard, styles.recipeCardCompact];
      default:
        return styles.recipeCard;
    }
  }, [viewMode]);

  const renderImage = useCallback(() => {
    if (!recipe.imageUrl) {
      return (
        <View style={[styles.recipeImagePlaceholder, viewMode === 'list' && styles.listImagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>🍽️</Text>
        </View>
      );
    }

    return (
      <Image
        source={{ uri: recipe.imageUrl }}
        style={[styles.recipeImage, viewMode === 'list' && styles.listImage]}
        resizeMode="cover"
      />
    );
  }, [recipe.imageUrl, viewMode]);

  const renderRating = useCallback(() => {
    if (!recipe.personalRating) return null;

    const stars = '⭐'.repeat(Math.floor(recipe.personalRating));
    return (
      <Text style={styles.personalRating}>
        {stars} {recipe.personalRating.toFixed(1)}
      </Text>
    );
  }, [recipe.personalRating]);

  const renderLastCooked = useCallback(() => {
    if (!recipe.lastCooked) return null;

    const daysAgo = Math.floor((Date.now() - recipe.lastCooked.getTime()) / (1000 * 60 * 60 * 24));
    return (
      <Text style={styles.lastCooked}>
        Last cooked: {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
      </Text>
    );
  }, [recipe.lastCooked]);

  if (viewMode === 'compact') {
    return (
      <TouchableOpacity style={cardStyle} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.compactContent}>
          <View style={styles.compactImageContainer}>
            {renderImage()}
          </View>
          <View style={styles.compactInfo}>
            <Text style={styles.recipeName} numberOfLines={1}>
              {recipe.name}
            </Text>
            <View style={styles.compactMeta}>
              <Text style={styles.cookingTime}>{recipe.cookingTime}min</Text>
              {renderRating()}
            </View>
          </View>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavorite}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={recipe.isFavorite ? styles.favoriteActive : styles.favoriteInactive}>
              {recipe.isFavorite ? '❤️' : '🤍'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={cardStyle} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        {renderImage()}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleFavorite}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={recipe.isFavorite ? styles.favoriteActive : styles.favoriteInactive}>
            {recipe.isFavorite ? '❤️' : '🤍'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recipeInfo}>
        <Text style={styles.recipeName} numberOfLines={viewMode === 'grid' ? 2 : 1}>
          {recipe.name}
        </Text>

        <View style={styles.recipeMeta}>
          <Text style={styles.cookingTime}>⏱️ {recipe.cookingTime} min</Text>
          {renderRating()}
        </View>

        {viewMode === 'list' && renderLastCooked()}

        {viewMode === 'list' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Text style={styles.actionButtonText}>📤 Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleAddToMealPlan}>
              <Text style={styles.actionButtonText}>📅 Add to Plan</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// Library Search Bar (Compound Component Pattern)
export const LibrarySearchBar = memo<{
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFilterPress: () => void;
  onSortPress: () => void;
  activeFiltersCount: number;
  currentSort: LibrarySortOptions;
  loading?: boolean;
}>(({ searchQuery, onSearchChange, onFilterPress, onSortPress, activeFiltersCount, currentSort, loading }) => {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your recipes..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
        {loading && (
          <Text style={styles.loadingIndicator}>⏳</Text>
        )}
      </View>

      <View style={styles.searchActions}>
        <TouchableOpacity
          style={[styles.searchActionButton, activeFiltersCount > 0 && styles.activeFilterButton]}
          onPress={onFilterPress}
        >
          <Text style={styles.searchActionText}>
            🎛️ Filter {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchActionButton} onPress={onSortPress}>
          <Text style={styles.searchActionText}>
            ↕️ {currentSort.field} {currentSort.direction === 'desc' ? '↓' : '↑'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Collection Selector Modal
export const CollectionSelectorModal = memo<{
  visible: boolean;
  onClose: () => void;
  collections: RecipeCollection[];
  selectedCollections: string[];
  onSelectionChange: (collectionIds: string[]) => void;
  onCreateNew?: () => void;
}>(({ visible, onClose, collections, selectedCollections, onSelectionChange, onCreateNew }) => {
  const handleToggleCollection = useCallback((collectionId: string) => {
    const isSelected = selectedCollections.includes(collectionId);
    const newSelection = isSelected
      ? selectedCollections.filter(id => id !== collectionId)
      : [...selectedCollections, collectionId];
    onSelectionChange(newSelection);
  }, [selectedCollections, onSelectionChange]);

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [collections]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCloseButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Collections</Text>
          <TouchableOpacity onPress={onCreateNew}>
            <Text style={styles.modalActionButton}>+ New</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {sortedCollections.map((collection) => (
            <TouchableOpacity
              key={collection.id}
              style={[
                styles.collectionOption,
                { backgroundColor: collection.color + '10' },
              ]}
              onPress={() => handleToggleCollection(collection.id)}
            >
              <View style={styles.collectionOptionLeft}>
                <Text style={styles.collectionOptionIcon}>{collection.icon}</Text>
                <View>
                  <Text style={styles.collectionOptionName}>{collection.name}</Text>
                  {collection.description && (
                    <Text style={styles.collectionOptionDescription} numberOfLines={1}>
                      {collection.description}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.collectionOptionRight}>
                <Switch
                  value={selectedCollections.includes(collection.id)}
                  onValueChange={() => handleToggleCollection(collection.id)}
                  thumbColor="#007AFF"
                  trackColor={{ false: '#E5E5EA', true: '#007AFF30' }}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
});

// Create Collection Modal
export const CreateCollectionModal = memo<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, color: string, icon: string) => void;
}>(({ visible, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#007AFF');
  const [selectedIcon, setSelectedIcon] = useState('📁');

  const colors = ['#007AFF', '#34C759', '#FF3B30', '#FF9500', '#5856D6', '#AF52DE', '#FF2D92', '#A2845E'];
  const icons = ['📁', '🍽️', '❤️', '🌟', '🔥', '📌', '🎯', '🏆', '🎨', '⭐'];

  const handleSubmit = useCallback(() => {
    if (name.trim()) {
      onSubmit(name.trim(), description.trim(), selectedColor, selectedIcon);
      setName('');
      setDescription('');
      setSelectedColor('#007AFF');
      setSelectedIcon('📁');
    }
  }, [name, description, selectedColor, selectedIcon, onSubmit]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCloseButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Collection</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={!name.trim()}>
            <Text style={[styles.modalActionButton, !name.trim() && styles.disabledButton]}>
              Create
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Collection Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Enter collection name"
              value={name}
              onChangeText={setName}
              maxLength={50}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.multilineInput]}
              placeholder="Optional description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Color</Text>
            <View style={styles.colorOptions}>
              {colors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColorOption,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Icon</Text>
            <View style={styles.iconOptions}>
              {icons.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    selectedIcon === icon && styles.selectedIconOption,
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Text style={styles.iconOptionText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <View style={[styles.collectionPreview, { backgroundColor: selectedColor + '15' }]}>
              <Text style={styles.previewIcon}>{selectedIcon}</Text>
              <Text style={[styles.previewName, { color: selectedColor }]}>
                {name || 'Collection Name'}
              </Text>
              <Text style={styles.previewDescription}>
                {description || 'Optional description'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
});

// Recipe Management Modal (Edit, Share, Backup)
export const RecipeManagementModal = memo<{
  visible: boolean;
  onClose: () => void;
  recipe: RecipeListItem | null;
  onEdit: (recipe: RecipeListItem) => void;
  onShare: (recipe: RecipeListItem) => void;
  onExport: (recipe: RecipeListItem) => void;
  onDelete: (recipeId: string) => void;
  onDuplicate: (recipe: RecipeListItem) => void;
  onAddToMealPlan: (recipe: RecipeListItem) => void;
}>(({ visible, onClose, recipe, onEdit, onShare, onExport, onDelete, onDuplicate, onAddToMealPlan }) => {
  const handleDelete = useCallback(() => {
    if (!recipe) return;
    
    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(recipe.id);
            onClose();
          },
        },
      ]
    );
  }, [recipe, onDelete, onClose]);

  if (!recipe) return null;

  const actions = [
    {
      icon: '✏️',
      title: 'Edit Recipe',
      description: 'Modify ingredients, instructions, or notes',
      onPress: () => {
        onEdit(recipe);
        onClose();
      },
      color: '#007AFF',
    },
    {
      icon: '📤',
      title: 'Share Recipe',
      description: 'Share with friends and family',
      onPress: () => {
        onShare(recipe);
        onClose();
      },
      color: '#34C759',
    },
    {
      icon: '📥',
      title: 'Export Recipe',
      description: 'Export to external apps or save as file',
      onPress: () => {
        onExport(recipe);
        onClose();
      },
      color: '#FF9500',
    },
    {
      icon: '📋',
      title: 'Duplicate Recipe',
      description: 'Create a copy to modify',
      onPress: () => {
        onDuplicate(recipe);
        onClose();
      },
      color: '#5856D6',
    },
    {
      icon: '📅',
      title: 'Add to Meal Plan',
      description: 'Schedule for upcoming meals',
      onPress: () => {
        onAddToMealPlan(recipe);
        onClose();
      },
      color: '#FF2D92',
    },
    {
      icon: '🗑️',
      title: 'Delete Recipe',
      description: 'Remove from your library permanently',
      onPress: handleDelete,
      color: '#FF3B30',
      destructive: true,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.managementModalContainer}>
        <View style={styles.managementModalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCloseButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Manage Recipe</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.recipePreviewCard}>
          <View style={styles.recipePreviewImage}>
            {recipe.imageUrl ? (
              <Image source={{ uri: recipe.imageUrl }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewImagePlaceholder}>
                <Text style={styles.previewImageIcon}>🍽️</Text>
              </View>
            )}
          </View>
          <View style={styles.recipePreviewInfo}>
            <Text style={styles.recipePreviewTitle} numberOfLines={2}>
              {recipe.name}
            </Text>
            <Text style={styles.recipePreviewMeta}>
              ⏱️ {recipe.cookingTime} min
              {recipe.personalRating && ` • ⭐ ${recipe.personalRating.toFixed(1)}`}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.managementActions} showsVerticalScrollIndicator={false}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.managementAction,
                action.destructive && styles.destructiveAction,
              ]}
              onPress={action.onPress}
            >
              <View style={styles.managementActionLeft}>
                <View style={[styles.managementActionIcon, { backgroundColor: action.color + '15' }]}>
                  <Text style={styles.managementActionIconText}>{action.icon}</Text>
                </View>
                <View style={styles.managementActionContent}>
                  <Text style={[
                    styles.managementActionTitle,
                    action.destructive && styles.destructiveActionText,
                  ]}>
                    {action.title}
                  </Text>
                  <Text style={styles.managementActionDescription}>
                    {action.description}
                  </Text>
                </View>
              </View>
              <Text style={styles.managementActionArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
});

// Library Statistics Component
export const LibraryStats = memo<{
  totalRecipes: number;
  favoriteCount: number;
  recentlyAddedCount: number;
  mostCookedRecipe?: string;
}>(({ totalRecipes, favoriteCount, recentlyAddedCount, mostCookedRecipe }) => {
  const stats = [
    { icon: '📚', label: 'Total Recipes', value: totalRecipes.toString() },
    { icon: '❤️', label: 'Favorites', value: favoriteCount.toString() },
    { icon: '🆕', label: 'Recently Added', value: recentlyAddedCount.toString() },
    { 
      icon: '🏆', 
      label: 'Most Cooked', 
      value: mostCookedRecipe || 'None' 
    },
  ];

  return (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>📊 Library Statistics</Text>
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// Backup & Export Component
export const BackupExportModal = memo<{
  visible: boolean;
  onClose: () => void;
  onBackupAll: () => void;
  onExportCollection: (collectionId: string) => void;
  onImportRecipes: () => void;
  collections: RecipeCollection[];
}>(({ visible, onClose, onBackupAll, onExportCollection, onImportRecipes, collections }) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCloseButton}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Backup & Export</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.backupSection}>
            <Text style={styles.backupSectionTitle}>📦 Full Backup</Text>
            <Text style={styles.backupSectionDescription}>
              Create a complete backup of your recipe library including collections, notes, and ratings.
            </Text>
            <TouchableOpacity style={styles.backupButton} onPress={onBackupAll}>
              <Text style={styles.backupButtonText}>💾 Create Full Backup</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.backupSection}>
            <Text style={styles.backupSectionTitle}>📤 Export Collections</Text>
            <Text style={styles.backupSectionDescription}>
              Export individual collections to share or transfer to other devices.
            </Text>
            {collections.map((collection) => (
              <TouchableOpacity
                key={collection.id}
                style={styles.exportCollectionButton}
                onPress={() => onExportCollection(collection.id)}
              >
                <Text style={styles.exportCollectionIcon}>{collection.icon}</Text>
                <Text style={styles.exportCollectionName}>{collection.name}</Text>
                <Text style={styles.exportArrow}>📤</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.backupSection}>
            <Text style={styles.backupSectionTitle}>📥 Import Recipes</Text>
            <Text style={styles.backupSectionDescription}>
              Import recipes from backup files or other recipe apps.
            </Text>
            <TouchableOpacity style={styles.importButton} onPress={onImportRecipes}>
              <Text style={styles.importButtonText}>📥 Import Recipes</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.backupSection}>
            <Text style={styles.backupSectionTitle}>ℹ️ Backup Information</Text>
            <Text style={styles.backupInfo}>
              • Backups include all recipe data, personal notes, and ratings{'\n'}
              • Collections and custom tags are preserved{'\n'}
              • Files are saved in JSON format for compatibility{'\n'}
              • No personal data is shared with external services
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
});

// Empty State Component
export const EmptyLibraryState = memo<{
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  icon?: string;
}>(({ title, message, actionText, onAction, icon = '📚' }) => {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>{icon}</Text>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateMessage}>{message}</Text>
      {actionText && onAction && (
        <TouchableOpacity style={styles.emptyStateButton} onPress={onAction}>
          <Text style={styles.emptyStateButtonText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  // Collection Card Styles
  collectionCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  collectionCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  collectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 18,
  },
  collectionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  systemBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Recipe Card Styles
  recipeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  recipeCardGrid: {
    width: GRID_CARD_WIDTH,
    marginHorizontal: CARD_MARGIN / 2,
  },
  recipeCardList: {
    marginHorizontal: 16,
    flexDirection: 'row',
  },
  recipeCardCompact: {
    marginHorizontal: 16,
    paddingVertical: 8,
  },
  imageContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    margin: 12,
  },
  recipeImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    margin: 12,
  },
  imagePlaceholderText: {
    fontSize: 32,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteActive: {
    fontSize: 18,
  },
  favoriteInactive: {
    fontSize: 18,
  },
  recipeInfo: {
    padding: 12,
    flex: 1,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cookingTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginRight: 12,
  },
  personalRating: {
    fontSize: 12,
    color: '#FF9500',
  },
  lastCooked: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },

  // Compact View Styles
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  compactImageContainer: {
    marginRight: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  // Search Bar Styles
  searchContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 16,
    color: '#8E8E93',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    color: '#1C1C1E',
  },
  loadingIndicator: {
    fontSize: 16,
    marginLeft: 8,
  },
  searchActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchActionButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
  },
  searchActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
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
  modalActionButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  disabledButton: {
    color: '#8E8E93',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Collection Option Styles
  collectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  collectionOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collectionOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  collectionOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  collectionOptionDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  collectionOptionRight: {
    marginLeft: 16,
  },

  // Form Styles
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1C1C1E',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: 'white',
    elevation: 4,
    shadowOpacity: 0.3,
  },
  iconOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
  },
  selectedIconOption: {
    backgroundColor: '#007AFF',
  },
  iconOptionText: {
    fontSize: 20,
  },
  preview: {
    marginTop: 24,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  collectionPreview: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  previewIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Empty State Styles
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
  emptyStateMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Recipe Management Modal Styles
  managementModalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  managementModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  recipePreviewCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F2F2F7',
    marginBottom: 8,
  },
  recipePreviewImage: {
    marginRight: 12,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  previewImagePlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImageIcon: {
    fontSize: 24,
  },
  recipePreviewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  recipePreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  recipePreviewMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  managementActions: {
    flex: 1,
  },
  managementAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  destructiveAction: {
    backgroundColor: '#FF3B3015',
  },
  managementActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  managementActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  managementActionIconText: {
    fontSize: 20,
  },
  managementActionContent: {
    flex: 1,
  },
  managementActionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  destructiveActionText: {
    color: '#FF3B30',
  },
  managementActionDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  managementActionArrow: {
    fontSize: 20,
    color: '#C7C7CC',
    marginLeft: 12,
  },

  // Library Statistics Styles
  statsContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Backup & Export Styles
  backupSection: {
    marginBottom: 32,
  },
  backupSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  backupSectionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 16,
  },
  backupButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  exportCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exportCollectionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  exportCollectionName: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  exportArrow: {
    fontSize: 16,
  },
  importButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  importButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backupInfo: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
});