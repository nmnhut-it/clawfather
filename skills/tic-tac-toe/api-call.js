/**
 * HTTP helper for calling the Tic Tac Toe game API from CLI.
 * Usage:
 *   node api-call.js state p1          - get game state for p1
 *   node api-call.js action '{"player":"p1","action":"move","row":0,"col":0}'
 */
const http = require("http");
const { DEFAULT_PORT, PORT_ENV_KEY } = require("./constants");

const PORT = process.env[PORT_ENV_KEY] || DEFAULT_PORT;
const [, , cmd, arg] = process.argv;

if (cmd === "state") {
  httpGet(`/api/state?player=${arg || "p1"}`);
} else if (cmd === "action") {
  httpPost("/api/action", arg);
} else {
  console.error("Usage: node api-call.js state|action <arg>");
  process.exit(1);
}

function httpGet(urlPath) {
  http.get(`http://localhost:${PORT}${urlPath}`, collectResponse);
}

function httpPost(urlPath, body) {
  const req = http.request({
    hostname: "localhost", port: PORT, path: urlPath, method: "POST",
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
