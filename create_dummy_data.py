#!/usr/bin/env python3
"""
Create dummy data for DietIntel database testing
"""

import asyncio
import json
from datetime import datetime, timedelta
from app.services.database import db_service
from app.services.user_service import user_service
from app.services.tracking_service import tracking_service
from app.models.user import UserCreate, UserRole
import bcrypt


async def create_dummy_data():
    """Create comprehensive dummy data for end-to-end testing"""
    
    print("🎯 Creating DietIntel Dummy Data for End-to-End Testing...")
    
    # Create test users
    print("\n👤 Creating test users...")
    
    # Create standard user
    password_hash = bcrypt.hashpw("testpass123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    standard_user_data = UserCreate(
        email="john.doe@test.com",
        password="testpass123",  # This will be hashed
        full_name="John Doe",
        developer_code=""
    )
    standard_user = await user_service.create_user(standard_user_data, password_hash)
    print(f"   ✅ Created standard user: {standard_user.email}")
    
    # Create developer user
    dev_password_hash = bcrypt.hashpw("devpass123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    dev_user_data = UserCreate(
        email="dev@dietintel.com",
        password="devpass123",
        full_name="Developer User",
        developer_code="DIETINTEL_DEV_2024"
    )
    dev_user = await user_service.create_user(dev_user_data, dev_password_hash)
    print(f"   ✅ Created developer user: {dev_user.email}")
    
    # Add dummy products for testing barcode lookups
    print("\n🥘 Adding dummy products...")
    
    dummy_products = [
        {
            "barcode": "3017620422003",
            "name": "Nutella",
            "brand": "Ferrero",
            "categories": "Spreads",
            "nutriments": {
                "energy_kcal_per_100g": 539.0,
                "protein_g_per_100g": 6.3,
                "fat_g_per_100g": 30.9,
                "carbs_g_per_100g": 57.5,
                "sugars_g_per_100g": 56.3,
                "salt_g_per_100g": 0.107
            },
            "serving_size": "15g",
            "image_url": "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.400.jpg",
            "source": "OpenFoodFacts"
        },
        {
            "barcode": "8901030823926",
            "name": "Maggi 2-Minute Noodles",
            "brand": "Nestle",
            "categories": "Instant Noodles",
            "nutriments": {
                "energy_kcal_per_100g": 422.0,
                "protein_g_per_100g": 9.5,
                "fat_g_per_100g": 15.0,
                "carbs_g_per_100g": 65.0,
                "sugars_g_per_100g": 4.2,
                "salt_g_per_100g": 3.1
            },
            "serving_size": "75g",
            "image_url": "https://example.com/maggi.jpg",
            "source": "Manual"
        },
        {
            "barcode": "7622210951779",
            "name": "Oreo Original Cookies",
            "brand": "Mondelez",
            "categories": "Biscuits",
            "nutriments": {
                "energy_kcal_per_100g": 481.0,
                "protein_g_per_100g": 6.9,
                "fat_g_per_100g": 20.0,
                "carbs_g_per_100g": 71.0,
                "sugars_g_per_100g": 38.0,
                "salt_g_per_100g": 0.85
            },
            "serving_size": "3 cookies (34g)",
            "image_url": "https://example.com/oreo.jpg",
            "source": "Manual"
        },
        {
            "barcode": "4902102072455",
            "name": "Coca-Cola Classic",
            "brand": "Coca-Cola",
            "categories": "Soft Drinks",
            "nutriments": {
                "energy_kcal_per_100g": 42.0,
                "protein_g_per_100g": 0.0,
                "fat_g_per_100g": 0.0,
                "carbs_g_per_100g": 10.6,
                "sugars_g_per_100g": 10.6,
                "salt_g_per_100g": 0.01
            },
            "serving_size": "330ml",
            "image_url": "https://example.com/coke.jpg",
            "source": "Manual"
        },
        {
            "barcode": "8901030823933",
            "name": "Britannia Good Day Cookies",
            "brand": "Britannia",
            "categories": "Cookies",
            "nutriments": {
                "energy_kcal_per_100g": 456.0,
                "protein_g_per_100g": 7.2,
                "fat_g_per_100g": 16.8,
                "carbs_g_per_100g": 69.6,
                "sugars_g_per_100g": 25.2,
                "salt_g_per_100g": 0.65
            },
            "serving_size": "4 cookies (40g)",
            "image_url": "https://example.com/goodday.jpg",
            "source": "Manual"
        }
    ]
    
    for product in dummy_products:
        await db_service.store_product(
            barcode=product["barcode"],
            name=product["name"],
            brand=product["brand"],
            categories=product["categories"],
            nutriments=product["nutriments"],
            serving_size=product["serving_size"],
            image_url=product["image_url"],
            source=product["source"]
        )
        print(f"   ✅ Added product: {product['name']}")
    
    print("\n✅ Dummy Data Creation Complete!")
    print("\nTest Credentials:")
    print("  📱 Standard User:")
    print("     Email: john.doe@test.com")
    print("     Password: testpass123")
    print("  🔧 Developer User:")
    print("     Email: dev@dietintel.com")
    print("     Password: devpass123")
    print("\n🎯 Ready for end-to-end testing!")


if __name__ == "__main__":
    asyncio.run(create_dummy_data())
