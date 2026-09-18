/**
 * Classification of a single lift into a strength level, with a continuous position
 * inside that level so the UI can show progress instead of a bare label.
 *
 * THE CORE PRIMITIVE. The five published level loads at the lifter's exact bodyweight
 * are five quantiles of one distribution, at z = −1.6449 / −0.8416 / 0 / +0.8416 /
 * +1.6449. Fitting a monotone spline through the five (ln load, z) points turns any load
 * into a z-score, and percentile, points, rank and per-muscle classification are then all
 * deterministic functions of z. The spline is used rather than a fitted lognormal
 * because the real distribution is left-skewed in log space: for the male 80 kg bench the
 * implied sigma falls from 0.3405 at P5 to 0.2626 at P95, and a single lognormal would
 * misplace an Elite lifter by about a third of a tier.
 *
 * Load normalisation matters as much as the maths:
 *  - Bodyweight lifts are published as ADDED weight and go negative, so they are scored
 *    as total system load T = 0.93·BW + added, which is always positive and well behaved.
 *  - Dumbbell tables are PER DUMBBELL and already include the ~2 kg handle. Logging both
 *    dumbbells and comparing against a per-dumbbell table is a 2x error.
 *
 * All loads are in KILOGRAMS.
 *
 * @see https://strengthlevel.com/about
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Parts 5 and 6)
 */

import { applyAgeGrading, blendReferenceAnchors, defaultAgeMode, referenceMaleShare, type AgeMode, type CompareAgainst } from './age-sex';
import { anchorsAtBodyweight, pchipEval, pchipSlopes } from './interpolate';
import { percentileWithConfidence, type PercentileEstimate } from './percentile';
import {
  ANCHOR_Z,
  LEVEL_ORDER,
  LEVEL_Z,
  SCORE_INTERCEPT,
  SCORE_SLOPE,
  type ClassifiedLevel,
  type ExerciseStandard,
  type Level,
  type MethodologyNote,
  type Sex,
} from './standards-data';

/** Lowest z the engine will report. Below P5 the mapping is extrapolation, not data. */
export const MIN_Z = -3.5;
/** Highest z the engine will report. */
export const MAX_Z = 4.5;
/** z treated as the floor of the "untrained" band when showing progress toward Beginner. */
export const UNTRAINED_FLOOR_Z = -3.0;
/** Smallest system load the engine will take a logarithm of, in kg. */
const MIN_SYSTEM_LOAD_KG = 0.5;

/** What the app knows about how well evidenced a lift's e1RM is. */
export interface LiftEvidence {
  /** Qualifying working sets behind the estimate. */
  readonly nSets: number;
  /** Distinct sessions those sets came from. */
  readonly nSessions: number;
  /** Age of the estimate in days. */
  readonly ageDays: number;
}

/** Evidence assumed when a caller supplies none: one set, one session, today. */
export const DEFAULT_LIFT_EVIDENCE: LiftEvidence = { nSets: 1, nSessions: 1, ageDays: 0 };

/** The lifter, as far as the standards engine is concerned. */
export interface LifterProfile {
  /** Reference table to read. Not a claim about the user; see `compareAgainst`. */
  readonly sex: Sex;
  readonly bodyweightKg: number;
  readonly age: number;
  /** Defaults to age-graded under 23 and over 40, open class in between. */
  readonly ageMode?: AgeMode;
  /** Which population to be compared against. Defaults to `sex`. */
  readonly compareAgainst?: CompareAgainst;
  /** Male share of the app population, used only when comparing against "both". */
  readonly appMaleShare?: number;
}

/** One lift performance to classify. */
export interface LiftPerformance {
  /** The exercise's published standards. */
  readonly standard: ExerciseStandard;
  /**
   * Estimated 1RM in kg, in the units the standards table uses: per dumbbell for
   * `perSide` lifts, ADDED weight (possibly negative) for bodyweight lifts.
   */
  readonly e1rmKg: number;
  /** Set when `e1rmKg` is the combined load of both dumbbells and must be halved. */
  readonly isTotalOfBothImplements?: boolean;
  /** How well evidenced the estimate is. Omitted means {@link DEFAULT_LIFT_EVIDENCE}. */
  readonly evidence?: LiftEvidence;
}

