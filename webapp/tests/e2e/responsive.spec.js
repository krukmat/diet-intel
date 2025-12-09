const { test, expect } = require('@playwright/test');

test.describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Mobile Portrait', width: 375, height: 667 },
    { name: 'Mobile Landscape', width: 667, height: 375 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Desktop Small', width: 1280, height: 720 },
    { name: 'Desktop Large', width: 1920, height: 1080 }
  ];

  for (const viewport of viewports) {
    test(`should display correctly on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      // Check that page loads without horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Allow small buffer

      // Check navigation visibility
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();

      // Check main content is visible
      const main = page.locator('main');
      await expect(main).toBeVisible();

      // Check hero section adapts
      const heroTitle = page.locator('h1').first();
      await expect(heroTitle).toBeVisible();

      // Footer should be accessible
      await page.locator('footer').scrollIntoViewIfNeeded();
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    });
  }

  test('should show mobile menu on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Mobile menu button should be visible
    const mobileMenuButton = page.locator('button[onclick="toggleMobileMenu()"]');
    await expect(mobileMenuButton).toBeVisible();

    // Desktop menu should be hidden
    const desktopMenu = page.locator('.hidden.sm\\:ml-6.sm\\:flex');
    const isHidden = await desktopMenu.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none';
    });
    expect(isHidden).toBe(true);

    // Click mobile menu
    await mobileMenuButton.click();

    // Mobile menu should appear
    const mobileMenu = page.locator('#mobile-menu');
    await expect(mobileMenu).not.toHaveClass(/hidden/);
  });

  test('should hide mobile menu on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Mobile menu button should be hidden
    const mobileMenuButton = page.locator('button[onclick="toggleMobileMenu()"]');
    const isButtonHidden = await mobileMenuButton.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none';
    });
    expect(isButtonHidden).toBe(true);

    // Desktop menu should be visible
    const desktopMenu = page.locator('.hidden.sm\\:ml-6.sm\\:flex');
    await expect(desktopMenu).toBeVisible();
  });

  test('should adapt grid layouts on different screen sizes', async ({ page }) => {
    await page.goto('/');

    // Test feature cards grid on mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('text=Powerful Features').scrollIntoViewIfNeeded();

    const featureGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
    await expect(featureGrid).toBeVisible();

    // Test on tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    // Grid should still be visible and functional
    await expect(featureGrid).toBeVisible();

    // Test on desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(featureGrid).toBeVisible();
  });

  test('should adapt demo section on different screen sizes', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=Try It Now').scrollIntoViewIfNeeded();

    // Test demo cards on mobile
    await page.setViewportSize({ width: 375, height: 667 });
    const demoGrid = page.locator('.grid.grid-cols-1.lg\\:grid-cols-2');
    await expect(demoGrid).toBeVisible();

    // Cards should stack vertically on mobile
    const demoCards = page.locator('.bg-white.rounded-lg.shadow-lg');
    const cardCount = await demoCards.count();
    expect(cardCount).toBe(2);

    // Test on desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(demoGrid).toBeVisible();
  });

  test('should handle meal plans dashboard responsively', async ({ page }) => {
    await page.goto('/plans');

    // Test on mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Header should be responsive
    const header = page.locator('h1');
    await expect(header).toBeVisible();

    // Stats grid should adapt
    const statsGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4').first();
    await expect(statsGrid).toBeVisible();

    // Plans grid should adapt
    const plansGrid = page.locator('#plansGrid');
    await expect(plansGrid).toBeVisible();

    // Test on tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(statsGrid).toBeVisible();
    await expect(plansGrid).toBeVisible();

    // Test on desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(statsGrid).toBeVisible();
    await expect(plansGrid).toBeVisible();
  });

  test('should handle meal plan details responsively', async ({ page }) => {
    await page.goto('/plans/1');

    // Test on mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Page title should be visible
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // Overview cards should stack on mobile
    const overviewGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-4').first();
    await expect(overviewGrid).toBeVisible();

    // Macros section should be responsive
    const macrosSection = page.locator('text=Macronutrient Breakdown').locator('..');
    await expect(macrosSection).toBeVisible();

    // Chart should be visible
    const chart = page.locator('#macrosChart');
    await expect(chart).toBeVisible();

    // Test on tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(overviewGrid).toBeVisible();
    await expect(chart).toBeVisible();

    // Test on desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(overviewGrid).toBeVisible();
    await expect(chart).toBeVisible();
  });

  test('should have readable text on all screen sizes', async ({ page }) => {
    await page.goto('/');

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      // Check main heading
      const mainHeading = page.locator('h1').first();
      await expect(mainHeading).toBeVisible();

      const fontSize = await mainHeading.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });

      // Font size should be reasonable (at least 16px equivalent)
      const fontSizeNum = parseFloat(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(16);

      // Check that text is not cut off
      const isTextVisible = await mainHeading.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      expect(isTextVisible).toBe(true);
    }
  });

  test('should have accessible touch targets on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check navigation buttons
    const navButtons = page.locator('nav button, nav a');
    const buttonCount = await navButtons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = navButtons.nth(i);
      if (await button.isVisible()) {
        const buttonSize = await button.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });

        // Touch targets should be at least 44x44 pixels (Apple guidelines)
        // or close to it for good accessibility
        expect(buttonSize.width).toBeGreaterThanOrEqual(32);
        expect(buttonSize.height).toBeGreaterThanOrEqual(32);
      }
    }

    // Check demo buttons
    await page.locator('text=Try It Now').scrollIntoViewIfNeeded();
    const demoButtons = page.locator('button:visible');
    const demoButtonCount = await demoButtons.count();

    for (let i = 0; i < demoButtonCount; i++) {
      const button = demoButtons.nth(i);
      const buttonSize = await button.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

      expect(buttonSize.width).toBeGreaterThanOrEqual(32);
      expect(buttonSize.height).toBeGreaterThanOrEqual(32);
    }
  });

  test('should prevent horizontal overflow', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      // Check body doesn't overflow
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(viewport.width + 20);

      // Check main content doesn't overflow  
      const mainScrollWidth = await page.evaluate(() => {
        const main = document.querySelector('main');
        return main ? main.scrollWidth : 0;
      });
      expect(mainScrollWidth).toBeLessThanOrEqual(viewport.width + 20);

      // Scroll through page to check all sections
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // Check again after scrolling
      const finalScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(finalScrollWidth).toBeLessThanOrEqual(viewport.width + 20);
    }
  });

  test('should adapt images and media responsively', async ({ page }) => {
    await page.goto('/');

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      // Check that images don't overflow
      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        if (await image.isVisible()) {
          const imageSize = await image.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          });

          expect(imageSize.width).toBeLessThanOrEqual(viewport.width);
        }
      }

      // Check canvas elements (charts) are responsive
      const canvases = page.locator('canvas');
      const canvasCount = await canvases.count();

      for (let i = 0; i < canvasCount; i++) {
        const canvas = canvases.nth(i);
        if (await canvas.isVisible()) {
          const canvasSize = await canvas.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          });

          expect(canvasSize.width).toBeLessThanOrEqual(viewport.width);
        }
      }
    }
  });
});