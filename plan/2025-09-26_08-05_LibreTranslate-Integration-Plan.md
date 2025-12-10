# LibreTranslate Integration Plan (2025-09-26 08:05)

## Objective
Add optional support for a self-hosted LibreTranslate service to supply Spanish translations without relying on paid APIs.

## Task List (Pending Approval)
1. **Configuration Surface**
   - Extend runtime settings to accept `LIBRETRANSLATE_URL` (and optional auth key) so deployments can point to a local container.
2. **Service Adapter**
   - Update `TranslationService.translate_text` to call LibreTranslate when configured (before falling back to cloud providers), handling timeouts and errors gracefully.
   - Reuse existing fallback dictionary if LibreTranslate is unreachable.
3. **Health Reporting**
   - Reflect LibreTranslate availability in `/translate/health` for observability.
4. **Automated Tests**
   - Add tests mocking LibreTranslate HTTP responses (success/failure) to ensure the new path behaves correctly.
5. **Documentation**
   - Record deployment steps for running LibreTranslate locally (e.g., Docker command) and environment variable usage.

*Awaiting approval before execution.*

## Deployment Notes (Added 2025-09-26)
- Run LibreTranslate locally (example):
  ```bash
  docker run -d --name libretranslate -p 5000:5000 libretranslate/libretranslate:latest
  ```
- Configure DietIntel backend with:
  - `LIBRETRANSLATE_URL=http://localhost:5000`
  - Optional: `LIBRETRANSLATE_API_KEY=<key>` if the service is secured.
- Restart API to pick up env vars; verify `/translate/health` shows `LibreTranslate: available` and `fallback_available: true`.

## Progress Log
- Added config knobs (`app/config.py`) and LibreTranslate adapter in `TranslationService`.
- Health endpoint now reports LibreTranslate status and fallback availability.
- Added tests covering LibreTranslate success/failure paths and existing fallback dictionary.
