/**
 * Self-contained AI-vs-AI game: starts server, runs PicoClaw turns, logs results.
 * Usage: node play-full-game.js
 */
const { execSync } = require("child_process");
const path = require("path");
const http = require("http");

const TURN_SCRIPT = path.join(__dirname, "picoclaw-turn.js");
const PORT = process.env.ALS_PORT || 3000;
const DELAY_MS = 1500;
const MAX_TURNS = 200;
const MAX_ERRORS = 5;

let server;

async function main() {
  server = startServer();
  await sleep(1500);

  await httpPost("/api/action", { action: "new-game" });
  console.log("=== Air Land Sea: PicoClaw vs PicoClaw ===\n");

  let turnCount = 0;
  let currentPlayer = "p1";
  let consecutiveErrors = 0;

  while (turnCount < MAX_TURNS && consecutiveErrors < MAX_ERRORS) {
    turnCount++;
    console.log(`--- Turn ${turnCount} (${currentPlayer.toUpperCase()}) ---`);

    const result = runTurn(currentPlayer);
    console.log(result.trim());

    if (result.includes("GAME_OVER")) {
      await printFinalScore();
      break;
    }
    if (result.includes("NEXT_BATTLE")) {
      console.log("Starting next battle...\n");
      consecutiveErrors = 0;
      currentPlayer = "p1";
      await sleep(DELAY_MS);
      continue;
    }
    if (result.includes("NOT_MY_TURN")) {
      currentPlayer = swap(currentPlayer);
      continue;
    }
    if (isError(result)) {
      consecutiveErrors++;
      console.log(`Error (${consecutiveErrors}/${MAX_ERRORS}) — skipping ability...`);
      await httpPost("/api/action", { player: currentPlayer, action: "skip-ability" });
      await sleep(DELAY_MS);
      continue;
    }

    consecutiveErrors = 0;
    currentPlayer = swap(currentPlayer);
    await sleep(DELAY_MS);
  }

  if (consecutiveErrors >= MAX_ERRORS) {
    console.log("Too many consecutive errors, stopping.");
    await printFinalScore();
  }
  cleanup();
}

function startServer() {
  const { fork } = require("child_process");
  const serverPath = path.join(__dirname, "server.js");
  const child = fork(serverPath, { stdio: "pipe" });
  child.on("error", (err) => console.error("Server error:", err.message));
  console.log(`Server started (PID ${child.pid})`);
  return child;
}

function runTurn(player) {
  try {
    return execSync(`node "${TURN_SCRIPT}" ${player}`, {
      timeout: 130000, encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return "ERROR: " + ((e.stdout || "") + (e.stderr || "")).substring(0, 200);
  }
}

function isError(result) {
  return result.includes("ERROR") || result.includes("DOCTYPE") || result.includes('"error"');
}

function swap(p) { return p === "p1" ? "p2" : "p1"; }

async function printFinalScore() {
  const state = await httpGet(`/api/state?player=p1`);
  if (state) {
    console.log(`\nFinal: P1=${state.scores.p1} P2=${state.scores.p2} Phase=${state.phase}`);
  }
}

function httpGet(urlPath) {
  return new Promise((resolve) => {
    http.get(`http://localhost:${PORT}${urlPath}`, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

function httpPost(urlPath, body) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: "localhost", port: PORT, path: urlPath,
      method: "POST", headers: { "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on("error", () => resolve(null));
    req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function cleanup() {
  if (server) { server.kill(); console.log("Server stopped."); }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

main().catch((err) => { console.error(err); cleanup(); });
