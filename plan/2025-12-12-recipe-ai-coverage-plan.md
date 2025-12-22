# Batch 7 Covering Recipe & Smart Diet Core (Dec 12 2025)

**Context:** After the first six batches and the full `python -m pytest --cov=app` scan we still sit at 76% global coverage. The biggest remaining gaps live in the Recipe AI/translation layers, the recipe database persistence engine and the Smart Diet optimized paths—in addition to half the gamification/social services that only cleared the 60s. To keep momentum toward 80%, Batch 7 will attack the modules that remain hardest to cover: `app/routes/recipe_ai.py`, `app/services/recipe_database.py`, `app/services/recipe_translation_service.py`, and `app/services/smart_diet_optimized.py`.

## Objective

- Drive Recipe AI and Smart Diet optimized logic over 50% by adding targeted suites.
- Capture database/translation/optimization errors, caching fallbacks and configuration branches that have been skipped so far.
- Document the exact scripts/tests to run so the next full coverage sweep has measurable deltas.

## Scripts & Tests (3–4 logical areas)

1. `app/routes/recipe_ai.py`  
   - Build `tests/test_recipe_ai_routes_extra.py` focusing on validation errors, translation fallbacks, feature flag gating, and responses from the new services (`recipe_database`, `recipe_translation_service`, `smart_diet_optimized`).  
   - Cover both the optimistic happy path and the pathways that log & propagate 500/422 responses when downstream services fail.
2. `app/services/recipe_database.py`  
   - Extend `tests/services/test_recipe_database_service.py` to hit branch coverage for cache bypass, error handling (`OperationalError`, invalid recipe IDs) and upgrade when `integration_features` are toggled.  
   - Add helpers that stub `_get_connection` to raise and ensure fallback logic logs and rethrows cleanly.
3. `app/services/recipe_translation_service.py`  
   - Add deep tests that simulate LibreTranslate timeouts, missing translations from providers and cached responses; ensure `_translate_with_libretranslate` and `_translate_with_providers` cover retries/fallbacks.  
   - Validate that `get_translation_service` memoizes instances and that unsupported languages raise `HTTPException` (via routes above if needed).
4. `app/services/smart_diet_optimized.py` *(optional)*  
   - Target the `SmartDietOptimizedService` paths where suggestions are pruned or feedback is saved; ensure `tests/test_smart_diet_optimized.py` verifies the high-level orchestration with mocked `RecipeDatabaseService`/`RecipeTranslationService`.

## Verification command

- `python -m pytest tests/test_recipe_ai_routes_extra.py tests/services/test_recipe_database_service.py tests/test_recipe_translation_service.py tests/test_smart_diet_optimized.py`

## Success criteria

- Recipe AI and translation routes covering validation + fallback responses.
- Recipe database handles connection errors and caching toggles with dedicated tests.
- Smart Diet optimized service uses the new tests to drive more branches (esp. 404/500 responses from dependencies).
- Record results and coverage deltas in `plan/2025-12-31-phase3-coverage-roadmap.md` and update this file with files touched/tests run before finishing batch.

## Batch 7 execution — 2025-12-12
- **Objective:** Verify that the new Recipe AI, database, translation, and Smart Diet optimized suites exercise the validation/fallback/error branches before the next full sweep.
- **Tests executed:**  
  1. `python -m pytest tests/test_recipe_ai_routes_extra.py`  
  2. `python -m pytest tests/services/test_recipe_database_service.py`  
  3. `python -m pytest tests/services/test_recipe_translation_service_extra.py`  
  4. `python -m pytest tests/services/test_smart_diet_optimized_utils.py`
- **Results:**  
  - All suites pass; the fast database tests and translation helpers now cover error-handling, caching, and provider fallback branches.  
  - Logs/metrics (e.g., `PerformanceMonitor`) now have dedicated coverage by the new Smart Diet tests, while the route helper touches personalization/data conversions.  
- **Siguientes pasos:**  
  - Extend `tests/test_recipe_ai_routes_extra.py` with failure cases for `recommendation_engine` or `recipe_db_service` when they reject requests, and consider adding a `pytest.fixture` for recipes with translation metadata.  
  - Target `app/services/recipe_database.py` caching and analytics more deeply, and keep monitoring the global `76%` coverage until the next full `--cov=app` run after further batches.
