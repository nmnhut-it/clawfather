/**
 * Fantasy Farm — PicoClaw turn orchestrator.
 * Builds a prompt from game state, calls PicoClaw CLI, parses the response.
 * Reuses the runPicoClaw pattern from skills/air-land-sea/picoclaw-turn.js.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { parseResponse } = require("./response-parser");
const { GAME_CONFIG, SEASON_ORDER } = require("./constants");

const PICOCLAW = process.env.PICOCLAW_BIN
  || path.join(__dirname, "..", "..", "data", "bin", "picoclaw.exe");
const PROMPT_FILE = path.join(__dirname, ".picoclaw-prompt.txt");
const SKILL_FILE = path.join(__dirname, "SKILL.md");

/** Execute PicoClaw CLI with a prompt string, return raw output */
function runPicoClaw(prompt) {
  fs.writeFileSync(PROMPT_FILE, prompt);
  const bashCmd = `cat "${PROMPT_FILE.replace(/\\/g, "/")}"`;
  const cmd = `"${PICOCLAW}" agent -s "${SKILL_FILE.replace(/\\/g, "/")}" -m "$(${bashCmd})"`;
  try {
    return execSync(cmd, {
      timeout: GAME_CONFIG.PICOCLAW_TIMEOUT_MS,
      encoding: "utf8",
      shell: "bash",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

/** Serialize game state into a compact text block for the prompt */
function serializeState(state) {
  const { time, farm, player, world } = state;
  const lines = [
    `Day ${time.day} of ${time.season}, Year ${time.year}`,
    "",
    "=== Resources ===",
    Object.entries(player.resources).map(([k, v]) => `${k}: ${v}`).join(", "),
    "",
    "=== Farm Plots ===",
    ...farm.plots.map((p, i) =>
      `Plot ${i}: ${p.stage === "empty" ? "empty" : `${p.crop} (${p.stage})`}`),
  ];

  if (farm.animals.length > 0) {
    lines.push("", "=== Animals ===", farm.animals.map((a) => a.name || a).join(", "));
  }

  lines.push(
    "", "=== Buildings ===",
    farm.buildings.map((b) => b.name).join(", "),
  );

  if (player.inventory.length > 0) {
    lines.push("", "=== Inventory ===", player.inventory.join(", "));
  }

  lines.push(
    "", "=== Skills ===",
    Object.entries(player.skills).map(([k, v]) => `${k}: ${v}`).join(", "),
  );

  if (world.activeQuests.length > 0) {
    lines.push("", "=== Active Quests ===");
    for (const q of world.activeQuests) {
      lines.push(`- [${q.id}] ${q.title}: ${q.description}`);
    }
  }

  if (Object.keys(world.relationships).length > 0) {
    lines.push("", "=== Relationships ===");
    for (const [npc, trust] of Object.entries(world.relationships)) {
      lines.push(`${npc}: ${trust}/100`);
    }
  }

  lines.push(
    "", "=== Discovered Locations ===",
    world.discoveredLocations.join(", "),
  );

  return lines.join("\n");
}

/** Format recent turn history for context */
function serializeHistory(history) {
  if (history.length === 0) return "No previous turns.";
  return history.map((h) =>
    `[Day ${h.day}, ${h.season}, Y${h.year}] Chose: "${h.choice}" → ${h.narrative.substring(0, 120)}...`
  ).join("\n");
}

/** Build the full prompt for a player choice turn */
function buildPrompt(state, choiceText) {
  const stateBlock = serializeState(state);
  const historyBlock = serializeHistory(state.narrative.turnHistory);

  return `=== CURRENT GAME STATE ===
${stateBlock}

=== RECENT HISTORY ===
${historyBlock}

=== PLAYER ACTION ===
The player chose: "${choiceText}"

Generate the narrative outcome and next choices. Follow the response format in your instructions exactly.`;
}

/** Build the opening narrative prompt (no prior choice) */
function buildOpeningPrompt(state) {
  const stateBlock = serializeState(state);

  return `=== CURRENT GAME STATE ===
${stateBlock}

=== GAME START ===
This is the very first turn. The player has just arrived at Hearthstone Farm. Generate a welcoming opening narrative that introduces the farm, the nearby village of Willowmere, and hints at the mysteries of Thornveil Forest. Then provide initial choices. Follow the response format in your instructions exactly.`;
}

/** Main entry: process a player's choice and return parsed result */
function processPlayerChoice(state, choiceText) {
  const prompt = buildPrompt(state, choiceText);
  const raw = runPicoClaw(prompt);
  console.log("[PicoClaw raw response length]", raw.length);
  return parseResponse(raw);
}

/** Generate the opening narrative for a new game */
function generateOpeningNarrative(state) {
  const prompt = buildOpeningPrompt(state);
  const raw = runPicoClaw(prompt);
  console.log("[PicoClaw opening response length]", raw.length);
  return parseResponse(raw);
}

module.exports = { processPlayerChoice, generateOpeningNarrative };
