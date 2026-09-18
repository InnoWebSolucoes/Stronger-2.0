/**
 * Personal record detection.
 *
 * Eight distinct record types, each behind a minimum improvement margin, a
 * baseline requirement, a per-key cooldown and a hard cap on how many badges
 * one workout may award. Every one of these rules exists because a shipped
 * tracker got it wrong: an app that hands out eight "PR!" badges in a session
 * teaches the user that PRs are meaningless, and a PR minted from a mistyped
 * weight is a permanent lie in their history.
 *
 * Units: `value` is kilograms for every type except `REPS_AT_WEIGHT` and
 * `SESSION_REPS`, where it is reps. See {@link PR_VALUE_UNIT}.
 *
 * Source: research brief §7 "PR DETECTION" and the "PR TYPES AND THEIR EXACT
 * TRIGGERS" table.
 */

import { roundTo } from './units';

/** The eight record classes the app recognises. */
export type PrType =
  /** Best estimated 1RM for this exercise (from the session best). */
  | 'E1RM'
  /** Heaviest load moved for at least one rep. */
  | 'WEIGHT'
  /** Most reps at one specific load. */
  | 'REPS_AT_WEIGHT'
  /** Best TRUE (not estimated) 1/2/3/5/8/10/12/15/20 rep max. */
  | 'REP_MAX'
  /** Best single set: reps × load. */
  | 'SET_VOLUME'
  /** Best total volume for this exercise in one session. */
  | 'EXERCISE_VOLUME'
  /** Best total volume for a whole workout. */
  | 'SESSION_VOLUME'
  /** Most reps in one workout. */
  | 'SESSION_REPS';

/** What the `value` of each record type is measured in. */
export const PR_VALUE_UNIT: Record<PrType, 'kg' | 'reps'> = {
  E1RM: 'kg',
  WEIGHT: 'kg',
  REPS_AT_WEIGHT: 'reps',
  REP_MAX: 'kg',
  SET_VOLUME: 'kg',
  EXERCISE_VOLUME: 'kg',
  SESSION_VOLUME: 'kg',
  SESSION_REPS: 'reps',
};

/** A record already on file. */
export interface PrRecord {
  type: PrType;
  /** Stable exercise slug. Absent for the two session-wide types. */
  exerciseId?: string;
  /** kg or reps — see {@link PR_VALUE_UNIT}. */
  value: number;
  /** Part of the key for `REPS_AT_WEIGHT`: the snapped load, kg. */
  atWeightKg?: number;
  /** Part of the key for `REP_MAX`: the ladder rep count. */
  reps?: number;
  /** Epoch milliseconds. Injected by the caller — `src/core` owns no clock. */
  date: number;
  setId?: string;
}

/** A record this session might have set. */
export interface PrCandidate extends PrRecord {
  /**
   * 0–1 confidence of the underlying measurement (see `RIR_SOURCE_CONFIDENCE`
   * in `e1rm.ts`). Defaults to 1. Low-confidence candidates must clear a bigger
   * margin.
   */
  confidence?: number;
  /**
   * How many prior sessions exist for this exercise (or workouts, for the
   * session-wide types). Below {@link PR_RULES.minPriorSessions} no record is
   * awarded — otherwise every set of a brand-new exercise is a "PR".
   */
  priorSessionCount?: number;
  /** Reps of the set behind this candidate; sets above 20 reps cannot set records. */
  setReps?: number;
  /**
   * Change in the lifter's bodyweight since the previous record on a bodyweight
   * exercise, kg. A positive delta annotates the award rather than suppressing
   * it, so the user can tell a strength gain from a mass gain.
   */
  bodyweightDeltaKg?: number;
}

/** A record actually awarded, with everything the badge needs to explain itself. */
export interface PrAward extends PrCandidate {
  /** The key this record competes on. */
  key: string;
  /** The value that was beaten, or null when this is the first record of its kind. */
  previousValue: number | null;
  /** New minus old, in the type's own unit. */
  improvement: number;
  /** Fractional improvement; `Infinity` for a first record. */
  relativeImprovement: number;
  isFirstRecord: boolean;
  /** True when a bodyweight-exercise record coincided with a bodyweight gain. */
  bodyweightDriven: boolean;
}

/**
 * The anti-spam rule set.
 *
 * Margins: an e1RM must beat the old one by 0.5%, a single set's volume by 1%,
 * and anything session-wide by 2%. Absolute-weight and rep records need no
 * margin because they are discrete — you either lifted more or you did not.
 *
 * Source: research brief §7 and §"Gate PRs behind a minimum improvement margin".
 */
