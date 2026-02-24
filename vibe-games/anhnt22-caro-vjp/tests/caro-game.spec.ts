import { test, expect } from '@playwright/test';
import {
  DEFAULT_BOARD_SIZE,
  DEFAULT_WIN_CONDITION,
  SMALL_BOARD_SIZE,
  SMALL_WIN_CONDITION,
  Player,
  SCORE_THRESHOLDS,
} from './constants';
import {
  setupTestPage,
  createGame,
  makeMove,
  getGameState,
  playMoveSequence,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

// ── Constructor / Reset ──────────────────────────────────────────────

test.describe('Constructor and Reset', () => {
  test('creates default 10x10 board', async ({ page }) => {
    await createGame(page);
    const state = await getGameState(page);

    expect(state.board.length).toBe(DEFAULT_BOARD_SIZE);
    expect(state.board[0].length).toBe(DEFAULT_BOARD_SIZE);
    expect(state.currentPlayer).toBe(Player.X);
    expect(state.gameOver).toBe(false);
    expect(state.winner).toBeNull();
    expect(state.moves).toHaveLength(0);
  });

  test('creates custom-size board', async ({ page }) => {
    await createGame(page, SMALL_BOARD_SIZE, SMALL_WIN_CONDITION);
    const state = await getGameState(page);

    expect(state.board.length).toBe(SMALL_BOARD_SIZE);
    expect(state.board[0].length).toBe(SMALL_BOARD_SIZE);
  });

  test('reset clears all state', async ({ page }) => {
    await createGame(page);
    await makeMove(page, 0, 0);
    await page.evaluate(() => (window as any).__testGame.reset());
    const state = await getGameState(page);

    expect(state.board[0][0]).toBeNull();
    expect(state.currentPlayer).toBe(Player.X);
    expect(state.moves).toHaveLength(0);
    expect(state.gameOver).toBe(false);
  });
});

// ── isValidMove ──────────────────────────────────────────────────────

test.describe('isValidMove', () => {
  test('empty cell is valid', async ({ page }) => {
    await createGame(page);
    const valid = await page.evaluate(() =>
      (window as any).__testGame.isValidMove(0, 0),
    );
    expect(valid).toBe(true);
  });

  test('occupied cell is invalid', async ({ page }) => {
    await createGame(page);
    await makeMove(page, 0, 0);
    const valid = await page.evaluate(() =>
      (window as any).__testGame.isValidMove(0, 0),
    );
    expect(valid).toBe(false);
  });

  test('out-of-bounds is invalid', async ({ page }) => {
    await createGame(page);
    const results = await page.evaluate(() => {
      const g = (window as any).__testGame;
      return [
        g.isValidMove(-1, 0),
        g.isValidMove(0, -1),
        g.isValidMove(10, 0),
        g.isValidMove(0, 10),
      ];
    });
    expect(results.every((r: boolean) => r === false)).toBe(true);
  });
});

// ── makeMove ─────────────────────────────────────────────────────────

test.describe('makeMove', () => {
  test('places piece and alternates player', async ({ page }) => {
    await createGame(page);
    const result = await makeMove(page, 0, 0);
    expect(result).toBe(true);

    const state = await getGameState(page);
    expect(state.board[0][0]).toBe(Player.X);
    expect(state.currentPlayer).toBe(Player.O);
  });

  test('rejects move on occupied cell', async ({ page }) => {
    await createGame(page);
    await makeMove(page, 0, 0);
    const result = await makeMove(page, 0, 0);
    expect(result).toBe(false);
  });

  test('rejects move after game over', async ({ page }) => {
    await createGame(page, SMALL_BOARD_SIZE, SMALL_WIN_CONDITION);
    /* X wins: (0,0),(1,0),(0,1),(1,1),(0,2) */
    await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
      [0, 2],
    ]);
    const result = await makeMove(page, 2, 2);
    expect(result).toBe(false);
  });

  test('records move history', async ({ page }) => {
    await createGame(page);
    await makeMove(page, 3, 4);
    await makeMove(page, 5, 6);
    const state = await getGameState(page);

    expect(state.moves).toHaveLength(2);
    expect(state.moves[0]).toMatchObject({
      player: Player.X, row: 3, col: 4, moveNumber: 1,
    });
    expect(state.moves[1]).toMatchObject({
      player: Player.O, row: 5, col: 6, moveNumber: 2,
    });
  });
});

// ── checkWin — Horizontal ────────────────────────────────────────────

test.describe('checkWin — Horizontal', () => {
  test('5-in-a-row at left edge', async ({ page }) => {
    await createGame(page);
    /* X: row 0, cols 0-4; O: row 1, cols 0-3 */
    const state = await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
      [0, 2], [1, 2],
      [0, 3], [1, 3],
      [0, 4],
    ]);
    expect(state.winner).toBe(Player.X);
    expect(state.winCells.length).toBeGreaterThanOrEqual(DEFAULT_WIN_CONDITION);
  });

  test('5-in-a-row at right edge', async ({ page }) => {
    await createGame(page);
    /* X: row 0, cols 5-9; O: row 1, cols 5-8 */
    const state = await playMoveSequence(page, [
      [0, 5], [1, 5],
      [0, 6], [1, 6],
      [0, 7], [1, 7],
      [0, 8], [1, 8],
      [0, 9],
    ]);
    expect(state.winner).toBe(Player.X);
  });
});

