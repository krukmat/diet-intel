-- User Taste Profile Tables for Recipe AI Learning System
-- Phase R.3.1.1: User Taste Profile Analysis Implementation
-- Date: September 13, 2025

-- ===== USER TASTE PROFILES =====

-- Main user taste profiles table
CREATE TABLE IF NOT EXISTS user_taste_profiles (
    user_id TEXT PRIMARY KEY,

    -- Learning status
    profile_confidence REAL DEFAULT 0.0 CHECK (profile_confidence >= 0.0 AND profile_confidence <= 1.0),
    total_ratings_analyzed INTEGER DEFAULT 0,
    last_learning_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Cuisine preferences (JSON array of objects: [{cuisine: "italian", score: 0.85, count: 12}])
    cuisine_preferences TEXT DEFAULT '[]',

    -- Difficulty preferences (JSON object: {"easy": 0.3, "medium": 0.6, "hard": 0.1})
    difficulty_preferences TEXT DEFAULT '{}',

    -- Ingredient preferences (JSON array of objects: [{ingredient: "tomatoes", preference: 0.8, frequency: 5}])
    liked_ingredients TEXT DEFAULT '[]',
    disliked_ingredients TEXT DEFAULT '[]',

    -- Cooking method preferences (JSON object: {"prep": 0.5, "baking": 0.8, "frying": 0.2})
    cooking_method_preferences TEXT DEFAULT '{}',

    -- Time preferences
    preferred_prep_time_minutes INTEGER DEFAULT 30,
    preferred_cook_time_minutes INTEGER DEFAULT 45,
    quick_meal_preference REAL DEFAULT 0.5 CHECK (quick_meal_preference >= 0.0 AND quick_meal_preference <= 1.0),

    -- Nutritional preferences (learned from highly rated recipes)
    preferred_calories_per_serving REAL DEFAULT 400.0,
    preferred_protein_ratio REAL DEFAULT 0.2 CHECK (preferred_protein_ratio >= 0.0 AND preferred_protein_ratio <= 1.0),
    preferred_carb_ratio REAL DEFAULT 0.5 CHECK (preferred_carb_ratio >= 0.0 AND preferred_carb_ratio <= 1.0),
    preferred_fat_ratio REAL DEFAULT 0.3 CHECK (preferred_fat_ratio >= 0.0 AND preferred_fat_ratio <= 1.0),

    -- Behavioral patterns
    modification_tendency REAL DEFAULT 0.0 CHECK (modification_tendency >= 0.0 AND modification_tendency <= 1.0),
    repeat_cooking_tendency REAL DEFAULT 0.5 CHECK (repeat_cooking_tendency >= 0.0 AND repeat_cooking_tendency <= 1.0),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cuisine preference learning table (detailed tracking)
CREATE TABLE IF NOT EXISTS user_cuisine_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    cuisine_type TEXT NOT NULL,

    -- Learning metrics
    preference_score REAL DEFAULT 0.0 CHECK (preference_score >= -1.0 AND preference_score <= 1.0),
    total_ratings INTEGER DEFAULT 0,
    positive_ratings INTEGER DEFAULT 0,
    average_user_rating REAL DEFAULT 0.0,

    -- Behavioral indicators
    would_make_again_ratio REAL DEFAULT 0.0,
    modification_ratio REAL DEFAULT 0.0,

    -- Temporal tracking
    first_rated_at TIMESTAMP,
    last_rated_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, cuisine_type)
);

-- Ingredient preference learning table
CREATE TABLE IF NOT EXISTS user_ingredient_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ingredient_name TEXT NOT NULL,

    -- Preference metrics
    preference_score REAL DEFAULT 0.0 CHECK (preference_score >= -1.0 AND preference_score <= 1.0),
    confidence_level REAL DEFAULT 0.0 CHECK (confidence_level >= 0.0 AND confidence_level <= 1.0),

    -- Recipe exposure
    recipes_containing_ingredient INTEGER DEFAULT 0,
    positive_recipes INTEGER DEFAULT 0,
    negative_recipes INTEGER DEFAULT 0,

    -- Learning context
    average_rating_with_ingredient REAL DEFAULT 0.0,
    would_make_again_with_ingredient REAL DEFAULT 0.0,

    -- Classification
    preference_category TEXT CHECK (preference_category IN ('loved', 'liked', 'neutral', 'disliked', 'avoided')),

    -- Metadata
    first_encountered_at TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, ingredient_name)
);

-- Recipe recommendation cache (for personalized suggestions)
CREATE TABLE IF NOT EXISTS user_recipe_recommendations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,

    -- Recommendation metrics
    recommendation_score REAL DEFAULT 0.0 CHECK (recommendation_score >= 0.0 AND recommendation_score <= 1.0),
    reason_codes TEXT DEFAULT '[]', -- JSON array of recommendation reasons

    -- Personalization factors
    cuisine_match_score REAL DEFAULT 0.0,
    ingredient_match_score REAL DEFAULT 0.0,
    difficulty_match_score REAL DEFAULT 0.0,
    time_match_score REAL DEFAULT 0.0,
    nutrition_match_score REAL DEFAULT 0.0,

    -- Status tracking
    shown_to_user BOOLEAN DEFAULT FALSE,
    user_interaction TEXT, -- 'viewed', 'saved', 'rated', 'ignored'
    interaction_timestamp TIMESTAMP,

    -- Cache management
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (datetime(CURRENT_TIMESTAMP, '+7 days')),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    UNIQUE(user_id, recipe_id)
);

-- ===== LEARNING ANALYTICS TABLES =====

