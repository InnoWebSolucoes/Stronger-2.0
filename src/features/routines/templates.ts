export type RoutineTemplate = {
  readonly name: string;
  readonly note: string;
  /**
   * Exercise NAMES, not catalog ids. Slugs are derived from movement +
   * equipment and change whenever the catalog is regenerated, which silently
   * emptied every template once already. references.test.ts asserts each of
   * these still resolves.
   */
  readonly exerciseIds: string[];
};

/**
 * Built-in starter routines.
 *
 * Shipped as templates rather than rows so they cannot be corrupted or
 * accidentally deleted; using one copies it into the user's own list.
 */
export const TEMPLATES: readonly RoutineTemplate[] = [
  {
    name: 'Upper A',
    note: 'Horizontal push and pull emphasis',
    exerciseIds: [
      'Bench Press (Barbell)',
      'Bent Over Row (Barbell)',
      'Seated Overhead Press (Dumbbell)',
      'Lat Pulldown',
      'Lateral Raise (Dumbbell)',
      'Triceps Pushdown',
    ],
  },
  {
    name: 'Lower A',
    note: 'Squat pattern first, hinge second',
    exerciseIds: [
      'Back Squat (Barbell)',
      'Romanian Deadlift (Barbell)',
      'Leg Press',
      'Lying Leg Curl',
      'Standing Calf Raise',
    ],
  },
  {
    name: 'Push',
    note: 'Chest, shoulders, triceps',
    exerciseIds: [
      'Bench Press (Barbell)',
      'Incline Bench Press (Dumbbell)',
      'Overhead Press (Barbell)',
      'Lateral Raise (Dumbbell)',
      'Triceps Pushdown',
      'Overhead Triceps Extension',
    ],
  },
  {
    name: 'Pull',
    note: 'Back and biceps',
    exerciseIds: [
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
    name: 'Legs',
    note: 'Quads, hamstrings, glutes, calves',
    exerciseIds: [
      'Back Squat (Barbell)',
      'Romanian Deadlift (Barbell)',
      'Bulgarian Split Squat (Dumbbell)',
      'Leg Extension',
      'Seated Leg Curl',
      'Standing Calf Raise',
    ],
  },
  {
    name: 'Full Body',
    note: 'One compound per pattern — good for 3 days a week',
    exerciseIds: [
      'Back Squat (Barbell)',
      'Bench Press (Barbell)',
      'Bent Over Row (Barbell)',
      'Overhead Press (Barbell)',
      'Romanian Deadlift (Barbell)',
      'Plank',
    ],
  },
];
