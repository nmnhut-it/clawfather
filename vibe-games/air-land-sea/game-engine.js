/**
 * Air, Land & Sea - Game engine.
 * State machine managing battles, card play, abilities, and scoring.
 * Two players (p1 = human, p2 = bot/PicoClaw) interact via playCard/withdraw.
 */

const {
  THEATERS, PLAYERS, DURATION, GAME_STATES,
  FACEDOWN_STRENGTH, WIN_SCORE, BATTLE_SCORE, HAND_SIZE,
  CARD_DEFINITIONS, getCardDisplayName,
} = require("./cards");

const THEATER_ORDER = [THEATERS.AIR, THEATERS.LAND, THEATERS.SEA];

class GameEngine {
  constructor() {
    this.state = null;
    this.newGame();
  }

  // --- Game lifecycle ---

  newGame() {
    this.state = {
      theaterOrder: this._shuffled(THEATER_ORDER),
      board: this._emptyBoard(),
      hands: { [PLAYERS.P1]: [], [PLAYERS.P2]: [] },
      deck: [],
      currentPlayer: PLAYERS.P1,
      firstPlayer: PLAYERS.P1,
      scores: { [PLAYERS.P1]: 0, [PLAYERS.P2]: 0 },
      phase: GAME_STATES.WAITING_FOR_PLAYER,
      log: [],
      pendingAbility: null,
      flags: {},
    };
    this._startBattle();
    return this.state;
  }

  _startBattle() {
    this.state.board = this._emptyBoard();
    this.state.deck = this._buildShuffledDeck();
    this.state.hands[PLAYERS.P1] = [];
    this.state.hands[PLAYERS.P2] = [];
    this.state.pendingAbility = null;
    this.state.flags = {};
    this.state.phase = GAME_STATES.WAITING_FOR_PLAYER;
    this._dealCards();
    this._log(`Battle starts! ${this.state.firstPlayer.toUpperCase()} goes first.`);
    this._log(`Theaters: ${this.state.theaterOrder.join(" | ").toUpperCase()}`);
  }

  nextBattle() {
    if (this.state.phase !== GAME_STATES.END_BATTLE) return { error: "Not in END_BATTLE phase" };
    this.state.firstPlayer = this._otherPlayer(this.state.firstPlayer);
    this.state.currentPlayer = this.state.firstPlayer;
    this.state.theaterOrder = this._shuffled(THEATER_ORDER);
    this._startBattle();
    return { ok: true };
  }

  // --- Card play ---

  playCard(player, cardIndex, theater, faceUp) {
    const validation = this._validatePlay(player, cardIndex, theater, faceUp);
    if (validation.error) return validation;

    const hand = this.state.hands[player];
    const card = hand[cardIndex];
    const boardCard = this._createBoardCard(card, player, faceUp);

    // Check containment (ongoing): facedown cards are discarded
    if (!faceUp && this._isContainmentActive()) {
      hand.splice(cardIndex, 1);
      this._log(`${player.toUpperCase()} plays facedown — DISCARDED by Containment!`);
      return this._advanceTurn();
    }

    // Check blockade (ongoing): adjacent theater with 3+ cards discards
    if (this._isBlockadeDiscard(theater)) {
      hand.splice(cardIndex, 1);
      this._log(`${player.toUpperCase()} plays to ${theater.toUpperCase()} — DISCARDED by Blockade!`);
      return this._advanceTurn();
    }

    hand.splice(cardIndex, 1);
    this.state.board[theater][player].push(boardCard);

    if (faceUp) {
      this._log(`${player.toUpperCase()} plays ${getCardDisplayName(card)} face-up on ${theater.toUpperCase()}`);
      return this._triggerAbility(boardCard, player, theater);
    }

    this._log(`${player.toUpperCase()} plays facedown on ${theater.toUpperCase()}`);
    return this._advanceTurn();
  }

  // --- Withdrawal ---

  withdraw(player) {
    if (this.state.phase !== GAME_STATES.WAITING_FOR_PLAYER) return { error: "Not your turn phase" };
    if (player !== this.state.currentPlayer) return { error: "Not your turn" };

    const cardsLeft = this.state.hands[player].length;
    const opponent = this._otherPlayer(player);
    const vpAwarded = this._calcWithdrawScore(player, cardsLeft);

    this.state.scores[opponent] += vpAwarded;
    this._log(`${player.toUpperCase()} withdraws with ${cardsLeft} cards. ${opponent.toUpperCase()} scores ${vpAwarded} VP.`);

    return this._endBattle();
  }