-- User learning progress tracking
CREATE TABLE IF NOT EXISTS user_learning_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Learning milestones
    ratings_milestone INTEGER DEFAULT 0, -- 5, 10, 25, 50, 100 ratings
    cuisines_explored INTEGER DEFAULT 0,
    ingredients_learned INTEGER DEFAULT 0,

    -- Learning quality metrics
    profile_accuracy_score REAL DEFAULT 0.0,
    recommendation_success_rate REAL DEFAULT 0.0,

    -- Learning insights (JSON)
    dominant_cuisine TEXT,
    flavor_profile TEXT, -- 'spicy', 'mild', 'sweet', 'savory', 'balanced'
    cooking_complexity_preference TEXT, -- 'simple', 'moderate', 'complex'

    -- Achievement tracking
    achievements TEXT DEFAULT '[]', -- JSON array of earned achievements

    -- Metadata
    learning_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_milestone_reached_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===== INDEXES FOR PERFORMANCE =====

-- User taste profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_taste_profiles_confidence ON user_taste_profiles(profile_confidence);
CREATE INDEX IF NOT EXISTS idx_user_taste_profiles_updated ON user_taste_profiles(last_learning_update);

-- Cuisine preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_cuisine_preferences_user_id ON user_cuisine_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cuisine_preferences_cuisine ON user_cuisine_preferences(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_user_cuisine_preferences_score ON user_cuisine_preferences(preference_score DESC);

-- Ingredient preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_ingredient_preferences_user_id ON user_ingredient_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ingredient_preferences_ingredient ON user_ingredient_preferences(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_user_ingredient_preferences_score ON user_ingredient_preferences(preference_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_ingredient_preferences_category ON user_ingredient_preferences(preference_category);

-- Recommendations indexes
CREATE INDEX IF NOT EXISTS idx_user_recipe_recommendations_user_id ON user_recipe_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recipe_recommendations_score ON user_recipe_recommendations(recommendation_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_recipe_recommendations_expires ON user_recipe_recommendations(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_recipe_recommendations_shown ON user_recipe_recommendations(shown_to_user, generated_at);

-- Learning progress indexes
CREATE INDEX IF NOT EXISTS idx_user_learning_progress_user_id ON user_learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_progress_milestone ON user_learning_progress(ratings_milestone);

-- ===== TRIGGERS FOR AUTOMATIC UPDATES =====

-- Update user_taste_profiles updated_at on changes
CREATE TRIGGER IF NOT EXISTS update_user_taste_profiles_timestamp
AFTER UPDATE ON user_taste_profiles
FOR EACH ROW
BEGIN
    UPDATE user_taste_profiles SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

-- Update user_cuisine_preferences timestamp
CREATE TRIGGER IF NOT EXISTS update_cuisine_preferences_timestamp
AFTER UPDATE ON user_cuisine_preferences
FOR EACH ROW
BEGIN
    UPDATE user_cuisine_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update user_ingredient_preferences timestamp
CREATE TRIGGER IF NOT EXISTS update_ingredient_preferences_timestamp
AFTER UPDATE ON user_ingredient_preferences
FOR EACH ROW
BEGIN
    UPDATE user_ingredient_preferences SET last_updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Clean expired recommendations
CREATE TRIGGER IF NOT EXISTS clean_expired_recommendations
AFTER INSERT ON user_recipe_recommendations
FOR EACH ROW
BEGIN
    DELETE FROM user_recipe_recommendations
    WHERE expires_at < CURRENT_TIMESTAMP AND user_id = NEW.user_id;
END;

-- ===== SAMPLE DATA FOR DEVELOPMENT =====

-- Sample taste profile for testing
INSERT OR IGNORE INTO user_taste_profiles (
    user_id, profile_confidence, total_ratings_analyzed,
    cuisine_preferences, difficulty_preferences,
    liked_ingredients, cooking_method_preferences,
    preferred_prep_time_minutes, preferred_cook_time_minutes
) VALUES (
    'sample_user',
    0.75,
    15,
    '[{"cuisine": "mediterranean", "score": 0.9, "count": 8}, {"cuisine": "italian", "score": 0.7, "count": 5}, {"cuisine": "mexican", "score": 0.6, "count": 2}]',
    '{"easy": 0.4, "medium": 0.5, "hard": 0.1}',
    '[{"ingredient": "olive oil", "preference": 0.9, "frequency": 8}, {"ingredient": "tomatoes", "preference": 0.8, "frequency": 6}]',
    '{"prep": 0.6, "baking": 0.4, "grilling": 0.3}',
    20,
    30
);

-- Sample cuisine preferences
INSERT OR IGNORE INTO user_cuisine_preferences (
    id, user_id, cuisine_type, preference_score, total_ratings,
    positive_ratings, average_user_rating, would_make_again_ratio
) VALUES
('pref_med_1', 'sample_user', 'mediterranean', 0.9, 8, 7, 4.5, 0.875),
('pref_ita_1', 'sample_user', 'italian', 0.7, 5, 4, 4.2, 0.8);

-- Sample ingredient preferences
INSERT OR IGNORE INTO user_ingredient_preferences (
    id, user_id, ingredient_name, preference_score, confidence_level,
    recipes_containing_ingredient, positive_recipes, preference_category
) VALUES
('ing_pref_1', 'sample_user', 'olive oil', 0.9, 0.8, 8, 7, 'loved'),
('ing_pref_2', 'sample_user', 'tomatoes', 0.8, 0.7, 6, 5, 'liked'),
('ing_pref_3', 'sample_user', 'cilantro', -0.6, 0.5, 3, 1, 'disliked');