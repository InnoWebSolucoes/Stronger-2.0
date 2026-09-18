/**
 * Estimated one-rep max (e1RM).
 *
 * ALL WEIGHTS ARE KILOGRAMS. The weight-dependent equation in particular was
 * fitted with weight in kg and its intercept is unit-dependent — feeding it
 * pounds silently shifts k by 4.58·ln(2.2046) ≈ 3.6 and corrupts every
 * estimate. The kg-only contract is load-bearing, not stylistic.
 *
 * Contents:
 *   1. the seven classical equations, each individually guarded and documented;
 *   2. the weight-dependent (WD) equation from arXiv:2603.17495;
 *   3. the RTS RPE/RIR percentage curve;
 *   4. the recommended load-dependent blend of (2) and (3);
 *   5. the set-level pipeline that turns a `LoggedSet` into an `E1rmSample`;
 *   6. per-user per-exercise k calibration.
 *
 * References (verified 2026-09):
 *  [1] Marzagão, T. (Fitbod). "A Weight-Dependent 1RM Prediction Equation
 *      Optimized on 303,494 Near-Failure Sets Across 388 Exercises."
 *      arXiv:2603.17495.
 *  [2] LeSuer, McCormick, Mayhew, Wasserstein & Arnold (1997)
 *      J Strength Cond Res 11(4):211-213 — the classical equation comparison.
 *  [3] Nuzzo, Pinto, Nosaka & Steele (2024) Sports Med 54:303-321 (PMC10933212)
 *      — 952 reps-to-failure tests, 7,289 subjects, 269 studies.
 *  [4] Zourdos et al. (2016) J Strength Cond Res 30(1):267-275 — RIR-based RPE.
 *  [5] Tuchscherer, M. — Reactive Training Systems RPE / %1RM chart.
 */

import { median } from './stats';
import type { LoggedSet, SetType } from './types';

/* ========================================================================== *
 * 1. CLASSICAL EQUATIONS                                                      *
 * ========================================================================== */

/** Identifier for every estimator this module can run. */
export type E1rmFormulaId =
  | 'epley'
  | 'brzycki'
  | 'lander'
  | 'lombardi'
  | 'mayhew'
  | 'oconner'
  | 'wathan'
  | 'wd'
  | 'rts'
  | 'blend';

/** A raw estimator: (kg, reps-to-failure) → estimated 1RM in kg, or null. */
export type E1rmFormulaFn = (weightKg: number, reps: number) => number | null;

function inDomain(weightKg: number, reps: number, maxReps: number): boolean {
  return (
    Number.isFinite(weightKg) &&
    Number.isFinite(reps) &&
    weightKg > 0 &&
    reps >= 1 &&
    reps <= maxReps
  );
}

/** Beyond this the Epley line is pure extrapolation; returns null above it. */
export const EPLEY_MAX_REPS = 30;

/**
 * Epley (1985): `1RM = w × (1 + r/30)`.
 *
 * Units: kg in, kg out. Valid 1–10 reps; usable to ~15 with growing error.
 * Error characteristics: the most accurate classical equation at high reps
 * against Nuzzo 2024's anchors (102.7% at 70%×14 reps, vs Brzycki's 109.6%),
 * but it is NOT an identity at one rep — raw Epley returns 103.33 kg for a
 * 100 kg single. This implementation applies the explicit `r === 1` guard the
 * research brief requires, so a genuine single returns itself.
 *
 * Source: [2]; identity guard per research brief §"Mayhew, Wathan, Lander and
 * O'Conner are all non-identity at 1 rep".
 */
export function epley(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, EPLEY_MAX_REPS)) return null;
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Epley WITHOUT the one-rep identity guard: `w × (1 + r/30)` for all r.
 *
 * Exposed only so the formula-comparison table and its tests can demonstrate
 * the 3.33% error at r = 1 that motivates the guard. Never surface this to a
 * user.
 */
export function epleyUnguarded(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, EPLEY_MAX_REPS)) return null;
  return weightKg * (1 + reps / 30);
}

/**
 * Rep count at which the Brzycki denominator `37 − r` reaches zero.
 * At r = 36 the equation already returns 36× the weight lifted; at r = 37 it is
 * a division by zero and above it the sign flips to negative.
 */
export const BRZYCKI_POLE_REPS = 37;

/** Guarded ceiling for Brzycki. Well below the pole at {@link BRZYCKI_POLE_REPS}. */
export const BRZYCKI_MAX_REPS = 20;

/**
 * Brzycki (1993): `1RM = w × 36 / (37 − r)`.
 *
 * Units: kg in, kg out. Valid 1–10 reps. Exact identity at one rep.
 * Error characteristics: the most accurate classical equation at LOW reps and
 * the worst at high reps — it explodes as r approaches its pole at 37 reps
 * (10× the load at 33 reps, ÷0 at 37, negative beyond). Against Nuzzo 2024 it
 * over-predicts by ~9.6% at 14 reps. Returns null above
 * {@link BRZYCKI_MAX_REPS} rather than emitting a number nobody should see.
 *
 * Source: [2], [3].
 */
