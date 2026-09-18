/**
 * recovery.ts — what happens between the app process starting and the first
 * frame rendering.
 *
 * The promise is that a workout survives a force-kill, a dead battery and three
 * days offline. Opening the database replays the write-ahead log, which restores
 * every committed transaction. This module handles everything the WAL cannot:
 * two devices that each started the "same" session offline, a black box holding
 * events whose rows never materialised, aggregates left stale by a crash
 * mid-finish, and the question of what a live session from four hours ago even
 * means.
 *
 * Source: research brief, PART 3 (claim.ts / mergeDuplicateActiveWorkouts) and
 * PART 4 (recovery.ts, and the crash-safety invariants). The idle thresholds —
 * resume under 3 h, confirm under 18 h, auto-close beyond — are taken from
 * PART 4 verbatim.
 *
 * The decision logic is exported as pure functions and tested as such. Only
 * `recoverOnLaunch` and its helpers touch a connection.
 */

import { between } from './ids';
import type { SetType } from './schema';
import type { SqlDatabase, SqlExecutor } from './types';

/* ------------------------------------------------------------------------- */
/* Thresholds                                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Under this many hours idle, walk straight back into the session with no
 * prompt. Three hours covers a long session with a long break in it — a
 * powerlifter resting eight minutes between singles, a phone that sat in a
 * locker — without ever asking a question the user does not need.
 */
export const RESUME_MAX_IDLE_HOURS = 3;

/**
 * Under this many hours idle, ask ("Still training? Your last set was 4 h ago").
 * Eighteen hours is the span in which resuming is still plausible — a session
 * interrupted and returned to that evening — but wrong often enough that
 * silently resuming would fabricate a workout that never happened.
 */
export const CONFIRM_MAX_IDLE_HOURS = 18;

/** Milliseconds in an hour. */
const MS_PER_HOUR = 3_600_000;

/**
 * Two sets logged on two devices count as the same performed set if they match
 * on exercise, weight and reps and were completed within this window. Ninety
 * seconds is shorter than any real repeat of the same load, and long enough to
 * cover two clocks drifting apart while offline.
 */
export const DUPLICATE_SET_WINDOW_MS = 90_000;

/* ------------------------------------------------------------------------- */
/* Pure decision logic                                                        */
/* ------------------------------------------------------------------------- */

/** What the app should do about a session it found in progress at launch. */
export type RecoveryDecision =
  | { kind: 'none' }
  | { kind: 'resume'; workoutId: string; idleHours: number }
  | { kind: 'confirm'; workoutId: string; idleHours: number }
  | { kind: 'auto_close'; workoutId: string; idleHours: number; closeAtMs: number };

/** The minimum a decision needs to know about the workout it found. */
export interface RecoveryCandidate {
  readonly id: string;
  /** `started_at` as epoch milliseconds. */
  readonly startedAtMs: number;
}

export interface RecoveryDecisionInput {
  /** The live workout found at launch, or null if there is none. */
  readonly workout: RecoveryCandidate | null;
  /**
   * When the user last actually did something: the most recent completed set.
   * Null when the session has no completed sets, in which case the session's
   * own start time is the last real activity.
   */
  readonly lastActivityMs: number | null;
  /** Now, as epoch milliseconds. */
  readonly nowMs: number;
}

/**
 * Hours between the last real activity and now, clamped at zero.
 *
 * The clamp is not cosmetic. A phone whose battery died can cold-boot with a
 * wall clock behind the timestamps already on disk, which would otherwise make
 * idle time negative and push a stale session into `resume`.
 *
 * @param lastActivityMs Epoch milliseconds of the last completed set.
 * @param nowMs Epoch milliseconds now.
 * @returns Idle time in hours, never negative.
 */
