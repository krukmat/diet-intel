# Screenshots Directory

This directory contains screenshots of the DietIntel web application interface.

## Required Screenshots

To complete the documentation, please add the following screenshot files:

1. **homepage.png** - Homepage with hero section and interactive demos
   - Shows the main landing page with barcode lookup and OCR demo sections
   - Recommended size: 1920x1080 or similar high-resolution

2. **meal-plans-dashboard.png** - Meal plans overview page
   - Shows the dashboard with meal plan cards, stats, and filtering
   - Should display multiple meal plans if available

3. **meal-plan-detail.png** - Individual meal plan view
   - Shows detailed breakdown with macronutrient charts
   - Should include the pie chart and meal breakdown sections

4. **api-docs.png** - API documentation interface
   - Screenshot of the Swagger UI at http://localhost:8000/docs
   - Should show the interactive API endpoint explorer

## How to Take Screenshots

1. Start the application:
   ```bash
   # Start API server
   python main.py
   
   # Start web interface (if separate)
   cd webapp && npm start
   ```

2. Visit the relevant pages in your browser:
   - Homepage: http://localhost:3000
   - Meal Plans: http://localhost:3000/plans
   - Meal Plan Detail: http://localhost:3000/plans/[id] (create a sample plan first)
   - API Docs: http://localhost:8000/docs

3. Take high-quality screenshots and save them with the filenames above

## Tips for Good Screenshots

- Use a clean browser window without bookmarks bar
- Ensure good lighting and contrast
- Show realistic sample data when possible
- Crop to focus on the main interface elements
- Use PNG format for crisp text rendering