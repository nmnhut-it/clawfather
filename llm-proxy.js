// ── LLM Proxy — converts text-based tool calls (Qwen format) to OpenAI format ──
// Intercepts LLM responses, parses <function=NAME><parameter=KEY>VALUE</parameter></function>
// tags, and converts them to OpenAI-style tool_calls. Standalone module.

const http = require("http");
const crypto = require("crypto");
const OpenAI = require("openai");
const { Parser } = require("htmlparser2");
require("dotenv").config();

// ── Config from .env with fallbacks ──
const DEFAULT_PORT = 13580;
const DEFAULT_HOST = "127.0.0.1";
const LLM_PROXY_PORT = parseInt(process.env.LLM_PROXY_PORT, 10) || DEFAULT_PORT;
const LLM_PROXY_HOST = process.env.LLM_PROXY_HOST || DEFAULT_HOST;
const LLM_BASE_URL = process.env.LLM_BASE_URL || "";
const LLM_API_KEY = process.env.LLM_API_KEY || "not-needed";
const LLM_TIMEOUT_MS = 120_000;

// ── Minimal logger ──
const log = {
  info: (m) => console.log(`\x1b[36mi\x1b[0m ${m}`),
  ok: (m) => console.log(`\x1b[32m+\x1b[0m ${m}`),
  err: (m) => console.log(`\x1b[31mx\x1b[0m ${m}`),
};

/**
 * Parses Qwen-format tool calls from LLM response content.
 * Format: <function=NAME><parameter=KEY>VALUE</parameter></function>
 * Uses htmlparser2 for robust parsing.
 * Returns { text, toolCalls } where text is content without tool call tags.
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
      if (name.startsWith("function=")) {
        const funcName = name.slice("function=".length);
        if (funcName) {
          currentFunc = { name: funcName, args: {} };
        }
      }
      if (name.startsWith("parameter=") && currentFunc) {
        currentParam = name.slice("parameter=".length);
      }
    },
    ontext(text) {
      if (currentFunc && currentParam) {
        const existing = currentFunc.args[currentParam] || "";
        currentFunc.args[currentParam] = existing + text;
      }
    },
    onclosetag(name) {
      if (name.startsWith("parameter=")) {
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

/** Creates an OpenAI client with given or .env-based config */
function makeProxyClient(baseURL, apiKey) {
  return new OpenAI({
    baseURL: baseURL || LLM_BASE_URL,
    apiKey: apiKey || LLM_API_KEY,
    timeout: LLM_TIMEOUT_MS,
  });
}

/** Handles POST /v1/chat/completions — forward to LLM, transform response */
function handleChatCompletions(req, res, baseURL, apiKey) {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    try {
      const requestData = JSON.parse(body);
      const client = makeProxyClient(baseURL, apiKey);
      const response = await client.chat.completions.create(requestData);
      const transformed = transformLLMResponse(response);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(transformed));
    } catch (err) {
      log.err(`LLM Proxy error: ${err.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: err.message } }));
    }
  });
}

/** Handles GET /v1/models — forward model list from upstream LLM */
async function handleModelsList(res, baseURL, apiKey) {
  try {
    const client = makeProxyClient(baseURL, apiKey);
    const models = await client.models.list();
    const modelList = [];
    for await (const m of models) modelList.push(m);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: modelList }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: err.message } }));
  }
}

/**
 * Starts the LLM proxy server.
 * Intercepts chat completions, parses Qwen tool calls, converts to OpenAI format.
 * @param {string} [targetBaseURL] - upstream LLM URL (falls back to LLM_BASE_URL env)
 * @param {string} [apiKey] - API key (falls back to LLM_API_KEY env)
 * @returns {http.Server}
 */
function startLLMProxy(targetBaseURL, apiKey) {
  const effectiveURL = targetBaseURL || LLM_BASE_URL;
  const effectiveKey = apiKey || LLM_API_KEY;

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url?.startsWith("/v1/chat/completions")) {
      return handleChatCompletions(req, res, effectiveURL, effectiveKey);
    }

    if (req.method === "GET" && req.url?.startsWith("/v1/models")) {
      return handleModelsList(res, effectiveURL, effectiveKey);
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(LLM_PROXY_PORT, LLM_PROXY_HOST, () => {
    log.ok(`LLM Proxy: http://${LLM_PROXY_HOST}:${LLM_PROXY_PORT} -> ${effectiveURL}`);
  });

  return server;
}

module.exports = {
  LLM_PROXY_PORT,
  LLM_PROXY_HOST,
  parseQwenToolCalls,
  transformLLMResponse,
  startLLMProxy,
};

// ── Standalone mode: `node llm-proxy.js` ──
if (require.main === module) {
  if (!LLM_BASE_URL) {
    log.err("LLM_BASE_URL not set. Configure it in .env or pass as env var.");
    process.exit(1);
  }
  log.info(`Starting standalone LLM proxy...`);
  startLLMProxy();
}
