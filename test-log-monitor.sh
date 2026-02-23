#!/bin/bash
# Tests log-monitor skill with live PicoClaw gateway + Telegram
#
# Usage: ./test-log-monitor.sh [interval-minutes]
# Default interval: 1 minute (for quick testing)
#
# What it does:
#   1. Validates check-log.sh can read test.log
#   2. Scaffolds workspace (HEARTBEAT.md + AGENTS.md) for log monitoring
#   3. Enables heartbeat in PicoClaw config
#   4. Launches PicoClaw gateway — you'll receive Telegram messages
#
# Ctrl+C to stop. Original workspace files restored on exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_LOG="$SCRIPT_DIR/skills/log-monitor/check-log.sh"
SKILL_MD="$SCRIPT_DIR/skills/log-monitor/SKILL.md"
LOG_FILE="$SCRIPT_DIR/test.log"
INTERVAL="${1:-1}"

# ── Windows path conversion ──────────────────────────────────
# PicoClaw exec runs via PowerShell on Windows — needs native paths
to_native_path() {
  if command -v cygpath &>/dev/null; then
    cygpath -m "$1"  # D:/Gitlab/clawfather/test.log
  else
    echo "$1"
  fi
}

EXEC_LOG_FILE=$(to_native_path "$LOG_FILE")
EXEC_CHECK_LOG="./skills/log-monitor/check-log.sh"
# On Windows, use bash explicitly since PowerShell can't run .sh
IS_WINDOWS=false
case "$(uname -s)" in MINGW*|MSYS*) IS_WINDOWS=true ;; esac
if $IS_WINDOWS; then
  EXEC_CMD="bash $EXEC_CHECK_LOG $EXEC_LOG_FILE"
else
  EXEC_CMD="$EXEC_CHECK_LOG $EXEC_LOG_FILE"
fi

PICO_DIR="$HOME/.picoclaw"
WORKSPACE="$PICO_DIR/workspace"
PICO_CONFIG="$PICO_DIR/config.json"

HEARTBEAT_FILE="$WORKSPACE/HEARTBEAT.md"
AGENTS_FILE="$WORKSPACE/AGENTS.md"
BACKUP_DIR="$SCRIPT_DIR/data/.test-backup"

# ── Colors ───────────────────────────────────────────────────
R='\033[0m' B='\033[1m'
RED='\033[31m' GRN='\033[32m' YEL='\033[33m' CYN='\033[36m'

info()  { echo -e "${CYN}ℹ${R} $1"; }
ok()    { echo -e "${GRN}✅${R} $1"; }
fail()  { echo -e "${RED}❌${R} $1"; exit 1; }
warn()  { echo -e "${YEL}⚠${R}  $1"; }

# ── Resolve picoclaw ─────────────────────────────────────────
source "$SCRIPT_DIR/resolve-picoclaw.sh"

# ── Backup & restore ─────────────────────────────────────────
backup_workspace() {
  mkdir -p "$BACKUP_DIR"
  for f in HEARTBEAT.md AGENTS.md; do
    [[ -f "$WORKSPACE/$f" ]] && cp "$WORKSPACE/$f" "$BACKUP_DIR/$f"
  done
  if [[ -f "$PICO_CONFIG" ]] && command -v jq &>/dev/null; then
    jq '.heartbeat // {}' "$PICO_CONFIG" > "$BACKUP_DIR/heartbeat.json" 2>/dev/null || true
  fi
}

restore_workspace() {
  echo ""
  info "Restoring workspace..."
  for f in HEARTBEAT.md AGENTS.md; do
    if [[ -f "$BACKUP_DIR/$f" ]]; then
      cp "$BACKUP_DIR/$f" "$WORKSPACE/$f"
      ok "Restored $f"
    fi
  done
  if [[ -f "$BACKUP_DIR/heartbeat.json" && -s "$BACKUP_DIR/heartbeat.json" ]] \
     && command -v jq &>/dev/null; then
    local hb; hb=$(cat "$BACKUP_DIR/heartbeat.json")
    local tmp; tmp=$(mktemp)
    jq --argjson hb "$hb" '.heartbeat = $hb' "$PICO_CONFIG" > "$tmp" \
      && mv "$tmp" "$PICO_CONFIG"
    ok "Restored heartbeat config"
  fi
  rm -rf "$BACKUP_DIR"
}

trap restore_workspace EXIT

