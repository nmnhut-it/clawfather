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
const { spawn, execSync } = require("child_process");
const OpenAI = require("openai");
const TelegramBot = require("node-telegram-bot-api");

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

/** Builds the PicoClaw config object from ClawFather config */
function buildPicoClawConfig(cfg) {
  return {
    agents: {
      defaults: {
        workspace: "~/.picoclaw/workspace",
        restrict_to_workspace: true,
        provider: "openai",
        model: cfg.llm.model,
        max_tokens: cfg.bot.pipeline?.max_tokens || 8192,
        temperature: cfg.bot.pipeline?.temperature ?? 0.7,
        max_tool_iterations: 20,
      },
    },
    channels: {
      telegram: {
        enabled: false, // Node.js handles Telegram; PicoClaw used as agent CLI only
        token: cfg.telegram.token,
        proxy: "",
        allow_from: [],
      },
    },
    providers: {
      openai: {
        api_key: cfg.llm.apiKey || "",
        api_base: cfg.llm.baseURL,
      },
    },
  };
}

/** Writes ~/.picoclaw/config.json, workspace AGENTS.md, and skills */
function writePicoClawConfig(cfg) {
  const picoDir = path.join(os.homedir(), ".picoclaw");
  const workDir = path.join(picoDir, "workspace");
  fs.mkdirSync(workDir, { recursive: true });

  const configPath = path.join(picoDir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify(buildPicoClawConfig(cfg), null, 2));

  fs.writeFileSync(path.join(workDir, "AGENTS.md"), buildAgentsMd(cfg.bot));
  writeTelegramContextSkill(workDir, TOOL_SERVER_PORT);
  return configPath;
}

/** Builds AGENTS.md content from bot design data */
function buildAgentsMd(bot) {
  const lines = [`# Agent: ${bot.name}`, ""];
  lines.push(bot.system_prompt || "");
  if (bot.features?.length) {
    lines.push("", "## Skills");
    bot.features.forEach((f) => lines.push(`- ${f}`));
  }
  lines.push(
    "",
    "## Telegram Context (IMPORTANT)",
    "Every message from Telegram starts with `[chat_id:NUMBER]`.",
    "You MUST ALWAYS run this command before responding:",
    "```",
    `exec curl -s http://${TOOL_SERVER_HOST}:${TOOL_SERVER_PORT}/telegram/context?chat_id=CHAT_ID`,
    "```",
    "Replace CHAT_ID with the number from the prefix.",
    "If `has_reply` is true, use `reply_to.text` as quoted context in your response.",
  );
  return lines.join("\n") + "\n";
}

/**
 * Writes skills/telegram-context/SKILL.md to PicoClaw workspace.
 * Instructs the agent how to fetch reply context via exec curl.
 */
function writeTelegramContextSkill(workspaceDir, port) {
  const skillDir = path.join(workspaceDir, "skills", "telegram-context");
  fs.mkdirSync(skillDir, { recursive: true });

  const endpoint = `http://${TOOL_SERVER_HOST}:${port}/telegram/context`;
  const content = [
    "---",
    "name: telegram-context",
    "description: Fetch reply/quoted message context for Telegram chats.",
    'metadata: {"nanobot":{"emoji":"💬","requires":{"bins":["curl"]}}}',
    "---",
    "",
    "# Telegram Context",
    "",
    "## When to use (ALWAYS)",
    "",
    "Every Telegram message starts with `[chat_id:NUMBER]`.",
    "You MUST run this command BEFORE responding to any Telegram message.",
    "",
    "## Quick start",
    "",
    "```bash",
    `exec curl -s "${endpoint}?chat_id=CHAT_ID"`,
    "```",
    "",
    "Replace `CHAT_ID` with the number from the `[chat_id:NUMBER]` prefix.",
    "",
    "## Response format",
    "",
    "```json",
    '{ "has_reply": true, "message_id": 123, "sender": "username",',
    '  "reply_to": { "text": "quoted message", "sender": "original_sender" } }',
    "```",
    "",
    "- `has_reply: false` — no quoted message, respond normally.",
    "- `has_reply: true` — user is replying to a previous message.",
    "  Use `reply_to.text` as context when crafting your response.",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);
}