  // --- Ability target resolution ---

  resolveAbilityTarget(player, target) {
    const pending = this.state.pendingAbility;
    if (!pending || pending.player !== player) return { error: "No pending ability for this player" };

    const result = this._executeAbilityTarget(pending, target);
    if (result && result.error) return result; // keep pendingAbility so player can retry

    this.state.pendingAbility = null;
    if (pending.ability === "disrupt" && pending.step === "opponent") {
      return this._promptDisruptSelf(player);
    }
    if (pending.extraTurn) return { ok: true, extraTurn: true };
    return this._advanceTurn();
  }

  /** Skip an optional ability (e.g. reinforce, transport) */
  skipAbility(player) {
    const pending = this.state.pendingAbility;
    if (!pending || pending.player !== player) return { error: "No pending ability" };
    this.state.pendingAbility = null;
    this._log(`${player.toUpperCase()} skips ${pending.ability}.`);
    if (pending.extraTurn) return { ok: true, extraTurn: true };
    return this._advanceTurn();
  }

  // --- State queries ---

  getVisibleState(player) {
    const opponent = this._otherPlayer(player);
    return {
      theaterOrder: this.state.theaterOrder,
      board: this._getVisibleBoard(),
      myHand: this.state.hands[player].map((c, i) => ({ ...c, index: i })),
      opponentHandCount: this.state.hands[opponent].length,
      currentPlayer: this.state.currentPlayer,
      firstPlayer: this.state.firstPlayer,
      scores: { ...this.state.scores },
      phase: this.state.phase,
      log: this.state.log.slice(-20),
      pendingAbility: this.state.pendingAbility,
      theaterControl: this._getTheaterControl(),
      theaterStrengths: this._getAllTheaterStrengths(),
      withdrawCost: this._calcWithdrawScore(player, this.state.hands[player].length),
      flags: { ...this.state.flags },
    };
  }

  // --- Private: board helpers ---

  _emptyBoard() {
    const board = {};
    for (const t of THEATER_ORDER) {
      board[t] = { [PLAYERS.P1]: [], [PLAYERS.P2]: [] };
    }
    return board;
  }

  _buildShuffledDeck() {
    const deck = CARD_DEFINITIONS.map((def, id) => ({ ...def, id }));
    return this._shuffled(deck);
  }

  _dealCards() {
    for (let i = 0; i < HAND_SIZE; i++) {
      this.state.hands[PLAYERS.P1].push(this.state.deck.pop());
      this.state.hands[PLAYERS.P2].push(this.state.deck.pop());
    }
  }

  _createBoardCard(card, player, faceUp) {
    return { ...card, owner: player, faceUp };
  }

  // --- Private: validation ---

  _validatePlay(player, cardIndex, theater, faceUp) {
    if (this.state.phase !== GAME_STATES.WAITING_FOR_PLAYER) return { error: "Not in play phase" };
    if (player !== this.state.currentPlayer) return { error: "Not your turn" };
    if (!this.state.hands[player][cardIndex]) return { error: "Invalid card index" };
    if (!THEATER_ORDER.includes(theater)) return { error: "Invalid theater" };

    const card = this.state.hands[player][cardIndex];
    if (faceUp) {
      return this._validateFaceUpPlay(card, player, theater);
    }
    return {};
  }

  _validateFaceUpPlay(card, player, theater) {
    if (card.type === theater) return {};
    // Aerodrome: strength ≤ 3 can go anywhere
    if (card.strength <= 3 && this._isAerodromeActive(player)) return {};
    // Air Drop flag: one-time non-matching play
    if (this.state.flags[`airDrop_${player}`]) return {};
    return { error: `Card must be played to matching theater (${card.type}) unless face-down` };
  }

  // --- Private: turn management ---

