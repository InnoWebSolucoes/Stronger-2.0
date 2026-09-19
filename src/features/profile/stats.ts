import { epley, median } from '@core/scoring';
import { MUSCLE_GROUPS } from '@/features/exercises/source';
import type { CompletedWorkout } from '@/features/workout/types';

/**
 * Everything the Profile tab and the badge catalogue read from.
 *
 * One pass over history produces one immutable snapshot. Badge predicates are
 * pure functions of that snapshot, so evaluating fifty achievements costs
 * fifty comparisons rather than fifty walks of the log.
 *
 * Kilograms throughout — display conversion happens at the render layer only.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Muscle groups counted as "legs" for the leg-volume achievements. */
const LEG_MUSCLES = new Set(['Quads', 'Hamstrings', 'Glutes', 'Calves']);
/** Muscle groups counted as "back" for the pulling achievements. */
const BACK_MUSCLES = new Set(['Lats', 'Upper Back', 'Lower Back', 'Traps']);

export type BestLift = {
  exerciseId: string;
  name: string;
  /** Estimated one-rep max, kg. */
  e1rmKg: number;
  /** The set that produced it. */
  weightKg: number;
  reps: number;
  at: number;
};

export type WeekBucket = {
  /** Local midnight of that week's Monday. */
  start: number;
  sessions: number;
  volumeKg: number;
  /** Did this week meet the lifter's own typical session count? */
  qualified: boolean;
};

export type SessionMark = { at: number; volumeKg: number };

export type ProfileStats = {
  /** Lifetime totals. */
  workouts: number;
  volumeKg: number;
  reps: number;
  sets: number;
  seconds: number;
  hours: number;

  firstAt: number | null;
  lastAt: number | null;
  daysSinceFirst: number;
  daysSinceLast: number;

  avgSessionSec: number;
  longestSessionSec: number;
  biggestSessionKg: number;
  mostSetsInSession: number;

  /** Distinct local calendar days with at least one session. */
  trainingDays: number;
  /** Distinct calendar months with at least one session. */
  trainingMonths: number;
  /** Distinct weeks with at least one session. */
  activeWeeks: number;
  bestMonthSessions: number;
  bestWeekSessions: number;
  bestWeekVolumeKg: number;
  maxSessionsInOneDay: number;

  /** Weekly consistency — see `weeklyTarget` for why this is not a day streak. */
  weeklyTarget: number;
  currentWeekStreak: number;
  longestWeekStreak: number;
  weeks: WeekBucket[];

  /** Gaps and returns. Coming back is the skill, not never stopping. */
  longestGapDays: number;
  comebacks: number;

  distinctExercises: number;
  distinctMuscles: number;
  muscleGroupsTotal: number;
  legSets: number;
  backSets: number;

  favouriteExercise: { id: string; name: string; sessions: number } | null;
  topMuscle: { name: string; sets: number; volumeKg: number } | null;

  bestLifts: BestLift[];
  bestE1rm: Record<string, number>;
  heaviestSetKg: number;
  prs: number;

  /** Best estimated 1RM on each competition lift, kg. 0 when never trained. */
  benchKg: number;
  squatKg: number;
  deadliftKg: number;
  pressKg: number;
  /** The same, as a multiple of current bodyweight. 0 when never trained. */
  benchRatio: number;
  squatRatio: number;
  deadliftRatio: number;
  pressRatio: number;
  /** Bench + squat + deadlift estimated 1RM, kg. */
  powerliftingTotalKg: number;

  earlySessions: number;
  lateSessions: number;
  weekendSessions: number;

  bodyweightKg: number;
  weighIns: number;
  joinedAt: number;

  /** Session markers for the activity heatmap, oldest first. */
  sessions: SessionMark[];
};

export type StatsInput = {
  history: readonly CompletedWorkout[];
  bodyweightKg: number;
  joinedAt: number;
  weighIns: number;
  now?: number;
};