/** Spawns `picoclaw gateway` and forwards stdio */
function runPicoClawGateway(picoClawPath, cfg) {
  const picoConfigPath = writePicoClawConfig(cfg);
  log.ok(`PicoClaw config: ${picoConfigPath}`);

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

// ── Node.js Telegram Bot (replaces PicoClaw built-in Telegram) ──
const TELEGRAM_SESSION_PREFIX = "telegram:";

/**
 * Starts a Node.js Telegram bot that delegates to PicoClaw agent CLI.
 * Stores message context in a Map; exposes it via HTTP tool server.
 */
function runBot(cfg, picoClawPath) {
  writePicoClawConfig(cfg);

  const telegramContextStore = new Map();
  startToolServer(telegramContextStore);

  console.log();
  console.log(`  ${c.bold}${c.green}${"═".repeat(56)}${c.reset}`);
  console.log(`  ${c.bold}${c.green}  🦞 "${cfg.bot.name}" — Telegram Bot${c.reset}`);
  console.log(`  ${c.green}  Ctrl+C để dừng${c.reset}`);
  console.log(`  ${c.bold}${c.green}${"═".repeat(56)}${c.reset}`);
  console.log();

  const bot = new TelegramBot(cfg.telegram.token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    const welcome = cfg.bot.welcome_message || `Xin chào! Tôi là ${cfg.bot.name}.`;
    bot.sendMessage(msg.chat.id, welcome);
  });

  bot.onText(/\/clear/, (msg) => {
    log.info(`[chat:${msg.chat.id}] Session clear requested (PicoClaw manages memory)`);
    bot.sendMessage(msg.chat.id, "Session đã được reset.");
  });

  bot.onText(/\/info/, (msg) => {
    const info = [
      `🦞 *${cfg.bot.name}*`,
      `Model: \`${cfg.llm.model}\``,
      `Temp: ${cfg.bot.pipeline?.temperature ?? 0.7}`,
      `Max tokens: ${cfg.bot.pipeline?.max_tokens ?? 1024}`,
    ].join("\n");
    bot.sendMessage(msg.chat.id, info, { parse_mode: "Markdown" });
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const chatId = String(msg.chat.id);
    const sessionId = TELEGRAM_SESSION_PREFIX + chatId;

    telegramContextStore.set(chatId, buildMessageContext(msg));
    const content = `[chat_id:${chatId}]\n${msg.text}`;

    log.info(`[chat:${chatId}] ${msg.from?.username || "user"}: ${msg.text.slice(0, 80)}`);

    try {
      const response = await callPicoClawAgent(picoClawPath, content, sessionId);
      log.bot(`[chat:${chatId}] ${response.slice(0, 80)}`);
      await bot.sendMessage(chatId, response, {
        reply_to_message_id: msg.message_id,
        parse_mode: "Markdown",
      });
    } catch (err) {
      log.err(`[chat:${chatId}] ${err.message}`);
      await bot.sendMessage(chatId, "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.", {
        reply_to_message_id: msg.message_id,
      });
    }
  });

  bot.on("polling_error", (err) => {
    log.err(`Telegram polling error: ${err.message}`);
  });

  log.ok("Telegram bot đang chạy (polling)...");
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
    "Tự nhập URL khác",
  ]);

  const presetURLs = [
    "http://localhost:1234/v1",
    "http://localhost:11434/v1",
    "http://localhost:8080/v1",
    "http://localhost:8080/v1",
    "http://localhost:5000/v1",
    "https://openrouter.ai/api/v1",
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
  let apiKey;
  if (isLocal) {
    log.dim("→ Local server, bỏ qua API key.");
    apiKey = "not-needed";
  } else {
    apiKey = await ask("API Key") || "not-needed";
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
//  STEP 4: Review & Save
// ============================================================
async function reviewAndSave(cfg) {
  log.step(4, 4, "Review & Lưu");
  console.log();
  const masked = cfg.telegram.token.slice(0, 8) + "••••" + cfg.telegram.token.slice(-4);
  console.log(`  ${c.bold}${"═".repeat(56)}${c.reset}`);
  console.log(`  ${c.cyan}Telegram:${c.reset}  ${masked}`);
  console.log(`  ${c.cyan}LLM:${c.reset}       ${cfg.llm.baseURL}`);
  console.log(`  ${c.cyan}Model:${c.reset}     ${cfg.llm.model}`);
  console.log(`  ${c.cyan}Bot:${c.reset}       ${cfg.bot.name} — ${cfg.bot.description}`);
  console.log(`  ${c.cyan}Pipeline:${c.reset}  temp=${cfg.bot.pipeline?.temperature}, tokens=${cfg.bot.pipeline?.max_tokens}`);
  console.log(`  ${"═".repeat(56)}`);

  saveConfig(cfg);
  log.ok(`ClawFather config: ${CONFIG_FILE}`);

  const picoConfigPath = writePicoClawConfig(cfg);
  log.ok(`PicoClaw config: ${picoConfigPath}`);
}

// ============================================================
//  Bot Runner — delegates to PicoClaw gateway
// ============================================================
// runPicoClawGateway() is defined above in the PicoClaw section

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

  const existing = loadConfig();

  if (existing?.telegram?.token && existing?.llm?.baseURL && existing?.bot?.system_prompt) {
    log.ok(`Config tìm thấy: "${existing.bot.name}" | ${existing.llm.model}`);

    const action = await choose("Bạn muốn:", [
      "🚀 Chạy bot ngay",
      "🆕 Tạo bot mới (giữ LLM + Telegram config)",
      "⚙️  Setup lại toàn bộ",
      "❌ Thoát",
    ]);

    if (action === 0) { rl.close(); return runBot(existing, picoClawPath); }
    if (action === 1) {
      const b = await designBot(existing.llm);
      if (!b) { log.warn("Hủy."); rl.close(); return; }
      existing.bot = b;
      await reviewAndSave(existing);
      if (await confirm("🚀 Chạy bot ngay?")) { rl.close(); return runBot(existing, picoClawPath); }
      rl.close(); return;
    }
    if (action === 3) { rl.close(); return; }
  }

  // Full wizard
  const token = await setupTelegram(existing?.telegram?.token);
  const llm = await setupLLM(existing?.llm);
  const b = await designBot(llm);
  if (!b) { log.warn("Không tạo bot."); rl.close(); return; }

  const cfg = { telegram: { token }, llm, bot: b };
  await reviewAndSave(cfg);

  if (await confirm("🚀 Chạy bot ngay?")) { rl.close(); return runBot(cfg, picoClawPath); }
  log.ok("Chạy lại: node clawfather.js");
  rl.close();
}

main().catch((e) => { log.err(e.message); process.exit(1); });