/** Where a lifter sits inside the five published levels. */
export interface LevelPosition {
  /** The level reached, or 'untrained' below the Beginner (P5) anchor. */
  readonly level: ClassifiedLevel;
  /** 0-1 position between this level's anchor and the next one. */
  readonly progressToNext: number;
  /** The level being worked toward, or null at Elite. */
  readonly nextLevel: Level | null;
  /** z-score still needed to reach `nextLevel`, or null at Elite. */
  readonly zToNext: number | null;
}

/** Result of classifying one lift. */
export interface LiftClassification {
  readonly exerciseId: string;
  /** Standardised score against the reference population. */
  readonly z: number;
  /** Rank points, S = 36 + 18z, clipped to [0, 120]. */
  readonly score: number;
  /** Level and continuous position inside it. */
  readonly position: LevelPosition;
  /** Percentile with its confidence band. */
  readonly percentile: PercentileEstimate;
  /** The five level thresholds in the units the user logs, after bodyweight and age adjustment. */
  readonly thresholdsKg: Readonly<Record<Level, number>>;
  /** Load in logged units needed for the next level, or null at Elite. */
  readonly nextLevelLoadKg: number | null;
  /** Additional kg needed for the next level, or null at Elite. */
  readonly kgToNextLevel: number | null;
  /** Measurement noise of this lift as a probe of underlying strength, in z units. */
  readonly tau: number;
  /** 'ranked' once the evidence bar is met, 'provisional' until then. */
  readonly state: 'ranked' | 'provisional';
  /** Machine-readable reasons the classification is still provisional. */
  readonly provisionalReasons: readonly string[];
  /** True when the lifter's bodyweight sat outside the published grid and was clamped. */
  readonly bodyweightClamped: boolean;
  /** Age mode actually applied. */
  readonly ageMode: AgeMode;
  /** Plain-English sentence the UI can surface verbatim. */
  readonly explanation: string;
}

/** Read an array element, failing loudly instead of silently producing NaN. */
function at(values: readonly number[], index: number): number {
  const v = values[index];
  if (v === undefined) throw new RangeError(`index ${index} out of range (length ${values.length})`);
  return v;
}

/**
 * Normalise a logged load into the units the standards table uses: halve it when the
 * user logged both dumbbells against a per-dumbbell table.
 *
 * Strength Level states that dumbbell standards are for ONE dumbbell and include the
 * ~2 kg handle. Hevy and Strong both log per dumbbell, so this is usually a no-op, but
 * the flag exists because getting it wrong is a silent 2x error.
 *
 * @param std the exercise's published standards
 * @param loggedKg load as logged, in kg
 * @param isTotalOfBothImplements true when `loggedKg` covers both dumbbells
 * @returns load in table units, in kg
 * @see https://strengthlevel.com/strength-standards/dumbbell-bench-press/kg
 */
export function normaliseLoggedLoad(
  std: ExerciseStandard,
  loggedKg: number,
  isTotalOfBothImplements = false,
): number {
  if (std.perSide === true && isTotalOfBothImplements) return loggedKg / 2;
  return loggedKg;
}

/**
 * Convert a load in table units to total system load in kg.
 *
 * For pull-ups, chin-ups and dips the published number is added weight and may be
 * negative (assistance), so it is converted to T = bodyweightFraction·BW + added, where
 * bodyweightFraction ≈ 0.93 is the share of body mass actually being lifted. Everything
 * else passes through unchanged.
 *
 * @param std the exercise's published standards
 * @param tableUnitsKg load in the table's own units, in kg
 * @param bodyweightKg the lifter's bodyweight in kg
 * @returns total system load in kg, floored at 0.5 kg so it can be logged safely
 * @see https://strengthlevel.com/strength-standards/pull-ups/kg
 */
