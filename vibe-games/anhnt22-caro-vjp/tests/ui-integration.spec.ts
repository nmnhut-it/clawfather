import { test, expect } from '@playwright/test';
import {
  DEFAULT_BOARD_SIZE,
  SMALL_BOARD_SIZE,
  SELECTORS,
} from './constants';
import { setupTestPage, cellSelector } from './helpers';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

// ── Initial load ─────────────────────────────────────────────────────

test.describe('Initial load', () => {
  test('displays title', async ({ page }) => {
    const title = page.locator(SELECTORS.title);
    await expect(title).toHaveText('Multi-Agent Caro');
  });

  test('shows initial status text', async ({ page }) => {
    const status = page.locator(SELECTORS.statusBar);
    await expect(status).toHaveText('Press "Start Game" to begin');
  });

  test('start enabled, pause and reset disabled', async ({ page }) => {
    await expect(page.locator(SELECTORS.btnStart)).toBeEnabled();
    await expect(page.locator(SELECTORS.btnPause)).toBeDisabled();
    await expect(page.locator(SELECTORS.btnReset)).toBeDisabled();
  });

  test('renders 100 cells for default 10x10 board', async ({ page }) => {
    const cellCount = await page.locator(SELECTORS.cell).count();
    expect(cellCount).toBe(DEFAULT_BOARD_SIZE * DEFAULT_BOARD_SIZE);
  });

  test('board labels show 0 through 9', async ({ page }) => {
    const topLabels = page.locator(`${SELECTORS.labelsTop} span`);
    const leftLabels = page.locator(`${SELECTORS.labelsLeft} span`);

    expect(await topLabels.count()).toBe(DEFAULT_BOARD_SIZE);
    expect(await leftLabels.count()).toBe(DEFAULT_BOARD_SIZE);
    await expect(topLabels.first()).toHaveText('0');
    await expect(topLabels.last()).toHaveText('9');
  });
});

// ── Settings modal ───────────────────────────────────────────────────

test.describe('Settings modal', () => {
  test('opens on button click', async ({ page }) => {
    await page.click(SELECTORS.btnSettings);
    const overlay = page.locator(SELECTORS.settingsOverlay);
    await expect(overlay).toHaveClass(/open/);
  });

  test('Cancel closes modal', async ({ page }) => {
    await page.click(SELECTORS.btnSettings);
    await page.click(SELECTORS.btnSettingsCancel);
    const overlay = page.locator(SELECTORS.settingsOverlay);
    await expect(overlay).not.toHaveClass(/open/);
  });

  test('overlay click closes modal', async ({ page }) => {
    await page.click(SELECTORS.btnSettings);
    const overlay = page.locator(SELECTORS.settingsOverlay);
    /* Click the overlay backdrop (top-left corner) to dismiss */
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).not.toHaveClass(/open/);
  });

  test('Save persists settings and closes modal', async ({ page }) => {
    await page.click(SELECTORS.btnSettings);
    await page.locator(SELECTORS.settingBoardSize).fill('5');
    await page.locator(SELECTORS.settingBoardSize).dispatchEvent('input');
    await page.click(SELECTORS.btnSettingsSave);

    const overlay = page.locator(SELECTORS.settingsOverlay);
    await expect(overlay).not.toHaveClass(/open/);

    const cellCount = await page.locator(SELECTORS.cell).count();
    expect(cellCount).toBe(SMALL_BOARD_SIZE * SMALL_BOARD_SIZE);
  });
});

// ── Board size change ────────────────────────────────────────────────

test.describe('Board size change', () => {
  test('size=5 renders 25 cells with labels 0-4', async ({ page }) => {
    await page.click(SELECTORS.btnSettings);
    await page.locator(SELECTORS.settingBoardSize).fill('5');
    await page.locator(SELECTORS.settingBoardSize).dispatchEvent('input');
    await page.click(SELECTORS.btnSettingsSave);

    const cellCount = await page.locator(SELECTORS.cell).count();
    expect(cellCount).toBe(SMALL_BOARD_SIZE * SMALL_BOARD_SIZE);

    const topLabels = page.locator(`${SELECTORS.labelsTop} span`);
    expect(await topLabels.count()).toBe(SMALL_BOARD_SIZE);
    await expect(topLabels.last()).toHaveText('4');
  });
});

// ── Score display ────────────────────────────────────────────────────

test.describe('Score display', () => {
  test('initial scores are all zero', async ({ page }) => {
    await expect(page.locator(SELECTORS.scoreX)).toHaveText('X: 0');
    await expect(page.locator(SELECTORS.scoreO)).toHaveText('O: 0');
    await expect(page.locator(SELECTORS.scoreDraw)).toHaveText('Draw: 0');
  });
});

// ── Cell CSS classes ─────────────────────────────────────────────────

test.describe('Cell CSS classes', () => {
  test('.x and .o classes after moves', async ({ page }) => {
    await page.evaluate(() => {
      const ctrl = (window as any).__gameController;
      ctrl.game.makeMove(0, 0);
      ctrl.game.makeMove(0, 1);
      ctrl.updateBoardUI();
    });

    const cellX = page.locator(cellSelector(0, 0));
    const cellO = page.locator(cellSelector(0, 1));
    await expect(cellX).toHaveClass(/\bx\b/);
    await expect(cellO).toHaveClass(/\bo\b/);
  });

  test('.last-move class on latest piece', async ({ page }) => {
    await page.evaluate(() => {
      const ctrl = (window as any).__gameController;
      ctrl.game.makeMove(3, 3);
      ctrl.updateBoardUI();
    });

    const cell = page.locator(cellSelector(3, 3));
    await expect(cell).toHaveClass(/last-move/);
  });

  test('.win-cell class on winning cells', async ({ page }) => {
    await page.evaluate(() => {
      const ctrl = (window as any).__gameController;
      const g = ctrl.game;
      g.makeMove(0, 0); g.makeMove(1, 0);
      g.makeMove(0, 1); g.makeMove(1, 1);
      g.makeMove(0, 2); g.makeMove(1, 2);
      g.makeMove(0, 3); g.makeMove(1, 3);
      g.makeMove(0, 4);
      ctrl.updateBoardUI();
    });

    const winCell = page.locator(cellSelector(0, 0));
    await expect(winCell).toHaveClass(/win-cell/);
  });
});

// ── Speed slider ─────────────────────────────────────────────────────

test.describe('Speed slider', () => {
  test('default value is 3000', async ({ page }) => {
    const value = await page.locator(SELECTORS.speedSlider).inputValue();
    expect(value).toBe('3000');
  });

  test('label updates on slider change', async ({ page }) => {
    await page.locator(SELECTORS.speedSlider).fill('1500');
    await page.locator(SELECTORS.speedSlider).dispatchEvent('input');
    await expect(page.locator(SELECTORS.speedLabel)).toHaveText('1500ms');
  });
});
