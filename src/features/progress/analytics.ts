/**
 * Everything the Progress tab knows, derived from the workout history.
 *
 * Pure derivation: this module takes `CompletedWorkout[]` plus the lifter's
 * bodyweight and returns numbers. It reads no clock of its own — `now` is always
 * a parameter — so the screens can be tested and so a range selector can rewind
 * without anything going stale behind it.
 *
 * The lifting maths is NOT reimplemented here. e1RM comes from the calibrated
 * pipeline in `@core/scoring` (`estimateSetE1rm` → `sessionBestE1rm`), which
 * applies the weight-dependent/RTS blend, the blank-RPE prior and the
 * confidence-weighted session quantile. This file only decides which sets to
 * feed it and how to shape the answer for a chart.
 */

import {
  estimateSetE1rm,
  repLoadKg,
  sessionBestE1rm,
  type E1rmSample,
  type ExerciseLoadSpec,
  type LoggedSet as CoreSet,
  type SetType as CoreSetType,
} from '@core/scoring';
import {
  classifyLift,
  overallStanding,
  type LiftClassification,
  type LifterProfile,
  type OverallStanding,
  type PatternBest,
} from '@core/standards';
import type { CompletedWorkout, LoggedSet, SetType } from '@/features/workout/types';
import { catalogExercise, groupSharesOf, scoringPatternOf, standardFor, standardsRatio } from './mapping';

const DAY_MS = 86_400_000;

/* -------------------------------------------------------------------------- */
/* Range                                                                       */
/* -------------------------------------------------------------------------- */

export type RangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const RANGES: readonly { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1W', label: '1W', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 182 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'ALL', label: 'All', days: null },
];

export const RANGE_NOUN: Readonly<Record<RangeKey, string>> = {
  '1W': 'this week',
  '1M': 'this month',
  '3M': 'in 3 months',
  '6M': 'in 6 months',
  '1Y': 'this year',
  ALL: 'all time',
};

/** Start instant of a range. `-Infinity` for "all", so comparisons stay simple. */
export function rangeStart(range: RangeKey, now: number): number {
  const found = RANGES.find((r) => r.key === range);
  const days = found?.days ?? null;
  return days === null ? Number.NEGATIVE_INFINITY : now - days * DAY_MS;
}

/* -------------------------------------------------------------------------- */
/* Set translation                                                             */
/* -------------------------------------------------------------------------- */

const CORE_SET_TYPE: Readonly<Record<SetType, CoreSetType>> = {
  warmup: 'warmup',
  normal: 'normal',
  drop: 'dropset',
  failure: 'failure',
};

/**
 * Load description for a catalog exercise.
 *
 * Read straight off the catalog row: its tracking type says how the set is
 * logged, and `bwFactor` is a force-plate measurement, not an estimate. An
 * exercise that is not in the catalog any more (history outlives catalog
 * versions) falls back to external load, which is what a plain weight × reps
 * row means.
 */
export function loadSpecFor(exerciseId: string): ExerciseLoadSpec {
  const exercise = catalogExercise(exerciseId);
  if (exercise === undefined) return { loadModel: 'EXTERNAL' };

  const bodyweightFactor = exercise.bwFactor ?? undefined;
  const unilateral = exercise.weightIsPerLimb;

  switch (exercise.tracking) {
    case 'bodyweight_reps':
    case 'weighted_bodyweight':
      return { loadModel: 'BODYWEIGHT', bodyweightFactor, unilateral };
    case 'assisted_bodyweight':
      return { loadModel: 'ASSISTED', bodyweightFactor, unilateral };
    case 'weight_distance':
      return { loadModel: 'WEIGHTED_CARRY', unilateral };
    case 'duration':
    case 'reps_only':
      return { loadModel: 'DURATION' };
    case 'distance_duration':
    case 'distance_only':
      return { loadModel: 'DISTANCE' };
    case 'weight_reps':
    case 'duration_weight':
    default:
      return { loadModel: 'EXTERNAL', unilateral };
  }
}

function toCoreSet(set: LoggedSet, exerciseId: string): CoreSet | null {
  if (set.weightKg === null || set.reps === null) return null;
  return {
    id: set.id,
    exerciseId,
    setType: CORE_SET_TYPE[set.type],
    reps: set.reps,
    weightKg: set.weightKg,
    rpe: set.rpe,
    completed: set.done,
  };
}

