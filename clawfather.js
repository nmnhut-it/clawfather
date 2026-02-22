#!/usr/bin/env node
// ============================================================
//  🦞 ClawFather — CLI Setup Wizard + PicoClaw Gateway
// ============================================================
//  Chạy:  node clawfather.js
//
//  Wizard trên terminal:
//   0. Check/install PicoClaw binary
//   1. Telegram Bot Token
//   2. OpenAI-compatible endpoint + key + model
//   3. Mô tả bot muốn tạo → AI tự build prompt & pipeline
//   4. Review → Generate PicoClaw config → Launch gateway
// ============================================================

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const { spawn, execSync } = require("child_process");
require("dotenv").config();
const OpenAI = require("openai");
const { Parser } = require("htmlparser2");
// const { Bot } = require("grammy"); // Reserved for future context capture

// ── ANSI Colors ─────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
};

const log = {
  info: (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`),
  ok: (m) => console.log(`${c.green}✅${c.reset} ${m}`),
  err: (m) => console.log(`${c.red}❌${c.reset} ${m}`),
  warn: (m) => console.log(`${c.yellow}⚠${c.reset} ${m}`),
  step: (n, t, m) => console.log(`\n${c.bold}${c.blue}[${n}/${t}]${c.reset} ${c.bold}${m}${c.reset}`),
  dim: (m) => console.log(`${c.dim}  ${m}${c.reset}`),
  bot: (m) => console.log(`${c.green}🦞${c.reset} ${m}`),
};

function banner() {
  console.log(`
${c.bold}${c.magenta}   ██████╗██╗      █████╗ ██╗    ██╗
  ██╔════╝██║     ██╔══██╗██║    ██║
  ██║     ██║     ███████║██║ █╗ ██║
  ██║     ██║     ██╔══██║██║███╗██║
  ╚██████╗███████╗██║  ██║╚███╔███╔╝
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
  ${c.cyan}F A T H E R${c.reset}  ${c.dim}v1.0 — The Bot That Builds Bots${c.reset}
`);
}

// ── Persistence ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Multi-bot storage ───────────────────────────────────
const BOTS_DIR = path.join(DATA_DIR, "bots");
const PICOCLAW_WORKSPACES_DIR = path.join(os.homedir(), ".picoclaw", "workspaces");

// ── PicoClaw ────────────────────────────────────────────
const PICOCLAW_BIN_DIR = path.join(DATA_DIR, "bin");
const PICOCLAW_RELEASES_URL = "https://api.github.com/repos/sipeed/picoclaw/releases/latest";

/** Maps `${platform}-${arch}` to GitHub release asset name */
const PICOCLAW_ASSETS = {
  "win32-x64": "picoclaw_Windows_x86_64.zip",
  "win32-arm64": "picoclaw_Windows_arm64.zip",
  "darwin-arm64": "picoclaw_Darwin_arm64.tar.gz",
  "darwin-x64": "picoclaw_Darwin_x86_64.tar.gz",
  "linux-x64": "picoclaw_Linux_x86_64.tar.gz",
  "linux-arm64": "picoclaw_Linux_arm64.tar.gz",
};

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")); } catch { return null; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ── Multi-bot storage ───────────────────────────────────────

/** Converts bot name to filesystem-safe slug ID */
function slugify(name) {
  const base = name.toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  if (!fs.existsSync(BOTS_DIR)) return base;
  if (!fs.existsSync(path.join(BOTS_DIR, `${base}.json`))) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!fs.existsSync(path.join(BOTS_DIR, `${candidate}.json`))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Reads all bot profiles from data/bots/ */
function loadAllBots() {
  if (!fs.existsSync(BOTS_DIR)) return [];
  return fs.readdirSync(BOTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(BOTS_DIR, f), "utf-8")); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

/** Reads a single bot profile by ID */
function loadBot(botId) {
  const filePath = path.join(BOTS_DIR, `${botId}.json`);
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); }
  catch { return null; }
}

/** Writes a bot profile to data/bots/{id}.json */
function saveBot(profile) {
  if (!fs.existsSync(BOTS_DIR)) fs.mkdirSync(BOTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(BOTS_DIR, `${profile.id}.json`),
    JSON.stringify(profile, null, 2),
  );
}

/** Removes bot profile JSON and optionally its workspace */
async function deleteBot(botId) {
  const filePath = path.join(BOTS_DIR, `${botId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const workDir = path.join(PICOCLAW_WORKSPACES_DIR, botId);
  if (fs.existsSync(workDir)) {
    if (await confirm(`Xóa workspace "${botId}"?`, false)) {
      fs.rmSync(workDir, { recursive: true, force: true });
      log.ok(`Đã xóa workspace: ${workDir}`);
    }
  }
}

/** Displays numbered list of bots, returns the selected profile */
async function chooseBotFromList(bots, prompt) {
  const labels = bots.map(
    (b) => `${b.bot.name} ${c.dim}(${b.llm.model})${c.reset}`,
  );
  const idx = await choose(prompt, labels);
  return bots[idx];
}

// ── Readline helpers ────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q, def = "") {
  const hint = def ? ` ${c.dim}(${def})${c.reset}` : "";
  return new Promise((r) => rl.question(`  ${c.yellow}?${c.reset} ${q}${hint}: `, (a) => r(a.trim() || def)));
}

async function confirm(q, defYes = true) {
  const a = await ask(`${q} [${defYes ? "Y/n" : "y/N"}]`);
  return a ? a.toLowerCase().startsWith("y") : defYes;
}

async function choose(q, opts) {
  console.log(`\n  ${c.yellow}?${c.reset} ${q}`);
  opts.forEach((o, i) => console.log(`    ${c.cyan}${i + 1})${c.reset} ${o}`));
  while (true) {
    const a = await ask(`Chọn (1-${opts.length})`);
    const n = parseInt(a);
    if (n >= 1 && n <= opts.length) return n - 1;
    log.warn("Số không hợp lệ.");
  }
}

// ── Spinner ─────────────────────────────────────────────────
function spinner(text) {
  const f = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan}${f[i++ % f.length]}${c.reset} ${text}`);
  }, 80);
  return {
    stop: (msg) => {
      clearInterval(id);
      process.stdout.write(`\r${" ".repeat(text.length + 10)}\r`);
      if (msg) console.log(`  ${msg}`);
    },
  };
}

// ── HTTPS helpers ───────────────────────────────────────

/** Follows redirects and invokes callback(err, response) */
function httpsFollow(url, cb) {
  https.get(url, { headers: { "User-Agent": "ClawFather/1.0" } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return httpsFollow(res.headers.location, cb);
    }
    cb(null, res);
  }).on("error", cb);
}

/** GET JSON from a URL, following redirects */
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    httpsFollow(url, (err, res) => {
      if (err) return reject(err);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
  });
}

/** Download a URL to a local file, following redirects */
function httpsDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    httpsFollow(url, (err, res) => {
      if (err) return reject(err);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", (e) => { fs.unlink(destPath, () => {}); reject(e); });
    });
  });
}

// ── PicoClaw binary management ──────────────────────────

/** Returns the platform-specific asset name for PicoClaw releases */
function getPicoClawAssetName() {
  const key = `${process.platform}-${process.arch}`;
  const asset = PICOCLAW_ASSETS[key];
  if (!asset) throw new Error(`Nền tảng không được hỗ trợ: ${key}`);
  return asset;
}

/** Returns `picoclaw` or `picoclaw.exe` depending on OS */
function getPicoClawExeName() {
  return process.platform === "win32" ? "picoclaw.exe" : "picoclaw";
}

/** Searches for PicoClaw binary in managed dir and system PATH */
function findPicoClaw() {
  const exeName = getPicoClawExeName();
  const managedPath = path.join(PICOCLAW_BIN_DIR, exeName);
  if (fs.existsSync(managedPath)) return managedPath;

  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = execSync(`${cmd} ${exeName}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const found = result.trim().split(/\r?\n/)[0].trim();
    if (found && fs.existsSync(found)) return found;
  } catch { /* not in PATH */ }

  return null;
}

