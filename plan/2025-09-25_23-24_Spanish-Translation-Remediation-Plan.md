# Spanish Translation Remediation Plan (2025-09-25 23:24)

## Objective
Restore Smart Recipe AI Spanish translations by stabilizing backend translation providers, adding fallbacks, and validating client behavior.

## Proposed Actions
1. **Provider Availability & Config**
   - Decide on primary translation provider (Google via open network vs Microsoft/Yandex with API keys).
   - Update deployment secrets (`MICROSOFT_API_KEY`, `YANDEX_API_KEY`) or enable outbound network access for Google.
   - Ensure Redis cache service is running; update translation service to surface cache availability in health checks.
2. **Graceful Fallback Enhancements**
   - Extend `RecipeTranslationService` with offline glossary for common recipe terms when providers fail.
   - Add structured error reporting (e.g., `translation_status` field) so clients can display language fallback messaging.
3. **Health & Observability**
   - Augment `/recipe-ai/health` to report translator reachability and cache status.
   - Add alerts/log levels for repeated provider failures to detect regressions early.
4. **Testing & QA**
   - Create backend integration tests mocking successful translation response (ensuring fallback to glossary when providers unavailable).
   - Add React Native Jest tests (or detox/Playwright flows) covering RecipeLanguageToggle → `generateRecipeWithLanguage` pipeline.
   - Update `manual-user-tests.md` with Spanish verification scenarios (already outlined).

## Dependencies
- Access to set environment variables/secrets in the deployment environment.
- Confirmation from DevOps on network policy for translation providers.

## Success Criteria
- `/recipe-ai/generate` returns Spanish content when `target_language: 'es'`.
- Health endpoint reports translator availability; alerts fire when all providers fail.
- Automated and manual tests assert Spanish/English toggles and fallback messaging.

## Next Steps
- Await decision on provider configuration (network vs keys).
- Draft implementation PR integrating configuration + code changes, including tests.

## Progress (2025-09-25)
- Added dictionary-driven fallback in `app/services/recipe_translation_service.py` to translate common terms when external providers fail.
- Exposed fallback availability via `/translate/health` (`app/routes/translation.py`, `app/models/translation.py`).
- Created targeted tests validating fallback behaviour (`tests/test_recipe_translation_service.py`).
