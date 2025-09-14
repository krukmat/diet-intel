-- Smart Shopping Intelligence Database Schema
-- Phase R.3 Task 9: Smart Shopping Optimization Data Model
-- Extends Recipe AI database with advanced shopping optimization features
-- SQLite implementation

-- ===== SHOPPING OPTIMIZATION TABLES =====

-- Store information and layout optimization
CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    store_chain TEXT,
    location TEXT,
    layout_data TEXT, -- JSON with aisle/section mappings
    avg_prices_data TEXT, -- JSON with ingredient price averages
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product categories for store layout optimization
CREATE TABLE IF NOT EXISTS product_categories (
    id TEXT PRIMARY KEY,
    category_name TEXT NOT NULL UNIQUE,
    parent_category_id TEXT,
    typical_aisle TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category_id) REFERENCES product_categories(id) ON DELETE SET NULL
);

-- Enhanced shopping optimizations table (replacing basic shopping_lists functionality)
CREATE TABLE IF NOT EXISTS shopping_optimizations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    optimization_name TEXT NOT NULL,
    recipe_ids TEXT NOT NULL, -- JSON array of recipe IDs being optimized

    -- Consolidation data
    total_unique_ingredients INTEGER DEFAULT 0,
    consolidation_opportunities INTEGER DEFAULT 0,
    consolidated_ingredients TEXT, -- JSON of consolidated ingredient data

    -- Cost optimization data
    estimated_total_cost REAL DEFAULT 0.0,
    bulk_buying_opportunities TEXT, -- JSON array of bulk buying suggestions
    cost_savings_potential REAL DEFAULT 0.0,
    cost_per_serving REAL DEFAULT 0.0,

    -- Store optimization data
    preferred_store_id TEXT,
    shopping_path_optimization TEXT, -- JSON with optimized shopping route
    estimated_shopping_time_minutes INTEGER DEFAULT 0,

    -- Status and metadata
    optimization_status TEXT DEFAULT 'pending' CHECK (optimization_status IN ('pending', 'optimized', 'used', 'expired')),
    optimization_score REAL DEFAULT 0.0, -- Overall optimization quality score
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (preferred_store_id) REFERENCES stores(id) ON DELETE SET NULL
);

-- Ingredient consolidation details for tracking combinations
CREATE TABLE IF NOT EXISTS ingredient_consolidations (
    id TEXT PRIMARY KEY,
    shopping_optimization_id TEXT NOT NULL,
    consolidated_ingredient_name TEXT NOT NULL,

    -- Source recipes and quantities
    source_recipes TEXT NOT NULL, -- JSON array of {recipe_id, original_quantity, unit}
    total_consolidated_quantity REAL NOT NULL,
    final_unit TEXT NOT NULL,

    -- Cost and optimization data
    unit_cost REAL DEFAULT 0.0,
    total_cost REAL DEFAULT 0.0,
    bulk_discount_available BOOLEAN DEFAULT FALSE,
    suggested_package_size REAL,
    suggested_package_unit TEXT,

    -- Store location data
    product_category_id TEXT,
    typical_aisle TEXT,
    store_section TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shopping_optimization_id) REFERENCES shopping_optimizations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_category_id) REFERENCES product_categories(id) ON DELETE SET NULL
);

-- Bulk buying opportunities and recommendations
CREATE TABLE IF NOT EXISTS bulk_buying_suggestions (
    id TEXT PRIMARY KEY,
    shopping_optimization_id TEXT NOT NULL,
    ingredient_consolidation_id TEXT NOT NULL,

    -- Bulk buying details
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('bulk_discount', 'family_pack', 'warehouse_store', 'subscription')),
    current_needed_quantity REAL NOT NULL,
    suggested_bulk_quantity REAL NOT NULL,
    bulk_unit TEXT NOT NULL,

    -- Cost analysis
    regular_unit_price REAL NOT NULL,
    bulk_unit_price REAL NOT NULL,
    immediate_savings REAL DEFAULT 0.0,
    cost_per_unit_savings REAL DEFAULT 0.0,

    -- Storage and usage considerations
    storage_requirements TEXT, -- refrigerated, frozen, pantry, etc.
    estimated_usage_timeframe_days INTEGER,
    perishability_risk TEXT CHECK (perishability_risk IN ('low', 'medium', 'high')),

    -- Recommendation scoring
    recommendation_score REAL DEFAULT 0.0,
    user_preference_match REAL DEFAULT 0.5, -- How well this matches user's shopping patterns

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shopping_optimization_id) REFERENCES shopping_optimizations(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_consolidation_id) REFERENCES ingredient_consolidations(id) ON DELETE CASCADE
);

