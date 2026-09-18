import { describe, expect, it } from 'vitest';

import {
  CONFIRM_MAX_IDLE_HOURS,
  DUPLICATE_SET_WINDOW_MS,
  RESUME_MAX_IDLE_HOURS,
  chooseSurvivingWorkout,
  computeWorkoutAggregates,
  decideRecovery,
  idleHours,
  isProbableDuplicateSet,
  parseSetEventPayload,
  toIso,
  toMs,
  workoutElapsedMs,
} from './recovery';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 18, 20, 0, 0);

describe('idleHours', () => {
  it('measures the gap since the last real activity', () => {
    expect(idleHours(NOW - 2 * HOUR, NOW)).toBe(2);
    expect(idleHours(NOW - 90 * 60 * 1000, NOW)).toBe(1.5);
    expect(idleHours(NOW, NOW)).toBe(0);
  });

  it('clamps a backwards clock to zero instead of reporting negative idle time', () => {
    // A phone that died and cold-booted can come back behind the timestamps
    // already on its own disk.
    expect(idleHours(NOW + 5 * HOUR, NOW)).toBe(0);
  });

  it('never returns NaN for unparseable input', () => {
    expect(idleHours(Number.NaN, NOW)).toBe(0);
    expect(idleHours(NOW, Number.NaN)).toBe(0);
  });
});

describe('decideRecovery', () => {
  const workout = { id: '01J000000000000000000000AA', startedAtMs: NOW - 4 * HOUR };

  it('does nothing when there is no live session', () => {
    expect(decideRecovery({ workout: null, lastActivityMs: null, nowMs: NOW })).toEqual({ kind: 'none' });
  });

  it('resumes silently when the user only just stopped', () => {
    const d = decideRecovery({ workout, lastActivityMs: NOW - 4 * 60 * 1000, nowMs: NOW });
    expect(d.kind).toBe('resume');
  });

  it('resumes right up to the three-hour threshold and asks at it', () => {
    const justUnder = decideRecovery({
      workout,
      lastActivityMs: NOW - (RESUME_MAX_IDLE_HOURS * HOUR - 1),
      nowMs: NOW,
    });
    const exactly = decideRecovery({ workout, lastActivityMs: NOW - RESUME_MAX_IDLE_HOURS * HOUR, nowMs: NOW });
    expect(justUnder.kind).toBe('resume');
    expect(exactly.kind).toBe('confirm');
    expect(exactly).toMatchObject({ idleHours: 3 });
  });

  it('asks up to the eighteen-hour threshold and auto-closes at it', () => {
    const justUnder = decideRecovery({
      workout,
      lastActivityMs: NOW - (CONFIRM_MAX_IDLE_HOURS * HOUR - 1),
      nowMs: NOW,
    });
    const exactly = decideRecovery({ workout, lastActivityMs: NOW - CONFIRM_MAX_IDLE_HOURS * HOUR, nowMs: NOW });
    expect(justUnder.kind).toBe('confirm');
    expect(exactly.kind).toBe('auto_close');
  });

  it('auto-closes a three-day-old session at its last real set, not at now', () => {
    const lastActivityMs = NOW - 72 * HOUR;
    const d = decideRecovery({ workout, lastActivityMs, nowMs: NOW });
    expect(d).toEqual({ kind: 'auto_close', workoutId: workout.id, idleHours: 72, closeAtMs: lastActivityMs });
  });

  it('falls back to the session start when no set was ever completed', () => {
    // Started a workout, added nothing, put the phone away for a day.
    const started = { id: 'w1', startedAtMs: NOW - 20 * HOUR };
    const d = decideRecovery({ workout: started, lastActivityMs: null, nowMs: NOW });
    expect(d).toEqual({ kind: 'auto_close', workoutId: 'w1', idleHours: 20, closeAtMs: started.startedAtMs });
  });

  it('resumes rather than auto-closing when the clock came back skewed into the past', () => {
    const d = decideRecovery({ workout, lastActivityMs: NOW + 6 * HOUR, nowMs: NOW });
    expect(d.kind).toBe('resume');
  });
});

