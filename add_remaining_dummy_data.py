#!/usr/bin/env python3
"""
Add remaining dummy data (meals and weights) with correct format
"""

import asyncio
import json
from datetime import datetime, timedelta
from app.services.database import db_service


async def add_remaining_data():
    """Add meal and weight data with correct format"""
    
    print("🎯 Adding remaining dummy data...")
    
    # Get the standard user
    standard_user = await db_service.get_user_by_email("john.doe@test.com")
    if not standard_user:
        print("❌ Standard user not found")
        return
    
    # Add meal tracking data with correct format
    print("\n🍽️ Adding meal tracking data...")
    
    base_time = datetime.now() - timedelta(days=7)
    
    # Create simple meals with direct data insertion
    meals_data = [
        {
            "meal_name": "Healthy Breakfast",
            "items": [
                {"barcode": "3017620422003", "name": "Nutella", "serving": "2 tbsp", "calories": 162},
                {"barcode": "toast_001", "name": "Whole Wheat Toast", "serving": "2 slices", "calories": 160}
            ]
        },
        {
            "meal_name": "Light Lunch", 
            "items": [
                {"barcode": "8901030823926", "name": "Maggi Noodles", "serving": "1 pack", "calories": 316},
                {"barcode": "salad_001", "name": "Garden Salad", "serving": "1 bowl", "calories": 85}
            ]
        },
        {
            "meal_name": "Evening Snack",
            "items": [
                {"barcode": "7622210951779", "name": "Oreo Cookies", "serving": "3 cookies", "calories": 160}
            ]
        }
    ]
    
    # Insert meals directly into database
    for i, meal in enumerate(meals_data):
        meal_id = f"meal_{i+1}_{standard_user.id}"
        timestamp = base_time + timedelta(days=i, hours=8)
        
        # Calculate total calories and create items JSON
        total_calories = sum(item["calories"] for item in meal["items"])
        items_json = json.dumps(meal["items"])
        
        # Direct database insertion
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO meals (id, user_id, meal_name, items, total_calories, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (meal_id, standard_user.id, meal["meal_name"], items_json, total_calories, timestamp.isoformat()))
            conn.commit()
        
        print(f"   🥞 Added meal: {meal['meal_name']} ({total_calories} kcal)")
    
    # Add weight tracking data with direct insertion
    print("\n⚖️ Adding weight tracking data...")
    
    for i in range(7):
        weight_time = base_time + timedelta(days=i)
        weight = 75.0 + (i * 0.1)  # Gradual weight change
        weight_id = f"weight_{i+1}_{standard_user.id}"
        
        # Direct database insertion
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO weight_entries (id, user_id, weight, date, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (weight_id, standard_user.id, weight, weight_time.isoformat(), datetime.now().isoformat()))
            conn.commit()
        
        print(f"   📊 Added weight entry: {weight:.1f}kg")
    
    # Add some reminders
    print("\n⏰ Adding reminders...")
    
    reminder_data = [
        {
            "title": "Morning Weigh-in",
            "description": "Remember to weigh yourself every morning",
            "frequency": "daily",
            "time": "08:00"
        },
        {
            "title": "Drink Water",
            "description": "Stay hydrated throughout the day",
            "frequency": "hourly", 
            "time": "10:00"
        },
        {
            "title": "Evening Meal Log",
            "description": "Log your dinner in the app",
            "frequency": "daily",
            "time": "19:00"
        }
    ]
    
    for i, reminder in enumerate(reminder_data):
        reminder_id = f"reminder_{i+1}_{standard_user.id}"
        reminder_time = datetime.now().replace(hour=int(reminder["time"][:2]), minute=int(reminder["time"][3:]), second=0, microsecond=0)
        
        # Direct database insertion
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO reminders (id, user_id, title, description, reminder_time, frequency, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (reminder_id, standard_user.id, reminder["title"], reminder["description"], 
                  reminder_time.isoformat(), reminder["frequency"], True, datetime.now().isoformat()))
            conn.commit()
        
        print(f"   ⏰ Added reminder: {reminder['title']}")
    
    print("\n✅ Remaining Dummy Data Added Successfully!")
    

if __name__ == "__main__":
    asyncio.run(add_remaining_data())