// ─────────────────────────────────────────────────────────────────────────────
// Muscle contribution vectors
// ─────────────────────────────────────────────────────────────────────────────
//
// Four features read these numbers and nothing else reconciles them:
//
//   1. readiness       — per-group fatigue accrues as setVolume * groupWeight
//   2. training split  — the push/pull/legs balance chart is a weighted sum
//   3. world standings — a lift only counts toward a group's percentile in
//                        proportion to its contribution
//   4. the muscle map  — shading intensity IS the group weight
//
// So a vector that does not sum to 1.0 does not merely look wrong: it silently
// inflates or deflates every one of those four at once, in a way no screen
// makes visible. The invariant is therefore enforced here, at construction, and
// asserted over the whole seed catalog in `contributions.test.ts`.
//
// Authoring model: an exercise is authored as MUSCLE shares (74 anatomical
// muscles), because that is the level at which a statement like "the long head
// of triceps does more work in an overhead extension than in a pushdown" is
// either true or false. The 21-group vector the app consumes is ROLLED UP from
// those shares, never hand-typed, so the two can never disagree.
//
// Pure TypeScript. No platform imports, no injected state, no randomness.

import type { GroupWeights, MuscleGroupId, MuscleId } from './muscles';
import { MUSCLES } from './muscles';

// ─────────────────────────────────────────────────────────────────────────────
// Types and constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Effort shares across individual muscles. Values are relative at authoring
 * time and normalised to sum to 1.0 by {@link buildContribution}.
 */
export type MuscleShares = Readonly<Partial<Record<MuscleId, number>>>;

/** A built, validated contribution vector plus the muscle lists derived from it. */
export interface Contribution {
  /** Normalised muscle shares. Sums to 1.0. */
  readonly muscleShares: MuscleShares;
  /** Normalised 21-group vector, rolled up from `muscleShares`. Sums to 1.0. */
  readonly groupWeights: GroupWeights;
  /** Muscles the lift is understood to train, in descending share order. */
  readonly primaryMuscles: readonly MuscleId[];
  /** Muscles that assist, in descending share order. */
  readonly secondaryMuscles: readonly MuscleId[];
}

/**
 * Tolerance for the "sums to 1.0" assertion on a BUILT vector.
 *
 * Built vectors are normalised with the residual folded into the largest entry,
 * so the only error left is IEEE-754 summation error over at most 74 terms.
 * 1e-9 is roughly six orders of magnitude of headroom over that and still tight
 * enough that a real authoring mistake cannot hide under it.
 */
export const CONTRIBUTION_TOLERANCE = 1e-9;

/**
 * Tolerance applied to RAW authored shares before normalisation.
 *
 * Normalisation would happily rescale `{ pec: 0.03, triceps: 0.02 }` into a
 * valid-looking vector, which is exactly how a misplaced decimal point survives
 * review. Requiring the raw numbers to already sum to 1.0 +/- 2% means the
 * author's intent is checked, not just the arithmetic.
 */
export const AUTHORING_TOLERANCE = 0.02;

/** Shares below this are treated as noise and dropped rather than stored. */
export const MIN_SHARE = 0.005;

/** Decimal places kept on a normalised share. */
const SHARE_PRECISION = 4;

/** A muscle at or above this share is primary regardless of which group it is in. */
export const PRIMARY_SHARE_THRESHOLD = 0.2;

/** Within the dominant group, a muscle at or above this share is primary. */
export const DOMINANT_GROUP_SHARE_FLOOR = 0.05;

// ─────────────────────────────────────────────────────────────────────────────
// Small numeric helpers
// ─────────────────────────────────────────────────────────────────────────────