  _advanceTurn() {
    // Reset phase to normal play
    this.state.phase = GAME_STATES.WAITING_FOR_PLAYER;

    // Clear one-time air-drop flag after use
    const ap = this.state.currentPlayer;
    if (this.state.flags[`airDrop_${ap}`]) delete this.state.flags[`airDrop_${ap}`];

    this.state.currentPlayer = this._otherPlayer(this.state.currentPlayer);

    // Check if both players are out of cards
    if (this._bothHandsEmpty()) {
      this._log("All cards played — scoring battle.");
      return this._scoreBattle();
    }

    // Skip player if they have no cards (opponent played extra turns)
    if (this.state.hands[this.state.currentPlayer].length === 0) {
      this.state.currentPlayer = this._otherPlayer(this.state.currentPlayer);
      if (this.state.hands[this.state.currentPlayer].length === 0) {
        return this._scoreBattle();
      }
    }

    return { ok: true };
  }

  _bothHandsEmpty() {
    return this.state.hands[PLAYERS.P1].length === 0
      && this.state.hands[PLAYERS.P2].length === 0;
  }

  // --- Private: scoring ---

  _scoreBattle() {
    const control = this._getTheaterControl();
    let p1Wins = 0, p2Wins = 0;
    for (const t of THEATER_ORDER) {
      if (control[t] === PLAYERS.P1) p1Wins++;
      else p2Wins++;
    }

    const winner = p1Wins >= 2 ? PLAYERS.P1 : PLAYERS.P2;
    this.state.scores[winner] += BATTLE_SCORE;
    this._log(`${winner.toUpperCase()} wins the battle! +${BATTLE_SCORE} VP`);

    return this._endBattle();
  }

  _endBattle() {
    if (this.state.scores[PLAYERS.P1] >= WIN_SCORE || this.state.scores[PLAYERS.P2] >= WIN_SCORE) {
      const winner = this.state.scores[PLAYERS.P1] >= WIN_SCORE ? PLAYERS.P1 : PLAYERS.P2;
      this.state.phase = GAME_STATES.END_GAME;
      this._log(`${winner.toUpperCase()} wins the game!`);
      return { ok: true, gameOver: true, winner };
    }
    this.state.phase = GAME_STATES.END_BATTLE;
    return { ok: true, battleOver: true };
  }

  _calcWithdrawScore(player, cardsLeft) {
    const isFirst = player === this.state.firstPlayer;
    if (isFirst) {
      if (cardsLeft >= 4) return 2;
      if (cardsLeft >= 2) return 3;
      if (cardsLeft === 1) return 4;
      return BATTLE_SCORE;
    }
    if (cardsLeft >= 5) return 2;
    if (cardsLeft >= 3) return 3;
    if (cardsLeft === 2) return 4;
    return BATTLE_SCORE;
  }

  // --- Private: theater strength calculation ---

  _getCardStrength(boardCard, player) {
    if (!boardCard.faceUp) {
      return this._isEscalationActive(player) ? 4 : FACEDOWN_STRENGTH;
    }
    return boardCard.strength;
  }

  _getCoverFireStrength(theater, player) {
    const cards = this.state.board[theater][player];
    let total = 0;
    let coverFireActive = false;
    // Cards are in play order; cover fire affects cards UNDER it
    for (let i = cards.length - 1; i >= 0; i--) {
      const c = cards[i];
      if (c.faceUp && c.ability === "cover-fire") {
        coverFireActive = true;
        total += c.strength;
      } else if (coverFireActive) {
        total += 4; // covered cards become strength 4
      } else {
        total += this._getCardStrength(c, player);
      }
    }
    return total;
  }

  _getTheaterStrength(theater, player) {
    const cards = this.state.board[theater][player];
    const hasCoverFire = cards.some((c) => c.faceUp && c.ability === "cover-fire");
    if (hasCoverFire) return this._getCoverFireStrength(theater, player);

    let total = 0;
    for (const c of cards) {
      total += this._getCardStrength(c, player);
    }
    // Support bonus: +3 from adjacent theater
    total += this._getSupportBonus(theater, player);
    return total;
  }

  _getSupportBonus(theater, player) {
    let bonus = 0;
    const adjacent = this._getAdjacentTheaters(theater);
    for (const adjT of adjacent) {
      const adjCards = this.state.board[adjT][player];
      if (adjCards.some((c) => c.faceUp && c.ability === "support")) {
        bonus += 3;
      }
    }
    return bonus;
  }

  _getAllTheaterStrengths() {
    const strengths = {};
    for (const t of THEATER_ORDER) {
      strengths[t] = {
        [PLAYERS.P1]: this._getTheaterStrength(t, PLAYERS.P1),
        [PLAYERS.P2]: this._getTheaterStrength(t, PLAYERS.P2),
      };
    }
    return strengths;
  }

