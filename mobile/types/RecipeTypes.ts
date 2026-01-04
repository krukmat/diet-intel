// Enhanced Recipe Types with Optimization Patterns
// Using readonly for immutability, optional properties for memory efficiency

export interface BaseRecipe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cookingTime: number;
  readonly servings?: number;
  readonly difficulty: 'beginner' | 'intermediate' | 'advanced';
  readonly rating: number;
  readonly totalRatings: number;
  readonly calories: number;
  readonly cuisineType: string;
  readonly tags: readonly string[];
  readonly dietaryRestrictions?: readonly string[];
  readonly imageUrl?: string;
  readonly ingredients?: readonly RecipeIngredient[];
  readonly instructions?: readonly RecipeInstruction[];
}

export interface RecipeIngredient {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly unit: string;
  readonly category?: string;
}

export interface RecipeInstruction {
  readonly step: number;
  readonly instruction: string;
  readonly timeMinutes?: number;
}

// Personal Recipe Enhancement (extending base recipe)
export interface PersonalRecipe extends BaseRecipe {
  readonly personalMetadata: PersonalRecipeMetadata;
  readonly collections: readonly string[];
  readonly personalTags: readonly string[];
}

export interface PersonalRecipeMetadata {
  readonly dateAdded: Date;
  readonly lastModified?: Date;
  readonly lastCooked?: Date;
  readonly timesCooked: number;
  readonly personalRating?: number;
  readonly personalNotes?: string;
  readonly modifications?: string;
  readonly source: 'generated' | 'search' | 'custom' | 'imported';
  readonly isFavorite: boolean;
  readonly cookingDifficulty?: 'easy' | 'moderate' | 'challenging'; // Personal assessment
}

// Collection System (using Strategy Pattern)
export interface RecipeCollection {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly color: string;
  readonly icon: string;
  readonly isSystem: boolean; // System collections vs user-created
  readonly createdAt: Date;
  readonly recipeCount: number;
  readonly sortOrder: number;
}

// Predefined system collections
export const SYSTEM_COLLECTIONS = {
  FAVORITES: 'favorites',
  RECENTLY_ADDED: 'recently_added',
  FREQUENTLY_COOKED: 'frequently_cooked',
  WANT_TO_TRY: 'want_to_try',
  CUSTOM_RECIPES: 'custom_recipes',
} as const;

// Search and Filter Types (optimized for performance)
export interface LibrarySearchFilters {
  readonly collections?: readonly string[];
  readonly personalTags?: readonly string[];
  readonly cuisineTypes?: readonly string[];
  readonly dietaryRestrictions?: readonly string[];
  readonly difficulty?: readonly string[];
  readonly cookingTime?: { readonly min: number; readonly max: number };
  readonly cookingTimeRange?: { readonly min: number; readonly max: number };
  readonly calories?: { readonly min: number; readonly max: number };
  readonly calorieRange?: { readonly min: number; readonly max: number };
  readonly minRating?: number;
  readonly personalRatingMin?: number;
  readonly lastCookedWithin?: number; // days
  readonly source?: readonly ('generated' | 'search' | 'custom' | 'imported')[];
}

export interface LibrarySortOptions {
  readonly field: 'dateAdded' | 'name' | 'personalRating' | 'timesCooked' | 'lastCooked' | 'cookingTime';
  readonly direction: 'asc' | 'desc';
}

// View Configuration (using State Pattern)
export interface LibraryViewConfig {
  readonly viewMode: 'grid' | 'list' | 'compact';
  readonly itemsPerPage: number;
  readonly sortOptions: LibrarySortOptions;
  readonly activeFilters: LibrarySearchFilters;
}

// Recipe Storage Events (using Observer Pattern)
export interface RecipeStorageEvent {
  readonly type: 'added' | 'removed' | 'updated' | 'collection_changed';
  readonly recipeId: string;
  readonly timestamp: Date;
  readonly details?: Record<string, unknown>;
}

// Performance optimization interfaces
export interface RecipeListItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly imageUrl?: string;
  readonly cookingTime: number;
  readonly difficulty?: 'beginner' | 'intermediate' | 'advanced';
  readonly personalRating?: number;
  readonly calories?: number;
  readonly cuisineType?: string;
  readonly tags?: readonly string[];
  readonly personalMetadata?: PersonalRecipeMetadata;
  readonly isFavorite: boolean;
  readonly collections: readonly string[];
  readonly lastCooked?: Date;
}

export interface PaginatedRecipeResult {
  readonly items: readonly RecipeListItem[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly currentPage: number;
}

// Error handling
export interface RecipeStorageError {
  readonly code: 'STORAGE_FULL' | 'INVALID_DATA' | 'NOT_FOUND' | 'PERMISSION_DENIED';
  readonly message: string;
  readonly recipeId?: string;
}
