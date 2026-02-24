/**
 * Tic Tac Toe - Express server.
 * Serves HTML UI at / and game API at /api/*.
 * Human plays as P1 (X), PicoClaw bot plays as P2 (O).
 */

const express = require("express");
const path = require("path");
const GameEngine = require("./game-engine");
const { PLAYERS, ACTIONS, DEFAULT_PORT, PORT_ENV_KEY } = require("./constants");

const PORT = process.env[PORT_ENV_KEY] || DEFAULT_PORT;
const app = express();
const game = new GameEngine();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/** GET /api/state?player=p1 - visible game state for a player */
app.get("/api/state", (req, res) => {
  const player = req.query.player || PLAYERS.P1;
  if (player !== PLAYERS.P1 && player !== PLAYERS.P2) {
    return res.status(400).json({ error: "player must be p1 or p2" });
  }
  res.json(game.getVisibleState(player));
});

/**
 * POST /api/action - perform a game action.
 * Body: { player, action, row, col } for moves, { action: "new-game" } for reset.
 */
app.post("/api/action", (req, res) => {
  try {
    const { player, action } = req.body;
    let result;

    switch (action) {
      case ACTIONS.MOVE:
        result = game.makeMove(player, req.body.row, req.body.col);
        break;
      case ACTIONS.NEW_GAME:
        result = { ok: true, state: game.newGame() };
        break;
      default:
        result = { error: `Unknown action: ${action}` };
    }

    if (result && result.error) {
      return res.status(400).json(result);
    }
    const statePlayer = player || PLAYERS.P1;
    res.json({ ...result, state: game.getVisibleState(statePlayer) });
  } catch (err) {
    console.error("Action error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught:", err.message, err.stack);
});

app.listen(PORT, () => {
  console.log(`Tic Tac Toe running at http://localhost:${PORT}`);
});