/** Fetches latest PicoClaw release info from GitHub */
async function fetchPicoClawRelease() {
  const release = await httpsGetJson(PICOCLAW_RELEASES_URL);
  const assetName = getPicoClawAssetName();
  const asset = release.assets?.find((a) => a.name === assetName);
  if (!asset) throw new Error(`Asset "${assetName}" not found in ${release.tag_name}`);
  return { tag: release.tag_name, downloadUrl: asset.browser_download_url, assetName };
}

/** Downloads and extracts PicoClaw to the managed bin directory */
async function installPicoClaw() {
  if (!fs.existsSync(PICOCLAW_BIN_DIR)) {
    fs.mkdirSync(PICOCLAW_BIN_DIR, { recursive: true });
  }

  const s1 = spinner("Tìm phiên bản PicoClaw mới nhất...");
  let release;
  try { release = await fetchPicoClawRelease(); }
  catch (e) { s1.stop(); throw e; }
  s1.stop(`${c.green}✓${c.reset} PicoClaw ${release.tag}`);

  const archivePath = path.join(PICOCLAW_BIN_DIR, release.assetName);
  const s2 = spinner(`Tải ${release.assetName}...`);
  try { await httpsDownload(release.downloadUrl, archivePath); }
  catch (e) { s2.stop(); throw e; }
  s2.stop(`${c.green}✓${c.reset} Tải xong`);

  const s3 = spinner("Giải nén...");
  try {
    const tarFlag = archivePath.endsWith(".zip") ? "-xf" : "-xzf";
    execSync(`tar ${tarFlag} "${archivePath}" -C "${PICOCLAW_BIN_DIR}"`, { stdio: "ignore" });
  } catch (e) { s3.stop(); throw new Error(`Giải nén thất bại: ${e.message}`); }
  s3.stop(`${c.green}✓${c.reset} Giải nén xong`);

  try { fs.unlinkSync(archivePath); } catch { /* ignore cleanup errors */ }
  const binPath = path.join(PICOCLAW_BIN_DIR, getPicoClawExeName());
  if (process.platform !== "win32") {
    try { fs.chmodSync(binPath, 0o755); } catch { /* ignore */ }
  }
  if (!fs.existsSync(binPath)) throw new Error(`Binary không tìm thấy: ${binPath}`);
  return binPath;
}

/** Ensures PicoClaw is available — finds existing or installs new */
async function ensurePicoClaw() {
  log.info("Kiểm tra PicoClaw...");
  const existing = findPicoClaw();
  if (existing) {
    log.ok(`PicoClaw: ${existing}`);
    return existing;
  }

  log.warn("PicoClaw chưa được cài đặt.");
  if (!await confirm("Cài đặt PicoClaw?")) return null;

  try {
    const binPath = await installPicoClaw();
    log.ok(`PicoClaw đã cài: ${binPath}`);
    return binPath;
  } catch (e) {
    log.err(`Cài đặt thất bại: ${e.message}`);
    return null;
  }
}

// ── PicoClaw config generation ──────────────────────────

/** Builds the PicoClaw config object from bot profile (cfg must include .id) */
function buildPicoClawConfig(cfg) {
  const workspace = cfg.id
    ? `~/.picoclaw/workspaces/${cfg.id}`
    : "~/.picoclaw/workspace";
  return {
    agents: {
      defaults: {
        workspace,
        restrict_to_workspace: false,
        provider: "openai",
        model: cfg.llm.model,
        max_tokens: cfg.bot.pipeline?.max_tokens || 8192,
        temperature: cfg.bot.pipeline?.temperature ?? 0.7,
        max_tool_iterations: 20,
      },
    },
    channels: {
      telegram: {
        enabled: true,
        token: cfg.telegram.token,
        proxy: "",
        allow_from: [],
      },
    },
    providers: {
      openai: {
        api_key: cfg.llm.apiKey || "",
        // Route through LLM proxy to parse text-based tool calls
        api_base: `http://${LLM_PROXY_HOST}:${LLM_PROXY_PORT}/v1`,
      },
    },
  };
}

/** Writes ~/.picoclaw/config.json, workspace AGENTS.md, and skills */
function writePicoClawConfig(cfg) {
  const picoDir = path.join(os.homedir(), ".picoclaw");
  const workDir = cfg.id
    ? path.join(PICOCLAW_WORKSPACES_DIR, cfg.id)
    : path.join(picoDir, "workspace");
  fs.mkdirSync(workDir, { recursive: true });

  const configPath = path.join(picoDir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(buildPicoClawConfig(cfg), null, 2));

  const skills = cfg.bot.skills || discoverSkills().map((s) => s.name);
  fs.writeFileSync(path.join(workDir, "AGENTS.md"), buildAgentsMd(cfg.bot, workDir, skills));
  writePersonalAssistantSkills(workDir, skills);
  return configPath;
}

/** Removes PicoClaw config and workspace. If botId given, removes only that workspace. */
async function removePicoClawConfig(botId) {
  const picoDir = path.join(os.homedir(), ".picoclaw");
  let removed = false;

  if (!botId) {
    const configPath = path.join(picoDir, "config.json");
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      log.ok(`Đã xóa: ${configPath}`);
      removed = true;
    }
  }

  const workDir = botId
    ? path.join(PICOCLAW_WORKSPACES_DIR, botId)
    : path.join(picoDir, "workspace");

  if (fs.existsSync(workDir)) {
    fs.rmSync(workDir, { recursive: true, force: true });
    log.ok(`Đã xóa: ${workDir}`);
    removed = true;
  }

  if (!removed) log.info("Không có gì để xóa.");
  return removed;
}

