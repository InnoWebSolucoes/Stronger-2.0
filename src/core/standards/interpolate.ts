/**
 * Monotone interpolation of the strength-standards grids.
 *
 * The published tables give five loads at a handful of grid bodyweights. Real users sit
 * between grid points, so the engine interpolates. Two properties are non-negotiable:
 *
 *  1. MONOTONICITY. A heavier lifter must never be given a lower threshold than a
 *     lighter one, and no interpolation artefact may create a dip between grid points.
 *     Fritsch-Carlson PCHIP guarantees this; a natural cubic spline does not.
 *  2. NO ABSURD EXTRAPOLATION. Outside the published grid the curve is clamped rather
 *     than run to infinity. Bodyweight multipliers are not linear — the 99th-percentile
 *     male deadlift multiple falls from 4.37x at 59 kg to 2.65x at 120+ kg (Montenegro
 *     2026, n=101,898) — so extrapolating a fitted trend far past the data is exactly
 *     how you end up telling a 160 kg lifter he needs a 500 kg squat to be Intermediate.
 *
 * All loads and bodyweights are in KILOGRAMS.
 *
 * @see https://link.springer.com/article/10.1186/s40798-026-01111-z (Montenegro 2026)
 * @see Fritsch F.N., Carlson R.E. "Monotone Piecewise Cubic Interpolation",
 *      SIAM J. Numer. Anal. 17(2):238-246, 1980.
 */

import {
  LEVEL_ORDER,
  type ExerciseStandard,
  type Level,
  type MethodologyNote,
  type Sex,
  type SexStandardTable,
} from './standards-data';

/** The five level loads at one exact bodyweight, in the table's own units (kg). */
export type LevelAnchors = Readonly<Record<Level, number>>;

/** Result of resolving a standards grid at an exact bodyweight. */
export interface AnchorsAtBodyweight {
  /** The five thresholds, keyed by level. */
  readonly anchors: LevelAnchors;
  /** The same thresholds in LEVEL_ORDER, ready for the (ln load -> z) spline. */
  readonly ordered: readonly number[];
  /** Bodyweight actually used after clamping, in kg. */
  readonly bodyweightUsedKg: number;
  /** True when the requested bodyweight fell outside the published grid. */
  readonly clamped: boolean;
}

/**
 * How far beyond the published grid a bodyweight may be linearly extrapolated before it
 * is clamped, in kg. 10 kg is one grid step on the full tables, so a 145 kg man is still
 * scored on a curve rather than a wall, while a 200 kg entry (or a typo) is clamped.
 */
export const BODYWEIGHT_EXTRAPOLATION_MARGIN_KG = 10;

/** Smallest threshold the engine will emit for an externally loaded lift, in kg. */
const MIN_POSITIVE_THRESHOLD_KG = 0.5;

/** Minimum gap enforced between consecutive level thresholds, in kg. */
const MIN_LEVEL_GAP_KG = 0.001;

/** Read an array element, failing loudly instead of silently producing NaN. */
function at(values: readonly number[], index: number): number {
  const v = values[index];
  if (v === undefined) throw new RangeError(`index ${index} out of range (length ${values.length})`);
  return v;
}

/**
 * Fritsch-Carlson slopes for monotone piecewise cubic (PCHIP) interpolation.
 *
 * Interior slopes use the weighted harmonic mean of the neighbouring secants and are
 * forced to zero at a local extremum, which is what prevents overshoot. Endpoint slopes
 * use the one-sided three-point formula, clamped to preserve monotonicity.
 *
 * @param xs strictly ascending abscissae (bodyweights in kg, or ln loads)
 * @param ys ordinates (loads in kg, or z-scores)
 * @returns one slope per knot, in the same order
 * @throws RangeError when the inputs are mismatched, too short, or not ascending
 * @see Fritsch & Carlson 1980, SIAM J. Numer. Anal. 17(2):238-246
 */
export function pchipSlopes(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length;
  if (n !== ys.length) throw new RangeError('pchipSlopes: xs and ys must be the same length');
  if (n < 2) throw new RangeError('pchipSlopes: need at least two knots');

  const h: number[] = [];
  const del: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = at(xs, i + 1) - at(xs, i);
    if (dx <= 0) throw new RangeError('pchipSlopes: xs must be strictly ascending');
    h.push(dx);
    del.push((at(ys, i + 1) - at(ys, i)) / dx);
  }

  const m = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const dPrev = at(del, i - 1);
    const dNext = at(del, i);
    if (dPrev * dNext <= 0) {
      m[i] = 0;
      continue;
    }
    const w1 = 2 * at(h, i) + at(h, i - 1);
    const w2 = at(h, i) + 2 * at(h, i - 1);
    m[i] = (w1 + w2) / (w1 / dPrev + w2 / dNext);
  }

  const endSlope = (hA: number, hB: number, dA: number, dB: number): number => {
    let e = ((2 * hA + hB) * dA - hA * dB) / (hA + hB);
    if (e * dA <= 0) e = 0;
    else if (dA * dB <= 0 && Math.abs(e) > Math.abs(3 * dA)) e = 3 * dA;
    return e;
  };

  if (n === 2) {
    m[0] = at(del, 0);
    m[n - 1] = at(del, 0);
  } else {
    m[0] = endSlope(at(h, 0), at(h, 1), at(del, 0), at(del, 1));
    m[n - 1] = endSlope(at(h, n - 2), at(h, n - 3), at(del, n - 2), at(del, n - 3));
  }
  return m;
}