  _getTheaterControl() {
    const control = {};
    for (const t of THEATER_ORDER) {
      const p1Str = this._getTheaterStrength(t, PLAYERS.P1);
      const p2Str = this._getTheaterStrength(t, PLAYERS.P2);
      if (p1Str > p2Str) control[t] = PLAYERS.P1;
      else if (p2Str > p1Str) control[t] = PLAYERS.P2;
      else control[t] = this.state.firstPlayer; // ties go to first player
    }
    return control;
  }

  // --- Private: abilities ---

  _triggerAbility(boardCard, player, theater) {
    if (!boardCard.ability) return this._advanceTurn();

    switch (boardCard.ability) {
      case "support": return this._advanceTurn(); // ongoing, calculated in strength
      case "air-drop": return this._handleAirDrop(player);
      case "maneuver": return this._handleManeuver(player, theater);
      case "aerodrome": return this._advanceTurn(); // ongoing, checked in validation
      case "containment": return this._advanceTurn(); // ongoing, checked in playCard
      case "reinforce": return this._handleReinforce(player, theater);
      case "ambush": return this._handleAmbush(player);
      case "cover-fire": return this._advanceTurn(); // ongoing, calculated in strength
      case "disrupt": return this._handleDisrupt(player);
      case "escalation": return this._advanceTurn(); // ongoing, calculated in strength
      case "transport": return this._handleTransport(player);
      case "redeploy": return this._handleRedeploy(player);
      case "blockade": return this._advanceTurn(); // ongoing, checked in playCard
      default: return this._advanceTurn();
    }
  }

  _handleAirDrop(player) {
    this.state.flags[`airDrop_${player}`] = true;
    this._log("Air Drop! Next card may be played to any theater face-up.");
    return this._advanceTurn();
  }

  _handleManeuver(player, theater) {
    const adjacent = this._getAdjacentTheaters(theater);
    const targets = this._getFlippableCards(adjacent);
    if (targets.length === 0) {
      this._log("Maneuver: no cards to flip.");
      return this._advanceTurn();
    }
    this.state.pendingAbility = { ability: "maneuver", player, targets };
    this.state.phase = GAME_STATES.WAITING_FOR_ABILITY_TARGET;
    return { ok: true, needsTarget: "maneuver", targets };
  }

  _handleAmbush(player) {
    const targets = this._getFlippableCards(THEATER_ORDER);
    if (targets.length === 0) {
      this._log("Ambush: no cards to flip.");
      return this._advanceTurn();
    }
    this.state.pendingAbility = { ability: "ambush", player, targets };
    this.state.phase = GAME_STATES.WAITING_FOR_ABILITY_TARGET;
    return { ok: true, needsTarget: "ambush", targets };
  }

  _handleReinforce(player, theater) {
    if (this.state.deck.length === 0) {
      this._log("Reinforce: deck is empty.");
      return this._advanceTurn();
    }
    const topCard = this.state.deck[this.state.deck.length - 1];
    const adjacent = this._getAdjacentTheaters(theater);
    this.state.pendingAbility = {
      ability: "reinforce", player, topCard, adjacentTheaters: adjacent,
    };
    this.state.phase = GAME_STATES.WAITING_FOR_ABILITY_TARGET;
    return { ok: true, needsTarget: "reinforce", topCard, adjacentTheaters: adjacent };
  }

  _handleDisrupt(player) {
    const opponent = this._otherPlayer(player);
    const opponentCards = this._getFlippableCardsForPlayer(THEATER_ORDER, opponent);
    if (opponentCards.length === 0) {
      this._log("Disrupt: opponent has no cards to flip.");
      return this._advanceTurn();
    }
    this.state.pendingAbility = {
      ability: "disrupt", player, step: "opponent", targets: opponentCards,
    };
    this.state.phase = GAME_STATES.WAITING_FOR_ABILITY_TARGET;
    return { ok: true, needsTarget: "disrupt-opponent", targets: opponentCards };
  }

