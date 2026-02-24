/**
 * Fantasy Farm — parse PicoClaw responses.
 * Expects narrative text followed by a fenced ```json block with { choices, stateChanges }.
 * Includes layered fallbacks: exact JSON → fuzzy JSON find → narrative-only with defaults.
 */

const { FALLBACK_CHOICES } = require("./constants");

const MIN_CHOICES = 3;
const MAX_CHOICES = 5;

/** Main entry: raw PicoClaw text → { narrative, choices, stateChanges } */
function parseResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return buildFallbackResult("The world shimmers quietly around you...");
  }

  const narrative = extractNarrative(rawText);
  const jsonBlock = extractJsonBlock(rawText);

  if (!jsonBlock) {
    return buildFallbackResult(narrative || rawText.trim());
  }

  const choices = validateChoices(jsonBlock.choices);
  const stateChanges = validateStateChanges(jsonBlock.stateChanges);

  return { narrative: narrative || rawText.trim(), choices, stateChanges };
}

/** Extract narrative text before the ```json fence */
function extractNarrative(rawText) {
  const fenceIdx = rawText.indexOf("```json");
  if (fenceIdx === -1) return rawText.trim();
  return rawText.substring(0, fenceIdx).trim();
}

/** Extract JSON block from fenced code or fuzzy-find a JSON object */
function extractJsonBlock(rawText) {
  // Try fenced ```json ... ```
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/);
  if (fencedMatch) {
    return safeJsonParse(fencedMatch[1].trim());
  }

  // Fallback: find any JSON object containing "choices"
  const fuzzyMatch = rawText.match(/\{[\s\S]*"choices"[\s\S]*\}/);
  if (fuzzyMatch) {
    return safeJsonParse(fuzzyMatch[0]);
  }

  return null;
}

/** Safe JSON.parse with null on failure */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Ensure choices is an array of {id, text} with 3-5 items */
function validateChoices(choices) {
  if (!Array.isArray(choices) || choices.length === 0) {
    return [...FALLBACK_CHOICES];
  }

  const valid = choices
    .filter((c) => c && typeof c.id === "string" && typeof c.text === "string")
    .slice(0, MAX_CHOICES);

  if (valid.length < MIN_CHOICES) {
    return [...FALLBACK_CHOICES];
  }

  return valid;
}

/** Validate state changes, merge with safe defaults */
function validateStateChanges(changes) {
  const defaults = {
    day: true,
    plots: null,
    resources: null,
    inventory: null,
    relationships: null,
    newQuests: null,
    completedQuests: null,
    events: null,
    discoveredLocations: null,
    skills: null,
  };

  if (!changes || typeof changes !== "object") return defaults;

  return { ...defaults, ...changes };
}

/** Build a fallback result when JSON parsing fails entirely */
function buildFallbackResult(narrative) {
  return {
    narrative,
    choices: [...FALLBACK_CHOICES],
    stateChanges: validateStateChanges(null),
  };
}

module.exports = { parseResponse };
