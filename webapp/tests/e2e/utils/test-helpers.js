/**
 * Test Helper Utilities for DietIntel E2E Tests
 */

/**
 * Wait for element to be visible and stable
 */
async function waitForStableElement(page, selector, timeout = 10000) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  
  // Wait for element to stop moving (useful for animations)
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      
      const rect1 = el.getBoundingClientRect();
      return new Promise(resolve => {
        setTimeout(() => {
          const rect2 = el.getBoundingClientRect();
          resolve(rect1.top === rect2.top && rect1.left === rect2.left);
        }, 100);
      });
    },
    selector,
    { timeout: 5000 }
  ).catch(() => {
    // Ignore timeout - element might not be animated
  });
  
  return element;
}

/**
 * Check if element is in viewport
 */
async function isElementInViewport(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }, selector);
}

/**
 * Scroll element into view smoothly
 */
async function smoothScrollToElement(page, selector) {
  await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    }
  }, selector);
  
  // Wait for scroll to complete
  await page.waitForTimeout(1000);
}

/**
 * Get computed style property of element
 */
async function getComputedStyle(page, selector, property) {
  return await page.evaluate((sel, prop) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    
    return window.getComputedStyle(element)[prop];
  }, selector, property);
}

/**
 * Check if element has specific CSS class
 */
async function hasClass(page, selector, className) {
  return await page.evaluate((sel, cls) => {
    const element = document.querySelector(sel);
    return element ? element.classList.contains(cls) : false;
  }, selector, className);
}

/**
 * Wait for network requests to complete
 */
async function waitForNetworkIdle(page, timeout = 30000) {
  return await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Mock API responses
 */
class APIMocker {
  constructor(page) {
    this.page = page;
    this.routes = new Map();
  }
  
  async mockBarcodeSuccess(barcode = '737628064502') {
    await this.page.route('**/api/barcode', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'OpenFoodFacts',
          barcode: barcode,
          name: 'Test Product',
          brand: 'Test Brand',
          image_url: 'https://example.com/image.jpg',
          serving_size: '100g',
          nutriments: {
            energy_kcal_per_100g: 250.0,
            protein_g_per_100g: 10.0,
            fat_g_per_100g: 5.0,
            carbs_g_per_100g: 40.0,
            sugars_g_per_100g: 15.0,
            salt_g_per_100g: 1.2
          },
          fetched_at: new Date().toISOString()
        })
      });
    });
  }
  
  async mockBarcodeNotFound() {
    await this.page.route('**/api/barcode', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Product not found',
          message: 'No product found for this barcode'
        })
      });
    });
  }
  
  async mockAPIError() {
    await this.page.route('**/api/barcode', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Failed to lookup product'
        })
      });
    });
  }
  
  async mockOCRSuccess() {
    await this.page.route('**/api/scan-label', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'Local OCR',
          confidence: 0.85,
          raw_text: 'NUTRITION FACTS Energy: 250 kcal Protein: 10g Fat: 5g',
          serving_size: '100g',
          nutriments: {
            energy_kcal_per_100g: 250.0,
            protein_g_per_100g: 10.0,
            fat_g_per_100g: 5.0,
            carbs_g_per_100g: 40.0,
            sugars_g_per_100g: 15.0,
            salt_g_per_100g: 1.2
          },
          scanned_at: new Date().toISOString()
        })
      });
    });
  }
  
  async mockOCRLowConfidence() {
    await this.page.route('**/api/scan-label', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          low_confidence: true,
          confidence: 0.33,
          raw_text: 'unclear nutrition text...',
          partial_parsed: {
            energy_kcal: 250.0,
            protein_g: 10.0,
            fat_g: null,
            carbs_g: null,
            sugars_g: null,
            salt_g: null
          },
          suggest_external_ocr: true,
          scanned_at: new Date().toISOString()
        })
      });
    });
  }
  
  async mockHealthy() {
    await this.page.route('**/api/health', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          webapp_status: 'healthy',
          api_status: { status: 'healthy' },
          timestamp: new Date().toISOString()
        })
      });
    });
  }
  
  async mockUnhealthy() {
    await this.page.route('**/api/health', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          webapp_status: 'healthy',
          api_status: 'unhealthy',
          error: 'API connection failed',
          timestamp: new Date().toISOString()
        })
      });
    });
  }
  
  async clearMocks() {
    await this.page.unrouteAll();
  }
}

/**
 * Screenshot helper for visual regression testing
 */
async function takeScreenshot(page, name, options = {}) {
  const defaultOptions = {
    fullPage: true,
    animations: 'disabled',
    ...options
  };
  
  return await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    ...defaultOptions
  });
}

/**
 * Accessibility helper
 */
async function checkAccessibility(page, selector = null) {
  const element = selector ? page.locator(selector) : page;
  
  // Basic accessibility checks
  const results = await element.evaluate((el) => {
    const issues = [];
    
    // Check for missing alt attributes on images
    const images = el.querySelectorAll('img');
    images.forEach(img => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        issues.push(`Image missing alt text: ${img.src}`);
      }
    });
    
    // Check for missing labels on form inputs
    const inputs = el.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (!input.id || !document.querySelector(`label[for="${input.id}"]`)) {
        if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
          issues.push(`Form input missing label: ${input.type || input.tagName}`);
        }
      }
    });
    
    // Check for empty links or buttons
    const links = el.querySelectorAll('a, button');
    links.forEach(link => {
      if (!link.textContent.trim() && !link.getAttribute('aria-label')) {
        issues.push(`Empty link or button: ${link.outerHTML.substring(0, 100)}`);
      }
    });
    
    return issues;
  });
  
  return results;
}

/**
 * Performance helper
 */
async function measurePageLoadTime(page, url) {
  const startTime = Date.now();
  
  await page.goto(url, { waitUntil: 'networkidle' });
  
  const endTime = Date.now();
  const loadTime = endTime - startTime;
  
  // Get additional performance metrics
  const metrics = await page.evaluate(() => {
    const perfData = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
      loadComplete: perfData.loadEventEnd - perfData.navigationStart,
      firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
    };
  });
  
  return {
    totalLoadTime: loadTime,
    ...metrics
  };
}

module.exports = {
  waitForStableElement,
  isElementInViewport,
  smoothScrollToElement,
  getComputedStyle,
  hasClass,
  waitForNetworkIdle,
  APIMocker,
  takeScreenshot,
  checkAccessibility,
  measurePageLoadTime
};