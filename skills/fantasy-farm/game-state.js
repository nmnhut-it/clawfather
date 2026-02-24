/**
 * Fantasy Farm — game state factory and mutation helpers.
 * createInitialState() builds a fresh world; applyStateChanges() merges PicoClaw deltas.
 */

const {
  SEASONS, SEASON_ORDER, RESOURCES, CROP_STAGES,
  GAME_CONFIG, STARTING_BUILDINGS, STARTING_SKILLS, STARTING_LOCATIONS,
  FALLBACK_CHOICES,
} = require("./constants");

/** Build a brand-new game state object */
function createInitialState() {
  const plots = Array.from({ length: GAME_CONFIG.INITIAL_PLOT_COUNT }, () => ({
    crop: null,
    stage: CROP_STAGES.EMPTY,
  }));

  return {
    time: { day: 1, season: SEASONS.SPRING, year: 1 },
    farm: {
      plots,
      animals: [],
      buildings: [...STARTING_BUILDINGS],
    },
    player: {
      resources: {
        [RESOURCES.GOLD]: GAME_CONFIG.STARTING_GOLD,
        [RESOURCES.WOOD]: GAME_CONFIG.STARTING_WOOD,
        [RESOURCES.STONE]: GAME_CONFIG.STARTING_STONE,
        [RESOURCES.MANA]: GAME_CONFIG.STARTING_MANA,
      },
      inventory: [],
      skills: { ...STARTING_SKILLS },
    },
    world: {
      relationships: {},
      activeQuests: [],
      completedQuests: [],
      discoveredLocations: [...STARTING_LOCATIONS],
      events: [],
    },
    narrative: {
      turnHistory: [],
      currentNarrative: "",
      currentChoices: [],
    },
  };
}

/* ── Delta application ─────────────────────────────────────────── */

/** Advance time by one day, rolling season/year as needed */
function advanceTime(time) {
  let { day, season, year } = time;
  day += 1;
  if (day > GAME_CONFIG.DAYS_PER_SEASON) {
    day = 1;
    const idx = SEASON_ORDER.indexOf(season);
    const nextIdx = (idx + 1) % SEASON_ORDER.length;
    season = SEASON_ORDER[nextIdx];
    if (nextIdx === 0) year += 1;
  }
  return { day, season, year };
}

/** Update specific farm plots by index */
function applyPlotChanges(plots, changes) {
  if (!Array.isArray(changes)) return plots;
  for (const ch of changes) {
    if (ch.index >= 0 && ch.index < plots.length) {
      plots[ch.index] = { ...plots[ch.index], ...ch };
      delete plots[ch.index].index;
    }
  }
  return plots;
}

/** Add delta values to resources, clamping at 0 minimum */
function applyResourceDeltas(resources, deltas) {
  if (!deltas || typeof deltas !== "object") return resources;
  for (const [key, delta] of Object.entries(deltas)) {
    if (key in resources && typeof delta === "number") {
      resources[key] = Math.max(0, resources[key] + delta);
    }
  }
  return resources;
}

/** Add/remove inventory items */
function applyInventoryChanges(inventory, changes) {
  if (!changes || typeof changes !== "object") return inventory;
  const { add = [], remove = [] } = changes;
  const updated = inventory.filter((item) => !remove.includes(item));
  return updated.concat(add);
}

/** Adjust NPC relationship trust, clamped 0-100 */
function applyRelationshipDeltas(relationships, deltas) {
  if (!deltas || typeof deltas !== "object") return relationships;
  for (const [npc, delta] of Object.entries(deltas)) {
    const current = relationships[npc] || 50;
    relationships[npc] = Math.max(0, Math.min(100, current + delta));
  }
  return relationships;
}

/** Adjust player skill levels */
function applySkillDeltas(skills, deltas) {
  if (!deltas || typeof deltas !== "object") return skills;
  for (const [skill, delta] of Object.entries(deltas)) {
    skills[skill] = Math.max(0, (skills[skill] || 0) + delta);
  }
  return skills;
}

/** Merge all PicoClaw state-change deltas into current state */
function applyStateChanges(state, changes) {
  if (!changes) return state;

  if (changes.day !== false) {
    state.time = advanceTime(state.time);
  }
  if (changes.plots) {
    applyPlotChanges(state.farm.plots, changes.plots);
  }
  if (changes.resources) {
    applyResourceDeltas(state.player.resources, changes.resources);
  }
  if (changes.inventory) {
    state.player.inventory = applyInventoryChanges(
      state.player.inventory, changes.inventory,
    );
  }
  if (changes.relationships) {
    applyRelationshipDeltas(state.world.relationships, changes.relationships);
  }
  if (changes.skills) {
    applySkillDeltas(state.player.skills, changes.skills);
  }
  if (changes.newQuests) {
    state.world.activeQuests.push(...changes.newQuests);
  }
  if (changes.completedQuests) {
    for (const q of changes.completedQuests) {
      state.world.activeQuests = state.world.activeQuests.filter(
        (aq) => aq.id !== q,
      );
      state.world.completedQuests.push(q);
    }
  }
  if (changes.events) {
    state.world.events.push(...changes.events);
  }
  if (changes.discoveredLocations) {
    for (const loc of changes.discoveredLocations) {
      if (!state.world.discoveredLocations.includes(loc)) {
        state.world.discoveredLocations.push(loc);
      }
    }
  }
  if (changes.animals) {
    state.farm.animals = changes.animals;
  }
  if (changes.buildings) {
    state.farm.buildings.push(...changes.buildings);
  }

  return state;
}

/** Record a turn in history, trimming to max length */
function pushTurnHistory(state, choiceText, narrative) {
  state.narrative.turnHistory.push({
    day: state.time.day,
    season: state.time.season,
    year: state.time.year,
    choice: choiceText,
    narrative,
  });
  if (state.narrative.turnHistory.length > GAME_CONFIG.MAX_HISTORY_TURNS) {
    state.narrative.turnHistory = state.narrative.turnHistory.slice(
      -GAME_CONFIG.MAX_HISTORY_TURNS,
    );
  }
}

/** Project internal state into a UI-friendly view */
function getViewState(state) {
  return {
    time: { ...state.time },
    farm: {
      plots: state.farm.plots.map((p, i) => ({ index: i, ...p })),
      animals: [...state.farm.animals],
      buildings: state.farm.buildings.map((b) => b.name),
    },
    resources: { ...state.player.resources },
    inventory: [...state.player.inventory],
    skills: { ...state.player.skills },
    quests: state.world.activeQuests,
    completedQuests: state.world.completedQuests.length,
    locations: [...state.world.discoveredLocations],
    relationships: { ...state.world.relationships },
    narrative: state.narrative.currentNarrative,
    choices: state.narrative.currentChoices.length > 0
      ? state.narrative.currentChoices
      : FALLBACK_CHOICES,
    recentEvents: state.world.events.slice(-5),
  };
}

module.exports = {
  createInitialState,
  applyStateChanges,
  pushTurnHistory,
  getViewState,
};