  _promptDisruptSelf(player) {
    const myCards = this._getFlippableCardsForPlayer(THEATER_ORDER, player);
    if (myCards.length === 0) {
      this._log("Disrupt: you have no cards to flip.");
      return this._advanceTurn();
    }
    this.state.pendingAbility = {
      ability: "disrupt", player, step: "self", targets: myCards,
    };
    this.state.phase = GAME_STATES.WAITING_FOR_ABILITY_TARGET;
    return { ok: true, needsTarget: "disrupt-self", targets: myCards };
  }

  _handleTransport(player) {
    const myCards = this._getMovableCards(player);
    if (myCards.length === 0) {
      this._log("Transport: no cards to move.");
      return this._advanceTurn();
    }
    this.state.pendingAbility = { ability: "transport", player, targets: myCards };
    this.state.phase = GAME_STATES.WAITING_FOR_ABILITY_TARGET;
    return { ok: true, needsTarget: "transport", targets: myCards };
  }

  _handleRedeploy(player) {
    const facedownCards = this._getFacedownCards(player);
    if (facedownCards.length === 0) {
      this._log("Redeploy: no facedown cards to return.");
      return this._advanceTurn();
    }
    this.state.pendingAbility = {
      ability: "redeploy", player, targets: facedownCards, extraTurn: true,
    };
    this.state.phase = GAME_STATES.WAITING_FOR_ABILITY_TARGET;
    return { ok: true, needsTarget: "redeploy", targets: facedownCards };
  }

  // --- Private: ability target execution ---

  _executeAbilityTarget(pending, target) {
    switch (pending.ability) {
      case "maneuver":
      case "ambush":
        return this._flipCard(target.theater, target.cardIndex, target.player);
      case "reinforce":
        return this._executeReinforce(pending, target);
      case "disrupt":
        return this._flipCard(target.theater, target.cardIndex, target.player);
      case "transport":
        return this._executeTransport(pending.player, target);
      case "redeploy":
        return this._executeRedeploy(pending.player, target);
      default:
        return { error: `Unknown ability: ${pending.ability}` };
    }
  }

  _flipCard(theater, cardIndex, targetPlayer) {
    const player = targetPlayer || this._findCardOwner(theater, cardIndex);
    if (!player) return { error: "Invalid card target" };
    const stack = this.state.board[theater][player];
    if (!stack[cardIndex]) return { error: "Invalid card index" };
    stack[cardIndex].faceUp = !stack[cardIndex].faceUp;
    const status = stack[cardIndex].faceUp ? "face-up" : "face-down";
    this._log(`Card flipped in ${theater.toUpperCase()}: now ${status}`);
    this.state.phase = GAME_STATES.WAITING_FOR_PLAYER;
    return {};
  }

  _findCardOwner(theater, cardIndex) {
    for (const p of [PLAYERS.P1, PLAYERS.P2]) {
      if (this.state.board[theater][p][cardIndex]) return p;
    }
    return null;
  }

  _executeReinforce(pending, target) {
    if (target.play && pending.adjacentTheaters.includes(target.theater)) {
      const card = this.state.deck.pop();
      const boardCard = this._createBoardCard(card, pending.player, false);
      this.state.board[target.theater][pending.player].push(boardCard);
      this._log(`Reinforce: played top card facedown to ${target.theater.toUpperCase()}`);
    } else {
      this._log("Reinforce: skipped.");
    }
    this.state.phase = GAME_STATES.WAITING_FOR_PLAYER;
    return {};
  }

  _executeTransport(player, target) {
    const fromTheater = target.fromTheater || target.theater;
    const toTheater = target.toTheater || this._pickTransportDest(player, fromTheater);
    const { cardIndex } = target;
    const stack = this.state.board[fromTheater][player];
    if (!stack[cardIndex]) return { error: "Invalid transport source" };
    if (!toTheater || toTheater === fromTheater) return { error: "Invalid transport destination" };
    const [card] = stack.splice(cardIndex, 1);
    this.state.board[toTheater][player].push(card);
    this._log(`Transport: moved card from ${fromTheater.toUpperCase()} to ${toTheater.toUpperCase()}`);
    this.state.phase = GAME_STATES.WAITING_FOR_PLAYER;
    return {};
  }

  /** Pick best transport destination: theater where player has fewest cards */
  _pickTransportDest(player, fromTheater) {
    const others = this.state.theaterOrder.filter((t) => t !== fromTheater);
    others.sort((a, b) => {
      return this.state.board[a][player].length - this.state.board[b][player].length;
    });
    return others[0];
  }