/* -------------------------------------------------------------------------- */
/* Per-lift history                                                            */
/* -------------------------------------------------------------------------- */

/** One session's e1RM for one lift. */
export interface LiftPoint {
  /** Session start instant. */
  readonly at: number;
  /** Session e1RM in kg — total system load, so a weighted pull-up includes bodyweight. */
  readonly e1rmKg: number;
  /** True when this point beat every point before it. */
  readonly isPr: boolean;
}

/** The heaviest single set ever logged for a lift. */
export interface BestSet {
  readonly weightKg: number;
  readonly reps: number;
  readonly at: number;
  readonly e1rmKg: number;
}

/** Everything the Exercises list and the lift cards need about one movement. */
export interface LiftSummary {
  readonly exerciseId: string;
  readonly name: string;
  readonly muscles: readonly string[];
  /** Oldest first, one point per session that produced a usable estimate. */
  readonly points: readonly LiftPoint[];
  readonly currentE1rmKg: number | null;
  readonly bestSet: BestSet | null;
  readonly lastPerformedAt: number;
  readonly firstPerformedAt: number;
  readonly sessions: number;
  readonly workingSets: number;
  readonly volumeKg: number;
  readonly prCount: number;
  /** Mean confidence of the samples behind the newest estimate, 0-1. */
  readonly confidence: number;
}

/**
 * Summarise every lift the user has actually logged.
 *
 * @param history completed workouts, newest first (the store's own order)
 * @param bodyweightKg needed for bodyweight and assisted movements; null omits them
 * @returns one summary per exercise, most recently trained first
 */
export function summariseLifts(
  history: readonly CompletedWorkout[],
  bodyweightKg: number | null,
): LiftSummary[] {
  type Draft = {
    exerciseId: string;
    name: string;
    muscles: string[];
    points: LiftPoint[];
    bestSet: BestSet | null;
    lastPerformedAt: number;
    firstPerformedAt: number;
    sessions: number;
    workingSets: number;
    volumeKg: number;
    confidence: number;
  };

  const drafts = new Map<string, Draft>();
  // Oldest first, so the PR flag can be decided in one pass.
  const ordered = [...history].sort((a, b) => a.startedAt - b.startedAt);

  for (const workout of ordered) {
    for (const exercise of workout.exercises) {
      const spec = loadSpecFor(exercise.exerciseId);
      const samples: E1rmSample[] = [];
      let workingSets = 0;
      let volumeKg = 0;
      let heaviest: BestSet | null = null;

      for (const raw of exercise.sets) {
        const set = toCoreSet(raw, exercise.exerciseId);
        if (set === null || !set.completed) continue;
        const totalLoadKg = repLoadKg(set, { spec, bodyweightKg });
        if (set.setType !== 'warmup') {
          workingSets += 1;
          volumeKg += totalLoadKg * set.reps;
        }
        const sample = estimateSetE1rm(set, { totalLoadKg });
        if (sample === null) continue;
        samples.push(sample);
        if (
          heaviest === null ||
          totalLoadKg > heaviest.weightKg ||
          (totalLoadKg === heaviest.weightKg && set.reps > heaviest.reps)
        ) {
          heaviest = {
            weightKg: totalLoadKg,
            reps: set.reps,
            at: workout.startedAt,
            e1rmKg: sample.e1rmKg,
          };
        }
      }

      if (workingSets === 0 && samples.length === 0) continue;

      let draft = drafts.get(exercise.exerciseId);
      if (draft === undefined) {
        draft = {
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          muscles: [...exercise.muscles],
          points: [],
          bestSet: null,
          lastPerformedAt: workout.startedAt,
          firstPerformedAt: workout.startedAt,
          sessions: 0,
          workingSets: 0,
          volumeKg: 0,
          confidence: 0,
        };
        drafts.set(exercise.exerciseId, draft);
      }

      draft.sessions += 1;
      draft.workingSets += workingSets;
      draft.volumeKg += volumeKg;
      draft.lastPerformedAt = workout.startedAt;

      const best = sessionBestE1rm(samples);
      if (best !== null) {
        const previousBest = draft.points.reduce((acc, p) => Math.max(acc, p.e1rmKg), 0);
        draft.points.push({
          at: workout.startedAt,
          e1rmKg: best.e1rmKg,
          isPr: best.e1rmKg > previousBest,
        });
        draft.confidence = best.confidence;
      }
      if (heaviest !== null) {
        const current = draft.bestSet;
        if (
          current === null ||
          heaviest.weightKg > current.weightKg ||
          (heaviest.weightKg === current.weightKg && heaviest.reps > current.reps)
        ) {
          draft.bestSet = heaviest;
        }
      }
    }
  }

  const out: LiftSummary[] = [];
  for (const draft of drafts.values()) {
    const last = draft.points[draft.points.length - 1];
    out.push({
      exerciseId: draft.exerciseId,
      name: draft.name,
      muscles: draft.muscles,
      points: draft.points,
      currentE1rmKg: last?.e1rmKg ?? null,
      bestSet: draft.bestSet,
      lastPerformedAt: draft.lastPerformedAt,
      firstPerformedAt: draft.firstPerformedAt,
      sessions: draft.sessions,
      workingSets: draft.workingSets,
      volumeKg: draft.volumeKg,
      prCount: draft.points.filter((p) => p.isPr).length,
      confidence: draft.confidence,
    });
  }

  out.sort((a, b) => b.lastPerformedAt - a.lastPerformedAt);
  return out;
}

