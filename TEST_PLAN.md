# TEST_PLAN — QuickActions gating fix (Option A)

## Scope
- Address regression where QuickActions bypassed existing feature toggles in `mobile/App.tsx`.

## Steps executed
1) Audit toggles and actions
   - Reviewed `mobile/App.tsx` nav bar gating and `mobile/services/DeveloperSettings.ts`.
   - Identified toggles: `barcodeScanner`, `uploadLabelFeature`, `mealPlanFeature`, `trackingFeature`.
   - Confirmed no toggle exists for `recipes`; TabBar shows it unconditionally.

2) Create action→toggle mapping
   - Added `isScreenEnabled(screen)` in `mobile/App.tsx` mapping screens to toggles.

3) Apply gating in QuickActions
   - Built `actions` array conditionally per toggle.
   - Wrapped each `onPress` with a safety check for its toggle.

4) Hide QuickActions if all actions disabled
   - Only render `<QuickActions />` when `actions.length > 0`.

## Validation
- Static review of `mobile/App.tsx` confirmed actions now reflect toggles.
- Consistency check with TabBar: scanner/plan/track align; recipes remains visible (no toggle defined).

## Manual verification checklist
- Set `barcodeScanner=false` → QuickActions hides Scan Product and nav tab; pressing other actions works.
- Set `trackingFeature=false` → hides Log Meal; no navigation to Track.
- Set `mealPlanFeature=false` → hides View Plan; no navigation to Plan.
- Disable all three → QuickActions section is hidden entirely.

## Notes
- Kept changes minimal; no new toggles introduced.
- Did not refactor global navigation helpers to enforce gating (out of scope for Option A).

## Token/time estimates
- Initial estimate: 60–120 LOC; ~1–2 h; tokens ≈ 1.2k–2.0k end‑to‑end.
- Actual: ~45–60 LOC changed; ~0.5–1.0 h; tokens ≈ 800–1,000.

