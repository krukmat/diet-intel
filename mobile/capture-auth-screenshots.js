const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure screenshots directory exists
const screenshotDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureAuthScreenshots() {
    console.log('📱 Starting authentication screenshots capture...');

    try {
        // Wait for app to fully load
        console.log('⏳ Waiting for app to load...');
        await sleep(5000);

        // Screenshot 1: Splash Screen (if visible)
        console.log('📸 Capturing splash screen...');
        execSync('adb exec-out screencap -p > mobile/screenshots/mobile-auth-splash.png');
        await sleep(2000);

        // Screenshot 2: Login Screen (should be default)
        console.log('📸 Capturing login screen...');
        execSync('adb exec-out screencap -p > mobile/screenshots/mobile-auth-login.png');
        await sleep(1000);

        // Navigate to register (tap "Create Account" button)
        console.log('🔄 Navigating to register screen...');
        execSync('adb shell input tap 500 750'); // Approximate position of register link
        await sleep(2000);

        // Screenshot 3: Register Screen
        console.log('📸 Capturing register screen...');
        execSync('adb exec-out screencap -p > mobile/screenshots/mobile-auth-register.png');
        await sleep(1000);

        // Fill in demo credentials for login test
        console.log('🔄 Going back to login...');
        execSync('adb shell input tap 300 750'); // Back to login
        await sleep(2000);

        // Tap demo account button if available
        console.log('📱 Testing demo login...');
        execSync('adb shell input tap 500 400'); // Demo account button
        await sleep(2000);

        // Screenshot 4: Login with demo credentials
        console.log('📸 Capturing login with demo credentials...');
        execSync('adb exec-out screencap -p > mobile/screenshots/mobile-auth-login-demo.png');
        await sleep(1000);

        // Attempt login
        execSync('adb shell input tap 500 650'); // Login button
        await sleep(3000);

        // Screenshot 5: Main app after authentication
        console.log('📸 Capturing authenticated main app...');
        execSync('adb exec-out screencap -p > mobile/screenshots/mobile-auth-main-app.png');

        console.log('✅ Authentication screenshots captured successfully!');
        console.log('📁 Screenshots saved to mobile/screenshots/');

    } catch (error) {
        console.error('❌ Error capturing screenshots:', error.message);
    }
}

// Run the screenshot capture
captureAuthScreenshots();