# Backend & Mobile Identity Integration Plan (2025-09-25 22:01)

## Objective
Enable authenticated context through product-related FastAPI routes and propagate real user identifiers into mobile Smart Diet and Recommendations flows.

## Task List (Pending Approval)
1. **Auth Context Audit**
   - Review existing JWT issuance (`app/routes/auth.py`, related services) and available FastAPI dependency utilities for user extraction.
   - Confirm current session handling expectations (cookies vs headers) and required fields for downstream logging/analytics.
2. **Backend JWT & Session Injection**
   - Implement dependency or middleware to parse JWT, validate signature, and attach `user_id` plus optional `session_id` to requests.
   - Refactor `app/routes/product.py` endpoints to consume the injected context, replacing placeholder TODOs.
3. **Automated Verification**
   - Extend or add pytest coverage ensuring product routes reject missing/invalid tokens and surface `user_id` in responses/logged events as expected.
4. **Mobile Client Integration**
   - Identify auth storage within React Native app (e.g., AsyncStorage or context) and wire authenticated fetch helpers to include JWT.
   - Update `SmartDietScreen` and `RecommendationsScreen` to pass current user identifiers when invoking backend actions.
   - Ensure add-to-plan triggers actual API call with authenticated payload.
5. **Documentation & Manual QA**
   - Draft manual verification steps in `manual-user-tests.md` (ensure gitignore entry) covering backend auth flow and mobile interactions.
   - Update relevant READMEs or release notes if user-visible behavior changes; capture screenshots if UI states vary.

## Outcome Summary (Completed 2025-09-25)
- Added shared request-context helpers that hydrate FastAPI routes with `user_id` and `session_id`, replacing placeholder TODOs in `app/routes/product.py` and ensuring logs tag authenticated actors.
- Introduced `get_session_by_access_token` in the database service plus coverage (`tests/test_request_context.py`) verifying context extraction for valid, invalid, and missing tokens.
- Extended mobile API layer to attach bearer tokens automatically and created high-signal UX flows in `SmartDietScreen` and `RecommendationsScreen` that require login before adding to plans or posting feedback.
- Documented manual verification steps in `manual-user-tests.md` and ensured the file is ignored by git for future updates.

## Files Updated
- `.gitignore`
- `app/services/database.py`
- `app/services/auth.py`
- `app/routes/product.py`
- `tests/test_request_context.py`
- `mobile/services/ApiService.ts`
- `mobile/screens/SmartDietScreen.tsx`
- `mobile/screens/RecommendationsScreen.tsx`
- `manual-user-tests.md`
