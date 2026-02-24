/**
 * Calls PicoClaw agent to decide one Tic Tac Toe move, then executes it via API.
 * PicoClaw only thinks - this script executes the action.
 * Usage: node picoclaw-turn.js p1|p2
 */
const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  MARKERS, GAME_PHASES, MOVE_PATTERN, PLAYERS, DEFAULT_PORT, PORT_ENV_KEY,
  WIN_LINES, BOARD_SIZE,
} = require("./constants");

const NO_KEEPALIVE = new http.Agent({ keepAlive: false });
const PICOCLAW = process.env.PICOCLAW_BIN
  || path.join(__dirname, "..", "..", "data", "bin", "picoclaw.exe");
const PORT = process.env[PORT_ENV_KEY] || DEFAULT_PORT;
const PROMPT_FILE = path.join(__dirname, ".picoclaw-prompt.txt");
const PICOCLAW_TIMEOUT_MS = 120000;
const player = process.argv[2] || PLAYERS.P2;

async function main() {
  const state = await httpGet(`/api/state?player=${player}`);
  if (!state) { console.error("Failed to get state"); process.exit(1); }

  if (state.phase === GAME_PHASES.END_GAME) {
    console.log("GAME_OVER"); process.exit(0);
  }
  if (state.currentPlayer !== player) {
    console.log("NOT_MY_TURN"); process.exit(0);
  }

  const prompt = buildPrompt(state);
  const response = runPicoClaw(prompt);

  console.log(`\n[${player.toUpperCase()} thinking]`);
  console.log(response.trim());
  console.log();

  const action = parseAction(response, state);
  if (!action) {
    console.error("Could not parse action from PicoClaw response.");
    process.exit(1);
  }

  console.log(`[${player.toUpperCase()} action]`, JSON.stringify(action));
  const result = await httpPost("/api/action", action);
  console.log("Result:", JSON.stringify(result).substring(0, 200));
}

/** Build a prompt with board analysis so PicoClaw reasons about threats. */
function buildPrompt(state) {
  const boardStr = formatBoard(state);
  const marker = state.myMarker;
  const opponentMarker = state.opponentMarker;
  const analysis = analyzeThreats(state);

  return `You are ${player.toUpperCase()} (${marker}) in Tic Tac Toe.
Board (. = empty):
${boardStr}

Move ${state.moveCount} of 9. You are ${marker}, opponent is ${opponentMarker}.

${analysis}

Think step-by-step using this priority:
1. WIN: Can you complete 3 in a row? If yes, play there immediately.
2. BLOCK: Does opponent have 2 in a line with the third empty? Block it NOW.
3. FORK: Can you create two winning threats at once? Do it.
4. CENTER: If row=1 col=1 is empty, take it.
5. OPPOSITE CORNER: If opponent holds a corner, take the opposite corner.
6. ANY CORNER: Take any empty corner (0,0), (0,2), (2,0), (2,2).
7. ANY EDGE: Take any empty edge.

IMPORTANT: Always check for blocks BEFORE making offensive moves!

On your LAST line reply EXACTLY:
MOVE row=<0|1|2> col=<0|1|2>`;
}

/** Scan all win lines and report immediate threats (wins, blocks, forks). */
function analyzeThreats(state) {
  const me = player;
  const opp = me === PLAYERS.P1 ? PLAYERS.P2 : PLAYERS.P1;
  const myWins = [];
  const oppThreats = [];
  const myOpens = [];

  for (const line of WIN_LINES) {
    const cells = line.map(([r, c]) => state.board[r][c]);
    const myCount = cells.filter((c) => c === me).length;
    const oppCount = cells.filter((c) => c === opp).length;
    const emptyIdx = cells.indexOf(null);
    const emptyCells = line.filter(([r, c]) => state.board[r][c] === null);

    if (myCount === 2 && oppCount === 0 && emptyIdx !== -1) {
      const [r, c] = line[emptyIdx];
      myWins.push(`WIN at (${r},${c}) — line ${formatLine(line)}`);
    }
    if (oppCount === 2 && myCount === 0 && emptyIdx !== -1) {
      const [r, c] = line[emptyIdx];
      oppThreats.push(`BLOCK at (${r},${c}) — opponent line ${formatLine(line)}`);
    }
    if (myCount === 1 && oppCount === 0 && emptyCells.length === 2) {
      myOpens.push(`Open line ${formatLine(line)}`);
    }
  }

  const parts = [];
  if (myWins.length > 0) parts.push(`WINNING MOVES: ${myWins.join("; ")}`);
  if (oppThreats.length > 0) parts.push(`MUST BLOCK: ${oppThreats.join("; ")}`);
  if (myOpens.length > 0) parts.push(`Open lines: ${myOpens.join("; ")}`);
  if (parts.length === 0) parts.push("No immediate threats detected.");

  return parts.join("\n");
}

function formatLine(line) {
  return line.map(([r, c]) => `(${r},${c})`).join("-");
}

/** Format board as a 3x3 text grid with row/col labels. */
function formatBoard(state) {
  const EMPTY_CELL = ".";
  const header = "  0 1 2";
  const rows = state.board.map((row, r) => {
    const cells = row.map((cell) => {
      if (!cell) return EMPTY_CELL;
      return MARKERS[cell];
    }).join(" ");
    return `${r} ${cells}`;
  });
  return [header, ...rows].join("\n");
}

function runPicoClaw(prompt) {
  fs.writeFileSync(PROMPT_FILE, prompt);
  const bashCmd = `cat "${PROMPT_FILE.replace(/\\/g, "/")}"`;
  const cmd = `"${PICOCLAW}" agent -m "$(${bashCmd})"`;
  try {
    return execSync(cmd, {
      timeout: PICOCLAW_TIMEOUT_MS, encoding: "utf8", shell: "bash",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

/** Parse PicoClaw response for MOVE command; fallback to first empty cell. */
function parseAction(response, state) {
  const lines = response.split("\n");
  for (const line of lines) {
    const match = line.match(MOVE_PATTERN);
    if (match) {
      return {
        player,
        action: "move",
        row: parseInt(match[1]),
        col: parseInt(match[2]),
      };
    }
  }
  return findFallbackMove(state);
}

/** Fallback: pick first empty cell on the board. */
function findFallbackMove(state) {
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      if (state.board[r][c] === null) {
        return { player, action: "move", row: r, col: c };
      }
    }
  }
  return null;
}

function httpGet(urlPath) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}${urlPath}`, { agent: NO_KEEPALIVE }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

function httpPost(urlPath, body) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: "127.0.0.1", port: PORT, path: urlPath,
      method: "POST", headers: { "Content-Type": "application/json" },
      agent: NO_KEEPALIVE,
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on("error", (err) => { console.error("POST error:", err.message); resolve(null); });
    req.write(JSON.stringify(body));
    req.end();
  });
}

main().catch(console.error);