function roundTo(value: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/** Sum of a muscle share map. */
export function sumShares(shares: MuscleShares): number {
  let total = 0;
  for (const value of Object.values(shares)) {
    if (value !== undefined) total += value;
  }
  return total;
}

/** Sum of a 21-group contribution vector. */
export function sumGroupWeights(weights: GroupWeights): number {
  let total = 0;
  for (const value of Object.values(weights)) {
    if (value !== undefined) total += value;
  }
  return total;
}

/**
 * Whether a group vector sums to 1.0 within `tolerance`.
 * This is the predicate the catalog test runs over every seeded exercise.
 */
export function isNormalizedVector(
  weights: GroupWeights,
  tolerance: number = CONTRIBUTION_TOLERANCE,
): boolean {
  return Math.abs(sumGroupWeights(weights) - 1) <= tolerance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** `true` when `id` is one of the 74 anatomical muscle ids. */
export function isKnownMuscle(id: string): id is MuscleId {
  return Object.prototype.hasOwnProperty.call(MUSCLES, id);
}

/**
 * Checks RAW authored shares before they are normalised.
 *
 * @param shares - the hand-authored share map
 * @returns a list of human-readable problems; empty means the map is sound
 */
export function validateShares(shares: MuscleShares): string[] {
  const problems: string[] = [];
  const entries = Object.entries(shares);

  if (entries.length === 0) {
    problems.push('contribution is empty: every exercise trains something');
    return problems;
  }

  for (const [id, value] of entries) {
    if (!isKnownMuscle(id)) {
      problems.push(`unknown muscle id "${id}"`);
      continue;
    }
    if (value === undefined) continue;
    if (!isFiniteNumber(value)) {
      problems.push(`share for "${id}" is not a finite number`);
      continue;
    }
    if (value <= 0) {
      problems.push(`share for "${id}" is ${value}: omit the muscle instead of scoring it zero`);
    }
    if (value > 1) {
      problems.push(`share for "${id}" is ${value}: a single muscle cannot exceed the whole lift`);
    }
  }

  const total = sumShares(shares);
  if (Math.abs(total - 1) > AUTHORING_TOLERANCE) {
    problems.push(
      `raw shares sum to ${total.toFixed(4)}, outside 1.0 +/- ${AUTHORING_TOLERANCE}`,
    );
  }

  return problems;
}

/** Checks a built group vector. Returns a list of problems; empty means valid. */
export function validateGroupWeights(weights: GroupWeights): string[] {
  const problems: string[] = [];
  const entries = Object.entries(weights);

  if (entries.length === 0) {
    problems.push('group vector is empty');
    return problems;
  }
  for (const [group, value] of entries) {
    if (value === undefined) continue;
    if (!isFiniteNumber(value)) {
      problems.push(`group "${group}" weight is not a finite number`);
      continue;
    }
    if (value <= 0) problems.push(`group "${group}" weight is ${value}, must be > 0`);
    if (value > 1) problems.push(`group "${group}" weight is ${value}, must be <= 1`);
  }

  const total = sumGroupWeights(weights);
  if (Math.abs(total - 1) > CONTRIBUTION_TOLERANCE) {
    problems.push(`group weights sum to ${total}, not 1.0`);
  }
  return problems;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation and roll-up
// ─────────────────────────────────────────────────────────────────────────────

function sortedEntries<K extends string>(
  record: Readonly<Partial<Record<K, number>>>,
): Array<readonly [K, number]> {
  const out: Array<readonly [K, number]> = [];
  for (const [key, value] of Object.entries(record) as Array<[K, number | undefined]>) {
    if (value !== undefined) out.push([key, value] as const);
  }
  // Descending by share, then by id so the order is deterministic across runs.
  out.sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

/**
 * Rescales a share map to sum to exactly 1.0.
 *
 * Each entry is rounded to four decimal places for legibility, and the rounding
 * residual is folded into the single largest entry. Folding into the largest
 * entry rather than spreading it keeps the error invisible (it lands on a value
 * of ~0.3, not ~0.01) and makes the total exact rather than approximately one.
 *
 * @param shares - raw shares; values <= {@link MIN_SHARE} after scaling are dropped
 * @returns a new map summing to 1.0
 * @throws when the input has no positive entry to scale
 */
export function normalizeShares(shares: MuscleShares): MuscleShares {
  const positive: Array<readonly [MuscleId, number]> = [];
  for (const [key, value] of sortedEntries<MuscleId>(shares)) {
    if (isFiniteNumber(value) && value > 0) positive.push([key, value]);
  }
  if (positive.length === 0) {
    throw new Error('normalizeShares: no positive share to normalise');
  }

  const total = positive.reduce((acc, entry) => acc + entry[1], 0);
  const scaled: Array<readonly [MuscleId, number]> = [];
  for (const [key, value] of positive) {
    const share = roundTo(value / total, SHARE_PRECISION);
    if (share >= MIN_SHARE) scaled.push([key, share]);
  }
  // Every share fell below the floor: keep the single largest so the vector is
  // never empty. `positive` is non-empty and sorted descending, so [0] exists.
  if (scaled.length === 0) {
    const largest = positive[0];
    if (largest === undefined) throw new Error('normalizeShares: unreachable empty vector');
    return { [largest[0]]: 1 } as MuscleShares;
  }

  // Re-total after the floor drop, then fold the residual into entry 0, which
  // is the largest because `sortedEntries` sorted descending.
  const kept = scaled.reduce((acc, entry) => acc + entry[1], 0);
  const out: Partial<Record<MuscleId, number>> = {};
  let restSum = 0;
  for (let i = 1; i < scaled.length; i += 1) {
    const entry = scaled[i];
    if (entry === undefined) continue;
    const share = roundTo(entry[1] / kept, SHARE_PRECISION);
    out[entry[0]] = share;
    restSum += share;
  }
  const head = scaled[0];
  if (head === undefined) throw new Error('normalizeShares: unreachable missing head');
  out[head[0]] = 1 - restSum;
  return out;
}

/**
 * Rolls muscle shares up to the 21 muscle groups the app displays.
 *
 * The residual is folded into the largest group for the same reason as in
 * {@link normalizeShares}: the consumer asserts an exact sum, not a close one.
 */
export function groupWeightsFromShares(shares: MuscleShares): GroupWeights {
  const totals = new Map<MuscleGroupId, number>();
  for (const [muscle, share] of sortedEntries<MuscleId>(shares)) {
    if (!isKnownMuscle(muscle)) continue;
    const group = MUSCLES[muscle].group;
    totals.set(group, (totals.get(group) ?? 0) + share);
  }

  const entries = [...totals.entries()].sort(
    (a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  if (entries.length === 0) throw new Error('groupWeightsFromShares: no groups');

  const total = entries.reduce((acc, entry) => acc + entry[1], 0);
  const out: Partial<Record<MuscleGroupId, number>> = {};
  let restSum = 0;
  for (let i = 1; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined) continue;
    const weight = roundTo(entry[1] / total, SHARE_PRECISION);
    if (weight < MIN_SHARE) continue;
    out[entry[0]] = weight;
    restSum += weight;
  }
  const head = entries[0];
  if (head === undefined) throw new Error('groupWeightsFromShares: unreachable missing head');
  out[head[0]] = roundTo(1 - restSum, 10);

  // The head assignment above can drift by an ulp after rounding; settle it.
  const drift = 1 - sumGroupWeights(out);
  if (drift !== 0) out[head[0]] = (out[head[0]] ?? 0) + drift;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The builder
// ─────────────────────────────────────────────────────────────────────────────

/** The muscle group holding the largest share of the work, or `null` if empty. */
export function dominantGroup(weights: GroupWeights): MuscleGroupId | null {
  const entries = sortedEntries<MuscleGroupId>(weights);
  const head = entries[0];
  return head === undefined ? null : head[0];
}

/** The `n` heaviest groups, descending. */
export function topGroups(weights: GroupWeights, n: number): MuscleGroupId[] {
  return sortedEntries<MuscleGroupId>(weights)
    .slice(0, Math.max(0, n))
    .map((entry) => entry[0]);
}

/**
 * Builds and validates one contribution vector.
 *
 * A muscle is PRIMARY when either it carries {@link PRIMARY_SHARE_THRESHOLD} of
 * the lift on its own, or it belongs to the dominant group and clears
 * {@link DOMINANT_GROUP_SHARE_FLOOR}. That second clause is what keeps all three
 * heads of pectoralis major listed as primary on a bench press while leaving the
 * triceps — which do real work but are not what the lift is for — secondary.
 *
 * @param shares - hand-authored muscle shares, expected to already sum to ~1.0
 * @param label - identifier used in thrown error messages, e.g. the exercise id
 * @returns the normalised vectors and derived muscle lists
 * @throws when {@link validateShares} finds a problem — seeding is build time,
 *   so a bad vector must break the build, never ship degraded
 */
export function buildContribution(shares: MuscleShares, label = 'contribution'): Contribution {
  const problems = validateShares(shares);
  if (problems.length > 0) {
    throw new Error(`${label}: ${problems.join('; ')}`);
  }

  const muscleShares = normalizeShares(shares);
  const groupWeights = groupWeightsFromShares(muscleShares);
  const top = dominantGroup(groupWeights);

  const primary: MuscleId[] = [];
  const secondary: MuscleId[] = [];
  for (const [muscle, share] of sortedEntries<MuscleId>(muscleShares)) {
    const inDominantGroup = top !== null && MUSCLES[muscle].group === top;
    const isPrimary =
      share >= PRIMARY_SHARE_THRESHOLD ||
      (inDominantGroup && share >= DOMINANT_GROUP_SHARE_FLOOR);
    if (isPrimary) primary.push(muscle);
    else secondary.push(muscle);
  }

  // A lift with no muscle over either bar (a very even vector) still has a
  // primary mover: the largest share.
  if (primary.length === 0) {
    const head = secondary.shift();
    if (head !== undefined) primary.push(head);
  }

  return { muscleShares, groupWeights, primaryMuscles: primary, secondaryMuscles: secondary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combination — used by readiness and the split chart
// ─────────────────────────────────────────────────────────────────────────────

/** One weighted term in a blend: a vector and how much of it to apply. */
export interface WeightedVector {
  readonly weights: GroupWeights;
  /** Multiplier, e.g. a set's volume in kg. Non-positive terms are ignored. */
  readonly factor: number;
}

/**
 * Multiplies every entry of a vector by `factor`. The result no longer sums to
 * 1.0 — it is an amount of work, not a distribution.
 */
export function scaleGroupWeights(
  weights: GroupWeights,
  factor: number,
): Partial<Record<MuscleGroupId, number>> {
  const out: Partial<Record<MuscleGroupId, number>> = {};
  for (const [group, value] of sortedEntries<MuscleGroupId>(weights)) {
    out[group] = value * factor;
  }
  return out;
}

/**
 * Accumulates weighted vectors into a single per-group total.
 *
 * This is how a session's volume becomes per-group fatigue: each set
 * contributes its exercise's vector scaled by that set's effective volume.
 * The result is NOT normalised, because the magnitude is the signal.
 */
export function accumulateGroupWeights(
  parts: readonly WeightedVector[],
): Partial<Record<MuscleGroupId, number>> {
  const out: Partial<Record<MuscleGroupId, number>> = {};
  for (const part of parts) {
    if (!isFiniteNumber(part.factor) || part.factor <= 0) continue;
    for (const [group, value] of sortedEntries<MuscleGroupId>(part.weights)) {
      out[group] = (out[group] ?? 0) + value * part.factor;
    }
  }
  return out;
}

/**
 * Rescales any non-negative per-group map back into a distribution summing to
 * 1.0 — the form the muscle map and the split chart render.
 *
 * @returns an empty object when the input totals zero, which callers must treat
 *   as "no work recorded" rather than as an even split
 */
export function toDistribution(
  totals: Readonly<Partial<Record<MuscleGroupId, number>>>,
): GroupWeights {
  const sum = sumGroupWeights(totals);
  if (!isFiniteNumber(sum) || sum <= 0) return {};
  return groupDistribution(totals, sum);
}

function groupDistribution(
  totals: Readonly<Partial<Record<MuscleGroupId, number>>>,
  sum: number,
): GroupWeights {
  const entries = sortedEntries<MuscleGroupId>(totals).filter((e) => e[1] > 0);
  const out: Partial<Record<MuscleGroupId, number>> = {};
  let restSum = 0;
  for (let i = 1; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined) continue;
    const share = roundTo(entry[1] / sum, SHARE_PRECISION);
    if (share < MIN_SHARE) continue;
    out[entry[0]] = share;
    restSum += share;
  }
  const head = entries[0];
  if (head === undefined) return {};
  out[head[0]] = 1 - restSum;
  return out;
}
