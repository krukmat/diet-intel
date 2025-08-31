const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureAuthScreenshots() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    try {
        console.log('📸 Capturing login page...');
        await page.goto('http://localhost:3001/auth/login');
        await page.waitForSelector('form', { timeout: 5000 });
        await page.screenshot({ 
            path: path.join(screenshotsDir, 'webapp-auth-login.png'),
            fullPage: true 
        });
        console.log('  ✅ Login page captured');
        
        console.log('📸 Capturing register page...');
        await page.goto('http://localhost:3001/auth/register');
        await page.waitForSelector('form', { timeout: 5000 });
        await page.screenshot({ 
            path: path.join(screenshotsDir, 'webapp-auth-register.png'),
            fullPage: true 
        });
        console.log('  ✅ Register page captured');
        
        console.log('📸 Capturing protected route redirect...');
        // Clear any existing auth cookies first
        await page.context().clearCookies();
        
        // Try to access dashboard directly without being logged in
        await page.goto('http://localhost:3001/dashboard');
        await page.waitForSelector('form', { timeout: 5000 });
        
        // Wait a moment for the redirect to complete and URL to update
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
            path: path.join(screenshotsDir, 'webapp-auth-protected.png'),
            fullPage: true 
        });
        console.log('  ✅ Protected route redirect captured');
        
    } catch (error) {
        console.error('Error capturing screenshots:', error.message);
    }
    
    await browser.close();
    console.log('✅ Auth screenshots completed!');
}

captureAuthScreenshots().catch(console.error);