/**
 * Selection algorithm for volume equivalents.
 *
 * Source: docs/research/stronger-2-0-volume-equivalents-system-finish-scre.md,
 * PART 3 "Selection algorithm". All tuning constants are taken from that brief exactly.
 *
 * The job: given a session (or lifetime) total in KILOGRAMS, choose two or three
 * catalogue objects whose counts land in the satisfying window — roughly 1.5x to 40x,
 * centred on 6.5x — while blending relatability against spectacle by scale and keeping
 * the picks genuinely different from each other and from recent sessions.
 *
 * "0.03 blue whales" and "18,000 bananas" are both failures and both are unreachable here.
 *
 * Pure TypeScript: no react / react-native / expo imports.
 */

import {
  MASS_EQUIVALENTS,
  MILESTONE_EQUIVALENTS,
  PICKABLE_EQUIVALENTS,
  countOf,
  isMilestone,
  type EquivCategory,
  type MassEquivalent,
} from './catalog';
import { HISTORY_DEPTH, cooldownPenalty, rotation, type ShownRecord } from './variety';

// ---------------------------------------------------------------------------
// Tuning constants (research PART 3)
// ---------------------------------------------------------------------------

/** Geometric sweet spot for a comparison count, unitless multiples. */
export const IDEAL_COUNT = 6.5;
/** Log-space width of the quality curve below the ideal count. */
const LO_SIGMA = 0.95;
/** Log-space width above the ideal count — big counts age better than small ones. */
const HI_SIGMA = 1.15;
/** Hard lower bound of the satisfying window. Below this the comparison is not worth printing. */
export const MIN_COUNT = 1.5;
/** Hard upper bound of the satisfying window. */
export const MAX_COUNT = 40;

/** Lower edge of the "a whole blue whale" window. */
export const WHOLE_LO = 0.92;
/** Upper edge of the "a whole blue whale" window. */
export const WHOLE_HI = 1.12;
/** Score given to a whole-object count: just under the 6.5x ideal, so it fires often but not always. */
const WHOLE_SCORE = 0.97;

const W_COUNT = 1.0;
const W_APPEAL = 0.55;
const W_ROUND = 0.1;
const W_COOLDOWN = 0.6;
const W_ROTATION = 0.12;

/** Score subtracted from a candidate sharing the category of an already-picked entry. */
const P_SAME_CATEGORY = 0.35;
/** Score subtracted from a candidate whose mass is within {@link NEAR_MASS_DEX} of a pick. */
const P_NEAR_MASS = 0.5;
/** log10 distance counted as "the same number": 0.15 dex is a factor of 1.41. */
const NEAR_MASS_DEX = 0.15;

/** A third comparison is dropped rather than shown if its score falls below this. */
const THIRD_PICK_FLOOR = 0.55;

// ---------------------------------------------------------------------------
// Scoring primitives
// ---------------------------------------------------------------------------

/**
 * Quality of a comparison count, in [0, 1]. Unitless (the count is a ratio).
 *
 * A log-Gaussian centred on {@link IDEAL_COUNT} with asymmetric widths, hard-zeroed
 * outside [1.5, 40] so a bad ratio can never be promoted by any other term. Counts in
 * [0.92, 1.12] are the special "a whole X" case and score {@link WHOLE_SCORE}.
 *
 * Source: research PART 3, `countScore`. Reference values from the formula:
 * 1.5 → 0.30, 3 → 0.72, 6.5 → 1.00, 12 → 0.87, 25 → 0.50, 40 → 0.29, 60 → 0.
 * (The brief's inline comment says 0.46 at 25; that is a slip in the prose — the
 * constants, which are authoritative, give 0.50.)
 */
export function countScore(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (count >= WHOLE_LO && count <= WHOLE_HI) return WHOLE_SCORE;
  if (count < MIN_COUNT || count > MAX_COUNT) return 0;
  const d = Math.log(count) - Math.log(IDEAL_COUNT);
  const sigma = d < 0 ? LO_SIGMA : HI_SIGMA;
  return Math.exp(-0.5 * (d / sigma) ** 2);
}

/**
 * How far to lean on spectacle rather than relatability, in [0, 1].
 * 0 at 1,000 kg (one light session: sofas and washing machines) rising to 1 at
 * 1,000,000 kg (lifetime scale: blue whales and space stations).
 *
 * @param totalKg volume in kilograms
 * Source: research PART 3, `spectacleWeight`.
 */