export function toSystemLoadKg(std: ExerciseStandard, tableUnitsKg: number, bodyweightKg: number): number {
  if (std.loadType !== 'added_bodyweight') return Math.max(tableUnitsKg, MIN_SYSTEM_LOAD_KG);
  const k = std.bodyweightFraction ?? 0.93;
  return Math.max(k * bodyweightKg + tableUnitsKg, MIN_SYSTEM_LOAD_KG);
}

/**
 * Convert a total system load back into the units the user logs, i.e. subtract the
 * bodyweight component again for bodyweight lifts.
 *
 * @param std the exercise's published standards
 * @param systemLoadKg total system load in kg
 * @param bodyweightKg the lifter's bodyweight in kg
 * @returns load in table units (added weight for bodyweight lifts), in kg
 * @see https://strengthlevel.com/strength-standards/dips/kg
 */
export function toLoggedUnitsKg(std: ExerciseStandard, systemLoadKg: number, bodyweightKg: number): number {
  if (std.loadType !== 'added_bodyweight') return systemLoadKg;
  const k = std.bodyweightFraction ?? 0.93;
  return systemLoadKg - k * bodyweightKg;
}

/** Force a series to be strictly increasing so ln-space interpolation is well posed. */
function strictlyIncreasing(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = at(values, i);
    if (i === 0) {
      out.push(v);
      continue;
    }
    const prev = at(out, i - 1);
    out.push(v <= prev ? prev + 1e-6 : v);
  }
  return out;
}

/**
 * Map a load to a z-score against five level anchors.
 *
 * Monotone (PCHIP) spline through the five (ln load, z) anchor points, linear beyond the
 * ends. Reproduces the published tables exactly at the anchors and generalises smoothly
 * between and beyond them. The result is clamped to [-3.5, +4.5]: outside that range the
 * mapping is pure extrapolation and no honest number exists.
 *
 * @param systemLoadKg total system load in kg (positive)
 * @param anchorsKg the five level thresholds in kg, ascending, as total system load
 * @returns the z-score of that load
 * @throws RangeError when fewer than five anchors are supplied
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 4)
 */
export function zFromLoad(systemLoadKg: number, anchorsKg: readonly number[]): number {
  if (anchorsKg.length !== ANCHOR_Z.length) {
    throw new RangeError(`zFromLoad: expected ${ANCHOR_Z.length} anchors, got ${anchorsKg.length}`);
  }
  const lnAnchors = strictlyIncreasing(anchorsKg.map((a) => Math.log(Math.max(a, MIN_SYSTEM_LOAD_KG))));
  const slopes = pchipSlopes(lnAnchors, ANCHOR_Z);
  const z = pchipEval(lnAnchors, ANCHOR_Z, slopes, Math.log(Math.max(systemLoadKg, MIN_SYSTEM_LOAD_KG)));
  return Math.max(MIN_Z, Math.min(MAX_Z, z));
}

/**
 * Inverse of {@link zFromLoad}: the load that would put a lifter at a given z-score.
 * This is what turns "you are 0.2 z from Advanced" into "that is 8 kg on your bench".
 *
 * @param z target z-score
 * @param anchorsKg the five level thresholds in kg, ascending, as total system load
 * @returns the total system load in kg at that z
 * @throws RangeError when fewer than five anchors are supplied
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 4)
 */
export function loadFromZ(z: number, anchorsKg: readonly number[]): number {
  if (anchorsKg.length !== ANCHOR_Z.length) {
    throw new RangeError(`loadFromZ: expected ${ANCHOR_Z.length} anchors, got ${anchorsKg.length}`);
  }
  const lnAnchors = strictlyIncreasing(anchorsKg.map((a) => Math.log(Math.max(a, MIN_SYSTEM_LOAD_KG))));
  const slopes = pchipSlopes(ANCHOR_Z, lnAnchors);
  return Math.exp(pchipEval(ANCHOR_Z, lnAnchors, slopes, Math.max(MIN_Z, Math.min(MAX_Z, z))));
}

/**
 * Place a z-score inside the five published levels, with a continuous 0-1 position
 * toward the next level so the UI can render a progress bar rather than a label.
 *
 * @param z standardised score
 * @returns the level, the next level, and the position between them
 * @see https://strengthlevel.com/about (levels are fixed percentile anchors)
 */
