/**
 * Orchestrates a full AI-vs-AI game of Air Land Sea using PicoClaw.
 * Alternates picoclaw-turn.js calls for P1 and P2 until game ends.
 * Usage: node play-game.js
 */
const { execSync } = require("child_process");
const path = require("path");

const TURN_SCRIPT = path.join(__dirname, "picoclaw-turn.js");
const DELAY_MS = 1500;
const MAX_TURNS = 200;

async function main() {
  let turnCount = 0;
  let currentPlayer = "p1";

  console.log("=== Air Land Sea: PicoClaw vs PicoClaw ===\n");

  while (turnCount < MAX_TURNS) {
    turnCount++;
    console.log(`--- Turn ${turnCount} (${currentPlayer.toUpperCase()}) ---`);

    const result = runTurn(currentPlayer);
    console.log(result.trim());

    if (result.includes("GAME_OVER")) {
      console.log("\n=== Game Complete ===");
      break;
    }

    if (result.includes("NEXT_BATTLE")) {
      console.log("Starting next battle...\n");
      await sleep(DELAY_MS);
      currentPlayer = "p1";
      continue;
    }

    if (result.includes("NOT_MY_TURN")) {
      currentPlayer = currentPlayer === "p1" ? "p2" : "p1";
      continue;
    }

    if (result.includes("ERROR") || result.includes("DOCTYPE") || result.includes('"error"')) {
      console.log("Action failed — attempting skip-ability fallback...");
      await trySkipAbility(currentPlayer);
      await sleep(DELAY_MS);
      continue;
    }

    // Successful move — switch to other player
    currentPlayer = currentPlayer === "p1" ? "p2" : "p1";
    await sleep(DELAY_MS);
  }

  if (turnCount >= MAX_TURNS) {
    console.log("Max turns reached, stopping.");
  }
}

function runTurn(player) {
  try {
    return execSync(`node "${TURN_SCRIPT}" ${player}`, {
      timeout: 130000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    const output = (e.stdout || "") + (e.stderr || "");
    console.error("Turn error:", output.substring(0, 300));
    return "ERROR";
  }
}

async function trySkipAbility(player) {
  const http = require("http");
  const PORT = process.env.ALS_PORT || 3000;
  return new Promise((resolve) => {
    const body = JSON.stringify({ player, action: "skip-ability" });
    const req = http.request({
      hostname: "localhost", port: PORT, path: "/api/action",
      method: "POST", headers: { "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => { console.log("Skip result:", data.substring(0, 100)); resolve(); });
    });
    req.on("error", (err) => { console.error("Skip request failed:", err.message); resolve(); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
