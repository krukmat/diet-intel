# Test Coverage Improvement Plan
**Date:** 2025-12-11
**Current Coverage:** 63%
**Target:** 80%+
**Approach:** TDD, KISS, DRY, Token-optimized

## Strategy

### Principles
1. **TDD**: Write test, see it fail, implement, see it pass
2. **KISS**: Simple tests, no over-engineering
3. **DRY**: Reuse fixtures, avoid duplication
4. **Token Optimization**: Batch operations, targeted analysis

### Prioritization Matrix

**Priority = (100 - Coverage%) × Reference_Count × Complexity_Weight**

Where:
- High complexity (services, core logic): 3x
- Medium complexity (routes, models): 2x
- Low complexity (utils, helpers): 1x

## Phase 1: High-Priority Files (Ordered by Impact)

### Top 5 Targets (Priority Score: Coverage% × References × Weight)

1. **app/routes/block.py** (Priority: 26,793)
   - Coverage: 36.2%
   - References: 210
   - Type: Routes (weight: 2x)
   - **Action**: Test block/unblock flows, error cases

2. **app/routes/recommendations.py** (Priority: 22,166)
   - Coverage: 16.0%
   - References: 132
   - Type: Routes (weight: 2x)
   - **Action**: Test recommendation generation, filters

3. **app/services/smart_diet.py** (Priority: 13,212)
   - Coverage: 47.6%
   - References: 84
   - Type: Service (weight: 3x)
   - **Action**: Test optimization logic, edge cases

4. **app/routes/posts.py** (Priority: 11,165)
   - Coverage: 47.8%
   - References: 107
   - Type: Routes (weight: 2x)
   - **Action**: Test CRUD operations, permissions

5. **app/services/translation_service.py** (Priority: 10,111)
   - Coverage: 37.6%
   - References: 54
   - Type: Service (weight: 3x)
   - **Action**: Test translation caching, fallbacks

### Approach:
1. Focus on critical path first (happy path)
2. Add error handling tests
3. Test edge cases
4. Batch creation: 5-10 tests per file

## Phase 2: Routes & Models (<50% coverage)

### Approach:
1. Focus on validation logic
2. Test error responses
3. Ensure all HTTP methods covered
4. Reuse existing fixtures

## Phase 3: Integration Tests

### Approach:
1. End-to-end user flows
2. Database transactions
3. External API mocking

## Execution Plan

### Step 1: Coverage Analysis (5 min)
```bash
pytest --cov=app --cov-report=json -q
python analyze_coverage.py  # Generate prioritized list
```

### Step 2: Create Test Template (reusable)
```python
# tests/test_{module}_coverage.py
import pytest

class Test{Module}Coverage:
    def test_uncovered_function_1(self):
        # Arrange
        # Act
        # Assert
        pass
```

### Step 3: Batch Test Creation
- Group by module
- Write 5-10 tests per file
- Run coverage after each batch
- Target: +5% per iteration

### Step 4: Iterate
- Measure coverage
- Identify next priority
- Repeat

## Token Optimization Techniques

1. **Batch File Reads**: Read multiple files at once
2. **Coverage JSON**: Use programmatic analysis vs manual grep
3. **Template Reuse**: Copy-paste test patterns
4. **Minimal Context**: Only read uncovered lines
5. **Fast Iteration**: Small commits, quick validation

## Success Metrics

- ✅ Coverage 63% → 80% (+17%)
- ✅ All critical paths tested
- ✅ No regressions (existing tests pass)
- ✅ Token usage < 30k per phase
- ✅ <2 hours total execution time

## Notes

- Focus on business logic, not boilerplate
- Skip trivial getters/setters
- Prioritize error handling
- Document why tests exist (not just "coverage")
