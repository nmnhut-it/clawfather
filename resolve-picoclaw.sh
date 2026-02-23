#!/bin/bash
# Resolves PicoClaw binary path and adds ./data/bin to PATH
# Source this script — it exports PICOCLAW and updates PATH
#
# Usage (from any script):
#   source "$(dirname "${BASH_SOURCE[0]}")/resolve-picoclaw.sh"
#   "$PICOCLAW" cron list
#
# Resolution order:
#   1. PICOCLAW_BIN env var (set by clawfather.sh / clawfather.js)
#   2. ./data/bin/picoclaw (managed install dir)
#   3. ~/.picoclaw/workspace/.picoclaw-bin (written by clawfather.js)
#   4. System PATH (picoclaw already installed globally)

set -euo pipefail

_RESOLVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_BIN_DIR="$_RESOLVE_DIR/data/bin"
_EXE="picoclaw"
[[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]] && _EXE="picoclaw.exe"

# Add managed bin dir to PATH (idempotent)
case ":$PATH:" in
  *":$_BIN_DIR:"*) ;;
  *) export PATH="$_BIN_DIR:$PATH" ;;
esac

# Resolve in priority order
if [[ -n "${PICOCLAW_BIN:-}" && -x "$PICOCLAW_BIN" ]]; then
  PICOCLAW="$PICOCLAW_BIN"

elif [[ -f "$_BIN_DIR/$_EXE" ]]; then
  PICOCLAW="$_BIN_DIR/$_EXE"

elif [[ -f "$HOME/.picoclaw/workspace/.picoclaw-bin" ]]; then
  PICOCLAW="$(cat "$HOME/.picoclaw/workspace/.picoclaw-bin")"
  [[ -x "$PICOCLAW" ]] || PICOCLAW=""

else
  PICOCLAW="$(command -v "$_EXE" 2>/dev/null || true)"
fi

if [[ -z "$PICOCLAW" ]]; then
  echo "ERROR: picoclaw not found. Run clawfather.sh to install." >&2
  exit 1
fi

export PICOCLAW
export PICOCLAW_BIN="$PICOCLAW"