export const PR_RULES = {
  /** Beat the old record by at least this fraction, or it is not a record. */
  minRelativeImprovement: {
    E1RM: 0.005,
    WEIGHT: 0,
    REPS_AT_WEIGHT: 0,
    REP_MAX: 0,
    SET_VOLUME: 0.01,
    EXERCISE_VOLUME: 0.02,
    SESSION_VOLUME: 0.02,
    SESSION_REPS: 0.02,
  } as Record<PrType, number>,
  /** Record types that refuse to fire without an existing baseline record. */
  requiresBaseline: {
    E1RM: true,
    WEIGHT: true,
    REPS_AT_WEIGHT: false,
    REP_MAX: false,
    SET_VOLUME: false,
    EXERCISE_VOLUME: false,
    SESSION_VOLUME: false,
    SESSION_REPS: false,
  } as Record<PrType, boolean>,
  /** No baseline, no PR: prevents "every set is a PR" on a new exercise. */
  minPriorSessions: 2,
  /** A set above this rep count can never set a record. */
  maxRepsForPr: 20,
  /** At most this many PR badges per workout; the highest-tier ones survive. */
  maxBadgesPerWorkout: 3,
  /**
   * At most this many badges for any one exercise (and at most this many
   * session-wide badges). This is the rule that stops "you set six PRs on
   * bench press" — the app names the single best thing that happened to each
   * lift and stays quiet about the rest.
   */
  maxBadgesPerExercise: 1,
  /** Tier order used when trimming. Earlier = more important. */
  tier: [
    'E1RM',
    'WEIGHT',
    'REP_MAX',
    'REPS_AT_WEIGHT',
    'SET_VOLUME',
    'EXERCISE_VOLUME',
    'SESSION_VOLUME',
    'SESSION_REPS',
  ] as readonly PrType[],
  /** Suppress a repeat of the same key within this many hours. */
  cooldownHours: 20,
  /** Below this confidence the candidate must clear an extra margin. */
  lowConfidenceThreshold: 0.6,
  /** Extra fractional margin demanded of a low-confidence candidate. */
  lowConfidenceExtraMargin: 0.02,
} as const;

/**
 * The rep counts that define a true rep-max record class.
 *
 * Only these counts create a record, so an odd set of 7 does not mint a new
 * "7RM" class that will never be challenged again.
 *
 * Source: research brief §7 `REP_MAX_LADDER`.
 */
export const REP_MAX_LADDER: readonly number[] = [1, 2, 3, 5, 8, 10, 12, 15, 20];

/** Is this rep count one of the celebrated rep-max classes? */
export function isRepMaxLadderRep(reps: number): boolean {
  return REP_MAX_LADDER.includes(reps);
}

/**
 * Snap a load onto the loadable increment before it becomes part of a record
 * key, so 60.0 kg and 60.00001 kg are one record and not two.
 *
 * Units: kg in, kg out. Default increment 0.25 kg — the finest micro-plate in
 * circulation.
 *
 * Source: research brief §"Snap the weight key for 'reps at a weight' records".
 */
export function snapWeightKey(weightKg: number, incrementKg = 0.25): number {
  return roundTo(weightKg, incrementKg);
}

/**
 * The identity of a record. Two records compete if and only if their keys
 * match. Includes the snapped load for `REPS_AT_WEIGHT` and the ladder rep
 * count for `REP_MAX`; everything else keys on type + exercise.
 */
export function prKey(record: PrRecord): string {
  const parts: (string | number)[] = [record.type, record.exerciseId ?? ''];
  if (record.type === 'REPS_AT_WEIGHT') parts.push(snapWeightKey(record.atWeightKg ?? 0));
  else parts.push('');
  if (record.type === 'REP_MAX') parts.push(record.reps ?? 0);
  else parts.push('');
  return parts.join('|');
}

/** Highest existing record per key, for fast baseline lookup. */
export function bestExistingByKey(existing: readonly PrRecord[]): Map<string, PrRecord> {
  const best = new Map<string, PrRecord>();
  for (const record of existing) {
    if (!Number.isFinite(record.value)) continue;
    const key = prKey(record);
    const current = best.get(key);
    if (current === undefined || record.value > current.value) best.set(key, record);
  }
  return best;
}

/** Tunable subset of {@link PR_RULES}, for tests and future per-user settings. */
export interface PrRuleOverrides {
  maxBadgesPerWorkout?: number;
  maxBadgesPerExercise?: number;
  minPriorSessions?: number;
  cooldownHours?: number;
}

