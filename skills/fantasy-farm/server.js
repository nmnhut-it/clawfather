/**
 * Fantasy Farm — Express server.
 * Serves HTML UI at / and game API at /api/*.
 * PicoClaw drives all game logic; this server manages state and serialization.
 */

const express = require("express");
const path = require("path");
const { createInitialState, applyStateChanges, pushTurnHistory, getViewState } = require("./game-state");
const { processPlayerChoice, generateOpeningNarrative } = require("./picoclaw-turn");
const { GAME_CONFIG } = require("./constants");

const PORT = process.env.FF_PORT || GAME_CONFIG.SERVER_PORT;
const app = express();
let state = createInitialState();
let busy = false;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/** GET /api/state — current game view (resources, narrative, choices, etc.) */
app.get("/api/state", (_req, res) => {
  res.json(getViewState(state));
});

/**
 * POST /api/turn — player picks a choice.
 * Body: { choiceId: string }
 * Calls PicoClaw, applies state changes, returns updated view.
 */
app.post("/api/turn", async (req, res) => {
  if (busy) return res.json({ loading: true });
  busy = true;

  try {
    const { choiceId } = req.body;
    const choice = state.narrative.currentChoices.find((c) => c.id === choiceId);
    const choiceText = choice ? choice.text : choiceId;

    const result = processPlayerChoice(state, choiceText);

    applyStateChanges(state, result.stateChanges);
    pushTurnHistory(state, choiceText, result.narrative);
    state.narrative.currentNarrative = result.narrative;
    state.narrative.currentChoices = result.choices;

    res.json(getViewState(state));
  } catch (err) {
    console.error("Turn error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    busy = false;
  }
});

/**
 * POST /api/new-game — reset to initial state, generate opening narrative.
 * Returns the opening view with first choices.
 */
app.post("/api/new-game", async (_req, res) => {
  if (busy) return res.json({ loading: true });
  busy = true;

  try {
    state = createInitialState();
    const result = generateOpeningNarrative(state);

    applyStateChanges(state, result.stateChanges);
    state.narrative.currentNarrative = result.narrative;
    state.narrative.currentChoices = result.choices;

    res.json(getViewState(state));
  } catch (err) {
    console.error("New game error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    busy = false;
  }
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught:", err.message, err.stack);
});

app.listen(PORT, () => {
  console.log(`Fantasy Farm running at http://localhost:${PORT}`);
});