/**
 * Evaluate a PCHIP curve, extrapolating LINEARLY from the end slopes outside the knots.
 * Callers that must not extrapolate far should clamp `x` first (see
 * {@link interpolateAtBodyweight}).
 *
 * @param xs strictly ascending abscissae
 * @param ys ordinates
 * @param slopes slopes from {@link pchipSlopes} for the same knots
 * @param x abscissa to evaluate at
 * @returns the interpolated ordinate
 * @see Fritsch & Carlson 1980, SIAM J. Numer. Anal. 17(2):238-246
 */
export function pchipEval(
  xs: readonly number[],
  ys: readonly number[],
  slopes: readonly number[],
  x: number,
): number {
  const n = xs.length;
  if (n !== ys.length || n !== slopes.length) throw new RangeError('pchipEval: mismatched input lengths');
  if (n < 2) throw new RangeError('pchipEval: need at least two knots');

  if (x <= at(xs, 0)) return at(ys, 0) + at(slopes, 0) * (x - at(xs, 0));
  if (x >= at(xs, n - 1)) return at(ys, n - 1) + at(slopes, n - 1) * (x - at(xs, n - 1));

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at(xs, mid) <= x) lo = mid;
    else hi = mid;
  }
  const h = at(xs, hi) - at(xs, lo);
  const t = (x - at(xs, lo)) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * at(ys, lo) +
    (t3 - 2 * t2 + t) * h * at(slopes, lo) +
    (-2 * t3 + 3 * t2) * at(ys, hi) +
    (t3 - t2) * at(slopes, hi)
  );
}

/**
 * Monotone-interpolate a single series in one call.
 * @param xs strictly ascending abscissae
 * @param ys ordinates
 * @param x abscissa to evaluate at (linearly extrapolated outside the knots)
 * @returns the interpolated ordinate
 * @see Fritsch & Carlson 1980
 */
export function monotoneInterpolate(xs: readonly number[], ys: readonly number[], x: number): number {
  return pchipEval(xs, ys, pchipSlopes(xs, ys), x);
}

/**
 * Clamp a bodyweight into the region where the published grid still supports an honest
 * answer: the grid itself plus {@link BODYWEIGHT_EXTRAPOLATION_MARGIN_KG} at each end.
 *
 * @param bwKg the lifter's bodyweight in kg
 * @param grid the table's ascending bodyweight grid in kg
 * @returns the bodyweight to score at, and whether clamping happened
 * @throws RangeError when the grid is empty or the bodyweight is not a finite number
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 1)
 */
export function clampBodyweightToGrid(
  bwKg: number,
  grid: readonly number[],
): { bodyweightKg: number; clamped: boolean } {
  if (!Number.isFinite(bwKg)) throw new RangeError('clampBodyweightToGrid: bodyweight must be finite');
  if (grid.length === 0) throw new RangeError('clampBodyweightToGrid: empty bodyweight grid');
  const lo = at(grid, 0) - BODYWEIGHT_EXTRAPOLATION_MARGIN_KG;
  const hi = at(grid, grid.length - 1) + BODYWEIGHT_EXTRAPOLATION_MARGIN_KG;
  if (bwKg < lo) return { bodyweightKg: lo, clamped: true };
  if (bwKg > hi) return { bodyweightKg: hi, clamped: true };
  return { bodyweightKg: bwKg, clamped: false };
}

/**
 * Interpolate one level's threshold curve at a bodyweight, with clamping.
 *
 * @param grid ascending bodyweight grid in kg
 * @param values that level's thresholds in kg at each grid bodyweight
 * @param bwKg the lifter's bodyweight in kg
 * @returns the threshold in kg (may be negative for added-weight bodyweight lifts)
 * @see strengthlevel.com 2026 standards refresh
 */
export function interpolateAtBodyweight(
  grid: readonly number[],
  values: readonly number[],
  bwKg: number,
): number {
  const { bodyweightKg } = clampBodyweightToGrid(bwKg, grid);
  if (grid.length === 1) return at(values, 0);
  return monotoneInterpolate(grid, values, bodyweightKg);
}

/** Pull one level's column out of a sex table. */
function column(table: SexStandardTable, level: Level): readonly number[] {
  switch (level) {
    case 'beginner':
      return table.beginner;
    case 'novice':
      return table.novice;
    case 'intermediate':
      return table.intermediate;
    case 'advanced':
      return table.advanced;
    case 'elite':
      return table.elite;
  }
}

