/**
 * Bridges between the exercise catalog and the scoring, standards and
 * readiness engines.
 *
 * The catalog already carries almost everything these engines need — a
 * contribution vector over the 21 muscle groups, a fatigue archetype, a
 * tracking type and a measured bodyweight factor — so this module mostly
 * translates vocabularies rather than inventing data. The one thing it has to
 * supply is which catalog rows map onto a published strength standard, because
 * `StandardsRef` is not yet populated in the seed.
 *
 * Nothing here guesses. An exercise with no published table simply has none and
 * is tracked without being ranked, which is the honest outcome: inventing a
 * table would put a number on screen that no source stands behind.
 */

import {
  MUSCLE_GROUPS as CATALOG_GROUPS,
  findExercise,
  resolveFatigueParams,
  type MuscleGroupId,
  type SeedExercise,
} from '@core/exercises';
import { isMuscleId, MUSCLES, type ExerciseFatigueProfile, type MuscleId } from '@core/readiness';
import { SCORING_PATTERNS, getStandard, type ExerciseStandard, type ScoringPattern } from '@core/standards';

/* -------------------------------------------------------------------------- */
/* Muscle vocabularies                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The catalog's 21 muscle groups and the readiness model's muscle ids are the
 * same names but not the same set: the catalog has `hip_flexors`, the readiness
 * model has `tibialis`. `isMuscleId` is the guard, so a group the readiness
 * model does not model is dropped rather than silently mis-credited.
 */
export function toMuscleId(group: MuscleGroupId): MuscleId | null {
  return isMuscleId(group) ? group : null;
}

/** Human label for a readiness muscle id. */
export function labelForMuscleId(id: MuscleId): string {
  return MUSCLES[id].label;
}

/** Human label for a catalog muscle group. */
export function labelForGroup(group: MuscleGroupId): string {
  return CATALOG_GROUPS[group].label;
}

/* -------------------------------------------------------------------------- */
/* Catalog → published strength standard                                       */
/* -------------------------------------------------------------------------- */

/**
 * Catalog id → `@core/standards` slug.
 *
 * Only exact equivalences are listed: the same movement, the same equipment,
 * the same logged units. Variants that would need a conversion ratio are left
 * out until the catalog's own `StandardsRef` carries one, because a ratio
 * invented here would not be the ratio the engine's tests assert.
 */
const STANDARD_SLUG_BY_EXERCISE: Readonly<Record<string, string>> = {
  'bench-press--barbell': 'bench_press',
  'incline-bench-press--barbell': 'incline_bench_press',
  'close-grip-bench-press--barbell': 'close_grip_bench_press',
  'bench-press--dumbbell': 'dumbbell_bench_press',
  'chest-dip--bodyweight': 'dip',
  'chest-dip--dip_belt--weighted': 'dip',
  'triceps-dip--bodyweight': 'dip',

  'deadlift--barbell': 'deadlift',
  'sumo-deadlift--barbell': 'sumo_deadlift',
  'romanian-deadlift--barbell': 'romanian_deadlift',

  'bent-over-row--barbell': 'barbell_row',
  'seated-row--cable': 'seated_cable_row',
  'lat-pulldown--cable': 'lat_pulldown',
  'pull-up--bodyweight': 'pull_up',
  'pull-up--dip_belt--weighted': 'pull_up',
  'chin-up--bodyweight': 'chin_up',
  'chin-up--dip_belt--weighted': 'chin_up',
  'shrug--barbell': 'barbell_shrug',

  'overhead-press--barbell': 'overhead_press',
  'seated-overhead-press--barbell': 'overhead_press',
  'seated-overhead-press--dumbbell': 'dumbbell_shoulder_press',
  'lateral-raise--dumbbell': 'dumbbell_lateral_raise',

  'biceps-curl--barbell': 'barbell_curl',
  'biceps-curl--ez_bar': 'barbell_curl',
  'triceps-pushdown--cable': 'tricep_pushdown',

  'back-squat--barbell': 'back_squat',
  'high-bar-squat--barbell': 'back_squat',
  'low-bar-squat--barbell': 'back_squat',
  'front-squat--barbell': 'front_squat',
  'hack-squat--hack_squat_machine': 'hack_squat',
  'leg-press--leg_press_machine': 'leg_press',
  'bulgarian-split-squat--dumbbell': 'bulgarian_split_squat',
  'bulgarian-split-squat--barbell': 'bulgarian_split_squat',
  'leg-extension--machine_selectorized': 'leg_extension',
  'lying-leg-curl--machine_selectorized': 'lying_leg_curl',
  'seated-leg-curl--machine_selectorized': 'lying_leg_curl',
  'hip-thrust--barbell': 'hip_thrust',
  'seated-calf-raise--machine_selectorized': 'seated_calf_raise',
};

