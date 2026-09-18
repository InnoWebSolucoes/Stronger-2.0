/**
 * Phrasing layer for volume equivalents.
 *
 * Source: docs/research/stronger-2-0-volume-equivalents-system-finish-scre.md,
 * PART 5 "Copy templates and tone".
 *
 * Register: a well-made sports broadcast graphic. Factual, confident, slightly
 * deadpan, trusts the reader. Not a party, not a coach shouting, not a chatbot
 * being supportive. Lead with the number — the number is the compliment.
 *
 * Every string produced here passes {@link lintCopy}.
 *
 * Pure TypeScript: no react / react-native / expo imports. Formatting is done by hand
 * rather than via `toLocaleString`, so output is identical on every device and locale.
 */

import type { Comparison, MilestoneProgress } from './select';
import type { FoodEquivalent, HeightComparison, StepClimb } from './framings';

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/**
 * Format a number with comma thousands separators and at most `decimals` decimal places,
 * trailing zeros removed. Locale-independent by design.
 */
export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = Math.abs(value).toFixed(Math.max(0, decimals));
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  const [whole = '0', fraction] = trimmed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value < 0 ? '-' : '';
  return fraction === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${fraction}`;
}

/**
 * Format a volume total for display, in KILOGRAMS, e.g. "18,420 kg".
 * The value is never converted here — unit conversion belongs to the render layer.
 */
export function formatKg(totalKg: number): string {
  return `${formatNumber(totalKg, 0)} kg`;
}

/** Format a comparison count: "3.4", "38", "1,250". */
export function formatCount(shown: number): string {
  return formatNumber(shown, 1);
}

/**
 * Format a duration in SECONDS as "7:04", or "1:02:30" past an hour.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---------------------------------------------------------------------------
// Comparison phrasing
// ---------------------------------------------------------------------------

/** Counts below this, but at least {@link NEAR_MISS_LO}, read as "not quite a whole X". */
const NEAR_MISS_LO = 0.75;
/** Counts above the whole window but below this read as "a whole X, and then some". */
const JUST_OVER_HI = 1.35;

/**
 * Render one comparison as a noun phrase: "3.4 African elephants", "a whole blue whale",
 * "not quite a whole Toyota Corolla".
 *
 * The singular case is the point of this function: "1.0 blue whales" is the failure the
 * whole module exists to avoid.
 *
 * Source: research PART 5, `phrase`, extended with the near-miss band.
 */
export function phrase(comparison: Comparison): string {
  const { entry, count, shown } = comparison;
  if (comparison.isWhole || shown === 1) return `a whole ${entry.name}`;
  if (count >= NEAR_MISS_LO && count < 1) return `not quite a whole ${entry.name}`;
  if (count > 1 && count <= JUST_OVER_HI) return `a whole ${entry.name}, and then some`;
  // A plural that starts with a digit ("25 kg plates") would collide with the count:
  // "20 25 kg plates" is unreadable, so those get a multiplication sign instead.
  if (/^\d/.test(entry.plural)) return `${formatCount(shown)} × ${entry.plural}`;
  return `${formatCount(shown)} ${entry.plural}`;
}

/**
 * Hero templates for the "you moved X kg" line. `{kg}` is the formatted total,
 * `{a}` and `{b}` are comparison phrases.
 *
 * Source: research PART 5, `HERO_TEMPLATES`.
 */
export const HERO_TEMPLATES: readonly string[] = [
  '{kg} moved. That is {a} — or {b}.',
  '{kg}. {a}. {b}.',
  'You moved {kg} today: {a}, or {b} if you prefer.',
  '{kg} through the session. Call it {a}, or {b}.',
  'Total on the bar: {kg}. {a}. {b} if that lands better.',
  '{kg}. Which is {a}, give or take — or {b}.',
];

/**
 * Pick a hero template deterministically, out of phase with the entry rotation so the
 * sentence and the objects never cycle together.
 *
 * Source: research PART 5, `templateFor`.
 */
export function templateFor(sessionIndex: number): string {
  const index = Math.abs(Math.trunc(sessionIndex) * 5) % HERO_TEMPLATES.length;
  return HERO_TEMPLATES[index] ?? '{kg}. {a}. {b}.';
}

/**
 * The finish-screen hero line.
 *
 * @param totalKg session volume in KILOGRAMS
 * @param comparisons picks from `pickEquivalents`, best first
 * @param sessionIndex lifetime workout number, used for deterministic template rotation
 *
 * Degrades cleanly: with one comparison it drops to a single clause, with none it states
 * the number alone — a designed empty state rather than an apology.
 */
export function heroLine(
  totalKg: number,
  comparisons: readonly Comparison[],
  sessionIndex: number,
): string {
  const kg = formatKg(totalKg);
  const first = comparisons[0];
  const second = comparisons[1];
  if (first === undefined) return `${kg} moved.`;
  if (second === undefined) return `${kg} moved. That is ${phrase(first)}.`;
  return templateFor(sessionIndex)
    .replace('{kg}', kg)
    .replace('{a}', phrase(first))
    .replace('{b}', phrase(second));
}

/**
 * The plain comparison sentence, used under the hero number when the number is already
 * displayed on its own: "That is 3.4 African elephants, or 38 concert grand pianos."
 * Returns an empty string when there is nothing sensible to compare against.
 */
export function comparisonSentence(comparisons: readonly Comparison[]): string {
  const phrases = comparisons.map(phrase);
  const [a, b, c] = phrases;
  if (a === undefined) return '';
  if (b === undefined) return `That is ${a}.`;
  if (c === undefined) return `That is ${a}, or ${b}.`;
  return `That is ${a}, ${b}, or ${c}.`;
}

/**
 * The optional aside, taken only from the chosen entry's verified `fun` field.
 * One per screen, maximum. Returns an empty string when the entry has no fact.
 */
export function funAside(comparisons: readonly Comparison[]): string {
  for (const comparison of comparisons) {
    const fun = comparison.entry.fun;
    if (fun !== undefined && fun.length > 0) return fun;
  }
  return '';
}

/**
 * Hedge word for a mass the research did not verify outright.
 * "about 19 tonnes" rather than a hard figure the user can disprove.
 */
export function isHedged(comparison: Comparison): boolean {
  return comparison.entry.confidence !== 'verified';
}

// ---------------------------------------------------------------------------
// Non-mass framings
// ---------------------------------------------------------------------------

/**
 * "You lifted your own bodyweight 216 times."
 * @param multiples output of `bodyweightMultiples`, unitless
 */
export function bodyweightLine(multiples: number): string {
  if (!Number.isFinite(multiples) || multiples <= 0) return '';
  if (multiples < 1.5) return `That is ${formatNumber(multiples, 1)} times your own bodyweight.`;
  return `You lifted your own bodyweight ${formatNumber(Math.round(multiples), 0)} times.`;
}

/**
 * "The bar travelled 287 m. Almost the Eiffel Tower."
 * @param distanceM bar travel in METRES
 */
export function barTravelLine(distanceM: number, comparison: HeightComparison | null): string {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return '';
  const distance = `The bar travelled ${formatNumber(distanceM, 0)} m.`;
  if (comparison === null) return distance;
  const { landmark, count, isWhole, isNearMiss } = comparison;
  if (isWhole) return `${distance} The height of ${landmark.name}.`;
  if (isNearMiss) return `${distance} Almost ${landmark.name}.`;
  return `${distance} ${formatCount(roundForDisplay(count))} times the height of ${landmark.name}.`;
}

/** One decimal below 10, whole numbers above — the same shape as the mass picker's rounding. */
function roundForDisplay(count: number): number {
  return count < 10 ? Math.round(count * 10) / 10 : Math.round(count);
}

/**
 * "42 minutes in the gym. 7:04 of it under load."
 * @param tensionSec time under tension, SECONDS
 * @param sessionSec session duration, SECONDS
 */
export function tensionLine(tensionSec: number, sessionSec: number): string {
  if (!Number.isFinite(tensionSec) || tensionSec <= 0) return '';
  const underLoad = `${formatDuration(tensionSec)} of it under load.`;
  if (!Number.isFinite(sessionSec) || sessionSec <= 0) return `${formatDuration(tensionSec)} under load.`;
  return `${formatNumber(Math.round(sessionSec / 60), 0)} minutes in the gym. ${underLoad}`;
}

/**
 * "Mechanical work: 214 kJ. About 3 doughnuts."
 * @param workJ mechanical work, JOULES
 * @param kcal metabolic estimate, KILOCALORIES — always secondary, always hedged
 */
export function workLine(
  workJ: number,
  kcal: number,
  food: { food: FoodEquivalent; count: number } | null,
): string {
  if (!Number.isFinite(workJ) || workJ <= 0) return '';
  const work = `Mechanical work: ${formatNumber(workJ / 1000, 0)} kJ.`;
  if (!Number.isFinite(kcal) || kcal <= 0) return work;
  const rounded = Math.round(kcal / 10) * 10;
  const energy = `Roughly ${formatNumber(rounded, 0)} kcal.`;
  if (food === null) return `${work} ${energy}`;
  const n = Math.round(food.count);
  const noun = n === 1 ? singulariseFood(food.food.name) : food.food.name;
  return `${work} ${energy} About ${formatNumber(n, 0)} ${noun}.`;
}

/** Crude singular for the food list, which is stored in plural form. */
function singulariseFood(plural: string): string {
  if (plural.endsWith('ies')) return `${plural.slice(0, -3)}y`;
  if (plural.endsWith('es') && !plural.endsWith('ses')) return plural.slice(0, -2);
  if (plural.endsWith('s')) return plural.slice(0, -1);
  return plural;
}

/**
 * "Lifetime: 1,604,000 kg — 3.1% of the Titanic."
 * @param lifetimeKg lifetime volume in KILOGRAMS
 */
export function milestoneLine(lifetimeKg: number, progress: MilestoneProgress | null): string {
  const lifetime = `Lifetime: ${formatKg(lifetimeKg)}`;
  if (progress === null) return `${lifetime}.`;
  const pct = progress.pct < 10 ? formatNumber(progress.pct, 1) : formatNumber(progress.pct, 0);
  return `${lifetime} — ${pct}% of ${progress.entry.singular}.`;
}

/**
 * "That is the Empire State Building, twice." for stair or sled work.
 * @param steps steps climbed
 */
export function climbLine(steps: number, climb: StepClimb): string {
  if (!Number.isFinite(steps) || steps <= 0) return '';
  const count = steps / climb.steps;
  if (count < 0.75) return `${formatNumber(Math.round(steps), 0)} steps.`;
  if (count < 1.12) return `${formatNumber(Math.round(steps), 0)} steps. That is ${climb.name}.`;
  return `${formatNumber(Math.round(steps), 0)} steps. That is ${climb.name}, ${formatNumber(roundForDisplay(count), 1)} times over.`;
}

// ---------------------------------------------------------------------------
// Tone lint
// ---------------------------------------------------------------------------

/**
 * Banned praise words. Transcribed from the research lint rule, with one carve-out:
 * "monster truck" is a real catalogue object, not praise, so it is exempted.
 * "legend" and "gains" are banned in prose but deliberately absent here: the catalogue
 * has a `legend` category and word sense matters, so those two are a review check.
 */
const BANNED_WORDS =
  /\b(crushed|smashed|beast|monster(?! trucks?)|slay|savage|insane|amazing|incredible|awesome|epic|champ|buddy|king|queen|warrior)\b/i;

/** Banned constructions from the research tone rules. */
const BANNED_PHRASES =
  /\b(wow|let's go|keep it up|great job|you're a machine|did you know|you just)\b/i;

const EXCLAMATION = /!/;
const QUESTION = /\?/;
const EMOJI = /\p{Extended_Pictographic}/gu;

/**
 * Check a finish-screen string against the tone rules.
 * @returns a list of violations; empty means the copy is clean
 *
 * Source: research PART 5, "Lint rules to ship as a unit test", widened to cover the
 * banned constructions listed alongside the banned words.
 */
export function lintCopy(text: string): string[] {
  const problems: string[] = [];
  if (BANNED_WORDS.test(text)) problems.push('banned praise word');
  if (BANNED_PHRASES.test(text)) problems.push('banned construction');
  if (EXCLAMATION.test(text)) problems.push('no exclamation marks');
  if (QUESTION.test(text)) problems.push('no rhetorical questions');
  if ((text.match(EMOJI) ?? []).length > 1) problems.push('at most one emoji per screen');
  return problems;
}

/** Throwing form of {@link lintCopy}, for use in tests and in development builds. */
export function assertCleanCopy(text: string): void {
  const problems = lintCopy(text);
  if (problems.length > 0) {
    throw new Error(`copy violates tone rules (${problems.join(', ')}): ${text}`);
  }
}