/**
 * Resolve an exercise's five level thresholds at an exact bodyweight.
 *
 * Each level column is interpolated independently with PCHIP, then the five results are
 * forced to be strictly increasing (the published tables are integer-rounded, so two
 * adjacent levels can tie at light bodyweights). Values stay in the table's own units:
 * for `added_bodyweight` lifts they are ADDED weight and may legitimately be negative —
 * conversion to total system load happens in `classify.ts`.
 *
 * @param std the exercise's published standards
 * @param sex which reference distribution to read
 * @param bwKg the lifter's bodyweight in kg
 * @returns thresholds by level, the bodyweight actually used, and a clamped flag
 * @throws RangeError when the table is malformed
 * @see https://strengthlevel.com/strength-standards
 */
export function anchorsAtBodyweight(std: ExerciseStandard, sex: Sex, bwKg: number): AnchorsAtBodyweight {
  const table = sex === 'male' ? std.male : std.female;
  const { bodyweightKg, clamped } = clampBodyweightToGrid(bwKg, table.bw);

  const raw: number[] = LEVEL_ORDER.map((level) => {
    const values = column(table, level);
    if (values.length !== table.bw.length) {
      throw new RangeError(`standards table for "${std.id}" has a ${level} column of the wrong length`);
    }
    return table.bw.length === 1 ? at(values, 0) : monotoneInterpolate(table.bw, values, bodyweightKg);
  });

  // Floor externally loaded lifts at a small positive load; added-weight lifts keep
  // their negative (assisted) values.
  const floored =
    std.loadType === 'added_bodyweight' ? raw : raw.map((v) => Math.max(v, MIN_POSITIVE_THRESHOLD_KG));

  // Force strict monotonicity across levels.
  const ordered: number[] = [];
  for (let i = 0; i < floored.length; i++) {
    const v = at(floored, i);
    const prev = i === 0 ? undefined : at(ordered, i - 1);
    ordered.push(prev === undefined ? v : Math.max(v, prev + MIN_LEVEL_GAP_KG));
  }

  const anchors: Record<Level, number> = {
    beginner: at(ordered, 0),
    novice: at(ordered, 1),
    intermediate: at(ordered, 2),
    advanced: at(ordered, 3),
    elite: at(ordered, 4),
  };

  return { anchors, ordered, bodyweightUsedKg: bodyweightKg, clamped };
}

/** Convert a {@link LevelAnchors} record into LEVEL_ORDER sequence. */
export function anchorArray(anchors: LevelAnchors): number[] {
  return LEVEL_ORDER.map((level) => anchors[level]);
}

/** Plain-English methodology the UI can surface for anything in this module. */
export const INTERPOLATE_METHODOLOGY: Readonly<Record<string, MethodologyNote>> = {
  pchipSlopes: {
    summary:
      'Fits a shape-preserving curve through the published standards so a heavier lifter is never given an easier target than a lighter one.',
    source: 'Fritsch & Carlson, Monotone Piecewise Cubic Interpolation, SIAM J. Numer. Anal. 17(2):238-246, 1980',
    url: 'https://doi.org/10.1137/0717021',
  },
  pchipEval: {
    summary:
      'Reads a value off the shape-preserving curve fitted through the published standards, straightening out beyond the last published point.',
    source: 'Fritsch & Carlson, Monotone Piecewise Cubic Interpolation, SIAM J. Numer. Anal. 17(2):238-246, 1980',
    url: 'https://doi.org/10.1137/0717021',
  },
  monotoneInterpolate: {
    summary: 'Interpolates one published standards curve at your exact bodyweight.',
    source: 'strengthlevel.com 2026 standards refresh',
    url: 'https://strengthlevel.com/about',
  },
  clampBodyweightToGrid: {
    summary:
      'Keeps scoring inside the bodyweight range the published data actually covers, because strength does not scale linearly with bodyweight and extrapolating far past the data produces nonsense targets.',
    source: 'Montenegro et al., Sports Medicine - Open 2026;12:136 (n=101,898)',
    url: 'https://link.springer.com/article/10.1186/s40798-026-01111-z',
  },
  interpolateAtBodyweight: {
    summary: 'Gives one level threshold at your exact bodyweight instead of rounding you into a weight class.',
    source: 'strengthlevel.com 2026 standards refresh (bodyweight-indexed tables)',
    url: 'https://strengthlevel.com/about',
  },
  anchorsAtBodyweight: {
    summary:
      'Produces the Beginner / Novice / Intermediate / Advanced / Elite loads for this exercise at your exact bodyweight, interpolated from the published tables.',
    source: 'strengthlevel.com 2026 standards refresh (195,513,376 lifts / 27,893,268 users)',
    url: 'https://strengthlevel.com/about',
  },
  anchorArray: {
    summary: 'Lists the five level thresholds from Beginner to Elite.',
    source: 'strengthlevel.com 2026 standards refresh',
    url: 'https://strengthlevel.com/about',
  },
};