describe('chooseSurvivingWorkout', () => {
  it('has nothing to do for zero or one live session', () => {
    expect(chooseSurvivingWorkout([])).toBeNull();
    expect(chooseSurvivingWorkout([{ id: 'a', startedAtMs: 1 }])).toBeNull();
  });

  it('keeps the earliest start, because it holds the true duration anchor', () => {
    const phone = { id: 'b', startedAtMs: NOW - 2 * HOUR };
    const ipad = { id: 'a', startedAtMs: NOW - HOUR };
    const plan = chooseSurvivingWorkout([ipad, phone]);
    expect(plan?.keep).toBe(phone);
    expect(plan?.absorb).toEqual([ipad]);
  });

  it('breaks an exact tie on id so both devices reach the same answer', () => {
    const a = { id: '01AAA', startedAtMs: NOW };
    const b = { id: '01BBB', startedAtMs: NOW };
    expect(chooseSurvivingWorkout([a, b])?.keep).toBe(a);
    expect(chooseSurvivingWorkout([b, a])?.keep).toBe(a);
  });

  it('absorbs every extra session, not just one', () => {
    const plan = chooseSurvivingWorkout([
      { id: 'c', startedAtMs: 300 },
      { id: 'a', startedAtMs: 100 },
      { id: 'b', startedAtMs: 200 },
    ]);
    expect(plan?.keep.id).toBe('a');
    expect(plan?.absorb.map((w) => w.id)).toEqual(['b', 'c']);
  });
});

describe('isProbableDuplicateSet', () => {
  const base = { exerciseId: 'barbell-bench-press', weightKg: 100, reps: 5, completedAtMs: NOW };

  it('matches the same load and reps logged seconds apart on two devices', () => {
    expect(isProbableDuplicateSet(base, { ...base, completedAtMs: NOW + 30_000 })).toBe(true);
  });

  it('stops matching at the ninety-second window', () => {
    expect(isProbableDuplicateSet(base, { ...base, completedAtMs: NOW + DUPLICATE_SET_WINDOW_MS - 1 })).toBe(true);
    expect(isProbableDuplicateSet(base, { ...base, completedAtMs: NOW + DUPLICATE_SET_WINDOW_MS })).toBe(false);
    expect(isProbableDuplicateSet(base, { ...base, completedAtMs: NOW - DUPLICATE_SET_WINDOW_MS })).toBe(false);
  });

  it('treats a different exercise, load or rep count as different work', () => {
    expect(isProbableDuplicateSet(base, { ...base, exerciseId: 'dumbbell-bench-press' })).toBe(false);
    expect(isProbableDuplicateSet(base, { ...base, weightKg: 102.5 })).toBe(false);
    expect(isProbableDuplicateSet(base, { ...base, reps: 6 })).toBe(false);
  });

  it('never matches an incomplete set: a placeholder row is not performed work', () => {
    expect(isProbableDuplicateSet(base, { ...base, completedAtMs: null })).toBe(false);
    expect(isProbableDuplicateSet({ ...base, completedAtMs: null }, base)).toBe(false);
  });

  it('matches bodyweight sets, where both loads are null', () => {
    const pullup = { exerciseId: 'pull-up', weightKg: null, reps: 8, completedAtMs: NOW };
    expect(isProbableDuplicateSet(pullup, { ...pullup, completedAtMs: NOW + 1000 })).toBe(true);
  });
});

describe('computeWorkoutAggregates', () => {
  const set = (over: Partial<Parameters<typeof computeWorkoutAggregates>[0][number]> = {}) => ({
    workoutExerciseId: 'we1',
    isCompleted: true,
    volumeKg: 500,
    reps: 5,
    rpe: null,
    isPr: false,
    ...over,
  });

  it('is all zeroes and no average for an empty workout', () => {
    expect(computeWorkoutAggregates([])).toEqual({
      totalVolumeKg: 0,
      totalReps: 0,
      totalSets: 0,
      totalExercises: 0,
      prsCount: 0,
      avgRpe: null,
    });
  });

  it('sums three sets of 100 kg x 5 to 1500 kg', () => {
    const agg = computeWorkoutAggregates([set(), set(), set()]);
    expect(agg.totalVolumeKg).toBe(1500);
    expect(agg.totalReps).toBe(15);
    expect(agg.totalSets).toBe(3);
    expect(agg.totalExercises).toBe(1);
  });

  it('ignores sets the user added but never ticked', () => {
    const agg = computeWorkoutAggregates([set(), set({ isCompleted: false, volumeKg: 9999, reps: 99 })]);
    expect(agg.totalSets).toBe(1);
    expect(agg.totalVolumeKg).toBe(500);
    expect(agg.totalReps).toBe(5);
  });

  it('counts distinct exercise blocks, not sets', () => {
    const agg = computeWorkoutAggregates([
      set({ workoutExerciseId: 'we1' }),
      set({ workoutExerciseId: 'we1' }),
      set({ workoutExerciseId: 'we2' }),
    ]);
    expect(agg.totalExercises).toBe(2);
  });

  it('counts PRs and averages only the sets that recorded an RPE', () => {
    const agg = computeWorkoutAggregates([
      set({ rpe: 8, isPr: true }),
      set({ rpe: 9 }),
      set({ rpe: null, isPr: true }),
    ]);
    expect(agg.prsCount).toBe(2);
    expect(agg.avgRpe).toBe(8.5);
  });

  it('does not accumulate binary-float drift across a long session', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE 754. A user should never see
    // "1000.0000000000001 kg" on their finish screen.
    const agg = computeWorkoutAggregates([set({ volumeKg: 0.1 }), set({ volumeKg: 0.2 })]);
    expect(agg.totalVolumeKg).toBe(0.3);
  });

  it('treats a missing volume or rep count as zero rather than NaN', () => {
    const agg = computeWorkoutAggregates([set({ volumeKg: null, reps: null })]);
    expect(agg.totalVolumeKg).toBe(0);
    expect(agg.totalReps).toBe(0);
    expect(agg.totalSets).toBe(1);
  });
});