export function brzycki(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, BRZYCKI_MAX_REPS)) return null;
  return (weightKg * 36) / (BRZYCKI_POLE_REPS - reps);
}

/** Rep count at which the Lander denominator `101.3 − 2.67123r` reaches zero. */
export const LANDER_POLE_REPS = 101.3 / 2.67123;

/** Guarded ceiling for Lander. */
export const LANDER_MAX_REPS = 20;

/**
 * Lander (1985): `1RM = 100w / (101.3 − 2.67123r)`.
 *
 * Units: kg in, kg out. Valid 1–10 reps. NOT an identity at one rep — returns
 * 101.39 kg for a 100 kg single (+1.4%). Behaves almost identically to Brzycki
 * through the low-rep range and shares its pole, at 37.92 reps. Guarded to
 * {@link LANDER_MAX_REPS}. Never use as a display formula.
 *
 * Source: [2].
 */
export function lander(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, LANDER_MAX_REPS)) return null;
  return (100 * weightKg) / (101.3 - 2.67123 * reps);
}

/** Guarded ceiling for Lombardi. */
export const LOMBARDI_MAX_REPS = 30;

/**
 * Lombardi (1989): `1RM = w × r^0.10`.
 *
 * Units: kg in, kg out. Valid 1–10 reps; the flattest curve of the set, so it
 * degrades gracefully rather than exploding — it is the only classical equation
 * that stays sane at 15+ reps (76.3% implied at 15 reps where Brzycki says
 * 61.1%). Exact identity at one rep (1^0.1 = 1). Error characteristics: badly
 * UNDER-predicts at moderate reps for strong lifters because its exponent is
 * load-independent.
 *
 * Source: [2].
 */
export function lombardi(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, LOMBARDI_MAX_REPS)) return null;
  return weightKg * Math.pow(reps, 0.1);
}

/** Guarded ceiling for Mayhew. */
export const MAYHEW_MAX_REPS = 30;

/**
 * Mayhew et al. (1992): `1RM = 100w / (52.2 + 41.9·e^(−0.055r))`.
 *
 * Units: kg in, kg out. Valid 1–10 reps (fitted on bench press).
 * Error characteristics: CATASTROPHIC at one rep — it returns 108.86 kg for a
 * 100 kg single (+8.9%), i.e. an implied 91.9% of 1RM for a true max. It also
 * scored worst of the four classical equations in the 303,494-set evaluation
 * (+21.9% inconsistency vs the WD equation). Computed here for completeness and
 * for the comparison screen only; never surface it as the display formula.
 *
 * Source: [2], [1].
 */
export function mayhew(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, MAYHEW_MAX_REPS)) return null;
  return (100 * weightKg) / (52.2 + 41.9 * Math.exp(-0.055 * reps));
}

/** Guarded ceiling for O'Conner. */
export const OCONNER_MAX_REPS = 30;

/**
 * O'Conner et al. (1989): `1RM = w × (1 + 0.025r)`.
 *
 * Units: kg in, kg out. Valid 1–10 reps. NOT an identity at one rep — returns
 * 102.5 kg for a 100 kg single (+2.5%). The shallowest linear model here, so it
 * systematically over-predicts at high reps (80.0% implied at 10 reps against
 * RTS's 73.9%). Never use as a display formula without the r = 1 case handled.
 *
 * Source: [2].
 */
export function oconner(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, OCONNER_MAX_REPS)) return null;
  return weightKg * (1 + 0.025 * reps);
}

/** Guarded ceiling for Wathan. */
export const WATHAN_MAX_REPS = 30;

/**
 * Wathan (1994): `1RM = 100w / (48.8 + 53.8·e^(−0.075r))`.
 *
 * Units: kg in, kg out. Valid 1–10 reps. NOT an identity at one rep — returns
 * 101.30 kg for a 100 kg single (+1.3%). Generally the strongest classical
 * performer in validation studies and the closest classical curve to the WD
 * equation at heavy loads, but the r = 1 error rules it out for display.
 *
 * Source: [2]; ranked in [1] at +17.0% inconsistency vs the WD equation.
 */
export function wathan(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, WATHAN_MAX_REPS)) return null;
  return (100 * weightKg) / (48.8 + 53.8 * Math.exp(-0.075 * reps));
}

/* ========================================================================== *
 * 2. THE WEIGHT-DEPENDENT EQUATION                                            *
 * ========================================================================== */

/** Sub-linear rep exponent in the WD equation. Source: [1]. */
export const WD_ALPHA = 0.85;
/** Intercept of k(w). Fitted with w in KILOGRAMS. Source: [1]. */
export const WD_A = -2.55;
/** Slope of k(w) on ln(w_kg). Source: [1]. */
export const WD_B = 4.58;
/** Floor on k so the equation cannot blow up at near-zero loads. Source: [1]. */
export const WD_K_MIN = 0.5;
/** Guarded ceiling for the WD equation. */
export const WD_MAX_REPS = 30;

