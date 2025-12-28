# Product Repository Schema Fix - TDD Approach

**Task:** Fix schema mismatch between `products` table and ProductRepository
**Approach:** TDD (Test-first, then implementation)

## Test Cases

### Test 1: Products table has `id` column
- Verify `id` INTEGER PRIMARY KEY AUTOINCREMENT exists
- Verify `barcode` TEXT UNIQUE NOT NULL exists
- Status: ❌ RED (will fail initially)

### Test 2: Create product and retrieve by id
- Insert product via `create()`
- Retrieve using `get_by_id()` with returned id
- Verify product matches original
- Status: ❌ RED (create() currently fails on get_by_id call)

### Test 3: Barcode is unique constraint
- Insert product with barcode
- Attempt to insert duplicate barcode
- Should raise IntegrityError
- Status: ❌ RED (current schema doesn't enforce this)

### Test 4: get_by_id() returns correct product
- Create multiple products
- Get each by id
- Verify correct product returned
- Status: ❌ RED (id column doesn't exist)

## Implementation Order

1. Write all tests (RED phase)
2. Create migration script
3. Update schema in database.py
4. Execute migration on test DB
5. Run tests (GREEN phase)
6. Verify full test suite passes
