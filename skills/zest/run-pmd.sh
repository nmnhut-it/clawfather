#!/bin/bash
# Runs PMD check or CPD analysis via the local tools/ installation
# Usage:
#   run-pmd.sh check <file_or_dir> [language]
#   run-pmd.sh cpd <directory> [language]

set -e

MODE="$1"
TARGET="$2"
LANGUAGE="${3:-java}"

if [ -z "$MODE" ] || [ -z "$TARGET" ]; then
  echo "Usage: run-pmd.sh <check|cpd> <file_or_dir> [language]"
  exit 1
fi

# Locate PMD binary
PMD_BIN=""
for dir in ./tools/pmd-bin-*/bin; do
  if [ -f "$dir/pmd" ]; then
    PMD_BIN="$dir/pmd"
    break
  elif [ -f "$dir/pmd.bat" ]; then
    PMD_BIN="$dir/pmd.bat"
    break
  fi
done

if [ -z "$PMD_BIN" ]; then
  echo "ERROR: PMD not found in ./tools/. Run: exec ./skills/zest/install-tools.sh" >&2
  exit 1
fi

case "$MODE" in
  check)
    "$PMD_BIN" check -d "$TARGET" -R "rulesets/${LANGUAGE}/quickstart.xml" -f json
    ;;
  cpd)
    "$PMD_BIN" cpd --minimum-tokens 50 -d "$TARGET" --language "$LANGUAGE"
    ;;
  *)
    echo "Error: mode must be 'check' or 'cpd'" >&2
    exit 1
    ;;
esac
