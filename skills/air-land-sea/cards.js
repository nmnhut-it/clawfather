/**
 * Air, Land & Sea - Card definitions and game constants.
 * 18 battle cards (6 per theater), each with type, strength, ability, and duration.
 * Reference: github.com/jorisbontje/AirLandSea
 */

const THEATERS = Object.freeze({ AIR: "air", LAND: "land", SEA: "sea" });
const PLAYERS = Object.freeze({ P1: "p1", P2: "p2" });
const DURATION = Object.freeze({ INSTANT: "instant", ONGOING: "ongoing", NONE: "none" });

const GAME_STATES = Object.freeze({
  WAITING_FOR_PLAYER: "WAITING_FOR_PLAYER",
  WAITING_FOR_ABILITY_TARGET: "WAITING_FOR_ABILITY_TARGET",
  END_BATTLE: "END_BATTLE",
  END_GAME: "END_GAME",
});

const FACEDOWN_STRENGTH = 2;
const WIN_SCORE = 12;
const BATTLE_SCORE = 6;
const HAND_SIZE = 6;

/** All 18 battle cards. Index is used as card ID. */
const CARD_DEFINITIONS = Object.freeze([
  // --- AIR (strength 1-6) ---
  { type: THEATERS.AIR, strength: 1, ability: "support", duration: DURATION.ONGOING,
    description: "You gain +3 strength in each adjacent theater." },
  { type: THEATERS.AIR, strength: 2, ability: "air-drop", duration: DURATION.INSTANT,
    description: "On your next turn, you may play a card to a non-matching theater." },
  { type: THEATERS.AIR, strength: 3, ability: "maneuver", duration: DURATION.INSTANT,
    description: "Flip a card in an adjacent theater." },
  { type: THEATERS.AIR, strength: 4, ability: "aerodrome", duration: DURATION.ONGOING,
    description: "You may play cards of strength 3 or less to non-matching theaters." },
  { type: THEATERS.AIR, strength: 5, ability: "containment", duration: DURATION.ONGOING,
    description: "If either player plays a card facedown, discard that card with no effect." },
  { type: THEATERS.AIR, strength: 6, ability: null, duration: DURATION.NONE,
    description: "Heavy Bombers. No tactical ability." },

  // --- LAND (strength 1-6) ---
  { type: THEATERS.LAND, strength: 1, ability: "reinforce", duration: DURATION.INSTANT,
    description: "Look at the top card of the deck. You may play it facedown to an adjacent theater." },
  { type: THEATERS.LAND, strength: 2, ability: "ambush", duration: DURATION.INSTANT,
    description: "Flip a card in any theater." },
  { type: THEATERS.LAND, strength: 3, ability: "maneuver", duration: DURATION.INSTANT,
    description: "Flip a card in an adjacent theater." },
  { type: THEATERS.LAND, strength: 4, ability: "cover-fire", duration: DURATION.ONGOING,
    description: "All cards covered by this card are now strength 4." },
  { type: THEATERS.LAND, strength: 5, ability: "disrupt", duration: DURATION.INSTANT,
    description: "Your opponent chooses and flips 1 of their cards. Then you flip 1 of yours." },
  { type: THEATERS.LAND, strength: 6, ability: null, duration: DURATION.NONE,
    description: "Heavy Tanks. No tactical ability." },

  // --- SEA (strength 1-6) ---
  { type: THEATERS.SEA, strength: 1, ability: "transport", duration: DURATION.INSTANT,
    description: "You may move 1 of your cards to a different theater." },
  { type: THEATERS.SEA, strength: 2, ability: "escalation", duration: DURATION.ONGOING,
    description: "All of your facedown cards are now strength 4." },
  { type: THEATERS.SEA, strength: 3, ability: "maneuver", duration: DURATION.INSTANT,
    description: "Flip a card in an adjacent theater." },
  { type: THEATERS.SEA, strength: 4, ability: "redeploy", duration: DURATION.INSTANT,
    description: "Return 1 of your facedown cards to your hand. If you do, gain an extra turn." },
  { type: THEATERS.SEA, strength: 5, ability: "blockade", duration: DURATION.ONGOING,
    description: "If a card is played in an adjacent theater with 3+ cards, discard that card." },
  { type: THEATERS.SEA, strength: 6, ability: null, duration: DURATION.NONE,
    description: "Battleship. No tactical ability." },
]);

/** Card display name: e.g. "AIR 3 - Maneuver" */
function getCardDisplayName(card) {
  const abilityName = card.ability
    ? card.ability.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : card.description.split(".")[0];
  return `${card.type.toUpperCase()} ${card.strength} - ${abilityName}`;
}

module.exports = {
  THEATERS, PLAYERS, DURATION, GAME_STATES,
  FACEDOWN_STRENGTH, WIN_SCORE, BATTLE_SCORE, HAND_SIZE,
  CARD_DEFINITIONS, getCardDisplayName,
};
