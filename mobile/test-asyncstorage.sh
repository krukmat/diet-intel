#!/bin/bash

# AsyncStorage E2E Test Runner
# Tests the complete AsyncStorage functionality after fixing the native module issue

echo "🧪 Running AsyncStorage Persistence E2E Tests"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
TEST_FILE="__tests__/AsyncStorage.persistence.e2e.test.tsx"
JEST_CONFIG="--testPathPattern=${TEST_FILE} --verbose --detectOpenHandles --forceExit"

echo -e "${BLUE}Test Scope:${NC}"
echo "✅ Photo logs persistence (TrackScreen)"
echo "✅ Weight history persistence (TrackScreen)" 
echo "✅ Reminders persistence (ReminderSnippet)"
echo "✅ Error handling and data recovery"
echo "✅ Cross-component storage integration"
echo ""

echo -e "${YELLOW}Starting test execution...${NC}"
echo ""

# Run the AsyncStorage E2E tests
npm run test:asyncstorage:verbose

# Check the test results
TEST_RESULT=$?

echo ""
echo "=============================================="

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All AsyncStorage E2E tests passed!${NC}"
    echo ""
    echo "🎉 AsyncStorage fix is working correctly:"
    echo "   • Photo logs will persist between app restarts"
    echo "   • Weight history will persist between app restarts"
    echo "   • Reminders will persist between app restarts"
    echo "   • Error handling is robust"
    echo "   • Data integrity is maintained"
    echo ""
    echo -e "${BLUE}Ready for manual testing in the simulator!${NC}"
else
    echo -e "${RED}❌ Some AsyncStorage E2E tests failed${NC}"
    echo ""
    echo "🔧 Check the test output above for specific failures"
    echo "   Common issues to investigate:"
    echo "   • Mock implementations not matching actual component methods"
    echo "   • AsyncStorage key naming mismatches"
    echo "   • Component state management issues"
    echo "   • Missing async/await in test setup"
    echo ""
    echo -e "${YELLOW}Fix the failing tests before proceeding to manual testing${NC}"
fi

echo ""
echo "📝 Next Steps:"
echo "1. If tests pass: Run manual testing in simulator"
echo "2. If tests fail: Fix issues and re-run tests"
echo "3. After successful testing: Commit changes"
echo ""
echo "Manual test commands:"
echo "  npm run android          # Start app in simulator"
echo "  npm run test:coverage    # Run full test suite"
echo ""

exit $TEST_RESULT