const { chromium } = require('@playwright/test');
const axios = require('axios');

async function globalSetup() {
  console.log('🚀 Starting E2E test setup...');
  
  // Wait for webapp to be ready
  await waitForService('http://localhost:3000/health', 'WebApp', 60000);
  
  // Optionally wait for API to be ready (if running)
  try {
    await waitForService('http://localhost:8000/health', 'DietIntel API', 10000);
  } catch (error) {
    console.log('⚠️  DietIntel API not available - using mock responses');
  }
  
  console.log('✅ E2E test setup complete');
}

async function waitForService(url, serviceName, timeout = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      console.log(`🔍 Checking ${serviceName} at ${url}...`);
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.status === 200) {
        console.log(`✅ ${serviceName} is ready`);
        return;
      }
    } catch (error) {
      // Service not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`❌ ${serviceName} failed to become ready within ${timeout}ms`);
}

module.exports = globalSetup;