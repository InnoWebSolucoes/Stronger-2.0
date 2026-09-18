/**
 * Non-mass framings for the Finish screen: bar travel distance, mechanical work,
 * time under tension, bodyweight multiples and height climbed.
 *
 * Source: docs/research/stronger-2-0-volume-equivalents-system-finish-scre.md,
 * PART 4 "Beyond mass: the other five framings". Constants transcribed exactly.
 *
 * Units are stated on every function. Weights are KILOGRAMS, distances METRES,
 * time SECONDS, work JOULES, energy KILOCALORIES.
 *
 * Pure TypeScript: no react / react-native / expo imports.
 */

/** Standard gravity, m/s². CGPM 1901 definition. */
export const G = 9.80665;

/** Reference lifter height the ranges of motion below are quoted for, cm. */
export const REFERENCE_HEIGHT_CM = 175;

/**
 * Representative concentric range of motion in METRES for a 175 cm lifter, keyed by
 * movement pattern. Scaled linearly by lifter height.
 *
 * Source: research PART 4a, `ROM_BY_PATTERN`.
 */
export const ROM_BY_PATTERN: Readonly<Record<string, number>> = {
  'bench-press': 0.4,
  'incline-press': 0.42,
  'overhead-press': 0.55,
  'back-squat': 0.58,
  'front-squat': 0.58,
  'leg-press': 0.45,
  'hack-squat': 0.5,
  deadlift: 0.55,
  'romanian-deadlift': 0.45,
  'hip-thrust': 0.28,
  'barbell-row': 0.42,
  'lat-pulldown': 0.6,
  'pull-up': 0.55,
  'seated-row': 0.45,
  'bicep-curl': 0.5,
  'triceps-extension': 0.45,
  'lateral-raise': 0.55,
  'calf-raise': 0.14,
  'leg-extension': 0.45,
  'leg-curl': 0.4,
  dip: 0.45,
  'push-up': 0.32,
  shrug: 0.15,
};

/** Range of motion used for any pattern not in {@link ROM_BY_PATTERN}, metres at 175 cm. */
export const DEFAULT_ROM_M = 0.45;

/** One performed set, as the framings need it. `weightKg` is kilograms on the bar (or load moved). */
export interface FramingSet {
  readonly pattern: string;
  readonly reps: number;
  readonly weightKg?: number;
  /** Seconds per rep under load, if the app measured it. */
  readonly tempoSec?: number;
}

/** Height scale factor for a lifter, unitless. Non-positive or non-finite heights fall back to 1. */
function heightScale(heightCm: number): number {
  if (!Number.isFinite(heightCm) || heightCm <= 0) return 1;
  return heightCm / REFERENCE_HEIGHT_CM;
}

/** Reps counted for a set: non-finite or negative rep counts contribute nothing. */
function safeReps(reps: number): number {
  if (!Number.isFinite(reps) || reps <= 0) return 0;
  return reps;
}

/**
 * Concentric range of motion for a movement pattern, in METRES, scaled to the lifter.
 * Unknown patterns fall back to {@link DEFAULT_ROM_M}.
 *
 * Source: research PART 4a.
 */
export function romForPattern(pattern: string, heightCm: number = REFERENCE_HEIGHT_CM): number {
  const base = ROM_BY_PATTERN[pattern] ?? DEFAULT_ROM_M;
  return base * heightScale(heightCm);
}

/**
 * Total vertical distance the bar travelled across a session, in METRES.
 *
 * @param sets performed sets
 * @param heightCm lifter height, cm; ranges of motion scale linearly from 175 cm
 * @param includeEccentric count the lowering phase too (default true — the bar does travel back down)
 *
 * Source: research PART 4a, `barDistanceM`. A typical 25-set session gives 120–200 m
 * concentric, 240–400 m counting the eccentric.
 */
export function barDistanceM(
  sets: readonly FramingSet[],
  heightCm: number = REFERENCE_HEIGHT_CM,
  includeEccentric = true,
): number {
  const concentric = sets.reduce(
    (metres, set) => metres + safeReps(set.reps) * romForPattern(set.pattern, heightCm),
    0,
  );
  return includeEccentric ? concentric * 2 : concentric;
}

/** Bar travel below this is not worth a line on the finish screen, metres (research PART 4f). */
export const MIN_BAR_DISTANCE_M = 50;

/** A real-world height to compare bar travel against. `m` is METRES. */
export interface HeightLandmark {
  readonly id: string;
  readonly name: string;
  readonly m: number;
  readonly source: string;
}

/**
 * Verified landmark heights in METRES, ascending.
 * Source: research PART 4a, `HEIGHTS_M`.
 */