/**
 * The load-dependent rep-conversion constant: `k(w) = −2.55 + 4.58·ln(w_kg)`,
 * floored at {@link WD_K_MIN}.
 *
 * Units: kilograms in, dimensionless out. A LOW k means each extra rep is worth
 * more 1RM, which is why a 5-rep curl is a far higher fraction of curl max than
 * a 5-rep squat is of squat max. Published anchors this reproduces exactly:
 * k(10) = 8.00, k(15) = 9.85, k(25) = 12.19, k(55) = 15.80, k(70) = 16.91,
 * k(80) = 17.52, k(150) = 20.40.
 *
 * Source: [1].
 */
export function wdK(weightKg: number): number {
  if (!Number.isFinite(weightKg)) return Number.NaN;
  return Math.max(WD_K_MIN, WD_A + WD_B * Math.log(Math.max(weightKg, 1e-6)));
}

/**
 * Weight-dependent 1RM: `1RM = w × (1 + (r−1)^0.85 / k(w))`.
 *
 * Units: kg in, kg out. Valid 1–12 reps-to-failure (the app caps at
 * {@link E1RM_MAX_REPS}); guarded to {@link WD_MAX_REPS}.
 * Error characteristics: fitted on 303,494 near-failure sets from 14,966 users
 * across 388 exercises, and 17.0–21.9% more self-consistent than Brzycki,
 * Epley, Wathan and Mayhew on within-lifter SD(log 1RM). Exact identity at one
 * rep. It ASSUMES the set was near failure — feed it a set with 4 reps in
 * reserve and it lowballs. Bodyweight and assisted exercises were excluded from
 * the fit, so applying it to a pull-up's system load is extrapolation.
 *
 * Source: [1].
 */
export function weightDependent(weightKg: number, reps: number): number | null {
  if (!inDomain(weightKg, reps, WD_MAX_REPS)) return null;
  if (reps <= 1) return weightKg;
  return weightKg * (1 + Math.pow(reps - 1, WD_ALPHA) / wdK(weightKg));
}

/**
 * WD with an explicit k, for per-user per-exercise calibration.
 *
 * Units: kg in, kg out. `k` is clamped at {@link WD_K_MIN}.
 * Source: [1], applied per user (see {@link calibrateK}).
 */
export function e1rmWithK(weightKg: number, repsToFailure: number, k: number): number | null {
  if (!inDomain(weightKg, repsToFailure, WD_MAX_REPS)) return null;
  if (repsToFailure <= 1) return weightKg;
  return weightKg * (1 + Math.pow(repsToFailure - 1, WD_ALPHA) / Math.max(WD_K_MIN, k));
}

/* ========================================================================== *
 * 3. THE RTS RPE / RIR CURVE                                                  *
 * ========================================================================== */

/**
 * The Reactive Training Systems %1RM chart, stored as the ten numbers it
 * actually is.
 *
 * Structural fact, verifiable against any printed RTS chart: RPE 9 at r reps
 * equals RPE 10 at r+1 reps in EVERY cell (RPE 9 × 1 = 95.5% = RPE 10 × 2).
 * So the whole 2-D grid is one 1-D curve indexed by reps-to-failure
 * `n = reps + RIR = reps + (10 − RPE)`, and the 90-cell table is generated
 * rather than transcribed (see {@link buildRpeChart}).
 *
 * Index i holds the percentage for n = i + 1 reps to failure.
 *
 * WARNING: the perfectly linear "2.5% per step" chart circulating on calculator
 * sites is NOT the RTS chart. It puts 5 reps @ RPE 8 at 80.0% instead of the
 * real 81.1%, an error of up to 3.6 percentage points (~5 kg on a 140 kg squat).
 *
 * Source: [5]; cross-checked against store.reactivetrainingsystems.com.
 */
export const RTS_PCT_BY_REPS_TO_FAILURE: readonly number[] = [
  100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9,
];

/** Highest reps-to-failure the published RTS chart covers. */
export const RTS_MAX_REPS_TO_FAILURE = RTS_PCT_BY_REPS_TO_FAILURE.length;

/** Lowest RPE the published RTS chart covers. Below this it is undefined. */
export const RPE_MIN = 6;
/** Highest RPE on the scale: a true, no-more-reps maximum. */
export const RPE_MAX = 10;
/** Reps in reserve can never be negative. */
export const RIR_MIN = 0;

/** RPE → reps in reserve. RPE 8 ⇒ 2 reps left. Source: [4]. */
export function rpeToRir(rpe: number): number {
  return RPE_MAX - rpe;
}

/** Reps in reserve → RPE. 2 reps left ⇒ RPE 8. Source: [4]. */
export function rirToRpe(rir: number): number {
  return RPE_MAX - rir;
}