describe('workoutElapsedMs', () => {
  it('derives duration from the absolute anchors', () => {
    expect(workoutElapsedMs({ startedAtMs: NOW - HOUR, pausedMs: 0, pauseStartedAtMs: null }, NOW)).toBe(HOUR);
  });

  it('subtracts banked pause time', () => {
    const elapsed = workoutElapsedMs(
      { startedAtMs: NOW - HOUR, pausedMs: 10 * 60 * 1000, pauseStartedAtMs: null },
      NOW,
    );
    expect(elapsed).toBe(50 * 60 * 1000);
  });

  it('subtracts an open pause as well as the banked ledger', () => {
    const elapsed = workoutElapsedMs(
      { startedAtMs: NOW - HOUR, pausedMs: 10 * 60 * 1000, pauseStartedAtMs: NOW - 5 * 60 * 1000 },
      NOW,
    );
    expect(elapsed).toBe(45 * 60 * 1000);
  });

  it('freezes at the end of a finished workout no matter how long ago that was', () => {
    const elapsed = workoutElapsedMs(
      { startedAtMs: NOW - 72 * HOUR, pausedMs: 0, pauseStartedAtMs: null, endedAtMs: NOW - 71 * HOUR },
      NOW,
    );
    expect(elapsed).toBe(HOUR);
  });

  it('never reports negative time when the clock moved backwards', () => {
    expect(workoutElapsedMs({ startedAtMs: NOW + HOUR, pausedMs: 0, pauseStartedAtMs: null }, NOW)).toBe(0);
    expect(workoutElapsedMs({ startedAtMs: NOW - HOUR, pausedMs: 10 * HOUR, pauseStartedAtMs: null }, NOW)).toBe(0);
  });
});

describe('parseSetEventPayload', () => {
  const minimal = {
    set_id: '01SET',
    workout_exercise_id: '01WE',
    exercise_id: 'barbell-back-squat',
    pos: 'U',
  };

  it('accepts a payload that can rebuild a row', () => {
    const p = parseSetEventPayload(JSON.stringify({ ...minimal, weight_kg: 102.5, reps: 5, completed_at: toIso(NOW) }));
    expect(p).toMatchObject({ set_id: '01SET', weight_kg: 102.5, reps: 5, completed_at: toIso(NOW) });
  });

  it('defaults every optional field to null rather than undefined', () => {
    const p = parseSetEventPayload(JSON.stringify(minimal));
    expect(p?.weight_kg).toBeNull();
    expect(p?.reps).toBeNull();
    expect(p?.completed_at).toBeNull();
    expect(p?.set_type).toBeUndefined();
  });

  it('rejects anything that cannot identify a row, instead of aborting recovery', () => {
    expect(parseSetEventPayload('not json')).toBeNull();
    expect(parseSetEventPayload('[]')).toBeNull();
    expect(parseSetEventPayload('null')).toBeNull();
    expect(parseSetEventPayload('"string"')).toBeNull();
    expect(parseSetEventPayload(JSON.stringify({ ...minimal, set_id: '' }))).toBeNull();
    expect(parseSetEventPayload(JSON.stringify({ ...minimal, pos: 7 }))).toBeNull();
    const { workout_exercise_id: _omitted, ...withoutParent } = minimal;
    expect(parseSetEventPayload(JSON.stringify(withoutParent))).toBeNull();
  });

  it('drops non-finite and non-numeric measurements', () => {
    const p = parseSetEventPayload(JSON.stringify({ ...minimal, weight_kg: 'heavy', reps: null }));
    expect(p?.weight_kg).toBeNull();
    expect(p?.reps).toBeNull();
  });

  it('ignores keys it does not know about', () => {
    const p = parseSetEventPayload(JSON.stringify({ ...minimal, invented_field: 'x' }));
    expect(p?.set_id).toBe('01SET');
  });
});

describe('timestamp conversion', () => {
  it('round-trips through ISO-8601 UTC text', () => {
    expect(toMs(toIso(NOW))).toBe(NOW);
    expect(toIso(0)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('reads unparseable text as the epoch rather than NaN', () => {
    // NaN would silently poison every comparison downstream of it.
    expect(toMs('')).toBe(0);
    expect(toMs('yesterday')).toBe(0);
  });
});
