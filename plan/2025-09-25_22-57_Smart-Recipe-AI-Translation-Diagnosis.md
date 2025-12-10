# Smart Recipe AI Spanish Translation Diagnosis (2025-09-25 22:57)

## Objective
Investigate why Smart Recipe AI responses are not translating into Spanish and outline remediation steps.

## Task List (Pending Approval)
1. **Symptom Reproduction & Logs**
   - Identify the exact endpoint/UI flow (webapp, mobile, or API) where Spanish output fails.
   - Capture current responses and language parameters being sent.
2. **Backend Translation Pipeline Review**
   - Inspect translation-related services (e.g., `app/routes/translation.py`, `app/services/recipe_translation_service.py`) for regressions or configuration issues.
   - Verify language detection/selection logic inside Recipe AI routes.
3. **Frontend/Client Verification**
   - Review client code invoking Recipe AI (webapp/mobile) to ensure Spanish locale flags or headers are forwarded.
4. **Root Cause Analysis & Fix Plan**
   - Document findings, propose fixes, and outline testing (automated + manual) required before implementation.

*Awaiting approval before execution.*

## Progress Log
- 2025-09-25 23:03 — Reproduced translation failure by invoking `TranslationService.translate_text('chicken breast', 'en', 'es')`; backend attempts Google → Microsoft → Yandex providers. Logs show:
  - Redis cache unavailable (`Error 1 connecting to localhost:6379`)
  - GoogleTranslator network resolution failure (`nodename nor servname provided`)
  - Microsoft/Yandex translators reject due to missing API keys
  Result: translation returns `None`, meaning Recipe AI falls back to original English content.
- 2025-09-25 23:12 — Reviewed translation pipeline:
  - `TranslationService` relies on Google (default), then Microsoft/Yandex; all need network/API keys.
  - Direct calls to each provider reproduce the same errors (no network or API credentials).
  - Recipe AI engine’s `generate_recipe_with_translation` delegates to `recipe_translation_service`, which also bails out once providers fail and leaves the recipe in English.
- 2025-09-25 23:18 — Frontend check: `recipeApi.generateRecipeWithLanguage` injects `target_language` from `getCurrentAppLanguage()`, but there are no Jest/React Native tests exercising Recipe AI translation flows; existing suites cover Smart Diet only. The mock responses toggle Spanish text when `target_language === 'es'`, so failing backend translations manifest as English output despite client wiring.

## Root Cause & Proposed Fixes
- **Root Cause:** Recipe translation depends on external providers (Google/Microsoft/Yandex via `deep_translator`). In the current environment Redis cache is offline and provider calls fail (no network or missing API keys). With all providers failing, the service returns the original English text, so Recipe AI never delivers Spanish output.
- **Remediation Options:**
  1. **Configuration Fix:** Supply reachable translation providers (enable outbound network or inject valid API keys for Microsoft/Yandex) and ensure Redis cache is available so successful translations persist. Minimum: set `MICROSOFT_API_KEY` and `YANDEX_API_KEY`, or switch primary provider to one with offline support.
  2. **Graceful Fallback:** Implement an internal Spanish glossary/offline dictionary in `RecipeTranslationService` to cover critical fields when external providers are unavailable, preventing complete failure.
  3. **Diagnostics & Tests:** Add integration tests/mocks for Recipe AI translation flows (mobile `useApiRecipes`, RecipeLanguageToggle) to assert that `target_language` propagates and that fallback messaging occurs when translation is skipped.
- **Next Steps for Fix:**
  - Decide on provider availability strategy with DevOps (network or keys).
  - Update backend config to expose failure status in `/recipe-ai/health` for easier monitoring.
  - Add frontend tests covering Spanish generation toggles (React Native + Playwright) once backend is reliable.