// ---------------------------------------------------------------------------
// Local calendar helpers. Local, not UTC: a Tuesday-evening session belongs to
// the lifter's Tuesday, whatever offset they are in.
// ---------------------------------------------------------------------------

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday-based week start. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Step a week forward through a DST boundary without drifting an hour. */
function nextWeek(weekStart: number): number {
  return startOfWeek(weekStart + 7 * DAY_MS + 12 * HOUR_MS);
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topEntry(map: Map<string, number>): { key: string; value: number } | null {
  let bestKey: string | null = null;
  let bestValue = -Infinity;
  for (const [key, value] of map) {
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  }
  return bestKey === null ? null : { key: bestKey, value: bestValue };
}

/**
 * A set only counts once it is ticked, is not a warm-up, and carries both a
 * load and a rep count. Same rule the workout store uses for live volume, so
 * lifetime totals and session totals cannot disagree.
 */
function counts(s: {
  done: boolean;
  type: string;
  weightKg: number | null;
  reps: number | null;
}): s is { done: true; type: string; weightKg: number; reps: number } {
  return s.done && s.type !== 'warmup' && s.weightKg != null && s.reps != null;
}

/** A new personal best has to beat the old one by this much to be a new PR. */
const PR_MARGIN_KG = 0.5;

export const EMPTY_STATS: ProfileStats = buildEmpty(Date.now());

function buildEmpty(now: number): ProfileStats {
  return {
    workouts: 0,
    volumeKg: 0,
    reps: 0,
    sets: 0,
    seconds: 0,
    hours: 0,
    firstAt: null,
    lastAt: null,
    daysSinceFirst: 0,
    daysSinceLast: 0,
    avgSessionSec: 0,
    longestSessionSec: 0,
    biggestSessionKg: 0,
    mostSetsInSession: 0,
    trainingDays: 0,
    trainingMonths: 0,
    activeWeeks: 0,
    bestMonthSessions: 0,
    bestWeekSessions: 0,
    bestWeekVolumeKg: 0,
    maxSessionsInOneDay: 0,
    weeklyTarget: 0,
    currentWeekStreak: 0,
    longestWeekStreak: 0,
    weeks: [],
    longestGapDays: 0,
    comebacks: 0,
    distinctExercises: 0,
    distinctMuscles: 0,
    muscleGroupsTotal: MUSCLE_GROUPS.length,
    legSets: 0,
    backSets: 0,
    favouriteExercise: null,
    topMuscle: null,
    bestLifts: [],
    bestE1rm: {},
    heaviestSetKg: 0,
    prs: 0,
    benchKg: 0,
    squatKg: 0,
    deadliftKg: 0,
    pressKg: 0,
    benchRatio: 0,
    squatRatio: 0,
    deadliftRatio: 0,
    pressRatio: 0,
    powerliftingTotalKg: 0,
    earlySessions: 0,
    lateSessions: 0,
    weekendSessions: 0,
    bodyweightKg: 0,
    weighIns: 0,
    joinedAt: now,
    sessions: [],
  };
}

export function computeProfileStats(input: StatsInput): ProfileStats {
  const now = input.now ?? Date.now();
  const stats = buildEmpty(now);
  stats.bodyweightKg = input.bodyweightKg;
  stats.weighIns = input.weighIns;
  stats.joinedAt = input.joinedAt;

  // History arrives newest-first from the store; every accumulator below wants
  // chronological order, so sort once here rather than reasoning about it
  // twice.
  const log = [...input.history].sort((a, b) => a.startedAt - b.startedAt);
  if (log.length === 0) return stats;

  const days = new Map<string, number>();
  const months = new Map<string, number>();
  const exerciseSessions = new Map<string, number>();
  const exerciseNames = new Map<string, string>();
  const muscleSets = new Map<string, number>();
  const muscleVolume = new Map<string, number>();
  const bestE1rm = new Map<string, number>();
  const bestLiftSet = new Map<string, BestLift>();

  let previousStart: number | null = null;

  for (const w of log) {
    stats.workouts += 1;
    stats.volumeKg += w.volumeKg;
    stats.reps += w.totalReps;
    stats.sets += w.totalSets;
    stats.seconds += w.durationSec;
    stats.sessions.push({ at: w.startedAt, volumeKg: w.volumeKg });

    stats.longestSessionSec = Math.max(stats.longestSessionSec, w.durationSec);
    stats.biggestSessionKg = Math.max(stats.biggestSessionKg, w.volumeKg);
    stats.mostSetsInSession = Math.max(stats.mostSetsInSession, w.totalSets);

    bump(days, dayKey(w.startedAt));
    bump(months, monthKey(w.startedAt));

    const started = new Date(w.startedAt);
    const hour = started.getHours() + started.getMinutes() / 60;
    if (hour < 6.5) stats.earlySessions += 1;
    if (hour >= 21) stats.lateSessions += 1;
    const dow = started.getDay();
    if (dow === 0 || dow === 6) stats.weekendSessions += 1;

    if (previousStart !== null) {
      const gapDays = Math.round((startOfDay(w.startedAt) - startOfDay(previousStart)) / DAY_MS);
      if (gapDays > stats.longestGapDays) stats.longestGapDays = gapDays;
      // A fortnight away and then back on the platform. This is the metric a
      // strength app should celebrate: nobody trains for a decade unbroken.
      if (gapDays >= 14) stats.comebacks += 1;
    }
    previousStart = w.startedAt;

    for (const ex of w.exercises) {
      let workedThisSession = false;
      let sessionBestE1rm = 0;
      let sessionBestSet: { weightKg: number; reps: number } | null = null;

      for (const s of ex.sets) {
        if (!counts(s)) continue;
        workedThisSession = true;

        const load = s.weightKg;
        const reps = s.reps;
        if (load > stats.heaviestSetKg) stats.heaviestSetKg = load;

        for (const m of ex.muscles) {
          bump(muscleSets, m);
          if (LEG_MUSCLES.has(m)) stats.legSets += 1;
          if (BACK_MUSCLES.has(m)) stats.backSets += 1;
        }
        // Volume is credited to the PRIMARY mover only. Crediting every listed
        // muscle would let one bench press count three times and make "most
        // trained" meaningless.
        const primary = ex.muscles[0];
        if (primary !== undefined) bump(muscleVolume, primary, load * reps);

        // Epley, the flattest of the classical estimators across the 1–10 rep
        // range this data mostly lives in. @core/scoring documents its source.
        const e1rm = epley(load, reps);
        if (e1rm !== null && e1rm > sessionBestE1rm) {
          sessionBestE1rm = e1rm;
          sessionBestSet = { weightKg: load, reps };
        }
      }

      if (!workedThisSession) continue;
      bump(exerciseSessions, ex.exerciseId);
      exerciseNames.set(ex.exerciseId, ex.name);

      const previousBest = bestE1rm.get(ex.exerciseId) ?? 0;
      if (sessionBestE1rm > previousBest + PR_MARGIN_KG) {
        bestE1rm.set(ex.exerciseId, sessionBestE1rm);
        if (sessionBestSet) {
          bestLiftSet.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            name: ex.name,
            e1rmKg: sessionBestE1rm,
            weightKg: sessionBestSet.weightKg,
            reps: sessionBestSet.reps,
            at: w.startedAt,
          });
        }
        // Anti-spam: one record per exercise per session, and only when the
        // previous best is actually beaten. The very first time an exercise is
        // logged is a baseline, not a record.
        if (previousBest > 0) stats.prs += 1;
      }
    }
  }

  const first = log[0];
  const last = log[log.length - 1];
  stats.firstAt = first ? first.startedAt : null;
  stats.lastAt = last ? last.startedAt : null;
  if (stats.firstAt !== null) {
    stats.daysSinceFirst = Math.max(0, Math.floor((now - stats.firstAt) / DAY_MS));
  }
  if (stats.lastAt !== null) {
    stats.daysSinceLast = Math.max(0, Math.floor((startOfDay(now) - startOfDay(stats.lastAt)) / DAY_MS));
  }

  stats.hours = stats.seconds / 3600;
  stats.avgSessionSec = stats.workouts > 0 ? stats.seconds / stats.workouts : 0;
  stats.trainingDays = days.size;
  stats.trainingMonths = months.size;
  stats.maxSessionsInOneDay = topEntry(days)?.value ?? 0;
  stats.bestMonthSessions = topEntry(months)?.value ?? 0;

  const fav = topEntry(exerciseSessions);
  stats.favouriteExercise = fav
    ? { id: fav.key, name: exerciseNames.get(fav.key) ?? fav.key, sessions: fav.value }
    : null;

  const topM = topEntry(muscleVolume);
  stats.topMuscle = topM
    ? { name: topM.key, sets: muscleSets.get(topM.key) ?? 0, volumeKg: topM.value }
    : null;

  stats.distinctExercises = exerciseSessions.size;
  stats.distinctMuscles = muscleSets.size;

  stats.bestLifts = [...bestLiftSet.values()].sort((a, b) => b.e1rmKg - a.e1rmKg);
  stats.bestE1rm = Object.fromEntries(bestE1rm);

  const bw = input.bodyweightKg > 0 ? input.bodyweightKg : 0;
  const bench = bestOf(bestE1rm, ['bench-press', 'barbell-bench-press', 'chest-press']);
  const squat = bestOf(bestE1rm, ['back-squat', 'squat', 'front-squat']);
  const dead = bestOf(bestE1rm, ['deadlift', 'conventional-deadlift', 'sumo-deadlift']);
  const press = bestOf(bestE1rm, ['overhead-press', 'military-press', 'shoulder-press']);
  stats.benchKg = bench;
  stats.squatKg = squat;
  stats.deadliftKg = dead;
  stats.pressKg = press;
  stats.benchRatio = bw > 0 ? bench / bw : 0;
  stats.squatRatio = bw > 0 ? squat / bw : 0;
  stats.deadliftRatio = bw > 0 ? dead / bw : 0;
  stats.pressRatio = bw > 0 ? press / bw : 0;
  stats.powerliftingTotalKg = bench > 0 && squat > 0 && dead > 0 ? bench + squat + dead : 0;

  // ---- weekly consistency -------------------------------------------------
  const weekly = new Map<number, { sessions: number; volumeKg: number }>();
  for (const w of log) {
    const key = startOfWeek(w.startedAt);
    const bucket = weekly.get(key) ?? { sessions: 0, volumeKg: 0 };
    bucket.sessions += 1;
    bucket.volumeKg += w.volumeKg;
    weekly.set(key, bucket);
  }
  stats.activeWeeks = weekly.size;

  const currentWeek = startOfWeek(now);
  const weeks: WeekBucket[] = [];
  let cursor = startOfWeek(stats.firstAt ?? now);
  // Guard the loop: ~40 years of weeks is far past anything real, and a broken
  // clock must not spin forever.
  for (let i = 0; cursor <= currentWeek && i < 2200; i += 1) {
    const bucket = weekly.get(cursor);
    weeks.push({
      start: cursor,
      sessions: bucket?.sessions ?? 0,
      volumeKg: bucket?.volumeKg ?? 0,
      qualified: false,
    });
    cursor = nextWeek(cursor);
  }

  /**
   * WHY WEEKS, NOT DAYS.
   *
   * A daily streak punishes rest days, and rest days are training — the
   * adaptation happens between sessions, not during them. A day counter
   * pressures people into junk volume or training through injury to protect a
   * number, which is the opposite of what a strength log should reward.
   *
   * So the unit is the WEEK, and the bar is the lifter's OWN typical session
   * count rather than one we invented: the median of their active weeks,
   * floored so a normal four-day lifter is not broken by a three-day week.
   * Somebody who trains twice a week keeps their streak by training twice a
   * week.
   */
  const activeCounts = [...weekly.values()].map((b) => b.sessions);
  const recent = activeCounts.slice(-12);
  const med = median(recent.length > 0 ? recent : activeCounts);
  stats.weeklyTarget = Number.isFinite(med) ? Math.min(6, Math.max(1, Math.floor(med))) : 1;

  for (const w of weeks) w.qualified = w.sessions >= stats.weeklyTarget;
  stats.weeks = weeks;

  let run = 0;
  for (const w of weeks) {
    run = w.qualified ? run + 1 : 0;
    if (run > stats.longestWeekStreak) stats.longestWeekStreak = run;
  }

  // The week in progress cannot break a streak — it has not finished yet. It
  // only ever adds to it.
  let index = weeks.length - 1;
  const live = weeks[index];
  if (live && !live.qualified) index -= 1;
  let current = 0;
  for (let i = index; i >= 0; i -= 1) {
    const w = weeks[i];
    if (!w || !w.qualified) break;
    current += 1;
  }
  stats.currentWeekStreak = current;

  const bestWeek = [...weekly.values()];
  for (const b of bestWeek) {
    if (b.sessions > stats.bestWeekSessions) stats.bestWeekSessions = b.sessions;
    if (b.volumeKg > stats.bestWeekVolumeKg) stats.bestWeekVolumeKg = b.volumeKg;
  }

  return stats;
}

/**
 * Best estimate for one of the competition lifts.
 *
 * Catalog ids are `movement--equipment` slugs (`bench-press--barbell`), and
 * that scheme is allowed to change under us, so this matches on the movement
 * head rather than on a hard-coded id list. The barbell variant wins when the
 * lifter has one — a dumbbell press is not the same claim as a bench — and
 * anything else is only used as a fallback.
 */
function bestOf(map: Map<string, number>, heads: readonly string[]): number {
  let preferred = 0;
  let fallback = 0;
  for (const [id, value] of map) {
    const parts = id.split('--');
    const head = parts[0];
    if (head === undefined || !heads.includes(head)) continue;
    const equipment = parts[1];
    if (equipment === undefined || equipment === 'barbell') {
      if (value > preferred) preferred = value;
    } else if (value > fallback) {
      fallback = value;
    }
  }
  return preferred > 0 ? preferred : fallback;
}
