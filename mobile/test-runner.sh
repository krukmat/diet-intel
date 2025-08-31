#!/bin/bash

# Test Runner for DietIntel Mobile App API Configuration System
# This script runs all tests related to the API configuration changes

echo "🧪 Running DietIntel Mobile API Configuration Tests"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the mobile directory."
    exit 1
fi

print_status "Installing test dependencies..."
npm install

# Run tests with coverage
print_status "Running all tests with coverage..."
npm run test:coverage

# Check if tests passed
if [ $? -eq 0 ]; then
    print_success "All tests passed! ✅"
else
    print_error "Some tests failed! ❌"
    exit 1
fi

print_status "Test coverage report generated in coverage/ directory"

# Run specific test suites
echo ""
print_status "Running specific test suites..."

echo ""
print_status "🏗️ Environment Configuration Tests"
npx jest config/__tests__/environments.test.ts --verbose

echo ""
print_status "🌐 API Service Tests"
npx jest services/__tests__/ApiService.test.ts --verbose

echo ""
print_status "⚙️ API Configuration Modal Tests"
npx jest components/__tests__/ApiConfigModal.test.tsx --verbose

echo ""
print_status "📱 Screen Integration Tests"
npx jest screens/__tests__/ --verbose

echo ""
print_status "🔄 End-to-End API Configuration Tests"
npx jest __tests__/ApiConfiguration.e2e.test.tsx --verbose

echo ""
print_success "🎉 All API Configuration tests completed!"
print_status "Check the coverage report in coverage/lcov-report/index.html for detailed coverage information."

# Display coverage summary if available
if [ -f "coverage/coverage-summary.json" ]; then
    echo ""
    print_status "📊 Coverage Summary:"
    node -e "
        const fs = require('fs');
        const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
        const total = coverage.total;
        console.log(\`Lines: \${total.lines.pct}%\`);
        console.log(\`Functions: \${total.functions.pct}%\`);
        console.log(\`Branches: \${total.branches.pct}%\`);
        console.log(\`Statements: \${total.statements.pct}%\`);
    "
fi

echo ""
print_success "✨ API Configuration System is fully tested and ready for deployment!"