// ── checkWin — Vertical ──────────────────────────────────────────────

test.describe('checkWin — Vertical', () => {
  test('5-in-a-col at top', async ({ page }) => {
    await createGame(page);
    /* X: rows 0-4, col 0; O: rows 0-3, col 1 */
    const state = await playMoveSequence(page, [
      [0, 0], [0, 1],
      [1, 0], [1, 1],
      [2, 0], [2, 1],
      [3, 0], [3, 1],
      [4, 0],
    ]);
    expect(state.winner).toBe(Player.X);
  });

  test('5-in-a-col at bottom', async ({ page }) => {
    await createGame(page);
    /* X: rows 5-9, col 0; O: rows 5-8, col 1 */
    const state = await playMoveSequence(page, [
      [5, 0], [5, 1],
      [6, 0], [6, 1],
      [7, 0], [7, 1],
      [8, 0], [8, 1],
      [9, 0],
    ]);
    expect(state.winner).toBe(Player.X);
  });
});

// ── checkWin — Diagonal ──────────────────────────────────────────────

test.describe('checkWin — Diagonal', () => {
  test('down-right diagonal (1,1)', async ({ page }) => {
    await createGame(page);
    /* X on main diagonal 0-4; O on row 9 */
    const state = await playMoveSequence(page, [
      [0, 0], [9, 0],
      [1, 1], [9, 1],
      [2, 2], [9, 2],
      [3, 3], [9, 3],
      [4, 4],
    ]);
    expect(state.winner).toBe(Player.X);
  });

  test('up-right diagonal (1,-1)', async ({ page }) => {
    await createGame(page);
    /* X on anti-diagonal: (4,0),(3,1),(2,2),(1,3),(0,4); O on row 9 */
    const state = await playMoveSequence(page, [
      [4, 0], [9, 0],
      [3, 1], [9, 1],
      [2, 2], [9, 2],
      [1, 3], [9, 3],
      [0, 4],
    ]);
    expect(state.winner).toBe(Player.X);
  });
});

// ── checkWin — Edge cases ────────────────────────────────────────────

test.describe('checkWin — Edge cases', () => {
  test('4-in-a-row does not win', async ({ page }) => {
    await createGame(page);
    /* X: row 0, cols 0-3 only; O: row 1, cols 0-3 */
    const state = await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
      [0, 2], [1, 2],
      [0, 3], [1, 3],
    ]);
    expect(state.winner).toBeNull();
    expect(state.gameOver).toBe(false);
  });

  test('win when piece placed mid-line', async ({ page }) => {
    await createGame(page);
    /* X places 0,2 last to complete row 0 cols 0-4 */
    const state = await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
      [0, 3], [1, 3],
      [0, 4], [1, 4],
      [0, 2],
    ]);
    expect(state.winner).toBe(Player.X);
  });

  test('win at board corner (0,0) diagonal', async ({ page }) => {
    await createGame(page, SMALL_BOARD_SIZE, SMALL_WIN_CONDITION);
    /* 3-in-a-row diagonal from corner on 5x5 board */
    const state = await playMoveSequence(page, [
      [0, 0], [0, 1],
      [1, 1], [0, 2],
      [2, 2],
    ]);
    expect(state.winner).toBe(Player.X);
  });
});

// ── Draw ─────────────────────────────────────────────────────────────

test.describe('Draw', () => {
  test('full 3x3 board with winCondition=4 is a draw', async ({ page }) => {
    await createGame(page, 3, 4);
    /* Fill entire 3x3 board — no 4-in-a-row possible */
    const state = await playMoveSequence(page, [
      [0, 0], [0, 1], [0, 2],
      [1, 1], [1, 0], [1, 2],
      [2, 1], [2, 0], [2, 2],
    ]);
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBeNull();
  });
});

// ── Text outputs ─────────────────────────────────────────────────────

test.describe('Text outputs', () => {
  test('boardToText contains header and row indices', async ({ page }) => {
    await createGame(page, SMALL_BOARD_SIZE, SMALL_WIN_CONDITION);
    const text: string = await page.evaluate(() =>
      (window as any).__testGame.boardToText(),
    );
    /* Header should contain column indices 0-4 */
    expect(text).toContain('0');
    expect(text).toContain('4');
    /* Empty cells shown as dots */
    expect(text).toContain('.');
  });

  test('lastMoveText describes the last move', async ({ page }) => {
    await createGame(page);
    await makeMove(page, 3, 7);
    const text: string = await page.evaluate(() =>
      (window as any).__testGame.lastMoveText(),
    );
    expect(text).toContain('Move #1');
    expect(text).toContain('Player X');
    expect(text).toContain('3');
    expect(text).toContain('7');
  });

  test('moveHistoryText lists all moves', async ({ page }) => {
    await createGame(page);
    await makeMove(page, 0, 0);
    await makeMove(page, 1, 1);
    const text: string = await page.evaluate(() =>
      (window as any).__testGame.moveHistoryText(),
    );
    expect(text).toContain('#1');
    expect(text).toContain('#2');
    expect(text).toContain('X');
    expect(text).toContain('O');
  });
});

