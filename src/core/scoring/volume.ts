/**
 * Volume load — what "total kg" actually means, honestly, for every way an
 * exercise can be tracked.
 *
 * The problem this module exists to solve: a 50-rep pull-up session that shows
 * "0 kg" is a bug, and an assisted pull-up that shows MORE volume than an
 * unassisted one is worse than a bug. Every exercise therefore carries a
 * `loadModel` and a `bodyweightFactor`, and the load one rep actually moves is
 * computed once, in {@link repLoadKg}, which every other number is built on.
 *
 * Two totals, always reported together:
 *   SYSTEM volume  — bodyweight included. The headline "total kg".
 *   EXTERNAL volume — plates/dumbbells/stack only. In the tooltip, so a lifter
 *                     can see that gaining 3 kg of bodyweight did not make
 *                     their pull-ups stronger.
 *
 * References:
 *  [6] Suprak, Dawes & Stephenson (2011) J Strength Cond Res 25(2):497-503 —
 *      push-up ground reaction forces on force plates, 23 subjects.
 *  [8] Hevy's published bodyweight-volume rules (the de-facto convention).
 *  [9] Schoenfeld/Krieger dose-response line of work — the "hard set".
 */

import { resolveRir } from './e1rm';
import type { LoggedSet } from './types';

/**
 * How an exercise's resistance is produced. Every exercise in the catalog
 * declares exactly one.
 *
 * Source: research brief §5 "LOAD MODELS, VOLUME AND WHAT 'TOTAL KG' MEANS".
 */
export type LoadModel =
  /** Barbell, dumbbell, machine, cable: the logged kg IS the load. */
  | 'EXTERNAL'
  /** Pull-up, dip, push-up: bodyweight × factor, PLUS any added kg. */
  | 'BODYWEIGHT'
  /** Assisted pull-up/dip: bodyweight × factor MINUS the assistance. */
  | 'ASSISTED'
  /** Farmer's walk: load × distance, no reps. */
  | 'WEIGHTED_CARRY'
  /** Plank, dead hang: time only. */
  | 'DURATION'
  /** Rowing, sled, running: distance only. */
  | 'DISTANCE';

/** Per-exercise load description. Lives on the exercise catalog entry. */
export interface ExerciseLoadSpec {
  loadModel: LoadModel;
  /**
   * Fraction of bodyweight actually moved, 0–1. Measured where measurements
   * exist (see {@link BODYWEIGHT_FACTORS}). Defaults to 1 for hanging work.
   */
  bodyweightFactor?: number;
  /** True when the logged weight AND reps are per side. */
  unilateral?: boolean;
  /**
   * Cable pulley mechanical advantage: 1 = direct, 2 = a 2:1 stack (the lifter
   * feels half the labelled weight). Unknown ratios are treated as 1 until a
   * user corrects them.
   */
  pulleyRatio?: number;
}

/**
 * Fraction of bodyweight moved per rep, by exercise slug.
 *
 * The push-up family is force-plate measured [6]: standard push-up 64% of body
 * mass in the up position, knee push-up 49%, hands on a 24" bench 41%, feet on
 * a 24" bench 75%. Hanging movements (pull-up, chin-up, dip, muscle-up) support
 * the entire body and are 1.00 by mechanics, not by survey. The remaining
 * values are the app's attribution model, rounded to 0.05, not measured
 * physiology.
 *
 * Source: [6]; research brief §5.
 */
export const BODYWEIGHT_FACTORS: Readonly<Record<string, number>> = {
  'pull-up': 1.0,
  'chin-up': 1.0,
  'muscle-up': 1.0,
  dip: 1.0,
  'ring-dip': 1.0,
  'bench-dip': 0.45,
  'inverted-row': 0.6,
  'push-up': 0.64,
  'push-up-knees': 0.49,
  'push-up-hands-elevated-24in': 0.41,
  'push-up-feet-elevated-24in': 0.75,
  'pike-push-up': 0.75,
  'bodyweight-squat': 0.85,
  'pistol-squat': 0.9,
  'bulgarian-split-squat': 0.85,
  'walking-lunge': 0.85,
  'step-up': 0.85,
  'nordic-curl': 0.55,
  'hanging-leg-raise': 0.45,
  'sit-up': 0.4,
  'back-extension': 0.55,
  'glute-bridge': 0.55,
  'calf-raise-bodyweight': 0.9,
};

