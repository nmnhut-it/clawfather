#!/bin/bash
# Installs PMD and Semgrep for code analysis
# Usage: install-tools.sh

set -e

TOOLS_DIR="./tools"
PMD_VERSION="7.0.0"
PMD_DIR="$TOOLS_DIR/pmd-bin-$PMD_VERSION"

echo "=== Installing Code Analysis Tools ==="
mkdir -p "$TOOLS_DIR"

# 1. Semgrep
echo ""
echo "[1/2] Installing Semgrep..."
if command -v semgrep &>/dev/null; then
  echo "  Already installed: $(semgrep --version)"
else
  if command -v pip3 &>/dev/null; then
    pip3 install semgrep
  elif command -v pip &>/dev/null; then
    pip install semgrep
  else
    echo "  ERROR: pip not found. Install Python first." >&2
    exit 1
  fi
  echo "  Semgrep installed."
fi

# 2. PMD
echo ""
echo "[2/2] Installing PMD $PMD_VERSION..."
if [ -d "$PMD_DIR" ]; then
  echo "  Already installed at $PMD_DIR"
else
  PMD_URL="https://github.com/pmd/pmd/releases/download/pmd_releases%2F$PMD_VERSION/pmd-dist-$PMD_VERSION-bin.zip"
  echo "  Downloading..."
  curl -L -o "$TOOLS_DIR/pmd.zip" "$PMD_URL"
  echo "  Extracting..."
  unzip -q -o "$TOOLS_DIR/pmd.zip" -d "$TOOLS_DIR"
  rm "$TOOLS_DIR/pmd.zip"
  echo "  PMD installed at $PMD_DIR"
fi

echo ""
echo "=== Done ==="
echo "  Semgrep: $(semgrep --version 2>/dev/null || echo 'Not in PATH - use run-semgrep.sh')"
echo "  PMD: $PMD_DIR/bin/pmd"
