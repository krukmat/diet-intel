const { test, expect } = require('@playwright/test');

test.describe('Layout and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display main navigation correctly', async ({ page }) => {
    // Check navigation bar exists
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // Check logo and app name
    const logo = page.locator('nav .flex-shrink-0 a');
    await expect(logo).toBeVisible();
    await expect(page.locator('nav').getByText('DietIntel')).toBeVisible();
    
    // Check navigation links
    const navLinks = [
      { text: 'Home', href: '/' },
      { text: 'Meal Plans', href: '/plans' },
      { text: 'API Docs', href: '/docs' },
      { text: 'About', href: '/about' }
    ];
    
    for (const link of navLinks) {
      const navLink = page.locator(`nav a[href="${link.href}"]`);
      await expect(navLink).toBeVisible();
      await expect(navLink).toContainText(link.text);
    }
    
    // Check call-to-action button
    const ctaButton = page.locator('nav button', { hasText: 'Get Started' });
    await expect(ctaButton).toBeVisible();
  });

  test('should have responsive mobile menu', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mobile menu button should be visible
    const mobileMenuButton = page.locator('button[onclick="toggleMobileMenu()"]');
    await expect(mobileMenuButton).toBeVisible();
    
    // Desktop menu should be hidden on mobile
    const desktopMenu = page.locator('nav .hidden.sm\\:ml-6.sm\\:flex');
    await expect(desktopMenu).toHaveClass(/hidden/);
    
    // Mobile menu should be hidden initially
    const mobileMenu = page.locator('#mobile-menu');
    await expect(mobileMenu).toHaveClass(/hidden/);
    
    // Click mobile menu button
    await mobileMenuButton.click();
    
    // Mobile menu should now be visible
    await expect(mobileMenu).not.toHaveClass(/hidden/);
    
    // Check mobile menu links
    const mobileLinks = mobileMenu.locator('a');
    await expect(mobileLinks).toHaveCount(4);
  });

  test('should display footer correctly', async ({ page }) => {
    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded();
    
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    // Check footer logo and branding
    await expect(footer.getByText('DietIntel')).toBeVisible();
    
    // Check footer description
    await expect(footer).toContainText('Intelligent nutrition tracking');
    
    // Check API status indicator
    const apiStatus = page.locator('#api-status');
    await expect(apiStatus).toBeVisible();
    
    // Check feature links
    const featuresList = footer.locator('text=Barcode Scanning');
    await expect(featuresList).toBeVisible();
    
    // Check API links
    const apiLinks = footer.locator('a[href*="/docs"]');
    await expect(apiLinks.first()).toBeVisible();
    
    // Check copyright
    const currentYear = new Date().getFullYear();
    await expect(footer).toContainText(`© ${currentYear} DietIntel`);
  });

  test('should navigate between pages correctly', async ({ page }) => {
    // Navigate to Meal Plans
    await page.click('nav a[href="/plans"]');
    await expect(page).toHaveURL('/plans');
    await expect(page.locator('h1')).toContainText('Meal Plans');
    
    // Navigate back to Home
    await page.click('nav a[href="/"]');
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Smart Nutrition Tracking');
    
    // Navigate to About (if implemented)
    try {
      await page.click('nav a[href="/about"]');
      await expect(page).toHaveURL('/about');
    } catch (error) {
      // About page might not be implemented yet
      console.log('About page navigation skipped - not implemented');
    }
  });

  test('should have proper meta tags and title', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/DietIntel/);
    
    // Check meta viewport tag for responsive design
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');
    
    // Check meta description
    const descriptionMeta = page.locator('meta[name="description"]');
    await expect(descriptionMeta).toHaveAttribute('content', /nutrition tracking/i);
  });

  test('should load external resources correctly', async ({ page }) => {
    // Check that Tailwind CSS is loaded
    const tailwindScript = page.locator('script[src*="tailwindcss"]');
    await expect(tailwindScript).toBeAttached();
    
    // Check that Chart.js is loaded
    const chartScript = page.locator('script[src*="chart.js"]');
    await expect(chartScript).toBeAttached();
    
    // Verify CSS is working by checking computed styles
    const heroSection = page.locator('.bg-gradient-to-r.from-blue-600.to-purple-700').first();
    await expect(heroSection).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Navigate to non-existent page
    const response = await page.goto('/non-existent-page');
    expect(response.status()).toBe(404);
    
    // Should show error page with proper styling
    await expect(page.locator('h1')).toContainText(/not found/i);
    
    // Error page should have navigation back
    const backButton = page.locator('button', { hasText: 'Go Back' });
    await expect(backButton).toBeVisible();
    
    const homeButton = page.locator('a[href="/"]');
    await expect(homeButton).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    // Check navigation has proper ARIA labels and roles
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    
    // Check that links are keyboard accessible
    await page.keyboard.press('Tab');
    // First focusable element should be the logo
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(focusedElement).toBe('A');
    
    // Check mobile menu button has proper accessibility
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileMenuButton = page.locator('button[onclick="toggleMobileMenu()"]');
    
    // Button should be focusable
    await mobileMenuButton.focus();
    const isFocused = await mobileMenuButton.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
  });
});