/** Change in a lift's e1RM across a range: null when the range holds no baseline. */
export function changeOverRange(
  lift: LiftSummary,
  from: number,
): { deltaKg: number | null; startKg: number | null; endKg: number | null } {
  const inRange = lift.points.filter((p) => p.at >= from);
  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  if (first === undefined || last === undefined) {
    return { deltaKg: null, startKg: null, endKg: lift.currentE1rmKg };
  }
  // A single session inside the window has no baseline to move from. Fall back
  // to the last point BEFORE the window so "+2.5 kg this week" stays truthful.
  const before = lift.points.filter((p) => p.at < from);
  const baseline = before[before.length - 1] ?? (inRange.length > 1 ? first : undefined);
  if (baseline === undefined) {
    return { deltaKg: null, startKg: null, endKg: last.e1rmKg };
  }
  return {
    deltaKg: last.e1rmKg - baseline.e1rmKg,
    startKg: baseline.e1rmKg,
    endKg: last.e1rmKg,
  };
}

/* -------------------------------------------------------------------------- */
/* Journey stats                                                               */
/* -------------------------------------------------------------------------- */

export interface JourneyTotals {
  readonly workouts: number;
  readonly volumeKg: number;
  readonly prs: number;
  readonly seconds: number;
}

const EMPTY_TOTALS: JourneyTotals = { workouts: 0, volumeKg: 0, prs: 0, seconds: 0 };

/** All-time totals and the slice of them that landed inside the range. */
export function journeyStats(
  history: readonly CompletedWorkout[],
  lifts: readonly LiftSummary[],
  from: number,
): { all: JourneyTotals; delta: JourneyTotals } {
  let all = EMPTY_TOTALS;
  let delta = EMPTY_TOTALS;

  for (const w of history) {
    const add = (t: JourneyTotals): JourneyTotals => ({
      workouts: t.workouts + 1,
      volumeKg: t.volumeKg + w.volumeKg,
      prs: t.prs,
      seconds: t.seconds + w.durationSec,
    });
    all = add(all);
    if (w.startedAt >= from) delta = add(delta);
  }

  for (const lift of lifts) {
    for (const point of lift.points) {
      if (!point.isPr) continue;
      all = { ...all, prs: all.prs + 1 };
      if (point.at >= from) delta = { ...delta, prs: delta.prs + 1 };
    }
  }

  return { all, delta };
}

/* -------------------------------------------------------------------------- */
/* Training split                                                              */
/* -------------------------------------------------------------------------- */

export interface SplitSlice {
  readonly label: string;
  readonly volumeKg: number;
  /** Share of the range's credited volume, 0-1. */
  readonly share: number;
  /** The same muscle's share of the user's ALL-TIME volume, 0-1. */
  readonly baselineShare: number;
  /** share - baselineShare, in points. Positive means over-worked for this user. */
  readonly deltaPoints: number;
}