-- Shopping path optimization for efficient store navigation
CREATE TABLE IF NOT EXISTS shopping_path_segments (
    id TEXT PRIMARY KEY,
    shopping_optimization_id TEXT NOT NULL,
    segment_order INTEGER NOT NULL,

    -- Store navigation data
    store_section TEXT NOT NULL,
    aisle_number TEXT,
    section_description TEXT,

    -- Items to collect in this segment
    ingredient_consolidation_ids TEXT NOT NULL, -- JSON array of ingredient IDs to collect here
    estimated_time_minutes INTEGER DEFAULT 0,

    -- Navigation guidance
    navigation_notes TEXT,
    previous_segment_id TEXT,
    next_segment_id TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shopping_optimization_id) REFERENCES shopping_optimizations(id) ON DELETE CASCADE,
    FOREIGN KEY (previous_segment_id) REFERENCES shopping_path_segments(id) ON DELETE SET NULL,
    FOREIGN KEY (next_segment_id) REFERENCES shopping_path_segments(id) ON DELETE SET NULL
);

-- User shopping preferences and behavior tracking
CREATE TABLE IF NOT EXISTS user_shopping_preferences (
    user_id TEXT PRIMARY KEY,

    -- Store preferences
    preferred_stores TEXT, -- JSON array of preferred store IDs
    budget_conscious_level REAL DEFAULT 0.5, -- 0.0 = convenience focused, 1.0 = cost focused
    bulk_buying_preference REAL DEFAULT 0.5, -- User's tendency to buy in bulk

    -- Shopping behavior patterns
    average_shopping_frequency_days INTEGER DEFAULT 7,
    typical_shopping_time_minutes INTEGER DEFAULT 45,
    prefers_organic BOOLEAN DEFAULT FALSE,
    prefers_name_brands BOOLEAN DEFAULT FALSE,

    -- Optimization preferences
    prioritize_cost_savings BOOLEAN DEFAULT TRUE,
    prioritize_shopping_time BOOLEAN DEFAULT FALSE,
    prioritize_ingredient_quality BOOLEAN DEFAULT FALSE,

    -- Learning from behavior
    actual_vs_estimated_accuracy REAL DEFAULT 0.0,
    cost_prediction_accuracy REAL DEFAULT 0.0,
    time_prediction_accuracy REAL DEFAULT 0.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Shopping optimization analytics for system improvement
CREATE TABLE IF NOT EXISTS shopping_optimization_analytics (
    id TEXT PRIMARY KEY,
    shopping_optimization_id TEXT NOT NULL,
    user_id TEXT,

    -- Performance metrics
    optimization_generation_time_ms REAL DEFAULT 0.0,
    consolidation_efficiency_score REAL DEFAULT 0.0, -- How well ingredients were consolidated
    cost_prediction_accuracy REAL DEFAULT 0.0, -- Actual vs predicted costs
    time_prediction_accuracy REAL DEFAULT 0.0, -- Actual vs predicted shopping time

    -- User feedback
    user_satisfaction_rating INTEGER CHECK (user_satisfaction_rating >= 1 AND user_satisfaction_rating <= 5),
    used_bulk_suggestions BOOLEAN DEFAULT FALSE,
    followed_shopping_path BOOLEAN DEFAULT FALSE,
    reported_issues TEXT, -- JSON array of issues encountered

    -- Actual outcomes
    actual_total_cost REAL,
    actual_shopping_time_minutes INTEGER,
    items_not_found INTEGER DEFAULT 0,
    substitutions_made INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shopping_optimization_id) REFERENCES shopping_optimizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ===== INDEXES FOR PERFORMANCE =====

-- Store indexes
CREATE INDEX IF NOT EXISTS idx_stores_chain ON stores(store_chain);
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores(location);

-- Product categories indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_name ON product_categories(category_name);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_aisle ON product_categories(typical_aisle);

-- Shopping optimizations indexes
CREATE INDEX IF NOT EXISTS idx_shopping_optimizations_user_id ON shopping_optimizations(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_optimizations_status ON shopping_optimizations(optimization_status);
CREATE INDEX IF NOT EXISTS idx_shopping_optimizations_created_at ON shopping_optimizations(created_at);
CREATE INDEX IF NOT EXISTS idx_shopping_optimizations_expires_at ON shopping_optimizations(expires_at);
CREATE INDEX IF NOT EXISTS idx_shopping_optimizations_store ON shopping_optimizations(preferred_store_id);
CREATE INDEX IF NOT EXISTS idx_shopping_optimizations_score ON shopping_optimizations(optimization_score);

-- Ingredient consolidations indexes
CREATE INDEX IF NOT EXISTS idx_ingredient_consolidations_optimization_id ON ingredient_consolidations(shopping_optimization_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_consolidations_name ON ingredient_consolidations(consolidated_ingredient_name);
CREATE INDEX IF NOT EXISTS idx_ingredient_consolidations_category ON ingredient_consolidations(product_category_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_consolidations_aisle ON ingredient_consolidations(typical_aisle);

-- Bulk buying suggestions indexes
CREATE INDEX IF NOT EXISTS idx_bulk_buying_suggestions_optimization_id ON bulk_buying_suggestions(shopping_optimization_id);
CREATE INDEX IF NOT EXISTS idx_bulk_buying_suggestions_type ON bulk_buying_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_bulk_buying_suggestions_score ON bulk_buying_suggestions(recommendation_score);
CREATE INDEX IF NOT EXISTS idx_bulk_buying_suggestions_savings ON bulk_buying_suggestions(immediate_savings);

-- Shopping path segments indexes
CREATE INDEX IF NOT EXISTS idx_shopping_path_segments_optimization_id ON shopping_path_segments(shopping_optimization_id);
CREATE INDEX IF NOT EXISTS idx_shopping_path_segments_order ON shopping_path_segments(segment_order);
CREATE INDEX IF NOT EXISTS idx_shopping_path_segments_section ON shopping_path_segments(store_section);

-- User shopping preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_shopping_preferences_stores ON user_shopping_preferences(preferred_stores);
CREATE INDEX IF NOT EXISTS idx_user_shopping_preferences_budget ON user_shopping_preferences(budget_conscious_level);

-- Shopping optimization analytics indexes
CREATE INDEX IF NOT EXISTS idx_shopping_optimization_analytics_optimization_id ON shopping_optimization_analytics(shopping_optimization_id);
CREATE INDEX IF NOT EXISTS idx_shopping_optimization_analytics_user_id ON shopping_optimization_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_optimization_analytics_rating ON shopping_optimization_analytics(user_satisfaction_rating);
CREATE INDEX IF NOT EXISTS idx_shopping_optimization_analytics_created_at ON shopping_optimization_analytics(created_at);

-- ===== TRIGGERS FOR AUTOMATIC TIMESTAMPS =====

-- Update updated_at trigger for stores table
CREATE TRIGGER IF NOT EXISTS update_stores_updated_at
AFTER UPDATE ON stores
FOR EACH ROW
BEGIN
    UPDATE stores SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update updated_at trigger for user shopping preferences
CREATE TRIGGER IF NOT EXISTS update_user_shopping_preferences_updated_at
AFTER UPDATE ON user_shopping_preferences
FOR EACH ROW
BEGIN
    UPDATE user_shopping_preferences SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

-- Auto-calculate consolidation efficiency when consolidations are added
CREATE TRIGGER IF NOT EXISTS calculate_consolidation_efficiency
AFTER INSERT ON ingredient_consolidations
FOR EACH ROW
BEGIN
    UPDATE shopping_optimizations
    SET
        total_unique_ingredients = (
            SELECT COUNT(*)
            FROM ingredient_consolidations
            WHERE shopping_optimization_id = NEW.shopping_optimization_id
        ),
        consolidation_opportunities = (
            SELECT COUNT(*)
            FROM ingredient_consolidations ic
            WHERE ic.shopping_optimization_id = NEW.shopping_optimization_id
            AND JSON_ARRAY_LENGTH(ic.source_recipes) > 1
        )
    WHERE id = NEW.shopping_optimization_id;
END;

-- Auto-update cost estimates when bulk suggestions are added
CREATE TRIGGER IF NOT EXISTS update_cost_estimates
AFTER INSERT ON bulk_buying_suggestions
FOR EACH ROW
BEGIN
    UPDATE shopping_optimizations
    SET
        cost_savings_potential = COALESCE(cost_savings_potential, 0) + NEW.immediate_savings,
        optimization_score = (
            SELECT AVG(recommendation_score)
            FROM bulk_buying_suggestions
            WHERE shopping_optimization_id = NEW.shopping_optimization_id
        )
    WHERE id = NEW.shopping_optimization_id;
END;

-- ===== SAMPLE DATA FOR DEVELOPMENT =====

-- Sample store data
INSERT OR IGNORE INTO stores (id, name, store_chain, location, layout_data)
VALUES
('store_whole_foods_sf', 'Whole Foods Market', 'Whole Foods', 'San Francisco, CA', '{"produce": "aisle_1", "dairy": "aisle_2", "meat": "aisle_3", "pantry": "aisles_4-8", "frozen": "aisle_9", "bakery": "aisle_10"}'),
('store_safeway_sf', 'Safeway', 'Safeway', 'San Francisco, CA', '{"produce": "aisle_1-2", "dairy": "aisle_3", "meat": "aisle_4", "pantry": "aisles_5-10", "frozen": "aisle_11", "bakery": "aisle_12"}');

-- Sample product categories
INSERT OR IGNORE INTO product_categories (id, category_name, typical_aisle, sort_order)
VALUES
('cat_produce', 'Fresh Produce', 'produce', 1),
('cat_vegetables', 'Vegetables', 'produce', 2),
('cat_fruits', 'Fruits', 'produce', 3),
('cat_herbs', 'Fresh Herbs', 'produce', 4),
('cat_dairy', 'Dairy & Eggs', 'dairy', 5),
('cat_meat', 'Meat & Seafood', 'meat', 6),
('cat_pantry_staples', 'Pantry Staples', 'pantry', 7),
('cat_oils_vinegars', 'Oils & Vinegars', 'pantry', 8),
('cat_spices', 'Spices & Seasonings', 'pantry', 9),
('cat_canned_goods', 'Canned Goods', 'pantry', 10),
('cat_frozen', 'Frozen Foods', 'frozen', 11),
('cat_bakery', 'Bakery', 'bakery', 12);

-- Update product categories with parent relationships
UPDATE product_categories SET parent_category_id = 'cat_produce' WHERE id IN ('cat_vegetables', 'cat_fruits', 'cat_herbs');