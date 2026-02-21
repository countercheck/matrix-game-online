#!/bin/bash
# PostToolUse hook: lint the saved file and run related tests.
# Exits non-zero to block the edit if lint or tests fail.

set -euo pipefail

# Read JSON input from stdin, extract file_path using Node (jq not always available)
INPUT=$(cat)
FILE_PATH=$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.tool_input?.file_path || '')" "$INPUT")

# Skip if no file path or file doesn't exist
if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

# Determine project root
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Get path relative to project root
REL_PATH="${FILE_PATH#"$PROJECT_DIR"/}"

# Only process TypeScript/JavaScript files
case "$REL_PATH" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

# Detect test files
IS_TEST=false
case "$REL_PATH" in
  *.test.*|*.spec.*) IS_TEST=true ;;
esac

# Determine which workspace (client or server)
WORKSPACE=""
WORKSPACE_DIR=""
case "$REL_PATH" in
  client/*)
    WORKSPACE="client"
    WORKSPACE_DIR="$PROJECT_DIR/client"
    ;;
  server/*)
    WORKSPACE="server"
    WORKSPACE_DIR="$PROJECT_DIR/server"
    ;;
  *)
    exit 0
    ;;
esac

ERRORS=""

# --- LINT (skip test files — they'll be run as tests) ---
if [[ "$IS_TEST" == "false" ]]; then
  echo "Linting $REL_PATH..."
  if ! (cd "$WORKSPACE_DIR" && npx eslint "$FILE_PATH" --max-warnings 0 2>&1); then
    ERRORS="${ERRORS}Lint failed for $REL_PATH\n"
  fi
fi

# --- FIND RELATED TESTS ---
echo "Finding tests related to $REL_PATH..."

BASENAME=$(basename "$FILE_PATH")
NAME_NO_EXT="${BASENAME%.*}"
# Strip .test/.spec suffix to get the source module name
SOURCE_NAME="${NAME_NO_EXT%.test}"
SOURCE_NAME="${SOURCE_NAME%.spec}"

TEST_FILES=()

if [[ "$IS_TEST" == "true" ]]; then
  # File itself is a test — run it
  TEST_FILES+=("$FILE_PATH")
else
  # Pattern 1: Colocated tests (e.g., Foo.test.tsx next to Foo.tsx)
  DIR=$(dirname "$FILE_PATH")
  for ext in ts tsx js jsx; do
    candidate="$DIR/$SOURCE_NAME.test.$ext"
    if [[ -f "$candidate" ]]; then
      TEST_FILES+=("$candidate")
    fi
  done

  # Pattern 2: Server mirror structure (src/services/foo.ts -> tests/unit/services/foo.test.ts)
  if [[ "$WORKSPACE" == "server" ]]; then
    MODULE_PATH="${REL_PATH#server/src/}"
    MODULE_DIR=$(dirname "$MODULE_PATH")
    for test_dir in "tests/unit" "tests/integration"; do
      for ext in ts tsx js jsx; do
        candidate="$WORKSPACE_DIR/$test_dir/$MODULE_DIR/$SOURCE_NAME.test.$ext"
        if [[ -f "$candidate" ]]; then
          TEST_FILES+=("$candidate")
        fi
      done
    done
  fi
fi

# Deduplicate
if [[ ${#TEST_FILES[@]} -gt 0 ]]; then
  UNIQUE_FILES=()
  while IFS= read -r line; do
    UNIQUE_FILES+=("$line")
  done < <(printf '%s\n' "${TEST_FILES[@]}" | sort -u)
  TEST_FILES=("${UNIQUE_FILES[@]}")
fi

# --- RUN TESTS ---
if [[ ${#TEST_FILES[@]} -gt 0 ]]; then
  TEST_ARGS=""
  for tf in "${TEST_FILES[@]}"; do
    echo "Running test: ${tf#"$PROJECT_DIR"/}"
    TEST_ARGS="$TEST_ARGS $tf"
  done

  if ! (cd "$WORKSPACE_DIR" && npx vitest run --reporter=verbose $TEST_ARGS 2>&1); then
    ERRORS="${ERRORS}Tests failed for related files\n"
  fi
else
  echo "No related tests found."
fi

# --- REPORT ---
if [[ -n "$ERRORS" ]]; then
  echo ""
  echo "========================================="
  echo "HOOK FAILED:"
  echo -e "$ERRORS"
  echo "========================================="
  exit 1
fi

echo "Lint and tests passed."
exit 0
