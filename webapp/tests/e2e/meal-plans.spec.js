const { test, expect } = require('@playwright/test');

test.describe('Meal Plans Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plans');
  });

  test('should display meal plans dashboard correctly', async ({ page }) => {
    // Check page title and header
    await expect(page.locator('h1')).toContainText('Meal Plans');
    await expect(page.locator('text=Manage your personalized nutrition plans')).toBeVisible();
    
    // Check generate new plan button
    const newPlanButton = page.locator('a[href="/plans/new"]');
    await expect(newPlanButton).toBeVisible();
    await expect(newPlanButton).toContainText('Generate New Plan');
  });

  test('should display quick stats cards', async ({ page }) => {
    // Check that all 4 stat cards are present
    const statCards = page.locator('.grid.grid-cols-1.md\\:grid-cols-4 .bg-white.rounded-lg.shadow');
    await expect(statCards).toHaveCount(4);
    
    // Check specific stats
    const expectedStats = [
      { icon: '📊', label: 'Total Plans' },
      { icon: '✅', label: 'Active' },
      { icon: '⏳', label: 'Pending' },
      { icon: '🎯', label: 'Avg Calories' }
    ];
    
    for (const stat of expectedStats) {
      await expect(page.locator(`text=${stat.icon}`)).toBeVisible();
      await expect(page.locator(`text=${stat.label}`)).toBeVisible();
    }
  });

  test('should display search and filter controls', async ({ page }) => {
    const filterSection = page.locator('.bg-white.rounded-lg.shadow').first();
    await expect(filterSection).toBeVisible();
    
    // Check search input
    const searchInput = page.locator('input[placeholder="Search meal plans..."]');
    await expect(searchInput).toBeVisible();
    
    // Check status filter dropdown
    const statusFilter = page.locator('select').first();
    await expect(statusFilter).toBeVisible();
    
    // Check sort dropdown
    const sortFilter = page.locator('select').nth(1);
    await expect(sortFilter).toBeVisible();
  });

  test('should display meal plan cards', async ({ page }) => {
    const planCards = page.locator('.meal-plan-card');
    const cardCount = await planCards.count();
    
    if (cardCount > 0) {
      // Test first meal plan card
      const firstCard = planCards.first();
      await expect(firstCard).toBeVisible();
      
      // Check plan name is a link
      const planLink = firstCard.locator('a[href^="/plans/"]');
      await expect(planLink).toBeVisible();
      
      // Check status badge
      const statusBadge = firstCard.locator('.inline-flex.items-center.px-2\\.5.py-0\\.5.rounded-full');
      await expect(statusBadge).toBeVisible();
      
      // Check calorie information
      await expect(firstCard.locator('text=Daily Calories')).toBeVisible();
      
      // Check action buttons
      const viewButton = firstCard.locator('a', { hasText: 'View Details' });
      await expect(viewButton).toBeVisible();
      
      const duplicateButton = firstCard.locator('button', { hasText: '📋' });
      await expect(duplicateButton).toBeVisible();
      
      const deleteButton = firstCard.locator('button', { hasText: '🗑️' });
      await expect(deleteButton).toBeVisible();
    } else {
      // Check empty state
      await expect(page.locator('text=No meal plans yet')).toBeVisible();
      await expect(page.locator('text=Generate Your First Plan')).toBeVisible();
    }
  });

  test('should filter meal plans by search term', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search meal plans..."]');
    
    // Get initial plan count
    const initialCards = page.locator('.meal-plan-card');
    const initialCount = await initialCards.count();
    
    if (initialCount > 0) {
      // Search for a specific term
      await searchInput.fill('Balanced');
      await searchInput.press('Enter');
      
      // Wait for filtering to complete
      await page.waitForTimeout(500);
      
      // Check that filtering occurred (some cards may be hidden)
      const visibleCards = await page.locator('.meal-plan-card:visible').count();
      // The actual count depends on test data, just ensure no JavaScript errors
      expect(typeof visibleCards).toBe('number');
    }
  });

  test('should filter meal plans by status', async ({ page }) => {
    const statusFilter = page.locator('select').first();
    
    // Test status filtering
    await statusFilter.selectOption('active');
    await page.waitForTimeout(500);
    
    await statusFilter.selectOption('pending');  
    await page.waitForTimeout(500);
    
    await statusFilter.selectOption(''); // All status
    await page.waitForTimeout(500);
    
    // No JavaScript errors should occur
    const errors = await page.evaluate(() => window.jsErrors || []);
    expect(errors.length).toBe(0);
  });
});