export const HEIGHTS_M: readonly HeightLandmark[] = [
  { id: 'stairs', name: 'a flight of stairs', m: 3.0, source: 'IRC max riser 7.75 in x 13 risers' },
  { id: 'double-decker', name: 'a double-decker bus', m: 4.4, source: 'New Routemaster overall height' },
  { id: 'giraffe', name: 'a giraffe', m: 5.5, source: 'Giraffa camelopardalis adult male' },
  { id: 'christ', name: 'Christ the Redeemer', m: 30, source: 'Statue height excluding pedestal' },
  { id: 'liberty', name: 'the Statue of Liberty', m: 93, source: 'NPS, ground to torch' },
  { id: 'pyramid', name: 'the Great Pyramid', m: 138.5, source: 'Current height' },
  { id: 'eiffel', name: 'the Eiffel Tower', m: 330, source: 'SETE, including antennae' },
  { id: 'empire-state', name: 'the Empire State Building', m: 443.2, source: 'ESB Observatory, to tip' },
  { id: 'burj', name: 'the Burj Khalifa', m: 828, source: 'CTBUH, architectural height' },
  { id: 'fuji', name: 'Mount Fuji', m: 3776, source: 'GSI Japan' },
  { id: 'everest', name: 'Mount Everest', m: 8848.86, source: 'China/Nepal joint survey 2020' },
  { id: 'karman', name: 'the edge of space', m: 100000, source: 'FAI Karman line' },
];

/** A height framing: "the bar travelled 287 m — almost the Eiffel Tower". */
export interface HeightComparison {
  readonly landmark: HeightLandmark;
  /** How many of the landmark's height was travelled. Unitless. */
  readonly count: number;
  /** True when the count sits just short of 1 and should read "almost X". */
  readonly isNearMiss: boolean;
  /** True when the count sits in [0.92, 1.12] and should read "a whole X". */
  readonly isWhole: boolean;
}

const HEIGHT_NEAR_LO = 0.75;
const HEIGHT_WHOLE_LO = 0.92;
const HEIGHT_WHOLE_HI = 1.12;
const HEIGHT_MAX_COUNT = 40;

/**
 * Best landmark to compare a bar-travel distance against.
 *
 * @param distanceM distance in METRES
 * @returns the comparison, or `null` for a non-positive distance or nothing in range
 *
 * Unlike the mass picker, a count just *under* 1 is the best possible outcome here
 * ("almost the Eiffel Tower" beats "0.87 Eiffel Towers"), so the near-miss band
 * [0.75, 0.92) is preferred outright. Otherwise the tallest landmark that still gives
 * a count of at least 1 wins, capped at 40x so we never print "3,000 flights of stairs".
 *
 * Source: research PART 4a.
 */
export function pickHeightComparison(distanceM: number): HeightComparison | null {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;

  let best: HeightComparison | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const landmark of HEIGHTS_M) {
    const count = distanceM / landmark.m;
    if (count > HEIGHT_MAX_COUNT || count < HEIGHT_NEAR_LO) continue;
    const isWhole = count >= HEIGHT_WHOLE_LO && count <= HEIGHT_WHOLE_HI;
    const isNearMiss = count >= HEIGHT_NEAR_LO && count < HEIGHT_WHOLE_LO;
    // Prefer landmarks the session nearly reached; among the rest, prefer the tallest,
    // which is the same as preferring the smallest count above 1.
    const score = isWhole ? 3 : isNearMiss ? 2 : 1 / count;
    if (score > bestScore) {
      bestScore = score;
      best = { landmark, count, isNearMiss, isWhole };
    }
  }
  return best;
}

/**
 * Mechanical work done against gravity across a session, in JOULES.
 * W = Σ reps × weightKg × g × ROM. Concentric only — this is the honest, computable number.
 *
 * @param sets performed sets; a set with no `weightKg` contributes nothing
 * @param heightCm lifter height, cm
 *
 * Source: research PART 4b, `mechanicalWorkJ`.
 */
export function mechanicalWorkJ(
  sets: readonly FramingSet[],
  heightCm: number = REFERENCE_HEIGHT_CM,
): number {
  return sets.reduce((joules, set) => {
    const load = set.weightKg;
    if (load === undefined || !Number.isFinite(load) || load <= 0) return joules;
    return joules + safeReps(set.reps) * load * G * romForPattern(set.pattern, heightCm);
  }, 0);
}

/** Gross mechanical efficiency of resistance exercise, unitless (research PART 4b: 20–25%). */
export const GROSS_EFFICIENCY = 0.22;
/** Metabolic cost of the eccentric phase as a fraction of the concentric, unitless. */
export const ECCENTRIC_FACTOR = 0.35;
/** Joules per kilocalorie (thermochemical). */
const J_PER_KCAL = 4184;

/**
 * Metabolic cost of the mechanical work, in KILOCALORIES.
 *
 * kcal = W × (1 + eccentric factor) / gross efficiency / 4184.
 *
 * This is the weakest number in the system. Label the primary figure "mechanical work"
 * and keep this explicitly secondary and rounded — claiming a precise calorie burn from
 * set data alone is not defensible.
 *
 * Source: research PART 4b, `estimatedKcal`.
 */
export function estimatedKcal(workJ: number): number {
  if (!Number.isFinite(workJ) || workJ <= 0) return 0;
  return (workJ * (1 + ECCENTRIC_FACTOR)) / GROSS_EFFICIENCY / J_PER_KCAL;
}

