import { resolveExercise } from '@/features/exercises/source';
import type { CompletedWorkout, LoggedSet, WorkoutExercise } from '@/features/workout/types';

/**
 * Demo dataset generator.
 *
 * Builds a plausible eight-month training history so the analytics screens can
 * be seen with real shapes in them — progressive overload, deload weeks,
 * missed sessions, a bodyweight cut that stalls.
 *
 * DETERMINISTIC by design: a seeded PRNG rather than Math.random, so the demo
 * account looks identical on every device and a screenshot taken today matches
 * one taken tomorrow. Bugs in the analytics reproduce instead of vanishing.
 */

/** mulberry32 — small, fast, good enough distribution for fixture data. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

type Plan = { name: string; ids: string[] };

const PPL: Plan[] = [
  {
    name: 'push',
    ids: [
      'Bench Press (Barbell)',
      'Incline Bench Press (Dumbbell)',
      'Overhead Press (Barbell)',
      'Lateral Raise (Dumbbell)',
      'Triceps Pushdown',
      'Overhead Triceps Extension',
    ],
  },
  {
    name: 'pull',
    ids: [
      'Deadlift (Barbell)',
      'Pull Up',
      'Bent Over Row (Barbell)',
      'Seated Cable Row',
      'Face Pull',
      'Biceps Curl (Barbell)',
      'Hammer Curl',
    ],
  },
  {
    name: 'legs',
    ids: [
      'Back Squat (Barbell)',
      'Romanian Deadlift (Barbell)',
      'Leg Press',
      'Lying Leg Curl',
      'Leg Extension',
      'Standing Calf Raise',
    ],
  },
];

/** Starting top-set load in kg, and how fast each lift adds weight per week. */
const START: Record<string, { kg: number; perWeek: number; reps: number }> = {
  'Bench Press (Barbell)': { kg: 60, perWeek: 0.55, reps: 8 },
  'Incline Bench Press (Dumbbell)': { kg: 22, perWeek: 0.18, reps: 10 },
  'Overhead Press (Barbell)': { kg: 35, perWeek: 0.3, reps: 8 },
  'Lateral Raise (Dumbbell)': { kg: 8, perWeek: 0.1, reps: 14 },
  'Triceps Pushdown': { kg: 25, perWeek: 0.3, reps: 12 },
  'Overhead Triceps Extension': { kg: 20, perWeek: 0.22, reps: 12 },
  'Deadlift (Barbell)': { kg: 110, perWeek: 0.95, reps: 5 },
  'Pull Up': { kg: 0, perWeek: 0.22, reps: 8 },
  'Bent Over Row (Barbell)': { kg: 55, perWeek: 0.45, reps: 8 },
  'Seated Cable Row': { kg: 45, perWeek: 0.4, reps: 10 },
  'Face Pull': { kg: 18, perWeek: 0.14, reps: 15 },
  'Biceps Curl (Barbell)': { kg: 25, perWeek: 0.2, reps: 10 },
  'Hammer Curl': { kg: 12, perWeek: 0.12, reps: 12 },
  'Back Squat (Barbell)': { kg: 80, perWeek: 0.8, reps: 6 },
  'Romanian Deadlift (Barbell)': { kg: 70, perWeek: 0.5, reps: 10 },
  'Leg Press': { kg: 140, perWeek: 1.4, reps: 12 },
  'Lying Leg Curl': { kg: 35, perWeek: 0.3, reps: 12 },
  'Leg Extension': { kg: 40, perWeek: 0.35, reps: 14 },
  'Standing Calf Raise': { kg: 60, perWeek: 0.5, reps: 15 },
};

/** Round to the smallest plate jump that equipment realistically allows. */
function roundLoad(kg: number, label: string): number {
  if (kg <= 0) return 0;
  const l = label.toLowerCase();
  const isDumbbell = l.includes('dumbbell') || l.includes('hammer') || l.includes('curl');
  const step = isDumbbell ? 2 : 2.5;
  return Math.max(step, Math.round(kg / step) * step);
}

export type DemoData = {
  workouts: CompletedWorkout[];
  bodyweight: { date: number; kg: number }[];
};

/**
 * @param now epoch ms to generate backwards from
 * @param weeks how much history to produce
 * @param bodyweightKg the user's current weight, which the series ends at
 */
export function generateDemoData(
  now: number,
  weeks = 34,
  bodyweightKg = 78.9,
): DemoData {
  // Fixed seed: the demo account must look the same everywhere, forever.
  return buildWith(rng(0x57_20_4e_47), now, weeks, bodyweightKg);
}

