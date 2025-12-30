-- Migration: Add 'id' column to products table as PRIMARY KEY
-- Date: 2025-12-28
-- Purpose: Fix schema mismatch between ProductRepository and products table
--
-- Current schema: barcode is PRIMARY KEY
-- Target schema: id is PRIMARY KEY (autoincrement), barcode is UNIQUE
--
-- Approach: Rename old table, create new one with id, copy data, drop old
-- This is safer than ALTER TABLE for SQLite compatibility

BEGIN TRANSACTION;

-- Step 1: Create new products table with id column as PRIMARY KEY
CREATE TABLE products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    categories TEXT,
    nutriments TEXT NOT NULL,
    serving_size TEXT,
    image_url TEXT,
    source TEXT DEFAULT 'OpenFoodFacts',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0
);

-- Step 2: Copy existing data from old table to new table
-- rowid will automatically become id (SQLite implicit behavior)
INSERT INTO products_new (id, barcode, name, brand, categories, nutriments, serving_size, image_url, source, last_updated, access_count)
SELECT rowid, barcode, name, brand, categories, nutriments, serving_size, image_url, source, last_updated, access_count
FROM products;

-- Step 3: Drop old table
DROP TABLE products;

-- Step 4: Rename new table to original name
ALTER TABLE products_new RENAME TO products;

-- Step 5: Create index on barcode for faster lookups (optional but good practice)
CREATE UNIQUE INDEX idx_products_barcode ON products(barcode);

COMMIT;