export function levelPosition(z: number): LevelPosition {
  const beginnerZ = LEVEL_Z.beginner;
  if (z < beginnerZ) {
    const span = beginnerZ - UNTRAINED_FLOOR_Z;
    const progress = Math.max(0, Math.min(1, (z - UNTRAINED_FLOOR_Z) / span));
    return { level: 'untrained', progressToNext: progress, nextLevel: 'beginner', zToNext: beginnerZ - z };
  }
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    const level = LEVEL_ORDER[i];
    if (level === undefined) continue;
    if (z < LEVEL_Z[level]) continue;
    const next = LEVEL_ORDER[i + 1];
    if (next === undefined) {
      return { level, progressToNext: 1, nextLevel: null, zToNext: null };
    }
    const from = LEVEL_Z[level];
    const to = LEVEL_Z[next];
    return {
      level,
      progressToNext: Math.max(0, Math.min(1, (z - from) / (to - from))),
      nextLevel: next,
      zToNext: to - z,
    };
  }
  /* istanbul ignore next — unreachable: z >= beginnerZ always matches a level */
  return { level: 'beginner', progressToNext: 0, nextLevel: 'novice', zToNext: LEVEL_Z.novice - z };
}

/**
 * Measurement noise of a lift as a probe of underlying strength, in z units.
 *
 * Base values come from the equipment class: machine leverage, sled weight and pulley
 * ratios vary 20-40% between manufacturers, so an Elite leg press on one machine is an
 * Intermediate one on another. On top of the base, evidence penalties are added in
 * variance: one session instead of several, and an estimate that has gone stale.
 *
 * The sets penalty is a Stronger 2.0 addition on top of the research's formula: a single
 * set carries the full error of the 1RM equation, while three or more allow the
 * "second-highest estimate" rule that makes a fluke unable to move a rank.
 *
 * Staleness is deliberately NOT included here — see {@link stalenessSd} and the rank
 * decay policy: time away widens the confidence band, it never moves the score.
 *
 * @param std the exercise's published standards
 * @param evidence how well evidenced the estimate is
 * @returns tau, the SD in z units of this observation
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 13)
 */
export function measurementTau(std: ExerciseStandard, evidence: LiftEvidence = DEFAULT_LIFT_EVIDENCE): number {
  const base =
    std.machineVariance === 'very_high'
      ? 0.52
      : std.machineVariance === 'high'
        ? 0.48
        : std.machineVariance === 'medium'
          ? 0.42
          : std.loadType === 'added_bodyweight'
            ? 0.32
            : std.perSide === true
              ? 0.34
              : 0.28;
  const sessions = Math.max(evidence.nSessions, 1);
  const sets = Math.max(evidence.nSets, 1);
  const sessionPenalty = 0.09 / sessions;
  const setsPenalty = Math.max(0, 0.06 * (1 / sets - 1 / 4));
  return Math.sqrt(base * base + sessionPenalty + setsPenalty);
}

/**
 * Extra uncertainty, in z units, from an estimate having gone stale.
 *
 * This widens the CONFIDENCE BAND only. It is never added to the score, because rank
 * measures demonstrated capability and nothing except lifting moves it. Strength does
 * drift during a lay-off, but the honest statement is "we are less sure this is still
 * current", not "you have been demoted".
 *
 * Zero for the first eight weeks (the research's 56-day window), then growing
 * quadratically so a year-old number is visibly uncertain.
 *
 * @param ageDays days since the estimate was performed
 * @returns SD in z units to add in quadrature to the confidence band
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 13)
 */
export function stalenessSd(ageDays: number): number {
  if (!Number.isFinite(ageDays) || ageDays <= 56) return 0;
  return Math.sqrt(Math.pow((ageDays - 56) / 56, 2) * 0.09);
}