/**
 * %1RM for a given reps-to-failure equivalent, in percent (100 = a true max).
 *
 * Linearly interpolates between table entries so half-RPE values fall out for
 * free: n = 1.5 (RPE 9.5 for a single) → 97.75%, which published charts print
 * as 97.8. Returns null outside 1…{@link RTS_MAX_REPS_TO_FAILURE} rather than
 * extrapolating a table that does not exist — callers hand off to the WD curve
 * there.
 *
 * Source: [5].
 */
export function rtsPercentForRepsToFailure(repsToFailure: number): number | null {
  const n = repsToFailure;
  if (!Number.isFinite(n) || n < 1 || n > RTS_MAX_REPS_TO_FAILURE) return null;
  const lo = Math.floor(n);
  const hi = Math.ceil(n);
  const a = RTS_PCT_BY_REPS_TO_FAILURE[lo - 1];
  const b = RTS_PCT_BY_REPS_TO_FAILURE[hi - 1];
  if (a === undefined || b === undefined) return null;
  if (lo === hi) return a;
  return a + (b - a) * (n - lo);
}

/**
 * %1RM for `reps` performed at `rpe`, per the RTS chart.
 *
 * Returns null when the RPE is off the published scale (below
 * {@link RPE_MIN} or above {@link RPE_MAX}) or when reps + RIR runs past the
 * end of the chart.
 *
 * Source: [5].
 */
export function rtsPercent(reps: number, rpe: number): number | null {
  if (!Number.isFinite(reps) || !Number.isFinite(rpe)) return null;
  if (reps < 1) return null;
  if (rpe < RPE_MIN || rpe > RPE_MAX) return null;
  return rtsPercentForRepsToFailure(reps + rpeToRir(rpe));
}

/**
 * e1RM in kg from the RTS chart: `w × 100 / pct`.
 *
 * Units: kg in, kg out. Null when the chart does not cover the set.
 * Source: [5].
 */
export function rtsE1rm(weightKg: number, reps: number, rpe: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const pct = rtsPercent(reps, rpe);
  if (pct === null || pct <= 0) return null;
  return (weightKg * 100) / pct;
}

/**
 * Render the full printable RPE × reps grid from the ten stored numbers.
 *
 * Values are percentages rounded to one decimal, matching the published chart;
 * `null` marks a cell that is off the published table (we do not fake an
 * extrapolation). Generating it guarantees the printed chart and the engine can
 * never drift apart.
 *
 * Source: [5].
 */
export function buildRpeChart(
  rpes: readonly number[] = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6],
  maxReps = 10,
): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const rpe of rpes) {
    out[`RPE ${rpe}`] = Array.from({ length: maxReps }, (_, i) => {
      const pct = rtsPercent(i + 1, rpe);
      return pct === null ? null : Math.round(pct * 10) / 10;
    });
  }
  return out;
}

/* ========================================================================== *
 * 4. THE RECOMMENDED BLENDED ESTIMATOR                                        *
 * ========================================================================== */

/** Load (kg) below which the estimator is pure WD. */
export const BLEND_FLOOR_KG = 40;
/** Maximum share the RTS chart is ever given. */
export const BLEND_MAX_RTS_WEIGHT = 0.6;
/** kg of load per unit of blend ramp. */
export const BLEND_RAMP_KG = 100;

/**
 * Share of the estimate taken from the RTS chart, as a fraction 0…0.6.
 *
 * `max(0, min(0.6, 0.6 × (w − 40) / 100))`: 0% below 40 kg, 36% at 100 kg,
 * capped at 60% from 140 kg up.
 *
 * Rationale: RTS was derived from heavy barbell powerlifting data and is best
 * where loads are heavy; the WD equation was fitted across 388 exercises and is
 * markedly better on light isolation work (+21.9% consistency vs Brzycki on
 * isolation, only +7.9% on barbell bench). The two agree to within 1.3
 * percentage points at 100 kg, which is what makes a cross-fade safe rather
 * than a fudge.
 *
 * Source: research brief §"WD @ heavy loads independently reproduces the RTS
 * chart to within ~1.2%"; [1], [5].
 */
export function rtsBlendWeight(weightKg: number): number {
  if (!Number.isFinite(weightKg)) return 0;
  const x = (weightKg - BLEND_FLOOR_KG) / BLEND_RAMP_KG;
  return Math.max(0, Math.min(BLEND_MAX_RTS_WEIGHT, BLEND_MAX_RTS_WEIGHT * x));
}

/**
 * THE RECOMMENDED ESTIMATOR: weight-dependent equation cross-faded toward the
 * RTS chart as absolute load rises.
 *
 * Units: kg and reps-to-failure in, kg out. Valid 1–12 reps-to-failure; beyond
 * {@link RTS_MAX_REPS_TO_FAILURE} the RTS term drops out and the result is pure
 * WD. Returns null if the WD term itself is out of domain.
 *
 * Source: research brief §Recommendations, first bullet.
 */