/** Builds AGENTS.md content from bot design data and selected skills */
function buildAgentsMd(bot, workDir, selectedSkills) {
  const lines = [`# Agent: ${bot.name}`, ""];
  lines.push(bot.system_prompt || "");
  if (bot.features?.length) {
    lines.push("", "## Capabilities");
    bot.features.forEach((f) => lines.push(`- ${f}`));
  }

  // Dynamic skills section from selected skills
  if (selectedSkills?.length) {
    lines.push("", "## Personal Assistant Skills", "");
    for (const skillName of selectedSkills) {
      const meta = parseSkillMeta(skillName);
      if (!meta) continue;
      const heading = meta.emoji ? `### ${meta.emoji} ${meta.name}` : `### ${meta.name}`;
      lines.push(heading, meta.description, "");
    }
  }

  // Boss-advisor specific sections
  const hasBossAdvisor = selectedSkills?.includes("boss-advisor");
  if (hasBossAdvisor) {
    const bossFile = path.join(workDir, "boss-profile.json");
    const learningFile = path.join(workDir, "learning-log.json");
    lines.push(
      "## Data Files",
      `- Boss profiles: \`${bossFile}\``,
      `- Learning log: \`${learningFile}\``,
      "",
      "## Self-Learning",
      "Bot tự học từ feedback của user:",
      "- User nói 'sếp khen', 'hay đấy' -> Ghi nhận thành công",
      "- User nói 'sếp không hài lòng', 'fail' -> Học để tránh lặp lại",
      "- Sau mỗi tư vấn, hỏi kết quả để cải thiện",
      "- Phân tích pattern: sếp nào thích framework gì, thời điểm nào tốt",
    );
  }

  return lines.join("\n") + "\n";
}

// ── Personal Assistant Skills ────────────────────────────────
// Skills are stored in clawfather/skills/ and copied to workspace
// Uses MD5 hash to detect changes and only update when needed

const SKILLS_SRC_DIR = path.join(__dirname, "skills");
const SKILLS_HASH_FILE = "skills-hash.json";

/** Calculates MD5 hash of file content */
function fileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(content).digest("hex");
}

/** Parses YAML-like front-matter from a SKILL.md file. Returns { name, description, emoji } */
function parseSkillMeta(skillName) {
  const skillFile = path.join(SKILLS_SRC_DIR, skillName, "SKILL.md");
  if (!fs.existsSync(skillFile)) return null;
  const content = fs.readFileSync(skillFile, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { name: skillName, description: "", emoji: "" };

  const fm = fmMatch[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() || skillName;
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() || "";
  let emoji = "";
  const metaMatch = fm.match(/^metadata:\s*(.+)$/m)?.[1]?.trim();
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch);
      emoji = meta?.nanobot?.emoji || "";
    } catch { /* ignore */ }
  }
  return { name, description, emoji };
}

/** Auto-discovers all skills from skills/ directory. Returns [{ name, description, emoji }] */
function discoverSkills() {
  if (!fs.existsSync(SKILLS_SRC_DIR)) return [];
  return fs.readdirSync(SKILLS_SRC_DIR)
    .filter((d) => {
      const skillFile = path.join(SKILLS_SRC_DIR, d, "SKILL.md");
      return fs.existsSync(skillFile);
    })
    .map((d) => parseSkillMeta(d))
    .filter(Boolean);
}

/**
 * Copies skill files to workspace/skills/ for selected skills only.
 * Copies all files in each skill dir (SKILL.md, .sh, .bat, etc.).
 * Hash-checks to avoid redundant writes. Cleans up deselected skills.
 */
function writePersonalAssistantSkills(workspaceDir, selectedSkills) {
  const skillsDestDir = path.join(workspaceDir, "skills");
  const hashFilePath = path.join(workspaceDir, SKILLS_HASH_FILE);

  let storedHashes = {};
  if (fs.existsSync(hashFilePath)) {
    try {
      storedHashes = JSON.parse(fs.readFileSync(hashFilePath, "utf-8"));
    } catch { /* ignore */ }
  }

  const newHashes = {};
  let updatedCount = 0;

  for (const skillName of selectedSkills) {
    const srcDir = path.join(SKILLS_SRC_DIR, skillName);
    if (!fs.existsSync(srcDir)) continue;
    const destDir = path.join(skillsDestDir, skillName);
    fs.mkdirSync(destDir, { recursive: true });

    // Copy all files in the skill directory
    const srcFiles = fs.readdirSync(srcDir).filter((f) =>
      fs.statSync(path.join(srcDir, f)).isFile(),
    );
    for (const fileName of srcFiles) {
      const srcFile = path.join(srcDir, fileName);
      const destFile = path.join(destDir, fileName);
      const hashKey = `${skillName}/${fileName}`;
      const srcH = fileHash(srcFile);
      newHashes[hashKey] = srcH;

      if (srcH !== storedHashes[hashKey] || !fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        // Set executable on .sh files (non-Windows)
        if (fileName.endsWith(".sh") && process.platform !== "win32") {
          fs.chmodSync(destFile, 0o755);
        }
        updatedCount++;
      }
    }
  }

  // Clean up skills not in selected list
  if (fs.existsSync(skillsDestDir)) {
    for (const dir of fs.readdirSync(skillsDestDir)) {
      if (!selectedSkills.includes(dir)) {
        const rmPath = path.join(skillsDestDir, dir);
        if (fs.statSync(rmPath).isDirectory()) {
          fs.rmSync(rmPath, { recursive: true, force: true });
          log.dim(`  Skill removed: ${dir}`);
        }
      }
    }
  }

  fs.writeFileSync(hashFilePath, JSON.stringify(newHashes, null, 2));

  if (updatedCount > 0) {
    log.ok(`Skills: ${updatedCount} file(s) updated`);
  } else {
    log.dim("  Skills: up to date");
  }

  // Initialize data files for boss-advisor if selected
  if (selectedSkills.includes("boss-advisor")) {
    const bossProfileFile = path.join(workspaceDir, "boss-profile.json");
    const learningLogFile = path.join(workspaceDir, "learning-log.json");
    if (!fs.existsSync(bossProfileFile)) {
      fs.writeFileSync(bossProfileFile, JSON.stringify({
        bosses: [], interactions: [],
      }, null, 2));
    }
    if (!fs.existsSync(learningLogFile)) {
      fs.writeFileSync(learningLogFile, JSON.stringify({
        lessons: [], patterns: {},
      }, null, 2));
    }
  }
}

