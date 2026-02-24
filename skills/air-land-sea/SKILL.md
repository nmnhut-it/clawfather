---
name: air-land-sea
description: Play one turn of Air Land Sea card game via HTTP API
metadata: {"nanobot":{"emoji":"🎖️"}}
---

# Air Land Sea - Card Game Player

## When to use

- Called by orchestrator to play one turn of Air Land Sea
- Message contains game state (theaters, hand, strengths, pending ability)

## Game Overview

2-player card game. 18 cards (6 per theater: Air/Land/Sea). Win 2 of 3 theaters to score 6 VP. First to 12 VP wins. You can withdraw early to limit opponent's VP gain.

## Response Format

Reply with EXACTLY one line — no explanation, no reasoning, just the command:

### Playing a card
```
PLAY idx=<cardIndex> theater=<air|land|sea> faceup=<true|false>
```

### Withdrawing
```
WITHDRAW
```

### Resolving an ability target
```
TARGET=<number>
```

### Skipping an optional ability
```
SKIP
```

## Card Rules

### Theaters & Adjacency
Theater order is shuffled each battle. Adjacent = next to each other in the row.
Example order: `SEA | LAND | AIR` — Sea is adjacent to Land, Land is adjacent to Air, Sea is NOT adjacent to Air.

### Playing Cards
- **Face-up**: card type must match theater (Air card to Air theater), UNLESS Aerodrome or Air Drop is active. Ability triggers.
- **Face-down**: playable to ANY theater. Strength = 2. No ability triggers.

### Strength & Control
- Each theater is won by the player with higher total strength
- Ties go to the first player of the battle
- Win 2 of 3 theaters = win the battle (+6 VP)

### Withdrawal Scoring
Withdraw early to limit opponent's VP. Fewer cards left = more VP for opponent:
- First player: 4+ cards left → 2VP, 2-3 → 3VP, 1 → 4VP, 0 → 6VP
- Second player: 5+ cards left → 2VP, 3-4 → 3VP, 2 → 4VP, 0-1 → 6VP

## Card Abilities Reference

### Instant abilities (trigger once when played face-up)
| Card | Str | Ability | Effect |
|------|-----|---------|--------|
| AIR 2 | 2 | Air Drop | Next turn you may play a card face-up to any theater |
| AIR 3 | 3 | Maneuver | Flip any card in an adjacent theater |
| LAND 1 | 1 | Reinforce | Play top deck card face-down to adjacent theater |
| LAND 2 | 2 | Ambush | Flip any card in any theater |
| LAND 3 | 3 | Maneuver | Flip any card in an adjacent theater |
| LAND 5 | 5 | Disrupt | Opponent flips one of theirs, then you flip one of yours |
| SEA 1 | 1 | Transport | Move one of your cards to a different theater |
| SEA 3 | 3 | Maneuver | Flip any card in an adjacent theater |
| SEA 4 | 4 | Redeploy | Return one of your face-down cards to hand, gain extra turn |

### Ongoing abilities (active while card is face-up)
| Card | Str | Ability | Effect |
|------|-----|---------|--------|
| AIR 1 | 1 | Support | +3 strength in each adjacent theater |
| AIR 4 | 4 | Aerodrome | Cards of strength 3 or less can be played face-up to any theater |
| AIR 5 | 5 | Containment | Any card played face-down is discarded immediately |
| LAND 4 | 4 | Cover Fire | All cards below this one in the stack become strength 4 |
| SEA 2 | 2 | Escalation | All your face-down cards become strength 4 |
| SEA 5 | 5 | Blockade | If adjacent theater has 3+ cards, discard any new card played there |

### No ability
| Card | Str | Description |
|------|-----|-------------|
| AIR 6 | 6 | Heavy Bombers — raw strength |
| LAND 6 | 6 | Heavy Tanks — raw strength |
| SEA 6 | 6 | Battleship — raw strength |

## Strategy Guide

### Key principles
1. **Control 2 theaters, not 3.** Focus your strength. Abandon the weakest theater.
2. **Withdraw wisely.** If you're losing 0-3 theaters after 2-3 cards, withdraw early (opponent gets only 2-3 VP instead of 6).
3. **Face-down is powerful.** Costs no ability but adds 2 strength anywhere. With Escalation active, face-down = 4 strength.
4. **Flip abilities are strong.** Maneuver/Ambush: flip opponent's face-up card to face-down (reduces their strength, disables ability). Or flip your face-down to face-up.
5. **Read the board.** If opponent is stacking one theater, consider abandoning it and winning the other two.

### When to WITHDRAW
- You control 0 theaters and opponent has strong board presence
- You've played 2+ cards and losing all 3 theaters
- Withdraw cost is only 2 VP (saves 4 VP vs losing the battle)

### When to play face-down
- Containment is active (face-down cards get discarded!)  — do NOT play face-down
- You need strength in a theater that doesn't match your card type
- Your card's ability wouldn't help the current situation

### Ability target priorities
- **Maneuver/Ambush**: Prefer flipping opponent's face-up cards (disables their abilities, reduces strength). Flip their strongest ongoing abilities first (Support, Cover Fire, Escalation).
- **Disrupt**: Opponent must flip one of theirs — affects their weakest theater. You flip yours in your strongest theater (flip face-down to face-up if beneficial).
- **Transport**: Move a card from a lost theater to a contested one.
- **Redeploy**: Return face-down cards to regain hand cards + extra turn.

## Execution

The orchestrator script handles API calls. Your only job: output the structured command.
