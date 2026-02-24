/**
 * Calls PicoClaw agent to decide one move, then executes it via API.
 * PicoClaw only thinks — this script executes the action.
 * Usage: node picoclaw-turn.js p1|p2
 */
const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const NO_KEEPALIVE = new http.Agent({ keepAlive: false });
const PICOCLAW = process.env.PICOCLAW_BIN
  || path.join(__dirname, "..", "..", "data", "bin", "picoclaw.exe");
const PORT = process.env.ALS_PORT || 3000;
const PROMPT_FILE = path.join(__dirname, ".picoclaw-prompt.txt");
const player = process.argv[2] || "p2";

async function main() {
  const state = await httpGet(`/api/state?player=${player}`);
  if (!state) { console.error("Failed to get state"); process.exit(1); }

  if (state.phase === "END_GAME") {
    console.log("GAME_OVER"); process.exit(0);
  }
  if (state.phase === "END_BATTLE") {
    await httpPost("/api/action", { action: "next-battle" });
    console.log("NEXT_BATTLE"); process.exit(0);
  }
  if (state.currentPlayer !== player && !isPendingForMe(state)) {
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

function isPendingForMe(state) {
  return state.pendingAbility && state.pendingAbility.player === player;
}

function buildPrompt(state) {
  const hand = (state.myHand || []).map((c) =>
    `[idx=${c.index}] ${c.type.toUpperCase()} str=${c.strength} ability=${c.ability || "none"}`
  ).join("; ");

  const theaters = state.theaterOrder.map((t) => {
    const s = state.theaterStrengths[t];
    return `${t.toUpperCase()}(P1:${s.p1} P2:${s.p2} ctrl:${state.theaterControl[t]})`;
  }).join(", ");

  let task;
  if (isPendingForMe(state)) {
    const pa = state.pendingAbility;
    const tgts = (pa.targets || []).map((t, i) =>
      `target${i}: theater=${t.theater} cardIndex=${t.cardIndex} player=${t.player || "?"}`
    ).join("; ");
    task = `Resolve ${pa.ability}. Targets: ${tgts}.
Think about which target helps you most, then on your LAST line reply: TARGET=<number> or SKIP.`;
  } else {
    const cardsLeft = (state.myHand || []).length;
    task = `Your hand (${cardsLeft} cards): ${hand}. Withdraw cost: ${state.withdrawCost}VP.
Think step-by-step: which theaters can you win? Which card and placement helps most?
IMPORTANT: Do NOT withdraw early. You still have ${cardsLeft} cards — each card can swing a theater. Only withdraw if you have 2 or fewer cards left AND you are losing all 3 theaters with no way to flip them.
Then on your LAST line reply EXACTLY:
PLAY idx=<cardIndex> theater=<air|land|sea> faceup=<true|false>
or: WITHDRAW (only as last resort)
Face-up plays must match card type to theater (unless Aerodrome/Air Drop active).`;
  }

  return `You are ${player.toUpperCase()} in Air Land Sea.
Theaters: ${theaters}. First player: ${state.firstPlayer}. Scores: P1=${state.scores.p1} P2=${state.scores.p2}.
${task}`;
}

function runPicoClaw(prompt) {
  fs.writeFileSync(PROMPT_FILE, prompt);
  const bashCmd = `cat "${PROMPT_FILE.replace(/\\/g, "/")}"`;
  const cmd = `"${PICOCLAW}" agent -m "$(${bashCmd})"`;
  try {
    const out = execSync(cmd, {
      timeout: 120000, encoding: "utf8", shell: "bash",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out;
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

function parseAction(response, state) {
  const lines = response.split("\n");

  // Check for PLAY pattern
  for (const line of lines) {
    const playMatch = line.match(/PLAY\s+idx=(\d+)\s+theater=(\w+)\s+faceup=(true|false)/i);
    if (playMatch) {
      return {
        player, action: "play",
        cardIndex: parseInt(playMatch[1]),
        theater: playMatch[2].toLowerCase(),
        faceUp: playMatch[3].toLowerCase() === "true",
      };
    }
  }

  // Check for WITHDRAW
  if (lines.some((l) => /WITHDRAW/i.test(l))) {
    return { player, action: "withdraw" };
  }

  // Check for TARGET
  for (const line of lines) {
    const targetMatch = line.match(/TARGET=(\d+)/i);
    if (targetMatch && state.pendingAbility) {
      const idx = parseInt(targetMatch[1]);
      const targets = state.pendingAbility.targets || [];
      if (targets[idx]) return { player, action: "ability-target", target: targets[idx] };
    }
  }

  // Check for SKIP
  if (lines.some((l) => /SKIP/i.test(l))) {
    return { player, action: "skip-ability" };
  }

  // Fallback: try to find any card play intent in the text
  return parseFallback(response, state);
}

function parseFallback(response, state) {
  const lower = response.toLowerCase();
  const hand = state.myHand || [];
  if (hand.length === 0) return null;

  // Look for mentions of card types and theaters
  for (const card of hand) {
    if (lower.includes(card.type) && lower.includes("face-up")) {
      return {
        player, action: "play",
        cardIndex: card.index, theater: card.type, faceUp: true,
      };
    }
  }

  // Default: play first card face-down to first theater
  return {
    player, action: "play",
    cardIndex: hand[0].index,
    theater: state.theaterOrder[0],
    faceUp: false,
  };
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
