/**
 * Smart Diet Integration Test
 * Tests the mobile SmartDietScreen with SmartDietService integration
 * Run this after Phase 9.2 mobile integration completion
 */

const { exec } = require('child_process');
const fs = require('fs');

console.log('🧠 Smart Diet Mobile Integration Test');
console.log('=====================================');

// Test 1: Check TypeScript compilation
console.log('\n1. Testing TypeScript compilation...');

exec('cd mobile && npx tsc --noEmit --skipLibCheck', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ TypeScript compilation errors found:');
    console.log(stderr);
  } else {
    console.log('✅ TypeScript compilation successful');
  }
});

// Test 2: Check SmartDietScreen imports
console.log('\n2. Checking SmartDietScreen imports...');

const screenPath = '../screens/SmartDietScreen.tsx';
if (fs.existsSync(screenPath)) {
  const content = fs.readFileSync(screenPath, 'utf8');
  
  const requiredImports = [
    'SmartDietContext',
    'SmartDietResponse', 
    'SmartSuggestion',
    'smartDietService'
  ];
  
  const missingImports = requiredImports.filter(imp => !content.includes(imp));
  
  if (missingImports.length === 0) {
    console.log('✅ All required Smart Diet imports present');
  } else {
    console.log('❌ Missing imports:', missingImports);
  }
} else {
  console.log('❌ SmartDietScreen.tsx not found');
}

// Test 3: Check SmartDietService integration
console.log('\n3. Checking SmartDietService integration...');

const servicePath = '../services/SmartDietService.ts';
if (fs.existsSync(servicePath)) {
  const content = fs.readFileSync(servicePath, 'utf8');
  
  const requiredMethods = [
    'getSmartSuggestions',
    'submitSuggestionFeedback',
    'getDietInsights'
  ];
  
  const missingMethods = requiredMethods.filter(method => !content.includes(method));
  
  if (missingMethods.length === 0) {
    console.log('✅ All required SmartDietService methods present');
  } else {
    console.log('❌ Missing methods:', missingMethods);
  }
} else {
  console.log('❌ SmartDietService.ts not found');
}

// Test 4: Check 4-context configuration
console.log('\n4. Checking 4-context configuration...');

if (fs.existsSync(screenPath)) {
  const content = fs.readFileSync(screenPath, 'utf8');
  
  const contexts = ['TODAY', 'OPTIMIZE', 'DISCOVER', 'INSIGHTS'];
  const missingContexts = contexts.filter(context => !content.includes(context));
  
  if (missingContexts.length === 0) {
    console.log('✅ All 4 Smart Diet contexts configured');
  } else {
    console.log('❌ Missing contexts:', missingContexts);
  }
}

console.log('\n📊 Integration Test Summary');
console.log('==========================');
console.log('Phase 9.2: Mobile Integration Completion - Testing Complete');
console.log('\nNext Steps:');
console.log('- Run mobile app to test UI functionality');
console.log('- Test API calls to backend Smart Diet endpoints');
console.log('- Verify 4-context switching works correctly');
console.log('- Test suggestion feedback and caching');