export function blendedE1rm(weightKg: number, repsToFailure: number): number | null {
  const wd = weightDependent(weightKg, repsToFailure);
  if (wd === null) return null;
  const pct = rtsPercentForRepsToFailure(repsToFailure);
  if (pct === null || pct <= 0) return wd;
  const rts = (weightKg * 100) / pct;
  const share = rtsBlendWeight(weightKg);
  return (1 - share) * wd + share * rts;
}

/** Every estimator, addressable by id. `rts` and `blend` need no extra args. */
export const E1RM_FORMULAS: Record<E1rmFormulaId, E1rmFormulaFn> = {
  epley,
  brzycki,
  lander,
  lombardi,
  mayhew,
  oconner,
  wathan,
  wd: weightDependent,
  rts: (weightKg, reps) => {
    const pct = rtsPercentForRepsToFailure(reps);
    if (pct === null || pct <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) return null;
    return (weightKg * 100) / pct;
  },
  blend: blendedE1rm,
};

/** Human-readable facts about an estimator, for the comparison screen. */
export interface E1rmFormulaMeta {
  id: E1rmFormulaId;
  label: string;
  /** Rep range the formula's own source considers valid. */
  validReps: readonly [number, number];
  /** Above this the implementation returns null. */
  hardMaxReps: number;
  /** Does it return exactly `w` for a true single? */
  identityAtOneRep: boolean;
  /** Safe to show a user as "your e1RM"? */
  safeForDisplay: boolean;
  source: string;
}

/**
 * Error characteristics and validity of every estimator, in one table.
 *
 * `safeForDisplay` is false for Mayhew, Wathan, Lander and O'Conner because all
 * four return a 1RM ABOVE a weight the lifter just pressed for a single
 * (Mayhew by 8.9%), which destroys trust instantly.
 *
 * Source: [1], [2], [3], [5] and research brief §Recommendations.
 */
export const E1RM_FORMULA_META: Record<E1rmFormulaId, E1rmFormulaMeta> = {
  epley: {
    id: 'epley',
    label: 'Epley',
    validReps: [1, 10],
    hardMaxReps: EPLEY_MAX_REPS,
    identityAtOneRep: true,
    safeForDisplay: true,
    source: 'Epley 1985; LeSuer et al. 1997 JSCR 11(4):211-213',
  },
  brzycki: {
    id: 'brzycki',
    label: 'Brzycki',
    validReps: [1, 10],
    hardMaxReps: BRZYCKI_MAX_REPS,
    identityAtOneRep: true,
    safeForDisplay: true,
    source: 'Brzycki 1993; pole at 37 reps',
  },
  lander: {
    id: 'lander',
    label: 'Lander',
    validReps: [1, 10],
    hardMaxReps: LANDER_MAX_REPS,
    identityAtOneRep: false,
    safeForDisplay: false,
    source: 'Lander 1985; pole at 37.9 reps',
  },
  lombardi: {
    id: 'lombardi',
    label: 'Lombardi',
    validReps: [1, 10],
    hardMaxReps: LOMBARDI_MAX_REPS,
    identityAtOneRep: true,
    safeForDisplay: true,
    source: 'Lombardi 1989',
  },
  mayhew: {
    id: 'mayhew',
    label: 'Mayhew',
    validReps: [1, 10],
    hardMaxReps: MAYHEW_MAX_REPS,
    identityAtOneRep: false,
    safeForDisplay: false,
    source: 'Mayhew et al. 1992 (+8.9% at one rep)',
  },
  oconner: {
    id: 'oconner',
    label: "O'Conner",
    validReps: [1, 10],
    hardMaxReps: OCONNER_MAX_REPS,
    identityAtOneRep: false,
    safeForDisplay: false,
    source: "O'Conner et al. 1989",
  },
  wathan: {
    id: 'wathan',
    label: 'Wathan',
    validReps: [1, 10],
    hardMaxReps: WATHAN_MAX_REPS,
    identityAtOneRep: false,
    safeForDisplay: false,
    source: 'Wathan 1994',
  },
  wd: {
    id: 'wd',
    label: 'Weight-dependent',
    validReps: [1, 12],
    hardMaxReps: WD_MAX_REPS,
    identityAtOneRep: true,
    safeForDisplay: true,
    source: 'Marzagão, arXiv:2603.17495 (303,494 sets)',
  },
  rts: {
    id: 'rts',
    label: 'RTS chart',
    validReps: [1, RTS_MAX_REPS_TO_FAILURE],
    hardMaxReps: RTS_MAX_REPS_TO_FAILURE,
    identityAtOneRep: true,
    safeForDisplay: true,
    source: 'Tuchscherer / Reactive Training Systems',
  },
  blend: {
    id: 'blend',
    label: 'Stronger blend',
    validReps: [1, 12],
    hardMaxReps: WD_MAX_REPS,
    identityAtOneRep: true,
    safeForDisplay: true,
    source: 'WD × RTS cross-fade; research brief §Recommendations',
  },
};