/** Spawns `picoclaw gateway` with tool server and LLM proxy */
function runPicoClawGateway(picoClawPath, cfg) {
  // Start LLM proxy first (parses text-based tool calls from Qwen)
  startLLMProxy(cfg.llm.baseURL, cfg.llm.apiKey);

  const picoConfigPath = writePicoClawConfig(cfg);
  log.ok(`PicoClaw config: ${picoConfigPath}`);

  const telegramContextStore = new Map();
  startToolServer(telegramContextStore);

  console.log();
  console.log(`  ${c.bold}${c.green}${"═".repeat(56)}${c.reset}`);
  console.log(`  ${c.bold}${c.green}  🦞 "${cfg.bot.name}" — PicoClaw Gateway${c.reset}`);
  console.log(`  ${c.green}  Ctrl+C để dừng${c.reset}`);
  console.log(`  ${c.bold}${c.green}${"═".repeat(56)}${c.reset}`);
  console.log();

  const child = spawn(picoClawPath, ["gateway"], {
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("error", (err) => {
    log.err(`PicoClaw lỗi: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    if (code !== 0) log.err(`PicoClaw thoát với mã ${code}`);
    else log.ok("PicoClaw gateway đã dừng.");
    process.exit(code || 0);
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
}

// ── Tool Server (Telegram context endpoint) ─────────────────
const TOOL_SERVER_PORT = 13579;
const TOOL_SERVER_HOST = "127.0.0.1";

// ── PicoClaw Agent CLI wrapper ───────────────────────────────
const PICOCLAW_RESPONSE_PREFIX = "🦞 ";
const PICOCLAW_AGENT_TIMEOUT_MS = 120_000;

/**
 * Spawns `picoclaw agent -m "<message>" -s "<sessionId>"`.
 * Returns the cleaned response (stdout, prefix stripped).
 * Stderr (logs) is suppressed. Rejects after timeout.
 */
function callPicoClawAgent(picoClawPath, message, sessionId) {
  return new Promise((resolve, reject) => {
    const args = ["agent", "-m", message, "-s", sessionId];
    const child = spawn(picoClawPath, args, { stdio: ["ignore", "pipe", "ignore"] });

    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("PicoClaw agent timeout"));
    }, PICOCLAW_AGENT_TIMEOUT_MS);

    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`PicoClaw agent exited with code ${code}`));
      const response = stdout.trim().startsWith(PICOCLAW_RESPONSE_PREFIX)
        ? stdout.trim().slice(PICOCLAW_RESPONSE_PREFIX.length)
        : stdout.trim();
      resolve(response);
    });
  });
}

/**
 * Builds a structured context object from a Telegram message.
 * Stored in the context Map so PicoClaw agent can fetch it via HTTP.
 */
function buildMessageContext(msg) {
  const replyMsg = msg.reply_to_message;
  return {
    has_reply: Boolean(replyMsg),
    message_id: msg.message_id,
    sender: msg.from?.username || msg.from?.first_name || "unknown",
    reply_to: replyMsg
      ? { text: replyMsg.text || "", sender: replyMsg.from?.username || replyMsg.from?.first_name || "unknown" }
      : null,
  };
}

// ── Tool Server (HTTP endpoint for PicoClaw agent) ──────────

/** Parses query string from URL path (no external deps) */
function parseQuery(urlString) {
  const idx = urlString.indexOf("?");
  if (idx === -1) return {};
  const params = {};
  urlString.slice(idx + 1).split("&").forEach((pair) => {
    const [k, v] = pair.split("=");
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return params;
}

/**
 * Starts an HTTP server that exposes Telegram message context.
 * PicoClaw agent calls `exec curl` to GET /telegram/context?chat_id=X.
 * Returns the server instance.
 */
function startToolServer(contextStore) {
  const server = http.createServer((req, res) => {
    const pathname = req.url?.split("?")[0];

    if (req.method === "GET" && pathname === "/telegram/context") {
      const query = parseQuery(req.url);
      const chatId = query.chat_id;
      if (!chatId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "missing chat_id parameter" }));
        return;
      }
      const context = contextStore.get(chatId) || { has_reply: false, message_id: null, sender: null, reply_to: null };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(context));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(TOOL_SERVER_PORT, TOOL_SERVER_HOST, () => {
    log.ok(`Tool server: http://${TOOL_SERVER_HOST}:${TOOL_SERVER_PORT}`);
  });
  return server;
}

// ── LLM Proxy (converts text-based tool calls to OpenAI format) ────
const LLM_PROXY_PORT = 13580;
const LLM_PROXY_HOST = "127.0.0.1";

/**
 * Parses Qwen-format tool calls from LLM response content.
 * Format: <function=NAME><parameter=KEY>VALUE</parameter></function>
 * Uses htmlparser2 for robust parsing of malformed XML-like content.
 * Returns { text, toolCalls } where text is content without tool calls.
 */
function parseQwenToolCalls(content) {
  if (!content || typeof content !== "string") {
    return { text: content || "", toolCalls: [] };
  }

  const toolCalls = [];
  let currentFunc = null;
  let currentParam = null;

  const parser = new Parser({
    onopentag(name) {
      // htmlparser2 sees <function=write_file> as tag name "function=write_file"
      if (name.startsWith("function=")) {
        const funcName = name.slice("function=".length);
        if (funcName) {
          currentFunc = { name: funcName, args: {} };
        }
      }
      // Handle <parameter=KEY> - tag name is "parameter=key"
      if (name.startsWith("parameter=") && currentFunc) {
        currentParam = name.slice("parameter=".length);
      }
    },
    ontext(text) {
      if (currentFunc && currentParam) {
        // Inside a parameter tag - accumulate value
        const existing = currentFunc.args[currentParam] || "";
        currentFunc.args[currentParam] = existing + text;
      }
    },
    onclosetag(name) {
      if (name.startsWith("parameter=")) {
        // Trim the parameter value
        if (currentFunc && currentParam) {
          currentFunc.args[currentParam] = (currentFunc.args[currentParam] || "").trim();
        }
        currentParam = null;
      }
      if (name.startsWith("function=") && currentFunc) {
        toolCalls.push({
          id: `call_${crypto.randomBytes(12).toString("hex")}`,
          type: "function",
          function: {
            name: currentFunc.name,
            arguments: JSON.stringify(currentFunc.args),
          },
        });
        currentFunc = null;
      }
    },
  }, { decodeEntities: true, lowerCaseTags: true });

  parser.write(content);
  parser.end();

  // Extract text content (remove tool call blocks)
  const toolCallPattern = /<function=[\s\S]*?<\/function>|<\/tool_call>/gi;
  const cleanText = content.replace(toolCallPattern, "").trim();

  return { text: cleanText, toolCalls };
}

/**
 * Transforms LLM response by parsing text-based tool calls.
 * Modifies choices[].message to include tool_calls array if found.
 */
function transformLLMResponse(responseData) {
  if (!responseData?.choices) return responseData;

  for (const choice of responseData.choices) {
    const msg = choice.message;
    if (!msg?.content) continue;

    const { text, toolCalls } = parseQwenToolCalls(msg.content);

    if (toolCalls.length > 0) {
      msg.content = text || null;
      msg.tool_calls = toolCalls;
      log.info(`LLM Proxy: Parsed ${toolCalls.length} tool call(s)`);
    }
  }

  return responseData;
}

/**
 * Starts the LLM proxy server that intercepts and transforms responses.
 * Forwards requests to the actual LLM endpoint, parses tool calls from
 * text content, and converts them to OpenAI-style tool_calls format.
 */
function startLLMProxy(targetBaseURL, apiKey) {
  const server = http.createServer(async (req, res) => {
    // Only proxy chat completions endpoint
    if (req.method === "POST" && req.url?.startsWith("/v1/chat/completions")) {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const requestData = JSON.parse(body);

          // Forward to actual LLM using OpenAI client
          const client = new OpenAI({
            baseURL: targetBaseURL,
            apiKey: apiKey || "not-needed",
            timeout: 120000,
          });

          const response = await client.chat.completions.create(requestData);

          // Transform response (parse text-based tool calls)
          const transformed = transformLLMResponse(response);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(transformed));
        } catch (err) {
          log.err(`LLM Proxy error: ${err.message}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      });
      return;
    }

    // Pass through other endpoints (models list, etc.)
    if (req.method === "GET" && req.url?.startsWith("/v1/models")) {
      try {
        const client = new OpenAI({
          baseURL: targetBaseURL,
          apiKey: apiKey || "not-needed",
        });
        const models = await client.models.list();
        const modelList = [];
        for await (const m of models) modelList.push(m);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: modelList }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(LLM_PROXY_PORT, LLM_PROXY_HOST, () => {
    log.ok(`LLM Proxy: http://${LLM_PROXY_HOST}:${LLM_PROXY_PORT} → ${targetBaseURL}`);
  });

  return server;
}

// ── Node.js Telegram Bot (grammY — supports private + group chats) ──
const TELEGRAM_SESSION_PREFIX = "telegram:";
const FALLBACK_ERROR_MESSAGE = "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.";

/** Removes @botUsername from message text so the LLM gets clean input */
function stripBotMention(text, botUsername) {
  const pattern = new RegExp(`@${botUsername}`, "gi");
  return text.replace(pattern, "").replace(/\s+/g, " ").trim();
}

/**
 * Shared message handler for both private and group chats.
 * Strips bot mention, stores context, calls PicoClaw, replies.
 */
async function handleMessage(ctx, picoClawPath, telegramContextStore) {
  const msg = ctx.msg;
  const chatId = String(msg.chat.id);
  const sessionId = TELEGRAM_SESSION_PREFIX + chatId;
  const cleanText = stripBotMention(msg.text, ctx.me.username);

  if (!cleanText) return;

  telegramContextStore.set(chatId, buildMessageContext(msg));
  const content = `[chat_id:${chatId}]\n${cleanText}`;

  log.info(`[chat:${chatId}] ${msg.from?.username || "user"}: ${cleanText.slice(0, 80)}`);

  try {
    const response = await callPicoClawAgent(picoClawPath, content, sessionId);
    log.bot(`[chat:${chatId}] ${response.slice(0, 80)}`);
    await ctx.reply(response, {
      parse_mode: "Markdown",
      reply_parameters: { message_id: msg.message_id },
    });
  } catch (err) {
    log.err(`[chat:${chatId}] ${err.message}`);
    await ctx.reply(FALLBACK_ERROR_MESSAGE, {
      reply_parameters: { message_id: msg.message_id },
    });
  }
}

/**
 * Launches PicoClaw gateway with built-in Telegram enabled.
 * Tool server runs alongside for context lookups.
 * grammY bot code is kept but disabled — reserved for future
 * context capture if PicoClaw adds a way to coexist.
 */
function runBot(cfg, picoClawPath) {
  runPicoClawGateway(picoClawPath, cfg);
}

// ── OpenAI client ───────────────────────────────────────────
function makeClient(cfg) {
  return new OpenAI({
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey || "not-needed",
    timeout: 120000,
  });
}

async function chat(client, model, messages, opts = {}) {
  const res = await client.chat.completions.create({
    model,
    messages,
    max_tokens: opts.max_tokens || 4096,
    temperature: opts.temperature ?? 0.7,
  });
  return res.choices?.[0]?.message?.content || "";
}

// ============================================================
//  STEP 1: Telegram Bot Token
// ============================================================
async function setupTelegram(existing) {
  log.step(1, 4, "Telegram Bot Token");
  console.log();
  log.dim("Cách tạo:");
  log.dim("  1. Mở Telegram → tìm @BotFather");
  log.dim("  2. Gửi /newbot → đặt tên → copy token");
  log.dim("  3. Token dạng: 123456789:ABCdefGhIJKlmNoPQRs");
  console.log();

  if (existing) {
    const masked = existing.slice(0, 8) + "••••" + existing.slice(-4);
    log.info(`Token hiện tại: ${masked}`);
    if (await confirm("Giữ token cũ?")) return existing;
  }

  while (true) {
    const token = await ask("Telegram Bot Token");
    if (!token || !token.includes(":")) { log.warn("Token phải chứa ':'"); continue; }

    const s = spinner("Kiểm tra token...");
    try {
      const info = await new Promise((resolve, reject) => {
        https.get(`https://api.telegram.org/bot${token}/getMe`, (res) => {
          let d = "";
          res.on("data", (ch) => (d += ch));
          res.on("end", () => {
            try { const j = JSON.parse(d); resolve(j.ok ? j.result : null); }
            catch { resolve(null); }
          });
        }).on("error", reject);
      });
      s.stop();
      if (info) { log.ok(`Bot: @${info.username} (${info.first_name})`); return token; }
      else log.err("Token không hợp lệ.");
    } catch (e) {
      s.stop();
      log.err(`Lỗi mạng: ${e.message}`);
      if (await confirm("Vẫn dùng token này?", false)) return token;
    }
  }
}

// ============================================================
//  STEP 2: OpenAI-compatible LLM
// ============================================================
async function setupLLM(existing) {
  log.step(2, 4, "OpenAI-Compatible LLM");
  console.log();
  log.dim("Hỗ trợ mọi server có /v1/chat/completions:");
  log.dim("  LM Studio, Ollama, vLLM, LocalAI, OpenRouter, llama.cpp...");
  console.log();

  if (existing?.baseURL) {
    log.info(`Hiện tại: ${existing.baseURL} | model: ${existing.model}`);
    if (await confirm("Giữ config cũ?")) return existing;
  }

  // ── Base URL ──
  const presetIdx = await choose("Server LLM của bạn:", [
    "LM Studio        → http://localhost:1234/v1",
    "Ollama           → http://localhost:11434/v1",
    "LocalAI          → http://localhost:8080/v1",
    "llama.cpp        → http://localhost:8080/v1",
    "text-gen-webui   → http://localhost:5000/v1",
    "OpenRouter       → https://openrouter.ai/api/v1",
    "NVIDIA NIM       → https://integrate.api.nvidia.com/v1",
    "ZingPlay Chat    → https://chat.zingplay.com/api/v1",
    "Tự nhập URL khác",
  ]);

  const presetURLs = [
    "http://localhost:1234/v1",
    "http://localhost:11434/v1",
    "http://localhost:8080/v1",
    "http://localhost:8080/v1",
    "http://localhost:5000/v1",
    "https://openrouter.ai/api/v1",
    "https://integrate.api.nvidia.com/v1",
    "https://chat.zingplay.com/api/v1",
    "",
  ];

  let baseURL = presetURLs[presetIdx];
  if (!baseURL) {
    baseURL = await ask("Base URL (có /v1)", "http://localhost:1234/v1");
  } else {
    baseURL = await ask("Base URL", baseURL);
  }
  if (!baseURL.startsWith("http")) baseURL = "http://" + baseURL;
  if (!baseURL.includes("/v1")) baseURL = baseURL.replace(/\/$/, "") + "/v1";

  // ── API Key ──
  const isLocal = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");
  const isNvidia = baseURL.includes("integrate.api.nvidia.com");
  const isZingPlay = baseURL.includes("chat.zingplay.com");
  let apiKey;
  if (isLocal) {
    log.dim("-> Local server, bo qua API key.");
    apiKey = "not-needed";
  } else if (isNvidia && process.env.NVIDIA_API_KEY) {
    log.dim("-> Su dung NVIDIA_API_KEY tu .env");
    apiKey = process.env.NVIDIA_API_KEY;
  } else if (isZingPlay && process.env.ZINGPLAY_API_KEY) {
    log.dim("-> Su dung ZINGPLAY_API_KEY tu .env");
    apiKey = process.env.ZINGPLAY_API_KEY;
  } else {
    let envHint = "";
    if (isNvidia) envHint = " (hoac dat NVIDIA_API_KEY trong .env)";
    else if (isZingPlay) envHint = " (hoac dat ZINGPLAY_API_KEY trong .env)";
    apiKey = await ask(`API Key${envHint}`) || "not-needed";
  }

  // ── List models ──
  const client = makeClient({ baseURL, apiKey });

  const s = spinner("Lấy danh sách model...");
  let models = [];
  try {
    const list = await client.models.list();
    for await (const m of list) models.push(m.id);
    models = models.slice(0, 20);
  } catch {}
  s.stop();

  let model;
  if (models.length > 0) {
    log.ok(`Tìm thấy ${models.length} model:`);
    models.forEach((m, i) => console.log(`    ${c.cyan}${i + 1})${c.reset} ${m}`));
    console.log();
    const a = await ask(`Chọn (1-${models.length}) hoặc gõ tên`);
    const n = parseInt(a);
    model = (n >= 1 && n <= models.length) ? models[n - 1] : a;
  } else {
    log.warn("Không lấy được danh sách model.");
    model = await ask("Nhập tên model");
  }

  // ── Test ──
  console.log();
  const s2 = spinner("Test kết nối...");
  try {
    const reply = await chat(client, model, [
      { role: "user", content: "Reply with exactly one word: OK" },
    ], { max_tokens: 20, temperature: 0 });
    s2.stop();
    log.ok(`Thành công! Reply: "${reply.trim().slice(0, 60)}"`);
  } catch (e) {
    s2.stop();
    log.err(`Lỗi: ${e.message}`);
    log.warn("Kiểm tra: server đang chạy? URL đúng? model đúng?");
    if (!await confirm("Vẫn tiếp tục?", false)) return setupLLM();
  }

  return { baseURL, apiKey, model };
}

// ============================================================
//  STEP 3: Bot Design (AI tự build)
// ============================================================
const ARCHITECT_PROMPT = `You are ClawFather 🦞, an expert Telegram bot architect.

The user will describe a bot they want. You MUST respond with ONLY a valid JSON object (no markdown fences, no explanation before or after):

{
  "name": "short bot name (2-4 words)",
  "description": "1-line description",
  "system_prompt": "Complete system prompt for this bot. 200+ words. Include: personality, rules, capabilities, response format, edge cases, language. Production-ready.",
  "welcome_message": "The /start greeting",
  "sample_qa": [
    {"q": "example user question", "a": "expected answer"},
    {"q": "another question", "a": "another answer"},
    {"q": "edge case question", "a": "how bot handles it"}
  ],
  "features": ["capability 1", "capability 2", "capability 3"],
  "pipeline": {
    "temperature": 0.7,
    "max_tokens": 1024,
    "context_window": 20
  }
}

RULES:
- system_prompt: 200+ words, professional, comprehensive, production-ready
- Write in the SAME LANGUAGE the user uses
- Include edge cases, refusal conditions, personality
- Pipeline should match bot purpose (low temp for factual, high for creative)
- Output ONLY the JSON, nothing else`;

async function designBot(llm) {
  log.step(3, 4, "Thiết kế Bot");
  console.log();
  log.dim("Mô tả bot bạn muốn tạo. Càng chi tiết càng tốt!");
  log.dim("Ví dụ:");
  log.dim('  "Bot tư vấn sức khỏe, nhẹ nhàng, luôn khuyên đi khám bác sĩ"');
  log.dim('  "Bot dạy tiếng Anh cho người Việt, sửa lỗi ngữ pháp"');
  log.dim('  "Bot hỗ trợ kỹ thuật cho sản phẩm X"');
  log.dim('  "Bot viết content marketing, style Gen Z"');
  console.log();

  const client = makeClient(llm);

  while (true) {
    const description = await ask("Mô tả bot của bạn");
    if (!description) { log.warn("Hãy mô tả bot."); continue; }

    const s = spinner("🧠 AI đang thiết kế bot...");
    try {
      const raw = await chat(client, llm.model, [
        { role: "system", content: ARCHITECT_PROMPT },
        { role: "user", content: `Tôi muốn tạo bot: ${description}` },
      ], { max_tokens: 4096, temperature: 0.7 });
      s.stop();

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI không trả về JSON hợp lệ");
      let botData = JSON.parse(jsonMatch[0]);

      // ── Preview & refine loop ──
      while (true) {
        console.log();
        console.log(`  ${c.bold}${"═".repeat(56)}${c.reset}`);
        console.log(`  ${c.bold}${c.green}🤖 ${botData.name}${c.reset}`);
        console.log(`  ${c.dim}${botData.description}${c.reset}`);
        console.log(`  ${"─".repeat(56)}`);

        console.log(`  ${c.bold}Features:${c.reset}`);
        (botData.features || []).forEach((f) => console.log(`    • ${f}`));

        console.log(`\n  ${c.bold}Welcome:${c.reset} ${botData.welcome_message || "(none)"}`);
        console.log(`  ${c.bold}Pipeline:${c.reset} temp=${botData.pipeline?.temperature ?? 0.7}, tokens=${botData.pipeline?.max_tokens ?? 1024}, context=${botData.pipeline?.context_window ?? 20}`);

        if (botData.sample_qa?.length) {
          console.log(`\n  ${c.bold}Sample Q&A:${c.reset}`);
          botData.sample_qa.slice(0, 3).forEach((qa) => {
            console.log(`    ${c.cyan}👤${c.reset} ${qa.q}`);
            console.log(`    ${c.green}🤖${c.reset} ${qa.a}`);
          });
        }

        console.log(`\n  ${c.bold}System Prompt (preview):${c.reset}`);
        console.log(`  ${c.dim}${botData.system_prompt?.slice(0, 400)}...${c.reset}`);
        console.log(`  ${"═".repeat(56)}`);

        const action = await choose("Tiếp theo:", [
          "✅ Lưu — Hoàn hảo!",
          "✏️  Chỉnh sửa — Yêu cầu AI sửa",
          "📋 Xem đầy đủ System Prompt",
          "🔄 Làm lại từ đầu",
          "❌ Hủy",
        ]);

        if (action === 0) return botData;

        if (action === 1) {
          console.log();
          log.dim('Ví dụ: "thêm rule không nói chính trị", "tone vui hơn", "giảm temp 0.3"');
          const fix = await ask("Bạn muốn sửa gì?");
          if (!fix) continue;

          const s2 = spinner("🔧 Đang sửa...");
          try {
            const raw2 = await chat(client, llm.model, [
              { role: "system", content: ARCHITECT_PROMPT },
              { role: "user", content: `Bot hiện tại:\n${JSON.stringify(botData, null, 2)}\n\nChỉnh sửa: ${fix}\n\nTrả về JSON đầy đủ đã sửa.` },
            ], { max_tokens: 4096 });
            s2.stop();

            const m = raw2.match(/\{[\s\S]*\}/);
            if (m) { botData = JSON.parse(m[0]); log.ok("Đã cập nhật!"); }
            else log.err("Lỗi parse, giữ bản cũ.");
          } catch (e) {
            s2.stop();
            log.err(e.message);
          }
          continue;
        }

        if (action === 2) {
          console.log(`\n  ${c.bold}── Full System Prompt ──${c.reset}\n`);
          console.log(botData.system_prompt);
          console.log(`\n  ${"─".repeat(56)}\n`);
          continue;
        }

        if (action === 3) break; // restart outer loop
        if (action === 4) return null;
      }
      continue; // new description

    } catch (e) {
      if (typeof s !== "undefined" && s.stop) s.stop();
      log.err(`Lỗi: ${e.message}`);
      if (!await confirm("Thử lại?")) return null;
    }
  }
}

// ============================================================
//  Skill selection
// ============================================================

/** Interactive multi-select for skills. Returns array of selected skill names. */
async function setupSkills(existingSkills) {
  const available = discoverSkills();
  if (available.length === 0) {
    log.warn("Không tìm thấy skills nào trong skills/");
    return [];
  }

  const defaults = existingSkills || available.map((s) => s.name);
  console.log(`\n  ${c.yellow}?${c.reset} Chọn skills cho bot (nhập số, cách bằng dấu phẩy):`);
  available.forEach((s, i) => {
    const checked = defaults.includes(s.name) ? `${c.green}[x]${c.reset}` : `${c.dim}[ ]${c.reset}`;
    const label = s.emoji ? `${s.emoji} ${s.name}` : s.name;
    console.log(`    ${checked} ${c.cyan}${i + 1})${c.reset} ${label} ${c.dim}— ${s.description}${c.reset}`);
  });
  log.dim("  Enter = giữ mặc định, 0 = bỏ tất cả");

  const input = await ask(`Chọn (1-${available.length})`, defaults.map((_, i) => i + 1).join(","));
  if (input.trim() === "0") return [];

  const nums = input.split(/[,\s]+/).map(Number).filter((n) => n >= 1 && n <= available.length);
  if (nums.length === 0) return defaults;
  return [...new Set(nums.map((n) => available[n - 1].name))];
}

// ============================================================
//  Review & Save bot profile
// ============================================================

/** Displays bot summary. Returns the saved profile. */
async function reviewAndSave(cfg, existingId) {
  log.info("Review & Lưu");
  console.log();
  const masked = cfg.telegram.token.slice(0, 8) + "••••" + cfg.telegram.token.slice(-4);
  const skillNames = cfg.bot.skills || [];
  console.log(`  ${c.bold}${"═".repeat(56)}${c.reset}`);
  console.log(`  ${c.cyan}Telegram:${c.reset}  ${masked}`);
  console.log(`  ${c.cyan}LLM:${c.reset}       ${cfg.llm.baseURL}`);
  console.log(`  ${c.cyan}Model:${c.reset}     ${cfg.llm.model}`);
  console.log(`  ${c.cyan}Bot:${c.reset}       ${cfg.bot.name} — ${cfg.bot.description}`);
  console.log(`  ${c.cyan}Skills:${c.reset}    ${skillNames.length > 0 ? skillNames.join(", ") : "none"}`);
  console.log(`  ${c.cyan}Pipeline:${c.reset}  temp=${cfg.bot.pipeline?.temperature}, tokens=${cfg.bot.pipeline?.max_tokens}`);
  console.log(`  ${"═".repeat(56)}`);

  const id = existingId || slugify(cfg.bot.name);
  const now = new Date().toISOString();
  const profile = {
    id,
    createdAt: cfg.createdAt || now,
    updatedAt: now,
    telegram: cfg.telegram,
    llm: cfg.llm,
    bot: cfg.bot,
  };

  saveBot(profile);
  log.ok(`Bot profile: ${path.join(BOTS_DIR, id + ".json")}`);

  const picoConfigPath = writePicoClawConfig(profile);
  log.ok(`PicoClaw config: ${picoConfigPath}`);

  return profile;
}

// ============================================================
//  Bot Runner — delegates to PicoClaw gateway
// ============================================================
// runPicoClawGateway() is defined above in the PicoClaw section

// ============================================================
//  Multi-bot management
// ============================================================

/** One-time migration from legacy single-bot config.json to data/bots/ */
async function migrateFromLegacyConfig() {
  const legacy = loadConfig();
  if (!legacy?.bot?.system_prompt) return;
  if (loadAllBots().length > 0) return;

  log.info("Di chuyển config cũ sang multi-bot...");
  const id = slugify(legacy.bot.name);
  const now = new Date().toISOString();
  // Set skills to all available if not present
  if (!legacy.bot.skills) {
    legacy.bot.skills = discoverSkills().map((s) => s.name);
  }
  const profile = {
    id, createdAt: now, updatedAt: now,
    telegram: legacy.telegram,
    llm: legacy.llm,
    bot: legacy.bot,
  };
  saveBot(profile);
  log.ok(`Đã chuyển "${profile.bot.name}" -> data/bots/${id}.json`);

  // Migrate workspace
  const oldWork = path.join(os.homedir(), ".picoclaw", "workspace");
  const newWork = path.join(PICOCLAW_WORKSPACES_DIR, id);
  if (fs.existsSync(oldWork) && !fs.existsSync(newWork)) {
    fs.mkdirSync(path.dirname(newWork), { recursive: true });
    fs.renameSync(oldWork, newWork);
    log.ok(`Workspace -> ${newWork}`);
  }

  // Backup legacy config
  const backupPath = CONFIG_FILE + ".bak";
  fs.renameSync(CONFIG_FILE, backupPath);
  log.dim(`Config cũ lưu tại: ${backupPath}`);
}

/** Displays formatted list of all bots */
function displayBotList(bots) {
  console.log(`\n  ${c.bold}${"═".repeat(60)}${c.reset}`);
  console.log(`  ${c.bold}  Bot Profiles (${bots.length})${c.reset}`);
  console.log(`  ${"─".repeat(60)}`);
  bots.forEach((b, i) => {
    const masked = b.telegram.token.slice(0, 8) + "••••" + b.telegram.token.slice(-4);
    const skillCount = b.bot.skills?.length ?? 0;
    console.log(`  ${c.cyan}${i + 1})${c.reset} ${c.bold}${b.bot.name}${c.reset}`);
    console.log(`     ${c.dim}ID: ${b.id} | Model: ${b.llm.model} | Skills: ${skillCount} | Token: ${masked}${c.reset}`);
  });
  console.log(`  ${"═".repeat(60)}\n`);
}

/** Pick a bot from list and launch it */
async function selectAndRunBot(bots, picoClawPath) {
  let profile;
  if (bots.length === 1) {
    profile = bots[0];
    log.info(`Bot duy nhất: "${profile.bot.name}"`);
  } else {
    profile = await chooseBotFromList(bots, "Chọn bot để chạy:");
  }
  rl.close();
  runBot(profile, picoClawPath);
}

/** Create a new bot, optionally cloning LLM/Telegram from existing */
async function createNewBot(bots, picoClawPath) {
  let existingTelegram = null;
  let existingLlm = null;

  if (bots.length > 0) {
    const cloneLabels = bots.map(
      (b) => `Sao chép từ "${b.bot.name}" (LLM + Telegram)`,
    );
    cloneLabels.push("Nhập mới từ đầu");
    const idx = await choose("Sao chép cài đặt từ bot có sẵn?", cloneLabels);
    if (idx < bots.length) {
      existingTelegram = bots[idx].telegram.token;
      existingLlm = bots[idx].llm;
    }
  }

  const token = await setupTelegram(existingTelegram);
  const llm = await setupLLM(existingLlm);
  const botData = await designBot(llm);
  if (!botData) { log.warn("Hủy."); return null; }
  botData.skills = await setupSkills();

  const cfg = { telegram: { token }, llm, bot: botData };
  const profile = await reviewAndSave(cfg);

  if (await confirm("Chạy bot ngay?")) {
    rl.close();
    runBot(profile, picoClawPath);
    return profile;
  }
  return profile;
}

/** Pick a bot and edit its telegram, LLM, design, or skills */
async function editExistingBot(bots) {
  const profile = await chooseBotFromList(bots, "Chọn bot để sửa:");

  const action = await choose("Chỉnh sửa gì:", [
    "Telegram token",
    "LLM settings",
    "Bot design (AI redesign)",
    "Skills",
    "Quay lại",
  ]);

  if (action === 4) return null;

  if (action === 0) {
    profile.telegram.token = await setupTelegram(profile.telegram.token);
  } else if (action === 1) {
    profile.llm = await setupLLM(profile.llm);
  } else if (action === 2) {
    const newBot = await designBot(profile.llm);
    if (!newBot) { log.warn("Hủy."); return null; }
    newBot.skills = profile.bot.skills;
    profile.bot = newBot;
  } else if (action === 3) {
    profile.bot.skills = await setupSkills(profile.bot.skills);
  }

  return reviewAndSave(
    { telegram: profile.telegram, llm: profile.llm, bot: profile.bot, createdAt: profile.createdAt },
    profile.id,
  );
}

/** Pick a bot and delete it */
async function deleteExistingBot(bots) {
  const profile = await chooseBotFromList(bots, "Chọn bot để xóa:");
  if (await confirm(`Xóa "${profile.bot.name}"?`, false)) {
    await deleteBot(profile.id);
    log.ok(`Đã xóa bot "${profile.bot.name}".`);
  }
}

// ============================================================
//  MAIN
// ============================================================
async function main() {
  banner();

  const picoClawPath = await ensurePicoClaw();
  if (!picoClawPath) {
    log.err("PicoClaw cần được cài đặt để chạy bot.");
    rl.close();
    return;
  }
  console.log();

  await migrateFromLegacyConfig();
  let bots = loadAllBots();

  if (bots.length === 0) {
    log.info("Chưa có bot nào. Hãy tạo bot đầu tiên!");
    await createNewBot(bots, picoClawPath);
    rl.close();
    return;
  }

  // Main menu loop
  while (true) {
    bots = loadAllBots();
    if (bots.length === 0) {
      log.info("Không còn bot nào.");
      if (await confirm("Tạo bot mới?")) {
        await createNewBot(bots, picoClawPath);
      }
      rl.close();
      return;
    }

    log.ok(`Tìm thấy ${bots.length} bot profile(s).`);
    const action = await choose("Bạn muốn:", [
      "Chạy bot",
      "Tạo bot mới",
      "Chỉnh sửa bot",
      "Xem danh sách bot",
      "Xóa bot",
      "Xóa PicoClaw config",
      "Thoát",
    ]);

    if (action === 0) { await selectAndRunBot(bots, picoClawPath); return; }
    if (action === 1) { await createNewBot(bots, picoClawPath); continue; }
    if (action === 2) { await editExistingBot(bots); continue; }
    if (action === 3) { displayBotList(bots); continue; }
    if (action === 4) { await deleteExistingBot(bots); continue; }
    if (action === 5) {
      if (await confirm("Xóa ~/.picoclaw/config.json?", false)) {
        await removePicoClawConfig();
      }
      continue;
    }
    if (action === 6) { rl.close(); return; }
  }
}

main().catch((e) => { log.err(e.message); process.exit(1); });
