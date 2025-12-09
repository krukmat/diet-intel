const { _android: android } = require('playwright');

async function captureMobileScreenshots() {
  console.log('📱 Starting mobile screenshot capture with Playwright...');
  
  try {
    // Connect to Android device
    console.log('🔗 Connecting to Android device...');
    const devices = await android.devices();
    
    if (devices.length === 0) {
      console.log('❌ No Android devices found. Please ensure:');
      console.log('   1. Android emulator is running');
      console.log('   2. USB debugging is enabled');
      console.log('   3. ADB is properly configured');
      return;
    }
    
    const device = devices[0];
    console.log(`✅ Connected to device: ${await device.model()}`);
    
    // Launch or connect to the DietIntel app
    console.log('🚀 Looking for DietIntel app...');
    
    // Try to find and launch the app
    const context = await device.launchBrowser();
    const page = await context.newPage();
    
    // Navigate to the Expo app or development build
    // This assumes the app is already running via Expo Go or development build
    
    await page.waitForTimeout(2000);
    
    // Take screenshot of home screen
    console.log('📸 Capturing home screen...');
    await page.screenshot({ 
      path: 'screenshots/mobile-home-screen.png',
      fullPage: true 
    });
    
    // Navigate to Upload Label
    console.log('🏷️ Navigating to Upload Label...');
    
    // Look for Upload Label tab
    try {
      const uploadTab = page.locator('text="🏷️ Upload Label"');
      if (await uploadTab.count() > 0) {
        await uploadTab.click();
        await page.waitForTimeout(2000);
        
        console.log('📸 Capturing Upload Label with home button...');
        await page.screenshot({ 
          path: 'screenshots/upload-label-with-home-nav.png',
          fullPage: true 
        });
      }
    } catch (error) {
      console.log('⚠️ Could not capture Upload Label screen:', error.message);
    }
    
    // Navigate to Meal Plan
    console.log('🍽️ Navigating to Meal Plan...');
    
    try {
      const mealPlanTab = page.locator('text="🍽️ Meal Plan"');
      if (await mealPlanTab.count() > 0) {
        await mealPlanTab.click();
        await page.waitForTimeout(5000); // Wait for meal plan generation
        
        console.log('📸 Capturing Meal Plan with home button...');
        await page.screenshot({ 
          path: 'screenshots/meal-plan-with-home-nav.png',
          fullPage: true 
        });
      }
    } catch (error) {
      console.log('⚠️ Could not capture Meal Plan screen:', error.message);
    }
    
    await context.close();
    console.log('✅ Mobile screenshot capture completed!');
    
  } catch (error) {
    console.error('❌ Error during mobile screenshot capture:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Make sure Android emulator is running');
    console.log('   2. Make sure DietIntel app is installed and running');
    console.log('   3. Try: adb devices (should show your emulator)');
    console.log('   4. Try: npx expo run:android');
  }
}

// Alternative method using ADB screenshots directly
async function captureWithADB() {
  console.log('📱 Using ADB to capture screenshots...');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // Check if device is connected
    const { stdout } = await execPromise('adb devices');
    console.log('Connected devices:', stdout);
    
    if (!stdout.includes('emulator') && !stdout.includes('device')) {
      console.log('❌ No Android device found');
      return;
    }
    
    // Take screenshots using ADB
    console.log('📸 Taking screenshot with ADB...');
    
    // Capture current screen
    await execPromise('adb shell screencap -p /sdcard/screenshot.png');
    await execPromise('adb pull /sdcard/screenshot.png screenshots/current-mobile-screen.png');
    await execPromise('adb shell rm /sdcard/screenshot.png');
    
    console.log('✅ Screenshot saved as current-mobile-screen.png');
    console.log('📝 Please manually navigate the app and run this script multiple times:');
    console.log('   1. Navigate to Upload Label → Run script → Rename to upload-label-with-home-nav.png');
    console.log('   2. Navigate to Meal Plan → Run script → Rename to meal-plan-with-home-nav.png');
    
  } catch (error) {
    console.error('❌ ADB screenshot failed:', error.message);
  }
}

// Run both methods
console.log('Choose screenshot method:');
console.log('1. Playwright automation (advanced)');
console.log('2. ADB manual screenshots (simple)');

// For now, let's use the ADB method as it's more reliable
captureMobileScreenshots().catch(() => {
  console.log('\n🔄 Falling back to ADB method...');
  captureWithADB();
});