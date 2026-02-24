import { Page } from '@playwright/test';
import { DEFAULT_BOARD_SIZE, DEFAULT_WIN_CONDITION } from './constants';

/** Serializable snapshot of game state returned from page context */
export interface GameState {
  board: (string | null)[][];
  winner: string | null;
  gameOver: boolean;
  currentPlayer: string;
  moves: { player: string; row: number; col: number; moveNumber: number }[];
  winCells: [number, number][];
}

/**
 * Prepare the page for testing: expose game classes on window,
 * capture the GameController instance, clear localStorage, navigate.
 * Must be called BEFORE any game interaction in each test.
 */
export async function setupTestPage(page: Page): Promise<void> {
  await page.addInitScript(`
    try { localStorage.clear(); } catch(e) {}

    document.addEventListener('DOMContentLoaded', function() {
      /* Expose classes on window so page.evaluate() can access them */
      window.CaroGame = CaroGame;
      window.LLMPlayer = LLMPlayer;

      /* Wrap GameController to capture the singleton instance */
      var OrigGameController = GameController;
      GameController = class extends OrigGameController {
        constructor() {
          super();
          window.__gameController = this;
        }
      };
    });
  `);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
}

/** Create a CaroGame instance and store it on window.__testGame */
export async function createGame(
  page: Page,
  size = DEFAULT_BOARD_SIZE,
  winCondition = DEFAULT_WIN_CONDITION,
): Promise<void> {
  await page.evaluate(
    ({ s, w }) => {
      (window as any).__testGame = new (window as any).CaroGame(s, w);
    },
    { s: size, w: winCondition },
  );
}

/** Execute a single move and return whether it succeeded */
export async function makeMove(
  page: Page,
  row: number,
  col: number,
): Promise<boolean> {
  return page.evaluate(
    ({ r, c }) => (window as any).__testGame.makeMove(r, c),
    { r: row, c: col },
  );
}

/** Return a serializable snapshot of the current game state */
export async function getGameState(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    const g = (window as any).__testGame;
    return {
      board: g.board,
      winner: g.winner,
      gameOver: g.gameOver,
      currentPlayer: g.currentPlayer,
      moves: g.moves,
      winCells: g.winCells,
    };
  });
}

/** Play a sequence of [row, col] moves and return the final state */
export async function playMoveSequence(
  page: Page,
  moves: [number, number][],
): Promise<GameState> {
  return page.evaluate((mvs) => {
    const g = (window as any).__testGame;
    for (const [r, c] of mvs) {
      g.makeMove(r, c);
    }
    return {
      board: g.board,
      winner: g.winner,
      gameOver: g.gameOver,
      currentPlayer: g.currentPlayer,
      moves: g.moves,
      winCells: g.winCells,
    };
  }, moves);
}

/** Build a data-attribute selector for a board cell */
export function cellSelector(row: number, col: number): string {
  return `[data-row="${row}"][data-col="${col}"]`;
}
