#!/bin/bash
# Find semgrep executable path without requiring PATH update
# Usage: find-semgrep.sh path    → print path
#        find-semgrep.sh run ... → execute semgrep with args

set -e

find_semgrep_path() {
  local location
  location=$(pip show -f semgrep 2>/dev/null | grep "Location:" | cut -d' ' -f2)

  if [ -z "$location" ]; then
    echo ""
    return 1
  fi

  local scripts_dir="${location/site-packages/Scripts}"

  if [ -f "$scripts_dir/semgrep" ]; then
    echo "$scripts_dir/semgrep"
  elif [ -f "$scripts_dir/semgrep.exe" ]; then
    echo "$scripts_dir/semgrep.exe"
  else
    if command -v semgrep &>/dev/null; then
      command -v semgrep
    else
      echo ""
      return 1
    fi
  fi
}

SEMGREP_PATH=$(find_semgrep_path)
export SEMGREP_PATH
export SEMGREP="$SEMGREP_PATH"

if [ "$1" = "run" ]; then
  shift
  if [ -n "$SEMGREP_PATH" ]; then
    "$SEMGREP_PATH" "$@"
  else
    echo "ERROR: semgrep not found. Install with: pip install semgrep" >&2
    exit 1
  fi
elif [ "$1" = "path" ]; then
  if [ -n "$SEMGREP_PATH" ]; then
    echo "$SEMGREP_PATH"
  else
    echo "ERROR: semgrep not found" >&2
    exit 1
  fi
fi