export function idleHours(lastActivityMs: number, nowMs: number): number {
  if (!Number.isFinite(lastActivityMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, (nowMs - lastActivityMs) / MS_PER_HOUR);
}

/**
 * Decide what to do with a session found in progress.
 *
 * - under {@link RESUME_MAX_IDLE_HOURS}: resume silently.
 * - under {@link CONFIRM_MAX_IDLE_HOURS}: ask the user.
 * - otherwise: auto-close the workout at the last real activity, rather than
 *   recording a three-day session that never happened. Boundaries are exclusive
 *   on the low side: exactly 3 h idle asks, exactly 18 h idle auto-closes.
 *
 * @param input The live workout, its last activity, and the current time.
 * @returns The decision, including the timestamp to close at when auto-closing.
 */
export function decideRecovery(input: RecoveryDecisionInput): RecoveryDecision {
  const { workout, lastActivityMs, nowMs } = input;
  if (!workout) return { kind: 'none' };

  const lastActivity = lastActivityMs ?? workout.startedAtMs;
  const idle = idleHours(lastActivity, nowMs);

  if (idle < RESUME_MAX_IDLE_HOURS) return { kind: 'resume', workoutId: workout.id, idleHours: idle };
  if (idle < CONFIRM_MAX_IDLE_HOURS) return { kind: 'confirm', workoutId: workout.id, idleHours: idle };
  return { kind: 'auto_close', workoutId: workout.id, idleHours: idle, closeAtMs: lastActivity };
}

/** A live workout considered by the duplicate-session merge. */
export interface MergeCandidate {
  readonly id: string;
  /** `started_at` as epoch milliseconds. */
  readonly startedAtMs: number;
}

/**
 * Pick which of several concurrently-live workouts survives a merge.
 *
 * The earliest start wins: it holds the true anchor for the session's duration,
 * and duration is derived from that anchor rather than stored. Equal starts are
 * broken by id so two devices performing the merge independently reach the same
 * answer — ULIDs are globally unique and both devices see the same pair.
 *
 * @param candidates Every workout found in progress for this user.
 * @returns The survivor and the ones to fold into it, or null when there is
 *          nothing to merge (zero or one live workout).
 */
export function chooseSurvivingWorkout<T extends MergeCandidate>(
  candidates: readonly T[],
): { keep: T; absorb: T[] } | null {
  if (candidates.length < 2) return null;
  const ordered = [...candidates].sort((a, b) =>
    a.startedAtMs !== b.startedAtMs ? a.startedAtMs - b.startedAtMs : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const keep = ordered[0];
  if (!keep) return null;
  return { keep, absorb: ordered.slice(1) };
}

/** The fields that decide whether two logged sets are the same performed set. */
export interface DuplicateSetCandidate {
  readonly exerciseId: string;
  readonly weightKg: number | null;
  readonly reps: number | null;
  /** `completed_at` as epoch milliseconds, or null if never completed. */
  readonly completedAtMs: number | null;
}

/**
 * Whether two sets from two devices are probably one performed set.
 *
 * This never causes a delete. A match is written to `merge_conflicts` and shown
 * to the user, because a wrongly dropped set destroys a PR and with it the
 * user's trust in every number the app displays. Two sets that were both
 * genuinely performed are a minor annoyance; one silently deleted is not
 * recoverable.
 *
 * Incomplete sets never match: an untouched placeholder row is not evidence of
 * work performed.
 *
 * @param a One set.
 * @param b The other set.
 * @param windowMs How close in time they must be. Defaults to
 *        {@link DUPLICATE_SET_WINDOW_MS}.
 */
export function isProbableDuplicateSet(
  a: DuplicateSetCandidate,
  b: DuplicateSetCandidate,
  windowMs: number = DUPLICATE_SET_WINDOW_MS,
): boolean {
  if (a.completedAtMs === null || b.completedAtMs === null) return false;
  if (a.exerciseId !== b.exerciseId) return false;
  if (a.weightKg !== b.weightKg) return false;
  if (a.reps !== b.reps) return false;
  return Math.abs(a.completedAtMs - b.completedAtMs) < windowMs;
}

/** One set, as far as the aggregate recompute is concerned. */
export interface AggregatableSet {
  readonly workoutExerciseId: string;
  readonly isCompleted: boolean;
  readonly volumeKg: number | null;
  readonly reps: number | null;
  readonly rpe: number | null;
  readonly isPr: boolean;
}

/** The workout-level totals shown on the finish summary and the history card. */
export interface WorkoutAggregates {
  /** Kilograms. Sum of completed sets' volume. */
  readonly totalVolumeKg: number;
  readonly totalReps: number;
  readonly totalSets: number;
  /** Distinct exercises that have at least one completed set. */
  readonly totalExercises: number;
  readonly prsCount: number;
  /** Mean RPE over completed sets that recorded one; null when none did. */
  readonly avgRpe: number | null;
}

/**
 * Recompute a workout's aggregates from its sets.
 *
 * Only completed sets count: a row the user added but never ticked is an empty
 * placeholder, not work performed, and counting it would inflate volume after
 * every crash. Pure, so the same function serves the live screen, the finish
 * pipeline and recovery.
 *
 * Units: volume is kilograms, the sum of each set's precomputed `volume_kg`
 * (the scoring engine in src/core owns how that is derived from load and reps).
 *
 * @param sets Every set belonging to the workout, completed or not.
 */
export function computeWorkoutAggregates(sets: readonly AggregatableSet[]): WorkoutAggregates {
  let totalVolumeKg = 0;
  let totalReps = 0;
  let totalSets = 0;
  let prsCount = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  const exercises = new Set<string>();

  for (const s of sets) {
    if (!s.isCompleted) continue;
    totalSets += 1;
    totalVolumeKg += s.volumeKg ?? 0;
    totalReps += s.reps ?? 0;
    if (s.isPr) prsCount += 1;
    exercises.add(s.workoutExerciseId);
    if (s.rpe !== null) {
      rpeSum += s.rpe;
      rpeCount += 1;
    }
  }

  return {
    totalVolumeKg: round(totalVolumeKg, 3),
    totalReps,
    totalSets,
    totalExercises: exercises.size,
    prsCount,
    avgRpe: rpeCount === 0 ? null : round(rpeSum / rpeCount, 1),
  };
}

/** Round to `dp` decimal places, killing binary-float drift in running sums. */
function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/** The time fields of a workout, as epoch milliseconds. */
export interface ElapsedInput {
  readonly startedAtMs: number;
  /** Milliseconds already banked as paused. */
  readonly pausedMs: number;
  /** Start of an open pause, or null when not paused. */
  readonly pauseStartedAtMs: number | null;
  /** End of the session, or null while it is live. */
  readonly endedAtMs?: number | null;
}

/**
 * How long a workout has actually been running, in milliseconds.
 *
 * Derived, never stored. A stored elapsed counter is only correct while the
 * process is alive, which means it lies after exactly the crash this whole layer
 * exists to survive.
 *
 * @param workout Absolute anchors plus the pause ledger.
 * @param nowMs Current time; ignored once the workout has ended.
 * @returns Elapsed training time in milliseconds, never negative.
 */
export function workoutElapsedMs(workout: ElapsedInput, nowMs: number): number {
  const end = workout.endedAtMs ?? nowMs;
  const openPause = workout.pauseStartedAtMs === null ? 0 : Math.max(0, end - workout.pauseStartedAtMs);
  return Math.max(0, end - workout.startedAtMs - workout.pausedMs - openPause);
}

/* ------------------------------------------------------------------------- */
/* Black-box event payloads                                                   */
/* ------------------------------------------------------------------------- */

/**
 * The payload a `set_add` / `set_complete` / `set_edit` event carries, which is
 * everything needed to rebuild the `sets` row it describes. Keys are snake_case
 * because the payload is JSON that also crosses to the server.
 */
export interface SetEventPayload {
  readonly set_id: string;
  readonly workout_exercise_id: string;
  readonly exercise_id: string;
  readonly pos: string;
  readonly set_type?: SetType;
  readonly weight_kg?: number | null;
  readonly reps?: number | null;
  readonly rir?: number | null;
  readonly rpe?: number | null;
  readonly duration_s?: number | null;
  readonly distance_m?: number | null;
  readonly effective_load_kg?: number | null;
  readonly volume_kg?: number | null;
  readonly e1rm_kg?: number | null;
  readonly completed_at?: string | null;
}

/**
 * Parse a black-box event payload, returning null for anything that cannot
 * rebuild a row.
 *
 * Deliberately forgiving about extra keys and strict about the four it needs: a
 * malformed event is skipped and logged, never allowed to abort recovery. The
 * app must always finish launching.
 *
 * @param json The raw `payload` column.
 */
export function parseSetEventPayload(json: string): SetEventPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const p = parsed as Record<string, unknown>;
  const setId = p['set_id'];
  const weId = p['workout_exercise_id'];
  const exId = p['exercise_id'];
  const pos = p['pos'];
  if (typeof setId !== 'string' || setId === '') return null;
  if (typeof weId !== 'string' || weId === '') return null;
  if (typeof exId !== 'string' || exId === '') return null;
  if (typeof pos !== 'string' || pos === '') return null;

  return {
    set_id: setId,
    workout_exercise_id: weId,
    exercise_id: exId,
    pos,
    set_type: typeof p['set_type'] === 'string' ? (p['set_type'] as SetType) : undefined,
    weight_kg: numberOrNull(p['weight_kg']),
    reps: numberOrNull(p['reps']),
    rir: numberOrNull(p['rir']),
    rpe: numberOrNull(p['rpe']),
    duration_s: numberOrNull(p['duration_s']),
    distance_m: numberOrNull(p['distance_m']),
    effective_load_kg: numberOrNull(p['effective_load_kg']),
    volume_kg: numberOrNull(p['volume_kg']),
    e1rm_kg: numberOrNull(p['e1rm_kg']),
    completed_at: typeof p['completed_at'] === 'string' ? p['completed_at'] : null,
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------------------------------- */
/* The launch path                                                            */
/* ------------------------------------------------------------------------- */

/** Everything recovery needs from the outside world. */
export interface RecoveryDeps {
  /** Whose data to recover. */
  readonly userId: string;
  /** This installation's device id, stamped on rows recovery writes. */
  readonly deviceId: string;
  /** Wall clock, milliseconds. Injected so recovery is testable. */
  readonly now: () => number;
  /** Mints a ULID for any row recovery has to create. */
  readonly newId: () => string;
  /**
   * Mints the next hybrid logical clock value. Owned by the sync layer; recovery
   * must stamp every row it rewrites so the change replicates.
   */
  readonly nextRev: () => string;
  /** Optional sink for diagnostics. Recovery must never throw at the user. */
  readonly log?: (message: string, detail?: Record<string, unknown>) => void;
}

/** What recovery did, for the UI to act on. */
export interface RecoveryResult {
  readonly decision: RecoveryDecision;
  /** Live sessions folded into one. 0 in the normal case. */
  readonly mergedWorkouts: number;
  /** Rows rebuilt from the black box. 0 in the normal case. */
  readonly replayedEvents: number;
  /** Probable duplicate sets raised for the user to resolve. */
  readonly conflictsRaised: number;
}

/** Raw shape of the workout columns recovery reads. */
interface LiveWorkoutRow {
  readonly id: string;
  readonly startedAt: string;
  readonly pausedMs: number;
  readonly notes: string | null;
}

/**
 * Run before the first frame renders.
 *
 * Order matters and is not negotiable:
 *  1. The caller has already opened the database, which replayed the WAL — every
 *     transaction that committed before the crash is back.
 *  2. Merge duplicate live sessions, so steps 3-5 see one workout.
 *  3. Replay black-box events whose `sets` rows are missing.
 *  4. Recompute aggregates, which a crash between "set committed" and
 *     "totals updated" would have left stale.
 *  5. Decide: resume, confirm, or auto-close.
 *
 * Never throws. A launch that cannot recover still has to launch; the failure is
 * reported through `deps.log` and the decision degrades to `none`.
 *
 * @param db An open, migrated connection.
 * @param deps Clock, ids, revisions and the user to recover.
 */
export async function recoverOnLaunch(db: SqlDatabase, deps: RecoveryDeps): Promise<RecoveryResult> {
  let mergedWorkouts = 0;
  let replayedEvents = 0;
  let conflictsRaised = 0;

  try {
    const merge = await mergeDuplicateActiveWorkouts(db, deps);
    mergedWorkouts = merge.merged;
    conflictsRaised = merge.conflicts;

    const workout = await findActiveWorkout(db, deps.userId);
    if (!workout) return { decision: { kind: 'none' }, mergedWorkouts, replayedEvents, conflictsRaised };

    replayedEvents = await replayOrphanEvents(db, workout.id, deps);
    await recomputeWorkoutAggregates(db, workout.id, deps);

    const lastActivityMs = await lastCompletedSetMs(db, workout.id);
    const decision = decideRecovery({
      workout: { id: workout.id, startedAtMs: toMs(workout.startedAt) },
      lastActivityMs,
      nowMs: deps.now(),
    });

    if (decision.kind === 'auto_close') {
      await autoCloseWorkout(db, workout, decision.closeAtMs, deps);
    }

    return { decision, mergedWorkouts, replayedEvents, conflictsRaised };
  } catch (error) {
    deps.log?.('recovery.failed', { error: String(error) });
    return { decision: { kind: 'none' }, mergedWorkouts, replayedEvents, conflictsRaised };
  }
}

/**
 * The live workout for a user, earliest start first.
 *
 * INDEX: `workouts_active` — partial on (user_id, started_at) where
 * status = 'in_progress' and deleted_at is null. This runs on every cold start,
 * so it must never scan the workouts table.
 */
async function findActiveWorkout(db: SqlDatabase, userId: string): Promise<LiveWorkoutRow | null> {
  return db.getFirst<LiveWorkoutRow>(
    `SELECT id AS id, started_at AS startedAt, paused_ms AS pausedMs, notes AS notes
       FROM workouts
      WHERE user_id = ? AND status = 'in_progress' AND deleted_at IS NULL
      ORDER BY started_at ASC
      LIMIT 1`,
    [userId],
  );
}

/**
 * Epoch milliseconds of the most recent completed set in a workout, or null.
 *
 * INDEX: `sets_workout_idx` — partial on (workout_id) where deleted_at is null.
 */
async function lastCompletedSetMs(db: SqlDatabase, workoutId: string): Promise<number | null> {
  const row = await db.getFirst<{ lastAt: string | null }>(
    `SELECT MAX(completed_at) AS lastAt
       FROM sets
      WHERE workout_id = ? AND is_completed = 1 AND deleted_at IS NULL`,
    [workoutId],
  );
  return row?.lastAt ? toMs(row.lastAt) : null;
}

/**
 * Fold every extra live session into the earliest one.
 *
 * The hard case from the brief: the same workout logged on a phone and an iPad,
 * both offline, neither insert rejected. There is no winner-takes-all here.
 * Exercises are re-parented, sets are re-parented and given fresh `pos` keys at
 * the end of their new block, and probable duplicates are recorded in
 * `merge_conflicts` for the user — never deleted. The absorbed workout is marked
 * discarded and tombstoned, with a note naming its survivor.
 *
 * @returns How many workouts were absorbed and how many conflicts were raised.
 */
export async function mergeDuplicateActiveWorkouts(
  db: SqlDatabase,
  deps: RecoveryDeps,
): Promise<{ merged: number; conflicts: number }> {
  const live = await db.getAll<{ id: string; startedAt: string }>(
    `SELECT id AS id, started_at AS startedAt
       FROM workouts
      WHERE user_id = ? AND status = 'in_progress' AND deleted_at IS NULL
      ORDER BY started_at ASC`,
    [deps.userId],
  );
  const plan = chooseSurvivingWorkout(live.map((w) => ({ id: w.id, startedAtMs: toMs(w.startedAt) })));
  if (!plan) return { merged: 0, conflicts: 0 };

  let conflicts = 0;
  const nowIso = toIso(deps.now());

  for (const dup of plan.absorb) {
    conflicts += await db.transaction(async (tx) => {
      let raised = 0;
      const exercises = await tx.getAll<{ id: string; exerciseId: string }>(
        `SELECT id AS id, exercise_id AS exerciseId
           FROM workout_exercises
          WHERE workout_id = ? AND deleted_at IS NULL
          ORDER BY pos, id`,
        [dup.id],
      );

      for (const ex of exercises) {
        // Fold into an existing block for the same exercise if there is one,
        // otherwise re-parent the block itself onto the end of the survivor.
        const target = await tx.getFirst<{ id: string }>(
          `SELECT id AS id
             FROM workout_exercises
            WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL
            ORDER BY pos, id
            LIMIT 1`,
          [plan.keep.id, ex.exerciseId],
        );
        if (!target) {
          // No block for this exercise on the survivor: move the whole block,
          // sets included. Their `pos` keys stay valid because they are relative
          // to their own block, so nothing is renumbered and nothing can collide.
          const last = await tx.getFirst<{ pos: string }>(
            `SELECT pos AS pos FROM workout_exercises WHERE workout_id = ? ORDER BY pos DESC, id DESC LIMIT 1`,
            [plan.keep.id],
          );
          await tx.run(
            `UPDATE workout_exercises
                SET workout_id = ?, pos = ?, updated_at = ?, rev_hlc = ?, origin_device = ?
              WHERE id = ?`,
            [plan.keep.id, between(last?.pos ?? null, null), nowIso, deps.nextRev(), deps.deviceId, ex.id],
          );
          await tx.run(
            `UPDATE sets
                SET workout_id = ?, updated_at = ?, rev_hlc = ?, origin_device = ?
              WHERE workout_exercise_id = ?`,
            [plan.keep.id, nowIso, deps.nextRev(), deps.deviceId, ex.id],
          );
          continue;
        }
        const targetId = target.id;

        const moving = await tx.getAll<{
          id: string;
          exerciseId: string;
          weightKg: number | null;
          reps: number | null;
          completedAt: string | null;
        }>(
          `SELECT id AS id, exercise_id AS exerciseId, weight_kg AS weightKg,
                  reps AS reps, completed_at AS completedAt
             FROM sets
            WHERE workout_exercise_id = ? AND deleted_at IS NULL
            ORDER BY pos, id`,
          [ex.id],
        );

        const existing = await tx.getAll<{
          id: string;
          exerciseId: string;
          weightKg: number | null;
          reps: number | null;
          completedAt: string | null;
        }>(
          `SELECT id AS id, exercise_id AS exerciseId, weight_kg AS weightKg,
                  reps AS reps, completed_at AS completedAt
             FROM sets
            WHERE workout_exercise_id = ? AND deleted_at IS NULL
            ORDER BY pos, id`,
          [targetId],
        );

        const lastSet = await tx.getFirst<{ pos: string }>(
          `SELECT pos AS pos FROM sets WHERE workout_exercise_id = ? ORDER BY pos DESC, id DESC LIMIT 1`,
          [targetId],
        );
        let cursor: string | null = lastSet?.pos ?? null;

        for (const s of moving) {
          const candidate = {
            exerciseId: s.exerciseId,
            weightKg: s.weightKg,
            reps: s.reps,
            completedAtMs: s.completedAt === null ? null : toMs(s.completedAt),
          };
          const twin = existing.find((other) =>
            isProbableDuplicateSet(candidate, {
              exerciseId: other.exerciseId,
              weightKg: other.weightKg,
              reps: other.reps,
              completedAtMs: other.completedAt === null ? null : toMs(other.completedAt),
            }),
          );
          if (twin) {
            await tx.run(
              `INSERT INTO merge_conflicts (id, user_id, kind, a_id, b_id, workout_id, created_at)
               VALUES (?, ?, 'duplicate_set', ?, ?, ?, ?)`,
              [deps.newId(), deps.userId, twin.id, s.id, plan.keep.id, nowIso],
            );
            raised += 1;
          }
          cursor = between(cursor, null);
          await tx.run(
            `UPDATE sets
                SET workout_exercise_id = ?, workout_id = ?, pos = ?,
                    updated_at = ?, rev_hlc = ?, origin_device = ?
              WHERE id = ?`,
            [targetId, plan.keep.id, cursor, nowIso, deps.nextRev(), deps.deviceId, s.id],
          );
        }

        // The emptied block is a tombstone, not a hard delete: the other device
        // has to learn that it is gone, and a physical delete does not replicate.
        await tx.run(
          `UPDATE workout_exercises
              SET deleted_at = ?, updated_at = ?, rev_hlc = ?, origin_device = ?
            WHERE id = ?`,
          [nowIso, nowIso, deps.nextRev(), deps.deviceId, ex.id],
        );
      }

      // The session really did run from the earliest start, and the survivor
      // should not inherit pause time it never spent: take the smaller ledger.
      await tx.run(
        `UPDATE workouts
            SET paused_ms = MIN(paused_ms, (SELECT paused_ms FROM workouts WHERE id = ?)),
                updated_at = ?, rev_hlc = ?, origin_device = ?
          WHERE id = ?`,
        [dup.id, nowIso, deps.nextRev(), deps.deviceId, plan.keep.id],
      );
      await tx.run(
        `UPDATE workouts
            SET status = 'discarded', deleted_at = ?, ended_at = COALESCE(ended_at, ?),
                notes = COALESCE(notes, '') || ?, updated_at = ?, rev_hlc = ?, origin_device = ?
          WHERE id = ?`,
        [nowIso, nowIso, `\nmerged into ${plan.keep.id}`, nowIso, deps.nextRev(), deps.deviceId, dup.id],
      );
      await appendEvent(tx, {
        id: deps.newId(),
        workoutId: plan.keep.id,
        userId: deps.userId,
        deviceId: deps.deviceId,
        at: nowIso,
        kind: 'recovery_merge',
        payload: JSON.stringify({ absorbed_workout_id: dup.id, conflicts: raised }),
      });
      return raised;
    });
  }

  await recomputeWorkoutAggregates(db, plan.keep.id, deps);
  deps.log?.('recovery.merged_duplicate_workouts', { kept: plan.keep.id, absorbed: plan.absorb.length });
  return { merged: plan.absorb.length, conflicts };
}

/**
 * Rebuild `sets` rows that the black box recorded but the mutable table lost.
 *
 * Only possible if a write landed mid-transaction on a corrupt filesystem, which
 * is rare enough that this is a safety net rather than a hot path — but it is
 * cheap (one indexed scan of a session's events) and it is the only thing that
 * can turn a corrupted session back into the user's real workout.
 *
 * INDEX: `workout_events_workout_at` on (workout_id, at).
 *
 * @returns How many rows were rebuilt.
 */
export async function replayOrphanEvents(
  db: SqlDatabase,
  workoutId: string,
  deps: RecoveryDeps,
): Promise<number> {
  const events = await db.getAll<{ id: string; at: string; kind: string; payload: string }>(
    `SELECT id AS id, at AS at, kind AS kind, payload AS payload
       FROM workout_events
      WHERE workout_id = ? AND kind IN ('set_add', 'set_complete', 'set_edit')
      ORDER BY at ASC, seq ASC`,
    [workoutId],
  );
  if (events.length === 0) return 0;

  const latest = new Map<string, SetEventPayload>();
  for (const event of events) {
    const payload = parseSetEventPayload(event.payload);
    if (!payload) {
      deps.log?.('recovery.unparseable_event', { eventId: event.id, kind: event.kind });
      continue;
    }
    // Later events for the same set supersede earlier ones; the log is ordered.
    latest.set(payload.set_id, { ...latest.get(payload.set_id), ...payload });
  }
  if (latest.size === 0) return 0;

  const present = await db.getAll<{ id: string }>(
    `SELECT id AS id FROM sets WHERE workout_id = ?`,
    [workoutId],
  );
  const known = new Set(present.map((r) => r.id));
  const missing = [...latest.values()].filter((p) => !known.has(p.set_id));
  if (missing.length === 0) return 0;

  const nowIso = toIso(deps.now());
  await db.transaction(async (tx) => {
    for (const p of missing) {
      await tx.run(
        `INSERT OR IGNORE INTO sets (
           id, workout_exercise_id, workout_id, user_id, exercise_id, pos, set_type,
           weight_kg, reps, rir, rpe, duration_s, distance_m, effective_load_kg,
           volume_kg, e1rm_kg, is_completed, completed_at, is_pr, pr_kinds,
           created_at, updated_at, rev_hlc, origin_device
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', ?, ?, ?, ?)`,
        [
          p.set_id,
          p.workout_exercise_id,
          workoutId,
          deps.userId,
          p.exercise_id,
          p.pos,
          p.set_type ?? 'normal',
          p.weight_kg ?? null,
          p.reps ?? null,
          p.rir ?? null,
          p.rpe ?? null,
          p.duration_s ?? null,
          p.distance_m ?? null,
          p.effective_load_kg ?? null,
          p.volume_kg ?? 0,
          p.e1rm_kg ?? null,
          p.completed_at ? 1 : 0,
          p.completed_at ?? null,
          nowIso,
          nowIso,
          deps.nextRev(),
          deps.deviceId,
        ],
      );
    }
  });
  deps.log?.('recovery.replayed_events', { workoutId, rebuilt: missing.length });
  return missing.length;
}

/**
 * Recompute a workout's totals, and each exercise block's volume, from its sets.
 *
 * A crash between "the set committed" and "the totals updated" leaves the two
 * disagreeing. The sets are the truth; the totals are a cache, so they are
 * always rebuilt rather than repaired.
 *
 * INDEX: `sets_workout_idx` on (workout_id) where deleted_at is null.
 */
export async function recomputeWorkoutAggregates(
  db: SqlDatabase,
  workoutId: string,
  deps: RecoveryDeps,
): Promise<WorkoutAggregates> {
  const rows = await db.getAll<{
    workoutExerciseId: string;
    isCompleted: number;
    volumeKg: number | null;
    reps: number | null;
    rpe: number | null;
    isPr: number;
  }>(
    `SELECT workout_exercise_id AS workoutExerciseId, is_completed AS isCompleted,
            volume_kg AS volumeKg, reps AS reps, rpe AS rpe, is_pr AS isPr
       FROM sets
      WHERE workout_id = ? AND deleted_at IS NULL`,
    [workoutId],
  );

  const aggregates = computeWorkoutAggregates(
    rows.map((r) => ({
      workoutExerciseId: r.workoutExerciseId,
      isCompleted: r.isCompleted === 1,
      volumeKg: r.volumeKg,
      reps: r.reps,
      rpe: r.rpe,
      isPr: r.isPr === 1,
    })),
  );

  const nowIso = toIso(deps.now());
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE workouts
          SET total_volume_kg = ?, total_reps = ?, total_sets = ?, total_exercises = ?,
              prs_count = ?, avg_rpe = ?, updated_at = ?, rev_hlc = ?, origin_device = ?
        WHERE id = ?`,
      [
        aggregates.totalVolumeKg,
        aggregates.totalReps,
        aggregates.totalSets,
        aggregates.totalExercises,
        aggregates.prsCount,
        aggregates.avgRpe,
        nowIso,
        deps.nextRev(),
        deps.deviceId,
        workoutId,
      ],
    );
    await tx.run(
      `UPDATE workout_exercises
          SET volume_kg = COALESCE((
                SELECT SUM(s.volume_kg) FROM sets s
                 WHERE s.workout_exercise_id = workout_exercises.id
                   AND s.is_completed = 1 AND s.deleted_at IS NULL), 0),
              updated_at = ?
        WHERE workout_id = ? AND deleted_at IS NULL`,
      [nowIso, workoutId],
    );
  });

  return aggregates;
}

/**
 * Close a session that has been idle too long, at the time of its last real set.
 *
 * Two deliberate choices. The workout ends when the user last did something, not
 * now, so a session left open overnight does not become a nine-hour workout.
 * And sets that were never completed are soft-deleted, not removed: a hard
 * delete cannot be replicated to a device that has been offline, and the
 * tombstone is what makes the other device agree.
 */
async function autoCloseWorkout(
  db: SqlDatabase,
  workout: LiveWorkoutRow,
  closeAtMs: number,
  deps: RecoveryDeps,
): Promise<void> {
  const closeAt = toIso(closeAtMs);
  const nowIso = toIso(deps.now());
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE workouts
          SET status = 'completed', ended_at = ?, notes = COALESCE(notes, '') || ?,
              pause_started_at = NULL, active_device_id = NULL, claim_expires_at = NULL,
              updated_at = ?, rev_hlc = ?, origin_device = ?
        WHERE id = ?`,
      [closeAt, '\n(auto-closed)', nowIso, deps.nextRev(), deps.deviceId, workout.id],
    );
    await tx.run(
      `UPDATE sets
          SET deleted_at = ?, updated_at = ?, rev_hlc = ?, origin_device = ?
        WHERE workout_id = ? AND is_completed = 0 AND deleted_at IS NULL`,
      [nowIso, nowIso, deps.nextRev(), deps.deviceId, workout.id],
    );
    await appendEvent(tx, {
      id: deps.newId(),
      workoutId: workout.id,
      userId: deps.userId,
      deviceId: deps.deviceId,
      at: nowIso,
      kind: 'workout_auto_close',
      payload: JSON.stringify({ closed_at: closeAt }),
    });
  });
  await recomputeWorkoutAggregates(db, workout.id, deps);
  deps.log?.('recovery.auto_closed', { workoutId: workout.id, closedAt: closeAt });
}

/** One row of the append-only black box. */
interface AppendEventInput {
  readonly id: string;
  readonly workoutId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly at: string;
  readonly kind: string;
  readonly payload: string;
}

/**
 * Append to the black box, allocating the next per-device sequence number.
 *
 * `INSERT OR IGNORE` plus the unique (workout_id, device_id, seq) index makes a
 * replayed event a no-op rather than a duplicate.
 */
async function appendEvent(tx: SqlExecutor, event: AppendEventInput): Promise<void> {
  const row = await tx.getFirst<{ maxSeq: number | null }>(
    `SELECT MAX(seq) AS maxSeq FROM workout_events WHERE workout_id = ? AND device_id = ?`,
    [event.workoutId, event.deviceId],
  );
  const seq = (row?.maxSeq ?? 0) + 1;
  await tx.run(
    `INSERT OR IGNORE INTO workout_events (id, workout_id, user_id, seq, device_id, at, kind, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.id, event.workoutId, event.userId, seq, event.deviceId, event.at, event.kind, event.payload],
  );
}

/** ISO-8601 UTC text to epoch milliseconds. Invalid text reads as 0, never NaN. */
export function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Epoch milliseconds to the ISO-8601 UTC text every timestamp column stores. */
export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}