/**
 * Implied %1RM for a formula: `weight ÷ predicted 1RM × 100`.
 *
 * This is the number the comparison table in the research brief prints, and the
 * honest way to compare estimators — it removes the load and leaves the shape
 * of the curve. Null when the formula is out of domain.
 */
export function percentOf1rm(
  formula: E1rmFormulaId,
  weightKg: number,
  reps: number,
): number | null {
  const fn = E1RM_FORMULAS[formula];
  const e1rm = fn(weightKg, reps);
  if (e1rm === null || e1rm <= 0) return null;
  return (weightKg / e1rm) * 100;
}

/* ========================================================================== *
 * 5. THE SET-LEVEL PIPELINE                                                   *
 * ========================================================================== */

/**
 * Prior reps-in-reserve by set type, used when the lifter leaves RPE blank.
 *
 * Deliberately conservative: lifters who believe they are at failure typically
 * leave 2–5 reps in reserve, and Zourdos 2016 found novices report RPE 8.96 at
 * a true 1RM. Personalise with {@link personalisedRirPrior}.
 *
 * Source: [4]; research brief §"RPE defaults when the user leaves it blank".
 */
export const DEFAULT_RIR_PRIOR: Record<SetType, number> = {
  warmup: 6,
  normal: 2,
  dropset: 1,
  failure: 0,
  myorep: 0,
  cluster: 1,
  amrap: 0,
};

/** Where a set's reps-in-reserve came from. Drives {@link RIR_SOURCE_CONFIDENCE}. */
export type RirSource = 'explicitRir' | 'explicitRpe' | 'amrapFlag' | 'fatigueDetected' | 'prior';

/**
 * Confidence (0–1) attached to an e1RM sample by the provenance of its RIR.
 *
 * Used to weight the session-best picker, the trend smoother, and the extra
 * margin a low-confidence PR must clear.
 *
 * Source: research brief §"Attach a 0-1 confidence to every e1RM sample".
 */
export const RIR_SOURCE_CONFIDENCE: Record<RirSource, number> = {
  explicitRir: 1.0,
  explicitRpe: 1.0,
  amrapFlag: 0.85,
  fatigueDetected: 0.7,
  prior: 0.45,
};

/** RIR assumed when a set is flagged as fatigue-detected but not as failure. */
export const FATIGUE_DETECTED_RIR = 0.5;

/**
 * Personalised RIR prior: shrink the lifter's own median logged RIR toward the
 * global prior with weight n/(n+8).
 *
 * Units: reps. With no observations it returns the global prior unchanged; at
 * 8 observations the lifter's own median carries half the weight.
 *
 * Source: research brief §"Default a blank RPE to RIR 2 … then personalise".
 */
export function personalisedRirPrior(
  setType: SetType,
  observedRirs: readonly number[],
  globalPrior: number = DEFAULT_RIR_PRIOR[setType],
  priorStrength = 8,
): number {
  const n = observedRirs.length;
  if (n === 0) return globalPrior;
  const med = median(observedRirs);
  if (!Number.isFinite(med)) return globalPrior;
  const w = n / (n + priorStrength);
  return w * med + (1 - w) * globalPrior;
}

/** The resolved proximity-to-failure of one set, with its provenance. */
export interface ResolvedRir {
  /** Reps left in the tank. */
  rir: number;
  /** 0–1, before the high-rep taper. */
  confidence: number;
  source: RirSource;
}

/**
 * Resolve how close a set was to failure, from whatever the lifter gave us.
 *
 * Priority: explicit RIR → explicit RPE → AMRAP/failure flag → fatigue detected
 * → set-type prior. Units: reps.
 *
 * Source: research brief §3 "THE e1RM PIPELINE".
 */
export function resolveRir(set: LoggedSet, rirPrior?: number): ResolvedRir {
  if (set.rirObserved != null && Number.isFinite(set.rirObserved)) {
    return {
      rir: Math.max(RIR_MIN, set.rirObserved),
      confidence: RIR_SOURCE_CONFIDENCE.explicitRir,
      source: 'explicitRir',
    };
  }
  if (set.rpe != null && Number.isFinite(set.rpe)) {
    return {
      rir: Math.max(RIR_MIN, rpeToRir(set.rpe)),
      confidence: RIR_SOURCE_CONFIDENCE.explicitRpe,
      source: 'explicitRpe',
    };
  }
  if (set.setType === 'amrap' || set.setType === 'failure') {
    return { rir: 0, confidence: RIR_SOURCE_CONFIDENCE.amrapFlag, source: 'amrapFlag' };
  }
  if (set.fatigueDetected === true) {
    return {
      rir: FATIGUE_DETECTED_RIR,
      confidence: RIR_SOURCE_CONFIDENCE.fatigueDetected,
      source: 'fatigueDetected',
    };
  }
  const prior = rirPrior ?? DEFAULT_RIR_PRIOR[set.setType];
  return { rir: Math.max(RIR_MIN, prior), confidence: RIR_SOURCE_CONFIDENCE.prior, source: 'prior' };
}