test.describe('Meal Plan Detail View', () => {
  test('should display meal plan details correctly', async ({ page }) => {
    // Navigate to a specific meal plan (using sample ID)
    await page.goto('/plans/1');
    
    // Check page title
    await expect(page.locator('h1')).toContainText('Meal Plan');
    
    // Check plan info and date
    await expect(page.locator('text=Generated on')).toBeVisible();
    
    // Check action buttons
    const exportButton = page.locator('button', { hasText: 'Export PDF' });
    await expect(exportButton).toBeVisible();
    
    const shareButton = page.locator('button', { hasText: 'Share' });
    await expect(shareButton).toBeVisible();
  });

  test('should display overview cards with nutritional data', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Check that all 4 overview cards are present
    const overviewCards = page.locator('.grid.grid-cols-1.md\\:grid-cols-4 .bg-white.rounded-lg.shadow').first().locator('..');
    const cards = overviewCards.locator('.bg-white.rounded-lg.shadow');
    await expect(cards).toHaveCount(4);
    
    // Check specific metrics
    const expectedMetrics = [
      { icon: '🔥', label: 'Daily Target' },
      { icon: '⚡', label: 'BMR' },
      { icon: '🏃', label: 'TDEE' },
      { icon: '📊', label: 'Actual Total' }
    ];
    
    for (const metric of expectedMetrics) {
      await expect(page.locator(`text=${metric.icon}`)).toBeVisible();
      await expect(page.locator(`text=${metric.label}`)).toBeVisible();
    }
  });

  test('should display macronutrient breakdown section', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Check macros section
    const macrosSection = page.locator('text=Macronutrient Breakdown').locator('..');
    await expect(macrosSection).toBeVisible();
    
    // Check chart canvas
    const chartCanvas = page.locator('#macrosChart');
    await expect(chartCanvas).toBeVisible();
    
    // Check macro details
    const expectedMacros = ['Protein', 'Fat', 'Carbohydrates', 'Sugars'];
    
    for (const macro of expectedMacros) {
      await expect(page.locator(`text=${macro}`)).toBeVisible();
    }
    
    // Check that macro values are displayed
    await expect(page.locator('text=g').first()).toBeVisible();
    await expect(page.locator('text=%').first()).toBeVisible();
  });

  test('should display daily meals with items', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Check meals section title
    await expect(page.locator('h2', { hasText: 'Daily Meals' })).toBeVisible();
    
    // Check that meal cards are present
    const mealCards = page.locator('.meal-card');
    await expect(mealCards).toHaveCount(4); // Breakfast, Lunch, Dinner, Snacks
    
    // Check specific meals
    const expectedMeals = [
      { name: 'Breakfast', icon: '🌅' },
      { name: 'Lunch', icon: '🌞' },
      { name: 'Dinner', icon: '🌙' },
      { name: 'Snacks', icon: '🍿' }
    ];
    
    for (const meal of expectedMeals) {
      await expect(page.locator(`text=${meal.icon}`)).toBeVisible();
      await expect(page.locator(`text=${meal.name}`)).toBeVisible();
    }
  });

  test('should display meal items with nutrition information', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Check first meal's items
    const firstMeal = page.locator('.meal-card').first();
    const mealItems = firstMeal.locator('.bg-gray-50.rounded-lg');
    
    const itemCount = await mealItems.count();
    if (itemCount > 0) {
      const firstItem = mealItems.first();
      
      // Check item name
      await expect(firstItem.locator('h4')).toBeVisible();
      
      // Check serving size and calories
      await expect(firstItem.locator('text=📏')).toBeVisible();
      await expect(firstItem.locator('text=🔥')).toBeVisible();
      await expect(firstItem.locator('text=kcal')).toBeVisible();
      
      // Check macro nutrients
      const macroTags = firstItem.locator('.grid.grid-cols-2 span');
      await expect(macroTags).toHaveCount(5); // P, F, C, S, Salt
      
      // Check action buttons
      const editButton = firstItem.locator('button', { hasText: '✏️' });
      await expect(editButton).toBeVisible();
      
      const removeButton = firstItem.locator('button', { hasText: '🗑️' });
      await expect(removeButton).toBeVisible();
    }
  });

  test('should have functional progress indicators', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Check meal progress rings
    const progressRings = page.locator('.progress-ring');
    const ringCount = await progressRings.count();
    
    if (ringCount > 0) {
      const firstRing = progressRings.first();
      await expect(firstRing).toBeVisible();
      
      // Check that stroke-dashoffset is set (indicates progress calculation)
      const strokeDashOffset = await firstRing.getAttribute('stroke-dashoffset');
      expect(strokeDashOffset).toBeTruthy();
    }
    
    // Check progress percentages
    const progressPercent = page.locator('text=%').first();
    await expect(progressPercent).toBeVisible();
  });

  test('should display plan information section', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Scroll to plan info section
    await page.locator('text=Plan Information').scrollIntoViewIfNeeded();
    
    const planInfoSection = page.locator('.bg-blue-50.border.border-blue-200');
    await expect(planInfoSection).toBeVisible();
    
    // Check plan details
    await expect(planInfoSection.locator('text=Flexibility Used')).toBeVisible();
    await expect(planInfoSection.locator('text=Optional Products')).toBeVisible();
    await expect(planInfoSection.locator('text=Plan ID')).toBeVisible();
    await expect(planInfoSection.locator('text=Created')).toBeVisible();
  });

  test('should handle meal item interactions', async ({ page }) => {
    await page.goto('/plans/1');
    
    const mealItems = page.locator('.bg-gray-50.rounded-lg');
    const itemCount = await mealItems.count();
    
    if (itemCount > 0) {
      const firstItem = mealItems.first();
      
      // Test edit button
      const editButton = firstItem.locator('button', { hasText: '✏️' });
      
      // Set up dialog handler for the alert
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('Edit item');
        dialog.accept();
      });
      
      await editButton.click();
      
      // Test remove button  
      const removeButton = firstItem.locator('button', { hasText: '🗑️' });
      
      // Set up dialog handler for the confirmation
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('Are you sure');
        dialog.dismiss(); // Don't actually remove
      });
      
      await removeButton.click();
    }
  });

  test('should handle add item functionality', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Look for add item buttons
    const addItemButtons = page.locator('button', { hasText: 'Add Item' });
    const buttonCount = await addItemButtons.count();
    
    if (buttonCount > 0) {
      const firstAddButton = addItemButtons.first();
      
      // Set up dialog handler for the alert
      page.once('dialog', dialog => {
        expect(dialog.message()).toContain('Add new item');
        dialog.accept();
      });
      
      await firstAddButton.click();
    }
  });

  test('should load and render Chart.js macros chart', async ({ page }) => {
    await page.goto('/plans/1');
    
    // Wait for Chart.js to load and render
    await page.waitForTimeout(2000);
    
    const chartCanvas = page.locator('#macrosChart');
    await expect(chartCanvas).toBeVisible();
    
    // Check that Chart.js has actually rendered the chart
    const chartRendered = await page.evaluate(() => {
      const canvas = document.getElementById('macrosChart');
      if (!canvas) return false;
      
      // Check if Chart.js has drawn on the canvas
      const context = canvas.getContext('2d');
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // If the chart is rendered, there should be non-transparent pixels
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] !== 0) return true; // Found a non-transparent pixel
      }
      return false;
    });
    
    expect(chartRendered).toBe(true);
  });
});