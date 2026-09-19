/**
 * Muscle readiness, derived from the training log alone.
 *
 * `@core/readiness` accrues fatigue per set and decays it on two compartments
 * per muscle. It needs three things this app has to assemble: the sets (with a
 * fatigue profile per exercise), the user's weekly hard-set counts, and a split
 * profile describing when they normally train what. All three are rebuilt from
 * history here on every render — the history is small and local, and a derived
 * cache that can go stale is worse than a recompute.
 */

import {
  ALL_MUSCLES,
  MUSCLES,
  READINESS_BANDS,
  accrueSets,
  allMuscleReadiness,
  appendDeposits,
  emptyReadinessState,
  recommend,
  type LoggedSet as FatigueSet,
  type MuscleId,
  type MuscleReadiness,
  type SetType as FatigueSetType,
  type SessionTemplate,
  type SetWithProfile,
  type SplitProfile,
  type WeeklyVolume,
} from '@core/readiness';
import type { CompletedWorkout, SetType } from '@/features/workout/types';
import { fatigueProfileFor } from './mapping';

const DAY_MS = 86_400_000;

/** Sessions older than this contribute nothing measurable and are skipped. */
const FATIGUE_WINDOW_DAYS = 21;

/** A set counts as a hard set for a muscle at or above this involvement. */
const HARD_SET_INVOLVEMENT = 0.5;

const FATIGUE_SET_TYPE: Readonly<Record<SetType, FatigueSetType>> = {
  warmup: 'warmup',
  normal: 'normal',
  drop: 'drop',
  failure: 'failure',
};

export interface ReadinessView {
  /** Every muscle, most fatigued first. */
  readonly muscles: readonly MuscleReadiness[];
  /** Muscles that have actually been trained, most fatigued first. */
  readonly trained: readonly MuscleReadiness[];
  /** One line: what to train today. */
  readonly recommendation: string;
  /** Muscles named in the recommendation. */
  readonly suggested: readonly MuscleId[];
  /** Hard sets logged per muscle in the last 7 days. */
  readonly weekSets: Readonly<Partial<Record<MuscleId, number>>>;
}

function toFatigueSets(
  history: readonly CompletedWorkout[],
  now: number,
): { sets: SetWithProfile[]; dailyLoads: number[] } {
  const sets: SetWithProfile[] = [];
  const loadByDay = new Map<number, number>();
  const cutoff = now - FATIGUE_WINDOW_DAYS * DAY_MS;

  for (const workout of history) {
    if (workout.startedAt < cutoff) continue;
    const day = Math.floor(workout.startedAt / DAY_MS);
    loadByDay.set(day, (loadByDay.get(day) ?? 0) + workout.volumeKg);

    for (const exercise of workout.exercises) {
      const profile = fatigueProfileFor(exercise.exerciseId);
      if (profile === null) continue;
      for (const raw of exercise.sets) {
        if (!raw.done || raw.reps === null) continue;
        const set: FatigueSet = {
          exerciseId: profile.id,
          type: FATIGUE_SET_TYPE[raw.type],
          weightKg: raw.weightKg ?? 0,
          reps: raw.reps,
          at: workout.startedAt,
          ...(raw.rpe === null || raw.rpe === undefined
            ? {}
            : { rir: Math.max(0, 10 - raw.rpe) }),
        };
        sets.push({ set, profile });
      }
    }
  }

  const days = [...loadByDay.entries()].sort((a, b) => a[0] - b[0]);
  return { sets, dailyLoads: days.map(([, load]) => load) };
}

function weeklyVolume(history: readonly CompletedWorkout[], now: number): WeeklyVolume {
  const sets: Partial<Record<MuscleId, number>> = {};
  const cutoff = now - 7 * DAY_MS;
  for (const workout of history) {
    if (workout.startedAt < cutoff) continue;
    for (const exercise of workout.exercises) {
      const profile = fatigueProfileFor(exercise.exerciseId);
      if (profile === null) continue;
      const hard = exercise.sets.filter((s) => s.done && s.type !== 'warmup').length;
      if (hard === 0) continue;
      for (const [muscle, involvement] of Object.entries(profile.contributions)) {
        if (involvement === undefined || involvement < HARD_SET_INVOLVEMENT) continue;
        const id = muscle as MuscleId;
        sets[id] = (sets[id] ?? 0) + hard;
      }
    }
  }
  return { sets };
}