/** Look up a measured bodyweight factor by slug, or null if we have none. */
export function bodyweightFactorFor(exerciseId: string): number | null {
  return BODYWEIGHT_FACTORS[exerciseId] ?? null;
}

/**
 * Everything volume math needs beyond the sets themselves.
 *
 * `bodyweightKg` is null when the lifter has not entered a bodyweight. In that
 * case bodyweight and assisted exercises contribute NO volume at all rather
 * than a guess — matching the published Hevy convention [8], which also keeps
 * migrated users' numbers comparable.
 */
export interface VolumeContext {
  bodyweightKg: number | null;
  spec: ExerciseLoadSpec;
}

/**
 * The load ONE REP actually moves, in kilograms.
 *
 * This is the number every other calculation — volume, e1RM, PRs, per-muscle
 * load — must be built on.
 *
 * ```
 * pull-up,          BW 80 kg, no added weight ...  80.0 kg/rep
 * pull-up,          BW 80 kg, +20 kg belt .......  100.0 kg/rep
 * assisted pull-up, BW 80 kg, 30 kg assist ......  50.0 kg/rep
 * push-up,          BW 80 kg ....................  51.2 kg/rep  (0.64 × BW)
 * duration/distance work ........................   0.0 kg/rep
 * ```
 *
 * For unilateral work this is what ONE limb moves; the doubling lives in
 * {@link repsCredited} and is never applied here, so it can never be applied
 * twice. Assistance is always subtracted (its sign in the log is ignored) and
 * the result is floored at zero — assistance heavier than the lifter means zero
 * load, never negative.
 *
 * Source: research brief §5; [6], [8].
 */