/**
 * Decide which of this session's candidates are real personal records.
 *
 * Rejects, in order: non-finite values, sets over
 * {@link PR_RULES.maxRepsForPr} reps, `REP_MAX` candidates off the ladder,
 * exercises with too few prior sessions, types that require a baseline and have
 * none, improvements inside the minimum margin (raised for low-confidence
 * candidates), and repeats inside the cooldown. Survivors are sorted by tier
 * then by relative improvement, trimmed to one per exercise, then trimmed to
 * {@link PR_RULES.maxBadgesPerWorkout} overall.
 *
 * `now` is injected — `src/core` owns no clock.
 *
 * Source: research brief §7.
 */
export function detectPrs(
  candidates: readonly PrCandidate[],
  existing: readonly PrRecord[],
  now: number,
  overrides: PrRuleOverrides = {},
): PrAward[] {
  const maxBadgesPerWorkout = overrides.maxBadgesPerWorkout ?? PR_RULES.maxBadgesPerWorkout;
  const maxBadgesPerExercise = overrides.maxBadgesPerExercise ?? PR_RULES.maxBadgesPerExercise;
  const minPriorSessions = overrides.minPriorSessions ?? PR_RULES.minPriorSessions;
  const cooldownMs = (overrides.cooldownHours ?? PR_RULES.cooldownHours) * 3_600_000;

  const baseline = bestExistingByKey(existing);
  const won: PrAward[] = [];

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.value)) continue;
    if (candidate.setReps != null && candidate.setReps > PR_RULES.maxRepsForPr) continue;
    if (candidate.type === 'REP_MAX' && !isRepMaxLadderRep(candidate.reps ?? -1)) continue;
    if (candidate.priorSessionCount != null && candidate.priorSessionCount < minPriorSessions) {
      continue;
    }

    const key = prKey(candidate);
    const previous = baseline.get(key);

    if (previous === undefined && PR_RULES.requiresBaseline[candidate.type]) continue;
    if (previous !== undefined && now - previous.date < cooldownMs) continue;

    const confidence = candidate.confidence ?? 1;
    let margin = PR_RULES.minRelativeImprovement[candidate.type];
    if (confidence < PR_RULES.lowConfidenceThreshold) {
      margin += PR_RULES.lowConfidenceExtraMargin;
    }

    const previousValue = previous?.value ?? null;
    if (previousValue !== null && candidate.value <= previousValue * (1 + margin)) continue;

    const improvement = previousValue === null ? candidate.value : candidate.value - previousValue;
    const relativeImprovement =
      previousValue === null || previousValue === 0
        ? Number.POSITIVE_INFINITY
        : improvement / previousValue;

    won.push({
      ...candidate,
      key,
      previousValue,
      improvement,
      relativeImprovement,
      isFirstRecord: previousValue === null,
      bodyweightDriven: (candidate.bodyweightDeltaKg ?? 0) > 0,
    });
  }

  won.sort((a, b) => {
    const tierDelta = tierRank(a.type) - tierRank(b.type);
    if (tierDelta !== 0) return tierDelta;
    return b.relativeImprovement - a.relativeImprovement;
  });

  const perGroup = new Map<string, number>();
  const trimmed: PrAward[] = [];
  for (const award of won) {
    const group = award.exerciseId ?? '__session__';
    const used = perGroup.get(group) ?? 0;
    if (used >= maxBadgesPerExercise) continue;
    perGroup.set(group, used + 1);
    trimmed.push(award);
    if (trimmed.length >= maxBadgesPerWorkout) break;
  }
  return trimmed;
}

function tierRank(type: PrType): number {
  const index = PR_RULES.tier.indexOf(type);
  return index === -1 ? PR_RULES.tier.length : index;
}

/* ========================================================================== *
 * CANDIDATE BUILDERS                                                          *
 * ========================================================================== */

/** One working set, reduced to what PR detection needs. */
export interface PrSetInput {
  setId: string;
  /** Reps credited for this set. */
  reps: number;
  /** Load actually moved per rep, kg (use `repLoadKg()` from `volume.ts`). */
  loadKg: number;
  /** System volume of this set, kg (use `setVolumeKg()` from `volume.ts`). */
  volumeKg: number;
}

/** Everything needed to propose records for one exercise in one session. */
export interface ExercisePrInput {
  exerciseId: string;
  /** Epoch ms of the session. */
  date: number;
  /** Prior sessions on this exercise, for the baseline rule. */
  priorSessionCount: number;
  /** Completed, non-warm-up sets only. */
  sets: readonly PrSetInput[];
  /** Session best e1RM in kg, from `sessionBest()`. Omit to skip the E1RM type. */
  bestE1rmKg?: number | null;
  /** Confidence of that e1RM sample, 0–1. */
  e1rmConfidence?: number;
  /** Increment the load key snaps to, kg. */
  weightIncrementKg?: number;
  /** Bodyweight change since the last record on this exercise, kg. */
  bodyweightDeltaKg?: number;
}

