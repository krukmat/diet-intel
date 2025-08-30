const { chromium } = require('playwright');

async function captureScreenshots() {
  console.log('🎬 Starting Playwright screenshot capture...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 }, // Pixel 7 viewport size
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to Expo web development URL
    // We need to find the web URL that Expo is serving
    console.log('📱 Opening Expo web development server...');
    
    // Try common Expo web development URLs
    const expoUrls = [
      'http://localhost:19006',
      'http://localhost:8081',
      'http://127.0.0.1:19006',
      'http://127.0.0.1:8081'
    ];
    
    let connected = false;
    for (const url of expoUrls) {
      try {
        console.log(`🔍 Trying ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 5000 });
        connected = true;
        console.log(`✅ Connected to ${url}`);
        break;
      } catch (error) {
        console.log(`❌ Failed to connect to ${url}`);
        continue;
      }
    }
    
    if (!connected) {
      console.log('❌ Could not connect to Expo web server');
      console.log('💡 Make sure Expo is running with web support:');
      console.log('   npx expo start --web');
      await browser.close();
      return;
    }
    
    // Wait for React Native app to load
    await page.waitForTimeout(3000);
    
    // Screenshot 1: Home screen with navigation tabs
    console.log('📸 Capturing home screen...');
    await page.screenshot({ 
      path: 'screenshots/home-screen-with-navigation.png',
      fullPage: false 
    });
    
    // Navigate to Upload Label feature
    console.log('🏷️ Navigating to Upload Label...');
    
    // Look for Upload Label tab and click it
    const uploadLabelTab = page.locator('text=Upload Label').or(
      page.locator('text=🏷️ Upload Label')
    ).or(
      page.locator('[role="button"]:has-text("Upload")')
    );
    
    if (await uploadLabelTab.count() > 0) {
      await uploadLabelTab.first().click();
      await page.waitForTimeout(2000);
      
      console.log('📸 Capturing Upload Label screen with home button...');
      await page.screenshot({ 
        path: 'screenshots/upload-label-with-home-nav.png',
        fullPage: false 
      });
    } else {
      console.log('❌ Could not find Upload Label tab');
    }
    
    // Navigate to Meal Plan feature  
    console.log('🍽️ Navigating to Meal Plan...');
    
    // Look for Meal Plan tab and click it
    const mealPlanTab = page.locator('text=Meal Plan').or(
      page.locator('text=🍽️ Meal Plan')
    ).or(
      page.locator('[role="button"]:has-text("Meal")')
    );
    
    if (await mealPlanTab.count() > 0) {
      await mealPlanTab.first().click();
      await page.waitForTimeout(5000); // Wait longer for meal plan to generate
      
      console.log('📸 Capturing Meal Plan screen with home button...');
      await page.screenshot({ 
        path: 'screenshots/meal-plan-with-home-nav.png',
        fullPage: false 
      });
    } else {
      console.log('❌ Could not find Meal Plan tab');
    }
    
    console.log('✅ Screenshot capture completed!');
    
  } catch (error) {
    console.error('❌ Error during screenshot capture:', error);
  }
  
  await browser.close();
}

// Run the screenshot capture
captureScreenshots();