/**
 * The published standard for a catalog exercise, or undefined when none exists.
 *
 * The catalog's own `StandardsRef` wins when it is populated — it carries the
 * conversion ratio the catalog's tests assert — and this table is the fallback
 * until that lands.
 */
export function standardFor(exerciseId: string): ExerciseStandard | undefined {
  const catalogRef = findExercise(exerciseId)?.standards;
  if (catalogRef != null && catalogRef.countsTowardRank) {
    const viaCatalog = STANDARD_SLUG_BY_EXERCISE[catalogRef.parentId];
    if (viaCatalog !== undefined) return getStandard(viaCatalog);
  }
  const slug = STANDARD_SLUG_BY_EXERCISE[exerciseId];
  if (slug === undefined) return undefined;
  return getStandard(slug);
}

/**
 * Ratio converting this exercise's e1RM into the parent lift's, when the
 * catalog publishes one. 1 when the exercise is itself the standard.
 */
export function standardsRatio(exerciseId: string): number {
  const ref = findExercise(exerciseId)?.standards;
  if (ref != null && ref.countsTowardRank && STANDARD_SLUG_BY_EXERCISE[ref.parentId] !== undefined) {
    return ref.ratio;
  }
  return 1;
}

/** The six-pattern scoring bucket for a standard, or null for isolation lifts. */
export function scoringPatternOf(std: ExerciseStandard): ScoringPattern | null {
  return SCORING_PATTERNS.find((p) => p === std.pattern) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Catalog → fatigue profile                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The readiness engine's view of a catalog exercise.
 *
 * The contribution vector is the catalog's own `groupWeights` (which sums to
 * 1.0 across the 21 groups), and the axial load, loaded-stretch index, SFR and
 * eccentric tempo come from the exercise's fatigue archetype plus any
 * per-exercise override. Nothing is estimated here.
 */
export function fatigueProfileFor(exerciseId: string): ExerciseFatigueProfile | null {
  const exercise = findExercise(exerciseId);
  if (exercise === undefined) return null;

  const contributions: Partial<Record<MuscleId, number>> = {};
  for (const [group, weight] of Object.entries(exercise.groupWeights)) {
    if (weight === undefined || weight <= 0) continue;
    const id = toMuscleId(group as MuscleGroupId);
    if (id === null) continue;
    contributions[id] = weight;
  }
  if (Object.keys(contributions).length === 0) return null;

  const params = resolveFatigueParams(exercise.archetype, exercise.fatigueOverrides);
  return {
    id: exercise.id,
    name: exercise.name,
    contributions,
    axialLoad: params.axialLoad,
    loadedStretchIndex: params.loadedStretchIndex,
    sfr: params.sfr,
    defaultEccentricSec: params.defaultEccentricSec,
  };
}

/** The catalog row for an id, when it is still in the catalog. */
export function catalogExercise(exerciseId: string): SeedExercise | undefined {
  return findExercise(exerciseId);
}

/**
 * The contribution vector as `[label, share]` pairs, heaviest first.
 * Used by the training-split bars, which credit volume by real involvement
 * rather than by a muscle's position in a list.
 */
export function groupSharesOf(exerciseId: string): readonly (readonly [string, number])[] {
  const exercise = findExercise(exerciseId);
  if (exercise === undefined) return [];
  const out: [string, number][] = [];
  for (const [group, weight] of Object.entries(exercise.groupWeights)) {
    if (weight === undefined || weight <= 0) continue;
    out.push([labelForGroup(group as MuscleGroupId), weight]);
  }
  out.sort((a, b) => b[1] - a[1]);
  return out;
}
