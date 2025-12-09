#!/bin/bash

# Script to capture screenshots of mobile app features
# Run this script while the app is running in the simulator

echo "📱 DietIntel Mobile App Screenshot Capture Script"
echo "=================================================="
echo ""
echo "Please follow these steps to capture screenshots:"
echo ""
echo "1. Make sure your Android emulator or iOS simulator is running"
echo "2. Navigate to the DietIntel app"
echo "3. Follow the prompts below to capture each screen"
echo ""

# Create screenshots directory if it doesn't exist
mkdir -p screenshots

echo "🏷️ STEP 1: Upload Label Feature with Home Navigation"
echo "---------------------------------------------------"
echo "1. Tap on the 'Upload Label' tab"
echo "2. Wait for the screen to load"
echo "3. You should see the 🏠 home button in the top-left corner"
echo "4. Take a screenshot and save it as 'upload-label-with-home-nav.png'"
echo ""
read -p "Press Enter when you've captured the Upload Label screenshot..."

echo ""
echo "🍽️ STEP 2: Meal Plan Feature with Home Navigation"
echo "------------------------------------------------"
echo "1. Tap on the 'Meal Plan' tab"
echo "2. Wait for the meal plan to generate/load"
echo "3. You should see the 🏠 home button in the top-left corner"
echo "4. You should see the daily progress bars and meal cards"
echo "5. Take a screenshot and save it as 'meal-plan-with-home-nav.png'"
echo ""
read -p "Press Enter when you've captured the Meal Plan screenshot..."

echo ""
echo "✅ Screenshot capture complete!"
echo "Copy the screenshots to mobile/screenshots/ directory"
echo "Then run: git add . && git commit -m 'Add updated mobile screenshots'"