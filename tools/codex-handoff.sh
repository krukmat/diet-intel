#!/usr/bin/env bash
set -euo pipefail

TASK_FILE="docs/handoff/codex_task.md"
OUT_FILE="docs/handoff/codex_result.md"
STATE_DIR=".codex"
LOCK_FILE="$STATE_DIR/running.lock"
HASH_FILE="$STATE_DIR/last_task.sha"

DEFAULT_MINI="${CODEX_MODEL_MINI:-gpt-5.1-codex-mini}"
DEFAULT_MAX="${CODEX_MODEL_MAX:-gpt-5.1-codex-max}"

mkdir -p "$(dirname "$OUT_FILE")" "$STATE_DIR"

if [[ ! -f "$TASK_FILE" ]]; then
  echo "No task file found: $TASK_FILE"
  exit 0
fi

# Debounce: run only if task content changed
NEW_HASH="$(shasum -a 256 "$TASK_FILE" | awk '{print $1}')"
OLD_HASH=""
if [[ -f "$HASH_FILE" ]]; then OLD_HASH="$(cat "$HASH_FILE")"; fi
if [[ "$NEW_HASH" == "$OLD_HASH" ]]; then
  echo "Codex handoff unchanged; skipping."
  exit 0
fi

# Lock to avoid concurrent runs
if [[ -f "$LOCK_FILE" ]]; then
  echo "Codex runner already running; skipping."
  exit 0
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

echo "$NEW_HASH" > "$HASH_FILE"

# -------- Model selection (simple parsing) --------
# Read first matching CODEX_MODEL: line (if present)
MODEL_OVERRIDE="$(
  awk 'BEGIN{IGNORECASE=1}
       /^[[:space:]]*CODEX_MODEL[[:space:]]*:/{
         sub(/^[^:]*:[[:space:]]*/, "", $0);
         print $0; exit
       }' "$TASK_FILE" | tr -d '\r' | xargs || true
)"

# Read first matching PRIORITY: line (if present)
PRIORITY="$(
  awk 'BEGIN{IGNORECASE=1}
       /^[[:space:]]*PRIORITY[[:space:]]*:/{
         sub(/^[^:]*:[[:space:]]*/, "", $0);
         print toupper($0); exit
       }' "$TASK_FILE" | tr -d '\r' | xargs || true
)"

MODEL="$DEFAULT_MINI"
if [[ -n "${MODEL_OVERRIDE:-}" ]]; then
  MODEL="$MODEL_OVERRIDE"
else
  if [[ "${PRIORITY:-}" == "HIGH" ]]; then
    MODEL="$DEFAULT_MAX"
  fi
fi
# -------------------------------------------------

{
  echo "# Codex Result"
  echo
  echo "## Timestamp"
  date
  echo
  echo "## Selected model"
  echo "\`$MODEL\`"
  echo
  echo "## Priority"
  echo "\`${PRIORITY:-UNSPECIFIED}\`"
  echo
  echo "## Task file"
  echo "\`$TASK_FILE\`"
  echo
  echo "## Pre-run git status"
  echo '```'
  git status --porcelain || true
  echo '```'
  echo
  echo "## Codex output"
  echo '```'
} > "$OUT_FILE"

set +e
codex exec -m "$MODEL" "Follow the instructions in $TASK_FILE. Make minimal changes. Run the listed commands. Summarize changes and include test output." \
  >> "$OUT_FILE" 2>&1
CODEX_EXIT=$?
set -e

{
  echo '```'
  echo
  echo "## Post-run git diff (stat)"
  echo '```'
  git diff --stat || true
  echo '```'
  echo
  echo "## Post-run git status"
  echo '```'
  git status --porcelain || true
  echo '```'
  echo
  echo "## Codex exit code"
  echo "$CODEX_EXIT"
} >> "$OUT_FILE"

# Optional: repo verification hook (recommended)
if [[ -x "tools/verify.sh" ]]; then
  {
    echo
    echo "## Verification (tools/verify.sh)"
    echo '```'
  } >> "$OUT_FILE"
  set +e
  tools/verify.sh >> "$OUT_FILE" 2>&1
  set -e
  echo '```' >> "$OUT_FILE"
fi

exit "$CODEX_EXIT"
