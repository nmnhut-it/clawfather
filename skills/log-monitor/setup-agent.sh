#!/bin/bash
# Sets up a complete log-monitor agent with heartbeat
# Template-based — no LLM needed. Just provide the log path.
#
# Usage:
#   setup-agent.sh <log-file-or-folder>
#   setup-agent.sh /var/log/myapp/app.log
#   setup-agent.sh /var/log/myapp/           # monitors all *.log
#
# What it does:
#   1. Validates the log path exists
#   2. Writes HEARTBEAT.md with the log check task
#   3. Enables heartbeat in PicoClaw config (interval configurable)
#   4. Writes AGENTS.md with monitor-only persona (no LLM design needed)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PICO_DIR="$HOME/.picoclaw"
WORKSPACE="$PICO_DIR/workspace"
PICO_CONFIG="$PICO_DIR/config.json"
SKILL_REL_PATH="./skills/log-monitor/check-log.sh"
DEFAULT_INTERVAL=15

# ── Colors (reuse clawfather.sh pattern) ─────────────────────
R='\033[0m' B='\033[1m' D='\033[2m'
RED='\033[31m' GRN='\033[32m' YEL='\033[33m' CYN='\033[36m'

info()  { echo -e "${CYN}ℹ${R} $1"; }
ok()    { echo -e "${GRN}✅${R} $1"; }
err()   { echo -e "${RED}❌${R} $1"; }
warn()  { echo -e "${YEL}⚠${R}  $1"; }

# ── Validate input ───────────────────────────────────────────

LOG_TARGET="${1:-}"
INTERVAL="${2:-$DEFAULT_INTERVAL}"

if [ -z "$LOG_TARGET" ]; then
  echo "Usage: setup-agent.sh <log-file-or-folder> [interval-minutes]"
  echo ""
  echo "Examples:"
  echo "  setup-agent.sh /var/log/myapp/app.log      # single file, 15min"
  echo "  setup-agent.sh /var/log/myapp/              # all *.log, 15min"
  echo "  setup-agent.sh /var/log/myapp/app.log 5     # single file, 5min"
  exit 1
fi

if [ ! -e "$LOG_TARGET" ]; then
  err "Path not found: $LOG_TARGET"
  exit 1
fi

if [ -d "$LOG_TARGET" ]; then
  LOG_COUNT=$(find "$LOG_TARGET" -name '*.log' -type f | wc -l | tr -d ' ')
  info "Folder mode: found $LOG_COUNT *.log file(s) in $LOG_TARGET"
  [ "$LOG_COUNT" -eq 0 ] && warn "No *.log files yet — agent will check when they appear"
else
  info "File mode: $LOG_TARGET"
fi

# ── Ensure workspace exists ──────────────────────────────────

mkdir -p "$WORKSPACE/skills/log-monitor" "$WORKSPACE/memory"

# ── Copy skill scripts to workspace ──────────────────────────

cp "$SCRIPT_DIR/check-log.sh" "$WORKSPACE/skills/log-monitor/check-log.sh"
cp "$SCRIPT_DIR/check-log.bat" "$WORKSPACE/skills/log-monitor/check-log.bat" 2>/dev/null || true
chmod +x "$WORKSPACE/skills/log-monitor/check-log.sh"
ok "Skill scripts copied"

# ── Write HEARTBEAT.md ───────────────────────────────────────

cat > "$WORKSPACE/HEARTBEAT.md" << HEARTBEAT_EOF
# Heartbeat Check List

Execute ALL tasks below. ALWAYS send a Telegram report — even when log is clean.

---

## Log Monitoring

