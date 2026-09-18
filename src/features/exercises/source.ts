import type { ExerciseSeed } from '@/features/workout/store';

/**
 * INTERIM exercise list.
 *
 * src/core/exercises/seed.ts is being authored with the full ~240-exercise
 * catalog (contribution vectors, archetypes, tracking types, instructions).
 * When it lands, this file becomes a re-export of it and the literals below
 * are deleted — `ALL_EXERCISES`, `searchExercises` and `MUSCLE_GROUPS` are the
 * only names the UI imports, so nothing else has to change.
 */

type E = ExerciseSeed & { equipment: string };

const e = (id: string, name: string, equipment: string, muscles: string[], rest = 120): E => ({
  id,
  name,
  equipment,
  muscles,
  defaultRestSeconds: rest,
});

export const ALL_EXERCISES: E[] = [
  // Chest
  e('barbell-bench-press', 'Barbell Bench Press', 'Barbell', ['Chest', 'Triceps', 'Front Delts'], 180),
  e('incline-barbell-bench-press', 'Incline Barbell Bench Press', 'Barbell', ['Chest', 'Front Delts', 'Triceps'], 180),
  e('decline-barbell-bench-press', 'Decline Barbell Bench Press', 'Barbell', ['Chest', 'Triceps']),
  e('dumbbell-bench-press', 'Dumbbell Bench Press', 'Dumbbell', ['Chest', 'Triceps', 'Front Delts'], 150),
  e('incline-dumbbell-press', 'Incline Dumbbell Press', 'Dumbbell', ['Chest', 'Front Delts'], 150),
  e('dumbbell-fly', 'Dumbbell Fly', 'Dumbbell', ['Chest'], 90),
  e('cable-crossover', 'Cable Crossover', 'Cable', ['Chest'], 90),
  e('pec-deck', 'Pec Deck Machine', 'Machine', ['Chest'], 90),
  e('machine-chest-press', 'Machine Chest Press', 'Machine', ['Chest', 'Triceps']),
  e('push-up', 'Push-Up', 'Bodyweight', ['Chest', 'Triceps', 'Abs'], 60),
  e('dip', 'Dip', 'Bodyweight', ['Chest', 'Triceps', 'Front Delts'], 150),

  // Back
  e('deadlift', 'Deadlift', 'Barbell', ['Lower Back', 'Glutes', 'Hamstrings', 'Upper Back'], 240),
  e('sumo-deadlift', 'Sumo Deadlift', 'Barbell', ['Glutes', 'Quads', 'Lower Back'], 240),
  e('romanian-deadlift', 'Romanian Deadlift', 'Barbell', ['Hamstrings', 'Glutes', 'Lower Back'], 180),
  e('trap-bar-deadlift', 'Trap Bar Deadlift', 'Trap Bar', ['Quads', 'Glutes', 'Upper Back'], 240),
  e('rack-pull', 'Rack Pull', 'Barbell', ['Upper Back', 'Lower Back', 'Glutes'], 180),
  e('barbell-row', 'Barbell Row', 'Barbell', ['Upper Back', 'Lats', 'Biceps'], 150),
  e('pendlay-row', 'Pendlay Row', 'Barbell', ['Upper Back', 'Lats'], 150),
  e('dumbbell-row', 'Dumbbell Row', 'Dumbbell', ['Lats', 'Upper Back', 'Biceps'], 120),
  e('t-bar-row', 'T-Bar Row', 'Barbell', ['Upper Back', 'Lats'], 150),
  e('seal-row', 'Seal Row', 'Barbell', ['Upper Back', 'Lats']),
  e('cable-row', 'Cable Row', 'Cable', ['Lats', 'Upper Back', 'Biceps'], 120),
  e('machine-row', 'Machine Row', 'Machine', ['Lats', 'Upper Back']),
  e('inverted-row', 'Inverted Row', 'Bodyweight', ['Upper Back', 'Biceps'], 90),
  e('pull-up', 'Pull-Up', 'Bodyweight', ['Lats', 'Biceps', 'Upper Back'], 150),
  e('chin-up', 'Chin-Up', 'Bodyweight', ['Lats', 'Biceps'], 150),
  e('assisted-pull-up', 'Assisted Pull-Up', 'Machine', ['Lats', 'Biceps'], 120),
  e('lat-pulldown', 'Lat Pulldown', 'Cable', ['Lats', 'Biceps'], 120),
  e('iso-lateral-pulldown', 'Iso-Lateral Pulldown', 'Machine', ['Lats', 'Biceps'], 120),
  e('straight-arm-pulldown', 'Straight-Arm Pulldown', 'Cable', ['Lats'], 90),
  e('dumbbell-pullover', 'Dumbbell Pullover', 'Dumbbell', ['Lats', 'Chest'], 90),
  e('barbell-shrug', 'Barbell Shrug', 'Barbell', ['Traps'], 90),
  e('dumbbell-shrug', 'Dumbbell Shrug', 'Dumbbell', ['Traps'], 90),
  e('good-morning', 'Good Morning', 'Barbell', ['Hamstrings', 'Lower Back'], 150),
  e('back-extension', 'Back Extension', 'Bodyweight', ['Lower Back', 'Glutes'], 90),

  // Shoulders
  e('overhead-press', 'Overhead Press', 'Barbell', ['Front Delts', 'Triceps', 'Side Delts'], 180),
  e('seated-dumbbell-press', 'Seated Dumbbell Shoulder Press', 'Dumbbell', ['Front Delts', 'Triceps'], 150),
  e('arnold-press', 'Arnold Press', 'Dumbbell', ['Front Delts', 'Side Delts'], 120),
  e('push-press', 'Push Press', 'Barbell', ['Front Delts', 'Triceps', 'Quads'], 180),
  e('machine-shoulder-press', 'Machine Shoulder Press', 'Machine', ['Front Delts', 'Triceps']),
  e('dumbbell-lateral-raise', 'Dumbbell Lateral Raise', 'Dumbbell', ['Side Delts'], 75),
  e('cable-lateral-raise', 'Cable Lateral Raise', 'Cable', ['Side Delts'], 75),
  e('machine-lateral-raise', 'Machine Lateral Raise', 'Machine', ['Side Delts'], 75),
  e('front-raise', 'Front Raise', 'Dumbbell', ['Front Delts'], 75),
  e('rear-delt-fly', 'Rear Delt Fly', 'Dumbbell', ['Rear Delts'], 75),
  e('rear-delt-machine', 'Rear Delt Fly Machine', 'Machine', ['Rear Delts'], 75),
  e('face-pull', 'Face Pull', 'Cable', ['Rear Delts', 'Upper Back'], 75),
  e('upright-row', 'Upright Row', 'Barbell', ['Side Delts', 'Traps'], 90),

  // Arms
  e('barbell-curl', 'Barbell Curl', 'Barbell', ['Biceps'], 90),
  e('ez-bar-curl', 'EZ-Bar Curl', 'EZ Bar', ['Biceps'], 90),
  e('dumbbell-curl', 'Dumbbell Curl', 'Dumbbell', ['Biceps'], 90),
  e('hammer-curl', 'Hammer Curl', 'Dumbbell', ['Biceps', 'Forearms'], 90),
  e('preacher-curl', 'Dumbbell Preacher Curl', 'Dumbbell', ['Biceps'], 90),
  e('incline-curl', 'Incline Dumbbell Curl', 'Dumbbell', ['Biceps'], 90),
  e('concentration-curl', 'Concentration Curl', 'Dumbbell', ['Biceps'], 75),
  e('cable-curl', 'Cable Curl', 'Cable', ['Biceps'], 75),
  e('reverse-curl', 'Reverse Curl', 'Barbell', ['Forearms', 'Biceps'], 75),
  e('triceps-pushdown', 'Triceps Pushdown', 'Cable', ['Triceps'], 90),
  e('overhead-triceps-extension', 'Overhead Triceps Extension', 'Dumbbell', ['Triceps'], 90),
  e('skullcrusher', 'Skullcrusher', 'EZ Bar', ['Triceps'], 90),
  e('close-grip-bench-press', 'Close-Grip Bench Press', 'Barbell', ['Triceps', 'Chest'], 150),
  e('triceps-kickback', 'Triceps Kickback', 'Dumbbell', ['Triceps'], 60),
  e('wrist-curl', 'Wrist Curl', 'Dumbbell', ['Forearms'], 60),

  // Legs
  e('back-squat', 'Barbell Back Squat', 'Barbell', ['Quads', 'Glutes', 'Lower Back'], 240),
  e('front-squat', 'Front Squat', 'Barbell', ['Quads', 'Abs'], 210),
  e('goblet-squat', 'Goblet Squat', 'Dumbbell', ['Quads', 'Glutes'], 120),
  e('hack-squat', 'Hack Squat', 'Machine', ['Quads', 'Glutes'], 180),
  e('bulgarian-split-squat', 'Bulgarian Split Squat', 'Dumbbell', ['Quads', 'Glutes'], 150),
  e('leg-press', 'Leg Press', 'Machine', ['Quads', 'Glutes'], 180),
  e('walking-lunge', 'Walking Lunge', 'Dumbbell', ['Quads', 'Glutes'], 120),
  e('reverse-lunge', 'Reverse Lunge', 'Dumbbell', ['Quads', 'Glutes'], 120),
  e('step-up', 'Step-Up', 'Dumbbell', ['Quads', 'Glutes'], 120),
  e('leg-extension', 'Leg Extension', 'Machine', ['Quads'], 90),
  e('lying-leg-curl', 'Lying Leg Curl', 'Machine', ['Hamstrings'], 90),
  e('seated-leg-curl', 'Seated Leg Curl', 'Machine', ['Hamstrings'], 90),
  e('nordic-curl', 'Nordic Hamstring Curl', 'Bodyweight', ['Hamstrings'], 120),
  e('hip-thrust', 'Barbell Hip Thrust', 'Barbell', ['Glutes', 'Hamstrings'], 150),
  e('glute-bridge', 'Glute Bridge', 'Bodyweight', ['Glutes'], 90),
  e('cable-kickback', 'Cable Glute Kickback', 'Cable', ['Glutes'], 75),
  e('hip-abduction', 'Hip Abduction Machine', 'Machine', ['Glutes'], 75),
  e('standing-calf-raise', 'Standing Calf Raise', 'Machine', ['Calves'], 75),
  e('seated-calf-raise', 'Seated Calf Raise', 'Machine', ['Calves'], 75),

  // Core
  e('cable-crunch', 'Cable Crunch', 'Cable', ['Abs'], 75),
  e('hanging-leg-raise', 'Hanging Leg Raise', 'Bodyweight', ['Abs'], 90),
  e('crunch', 'Crunch', 'Bodyweight', ['Abs'], 60),
  e('plank', 'Plank', 'Bodyweight', ['Abs'], 60),
  e('ab-wheel', 'Ab Wheel Rollout', 'Bodyweight', ['Abs'], 90),
  e('russian-twist', 'Russian Twist', 'Bodyweight', ['Obliques'], 60),
  e('woodchop', 'Cable Woodchop', 'Cable', ['Obliques'], 75),

  // Olympic and conditioning
  e('power-clean', 'Power Clean', 'Barbell', ['Quads', 'Glutes', 'Traps'], 210),
  e('clean-and-jerk', 'Clean and Jerk', 'Barbell', ['Quads', 'Glutes', 'Front Delts'], 240),
  e('snatch', 'Snatch', 'Barbell', ['Quads', 'Glutes', 'Traps'], 240),
  e('kettlebell-swing', 'Kettlebell Swing', 'Kettlebell', ['Glutes', 'Hamstrings'], 90),
  e('thruster', 'Thruster', 'Barbell', ['Quads', 'Front Delts'], 150),
  e('farmers-carry', "Farmer's Carry", 'Dumbbell', ['Forearms', 'Traps', 'Abs'], 120),
];

export const MUSCLE_GROUPS: string[] = Array.from(
  new Set(ALL_EXERCISES.flatMap((x) => x.muscles)),
).sort();

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Ranked search over name and equipment. Prefix matches rank above contains. */
export function searchExercises(query: string, muscle?: string | null): E[] {
  const pool = muscle ? ALL_EXERCISES.filter((x) => x.muscles.includes(muscle)) : ALL_EXERCISES;
  const q = normalise(query);
  if (!q) return pool;

  const scored: { x: E; score: number }[] = [];
  for (const x of pool) {
    const name = normalise(x.name);
    const equip = normalise(x.equipment);
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.includes(` ${q}`)) score = 1;
    else if (name.includes(q)) score = 2;
    else if (equip.includes(q)) score = 3;
    if (score >= 0) scored.push({ x, score });
  }
  scored.sort((a, b) => a.score - b.score || a.x.name.localeCompare(b.x.name));
  return scored.map((s) => s.x);
}
