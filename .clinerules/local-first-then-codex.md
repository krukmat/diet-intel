# Policy: Local-first (Ollama) then Codex (CLI)

## Purpose
Centralize the development workflow in Cline using a local model by default (Ollama). Escalate to Codex CLI only when the task exceeds safe/local limits. This policy enforces predictable cost, tight scope control, and repeatable handoffs.

---

## Default mode: Local-first
You MUST use the configured local model (Ollama via OpenAI-compatible endpoint) by default.

In local-first mode:
- Prefer small, incremental changes.
- Prefer minimal diffs; avoid refactors unless explicitly requested.
- If the change impacts more than 2 files, you MUST propose a plan before editing.
- When uncertain, ask for missing context or search the repo; do not guess.

---

## Scope discipline
You MUST:
- Implement only what is requested and/or agreed in the plan.
- Avoid “extra improvements” unless explicitly requested.
- Preserve existing behavior unless acceptance criteria require changes.
- Maintain consistent style, naming, and patterns in the codebase.

---

## Verification discipline (local-first)
Before claiming completion you MUST:
- Run the explicit commands listed in the task/request (tests/build/linters).
- If no commands are provided, propose a minimal verification set and ask approval before running.
- Report results (pass/fail) and include relevant excerpts of output.

---

## Stop & escalate to Codex (do NOT continue in Cline) if ANY applies
If ANY of the following is true, you MUST stop local implementation and create a Codex Handoff Packet instead:

1) Change is large:
   - More than 5 files will be touched, OR
   - Cross-module refactor, OR
   - Broad rename/migration across the repo.

2) High iteration expected:
   - Requires repeated test/build debugging, OR
   - Complex dependency issues, OR
   - Non-trivial environment/tooling troubleshooting.

3) Sensitive/high-risk areas:
   - Auth/security, permissions, data migrations, payments,
   - CI/CD pipelines, infra/terraform, secrets management.

4) Uncertainty / hallucination risk:
   - Local model is missing critical context, OR
   - The solution would require guessing external behavior, OR
   - The task requires extensive reasoning beyond the local model’s reliability.

---

## Codex Handoff Packet (required output when escalating)
When escalating, you MUST create or update:

- `docs/handoff/codex_task.md`

It MUST follow this structure:

# CODEX HANDOFF

PRIORITY: LOW|MEDIUM|HIGH
# Optional override:
# CODEX_MODEL: <model-id>

## Goal
(One paragraph.)

## Non-goals
- ...

## Proposed steps
1) ...
2) ...

## Files to change
- path/to/file1
- path/to/file2

## Commands to run
- Exact commands, no guessing.

## Acceptance criteria
- ...

## Rollback plan
- ...

### Priority rules
You MUST set:
- `PRIORITY: HIGH` when ANY escalation condition (1–4) is strongly present, especially:
  - >5 files, cross-module changes,
  - sensitive areas (security/data/CI),
  - repeated debugging expected.

If uncertain between MEDIUM and HIGH, choose HIGH.

### Model selection rules (informational)
The runner will select:
- Default: codex-mini
- If `PRIORITY: HIGH`: codex-max
- If `CODEX_MODEL:` is present: that override wins

---

## Coordination: waiting for Codex output
After writing `docs/handoff/codex_task.md`:

- If `PRIORITY: HIGH`, you MUST stop and instruct the user to run the Codex runner.
  - You MUST wait until `docs/handoff/codex_result.md` exists/has been updated.
  - Then you MUST read `docs/handoff/codex_result.md` and continue with:
    - review, cleanup, documentation, and next steps.

- If `PRIORITY: LOW` or `MEDIUM`, you SHOULD still prefer the same handoff workflow if the user requests it.

---

## Post-Codex responsibilities (back in Cline)
Once `docs/handoff/codex_result.md` is available, you MUST:
- Summarize what changed (files + intent).
- Validate the changes align with Goal/Non-goals and Acceptance Criteria.
- Identify any scope creep.
- Ensure tests/build are green per the recorded outputs.
- Propose follow-up tasks if needed (but do not implement unless requested).

---

## Output format expectations
When working locally (non-escalated), your output MUST include:
- Plan (if >2 files)
- List of files changed
- Commands executed + results
- Any remaining risks / open questions