/**
 * Propose every exercise-scoped record this session could have set: E1RM,
 * WEIGHT, REP_MAX (ladder reps only), REPS_AT_WEIGHT (best reps per snapped
 * load), SET_VOLUME and EXERCISE_VOLUME.
 *
 * Proposing is cheap and lossless; {@link detectPrs} does all the filtering, so
 * the margin, cooldown and badge-cap rules live in exactly one place.
 *
 * Units: kg and reps. Returns an empty array when there are no usable sets.
 */
export function buildExercisePrCandidates(input: ExercisePrInput): PrCandidate[] {
  const usable = input.sets.filter(
    (s) => Number.isFinite(s.reps) && s.reps >= 1 && Number.isFinite(s.loadKg) && s.loadKg > 0,
  );
  const candidates: PrCandidate[] = [];
  const common = {
    exerciseId: input.exerciseId,
    date: input.date,
    priorSessionCount: input.priorSessionCount,
    bodyweightDeltaKg: input.bodyweightDeltaKg,
  };

  if (input.bestE1rmKg != null && Number.isFinite(input.bestE1rmKg) && input.bestE1rmKg > 0) {
    candidates.push({
      ...common,
      type: 'E1RM',
      value: input.bestE1rmKg,
      confidence: input.e1rmConfidence ?? 1,
    });
  }

  if (usable.length === 0) return candidates;

  let heaviest: PrSetInput | null = null;
  let bestSetVolume: PrSetInput | null = null;
  const bestByRepMax = new Map<number, PrSetInput>();
  const bestRepsAtWeight = new Map<number, PrSetInput>();
  let exerciseVolumeKg = 0;

  for (const set of usable) {
    exerciseVolumeKg += set.volumeKg;
    if (heaviest === null || set.loadKg > heaviest.loadKg) heaviest = set;
    if (bestSetVolume === null || set.volumeKg > bestSetVolume.volumeKg) bestSetVolume = set;

    if (isRepMaxLadderRep(set.reps)) {
      const current = bestByRepMax.get(set.reps);
      if (current === undefined || set.loadKg > current.loadKg) bestByRepMax.set(set.reps, set);
    }

    const weightKey = snapWeightKey(set.loadKg, input.weightIncrementKg ?? 0.25);
    const currentReps = bestRepsAtWeight.get(weightKey);
    if (currentReps === undefined || set.reps > currentReps.reps) {
      bestRepsAtWeight.set(weightKey, set);
    }
  }

  if (heaviest !== null) {
    candidates.push({
      ...common,
      type: 'WEIGHT',
      value: heaviest.loadKg,
      setId: heaviest.setId,
      setReps: heaviest.reps,
    });
  }

  for (const [reps, set] of bestByRepMax) {
    candidates.push({
      ...common,
      type: 'REP_MAX',
      value: set.loadKg,
      reps,
      setId: set.setId,
      setReps: reps,
    });
  }

  for (const [weightKey, set] of bestRepsAtWeight) {
    candidates.push({
      ...common,
      type: 'REPS_AT_WEIGHT',
      value: set.reps,
      atWeightKg: weightKey,
      setId: set.setId,
      setReps: set.reps,
    });
  }

  if (bestSetVolume !== null) {
    candidates.push({
      ...common,
      type: 'SET_VOLUME',
      value: bestSetVolume.volumeKg,
      setId: bestSetVolume.setId,
      setReps: bestSetVolume.reps,
    });
  }

  candidates.push({ ...common, type: 'EXERCISE_VOLUME', value: exerciseVolumeKg });

  return candidates;
}

/** Whole-workout totals, for the two session-wide record types. */
export interface SessionPrInput {
  date: number;
  priorSessionCount: number;
  sessionVolumeKg: number;
  sessionReps: number;
}

/**
 * Propose the two session-wide records: total volume and total reps.
 * Units: kg and reps.
 */
export function buildSessionPrCandidates(input: SessionPrInput): PrCandidate[] {
  const out: PrCandidate[] = [];
  if (Number.isFinite(input.sessionVolumeKg) && input.sessionVolumeKg > 0) {
    out.push({
      type: 'SESSION_VOLUME',
      value: input.sessionVolumeKg,
      date: input.date,
      priorSessionCount: input.priorSessionCount,
    });
  }
  if (Number.isFinite(input.sessionReps) && input.sessionReps > 0) {
    out.push({
      type: 'SESSION_REPS',
      value: input.sessionReps,
      date: input.date,
      priorSessionCount: input.priorSessionCount,
    });
  }
  return out;
}