function splitProfile(history: readonly CompletedWorkout[], now: number): SplitProfile {
  const cutoff = now - 56 * DAY_MS;
  const recent = history.filter((w) => w.startedAt >= cutoff);

  const weekdayCounts = new Map<MuscleId, number[]>();
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  const templateMuscles = new Map<string, Set<MuscleId>>();

  for (const workout of recent) {
    const weekday = new Date(workout.startedAt).getDay();
    const slot = weekdayTotals[weekday];
    if (slot !== undefined) weekdayTotals[weekday] = slot + 1;

    const seen = new Set<MuscleId>();
    for (const exercise of workout.exercises) {
      const profile = fatigueProfileFor(exercise.exerciseId);
      if (profile === null) continue;
      for (const [muscle, involvement] of Object.entries(profile.contributions)) {
        if (involvement === undefined || involvement < HARD_SET_INVOLVEMENT) continue;
        seen.add(muscle as MuscleId);
      }
    }
    for (const muscle of seen) {
      const row = weekdayCounts.get(muscle) ?? [0, 0, 0, 0, 0, 0, 0];
      const value = row[weekday];
      if (value !== undefined) row[weekday] = value + 1;
      weekdayCounts.set(muscle, row);
      const bucket = templateMuscles.get(workout.name) ?? new Set<MuscleId>();
      bucket.add(muscle);
      templateMuscles.set(workout.name, bucket);
    }
  }

  const weekdayAffinity: Partial<Record<MuscleId, number[]>> = {};
  for (const [muscle, row] of weekdayCounts) {
    weekdayAffinity[muscle] = row.map((count, day) => {
      const total = weekdayTotals[day] ?? 0;
      return total === 0 ? 0 : count / total;
    });
  }

  const templates: SessionTemplate[] = [...templateMuscles.entries()].map(([name, muscles]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    muscles: [...muscles],
  }));

  const weeks = Math.max(1, (now - cutoff) / (7 * DAY_MS));
  return {
    weekdayAffinity,
    sessionsPerWeek: Math.max(1, Math.round(recent.length / weeks)),
    templates,
  };
}

/** Fallback line when the recommender has nothing to reason from. */
function fallbackLine(muscles: readonly MuscleReadiness[]): { line: string; ids: MuscleId[] } {
  const fresh = muscles
    .filter((m) => m.pct >= READINESS_BANDS.readyFloor)
    .sort((a, b) => {
      const aTrained = a.lastTrainedAt ?? 0;
      const bTrained = b.lastTrainedAt ?? 0;
      return aTrained - bTrained;
    })
    .slice(0, 3);
  if (fresh.length === 0) {
    return { line: 'Everything is still recovering — today is a rest day.', ids: [] };
  }
  const names = fresh.map((m) => MUSCLES[m.muscle].label.toLowerCase());
  return {
    line: `Freshest right now: ${names.join(', ')}. Train those today.`,
    ids: fresh.map((m) => m.muscle),
  };
}

/**
 * Per-muscle readiness and a one-line recommendation, from history alone.
 *
 * @param history completed workouts, any order
 * @param now epoch ms, supplied by the caller
 */
export function readinessView(history: readonly CompletedWorkout[], now: number): ReadinessView {
  const { sets, dailyLoads } = toFatigueSets(history, now);
  const accrued = accrueSets(sets, {});
  const state = appendDeposits(emptyReadinessState(), accrued.deposits, accrued.systemic);
  const muscles = allMuscleReadiness(state, now);

  const trainedIds = new Set<MuscleId>();
  for (const entry of sets) {
    for (const [muscle, involvement] of Object.entries(entry.profile.contributions)) {
      if (involvement === undefined || involvement <= 0) continue;
      trainedIds.add(muscle as MuscleId);
    }
  }

  const byFatigue = [...muscles].sort((a, b) => a.pct - b.pct);
  const trained = byFatigue.filter((m) => trainedIds.has(m.muscle) || m.lastTrainedAt !== null);

  const weekSets = weeklyVolume(history, now);
  let recommendation = '';
  let suggested: MuscleId[] = [];

  const split = splitProfile(history, now);
  if (sets.length > 0 && split.templates.length > 0) {
    try {
      const { today } = recommend({ state, now, weekSets: weekSets, split, dailyLoads });
      recommendation = today.reason;
      suggested = today.muscles.map((m) => m.muscle);
    } catch {
      recommendation = '';
    }
  }
  if (recommendation === '') {
    const fallback = fallbackLine(trained.length > 0 ? trained : muscles);
    recommendation = fallback.line;
    suggested = fallback.ids;
  }

  return { muscles: byFatigue, trained, recommendation, suggested, weekSets: weekSets.sets };
}

/** Every muscle id, for the empty state's silhouette of chips. */
export const EVERY_MUSCLE: readonly MuscleId[] = ALL_MUSCLES;
