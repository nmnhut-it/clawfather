/**
 * Extracts Claude Code session transcript to readable markdown.
 * Usage: node export-session.js
 */
const fs = require("fs");
const path = require("path");

const SESSION_ID = "043d6173-48ad-4e92-ad38-f3e0e7636ab2";
const sessionFile = path.join(
  process.env.USERPROFILE, ".claude", "projects",
  "D--Gitlab-clawfather", `${SESSION_ID}.jsonl`,
);
const outFile = path.join(__dirname, "session-transcript.md");

const lines = fs.readFileSync(sessionFile, "utf8").trim().split("\n");
let md = "# Air, Land & Sea - Claude Code Session Transcript\n\n";
md += "Date: 2026-02-23\n\n---\n\n";
let msgCount = 0;

for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    const ts = formatTimestamp(obj.timestamp);
    if (obj.type === "user" || obj.type === "human") {
      const text = extractText(obj.message);
      if (text) {
        md += `## User ${ts}\n\n${text.substring(0, 2000)}\n\n---\n\n`;
        msgCount++;
      }
    } else if (obj.type === "assistant") {
      const text = extractAssistantText(obj.message);
      if (text) {
        md += `## Assistant ${ts}\n\n${text.substring(0, 4000)}\n\n---\n\n`;
        msgCount++;
      }
    }
  } catch (_) { /* skip malformed lines */ }
}

md += `\nTotal messages: ${msgCount}\n`;
fs.writeFileSync(outFile, md);
console.log(`Exported ${msgCount} messages to ${outFile}`);

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `\`${hh}:${mm}:${ss}\``;
}

function extractText(message) {
  if (typeof message === "string") return message.trim();
  if (!message?.content) return "";
  if (typeof message.content === "string") return message.content.trim();
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function extractAssistantText(message) {
  const content = message?.content || [];
  const blocks = Array.isArray(content) ? content : [content];
  return blocks
    .filter((b) => typeof b === "string" || b.type === "text")
    .map((b) => (typeof b === "string" ? b : b.text))
    .join("\n")
    .trim();
}
