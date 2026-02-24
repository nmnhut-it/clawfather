#!/usr/bin/env bash
# Play one AI turn of Tic Tac Toe.
# Usage: ./play-turn.sh <p1|p2> [port]
# Calls picoclaw-turn.js which fetches state, invokes PicoClaw, executes action.

PLAYER="${1:-p1}"
PORT="${2:-3001}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GAME_DIR="$SCRIPT_DIR/../../vibe-games/tic-tac-toe"

export TTT_PORT="$PORT"
node "$GAME_DIR/picoclaw-turn.js" "$PLAYER"