/** One e1RM observation derived from one set. */
export interface E1rmSample {
  setId: string;
  exerciseId: string;
  /** Estimated one-rep max, kg. */
  e1rmKg: number;
  /** The load actually moved for this rep, kg (system load for bodyweight work). */
  loadKg: number;
  method: E1rmFormulaId;
  /** reps + RIR. The single canonical input to every strength calculation. */
  repsToFailure: number;
  /** 0–1, after the high-rep taper. */
  confidence: number;
  rirSource: RirSource;
}

/**
 * Hard cap on reps-to-failure. Above 12 every formula fans out by more than
 * 15 percentage points and runs 5–10% hot against Nuzzo 2024's meta-regression,
 * so we return null rather than a number we cannot stand behind. Source: [3].
 */
export const E1RM_MAX_REPS = 12;

/**
 * Hard cap on reps in reserve. A set five or more reps from failure says
 * essentially nothing about a maximum. Source: [3], [4].
 */
export const E1RM_MAX_RIR = 4;

/** Reps logged above this are a data-entry error, not a set. */
export const E1RM_MAX_LOGGED_REPS = 30;

/** Confidence taper: reps far from a single carry less information. */
export const REP_CONFIDENCE_PENALTY_PER_REP = 0.045;
/** Most confidence the rep taper can remove. */
export const REP_CONFIDENCE_PENALTY_CAP = 0.45;
/** Reps-to-failure below which no taper applies. */
export const REP_CONFIDENCE_FREE_REPS = 3;

/**
 * Multiplier applied to a sample's confidence for being far from a single.
 * `1 − min(0.45, 0.045 × max(0, n − 3))`: 1.0 at n ≤ 3, 0.82 at n = 7,
 * 0.595 at n = 12.
 *
 * Source: research brief §3.
 */
export function repConfidencePenalty(repsToFailure: number): number {
  const over = Math.max(0, repsToFailure - REP_CONFIDENCE_FREE_REPS);
  return 1 - Math.min(REP_CONFIDENCE_PENALTY_CAP, REP_CONFIDENCE_PENALTY_PER_REP * over);
}

/** Options for {@link estimateSetE1rm}. */
export interface EstimateSetOptions {
  /**
   * System load in kg for this set, when it differs from `set.weightKg` —
   * e.g. bodyweight + belt for a pull-up. Compute it with `repLoadKg()` from
   * `volume.ts`.
   */
  totalLoadKg?: number;
  /** Override the blank-RPE prior, e.g. from {@link personalisedRirPrior}. */
  rirPrior?: number;
  /** Estimator to use. Defaults to `'blend'`, the recommended one. */
  formula?: E1rmFormulaId;
  /** Per-user per-exercise k from {@link calibrateK}. Overrides the formula. */
  calibratedK?: number;
}

/**
 * Turn one logged set into an e1RM sample, or null if it cannot support one.
 *
 * Returns null for: incomplete sets, warm-ups, reps outside 1…30, non-positive
 * load, RIR above {@link E1RM_MAX_RIR}, and reps-to-failure above
 * {@link E1RM_MAX_REPS}. Units: kg in, kg out.
 *
 * Source: research brief §3 "THE e1RM PIPELINE".
 */
export function estimateSetE1rm(
  set: LoggedSet,
  opts: EstimateSetOptions = {},
): E1rmSample | null {
  if (!set.completed) return null;
  if (set.setType === 'warmup') return null;
  if (!Number.isFinite(set.reps) || set.reps < 1 || set.reps > E1RM_MAX_LOGGED_REPS) return null;

  const loadKg = opts.totalLoadKg ?? set.weightKg;
  if (!Number.isFinite(loadKg) || loadKg <= 0) return null;

  const resolved = resolveRir(set, opts.rirPrior);
  if (resolved.rir > E1RM_MAX_RIR) return null;

  const repsToFailure = set.reps + resolved.rir;
  if (repsToFailure > E1RM_MAX_REPS) return null;

  let e1rmKg: number | null;
  let method: E1rmFormulaId;
  if (opts.calibratedK != null) {
    e1rmKg = e1rmWithK(loadKg, repsToFailure, opts.calibratedK);
    method = 'wd';
  } else {
    method = opts.formula ?? 'blend';
    e1rmKg = E1RM_FORMULAS[method](loadKg, repsToFailure);
    if (e1rmKg === null && method !== 'wd') {
      // The RTS chart stops at 10 reps-to-failure; fall back rather than fail.
      e1rmKg = weightDependent(loadKg, repsToFailure);
      method = 'wd';
    }
  }
  if (e1rmKg === null) return null;

  return {
    setId: set.id,
    exerciseId: set.exerciseId,
    e1rmKg,
    loadKg,
    method,
    repsToFailure,
    confidence: resolved.confidence * repConfidencePenalty(repsToFailure),
    rirSource: resolved.source,
  };
}

