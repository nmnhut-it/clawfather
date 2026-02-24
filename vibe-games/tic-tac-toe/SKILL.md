---
name: tic-tac-toe
description: Play one turn of Tic Tac Toe via HTTP API
metadata: {"nanobot":{"emoji":"❌"}}
---

# Tic Tac Toe - Game Player

## When to use

- Called by orchestrator to play one turn of Tic Tac Toe
- Message contains board state (3x3 grid, current player, markers)

## Game Overview

2-player game on a 3x3 grid. P1 is X, P2 is O. Players alternate placing markers. First to get 3 in a row (horizontal, vertical, or diagonal) wins. If all 9 cells are filled with no winner, it's a draw.

## Response Format

Reply with EXACTLY one line - no explanation, no reasoning, just the command:

```
MOVE row=<0|1|2> col=<0|1|2>
```

Row 0 is the top row, row 2 is the bottom. Column 0 is left, column 2 is right.

## Board Coordinates

```
       col0 col1 col2
row0 [  .    .    .  ]
row1 [  .    .    .  ]
row2 [  .    .    .  ]
```

## Strategy Guide

### Key principles

1. **Take center first.** Row=1 col=1 is the strongest opening - it's part of 4 winning lines.
2. **Take corners.** Corners (0,0), (0,2), (2,0), (2,2) are part of 3 winning lines each.
3. **Block opponent.** If they have 2 in a row, you must block the third cell immediately.
4. **Create forks.** Place to threaten 2 winning lines at once - opponent can only block one.
5. **Don't ignore threats.** Always check if opponent has 2 in a line before making an offensive move.

### Priority order

1. **Win:** If you can complete 3 in a row, do it.
2. **Block:** If opponent has 2 in a row, block the empty cell.
3. **Fork:** Create two threats at once.
4. **Center:** Take center if available.
5. **Opposite corner:** If opponent has a corner, take the opposite corner.
6. **Any corner:** Take any empty corner.
7. **Any edge:** Take any empty edge (row=0 col=1, row=1 col=0, row=1 col=2, row=2 col=1).

## Execution

The orchestrator script handles API calls. Your only job: output the structured command.
