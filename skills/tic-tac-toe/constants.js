/**
 * Tic Tac Toe - constants, enums, and configuration.
 * All game literals centralized here to avoid magic strings/numbers.
 */

const BOARD_SIZE = 3;

const PLAYERS = Object.freeze({
  P1: "p1",
  P2: "p2",
});

const MARKERS = Object.freeze({
  [PLAYERS.P1]: "X",
  [PLAYERS.P2]: "O",
});

const GAME_PHASES = Object.freeze({
  WAITING_FOR_PLAYER: "WAITING_FOR_PLAYER",
  END_GAME: "END_GAME",
});

/** All eight winning lines as [row, col] triples */
const WIN_LINES = Object.freeze([
  // Rows
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  // Columns
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  // Diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
]);

const ACTIONS = Object.freeze({
  MOVE: "move",
  NEW_GAME: "new-game",
});

/** Regex for parsing bot move responses: MOVE row=<0|1|2> col=<0|1|2> */
const MOVE_PATTERN = /MOVE\s+row=([0-2])\s+col=([0-2])/i;

const MAX_MOVES = BOARD_SIZE * BOARD_SIZE;

const DEFAULT_PORT = 3001;

const PORT_ENV_KEY = "TTT_PORT";

module.exports = {
  BOARD_SIZE,
  PLAYERS,
  MARKERS,
  GAME_PHASES,
  WIN_LINES,
  ACTIONS,
  MOVE_PATTERN,
  MAX_MOVES,
  DEFAULT_PORT,
  PORT_ENV_KEY,
};