  _executeRedeploy(player, target) {
    const stack = this.state.board[target.theater][player];
    if (!stack[target.cardIndex] || stack[target.cardIndex].faceUp) {
      return { error: "Must target a facedown card" };
    }
    const [card] = stack.splice(target.cardIndex, 1);
    card.faceUp = false;
    this.state.hands[player].push(card);
    this._log("Redeploy: returned facedown card to hand. Extra turn!");
    this.state.phase = GAME_STATES.WAITING_FOR_PLAYER;
    return {};
  }

  // --- Private: ability helpers ---

  _isContainmentActive() {
    for (const t of THEATER_ORDER) {
      for (const p of [PLAYERS.P1, PLAYERS.P2]) {
        if (this.state.board[t][p].some((c) => c.faceUp && c.ability === "containment")) {
          return true;
        }
      }
    }
    return false;
  }

  _isBlockadeDiscard(theater) {
    const adjacent = this._getAdjacentTheaters(theater);
    for (const adjT of adjacent) {
      for (const p of [PLAYERS.P1, PLAYERS.P2]) {
        if (!this.state.board[adjT][p].some((c) => c.faceUp && c.ability === "blockade")) continue;
        const totalCards = this.state.board[theater][PLAYERS.P1].length
          + this.state.board[theater][PLAYERS.P2].length;
        if (totalCards >= 3) return true;
      }
    }
    return false;
  }

  _isEscalationActive(player) {
    for (const t of THEATER_ORDER) {
      if (this.state.board[t][player].some((c) => c.faceUp && c.ability === "escalation")) {
        return true;
      }
    }
    return false;
  }

  _isAerodromeActive(player) {
    for (const t of THEATER_ORDER) {
      if (this.state.board[t][player].some((c) => c.faceUp && c.ability === "aerodrome")) {
        return true;
      }
    }
    return false;
  }

  _getFlippableCards(theaters) {
    const targets = [];
    for (const t of theaters) {
      for (const p of [PLAYERS.P1, PLAYERS.P2]) {
        const stack = this.state.board[t][p];
        if (stack.length > 0) {
          const top = stack[stack.length - 1];
          targets.push({ theater: t, player: p, cardIndex: stack.length - 1, faceUp: top.faceUp });
        }
      }
    }
    return targets;
  }

  _getFlippableCardsForPlayer(theaters, player) {
    const targets = [];
    for (const t of theaters) {
      const stack = this.state.board[t][player];
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        targets.push({ theater: t, player, cardIndex: stack.length - 1, faceUp: top.faceUp });
      }
    }
    return targets;
  }

  _getMovableCards(player) {
    const cards = [];
    for (const t of THEATER_ORDER) {
      const stack = this.state.board[t][player];
      stack.forEach((c, i) => cards.push({ theater: t, cardIndex: i, card: c }));
    }
    return cards;
  }

  _getFacedownCards(player) {
    const cards = [];
    for (const t of THEATER_ORDER) {
      const stack = this.state.board[t][player];
      stack.forEach((c, i) => {
        if (!c.faceUp) cards.push({ theater: t, cardIndex: i });
      });
    }
    return cards;
  }

  // --- Private: theater adjacency ---

  _getAdjacentTheaters(theater) {
    const idx = this.state.theaterOrder.indexOf(theater);
    const adjacent = [];
    if (idx > 0) adjacent.push(this.state.theaterOrder[idx - 1]);
    if (idx < this.state.theaterOrder.length - 1) adjacent.push(this.state.theaterOrder[idx + 1]);
    return adjacent;
  }

  // --- Private: board visibility ---

  _getVisibleBoard() {
    const visible = {};
    for (const t of THEATER_ORDER) {
      visible[t] = {};
      for (const p of [PLAYERS.P1, PLAYERS.P2]) {
        visible[t][p] = this.state.board[t][p].map((c) => {
          if (c.faceUp) return { ...c };
          return { faceUp: false, owner: c.owner };
        });
      }
    }
    return visible;
  }

  // --- Private: utilities ---

  _otherPlayer(player) {
    return player === PLAYERS.P1 ? PLAYERS.P2 : PLAYERS.P1;
  }

  _shuffled(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  _log(msg) {
    this.state.log.push(msg);
  }
}

module.exports = GameEngine;