1. Run: \`exec $SKILL_REL_PATH $LOG_TARGET\`
2. Analyze the output SEMANTICALLY — look at meaning, not just keywords:
   - Errors: exception, timeout, crash, OOM
   - Security: brute force attempts, injection, path traversal, unauthorized access
   - Anomaly: non-log content, unexpected language, suspicious patterns
   - Performance: slow queries, high memory, high latency
3. For large outputs (>20 errors), use spawn to analyze patterns
4. ALWAYS send the result using the \`message\` tool, with this format:

⚠️ **Log Alert** — {filename}

🔴 **Critical:** (serious issues found)
🟡 **Warning:** (notable concerns)
🔵 **Anomaly:** (unusual content that doesn't belong)

📊 **Summary:** {N} lines scanned

If everything is clean:
✅ **Log OK** — {filename} — {N} lines scanned, no issues
HEARTBEAT_EOF

ok "HEARTBEAT.md configured for: $LOG_TARGET"

# ── Write AGENTS.md (template, no LLM) ──────────────────────

SKILL_BODY=$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' "$SCRIPT_DIR/SKILL.md")

cat > "$WORKSPACE/AGENTS.md" << AGENTS_EOF
# Agent: Log Monitor

You are a log monitoring agent. Analyze application logs SEMANTICALLY and always report findings via Telegram.

## Behavior

- During heartbeat: run check-log.sh and analyze the raw output
- ALWAYS send a Telegram message — even when log looks clean
- Look beyond keywords: analyze patterns, sequences, and content meaning
- Group similar issues together instead of listing duplicates
- Include file name and line counts in every report
- Be concise but thorough

## Skills

### 📋 log-monitor

$SKILL_BODY

---
AGENTS_EOF

ok "AGENTS.md configured"

# ── Update PicoClaw config heartbeat ─────────────────────────

if [ -f "$PICO_CONFIG" ] && command -v jq &>/dev/null; then
  # Merge heartbeat settings into existing config
  local_tmp=$(mktemp)
  jq --argjson interval "$INTERVAL" \
    '.heartbeat = { enabled: true, interval: $interval }' \
    "$PICO_CONFIG" > "$local_tmp" && mv "$local_tmp" "$PICO_CONFIG"
  ok "Heartbeat enabled: every ${INTERVAL} minutes"
elif [ -f "$PICO_CONFIG" ]; then
  warn "jq not found — add heartbeat manually to $PICO_CONFIG:"
  echo '  "heartbeat": { "enabled": true, "interval": '"$INTERVAL"' }'
else
  warn "PicoClaw config not found at $PICO_CONFIG"
  warn "Run clawfather.sh first to set up Telegram + LLM, then re-run this script"
fi

# ── Scaffold conditional files ───────────────────────────────

[ -f "$WORKSPACE/IDENTITY.md" ] || cat > "$WORKSPACE/IDENTITY.md" << 'EOF'
# Identity

## Name
Log Monitor Agent

## Description
Monitors application logs and alerts on errors and warnings
EOF

[ -f "$WORKSPACE/SOUL.md" ] || cat > "$WORKSPACE/SOUL.md" << 'EOF'
# Soul

## Personality
- Alert and vigilant
- Concise — only report what matters
- No false alarms — skip noise

## Values
- Signal over noise
- Fast alerts for critical errors
- Grouped summaries over raw dumps
EOF

[ -f "$WORKSPACE/memory/MEMORY.md" ] || echo "# Memory" > "$WORKSPACE/memory/MEMORY.md"

# ── Done ─────────────────────────────────────────────────────

echo ""
echo -e "${B}${GRN}════════════════════════════════════════════════════${R}"
echo -e "${B}${GRN}  📋 Log Monitor Agent Ready${R}"
echo -e "${GRN}  Target:    $LOG_TARGET${R}"
echo -e "${GRN}  Interval:  every ${INTERVAL} minutes${R}"
echo -e "${GRN}  Workspace: $WORKSPACE${R}"
echo -e "${B}${GRN}════════════════════════════════════════════════════${R}"
echo ""
echo -e "Next steps:"
echo -e "  1. Run ${CYN}clawfather.sh${R} (or ${CYN}node clawfather.js${R}) to set up Telegram + LLM"
echo -e "  2. Or launch directly: ${CYN}picoclaw gateway${R}"
echo -e "  3. Test manually: ${CYN}$SKILL_REL_PATH $LOG_TARGET${R}"
