#!/usr/bin/env python3
"""
Create dummy data for DietIntel database testing
"""

import asyncio
import json
from datetime import datetime, timedelta
from app.services.database import db_service
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
    standard_user = await db_service.create_user(standard_user_data, password_hash)
    print(f"   ✅ Created standard user: {standard_user.email}")
    
    # Create developer user
    dev_password_hash = bcrypt.hashpw("devpass123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    dev_user_data = UserCreate(
        email="dev@dietintel.com",
        password="devpass123",
        full_name="Developer User",
        developer_code="DIETINTEL_DEV_2024"
    )
    dev_user = await db_service.create_user(dev_user_data, dev_password_hash)
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
    
    # Add analytics data for testing
    print("\n📊 Adding analytics data...")
    
    # Add product lookup analytics
    base_time = datetime.now() - timedelta(days=7)
    for i in range(20):
        lookup_time = base_time + timedelta(hours=i*2)
        success = i % 4 != 0  # 75% success rate
        response_time = 150 + (i % 5) * 50  # 150-350ms
        source = ["Database", "Cache", "OpenFoodFacts"][i % 3]
        
        await db_service.log_product_lookup(
            user_id=standard_user.id if i % 2 == 0 else dev_user.id,
            session_id=f"session_{i}",
            barcode=dummy_products[i % len(dummy_products)]["barcode"],
            product_name=dummy_products[i % len(dummy_products)]["name"] if success else None,
            success=success,
            response_time_ms=response_time,
            source=source,
            error_message="Product not found" if not success else None
        )
        print(f"   📈 Logged lookup {i+1}/20")
    
    # Add OCR scan analytics
    for i in range(10):
        scan_time = base_time + timedelta(hours=i*4)
        confidence = 0.4 + (i % 6) * 0.1  # 0.4-0.9 confidence
        processing_time = 2000 + (i % 4) * 1000  # 2-5 seconds
        success = confidence >= 0.7
        
        await db_service.log_ocr_scan(
            user_id=standard_user.id if i % 3 == 0 else dev_user.id,
            session_id=f"ocr_session_{i}",
            image_size=4000 + i * 500,
            confidence_score=confidence,
            processing_time_ms=processing_time,
            ocr_engine="tesseract" if i % 2 == 0 else "external_api",
            nutrients_extracted=4 if success else 2,
            success=success,
            error_message=None if success else "Low confidence extraction"
        )
        print(f"   🔍 Logged OCR scan {i+1}/10")
    
    # Add user interaction history
    for i in range(15):
        interaction_time = base_time + timedelta(hours=i*3)
        actions = ["lookup", "view", "add_to_meal", "scan"]
        context = ["search", "barcode_scan", "meal_logging", "tracking"]
        
        await db_service.log_user_product_interaction(
            user_id=standard_user.id if i % 2 == 0 else dev_user.id,
            session_id=f"interaction_session_{i}",
            barcode=dummy_products[i % len(dummy_products)]["barcode"],
            action=actions[i % len(actions)],
            context=context[i % len(context)]
        )
        print(f"   🤝 Logged interaction {i+1}/15")
    
    # Add meal tracking data
    print("\n🍽️ Adding meal tracking data...")
    
    for i in range(5):
        meal_time = base_time + timedelta(days=i, hours=8)  # Breakfast times
        meal_items = [
            {
                "barcode": dummy_products[0]["barcode"],
                "name": dummy_products[0]["name"],
                "serving": "2 tbsp (30g)",
                "calories": 162,
                "macros": {"protein": 1.9, "fat": 9.3, "carbs": 17.3}
            },
            {
                "barcode": "bread_slice",
                "name": "Whole Wheat Bread",
                "serving": "2 slices",
                "calories": 160,
                "macros": {"protein": 8.0, "fat": 2.0, "carbs": 30.0}
            }
        ]
        
        class MockMealRequest:
            def __init__(self, meal_name, items):
                self.meal_name = meal_name
                self.items = items
        
        meal_request = MockMealRequest(f"Breakfast Day {i+1}", meal_items)
        meal_id = await db_service.create_meal(
            user_id=standard_user.id,
            meal_data=meal_request,
            photo_url=None
        )
        print(f"   🥞 Added meal: {meal_request.meal_name}")
    
    # Add weight tracking data
    print("\n⚖️ Adding weight tracking data...")
    
    for i in range(7):
        weight_time = base_time + timedelta(days=i)
        weight = 75.0 + (i * 0.2)  # Gradual weight change
        
        class MockWeightRequest:
            def __init__(self, weight, date):
                self.weight = weight
                self.date = date
        
        weight_request = MockWeightRequest(weight, weight_time)
        weight_id = await db_service.create_weight_entry(
            user_id=standard_user.id,
            weight_data=weight_request,
            photo_url=None
        )
        print(f"   📊 Added weight entry: {weight}kg")
    
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