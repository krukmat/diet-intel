-- Recipe AI Generator Database Schema
-- Extends existing DietIntel database with recipe functionality
-- SQLite implementation

-- ===== RECIPE TABLES =====

-- Main recipes table
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    cuisine_type TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    servings INTEGER DEFAULT 4,
    created_by TEXT DEFAULT 'ai_generated' CHECK (created_by IN ('ai_generated', 'user_created')),
    confidence_score REAL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    generation_time_ms REAL,
    tags TEXT, -- JSON array of tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Recipe ingredients table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    ingredient_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    barcode TEXT, -- Link to products table if available
    calories_per_unit REAL DEFAULT 0.0,
    protein_g_per_unit REAL DEFAULT 0.0,
    fat_g_per_unit REAL DEFAULT 0.0,
    carbs_g_per_unit REAL DEFAULT 0.0,
    is_optional BOOLEAN DEFAULT FALSE,
    preparation_note TEXT,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (barcode) REFERENCES products(barcode) ON DELETE SET NULL
);

-- Recipe instructions table  
CREATE TABLE IF NOT EXISTS recipe_instructions (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    cooking_method TEXT,
    duration_minutes INTEGER,
    temperature_celsius INTEGER,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Recipe nutrition summary table
CREATE TABLE IF NOT EXISTS recipe_nutrition (
    recipe_id TEXT PRIMARY KEY,
    calories_per_serving REAL DEFAULT 0.0,
    protein_g_per_serving REAL DEFAULT 0.0,
    fat_g_per_serving REAL DEFAULT 0.0,
    carbs_g_per_serving REAL DEFAULT 0.0,
    fiber_g_per_serving REAL DEFAULT 0.0,
    sugar_g_per_serving REAL DEFAULT 0.0,
    sodium_mg_per_serving REAL DEFAULT 0.0,
    recipe_score REAL DEFAULT 0.0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- User recipe ratings and reviews
CREATE TABLE IF NOT EXISTS user_recipe_ratings (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    recipe_id TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    made_modifications BOOLEAN DEFAULT FALSE,
    would_make_again BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    UNIQUE(user_id, recipe_id) -- One rating per user per recipe
);

-- Recipe generation requests for caching and analytics
CREATE TABLE IF NOT EXISTS recipe_generation_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    cache_key TEXT NOT NULL,
    request_data TEXT NOT NULL, -- JSON of RecipeGenerationRequest
    generated_recipe_id TEXT,
    processing_time_ms REAL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);

-- Shopping lists generated from recipes
CREATE TABLE IF NOT EXISTS shopping_lists (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    recipe_ids TEXT NOT NULL, -- JSON array of recipe IDs
    ingredients_data TEXT NOT NULL, -- JSON of consolidated ingredients
    estimated_cost REAL,
    store_optimization TEXT, -- JSON of store layout optimization
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ===== INDEXES FOR PERFORMANCE =====

-- Recipe indexes
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine_type ON recipes(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON recipes(created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at);
CREATE INDEX IF NOT EXISTS idx_recipes_confidence ON recipes(confidence_score);

-- Recipe ingredients indexes
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_name ON recipe_ingredients(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_barcode ON recipe_ingredients(barcode);

-- Recipe instructions indexes
CREATE INDEX IF NOT EXISTS idx_recipe_instructions_recipe_id ON recipe_instructions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_instructions_step ON recipe_instructions(step_number);

-- Recipe nutrition indexes
CREATE INDEX IF NOT EXISTS idx_recipe_nutrition_calories ON recipe_nutrition(calories_per_serving);

-- User ratings indexes
CREATE INDEX IF NOT EXISTS idx_user_recipe_ratings_user_id ON user_recipe_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recipe_ratings_recipe_id ON user_recipe_ratings(recipe_id);
CREATE INDEX IF NOT EXISTS idx_user_recipe_ratings_rating ON user_recipe_ratings(rating);

-- Recipe generation analytics indexes
CREATE INDEX IF NOT EXISTS idx_recipe_generation_requests_user_id ON recipe_generation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_generation_requests_session ON recipe_generation_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_recipe_generation_requests_cache_key ON recipe_generation_requests(cache_key);
CREATE INDEX IF NOT EXISTS idx_recipe_generation_requests_created_at ON recipe_generation_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_recipe_generation_requests_success ON recipe_generation_requests(success);

-- Shopping lists indexes
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_id ON shopping_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_created_at ON shopping_lists(created_at);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_expires_at ON shopping_lists(expires_at);

-- ===== TRIGGERS FOR AUTOMATIC TIMESTAMPS =====

-- Update updated_at trigger for recipes table
CREATE TRIGGER IF NOT EXISTS update_recipes_updated_at 
AFTER UPDATE ON recipes
FOR EACH ROW
BEGIN
    UPDATE recipes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-calculate recipe nutrition when ingredients change
CREATE TRIGGER IF NOT EXISTS recalculate_recipe_nutrition
AFTER INSERT ON recipe_ingredients
FOR EACH ROW
BEGIN
    INSERT OR REPLACE INTO recipe_nutrition (
        recipe_id, 
        calories_per_serving, 
        protein_g_per_serving, 
        fat_g_per_serving, 
        carbs_g_per_serving,
        calculated_at
    )
    SELECT 
        NEW.recipe_id,
        COALESCE(SUM(ri.quantity * ri.calories_per_unit) / r.servings, 0),
        COALESCE(SUM(ri.quantity * ri.protein_g_per_unit) / r.servings, 0),
        COALESCE(SUM(ri.quantity * ri.fat_g_per_unit) / r.servings, 0),
        COALESCE(SUM(ri.quantity * ri.carbs_g_per_unit) / r.servings, 0),
        CURRENT_TIMESTAMP
    FROM recipe_ingredients ri
    JOIN recipes r ON ri.recipe_id = r.id
    WHERE ri.recipe_id = NEW.recipe_id;
END;

-- ===== SAMPLE DATA FOR DEVELOPMENT =====

-- Sample cuisines reference (for development)
INSERT OR IGNORE INTO recipes (id, name, description, cuisine_type, difficulty_level, prep_time_minutes, cook_time_minutes, servings, created_by, confidence_score, tags)
VALUES 
('sample_mediterranean', 'Sample Mediterranean Salad', 'A healthy Mediterranean-style salad', 'mediterranean', 'easy', 15, 0, 4, 'ai_generated', 0.85, '["mediterranean", "healthy", "vegetarian", "quick"]'),
('sample_italian', 'Sample Pasta Primavera', 'Fresh pasta with seasonal vegetables', 'italian', 'medium', 20, 15, 4, 'ai_generated', 0.90, '["italian", "vegetarian", "pasta", "seasonal"]');

-- Sample ingredients for Mediterranean salad
INSERT OR IGNORE INTO recipe_ingredients (id, recipe_id, ingredient_name, quantity, unit, calories_per_unit, protein_g_per_unit, fat_g_per_unit, carbs_g_per_unit)
VALUES
('ing_1', 'sample_mediterranean', 'Mixed Greens', 100, 'g', 20, 2, 0, 4),
('ing_2', 'sample_mediterranean', 'Olive Oil', 15, 'ml', 884, 0, 100, 0),
('ing_3', 'sample_mediterranean', 'Feta Cheese', 50, 'g', 264, 14, 21, 4);

-- Sample instructions for Mediterranean salad
INSERT OR IGNORE INTO recipe_instructions (id, recipe_id, step_number, instruction, cooking_method)
VALUES
('inst_1', 'sample_mediterranean', 1, 'Wash and dry the mixed greens thoroughly', 'prep'),
('inst_2', 'sample_mediterranean', 2, 'Crumble the feta cheese into bite-sized pieces', 'prep'),
('inst_3', 'sample_mediterranean', 3, 'Drizzle with olive oil and toss gently', 'mixing');