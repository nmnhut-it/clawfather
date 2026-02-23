#!/bin/bash
# Runs Semgrep security scan, auto-locating semgrep if not in PATH
# Usage: run-semgrep.sh <file_or_directory> [extra_args...]

set -e

TARGET="$1"
if [ -z "$TARGET" ]; then
  echo "Usage: run-semgrep.sh <file_or_directory> [extra_args...]"
  exit 1
fi
shift

# Find semgrep - try PATH first, then pip installation
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEMGREP=""

if command -v semgrep &>/dev/null; then
  SEMGREP="semgrep"
else
  # Use find-semgrep helper
  SEMGREP=$("$SCRIPT_DIR/find-semgrep.sh" path 2>/dev/null || true)
fi

if [ -z "$SEMGREP" ]; then
  echo "ERROR: semgrep not found. Install with: pip install semgrep" >&2
  echo "  Or run: exec ./skills/zest/install-tools.sh" >&2
  exit 1
fi

"$SEMGREP" --config "p/java" --config "p/owasp-top-ten" --json "$TARGET" "$@"