/* ========================================================================== *
 * 6. PER-USER, PER-EXERCISE k CALIBRATION                                     *
 * ========================================================================== */

/** Result of a k calibration. */
export interface KCalibration {
  /** The shrunk k to use in {@link e1rmWithK}. */
  k: number;
  /** The unshrunk grid-search optimum, or null if there was not enough data. */
  rawK: number | null;
  /** Population k(w) at the lifter's median load on this exercise. */
  priorK: number;
  /** Usable sets that fed the solve. */
  n: number;
  /**
   * True when the prior still carries most of the weight, i.e. the population
   * curve contributes more than half of `k`. Equivalent to
   * `n < priorStrength` — see {@link CALIBRATION_PRIOR_MAJORITY_WEIGHT}.
   */
  shrunk: boolean;
}

/** Fewest usable near-failure sets before a solve is attempted at all. */
export const CALIBRATION_MIN_SETS = 3;
/** Sets at which the app promotes a calibrated k to the primary estimator. */
export const CALIBRATION_RECOMMENDED_SETS = 6;
/** Grid-search bounds and step for k. */
export const CALIBRATION_K_RANGE: readonly [number, number] = [3, 45];
export const CALIBRATION_K_STEP = 0.05;

/**
 * Own-data share below which the population prior still carries the majority of
 * `k`, and the calibration is therefore reported as `shrunk`.
 *
 * `k = w·rawK + (1 − w)·priorK` with `w = n/(n + priorStrength)`, so the prior's
 * share is `1 − w`. It is the majority exactly when `w < 0.5`, i.e. when
 * `n < priorStrength`. Shrinkage falls monotonically as evidence accumulates:
 * at the default strength of 8, 3 sets give the prior 73%, 6 sets 57%, 11 sets
 * 42% — so 11 sets is no longer shrunk.
 */
export const CALIBRATION_PRIOR_MAJORITY_WEIGHT = 0.5;

/**
 * Solve for the lifter's own k on one exercise, then shrink it toward the
 * population curve.
 *
 * Method (the same objective [1] optimises globally, applied per user): grid
 * search k over [3, 45] for the value that minimises the variance of
 * log(e1RM) across the lifter's near-failure sets — i.e. the k that makes their
 * own sets agree with each other — then shrink toward `wdK(median load)` with
 * weight n/(n+priorStrength).
 *
 * Units: sets carry kg and reps-to-failure; `k` is dimensionless. Only sets
 * with 2–12 reps-to-failure and positive load are used. With fewer than
 * {@link CALIBRATION_MIN_SETS} usable sets it returns the population prior
 * untouched.
 *
 * A grinder whose reps fall off a cliff gets a low k (each rep worth more); an
 * endurance-y lifter who can rep out near max gets a high k.
 *
 * Source: [1]; research brief §"Per-user, per-exercise k calibration".
 */
export function calibrateK(
  sets: readonly { weightKg: number; repsToFailure: number }[],
  priorStrength = 8,
): KCalibration {
  const usable = sets.filter(
    (s) =>
      Number.isFinite(s.weightKg) &&
      s.weightKg > 0 &&
      s.repsToFailure >= 2 &&
      s.repsToFailure <= E1RM_MAX_REPS,
  );

  if (usable.length < CALIBRATION_MIN_SETS) {
    const loads = sets.map((s) => s.weightKg).filter((w) => Number.isFinite(w) && w > 0);
    const med = loads.length > 0 ? median(loads) : 20;
    const priorK = wdK(med);
    return { k: priorK, rawK: null, priorK, n: usable.length, shrunk: true };
  }

  const priorK = wdK(median(usable.map((s) => s.weightKg)));

  const objective = (k: number): number => {
    let total = 0;
    const logs: number[] = [];
    for (const s of usable) {
      const est = s.weightKg * (1 + Math.pow(s.repsToFailure - 1, WD_ALPHA) / k);
      const l = Math.log(est);
      logs.push(l);
      total += l;
    }
    const mean = total / logs.length;
    let variance = 0;
    for (const l of logs) variance += (l - mean) ** 2;
    return variance / logs.length;
  };

  const [kLo, kHi] = CALIBRATION_K_RANGE;
  let rawK = priorK;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let k = kLo; k <= kHi + 1e-9; k += CALIBRATION_K_STEP) {
    const v = objective(k);
    if (v < bestValue) {
      bestValue = v;
      rawK = k;
    }
  }

  const w = usable.length / (usable.length + priorStrength);
  return {
    k: w * rawK + (1 - w) * priorK,
    rawK,
    priorK,
    n: usable.length,
    shrunk: w < CALIBRATION_PRIOR_MAJORITY_WEIGHT,
  };
}
