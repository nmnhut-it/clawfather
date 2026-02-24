/**
 * HTTP helper for PicoClaw to call the Air Land Sea game API.
 * Usage:
 *   node api-call.js state p2          — get game state for p2
 *   node api-call.js action '{"player":"p2","action":"play","cardIndex":0,"theater":"air","faceUp":true}'
 */
const http = require("http");

const PORT = process.env.ALS_PORT || 3000;
const [, , cmd, arg] = process.argv;

if (cmd === "state") {
  httpGet(`/api/state?player=${arg || "p2"}`);
} else if (cmd === "action") {
  httpPost("/api/action", arg);
} else {
  console.error("Usage: node api-call.js state|action <arg>");
  process.exit(1);
}

function httpGet(path) {
  http.get(`http://localhost:${PORT}${path}`, collectResponse);
}

function httpPost(path, body) {
  const req = http.request({
    hostname: "localhost", port: PORT, path, method: "POST",
    headers: { "Content-Type": "application/json" },
  }, collectResponse);
  req.write(body);
  req.end();
}

function collectResponse(res) {
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => console.log(data));
}
