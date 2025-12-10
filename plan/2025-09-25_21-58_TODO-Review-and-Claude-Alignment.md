# TODO Review and CLAUDE Alignment Plan (2025-09-25 21:58)

## Objective
Inventory outstanding TODO markers, reconcile them with CLAUDE workflow constraints, and define a prioritized action plan for upcoming work.

## TODO Inventory Snapshot
- **Mobile (React Native)**
  - `mobile/screens/SmartDietScreen.tsx#L214`: Replace placeholder `'anonymous'` user ID handling.
  - `mobile/screens/RecommendationsScreen.tsx#L132,#L142`: Implement meal plan customization integration and add-to-plan API call.
  - `mobile/screens/RecipeHomeScreen.tsx#L61,#L113`: Load live recipe stats and random recipe generation for release R.2.1.6.
  - `mobile/screens/RecipeDetailScreen.tsx#L283`: Hook recipe detail view to backend API once endpoint is ready.
- **Backend (FastAPI)**
  - `app/services/shopping_optimization.py#L1051`: Fill in `unit_cost` estimation logic within shopping optimization service.
  - `app/routes/product.py#L42,#L43,#L204,#L205,#L334,#L335`: Wire JWT-derived `user_id` and session tracking once auth integration lands.
  - `app/routes/smart_diet.py#L407,#L541`: Implement optimization application flow and feedback metrics computation.

## CLAUDE Workflow Guardrails
- Always surface a written plan (and obtain approval) before executing tasks or fixes.
- Document each plan as an `.md` file in `plan/` with timestamp and close it out with affected files + outcomes.
- Treat README updates, screenshots, and manual test documentation (`manual-user-tests.md`) as mandatory when relevant features/fixes ship; ensure the latter is gitignored.
- Run Android simulator only; respect screenshot storage rules and root `screenshots/` usage.
- Preserve diligence in analysis; honor architecture diagrams referenced in READMEs.

## Prioritized Action Plan (Pending Approval)
1. **Security & Identity Integration (Backend + Mobile)**: Implement JWT-aware `user_id`/`session_id` extraction in product routes, then propagate real user IDs into mobile screens (`SmartDietScreen`, `RecommendationsScreen`). Requires auth context review.
2. **Smart Diet Optimization Loop**: Complete backend optimization apply/feedback metrics (`smart_diet.py`) and connect mobile recommendation actions to new endpoints, ensuring end-to-end testing via Playwright/Jest where applicable.
3. **Recipe Experience Enhancements**: Finish recipe stats/random generation on mobile and wire detail screen to backend API once stabilized, aligning with R.2.1.6 milestones.
4. **Shopping Optimization Costing**: Implement `unit_cost` estimation logic in `shopping_optimization.py`, validate with pytest + manual checklist, and update docs for any pricing assumptions.
5. **Operational Follow-Through**: For each deliverable above, plan per CLAUDE mandates—create task lists, capture manual test steps in `manual-user-tests.md`, update README timelines/screenshots, and store any new reports under `plan/`.

*Awaiting approval before executing any implementation work.*
