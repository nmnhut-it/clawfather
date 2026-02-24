import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers';

test.beforeEach(async ({ page }) => {
  await setupTestPage(page);
});

/** Call LLMPlayer.parseMove in the browser context */
async function parseMove(page: import('@playwright/test').Page, text: string) {
  return page.evaluate((t) => {
    const player = new (window as any).LLMPlayer('X', null);
    return player.parseMove(t);
  }, text);
}

// ── Valid parsing ────────────────────────────────────────────────────

test.describe('LLMPlayer.parseMove — valid', () => {
  test('parses "3,4"', async ({ page }) => {
    const move = await parseMove(page, '3,4');
    expect(move).toEqual({ row: 3, col: 4 });
  });

  test('parses "3, 4" with space after comma', async ({ page }) => {
    const move = await parseMove(page, '3, 4');
    expect(move).toEqual({ row: 3, col: 4 });
  });

  test('parses "3 4" space-separated', async ({ page }) => {
    const move = await parseMove(page, '3 4');
    expect(move).toEqual({ row: 3, col: 4 });
  });

  test('parses two-digit coords "12,13"', async ({ page }) => {
    const move = await parseMove(page, '12,13');
    expect(move).toEqual({ row: 12, col: 13 });
  });

  test('parses coords embedded in verbose text', async ({ page }) => {
    const move = await parseMove(
      page,
      'I think the best move is 7,8 because it blocks the opponent.',
    );
    expect(move).toEqual({ row: 7, col: 8 });
  });
});

// ── Invalid parsing ──────────────────────────────────────────────────

test.describe('LLMPlayer.parseMove — invalid', () => {
  test('empty string returns null', async ({ page }) => {
    const move = await parseMove(page, '');
    expect(move).toBeNull();
  });

  test('no digits returns null', async ({ page }) => {
    const move = await parseMove(page, 'no numbers here');
    expect(move).toBeNull();
  });

  test('single number returns null', async ({ page }) => {
    const move = await parseMove(page, '5');
    expect(move).toBeNull();
  });
});
