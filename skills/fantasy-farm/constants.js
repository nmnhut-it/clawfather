/**
 * Fantasy Farm — all game constants.
 * No hardcoded strings elsewhere; import from here.
 */

const SEASONS = Object.freeze({
  SPRING: "spring",
  SUMMER: "summer",
  AUTUMN: "autumn",
  WINTER: "winter",
});

/** Ordered list for season cycling */
const SEASON_ORDER = Object.freeze([
  SEASONS.SPRING,
  SEASONS.SUMMER,
  SEASONS.AUTUMN,
  SEASONS.WINTER,
]);

const RESOURCES = Object.freeze({
  GOLD: "gold",
  WOOD: "wood",
  STONE: "stone",
  MANA: "mana",
});

const CROP_STAGES = Object.freeze({
  EMPTY: "empty",
  SEED: "seed",
  SPROUT: "sprout",
  GROWING: "growing",
  READY: "ready",
  WITHERED: "withered",
});

const GAME_CONFIG = Object.freeze({
  INITIAL_PLOT_COUNT: 4,
  STARTING_GOLD: 50,
  STARTING_WOOD: 10,
  STARTING_STONE: 5,
  STARTING_MANA: 3,
  DAYS_PER_SEASON: 28,
  MAX_HISTORY_TURNS: 10,
  PICOCLAW_TIMEOUT_MS: 120000,
  SERVER_PORT: 3002,
});

const STARTING_BUILDINGS = Object.freeze([
  { name: "Cottage", description: "Your humble home at the farm's edge" },
]);

const STARTING_SKILLS = Object.freeze({
  farming: 1,
  foraging: 1,
  magic: 0,
  crafting: 0,
  diplomacy: 0,
});

const STARTING_LOCATIONS = Object.freeze([
  "Hearthstone Farm",
  "Willowmere Village",
]);

/** Resource display icons for UI */
const RESOURCE_ICONS = Object.freeze({
  [RESOURCES.GOLD]: "\u{1FA99}",
  [RESOURCES.WOOD]: "\u{1FAB5}",
  [RESOURCES.STONE]: "\u{1FAA8}",
  [RESOURCES.MANA]: "\u{1F52E}",
});

/** Fallback choices when PicoClaw response parsing fails */
const FALLBACK_CHOICES = Object.freeze([
  { id: "tend_farm", text: "Tend to your farm plots" },
  { id: "visit_village", text: "Walk to Willowmere Village" },
  { id: "explore_forest", text: "Explore the edge of Thornveil Forest" },
  { id: "rest", text: "Rest and recover at the cottage" },
]);

module.exports = {
  SEASONS,
  SEASON_ORDER,
  RESOURCES,
  CROP_STAGES,
  GAME_CONFIG,
  STARTING_BUILDINGS,
  STARTING_SKILLS,
  STARTING_LOCATIONS,
  RESOURCE_ICONS,
  FALLBACK_CHOICES,
};
