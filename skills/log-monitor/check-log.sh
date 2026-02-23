#!/bin/bash
# Reads a log file and outputs its content for LLM semantic analysis
#
# Usage:
#   check-log.sh <file>
#   check-log.sh <folder>   # reads all *.log files

set -euo pipefail

MAX_LINES=50
TARGET="${1:?Usage: check-log.sh <file-or-folder>}"

read_one_file() {
  local f="$1"
  local total; total=$(wc -l < "$f" | tr -d ' ')
  echo "FILE: $f"
  echo "LINES: $total"
  echo "---CONTENT---"
  tail -"$MAX_LINES" "$f"
  [ "$total" -gt "$MAX_LINES" ] && echo "... ($((total - MAX_LINES)) earlier lines omitted)"
  echo "---END---"
}

if [ -d "$TARGET" ]; then
  find "$TARGET" -name '*.log' -type f | sort | while read -r f; do
    read_one_file "$f"
    echo ""
  done
elif [ -f "$TARGET" ]; then
  read_one_file "$TARGET"
else
  echo "ERROR: Not found: $TARGET"
  exit 1
fi