function buildWith(
  rand: () => number,
  now: number,
  weeks: number,
  endBodyweight: number,
): DemoData {
  const workouts: CompletedWorkout[] = [];
  const bodyweight: { date: number; kg: number }[] = [];

  // Start of the very first training week, aligned to a Monday.
  const start = now - weeks * 7 * DAY;

  let counter = 0;
  const uid = (p: string) => {
    counter += 1;
    return `${p}_demo_${counter.toString(36)}`;
  };

  for (let w = 0; w < weeks; w += 1) {
    // Every sixth week is a deload: lighter, fewer sets.
    const deload = w > 0 && w % 6 === 5;
    // One week off entirely, to prove the charts handle gaps.
    if (w === 18) continue;

    // Four sessions a week: Mon, Tue, Thu, Sat.
    const dayOffsets = [0, 1, 3, 5];

    for (let d = 0; d < dayOffsets.length; d += 1) {
      // Occasionally miss a session.
      if (rand() < 0.08) continue;

      const offset = dayOffsets[d] ?? 0;
      const planIndex = (w * 4 + d) % PPL.length;
      const plan = PPL[planIndex];
      if (!plan) continue;

      const startedAt = start + w * 7 * DAY + offset * DAY + 18 * 3600_000;
      const exercises: WorkoutExercise[] = [];

      for (const label of plan.ids) {
        const meta = resolveExercise(label);
        const base = START[label];
        if (!meta || !base) continue;

        const drift = base.perWeek * w;
        const noise = (rand() - 0.5) * base.kg * 0.04;
        const deloadFactor = deload ? 0.85 : 1;
        const top = roundLoad((base.kg + drift + noise) * deloadFactor, label);

        const setCount = deload ? 2 : 3 + (rand() < 0.3 ? 1 : 0);
        const sets: LoggedSet[] = [];

        // One warm-up on the heavy compounds only — nobody warms up a lateral raise.
        const isCompound = base.kg >= 50;
        if (isCompound && top > 0) {
          sets.push({
            id: uid('s'),
            type: 'warmup',
            weightKg: roundLoad(top * 0.5, label),
            reps: 8,
            rpe: null,
            done: true,
            previous: null,
          });
        }

        for (let i = 0; i < setCount; i += 1) {
          // Reps drop slightly across working sets as fatigue accumulates.
          const fatigue = i === 0 ? 0 : Math.round(rand() * 1.6);
          const reps = Math.max(3, base.reps - fatigue);
          sets.push({
            id: uid('s'),
            type: i === setCount - 1 && rand() < 0.18 ? 'failure' : 'normal',
            weightKg: top,
            reps,
            rpe: null,
            done: true,
            previous: null,
          });
        }

        exercises.push({
          id: uid('we'),
          exerciseId: meta.id,
          name: meta.name,
          muscles: meta.muscles,
          restSeconds: meta.defaultRestSeconds ?? 120,
          sets,
        });
      }

      if (exercises.length === 0) continue;

      let volumeKg = 0;
      let totalReps = 0;
      let totalSets = 0;
      for (const ex of exercises) {
        for (const s of ex.sets) {
          totalSets += 1;
          if (s.type === 'warmup') continue;
          volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
          totalReps += s.reps ?? 0;
        }
      }

      const durationSec = Math.round(2700 + rand() * 1800);

      workouts.push({
        id: uid('w'),
        name: plan.name,
        startedAt,
        exercises,
        finishedAt: startedAt + durationSec * 1000,
        durationSec,
        volumeKg,
        totalReps,
        totalSets,
      });
    }

    // Two weigh-ins a week, trending down toward the target with real noise.
    const progress = w / Math.max(1, weeks - 1);
    // Loss slows as it goes — a linear cut is the tell of fake data.
    const eased = 1 - Math.pow(1 - progress, 1.7);
    const startWeight = endBodyweight + 8.1;
    for (const dayOffset of [0, 4]) {
      const noise = (rand() - 0.5) * 0.9;
      bodyweight.push({
        date: start + w * 7 * DAY + dayOffset * DAY + 7 * 3600_000,
        kg: Math.round((startWeight - (startWeight - endBodyweight) * eased + noise) * 10) / 10,
      });
    }
  }

  // Newest first, matching how the stores hold history.
  workouts.sort((a, b) => b.finishedAt - a.finishedAt);
  bodyweight.sort((a, b) => b.date - a.date);

  return { workouts, bodyweight };
}
