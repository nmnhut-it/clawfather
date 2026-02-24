/**
 * Tic Tac Toe - game engine.
 * Manages board state, move validation, win/draw detection.
 * Pattern follows ALS GameEngine: constructor calls newGame(), returns {ok, error} from actions.
 */

const {
  BOARD_SIZE, PLAYERS, MARKERS, GAME_PHASES, WIN_LINES, MAX_MOVES,
} = require("./constants");

class GameEngine {
  constructor() {
    this.newGame();
  }

  /** Reset to a fresh game. Returns visible state for P1. */
  newGame() {
    this.board = createEmptyBoard();
    this.currentPlayer = PLAYERS.P1;
    this.phase = GAME_PHASES.WAITING_FOR_PLAYER;
    this.winner = null;
    this.isDraw = false;
    this.winLine = null;
    this.moveCount = 0;
    this.log = [];
    this._log("New game started");
    return this.getVisibleState(PLAYERS.P1);
  }

  /**
   * Place a marker at (row, col) for the given player.
   * Returns {ok, error} following ALS pattern.
   */
  makeMove(player, row, col) {
    const error = this._validateMove(player, row, col);
    if (error) return { ok: false, error };

    this.board[row][col] = player;
    this.moveCount++;
    this._log(`${player} (${MARKERS[player]}) plays row=${row} col=${col}`);

    this._checkEndCondition(player);
    if (this.phase !== GAME_PHASES.END_GAME) {
      this.currentPlayer = swapPlayer(this.currentPlayer);
    }

    return { ok: true };
  }

  /** Returns game state visible to the given player, with marker info. */
  getVisibleState(player) {
    return {
      board: this.board.map((row) => [...row]),
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      winner: this.winner,
      isDraw: this.isDraw,
      winLine: this.winLine,
      moveCount: this.moveCount,
      myMarker: MARKERS[player] || MARKERS[PLAYERS.P1],
      opponentMarker: MARKERS[swapPlayer(player)] || MARKERS[PLAYERS.P2],
      log: [...this.log],
    };
  }

  /** Validate move; returns error string or null if valid. */
  _validateMove(player, row, col) {
    if (this.phase === GAME_PHASES.END_GAME) {
      return "Game is over. Start a new game.";
    }
    if (player !== this.currentPlayer) {
      return `Not your turn. Waiting for ${this.currentPlayer}.`;
    }
    if (!isValidCoord(row) || !isValidCoord(col)) {
      return `Invalid position: row=${row} col=${col}. Must be 0-${BOARD_SIZE - 1}.`;
    }
    if (this.board[row][col] !== null) {
      return `Cell (${row},${col}) is already occupied.`;
    }
    return null;
  }

  /** Check if the last move by player caused a win or draw. */
  _checkEndCondition(player) {
    const line = this._findWinLine(player);
    if (line) {
      this.winner = player;
      this.winLine = line;
      this.phase = GAME_PHASES.END_GAME;
      this._log(`${player} (${MARKERS[player]}) wins!`);
      return;
    }
    if (this.moveCount >= MAX_MOVES) {
      this.isDraw = true;
      this.phase = GAME_PHASES.END_GAME;
      this._log("Game is a draw.");
    }
  }

  /** Returns the winning line if player has one, or null. */
  _findWinLine(player) {
    for (const line of WIN_LINES) {
      const allMatch = line.every(([r, c]) => this.board[r][c] === player);
      if (allMatch) return line;
    }
    return null;
  }

  _log(msg) {
    this.log.push(msg);
  }
}

/** Create a BOARD_SIZE x BOARD_SIZE board of nulls. */
function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

function isValidCoord(n) {
  return Number.isInteger(n) && n >= 0 && n < BOARD_SIZE;
}

function swapPlayer(p) {
  return p === PLAYERS.P1 ? PLAYERS.P2 : PLAYERS.P1;
}

module.exports = GameEngine;