/** A food item to compare energy against. `kcal` is kilocalories per item. */
export interface FoodEquivalent {
  readonly id: string;
  readonly name: string;
  readonly kcal: number;
  readonly source: string;
}

/**
 * Food energy references, KILOCALORIES each.
 * Source: research PART 4b, `FOOD_KCAL`.
 */
export const FOOD_KCAL: readonly FoodEquivalent[] = [
  { id: 'chocolate-square', name: 'squares of dark chocolate', kcal: 30, source: 'USDA FDC' },
  { id: 'banana', name: 'bananas', kcal: 105, source: 'USDA FDC, medium banana 118 g' },
  { id: 'beer-pint', name: 'pints of lager', kcal: 208, source: 'USDA FDC, 568 ml at 4.5% ABV' },
  { id: 'doughnut', name: 'doughnuts', kcal: 250, source: 'USDA FDC, glazed yeast doughnut' },
  { id: 'pizza-slice', name: 'slices of pizza', kcal: 285, source: 'USDA FDC, pepperoni, 1/8 of 14 in' },
  { id: 'big-mac', name: 'Big Macs', kcal: 563, source: "McDonald's published nutrition" },
];

/**
 * Best food comparison for an energy figure.
 *
 * @param kcal energy in KILOCALORIES
 * @returns the food and how many of them, or `null` when nothing lands in 1–20x
 */
export function pickFoodComparison(kcal: number): { food: FoodEquivalent; count: number } | null {
  if (!Number.isFinite(kcal) || kcal <= 0) return null;
  let best: { food: FoodEquivalent; count: number } | null = null;
  for (const food of FOOD_KCAL) {
    const count = kcal / food.kcal;
    if (count < 1 || count > 20) continue;
    if (best === null || count < best.count) best = { food, count };
  }
  return best;
}

/** Seconds per rep under load when the app has not measured a tempo (research PART 4c). */
export const DEFAULT_TEMPO_SEC = 3.2;

/**
 * Total time under tension across a session, in SECONDS.
 *
 * @param sets performed sets; each rep counts `tempoSec` if measured, else `defaultTempo`
 * Source: research PART 4c, `timeUnderTensionSec`.
 */
export function timeUnderTensionSec(
  sets: readonly FramingSet[],
  defaultTempo: number = DEFAULT_TEMPO_SEC,
): number {
  return sets.reduce((seconds, set) => {
    const tempo = set.tempoSec;
    const perRep = tempo !== undefined && Number.isFinite(tempo) && tempo > 0 ? tempo : defaultTempo;
    return seconds + safeReps(set.reps) * perRep;
  }, 0);
}

/**
 * Fraction of the session actually spent under load, in [0, 1].
 * "42 minutes in the gym. 7:04 of it under load." is the line this feeds.
 *
 * @param tensionSec time under tension, SECONDS
 * @param sessionSec total session duration, SECONDS
 * Source: research PART 4c.
 */
export function tensionRatio(tensionSec: number, sessionSec: number): number {
  if (!Number.isFinite(tensionSec) || !Number.isFinite(sessionSec) || sessionSec <= 0) return 0;
  if (tensionSec <= 0) return 0;
  return Math.min(1, tensionSec / sessionSec);
}

/**
 * How many times the lifter moved their own bodyweight. Unitless.
 *
 * @param totalKg session volume in KILOGRAMS
 * @param bodyweightKg lifter bodyweight in KILOGRAMS
 * @returns the multiple, or 0 when bodyweight is unknown or non-positive
 *
 * Source: research PART 4d, `bodyweightMultiples`.
 */
export function bodyweightMultiples(totalKg: number, bodyweightKg: number): number {
  if (!Number.isFinite(totalKg) || totalKg <= 0) return 0;
  if (!Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return 0;
  return totalKg / bodyweightKg;
}

/** Working average stair riser height, METRES (IRC max riser 7.75 in). */
export const STEP_RISE_M = 0.17;

/**
 * Height gained from a step count, in METRES.
 * Source: research PART 4e, `heightClimbedM`.
 */
export function heightClimbedM(steps: number): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return steps * STEP_RISE_M;
}

/** A climbable landmark, counted in steps. */
export interface StepClimb {
  readonly id: string;
  readonly name: string;
  readonly steps: number;
  readonly source: string;
}

/**
 * Real step counts for climbable landmarks.
 * Source: research PART 4e, `STEP_COUNTS`.
 */
export const STEP_COUNTS: readonly StepClimb[] = [
  { id: 'esb', name: 'the Empire State Building', steps: 1576, source: 'ESB Run-Up official' },
  { id: 'eiffel', name: 'the Eiffel Tower', steps: 1665, source: 'SETE, ground to summit' },
];

/**
 * How many times a step count climbs a landmark. Unitless.
 * @param steps steps climbed
 */
export function climbsOf(steps: number, climb: StepClimb): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return steps / climb.steps;
}