export function spectacleWeight(totalKg: number): number {
  const t = (Math.log10(Math.max(totalKg, 1)) - 3) / 3;
  return Math.min(1, Math.max(0, t));
}

/**
 * Round a raw count for display: one decimal below 10, whole numbers below 100,
 * nearest 5 above that. Unitless.
 *
 * Source: research PART 3, `displayCount`.
 */
export function displayCount(n: number): number {
  if (n < 10) return Math.round(n * 10) / 10;
  if (n < 100) return Math.round(n);
  return Math.round(n / 5) * 5;
}

/**
 * Mild preference, in roughly [0, 1], for counts that survive display rounding intact
 * and are not suspiciously round. "2.9 pianos" reads as measured; "4.0 pianos" reads as
 * made up, so integer-looking small counts are damped to 0.6 of their value.
 *
 * Source: research PART 3, `roundness`.
 */
export function roundness(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const shown = displayCount(count);
  const drift = Math.abs(count - shown) / count;
  const looksInteger = count < 10 && Math.abs(shown - Math.round(shown)) < 1e-9;
  return (1 - drift * 10) * (looksInteger ? 0.6 : 1);
}

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

/** One chosen comparison, ready for the copy layer. */
export interface Comparison {
  readonly entry: MassEquivalent;
  /** Raw count: totalKg / entry.massKg. Unitless. */
  readonly count: number;
  /** Count rounded for display by {@link displayCount}. */
  readonly shown: number;
  /** True when the count sits in [0.92, 1.12] and should render as "a whole X". */
  readonly isWhole: boolean;
  /** Final blended score at the moment it was picked. Higher is better. Exposed for debugging. */
  readonly score: number;
}

export interface PickOptions {
  /** The user's lifetime workout number, 1-based. Drives the deterministic rotation. */
  readonly sessionIndex: number;
  /** Shown ids from recent sessions. Only the last {@link HISTORY_DEPTH} sessions are used. */
  readonly history?: readonly ShownRecord[];
  /** How many comparisons to return. 2 or 3; defaults to 3. */
  readonly want?: number;
  /** Override the pool, e.g. for tests. Defaults to every non-legend catalogue entry. */
  readonly catalogue?: readonly MassEquivalent[];
  /** Categories to hide, e.g. `['animal']` for a user who has asked not to see them. */
  readonly excludeCategories?: readonly EquivCategory[];
  /** Specific entry ids to hide. */
  readonly excludeIds?: readonly string[];
}

// ---------------------------------------------------------------------------
// The pick
// ---------------------------------------------------------------------------

interface Scored {
  entry: MassEquivalent;
  count: number;
  shown: number;
  isWhole: boolean;
  score: number;
}

/**
 * Choose two or three real-world comparisons for a volume total.
 *
 * @param totalKg session or lifetime volume in KILOGRAMS
 * @param opts session index, shown history and pool filters
 * @returns up to `opts.want` comparisons, best first. Empty for a zero, negative or
 *          non-finite total — "0 kg" is an empty state, not a comparison.
 *
 * Deterministic: the same (totalKg, sessionIndex, history, pool) always returns the
 * same entries in the same order. Persist the returned ids on the workout so an old
 * summary re-opens identically.
 *
 * Source: research PART 3, `pickEquivalents`.
 */