/** Resolve the five age- and bodyweight-adjusted anchors, as total system load in kg. */
function resolveSystemAnchors(
  std: ExerciseStandard,
  profile: LifterProfile,
): { anchors: number[]; ageMode: AgeMode; clamped: boolean } {
  const compareAgainst: CompareAgainst = profile.compareAgainst ?? profile.sex;
  const ageMode: AgeMode = profile.ageMode ?? defaultAgeMode(profile.age);

  let tableAnchors: number[];
  let clamped: boolean;
  if (compareAgainst === 'both') {
    const male = anchorsAtBodyweight(std, 'male', profile.bodyweightKg);
    const female = anchorsAtBodyweight(std, 'female', profile.bodyweightKg);
    tableAnchors = blendReferenceAnchors(
      male.ordered,
      female.ordered,
      referenceMaleShare('both', profile.appMaleShare),
    );
    clamped = male.clamped || female.clamped;
  } else {
    const resolved = anchorsAtBodyweight(std, compareAgainst, profile.bodyweightKg);
    tableAnchors = [...resolved.ordered];
    clamped = resolved.clamped;
  }

  const systemAnchors = tableAnchors.map((a) => toSystemLoadKg(std, a, profile.bodyweightKg));
  return { anchors: applyAgeGrading(systemAnchors, profile.age, ageMode), ageMode, clamped };
}

/**
 * Classify one lift performance: level, continuous position in that level, percentile,
 * rank points, and the exact load that would reach the next level.
 *
 * A classification is `provisional` until the evidence bar is met — at least two sets
 * from at least two distinct sessions, logged within the last six months. The research's
 * rule is that a single fluke or mistyped set must never move a classification, so a
 * caller that supplies no evidence metadata gets a provisional result by design.
 *
 * @param performance the lift, its e1RM in table units, and its evidence
 * @param profile the lifter's sex reference, bodyweight, age and comparison settings
 * @returns the full classification, including UI copy
 * @see https://strengthlevel.com/about
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 6, worked example)
 */