export function repLoadKg(set: LoggedSet, ctx: VolumeContext): number {
  const { spec, bodyweightKg } = ctx;
  const factor = spec.bodyweightFactor ?? 1;
  const added = Number.isFinite(set.weightKg) ? set.weightKg : 0;

  switch (spec.loadModel) {
    case 'BODYWEIGHT': {
      if (bodyweightKg == null || !Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return 0;
      return Math.max(0, bodyweightKg * factor + added);
    }
    case 'ASSISTED': {
      if (bodyweightKg == null || !Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return 0;
      return Math.max(0, bodyweightKg * factor - Math.abs(added));
    }
    case 'DURATION':
    case 'DISTANCE':
      return 0;
    case 'WEIGHTED_CARRY':
      return Math.max(0, added);
    case 'EXTERNAL':
    default:
      return Math.max(0, added) / (spec.pulleyRatio ?? 1);
  }
}

/**
 * The EXTERNAL load one rep moves: plates and stack only, bodyweight excluded.
 *
 * Assisted work contributes zero external load — the assistance is a negative
 * external force, and reporting it as positive tonnage would be a lie.
 *
 * Source: research brief §5.
 */
export function externalRepLoadKg(set: LoggedSet, ctx: VolumeContext): number {
  const { spec } = ctx;
  const added = Number.isFinite(set.weightKg) ? set.weightKg : 0;
  switch (spec.loadModel) {
    case 'ASSISTED':
    case 'DURATION':
    case 'DISTANCE':
      return 0;
    case 'BODYWEIGHT':
    case 'WEIGHTED_CARRY':
      return Math.max(0, added);
    case 'EXTERNAL':
    default:
      return Math.max(0, added) / (spec.pulleyRatio ?? 1);
  }
}

/**
 * Total reps credited for a set.
 *
 * UNILATERAL CONVENTION (state it in the UI once): the lifter logs weight per
 * side and reps per side, so "10" on a single-arm row means 10 per arm. The rep
 * counter shows 20 and volume is per-side load × reps × 2. This is the only
 * convention under which a 2 × 20 kg dumbbell lunge and a 40 kg barbell lunge
 * produce the same volume.
 *
 * Source: research brief §5.
 */
export function repsCredited(set: LoggedSet, spec: ExerciseLoadSpec): number {
  const reps = Number.isFinite(set.reps) ? Math.max(0, set.reps) : 0;
  return spec.unilateral === true ? reps * 2 : reps;
}

/**
 * Metres of loaded carry scored as one "rep" equivalent.
 * Source: research brief §5 — the single labelled exception to "duration and
 * distance work gets zero kilograms".
 */
export const CARRY_METRES_PER_REP_EQUIVALENT = 30;

/**
 * Volume-equivalent kilograms for a loaded carry: `load × (metres / 30)`.
 *
 * Units: kg and metres in, kg-equivalent out. Label it in the UI so nobody
 * mistakes it for a lift. A 60 m farmer's walk at 80 kg scores 160 kg.
 *
 * Source: research brief §5.
 */
export function carryVolumeKg(loadKg: number, metres: number): number {
  if (!Number.isFinite(loadKg) || !Number.isFinite(metres)) return 0;
  return Math.max(0, loadKg) * (Math.max(0, metres) / CARRY_METRES_PER_REP_EQUIVALENT);
}

/**
 * System volume load of ONE set, in kilograms: reps credited × load per rep.
 *
 * Duration and distance work returns 0 — no invented kilograms. Loaded carries
 * are the labelled exception and use {@link carryVolumeKg}.
 *
 * Source: research brief §5.
 */
export function setVolumeKg(set: LoggedSet, ctx: VolumeContext): number {
  if (!set.completed) return 0;
  if (ctx.spec.loadModel === 'DURATION' || ctx.spec.loadModel === 'DISTANCE') return 0;
  if (ctx.spec.loadModel === 'WEIGHTED_CARRY') {
    return carryVolumeKg(repLoadKg(set, ctx), set.distanceM ?? 0);
  }
  return repsCredited(set, ctx.spec) * repLoadKg(set, ctx);
}

/** External volume load of ONE set, in kilograms. Bodyweight excluded. */
export function setExternalVolumeKg(set: LoggedSet, ctx: VolumeContext): number {
  if (!set.completed) return 0;
  if (ctx.spec.loadModel === 'DURATION' || ctx.spec.loadModel === 'DISTANCE') return 0;
  if (ctx.spec.loadModel === 'WEIGHTED_CARRY') {
    return carryVolumeKg(externalRepLoadKg(set, ctx), set.distanceM ?? 0);
  }
  return repsCredited(set, ctx.spec) * externalRepLoadKg(set, ctx);
}

/**
 * Reps in reserve at or below which a set counts as "hard".
 *
 * A hard set in the Schoenfeld/Krieger dose-response literature is one taken to
 * within roughly 0–5 reps of failure. This is the volume metric the hypertrophy
 * literature actually uses; kg-tonnage is a motivation metric with no such
 * backing. Track both, label both, never imply that more kg = more muscle.
 *
 * Source: [9].
 */
export const HARD_SET_RIR_CUTOFF = 5;

/** Every volume number for a group of sets. Round for display, once, at the edge. */
export interface VolumeBreakdown {
  /** Plates/dumbbells/stack only — "what you added". */
  externalVolumeKg: number;
  /** Bodyweight included — the honest headline total. */
  systemVolumeKg: number;
  /** Reps credited, doubled for unilateral work. */
  totalReps: number;
  /** Completed non-warm-up sets within {@link HARD_SET_RIR_CUTOFF} of failure. */
  hardSets: number;
  /** All completed non-warm-up sets. */
  workingSets: number;
  /** Seconds under tension, for duration work. */
  timeUnderTensionSec: number;
  /** Metres covered, for distance and carry work. */
  distanceM: number;
  /**
   * True when a bodyweight or assisted exercise was skipped because no
   * bodyweight is on file. Surface it as "add your bodyweight to see volume".
   */
  bodyweightMissing: boolean;
}

/** An empty breakdown. "0 kg" and "—" are different things — see `bodyweightMissing`. */
export function emptyVolumeBreakdown(): VolumeBreakdown {
  return {
    externalVolumeKg: 0,
    systemVolumeKg: 0,
    totalReps: 0,
    hardSets: 0,
    workingSets: 0,
    timeUnderTensionSec: 0,
    distanceM: 0,
    bodyweightMissing: false,
  };
}

/**
 * Aggregate volume over a group of sets of ONE exercise (one `VolumeContext`).
 *
 * Units: kilograms, reps, seconds, metres. Nothing is rounded here — round once
 * at the display edge, or a 4,000 kg session becomes 3,999 kg through
 * accumulated rounding.
 *
 * `rirOf` decides which sets count as hard; it defaults to the same RIR
 * resolution the e1RM pipeline uses, so the two can never disagree.
 *
 * Source: research brief §5.
 */
export function computeVolume(
  sets: readonly LoggedSet[],
  ctx: VolumeContext,
  rirOf: (set: LoggedSet) => number = (set) => resolveRir(set).rir,
): VolumeBreakdown {
  const out = emptyVolumeBreakdown();
  const needsBodyweight = ctx.spec.loadModel === 'BODYWEIGHT' || ctx.spec.loadModel === 'ASSISTED';
  const haveBodyweight =
    ctx.bodyweightKg != null && Number.isFinite(ctx.bodyweightKg) && ctx.bodyweightKg > 0;

  for (const set of sets) {
    if (!set.completed) continue;

    if (needsBodyweight && !haveBodyweight) out.bodyweightMissing = true;

    out.systemVolumeKg += setVolumeKg(set, ctx);
    out.externalVolumeKg += setExternalVolumeKg(set, ctx);
    out.totalReps += repsCredited(set, ctx.spec);
    out.timeUnderTensionSec += set.timeSec ?? 0;
    out.distanceM += set.distanceM ?? 0;

    if (set.setType !== 'warmup') {
      out.workingSets += 1;
      if (rirOf(set) <= HARD_SET_RIR_CUTOFF) out.hardSets += 1;
    }
  }
  return out;
}

/** Add two breakdowns. Used to roll exercises up into a session total. */
export function mergeVolume(a: VolumeBreakdown, b: VolumeBreakdown): VolumeBreakdown {
  return {
    externalVolumeKg: a.externalVolumeKg + b.externalVolumeKg,
    systemVolumeKg: a.systemVolumeKg + b.systemVolumeKg,
    totalReps: a.totalReps + b.totalReps,
    hardSets: a.hardSets + b.hardSets,
    workingSets: a.workingSets + b.workingSets,
    timeUnderTensionSec: a.timeUnderTensionSec + b.timeUnderTensionSec,
    distanceM: a.distanceM + b.distanceM,
    bodyweightMissing: a.bodyweightMissing || b.bodyweightMissing,
  };
}

/**
 * Volume load divided by bodyweight — the fair way to compare two lifters, and
 * the same lifter across a bulk. Units: dimensionless (kg/kg).
 * Returns null when no bodyweight is on file.
 *
 * Source: research brief §5.
 */
export function relativeVolume(volumeKg: number, bodyweightKg: number | null): number | null {
  if (bodyweightKg == null || !Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return null;
  return volumeKg / bodyweightKg;
}

/**
 * Intensity-weighted volume: `Σ reps × load × (load / e1RM)`, in kilograms.
 *
 * Use it for fatigue modelling, NEVER as the headline number — it is not
 * comparable to tonnage and is meaningless without a current e1RM.
 *
 * Source: research brief §5.
 */
export function intensityWeightedVolumeKg(
  sets: readonly LoggedSet[],
  ctx: VolumeContext,
  e1rmKg: number,
): number {
  if (!Number.isFinite(e1rmKg) || e1rmKg <= 0) return 0;
  let total = 0;
  for (const set of sets) {
    if (!set.completed) continue;
    const load = repLoadKg(set, ctx);
    total += repsCredited(set, ctx.spec) * load * (load / e1rmKg);
  }
  return total;
}
