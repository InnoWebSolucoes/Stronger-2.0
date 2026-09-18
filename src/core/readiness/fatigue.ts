/**
 * Stronger 2.0 — muscle readiness engine: fatigue accrual.
 *
 * Turns ONE logged set into per-muscle fatigue deposits (structural + metabolic),
 * a systemic deposit, and weekly volume credit.
 *
 * Model (research doc section 5): for each muscle the exercise touches,
 *
 *   structural = contribution * tension^1.8 * reps^0.55 * effort(RIR)
 *                * setType.structural * eccentricFactor * eccentricSensitivity
 *                * fibreStructural * repeatedBout * novelty / REFERENCE
 *   metabolic  = contribution * tension^0.6 * reps^0.95 * effort(RIR)^1.2
 *                * setType.metabolic * fibreMetabolic / REFERENCE
 *
 * Both are expressed in Fatigue Units (FU): 1.0 FU = one reference set
 * (8 reps at 75% e1RM, RIR 1, contribution 1.0). Weights are KG throughout; no
 * unit conversion happens anywhere in this module.
 *
 * PURE TypeScript. No react / react-native / expo imports, and no clock: the
 * caller stamps every set with `at` (unix ms).
 */

import {
  clamp,
  DROP_METABOLIC_ATTENUATION,
  DROP_STRUCTURAL_ATTENUATION,
  ECCENTRIC_TEMPO,
  EFFORT_DECAY_PER_RIR,
  FIBER_MODIFIER,
  METABOLIC_EXPONENTS,
  MS_PER_DAY,
  MUSCLES,
  RBE,
  READINESS_MODEL_VERSION,
  REFERENCE_SET,
  REFERENCE_STRETCH_INDEX,
  SET_TYPE,
  STIMULATING_REP_WINDOW,
  STRUCTURAL_EXPONENTS,
  SYSTEMIC_AXIAL,
  SYSTEMIC_COEFFICIENT,
  SYSTEMIC_SLOW_SHARE,
  TENSION,
  isMuscleId,
  type MuscleId,
  type SetType,
} from './constants';

// ---------------------------------------------------------------------------
// Exercise fatigue profile
// ---------------------------------------------------------------------------

/**
 * The fatigue-relevant facts about an exercise. Supplied by the caller (the
 * exercise catalog owns the canonical record) so this module never has to import
 * the catalog and never has to guess.
 */
export interface ExerciseFatigueProfile {
  /** Stable exercise slug — never an index, never a regenerated UUID. */
  id: string;
  /** Display name, used only in diagnostics. */
  name?: string;
  /**
   * Fractional involvement per muscle: 1.0 prime mover, ~0.5 strong synergist,
   * 0.15-0.25 stabiliser. Doubles as the hard-set credit toward weekly volume
   * landmarks. Expert-assigned, not EMG-derived.
   */
  contributions: Partial<Record<MuscleId, number>>;
  /** Spinal / whole-body axial load, 0..1. Conventional deadlift 1.00, machine curl 0.02. */
  axialLoad: number;
  /** Loaded-stretch index: tension at long muscle length, the biggest driver of EIMD. */
  loadedStretchIndex: number;
  /** Stimulus-to-fatigue ratio (Israetel). Above 1 is efficient, below 1 is costly. Scales systemic cost only. */
  sfr: number;
  /** Eccentric duration in SECONDS assumed when the user logs no tempo. */
  defaultEccentricSec: number;
  /** True for single-limb movements (informational; does not change the math). */
  unilateral?: boolean;
}

/**
 * Reference exercise fatigue profiles, transcribed verbatim from the research
 * doc's calibrated table (section 2). These are the profiles the model was
 * calibrated against, and they are what the tests assert on.
 *
 * The exercise catalog is the source of truth in production — pass its profiles
 * to {@link accrueSet} directly. This table exists so the readiness engine is
 * runnable and verifiable on its own, and as the fallback shape for catalog
 * entries whose fatigue fields have not been authored yet.
 */
