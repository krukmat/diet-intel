#!/usr/bin/env node

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

/**
 * Automated screenshot capture for DietIntel webapp
 * This script captures high-quality screenshots of key webapp interfaces
 */

const config = {
  baseURL: 'http://localhost:3000',
  apiURL: 'http://localhost:8000',
  screenshotsDir: path.join(__dirname, '..', 'screenshots'),
  viewport: { width: 1920, height: 1080 },
  timeout: 30000
};

const screenshots = [
  {
    name: 'homepage',
    path: '/',
    filename: 'homepage.png',
    description: 'Homepage with interactive API demos',
    waitFor: '.hero-section, .demo-section'
  },
  {
    name: 'meal-plans-dashboard',
    path: '/plans',
    filename: 'meal-plans-dashboard.png',
    description: 'Meal plans overview dashboard',
    waitFor: '.plans-grid, .stats-section'
  },
  {
    name: 'api-docs',
    path: '/docs',
    filename: 'api-docs.png',
    description: 'Interactive API documentation',
    baseURL: config.apiURL,
    waitFor: '.swagger-ui, .information-container'
  }
];

async function ensureDirectoryExists() {
  try {
    await fs.mkdir(config.screenshotsDir, { recursive: true });
    console.log(`📁 Screenshots directory ready: ${config.screenshotsDir}`);
  } catch (error) {
    console.error('Failed to create screenshots directory:', error);
    throw error;
  }
}

