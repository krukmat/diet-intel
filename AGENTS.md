# Repository Guidelines

## Project Structure & Module Organization
FastAPI backend lives in `app/`, split into `routes/`, `services/`, `models/`, and `utils/` for clear domain boundaries, with the entrypoint in `main.py`. Shared database assets sit in `database/` (`init/` SQL migrations and SQLite snapshots) while reusable scripts live in `scripts/` (e.g., `start-dev.sh`). Frontend surfaces live separately: `webapp/` hosts the Express-based UI, and `mobile/` contains the React Native client. Tests mirror the backend layout under `tests/` and UI suites under `webapp/tests/`.

## Build, Test, and Development Commands
- `./scripts/start-dev.sh` boots the full Docker stack (API, PostgreSQL, Redis) after copying `.env.example` as needed.
- `python -m uvicorn main:app --reload` runs the FastAPI service against your local environment without containers.
- `python -m pytest` executes backend suites with coverage, writing HTML output to `htmlcov/index.html`.
- `npm --prefix webapp run dev` and `npm --prefix webapp run test:e2e` drive the web experience locally and through Playwright end-to-end checks.

## Coding Style & Naming Conventions
Target Python 3.11 (see `Dockerfile`) and follow PEP 8 with four-space indentation; prefer explicit type hints in new service-layer functions. Route modules export FastAPI routers named `router`, so keep filenames descriptive (`recipe_ai.py`, `smart_diet.py`). JavaScript follows ES2020 modules; use camelCase for functions and kebab-case filenames in `webapp/routes/`. Run `npm --prefix webapp run lint` before pushing UI changes.

## Testing Guidelines
Pytest is configured via `pytest.ini` to discover `test_*.py` and enforce `--strict-markers`; add granular markers (`@pytest.mark.integration`) where runtime matters. Maintain coverage for `app/` modules and inspect gaps via `htmlcov/`. Web tests rely on Jest for unit checks and Playwright for workflows; colocate snapshots under `webapp/tests/__snapshots__/` when needed and prefer descriptive test names mirroring route or service behavior.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit prefixes (`feat:`, `fix:`). Keep subject lines under 72 characters and describe scope succinctly, e.g., `fix: harden OCR retry logic`. Each PR should link related issues, outline risk, and list verification steps (backend pytest, webapp jest/playwright, relevant docker-compose runs). Attach UI screenshots or API response samples when behavior changes, and update docs within `docs/` or `README*.md` if workflows shift.

## Configuration & Security Notes
Secrets belong in `.env`; never commit concrete credentials. The Docker workflow expects PostgreSQL and Redis variables defined there, so coordinate defaults with the `docker-compose.override.yml`. When touching OCR or CV dependencies, document extra system packages in `install_ocr_deps.py` and mirror them in the `Dockerfile` for parity.

## Cross-Project Practices
- Keep modules grouped by feature across tiers and mirror filenames/routes between backend and frontend surfaces so related functionality is easy to trace end-to-end.
- Capture plans inside the repo (Markdown or similar) whenever you scope a task; avoid leaving the plan only in chat so the backlog stays auditable.
- Keep `manual-user-tests.md` updated with any manual verification steps executed for a fix so QA evidence resides with the code change.
- Run backend pytest suites with coverage and linting before finishing any change, and apply the equivalent Jest/Playwright checks for UI work.
- Document every new or updated feature in the relevant README/docs section and process any pending review documents or CLAUDE-style prompts before closing a task.
- When preparing to commit, craft a Conventional Commit-style subject (<72 chars) and share it for approval before pushing; include verification steps and attach QA artifacts in PRs.
- Produce deployment notes (`DEPLOY_STEPS.md`) when a change affects release workflows, and when a feature branch is finalized, write a “project memory” doc under `docs/` and retire superseded internal notes with user confirmation.
## Imported Pipeline Practices
- Record every focused plan phase as a Markdown file in `plan/` whose filename includes the date and the objective; once a phase closes, append the list of files modified and tests run so the history is self-documenting.
- Store the artifacts that arise from each planning/testing phase (plans, coverage summaries, QA logs) inside the repo (`plan/`, `docs/`, or `artifacts/`) and never delete past snapshots—always extend them with new entries.
- Lean on TDD/DRY/KISS: add tests that cover the expected failures first, reuse shared fixtures (e.g., authenticated user context), and batch related assertions so a single coverage sweep can validate multiple paths.
- Run backend `python -m pytest --cov=app` (or equivalent) before wrapping up a change and keep the resulting `coverage.json`/`coverage.xml` near the build artifacts for auditing.
- Prefer minimal mocking, but if a dependency (DB, HTTP, translation provider) must be stubbed, use `AsyncMock`/`patch` and keep the assertions focused on business logic rather than external plumbing.
- When closing a planning phase, append the list of files modified plus the verification commands to the same `plan/` document so historical artifacts remain intact per the pipeline guidance.
