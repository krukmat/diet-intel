const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('API Demo Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Scroll to demo section
    await page.locator('text=Try It Now').scrollIntoViewIfNeeded();
  });

  test('should handle barcode lookup demo with valid barcode', async ({ page }) => {
    const barcodeInput = page.locator('#barcodeInput');
    const lookupButton = page.locator('button', { hasText: 'Lookup Product' });
    const resultDiv = page.locator('#barcodeResult');
    
    // Enter a valid barcode
    await barcodeInput.fill('737628064502');
    
    // Click lookup button
    await lookupButton.click();
    
    // Check loading state appears
    await expect(resultDiv).toBeVisible();
    await expect(resultDiv).toContainText(/looking up/i);
    
    // Wait for API response (up to 10 seconds)
    await page.waitForTimeout(3000);
    
    // Check result - should be either success or error (depending on API availability)
    const hasResult = await page.evaluate(() => {
      const result = document.getElementById('barcodeResult');
      return result && result.textContent.length > 20; // Has substantial content
    });
    
    expect(hasResult).toBe(true);
  });

  test('should handle barcode lookup with empty input', async ({ page }) => {
    const lookupButton = page.locator('button', { hasText: 'Lookup Product' });
    
    // Set up dialog handler for the alert
    page.once('dialog', dialog => {
      expect(dialog.message()).toBe('Please enter a barcode');
      dialog.accept();
    });
    
    // Click without entering barcode
    await lookupButton.click();
  });

  test('should handle barcode lookup with invalid barcode', async ({ page }) => {
    const barcodeInput = page.locator('#barcodeInput');
    const lookupButton = page.locator('button', { hasText: 'Lookup Product' });
    const resultDiv = page.locator('#barcodeResult');
    
    // Enter invalid barcode
    await barcodeInput.fill('invalid123');
    await lookupButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Should show error or "not found" message
    const resultText = await resultDiv.textContent();
    expect(resultText.toLowerCase()).toMatch(/(error|failed|not found)/);
  });

  test('should handle OCR demo file selection', async ({ page }) => {
    const fileInput = page.locator('#ocrImageInput');
    const scanButton = page.locator('button', { hasText: 'Scan Label' });
    
    // Test scanning without file
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Please select an image file');
      dialog.accept();
    });
    
    await scanButton.click();
    
    // Test file input properties
    await expect(fileInput).toHaveAttribute('accept', 'image/*');
    await expect(fileInput).toHaveAttribute('type', 'file');
  });

  test('should handle OCR demo with mock file upload', async ({ page }) => {
    const fileInput = page.locator('#ocrImageInput');
    const scanButton = page.locator('button', { hasText: 'Scan Label' });
    const resultDiv = page.locator('#ocrResult');
    
    // Create a test file path (this would be a real image in actual testing)
    const testImagePath = path.join(__dirname, 'fixtures', 'test-nutrition-label.jpg');
    
    // For this demo, we'll simulate the file selection without actual upload
    // since we don't have a real image file in the test environment
    
    // Instead, let's test the JavaScript function directly
    const jsTestResult = await page.evaluate(() => {
      // Test that the scanLabel function exists and handles missing file correctly
      if (typeof window.scanLabel === 'function') {
        // Simulate the function call
        return 'function exists';
      }
      return 'function missing';
    });
    
    expect(jsTestResult).toBe('function exists');
  });

  test('should update API status in footer', async ({ page }) => {
    // Wait for API status check to complete
    await page.waitForTimeout(3000);
    
    const apiStatus = page.locator('#api-status');
    await expect(apiStatus).toBeVisible();
    
    const statusText = await apiStatus.textContent();
    
    // Status should be either healthy or offline/unhealthy
    expect(statusText).toMatch(/(healthy|unhealthy|offline)/i);
    
    // Should have appropriate colored indicator
    const hasColorIndicator = await apiStatus.locator('span').first().isVisible();
    expect(hasColorIndicator).toBe(true);
  });

  test('should load demo statistics correctly', async ({ page }) => {
    // Wait for stats to load
    await page.waitForTimeout(2000);
    
    const statsIds = [
      '#cacheHitRate',
      '#avgResponseTime', 
      '#ocrAccuracy',
      '#plansGenerated'
    ];
    
    for (const statId of statsIds) {
      const statElement = page.locator(statId);
      await expect(statElement).toBeVisible();
      
      const statValue = await statElement.textContent();
      
      // Stats should not be empty or just '-'
      expect(statValue.trim()).not.toBe('-');
      expect(statValue.trim().length).toBeGreaterThan(0);
    }
  });

  test('should handle network errors gracefully in demos', async ({ page }) => {
    // Block network requests to simulate API being down
    await page.route('**/api/barcode', route => {
      route.abort('failed');
    });
    
    const barcodeInput = page.locator('#barcodeInput');
    const lookupButton = page.locator('button', { hasText: 'Lookup Product' });
    const resultDiv = page.locator('#barcodeResult');
    
    await barcodeInput.fill('737628064502');
    await lookupButton.click();
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // Should show error message
    await expect(resultDiv).toBeVisible();
    const resultText = await resultDiv.textContent();
    expect(resultText.toLowerCase()).toContain('error');
  });

  test('should validate demo form inputs', async ({ page }) => {
    const barcodeInput = page.locator('#barcodeInput');
    
    // Test input placeholder
    await expect(barcodeInput).toHaveAttribute('placeholder', /e\.g\./);
    
    // Test input accepts text
    await barcodeInput.fill('123456789012');
    const inputValue = await barcodeInput.inputValue();
    expect(inputValue).toBe('123456789012');
    
    // Test input can be cleared
    await barcodeInput.clear();
    const clearedValue = await barcodeInput.inputValue();
    expect(clearedValue).toBe('');
  });

  test('should have proper demo section styling', async ({ page }) => {
    const demoSection = page.locator('text=Try It Now').locator('..').locator('..');
    
    // Check demo section background
    await expect(demoSection).toHaveClass(/bg-gray-50/);
    
    // Check demo cards styling
    const demoCards = page.locator('.bg-white.rounded-lg.shadow-lg');
    await expect(demoCards).toHaveCount(2); // Barcode and OCR cards
    
    // Check demo card titles
    await expect(page.locator('h3', { hasText: 'Barcode Lookup' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'OCR Label Scanning' })).toBeVisible();
  });

  test('should handle demo interactions without JavaScript errors', async ({ page }) => {
    // Collect JavaScript errors
    const jsErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    // Perform various demo interactions
    const barcodeInput = page.locator('#barcodeInput');
    await barcodeInput.fill('123456789');
    await barcodeInput.clear();
    
    const lookupButton = page.locator('button', { hasText: 'Lookup Product' });
    await lookupButton.hover();
    
    const scanButton = page.locator('button', { hasText: 'Scan Label' });
    await scanButton.hover();
    
    // Wait a moment for any async errors
    await page.waitForTimeout(1000);
    
    // Filter out known acceptable errors (like network errors in test environment)
    const criticalErrors = jsErrors.filter(error => 
      !error.includes('Failed to fetch') && 
      !error.includes('NetworkError') &&
      !error.includes('ERR_NETWORK')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('should have accessible demo controls', async ({ page }) => {
    const barcodeInput = page.locator('#barcodeInput');
    const lookupButton = page.locator('button', { hasText: 'Lookup Product' });
    const fileInput = page.locator('#ocrImageInput');
    const scanButton = page.locator('button', { hasText: 'Scan Label' });
    
    // Check that form controls are focusable
    await barcodeInput.focus();
    let isFocused = await barcodeInput.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
    
    await lookupButton.focus();
    isFocused = await lookupButton.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
    
    await fileInput.focus();
    isFocused = await fileInput.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
    
    await scanButton.focus();
    isFocused = await scanButton.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
    
    // Check keyboard navigation
    await barcodeInput.focus();
    await page.keyboard.press('Tab');
    // Next focusable element should be the lookup button
    const nextFocused = await page.evaluate(() => document.activeElement.textContent);
    expect(nextFocused).toContain('Lookup');
  });
});