export const REFERENCE_EXERCISE_PROFILES: Record<string, ExerciseFatigueProfile> = {
  barbell_bench_press: {
    id: 'barbell_bench_press', name: 'Barbell Bench Press',
    contributions: { chest: 1.0, front_delts: 0.55, triceps: 0.50, lats: 0.10 },
    axialLoad: 0.25, loadedStretchIndex: 1.20, sfr: 1.05, defaultEccentricSec: 2,
  },
  incline_db_press: {
    id: 'incline_db_press', name: 'Incline Dumbbell Press',
    contributions: { chest: 1.0, front_delts: 0.65, triceps: 0.45 },
    axialLoad: 0.20, loadedStretchIndex: 1.30, sfr: 1.15, defaultEccentricSec: 2.5,
  },
  dips: {
    id: 'dips', name: 'Weighted Dips',
    contributions: { chest: 0.85, triceps: 0.90, front_delts: 0.50 },
    axialLoad: 0.15, loadedStretchIndex: 1.35, sfr: 1.00, defaultEccentricSec: 2,
  },
  cable_fly: {
    id: 'cable_fly', name: 'Cable Fly',
    contributions: { chest: 1.0, front_delts: 0.25 },
    axialLoad: 0.05, loadedStretchIndex: 1.40, sfr: 1.20, defaultEccentricSec: 2.5,
  },
  back_squat: {
    id: 'back_squat', name: 'Barbell Back Squat',
    contributions: { quads: 1.0, glutes: 0.70, adductors: 0.45, lower_back: 0.45, hamstrings: 0.25, abs: 0.20, calves: 0.10 },
    axialLoad: 0.95, loadedStretchIndex: 1.25, sfr: 0.90, defaultEccentricSec: 2,
  },
  front_squat: {
    id: 'front_squat', name: 'Front Squat',
    contributions: { quads: 1.0, glutes: 0.50, upper_back: 0.35, lower_back: 0.35, abs: 0.30 },
    axialLoad: 0.80, loadedStretchIndex: 1.25, sfr: 0.95, defaultEccentricSec: 2,
  },
  leg_press: {
    id: 'leg_press', name: 'Leg Press',
    contributions: { quads: 1.0, glutes: 0.55, adductors: 0.35, hamstrings: 0.15 },
    axialLoad: 0.25, loadedStretchIndex: 1.15, sfr: 1.25, defaultEccentricSec: 2,
  },
  leg_extension: {
    id: 'leg_extension', name: 'Leg Extension',
    contributions: { quads: 1.0 },
    axialLoad: 0.02, loadedStretchIndex: 0.95, sfr: 1.30, defaultEccentricSec: 2,
  },
  bulgarian_split_squat: {
    id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat',
    contributions: { quads: 0.90, glutes: 0.95, adductors: 0.40, hamstrings: 0.25, abductors: 0.25 },
    axialLoad: 0.35, loadedStretchIndex: 1.40, sfr: 1.10, defaultEccentricSec: 2.5, unilateral: true,
  },
  conventional_deadlift: {
    id: 'conventional_deadlift', name: 'Conventional Deadlift',
    contributions: { lower_back: 1.0, glutes: 0.90, hamstrings: 0.80, quads: 0.40, traps: 0.55, upper_back: 0.50, forearms: 0.45, lats: 0.30 },
    axialLoad: 1.00, loadedStretchIndex: 1.10, sfr: 0.65, defaultEccentricSec: 1.5,
  },
  romanian_deadlift: {
    id: 'romanian_deadlift', name: 'Romanian Deadlift',
    contributions: { hamstrings: 1.0, glutes: 0.80, lower_back: 0.65, traps: 0.30, forearms: 0.35 },
    axialLoad: 0.75, loadedStretchIndex: 1.45, sfr: 0.95, defaultEccentricSec: 3,
  },
  lying_leg_curl: {
    id: 'lying_leg_curl', name: 'Lying Leg Curl',
    contributions: { hamstrings: 1.0, calves: 0.15 },
    axialLoad: 0.02, loadedStretchIndex: 1.00, sfr: 1.30, defaultEccentricSec: 2,
  },
  hip_thrust: {
    id: 'hip_thrust', name: 'Barbell Hip Thrust',
    contributions: { glutes: 1.0, hamstrings: 0.40, quads: 0.20 },
    axialLoad: 0.25, loadedStretchIndex: 0.85, sfr: 1.20, defaultEccentricSec: 2,
  },
  pull_up: {
    id: 'pull_up', name: 'Weighted Pull-Up',
    contributions: { lats: 1.0, biceps: 0.60, upper_back: 0.55, rear_delts: 0.30, forearms: 0.35, abs: 0.20 },
    axialLoad: 0.15, loadedStretchIndex: 1.35, sfr: 1.10, defaultEccentricSec: 2.5,
  },
  barbell_row: {
    id: 'barbell_row', name: 'Barbell Row',
    contributions: { lats: 0.85, upper_back: 1.0, rear_delts: 0.45, biceps: 0.50, lower_back: 0.55, forearms: 0.30 },
    axialLoad: 0.70, loadedStretchIndex: 1.15, sfr: 0.90, defaultEccentricSec: 2,
  },
  lat_pulldown: {
    id: 'lat_pulldown', name: 'Lat Pulldown',
    contributions: { lats: 1.0, biceps: 0.55, upper_back: 0.45, rear_delts: 0.25, forearms: 0.25 },
    axialLoad: 0.08, loadedStretchIndex: 1.25, sfr: 1.25, defaultEccentricSec: 2.5,
  },
  chest_supported_row: {
    id: 'chest_supported_row', name: 'Chest-Supported Row',
    contributions: { upper_back: 1.0, lats: 0.75, rear_delts: 0.55, biceps: 0.45 },
    axialLoad: 0.10, loadedStretchIndex: 1.20, sfr: 1.30, defaultEccentricSec: 2.5,
  },
  overhead_press: {
    id: 'overhead_press', name: 'Standing Overhead Press',
    contributions: { front_delts: 1.0, side_delts: 0.45, triceps: 0.65, upper_back: 0.25, abs: 0.25, lower_back: 0.30 },
    axialLoad: 0.55, loadedStretchIndex: 1.05, sfr: 0.95, defaultEccentricSec: 2,
  },
  lateral_raise: {
    id: 'lateral_raise', name: 'Dumbbell Lateral Raise',
    contributions: { side_delts: 1.0, traps: 0.25, front_delts: 0.15 },
    axialLoad: 0.05, loadedStretchIndex: 0.90, sfr: 1.35, defaultEccentricSec: 2,
  },
  face_pull: {
    id: 'face_pull', name: 'Cable Face Pull',
    contributions: { rear_delts: 1.0, upper_back: 0.55, traps: 0.35 },
    axialLoad: 0.04, loadedStretchIndex: 0.95, sfr: 1.40, defaultEccentricSec: 2,
  },
  incline_db_curl: {
    id: 'incline_db_curl', name: 'Incline Dumbbell Curl',
    contributions: { biceps: 1.0, forearms: 0.30 },
    axialLoad: 0.03, loadedStretchIndex: 1.45, sfr: 1.10, defaultEccentricSec: 3,
  },
  ez_bar_curl: {
    id: 'ez_bar_curl', name: 'EZ-Bar Curl',
    contributions: { biceps: 1.0, forearms: 0.35 },
    axialLoad: 0.10, loadedStretchIndex: 1.10, sfr: 1.20, defaultEccentricSec: 2,
  },
  overhead_tricep_ext: {
    id: 'overhead_tricep_ext', name: 'Overhead Cable Triceps Extension',
    contributions: { triceps: 1.0 },
    axialLoad: 0.05, loadedStretchIndex: 1.45, sfr: 1.15, defaultEccentricSec: 2.5,
  },
  tricep_pushdown: {
    id: 'tricep_pushdown', name: 'Triceps Pushdown',
    contributions: { triceps: 1.0, forearms: 0.15 },
    axialLoad: 0.03, loadedStretchIndex: 0.85, sfr: 1.35, defaultEccentricSec: 2,
  },
  standing_calf_raise: {
    id: 'standing_calf_raise', name: 'Standing Calf Raise',
    contributions: { calves: 1.0 },
    axialLoad: 0.20, loadedStretchIndex: 1.35, sfr: 1.25, defaultEccentricSec: 2.5,
  },
  hanging_leg_raise: {
    id: 'hanging_leg_raise', name: 'Hanging Leg Raise',
    contributions: { abs: 1.0, obliques: 0.40, forearms: 0.30 },
    axialLoad: 0.05, loadedStretchIndex: 1.20, sfr: 1.25, defaultEccentricSec: 2.5,
  },
};

