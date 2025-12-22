# Medium-coverage targets (50–60%)

Source data:

- Per-file coverage is pulled from the latest `coverage.json` sweep (see the file for the raw metrics).
- Reference counts stem from `rg -o <module-name> app` so the prioritization reflects each module’s footprint. Note that generic terms such as `database` or `cache` will include some noisy hits, so treat them as upper-bound estimates.

## Status

Covers the current modules that still fall between 50% and 61% after the last sweep. The group is small right now, but keeping the attention here helps the next signal of the global coverage run approach the desired 80%.

### Group 1 (core data + diet helpers)
- `app/services/database.py` – **60.6%** coverage, **167** references. Central storage helper referenced by almost every service; the goal is to exercise transactional rollbacks, intentional `OperationalError`/`IntegrityError` handling, and the cache-fallback branches that guard `get_connection` and `execute_sql`.
- `app/services/smart_diet_cache.py` – **60.9%** coverage, **10** references. The cache layer backs Smart Diet insights/optimizations; expand tests that verify TTL drops, serialization failures, and the multi-step invalidation path triggered by `SmartDietCacheService.invalidate`.
- `app/services/smart_diet_optimized.py` – **60.1%** coverage, **2** references. This module wires Redis, the optimization engine, and the diet cache together; add coverage for empty optimization outputs, fallback planning when Redis is unavailable, and the instrumentation that records cache hits/misses.

## Actionable plan to reach 80%

1. **Database-focused batch (Group 1)** – extend `tests/services/test_database_service.py` (and any new helpers around it) with fixtures that:
   - Force `strategic_session` transactions to raise `OperationalError`, verifying the rollback helpers and error messaging logged by `database.py`.
   - Mock `AppCache`/`redis_client` inside the same module to confirm the fallback paths when caching fails.

2. **Smart Diet cache batch** – author or extend `tests/services/test_smart_diet_cache.py` to:
   - Assert TTL behavior when the cache misses and when a previously cached response is invalidated.
   - Simulate serialization errors during `store_suggestion` and confirm that the cache gate fails gracefully with telemetry.

3. **Smart Diet optimized batch** – target `tests/services/test_smart_diet_optimized_utils.py` (or the integration test suite) to:
   - Force Redis unavailable scenarios and confirm `optimize_diet` falls back to the base plan.
   - Validate the handling of an empty response from `OptimizationEngine` and the logging of the event.

Each completed batch should rerun `python -m pytest --cov=app` and refresh `coverage.json` so the next planning cycle reflects the new metrics. Document the targeted tests and touched files within a new plan entry inside `plan/` as required by the pipeline.
