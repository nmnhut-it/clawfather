/**
 * Air, Land & Sea - Express server.
 * Serves HTML UI at / and game API at /api/*.
 * Human plays as P1, PicoClaw bot plays as P2.
 */

const express = require("express");
const path = require("path");
const GameEngine = require("./game-engine");

const PORT = process.env.ALS_PORT || 3000;
const app = express();
const game = new GameEngine();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/** GET /api/state?player=p1 — visible game state for a player */
app.get("/api/state", (req, res) => {
  const player = req.query.player || "p1";
  if (player !== "p1" && player !== "p2") {
    return res.status(400).json({ error: "player must be p1 or p2" });
  }
  res.json(game.getVisibleState(player));
});

/**
 * POST /api/action — perform a game action.
 * Body: { player, action, ...params }
 * Actions: play, withdraw, ability-target, skip-ability, next-battle, new-game
 */
app.post("/api/action", (req, res) => {
  try {
    const { player, action } = req.body;
    let result;

    switch (action) {
      case "play":
        result = game.playCard(
          player, req.body.cardIndex, req.body.theater, req.body.faceUp,
        );
        break;
      case "withdraw":
        result = game.withdraw(player);
        break;
      case "ability-target":
        result = game.resolveAbilityTarget(player, req.body.target);
        break;
      case "skip-ability":
        result = game.skipAbility(player);
        break;
      case "next-battle":
        result = game.nextBattle();
        break;
      case "new-game":
        result = { ok: true, state: game.newGame() };
        break;
      default:
        result = { error: `Unknown action: ${action}` };
    }

    if (result && result.error) {
      return res.status(400).json(result);
    }
    const statePlayer = player || "p1";
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
  console.log(`Air, Land & Sea running at http://localhost:${PORT}`);
});