# ── Preflight checks ─────────────────────────────────────────
[[ -f "$LOG_FILE" ]]    || fail "test.log not found: $LOG_FILE"
[[ -f "$CHECK_LOG" ]]   || fail "check-log.sh not found: $CHECK_LOG"
[[ -f "$SKILL_MD" ]]    || fail "SKILL.md not found: $SKILL_MD"
[[ -f "$PICO_CONFIG" ]] || fail "PicoClaw config not found. Run clawfather.sh first."
command -v jq &>/dev/null || fail "jq required (install or run clawfather.sh)"

# ── Test 1: check-log.sh reads the file ──────────────────────
echo -e "\n${B}═══ Preflight: check-log.sh ═══${R}"

OUTPUT=$("$CHECK_LOG" "$LOG_FILE")
echo "$OUTPUT"
echo "$OUTPUT" | grep -q "LINES:" 2>/dev/null && ok "check-log.sh OK" \
  || fail "check-log.sh failed to read test.log"

# ── Scaffold workspace ────────────────────────────────────────
echo -e "\n${B}═══ Scaffolding test workspace ═══${R}"
backup_workspace

mkdir -p "$WORKSPACE/skills/log-monitor"
cp "$CHECK_LOG" "$WORKSPACE/skills/log-monitor/check-log.sh"
chmod +x "$WORKSPACE/skills/log-monitor/check-log.sh"
ok "Skill scripts copied"

# ── Write HEARTBEAT.md ────────────────────────────────────────
# Always report (even clean log), semantic analysis, not keyword grep
cat > "$HEARTBEAT_FILE" << HEARTBEAT_EOF
# Heartbeat Check List

Execute ALL tasks below. ALWAYS send a Telegram report — even when log is clean.

---

## Log Monitoring

1. Run: \`exec $EXEC_CMD\`
2. Analyze the output SEMANTICALLY — look at meaning, not just keywords:
   - Errors: exception, timeout, crash, OOM
   - Security: brute force attempts, injection, path traversal, unauthorized access
   - Anomaly: non-log content, unexpected language, suspicious patterns
   - Performance: slow queries, high memory, high latency
3. ALWAYS send the result using the \`message\` tool, with this format:

⚠️ **Log Alert** — {filename}

🔴 **Critical:** (serious issues found)
🟡 **Warning:** (notable concerns)
🔵 **Anomaly:** (unusual content that doesn't belong)

📊 **Summary:** {N} lines scanned

If everything is clean:
✅ **Log OK** — {filename} — {N} lines scanned, no issues
HEARTBEAT_EOF

ok "HEARTBEAT.md written (always-report mode)"

# ── Write AGENTS.md ───────────────────────────────────────────
SKILL_BODY=$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' "$SKILL_MD")

cat > "$AGENTS_FILE" << AGENTS_EOF
# Agent: Log Monitor (Test)

You are a log monitoring agent. Analyze application logs SEMANTICALLY and always report findings via Telegram.

## Behavior

- During heartbeat: run check-log.sh and analyze the raw output
- ALWAYS send a Telegram message — even when log looks clean
- Look beyond keywords: analyze patterns, sequences, and content meaning
- Be concise but thorough

## Skills

### 📋 log-monitor

$SKILL_BODY

---
AGENTS_EOF

ok "AGENTS.md written"

# ── Enable heartbeat in config ────────────────────────────────
TMP_CONFIG=$(mktemp)
jq --argjson interval "$INTERVAL" \
  '.heartbeat = { "enabled": true, "interval": $interval }' \
  "$PICO_CONFIG" > "$TMP_CONFIG" && mv "$TMP_CONFIG" "$PICO_CONFIG"

ok "Heartbeat: every ${INTERVAL} minute(s)"

# ── Launch gateway ────────────────────────────────────────────
echo ""
echo -e "${B}${GRN}════════════════════════════════════════════════════${R}"
echo -e "${B}${GRN}  📋 Log Monitor — Live Test${R}"
echo -e "${GRN}  Log file:  $LOG_FILE${R}"
echo -e "${GRN}  Heartbeat: every ${INTERVAL} minute(s)${R}"
echo -e "${GRN}  Telegram:  messages will be sent${R}"
echo -e "${GRN}  Ctrl+C to stop (workspace auto-restored)${R}"
echo -e "${B}${GRN}════════════════════════════════════════════════════${R}"
echo ""

export PICOCLAW_BIN="$PICOCLAW"
exec "$PICOCLAW" gateway