export function pickEquivalents(totalKg: number, opts: PickOptions): Comparison[] {
  if (!Number.isFinite(totalKg) || totalKg <= 0) return [];

  const want = Math.max(1, opts.want ?? 3);
  const history = (opts.history ?? []).slice(-HISTORY_DEPTH * 3);
  const weight = spectacleWeight(totalKg);
  const excludedCategories = new Set<EquivCategory>(opts.excludeCategories ?? []);
  const excludedIds = new Set<string>(opts.excludeIds ?? []);

  const pool = (opts.catalogue ?? PICKABLE_EQUIVALENTS).filter(
    (e) => !isMilestone(e) && !excludedCategories.has(e.category) && !excludedIds.has(e.id),
  );

  const scored: Scored[] = [];
  for (const entry of pool) {
    const count = countOf(totalKg, entry);
    const quality = countScore(count);
    if (quality === 0) continue;

    const appeal = (1 - weight) * entry.relatability + weight * entry.spectacle;
    const score =
      W_COUNT * quality +
      W_APPEAL * appeal +
      W_ROUND * roundness(count) -
      W_COOLDOWN * cooldownPenalty(entry.id, history, opts.sessionIndex) +
      W_ROTATION * rotation(entry.id, opts.sessionIndex);

    scored.push({
      entry,
      count,
      shown: displayCount(count),
      isWhole: count >= WHOLE_LO && count <= WHOLE_HI,
      score,
    });
  }

  if (scored.length === 0) return fallback(totalKg, pool, want, opts.sessionIndex);

  const picked: Comparison[] = [];
  const working = scored.slice();

  while (picked.length < want && working.length > 0) {
    const bestIndex = indexOfBest(working);
    const best = working[bestIndex];
    if (best === undefined) break;
    working.splice(bestIndex, 1);
    picked.push({ ...best });

    const bestLog = Math.log10(best.entry.massKg);
    for (const candidate of working) {
      if (candidate.entry.category === best.entry.category) candidate.score -= P_SAME_CATEGORY;
      if (Math.abs(Math.log10(candidate.entry.massKg) - bestLog) < NEAR_MASS_DEX) {
        candidate.score -= P_NEAR_MASS;
      }
    }

    // Never show a third comparison that is genuinely weak: two good lines beat three.
    if (picked.length >= 2) {
      const nextIndex = indexOfBest(working);
      const next = working[nextIndex];
      if (next === undefined || next.score < THIRD_PICK_FLOOR) break;
    }
  }

  return picked;
}

/** Index of the highest-scoring candidate, or -1 for an empty list. Ties break on the earlier entry. */
function indexOfBest(candidates: readonly Scored[]): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c === undefined) continue;
    if (c.score > bestScore) {
      bestScore = c.score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Smallest count the widened fallback will still print. Below this the line reads as a
 * failure ("0.5 pineapples"), so nothing is shown at all and the screen falls back to
 * its other framings.
 */
const FALLBACK_MIN_COUNT = 0.75;

/**
 * Totals so small that nothing lands in [1.5, 40]: under about 1.5 kg, where even a bag
 * of sugar is too heavy. Widen to "closest to the ideal count in log space" and return
 * fewer picks rather than a bad one.
 *
 * Source: research PART 3, `fallback`, tightened with {@link FALLBACK_MIN_COUNT}.
 */
function fallback(
  totalKg: number,
  pool: readonly MassEquivalent[],
  want: number,
  sessionIndex: number,
): Comparison[] {
  const widened = pool
    .map((entry) => {
      const count = countOf(totalKg, entry);
      const d = Math.abs(Math.log(count) - Math.log(IDEAL_COUNT));
      return {
        entry,
        count,
        shown: displayCount(count),
        isWhole: count >= WHOLE_LO && count <= WHOLE_HI,
        score: -d + 0.1 * rotation(entry.id, sessionIndex),
      };
    })
    .filter((c) => Number.isFinite(c.score) && c.count >= FALLBACK_MIN_COUNT)
    .sort((a, b) => b.score - a.score);
  return widened.slice(0, Math.max(1, want - 1));
}

// ---------------------------------------------------------------------------
// Lifetime milestone
// ---------------------------------------------------------------------------

/** Progress towards the next legend-tier object. */
export interface MilestoneProgress {
  readonly entry: MassEquivalent;
  /** Percentage of the milestone's mass already lifted, 0..100. */
  readonly pct: number;
  /** Kilograms still to lift before the milestone is passed. */
  readonly remainingKg: number;
}

/**
 * The nearest legend-tier object the user has not yet out-lifted, with progress.
 *
 * @param lifetimeKg lifetime volume in KILOGRAMS
 * @returns progress, or `null` once the Great Pyramid has been passed (5.9 Mt — nobody will)
 *
 * Source: research PART 3, `nextMilestone`. At 1,600,000 kg lifetime this returns the
 * Titanic at 3.06%.
 */
export function nextMilestone(
  lifetimeKg: number,
  catalogue: readonly MassEquivalent[] = MASS_EQUIVALENTS,
): MilestoneProgress | null {
  if (!Number.isFinite(lifetimeKg) || lifetimeKg < 0) return null;
  const legends =
    catalogue === MASS_EQUIVALENTS
      ? MILESTONE_EQUIVALENTS
      : catalogue.filter(isMilestone);
  const ordered = [...legends].sort((a, b) => a.massKg - b.massKg);
  const next = ordered.find((e) => e.massKg > lifetimeKg);
  if (next === undefined) return null;
  return {
    entry: next,
    pct: (lifetimeKg / next.massKg) * 100,
    remainingKg: next.massKg - lifetimeKg,
  };
}
