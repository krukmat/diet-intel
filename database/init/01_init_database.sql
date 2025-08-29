-- DietIntel Database Initialization Script
-- This script creates the initial database schema for the nutrition tracking API

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    weight_kg DECIMAL(5,2),
    height_cm INTEGER,
    activity_level VARCHAR(20) CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')),
    goal VARCHAR(20) CHECK (goal IN ('lose_weight', 'maintain_weight', 'gain_weight')),
    dietary_restrictions TEXT[],
    allergies TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create products table (cached product data)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(500),
    brand VARCHAR(255),
    categories TEXT[],
    image_url TEXT,
    serving_size VARCHAR(50),
    -- Nutritional information per 100g
    energy_kcal_100g DECIMAL(8,2),
    protein_100g DECIMAL(8,2),
    fat_100g DECIMAL(8,2),
    carbs_100g DECIMAL(8,2),
    sugars_100g DECIMAL(8,2),
    fiber_100g DECIMAL(8,2),
    salt_100g DECIMAL(8,2),
    sodium_100g DECIMAL(8,2),
    -- Metadata
    data_source VARCHAR(50) DEFAULT 'openfoodfacts',
    data_quality_score DECIMAL(3,2),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create meal plans table
CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    target_calories INTEGER,
    target_protein DECIMAL(6,2),
    target_fat DECIMAL(6,2),
    target_carbs DECIMAL(6,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create meal plan items table
CREATE TABLE IF NOT EXISTS meal_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    -- Manual entry fields (when product_id is NULL)
    manual_name VARCHAR(255),
    manual_calories DECIMAL(8,2),
    manual_protein DECIMAL(8,2),
    manual_fat DECIMAL(8,2),
    manual_carbs DECIMAL(8,2),
    -- Common fields
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    quantity DECIMAL(8,2) NOT NULL DEFAULT 1.0,
    unit VARCHAR(20) DEFAULT 'serving',
    notes TEXT,
    position_in_meal INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create meal plan customizations table (change log)
CREATE TABLE IF NOT EXISTS meal_plan_customizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('swap', 'remove', 'add_manual', 'adjust_calories')),
    description TEXT NOT NULL,
    changes JSONB NOT NULL, -- Store the actual changes made
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create nutrition logs table (for tracking actual consumption)
CREATE TABLE IF NOT EXISTS nutrition_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    product_id UUID REFERENCES products(id),
    -- Manual entry fields
    manual_name VARCHAR(255),
    manual_calories DECIMAL(8,2),
    manual_protein DECIMAL(8,2),
    manual_fat DECIMAL(8,2),
    manual_carbs DECIMAL(8,2),
    -- Common fields
    quantity DECIMAL(8,2) NOT NULL DEFAULT 1.0,
    unit VARCHAR(20) DEFAULT 'serving',
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create OCR processing logs table
CREATE TABLE IF NOT EXISTS ocr_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    image_filename VARCHAR(255),
    processing_method VARCHAR(50) NOT NULL, -- 'local', 'mindee', 'gpt4o', etc.
    confidence_score DECIMAL(3,2),
    extracted_text TEXT,
    parsed_nutrients JSONB,
    processing_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_date ON meal_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plan ON meal_plan_items(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date ON nutrition_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ocr_logs_user ON ocr_processing_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_logs_created_at ON ocr_processing_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plan_items_updated_at BEFORE UPDATE ON meal_plan_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO users (id, email, hashed_password, full_name, is_active, is_verified) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'demo@dietintel.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewYGTCQaZw.R.9ti', 'Demo User', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, age, gender, weight_kg, height_cm, activity_level, goal) VALUES
('550e8400-e29b-41d4-a716-446655440000', 30, 'male', 75.5, 180, 'moderately_active', 'maintain_weight')
ON CONFLICT (user_id) DO NOTHING;