async function waitForServices() {
  console.log('🔄 Checking if services are running...');
  
  // Check webapp
  try {
    const response = await fetch(config.baseURL);
    if (response.ok) {
      console.log('✅ Webapp is running at', config.baseURL);
    } else {
      throw new Error(`Webapp returned status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Webapp is not running. Please start it with: npm start');
    throw new Error('Webapp service not available');
  }
  
  // Check API
  try {
    const response = await fetch(`${config.apiURL}/docs`);
    if (response.ok) {
      console.log('✅ API is running at', config.apiURL);
    } else {
      throw new Error(`API returned status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ API is not running. Please start it with: python main.py');
    throw new Error('API service not available');
  }
}

async function createSampleData(page) {
  console.log('🎭 Setting up sample data for screenshots...');
  
  try {
    // Navigate to homepage first
    await page.goto(config.baseURL, { waitUntil: 'networkidle' });
    
    // Fill barcode demo with sample data
    const barcodeInput = await page.locator('#barcodeInput');
    if (await barcodeInput.isVisible()) {
      await barcodeInput.fill('737628064502');
      console.log('  ✓ Sample barcode added to demo');
    }
    
    // Create sample meal plan data by injecting it into localStorage
    await page.evaluate(() => {
      // Sample meal plans for dashboard
      const samplePlans = [
        {
          id: '1',
          name: 'High Protein Plan',
          date: new Date().toISOString(),
          status: 'active',
          target_calories: 2200,
          created_at: new Date().toISOString(),
          bmr: 1750,
          tdee: 2200,
          flexibility_used: true,
          optional_products_used: 2,
          meals: [
            {
              name: 'Breakfast',
              target_calories: 550,
              actual_calories: 525,
              items: [
                {
                  name: 'Greek Yogurt with Berries',
                  serving: '200g',
                  calories: 150,
                  barcode: '000000000001',
                  macros: { protein_g: 15, fat_g: 5, carbs_g: 20, sugars_g: 12, salt_g: 0.1 }
                },
                {
                  name: 'Granola',
                  serving: '30g',
                  calories: 375,
                  barcode: '000000000002',
                  macros: { protein_g: 8, fat_g: 12, carbs_g: 45, sugars_g: 8, salt_g: 0.2 }
                }
              ]
            }
          ],
          metrics: {
            total_calories: 2150,
            protein_g: 165,
            fat_g: 95,
            carbs_g: 215,
            sugars_g: 45,
            salt_g: 6.2,
            protein_percent: 30,
            fat_percent: 40,
            carbs_percent: 30
          }
        }
      ];
      
      localStorage.setItem('dietintel_sample_plans', JSON.stringify(samplePlans));
    });
    
    console.log('  ✓ Sample meal plan data injected');
    
  } catch (error) {
    console.warn('⚠️ Could not set up all sample data:', error.message);
  }
}

async function captureScreenshot(browser, screenshot) {
  console.log(`📸 Capturing ${screenshot.description}...`);
  
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1
  });
  
  const page = await context.newPage();
  
  try {
    const url = (screenshot.baseURL || config.baseURL) + screenshot.path;
    console.log(`  → Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: config.timeout 
    });
    
    // Wait for specific elements if specified
    if (screenshot.waitFor) {
      try {
        // Try to wait for at least one of the specified selectors
        const selectors = screenshot.waitFor.split(',').map(s => s.trim());
        await Promise.race(
          selectors.map(selector => 
            page.waitForSelector(selector, { timeout: 10000 })
          )
        );
      } catch (error) {
        console.warn(`  ⚠️ Could not find expected elements: ${screenshot.waitFor}`);
      }
    }
    
    // Additional wait for dynamic content
    await page.waitForTimeout(2000);
    
    // Special handling for different pages
    if (screenshot.name === 'homepage') {
      // Scroll to show the full homepage including demos
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
    } else if (screenshot.name === 'api-docs') {
      // Wait for Swagger UI to fully load
      await page.waitForSelector('.swagger-ui', { timeout: 15000 });
      await page.waitForTimeout(3000);
    }
    
    const screenshotPath = path.join(config.screenshotsDir, screenshot.filename);
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: screenshot.name === 'homepage', // Full page for homepage, viewport for others
      quality: 90,
      type: 'png'
    });
    
    console.log(`  ✅ Screenshot saved: ${screenshotPath}`);
    
  } catch (error) {
    console.error(`  ❌ Failed to capture ${screenshot.name}:`, error.message);
    throw error;
  } finally {
    await context.close();
  }
}

async function captureMealPlanDetail(browser) {
  console.log('📸 Capturing meal plan detail page...');
  
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1
  });
  
  const page = await context.newPage();
  
  try {
    // First navigate to plans page to potentially create or find a plan
    await page.goto(`${config.baseURL}/plans`, { waitUntil: 'networkidle' });
    
    // Check if there are existing plans
    const planLinks = await page.locator('a[href*="/plans/"]').count();
    
    let detailUrl;
    if (planLinks > 0) {
      // Use existing plan
      const firstPlanLink = await page.locator('a[href*="/plans/"]').first().getAttribute('href');
      detailUrl = `${config.baseURL}${firstPlanLink}`;
    } else {
      // Create a mock detail page URL
      detailUrl = `${config.baseURL}/plans/sample`;
      
      // Inject mock data for the detail page
      await page.route(`${config.baseURL}/plans/sample`, async route => {
        // Return a mock response that would render the detail page
        await route.continue();
      });
    }
    
    console.log(`  → Navigating to: ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: 'networkidle', timeout: config.timeout });
    
    // Wait for charts and dynamic content to load
    await page.waitForTimeout(3000);
    
    const screenshotPath = path.join(config.screenshotsDir, 'meal-plan-detail.png');
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      quality: 90,
      type: 'png'
    });
    
    console.log(`  ✅ Screenshot saved: ${screenshotPath}`);
    
  } catch (error) {
    console.error('  ❌ Failed to capture meal plan detail:', error.message);
    
    // Fallback: capture plans page instead
    console.log('  📸 Capturing plans page as fallback...');
    await page.goto(`${config.baseURL}/plans`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const fallbackPath = path.join(config.screenshotsDir, 'meal-plan-detail.png');
    await page.screenshot({
      path: fallbackPath,
      fullPage: true,
      quality: 90,
      type: 'png'
    });
    
    console.log(`  ✅ Fallback screenshot saved: ${fallbackPath}`);
  } finally {
    await context.close();
  }
}

async function main() {
  console.log('🚀 Starting DietIntel screenshot capture...\n');
  
  try {
    await ensureDirectoryExists();
    await waitForServices();
    
    console.log('\n🌐 Launching browser...');
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Set up sample data
    const setupContext = await browser.newContext({ viewport: config.viewport });
    const setupPage = await setupContext.newPage();
    await createSampleData(setupPage);
    await setupContext.close();
    
    console.log('\n📸 Capturing screenshots...');
    
    // Capture standard screenshots
    for (const screenshot of screenshots) {
      await captureScreenshot(browser, screenshot);
    }
    
    // Capture meal plan detail with special handling
    await captureMealPlanDetail(browser);
    
    await browser.close();
    
    console.log('\n✅ All screenshots captured successfully!');
    console.log(`📁 Screenshots saved to: ${config.screenshotsDir}`);
    
    // List captured files
    const files = await fs.readdir(config.screenshotsDir);
    const screenshots = files.filter(file => file.endsWith('.png'));
    
    console.log('\n📋 Captured screenshots:');
    screenshots.forEach(file => {
      console.log(`  • ${file}`);
    });
    
  } catch (error) {
    console.error('\n❌ Screenshot capture failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, config };