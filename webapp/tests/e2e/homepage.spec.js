const { test, expect } = require('@playwright/test');

test.describe('Homepage Layout and Content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display hero section correctly', async ({ page }) => {
    const heroSection = page.locator('.bg-gradient-to-r.from-blue-600.to-purple-700').first();
    await expect(heroSection).toBeVisible();
    
    // Check hero title
    const heroTitle = page.locator('h1').first();
    await expect(heroTitle).toContainText('Smart Nutrition Tracking');
    
    // Check hero description
    await expect(page.locator('text=Scan barcodes, read labels with OCR')).toBeVisible();
    
    // Check call-to-action buttons
    const generatePlanButton = page.locator('a[href="/plans/new"]');
    await expect(generatePlanButton).toBeVisible();
    await expect(generatePlanButton).toContainText('Generate Meal Plan');
    
    const apiDocsButton = page.locator('a[href="/docs"]');
    await expect(apiDocsButton).toBeVisible();
    await expect(apiDocsButton).toContainText('View API Docs');
  });

  test('should display features section with all features', async ({ page }) => {
    // Scroll to features section
    await page.locator('text=Powerful Features').scrollIntoViewIfNeeded();
    
    // Check features section title
    await expect(page.locator('h2', { hasText: 'Powerful Features' })).toBeVisible();
    
    // Check that all 4 feature cards are present
    const featureCards = page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 > div');
    await expect(featureCards).toHaveCount(4);
    
    // Check specific features
    const expectedFeatures = [
      { icon: '🔍', title: 'Barcode Scanner' },
      { icon: '📸', title: 'OCR Label Scanning' },
      { icon: '🍽️', title: 'AI Meal Planning' },
      { icon: '📊', title: 'Nutrition Analytics' }
    ];
    
    for (const feature of expectedFeatures) {
      await expect(page.locator(`text=${feature.icon}`)).toBeVisible();
      await expect(page.locator(`text=${feature.title}`)).toBeVisible();
    }
  });

  test('should display demo section with interactive elements', async ({ page }) => {
    // Scroll to demo section
    await page.locator('text=Try It Now').scrollIntoViewIfNeeded();
    
    // Check demo section title
    await expect(page.locator('h2', { hasText: 'Try It Now' })).toBeVisible();
    
    // Check barcode demo card
    const barcodeCard = page.locator('text=Barcode Lookup').locator('..');
    await expect(barcodeCard).toBeVisible();
    
    const barcodeInput = page.locator('#barcodeInput');
    await expect(barcodeInput).toBeVisible();
    await expect(barcodeInput).toHaveAttribute('placeholder', /e\.g\./);
    
    const barcodeButton = page.locator('button', { hasText: 'Lookup Product' });
    await expect(barcodeButton).toBeVisible();
    
    // Check OCR demo card
    const ocrCard = page.locator('text=OCR Label Scanning').locator('..');
    await expect(ocrCard).toBeVisible();
    
    const fileInput = page.locator('#ocrImageInput');
    await expect(fileInput).toBeVisible();
    await expect(fileInput).toHaveAttribute('accept', 'image/*');
    
    const ocrButton = page.locator('button', { hasText: 'Scan Label' });
    await expect(ocrButton).toBeVisible();
  });

  test('should display stats section with metrics', async ({ page }) => {
    // Scroll to stats section
    await page.locator('text=System Performance').scrollIntoViewIfNeeded();
    
    // Check stats section title
    await expect(page.locator('h2', { hasText: 'System Performance' })).toBeVisible();
    
    // Check that all 4 stat cards are present
    const statCards = page.locator('.grid.grid-cols-1.md\\:grid-cols-4 > div').nth(1);
    
    // Check individual stats
    const expectedStats = [
      '#cacheHitRate',
      '#avgResponseTime', 
      '#ocrAccuracy',
      '#plansGenerated'
    ];
    
    for (const statId of expectedStats) {
      const statElement = page.locator(statId);
      await expect(statElement).toBeVisible();
      // Stats should load and not show '-'
      await expect(statElement).not.toHaveText('-');
    }
  });

  test('should display call-to-action section', async ({ page }) => {
    // Scroll to CTA section
    await page.locator('text=Ready to Get Started?').scrollIntoViewIfNeeded();
    
    // Check CTA title and description
    await expect(page.locator('h2', { hasText: 'Ready to Get Started?' })).toBeVisible();
    await expect(page.locator('text=Create your first meal plan')).toBeVisible();
    
    // Check CTA buttons
    const viewPlansButton = page.locator('a[href="/plans"]');
    await expect(viewPlansButton).toBeVisible();
    await expect(viewPlansButton).toContainText('View Meal Plans');
    
    const apiDocsButton = page.locator('a[target="_blank"]');
    await expect(apiDocsButton).toBeVisible();
    await expect(apiDocsButton).toContainText('API Documentation');
  });

  test('should handle barcode demo interaction', async ({ page }) => {
    // Scroll to demo section
    await page.locator('#barcodeInput').scrollIntoViewIfNeeded();
    
    // Test barcode input
    const barcodeInput = page.locator('#barcodeInput');
    await barcodeInput.fill('737628064502');
    
    // Click lookup button
    const lookupButton = page.locator('button', { hasText: 'Lookup Product' });
    await lookupButton.click();
    
    // Check that result area appears
    const resultDiv = page.locator('#barcodeResult');
    await expect(resultDiv).toBeVisible();
    
    // Result should show loading state initially
    await expect(resultDiv).toContainText(/looking up/i);
    
    // Wait for result (this might show error if API is not available)
    await page.waitForTimeout(2000);
    
    // Result should either show success or error message
    const hasSuccessResult = await resultDiv.locator('text=Product Found').isVisible().catch(() => false);
    const hasErrorResult = await resultDiv.locator('text=Error').isVisible().catch(() => false);
    
    expect(hasSuccessResult || hasErrorResult).toBe(true);
  });

  test('should handle OCR demo file selection', async ({ page }) => {
    // Scroll to OCR demo
    await page.locator('#ocrImageInput').scrollIntoViewIfNeeded();
    
    // Test file input is present and functional
    const fileInput = page.locator('#ocrImageInput');
    await expect(fileInput).toBeVisible();
    
    // Click scan button without file (should show alert)
    const scanButton = page.locator('button', { hasText: 'Scan Label' });
    
    // Set up dialog handler for the alert
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Please select an image file');
      dialog.accept();
    });
    
    await scanButton.click();
  });

  test('should load and execute JavaScript correctly', async ({ page }) => {
    // Check that JavaScript functions are available
    const jsFunction = await page.evaluate(() => {
      return typeof window.lookupBarcode === 'function' && 
             typeof window.scanLabel === 'function' &&
             typeof window.checkAPIStatus === 'function';
    });
    
    expect(jsFunction).toBe(true);
    
    // Check that DOM manipulation works
    const mobileMenuToggle = await page.evaluate(() => {
      return typeof window.toggleMobileMenu === 'function';
    });
    
    expect(mobileMenuToggle).toBe(true);
  });

  test('should have proper semantic HTML structure', async ({ page }) => {
    // Check for proper heading hierarchy
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1);
    
    const h2Elements = page.locator('h2');
    const h2Count = await h2Elements.count();
    expect(h2Count).toBeGreaterThan(0);
    
    // Check for proper main content structure
    const mainElement = page.locator('main');
    await expect(mainElement).toBeVisible();
    
    // Check for proper section structure
    const sections = page.locator('section, .py-16');
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThan(3); // Hero, Features, Demo, Stats, CTA
    
    // Check for proper button elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(2);
  });
});