// ── _scoreLine ───────────────────────────────────────────────────────

test.describe('_scoreLine', () => {
  test('instant win scores 1M', async ({ page }) => {
    await createGame(page);
    /* Place 4 X pieces in a row, leave cell (0,4) empty */
    await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
      [0, 2], [1, 2],
      [0, 3], [1, 3],
    ]);
    const score = await page.evaluate(() => {
      const g = (window as any).__testGame;
      return g._scoreLine(0, 4, 0, 1, 'X').score;
    });
    expect(score).toBe(SCORE_THRESHOLDS.instantWin);
  });

  test('4 open two ends scores 50K', async ({ page }) => {
    await createGame(page);
    /* X at (0,1),(0,2),(0,3); placing at (0,4) gives 4 with 2 open ends */
    await playMoveSequence(page, [
      [0, 1], [1, 0],
      [0, 2], [1, 1],
      [0, 3], [1, 2],
    ]);
    const result = await page.evaluate(() => {
      const g = (window as any).__testGame;
      return g._scoreLine(0, 4, 0, 1, 'X');
    });
    expect(result.score).toBe(SCORE_THRESHOLDS.fourOpenTwoEnds);
  });

  test('blocked line scores 0', async ({ page }) => {
    await createGame(page);
    /* X at (0,0); O blocks at (0,2); test X at (0,1) → space < winCondition */
    await playMoveSequence(page, [
      [0, 0], [0, 2],
    ]);
    const score = await page.evaluate(() => {
      const g = (window as any).__testGame;
      return g._scoreLine(0, 1, 0, 1, 'X').score;
    });
    expect(score).toBe(SCORE_THRESHOLDS.blocked);
  });
});

// ── scoreAllMoves ────────────────────────────────────────────────────

test.describe('scoreAllMoves', () => {
  test('first move prefers center', async ({ page }) => {
    await createGame(page);
    const topMove = await page.evaluate(() => {
      const g = (window as any).__testGame;
      return g.scoreAllMoves('X')[0];
    });
    const center = Math.floor(DEFAULT_BOARD_SIZE / 2);
    expect(topMove.row).toBe(center);
    expect(topMove.col).toBe(center);
  });

  test('detects winning move as top-ranked', async ({ page }) => {
    await createGame(page);
    /* X has 4-in-a-row at (0,0)-(0,3), needs (0,4) to win */
    await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
      [0, 2], [1, 2],
      [0, 3], [1, 3],
    ]);
    const topMove = await page.evaluate(() => {
      const g = (window as any).__testGame;
      return g.scoreAllMoves('X')[0];
    });
    expect(topMove.row).toBe(0);
    expect(topMove.col).toBe(4);
    expect(topMove.attack).toBeGreaterThanOrEqual(SCORE_THRESHOLDS.instantWin);
  });

  test('detects must-block opponent', async ({ page }) => {
    await createGame(page, SMALL_BOARD_SIZE, SMALL_WIN_CONDITION);
    /* O has 2-in-a-row at (1,0)-(1,1); X should block */
    await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 4], [1, 1],
    ]);
    const topMove = await page.evaluate(() => {
      const g = (window as any).__testGame;
      return g.scoreAllMoves('X')[0];
    });
    expect(topMove.defend).toBeGreaterThan(0);
  });
});

// ── getTacticalAdvice ────────────────────────────────────────────────

test.describe('getTacticalAdvice', () => {
  test('contains WINNING MOVE text when win available', async ({ page }) => {
    await createGame(page);
    await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 1], [1, 1],
      [0, 2], [1, 2],
      [0, 3], [1, 3],
    ]);
    const advice: string = await page.evaluate(() =>
      (window as any).__testGame.getTacticalAdvice('X'),
    );
    expect(advice).toContain('WINNING MOVE');
  });

  test('contains MUST BLOCK text when opponent threatens', async ({ page }) => {
    await createGame(page);
    /* O has 4-in-a-row: (1,0)-(1,3); X must block (1,4) */
    await playMoveSequence(page, [
      [0, 0], [1, 0],
      [0, 5], [1, 1],
      [0, 6], [1, 2],
      [0, 7], [1, 3],
    ]);
    const advice: string = await page.evaluate(() =>
      (window as any).__testGame.getTacticalAdvice('X'),
    );
    expect(advice).toContain('MUST BLOCK');
  });

  test('contains RECOMMENDED MOVES text', async ({ page }) => {
    await createGame(page);
    await makeMove(page, 5, 5);
    const advice: string = await page.evaluate(() =>
      (window as any).__testGame.getTacticalAdvice('O'),
    );
    expect(advice).toContain('RECOMMENDED MOVES');
  });
});