/**
 * Look up a reference profile by exercise slug.
 * Returns undefined for unknown slugs — the caller decides whether that is an
 * error or a catalog entry whose fatigue fields are not authored yet.
 */
export function referenceProfile(exerciseId: string): ExerciseFatigueProfile | undefined {
  return REFERENCE_EXERCISE_PROFILES[exerciseId];
}

// ---------------------------------------------------------------------------
// e1RM (relative intensity is what fatigue actually keys off)
// ---------------------------------------------------------------------------

/** Epley 1RM in KG: w * (1 + r/30). Best at 6-10 reps. */
export function epleyKg(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** Brzycki 1RM in KG: w / (1.0278 - 0.0278r). Best at 1-6 reps. */
export function brzyckiKg(weightKg: number, reps: number): number {
  return weightKg / (1.0278 - 0.0278 * reps);
}

/**
 * Estimated 1RM in KG from a single set.
 *
 * Weight-dependent equation fitted on 303,494 near-failure sets by 14,966 users
 * across 388 exercises (arXiv:2603.17495):
 *
 *   1RM = w * (1 + (r - 1)^0.85 / (-2.55 + 4.58*ln w))
 *
 * where r is the RIR-adjusted rep count (reps + RIR). It reduced internal
 * inconsistency 17-22% versus Epley/Brzycki/Lombardi/O'Conner. Below 1-3 reps
 * the fit is blended 50/50 with Brzycki, and when the log term degenerates at
 * very light loads it falls back to Epley.
 *
 * This is a LOCAL estimator used only to derive relative intensity when the
 * caller has no measured e1RM for the exercise. `src/core/scoring` owns the
 * canonical e1RM used for PRs and standards; pass it in via
 * {@link AccrualContext.e1rmByExerciseKg} whenever it is known.
 */
export function estimateE1rmKg(weightKg: number, reps: number, rir = 0): number {
  if (weightKg <= 0 || !Number.isFinite(weightKg)) return 0;
  const r = Math.max(1, reps + Math.max(0, rir));
  const denom = -2.55 + 4.58 * Math.log(weightKg);
  if (denom <= 0.35) return epleyKg(weightKg, r);
  const weightDependent = weightKg * (1 + Math.pow(r - 1, 0.85) / denom);
  return r <= 3 ? 0.5 * weightDependent + 0.5 * brzyckiKg(weightKg, r) : weightDependent;
}

// ---------------------------------------------------------------------------
// Component terms
// ---------------------------------------------------------------------------

/**
 * Mechanical tension per rep as a function of load relative to e1RM (0..1+).
 * 0.42 + 0.78*rel, clamped: rises with load and saturates, because motor-unit
 * recruitment is near complete by ~80-85% of 1RM and the final reps before
 * failure are maximal regardless of load.
 */
export function tensionTerm(relativeIntensity: number): number {
  const rel = clamp(relativeIntensity, TENSION.relMin, TENSION.relMax);
  return TENSION.base + TENSION.gain * rel;
}

/**
 * Proximity-to-failure multiplier from reps in reserve: exp(-0.25 * RIR).
 * RIR 0 = 1.00, 1 = 0.78, 2 = 0.61, 3 = 0.47, 4 = 0.37, 5 = 0.29, 6 = 0.22.
 * Matches the strongly non-linear fatigue-vs-RIR pattern measured by Refalo 2023
 * (PMC9908800): velocity loss at 4 min of -25% at failure, -13% at 1-RIR,
 * -8% at 3-RIR.
 */
export function effortTerm(rir: number): number {
  return Math.exp(-EFFORT_DECAY_PER_RIR * clamp(rir, 0, 10));
}

/** Convert a logged RPE (6-10 scale) to reps in reserve: RIR = 10 - RPE. */
export function rirFromRpe(rpe: number): number {
  return clamp(10 - rpe, 0, 10);
}

const REF_TENSION = tensionTerm(REFERENCE_SET.relIntensity);
const REF_EFFORT = effortTerm(REFERENCE_SET.rir);

/** Structural value of the 1.0-FU reference set, used to normalise every deposit. */
const REF_STRUCTURAL =
  Math.pow(REF_TENSION, STRUCTURAL_EXPONENTS.tension) *
  Math.pow(REFERENCE_SET.reps, STRUCTURAL_EXPONENTS.reps) *
  REF_EFFORT;

/** Metabolic value of the 1.0-FU reference set. */
const REF_METABOLIC =
  Math.pow(REF_TENSION, METABOLIC_EXPONENTS.tension) *
  Math.pow(REFERENCE_SET.reps, METABOLIC_EXPONENTS.reps) *
  Math.pow(REF_EFFORT, METABOLIC_EXPONENTS.effort);

// ---------------------------------------------------------------------------
// Set + context types
// ---------------------------------------------------------------------------

/** One drop-set segment: the reduced load and the reps performed at it. */
export interface DropSegment {
  weightKg: number;
  reps: number;
}

/** A set as it is stored in the log. Weights are KG, `at` is unix ms. */
export interface LoggedSet {
  /** Stable exercise slug. Must match the profile passed to {@link accrueSet}. */
  exerciseId: string;
  type: SetType;
  /** Load in KG (canonical unit). 0 is legitimate for unweighted bodyweight work. */
  weightKg: number;
  reps: number;
  /** Reps in reserve. If the user logged RPE (6-10), pass {@link rirFromRpe}. */
  rir?: number;
  /** Eccentric duration in SECONDS; defaults to the exercise profile's tempo. */
  eccentricSec?: number;
  /** Segments after the initial drop, in order. Only meaningful for `drop`/`myorep` sets. */
  dropSegments?: DropSegment[];
  /** Unix milliseconds. Supplied by the caller — this module never reads a clock. */
  at: number;
}

/** Everything about the user that changes how much a set costs them. */
export interface AccrualContext {
  /** Measured e1RM in KG per exercise slug. When absent, it is estimated from the set. */
  e1rmByExerciseKg?: Record<string, number>;
  /** 0..1 familiarity per muscle, driving the repeated-bout effect. 1 = fully adapted. */
  familiarity?: Partial<Record<MuscleId, number>>;
  /** Unix ms of the last time each exercise was performed, for movement novelty. */
  lastPerformedAt?: Record<string, number>;
  /** Global multiplier on every recovery time constant (see `recoveryTauScale`). Default 1. */
  tauScale?: number;
  /** Per-muscle tau multiplier from online personalisation (see `cold-start.ts`). Default 1. */
  tauMultiplier?: Partial<Record<MuscleId, number>>;
}

/** One muscle's share of one set's fatigue, with the time constants it decays on. */
export interface FatigueDeposit {
  muscle: MuscleId;
  /** Unix ms the fatigue was deposited. */
  at: number;
  /** Structural (EIMD) fatigue, Fatigue Units. */
  structural: number;
  /** Metabolic / peripheral fatigue, Fatigue Units. */
  metabolic: number;
  /** Effective structural decay time constant for THIS deposit, HOURS. */
  tauStructuralH: number;
  /** Effective metabolic decay time constant for THIS deposit, HOURS. */
  tauMetabolicH: number;
  /** Constant-set version this deposit was scored with, so old sessions can be replayed. */
  modelVersion: number;
}

/** Whole-body fatigue from one set, on the systemic two-compartment layer. */
export interface SystemicDeposit {
  at: number;
  /** Fast compartment magnitude (tau 16h). */
  fast: number;
  /** Slow compartment magnitude (tau 60h). */
  slow: number;
}

export interface SetFatigueResult {
  deposits: FatigueDeposit[];
  systemic: SystemicDeposit;
  /** Hard-set credit per muscle toward the weekly volume landmarks. Warm-ups credit 0. */
  volumeCredit: Partial<Record<MuscleId, number>>;
  /** Stimulating reps (RP heuristic): the last ~5 reps before failure. */
  stimulatingReps: number;
  /** Load as a fraction of e1RM that the model actually used, for diagnostics. */
  relativeIntensity: number;
  /** Total Fatigue Units deposited across all muscles, for session-load synthesis. */
  totalFatigueUnits: number;
}

/** Typed entries of a `Partial<Record<MuscleId, number>>`, skipping absent keys. */
function contributionEntries(
  contributions: Partial<Record<MuscleId, number>>,
): Array<[MuscleId, number]> {
  const out: Array<[MuscleId, number]> = [];
  for (const [key, value] of Object.entries(contributions)) {
    if (value === undefined || !isMuscleId(key)) continue;
    out.push([key, value]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Accrual
// ---------------------------------------------------------------------------

/**
 * Fatigue accrued by ONE logged set, split across every muscle the exercise
 * touches. Pure: all state and the timestamp come from the arguments.
 *
 * Drivers, in the order the research doc establishes them:
 *  - contribution weight per muscle (prime mover 1.0, synergist ~0.5),
 *  - load relative to e1RM through the saturating tension curve,
 *  - reps, sub-linearly for damage (^0.55) and near-linearly for metabolites (^0.95),
 *  - proximity to failure through exp(-0.25*RIR) (Refalo 2023),
 *  - set type (warm-up 0.15/0.10 and zero volume credit; failure 1.18/1.35 plus a
 *    1.30x tau stretch, Vieira meta; drop 1.15/1.85, Havers 2026),
 *  - eccentric emphasis: tempo and the exercise's loaded-stretch index,
 *  - the muscle's own eccentric sensitivity and fibre-type composition,
 *  - the repeated-bout effect via familiarity and movement novelty.
 *
 * A set with no reps deposits nothing. Time constants are the muscle constants
 * multiplied by the set-type tau stretch, the lifestyle `tauScale` and any
 * personalised per-muscle multiplier.
 *
 * @param set     the logged set (weights in KG, `at` in unix ms)
 * @param profile the exercise's fatigue profile; its `id` must match `set.exerciseId`
 * @param ctx     user state: known e1RMs, familiarity, movement history, tau scaling
 */
export function accrueSet(
  set: LoggedSet,
  profile: ExerciseFatigueProfile,
  ctx: AccrualContext = {},
): SetFatigueResult {
  if (profile.id !== set.exerciseId) {
    throw new Error(
      `Profile mismatch: set logged against "${set.exerciseId}" but profile is "${profile.id}"`,
    );
  }

  const setType = SET_TYPE[set.type];
  const rir = clamp(set.rir ?? setType.defaultRir, 0, 10);
  const reps = Math.floor(set.reps);
  const weightKg = Math.max(0, set.weightKg);
  const tauScale = ctx.tauScale ?? 1;

  const knownE1rm = ctx.e1rmByExerciseKg?.[set.exerciseId];
  const e1rmKg = knownE1rm !== undefined && knownE1rm > 0
    ? knownE1rm
    : estimateE1rmKg(weightKg, Math.max(1, reps), rir);
  // A bodyweight set logged at 0 kg has no meaningful relative intensity, so it
  // falls back to the reference intensity rather than reading as "weightless".
  const relativeIntensity = e1rmKg > 0 ? weightKg / e1rmKg : REFERENCE_SET.relIntensity;

  const empty: SetFatigueResult = {
    deposits: [],
    systemic: { at: set.at, fast: 0, slow: 0 },
    volumeCredit: {},
    stimulatingReps: 0,
    relativeIntensity,
    totalFatigueUnits: 0,
  };
  if (reps <= 0) return empty;

  const tension = tensionTerm(relativeIntensity);
  const effort = effortTerm(rir);

  // Damage scales with eccentric time under tension AND with tension at long
  // muscle length. loadedStretchIndex is normalised against the reference
  // movement so an average exercise scores ~1.0 instead of inflating everything.
  const eccentricSec = set.eccentricSec ?? profile.defaultEccentricSec;
  const tempoFactor = clamp(
    1 + ECCENTRIC_TEMPO.perSecond * (eccentricSec - ECCENTRIC_TEMPO.referenceSec),
    ECCENTRIC_TEMPO.min,
    ECCENTRIC_TEMPO.max,
  );
  const eccentricFactor = tempoFactor * (profile.loadedStretchIndex / REFERENCE_STRETCH_INDEX);

  // Each successive drop lands on an already-fatigued muscle at a lower load:
  // tension (and therefore damage) falls off fast at 0.45^n, metabolite
  // accumulation barely falls at all at 0.85^n (Havers 2026).
  let extraStructural = 0;
  let extraMetabolic = 0;
  for (const [index, segment] of (set.dropSegments ?? []).entries()) {
    const segmentReps = Math.max(1, Math.floor(segment.reps));
    const segmentRel = e1rmKg > 0 ? Math.max(0, segment.weightKg) / e1rmKg : 0.55;
    const segmentTension = tensionTerm(segmentRel);
    const structuralAttenuation = Math.pow(DROP_STRUCTURAL_ATTENUATION, index + 1);
    const metabolicAttenuation = Math.pow(DROP_METABOLIC_ATTENUATION, index + 1);
    extraStructural += structuralAttenuation *
      Math.pow(segmentTension, STRUCTURAL_EXPONENTS.tension) *
      Math.pow(segmentReps, STRUCTURAL_EXPONENTS.reps);
    extraMetabolic += metabolicAttenuation *
      Math.pow(segmentTension, METABOLIC_EXPONENTS.tension) *
      Math.pow(segmentReps, METABOLIC_EXPONENTS.reps);
  }

  const baseStructural =
    (Math.pow(tension, STRUCTURAL_EXPONENTS.tension) *
      Math.pow(reps, STRUCTURAL_EXPONENTS.reps) *
      effort + extraStructural) / REF_STRUCTURAL;
  const baseMetabolic =
    (Math.pow(tension, METABOLIC_EXPONENTS.tension) *
      Math.pow(reps, METABOLIC_EXPONENTS.reps) *
      Math.pow(effort, METABOLIC_EXPONENTS.effort) + extraMetabolic) / REF_METABOLIC;

  // Repeated-bout effect: protection is largest at the first re-exposure and
  // decays over weeks (Nosaka & Clarkson).
  const lastPerformed = ctx.lastPerformedAt?.[set.exerciseId];
  const daysSinceExercise = lastPerformed === undefined
    ? Number.POSITIVE_INFINITY
    : (set.at - lastPerformed) / MS_PER_DAY;
  const movementNovelty = Number.isFinite(daysSinceExercise)
    ? clamp(
        (daysSinceExercise - RBE.noveltyGraceDays) / (RBE.noveltyFullDays - RBE.noveltyGraceDays),
        0,
        1,
      )
    : 1;

  const deposits: FatigueDeposit[] = [];
  const volumeCredit: Partial<Record<MuscleId, number>> = {};
  let systemicSpill = 0;
  let totalFatigueUnits = 0;

  for (const [muscleId, rawContribution] of contributionEntries(profile.contributions)) {
    const muscle = MUSCLES[muscleId];
    const contribution = clamp(rawContribution, 0, 1);
    if (contribution === 0) continue;

    const familiarity = clamp(ctx.familiarity?.[muscleId] ?? RBE.defaultFamiliarity, 0, 1);
    const repeatedBout = 1 + RBE.familiarityGain * (1 - familiarity);
    const novelty = 1 + RBE.noveltyGain * movementNovelty * familiarity;

    const fibreStructural = 1 + FIBER_MODIFIER.structuralPerPct * (FIBER_MODIFIER.pivotPct - muscle.slowTwitchPct);
    const fibreMetabolic = 1 - FIBER_MODIFIER.metabolicPerPct * (muscle.slowTwitchPct - FIBER_MODIFIER.pivotPct);

    const structural = contribution * baseStructural * setType.structural * eccentricFactor *
      muscle.eccentricSensitivity * fibreStructural * repeatedBout * novelty;
    const metabolic = contribution * baseMetabolic * setType.metabolic * fibreMetabolic;

    const personalTau = clamp(ctx.tauMultiplier?.[muscleId] ?? 1, 0.5, 2);

    deposits.push({
      muscle: muscleId,
      at: set.at,
      structural,
      metabolic,
      tauStructuralH: muscle.tauStructuralH * setType.tauStretch * tauScale * personalTau,
      tauMetabolicH: muscle.tauMetabolicH * tauScale * personalTau,
      modelVersion: READINESS_MODEL_VERSION,
    });

    volumeCredit[muscleId] = (volumeCredit[muscleId] ?? 0) + contribution * setType.volumeCredit;
    systemicSpill += structural * muscle.systemicShare;
    totalFatigueUnits += structural + metabolic;
  }

  // Systemic cost: axial load x structural spill x inverse stimulus-to-fatigue
  // ratio. This is what makes "a deadlift day costs you Wednesday" fall out of
  // the model instead of being hard-coded.
  const systemicMagnitude =
    SYSTEMIC_COEFFICIENT * (SYSTEMIC_AXIAL.base + SYSTEMIC_AXIAL.gain * clamp(profile.axialLoad, 0, 1)) *
    systemicSpill / Math.max(SYSTEMIC_AXIAL.minSfr, profile.sfr);

  return {
    deposits,
    systemic: { at: set.at, fast: systemicMagnitude, slow: systemicMagnitude * SYSTEMIC_SLOW_SHARE },
    volumeCredit,
    stimulatingReps: setType.volumeCredit === 0
      ? 0
      : clamp(Math.min(reps, STIMULATING_REP_WINDOW) - Math.max(0, rir - 1), 0, STIMULATING_REP_WINDOW),
    relativeIntensity,
    totalFatigueUnits,
  };
}

/** One set paired with the exercise profile it was performed on. */
export interface SetWithProfile {
  set: LoggedSet;
  profile: ExerciseFatigueProfile;
}

/**
 * Accrue a whole session, returning the flattened deposits, the systemic
 * deposits, the per-muscle volume credit and the total Fatigue Units.
 * Pure: the caller supplies every timestamp.
 */
export function accrueSets(entries: readonly SetWithProfile[], ctx: AccrualContext = {}): {
  deposits: FatigueDeposit[];
  systemic: SystemicDeposit[];
  volumeCredit: Partial<Record<MuscleId, number>>;
  totalFatigueUnits: number;
} {
  const deposits: FatigueDeposit[] = [];
  const systemic: SystemicDeposit[] = [];
  const volumeCredit: Partial<Record<MuscleId, number>> = {};
  let totalFatigueUnits = 0;

  for (const entry of entries) {
    const result = accrueSet(entry.set, entry.profile, ctx);
    deposits.push(...result.deposits);
    if (result.systemic.fast > 0 || result.systemic.slow > 0) systemic.push(result.systemic);
    for (const [muscleId, credit] of contributionEntries(result.volumeCredit)) {
      volumeCredit[muscleId] = (volumeCredit[muscleId] ?? 0) + credit;
    }
    totalFatigueUnits += result.totalFatigueUnits;
  }

  return { deposits, systemic, volumeCredit, totalFatigueUnits };
}