function creditVolume(
  history: readonly CompletedWorkout[],
  from: number,
  bodyweightKg: number | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of history) {
    if (w.startedAt < from) continue;
    for (const exercise of w.exercises) {
      const spec = loadSpecFor(exercise.exerciseId);
      let volume = 0;
      for (const raw of exercise.sets) {
        const set = toCoreSet(raw, exercise.exerciseId);
        if (set === null || !set.completed || set.setType === 'warmup') continue;
        volume += repLoadKg(set, { spec, bodyweightKg }) * set.reps;
      }
      if (volume <= 0) continue;
      // The catalog's contribution vector sums to 1.0, so a session's volume is
      // split across muscles rather than counted once per muscle it touches.
      const shares = groupSharesOf(exercise.exerciseId);
      if (shares.length === 0) {
        const label = exercise.muscles[0];
        if (label !== undefined) out.set(label, (out.get(label) ?? 0) + volume);
        continue;
      }
      for (const [label, share] of shares) {
        out.set(label, (out.get(label) ?? 0) + volume * share);
      }
    }
  }
  return out;
}

/** Volume share per muscle over a range, against the user's own all-time split. */
export function trainingSplit(
  history: readonly CompletedWorkout[],
  from: number,
  bodyweightKg: number | null,
): SplitSlice[] {
  const inRange = creditVolume(history, from, bodyweightKg);
  const allTime = creditVolume(history, Number.NEGATIVE_INFINITY, bodyweightKg);

  const rangeTotal = [...inRange.values()].reduce((a, b) => a + b, 0);
  const allTotal = [...allTime.values()].reduce((a, b) => a + b, 0);
  if (rangeTotal <= 0) return [];

  const slices: SplitSlice[] = [];
  for (const [label, volumeKg] of inRange) {
    const share = volumeKg / rangeTotal;
    const baselineShare = allTotal > 0 ? (allTime.get(label) ?? 0) / allTotal : share;
    slices.push({
      label,
      volumeKg,
      share,
      baselineShare,
      deltaPoints: (share - baselineShare) * 100,
    });
  }
  slices.sort((a, b) => b.share - a.share);
  return slices;
}

/* -------------------------------------------------------------------------- */
/* World standing                                                              */
/* -------------------------------------------------------------------------- */

export interface RankedLift {
  readonly lift: LiftSummary;
  readonly classification: LiftClassification;
}

export interface StrengthProfile {
  readonly standing: OverallStanding;
  readonly ranked: readonly RankedLift[];
  /** Lifts the user trains that have no published standard. */
  readonly unrankedCount: number;
}

/**
 * The user's world standing, built only from lifts with a published table.
 *
 * `overallStanding` applies the cold-start prior itself, so a single logged set
 * cannot crown anyone — it returns `state: 'calibrating'` with a range instead
 * of a rank. This function returns null only when there is literally nothing to
 * score, which the UI renders as its own empty state.
 */
export function strengthProfile(
  lifts: readonly LiftSummary[],
  profile: LifterProfile,
  now: number,
): StrengthProfile | null {
  const ranked: RankedLift[] = [];
  let unrankedCount = 0;

  for (const lift of lifts) {
    const standard = standardFor(lift.exerciseId);
    const e1rm = lift.currentE1rmKg;
    if (standard === undefined || e1rm === null) {
      unrankedCount += 1;
      continue;
    }

    // Published tables for pull-ups, chin-ups and dips are ADDED weight, while
    // our e1RM is total system load. Convert back, or a bodyweight pull-up
    // classifies as if the lifter had loaded a belt with their own bodyweight.
    const parentE1rm = e1rm * standardsRatio(lift.exerciseId);
    const tableUnitsKg =
      standard.loadType === 'added_bodyweight'
        ? parentE1rm - (standard.bodyweightFraction ?? 1) * profile.bodyweightKg
        : parentE1rm;

    const ageDays = Math.max(0, (now - lift.lastPerformedAt) / DAY_MS);
    const classification = classifyLift(
      {
        standard,
        e1rmKg: tableUnitsKg,
        evidence: { nSets: lift.workingSets, nSessions: lift.sessions, ageDays },
      },
      profile,
    );
    ranked.push({ lift, classification });
  }

  if (ranked.length === 0) return null;

  const patterns: PatternBest[] = [];
  for (const entry of ranked) {
    const standard = standardFor(entry.lift.exerciseId);
    if (standard === undefined) continue;
    const pattern = scoringPatternOf(standard);
    if (pattern === null) continue;
    patterns.push({
      pattern,
      z: entry.classification.z,
      tau: entry.classification.tau,
      ageDays: Math.max(0, (now - entry.lift.lastPerformedAt) / DAY_MS),
    });
  }

  ranked.sort((a, b) => b.classification.score - a.classification.score);
  return { standing: overallStanding({ patterns }), ranked, unrankedCount };
}