export function classifyLift(performance: LiftPerformance, profile: LifterProfile): LiftClassification {
  const std = performance.standard;
  const evidence = performance.evidence ?? DEFAULT_LIFT_EVIDENCE;
  const { anchors, ageMode, clamped } = resolveSystemAnchors(std, profile);

  const tableUnits = normaliseLoggedLoad(std, performance.e1rmKg, performance.isTotalOfBothImplements ?? false);
  const systemLoad = toSystemLoadKg(std, tableUnits, profile.bodyweightKg);
  const z = zFromLoad(systemLoad, anchors);
  const score = Math.max(0, Math.min(120, SCORE_INTERCEPT + SCORE_SLOPE * z));
  const position = levelPosition(z);
  const tau = measurementTau(std, evidence);

  const thresholdsKg: Record<Level, number> = {
    beginner: toLoggedUnitsKg(std, at(anchors, 0), profile.bodyweightKg),
    novice: toLoggedUnitsKg(std, at(anchors, 1), profile.bodyweightKg),
    intermediate: toLoggedUnitsKg(std, at(anchors, 2), profile.bodyweightKg),
    advanced: toLoggedUnitsKg(std, at(anchors, 3), profile.bodyweightKg),
    elite: toLoggedUnitsKg(std, at(anchors, 4), profile.bodyweightKg),
  };

  const nextLevelLoadKg =
    position.nextLevel === null
      ? null
      : toLoggedUnitsKg(std, loadFromZ(LEVEL_Z[position.nextLevel], anchors), profile.bodyweightKg);
  const kgToNextLevel = nextLevelLoadKg === null ? null : nextLevelLoadKg - tableUnits;

  const provisionalReasons: string[] = [];
  if (evidence.nSessions < 2) provisionalReasons.push('single_session_only');
  if (evidence.nSets < 2) provisionalReasons.push('single_set_only');
  if (evidence.ageDays > 180) provisionalReasons.push('estimate_stale');
  if (clamped) provisionalReasons.push('bodyweight_outside_published_grid');
  const state: 'ranked' | 'provisional' = provisionalReasons.length === 0 ? 'ranked' : 'provisional';

  const bandSd = Math.sqrt(tau * tau + Math.pow(stalenessSd(evidence.ageDays), 2));
  const percentile = percentileWithConfidence(z, bandSd);

  const levelName = position.level === 'untrained' ? 'Untrained' : capitalise(position.level);
  const nextName = position.nextLevel === null ? null : capitalise(position.nextLevel);
  const gap =
    nextName === null || kgToNextLevel === null
      ? ' That is the top published level for this lift.'
      : ` About ${Math.max(0, Math.round(kgToNextLevel * 10) / 10)} kg more reaches ${nextName}.`;
  const caveat =
    state === 'provisional'
      ? ' Still provisional — log it again in another session to confirm.'
      : '';

  return {
    exerciseId: std.id,
    z,
    score,
    position,
    percentile,
    thresholdsKg,
    nextLevelLoadKg,
    kgToNextLevel,
    tau,
    state,
    provisionalReasons,
    bodyweightClamped: clamped,
    ageMode,
    explanation: `${levelName} on ${std.name} for a ${Math.round(profile.bodyweightKg)} kg lifter${ageMode === 'age_graded' ? ', age-graded' : ''}.${gap}${caveat}`,
  };
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Plain-English methodology the UI can surface for anything in this module. */
export const CLASSIFY_METHODOLOGY: Readonly<Record<string, MethodologyNote>> = {
  normaliseLoggedLoad: {
    summary:
      'Matches how you logged the set to how the standards are published — dumbbell standards are per dumbbell and already include the handle.',
    source: 'strengthlevel.com dumbbell standards note',
    url: 'https://strengthlevel.com/strength-standards/dumbbell-bench-press/kg',
  },
  toSystemLoadKg: {
    summary:
      'Scores pull-ups, chin-ups and dips on the total weight you actually move (about 93% of bodyweight plus any added or assisted weight), because the published numbers are added weight and can be negative.',
    source: 'strengthlevel.com pull-up and dip standards (added weight convention)',
    url: 'https://strengthlevel.com/strength-standards/pull-ups/kg',
  },
  toLoggedUnitsKg: {
    summary: 'Converts a target back into the number you would actually put on the belt or the bar.',
    source: 'strengthlevel.com pull-up and dip standards (added weight convention)',
    url: 'https://strengthlevel.com/strength-standards/dips/kg',
  },
  zFromLoad: {
    summary:
      'Places your lift on the published curve for your sex and bodyweight, where Beginner is the 5th percentile, Novice the 20th, Intermediate the 50th, Advanced the 80th and Elite the 95th.',
    source: 'strengthlevel.com 2026 refresh (195,513,376 lifts / 27,893,268 users); Gravitus corroboration',
    url: 'https://strengthlevel.com/about',
  },
  loadFromZ: {
    summary: 'Turns a target level back into the exact weight you would need to lift for it.',
    source: 'strengthlevel.com 2026 refresh (fixed percentile anchors)',
    url: 'https://strengthlevel.com/about',
  },
  levelPosition: {
    summary: 'Shows how far through your current level you are, rather than just naming it.',
    source: 'strengthlevel.com level definitions (P5 / P20 / P50 / P80 / P95)',
    url: 'https://strengthlevel.com/about',
  },
  measurementTau: {
    summary:
      'Estimates how much to trust this lift as a measure of your strength. Machine lifts count for less than barbell lifts because machine leverage differs 20-40% between manufacturers, and single sessions and stale numbers count for less than repeated recent ones.',
    source: 'Stronger 2.0 noise model, research brief Part 2 (exerciseNoise_tau) and Part 5 section 13',
    url: 'https://strengthlevel.com/about',
  },
  stalenessSd: {
    summary:
      'Widens the confidence range when a lift has not been repeated for a while. Your rank never drops because time passed — the app just becomes less certain the number is current and asks you to re-verify it.',
    source: 'Stronger 2.0 rank decay policy, research brief Part 5 section 13',
    url: 'https://strengthlevel.com/about',
  },
  classifyLift: {
    summary:
      'Classifies one lift against 27M app lifters of your sex and bodyweight, age-graded if you asked for it, and tells you the exact load that reaches the next level. It stays provisional until you have repeated the lift in a second session, so one fluke set cannot move it.',
    source: 'strengthlevel.com 2026 refresh; USA Powerlifting age coefficients',
    url: 'https://strengthlevel.com/about',
  },
};
