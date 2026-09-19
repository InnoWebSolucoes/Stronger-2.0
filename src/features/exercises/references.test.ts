import { describe, expect, it } from 'vitest';
import { ALL_EXERCISES, resolveExercise } from './source';
import { TEMPLATES } from '@/features/routines/templates';

/**
 * Every exercise the app names in a fixture, template or the demo generator
 * must resolve against the catalog.
 *
 * This exists because the catalog derives its slugs from movement + equipment
 * (`bench-press--barbell`), so a regeneration silently invalidated every
 * hard-coded id once already — templates rendered with zero exercises and
 * nothing failed. Referencing by name and asserting resolution here turns that
 * class of breakage into a red test.
 */

const LOG_TAB_SUGGESTION = [
  'Bench Press (Barbell)',
  'Bent Over Row (Barbell)',
  'Seated Overhead Press (Dumbbell)',
  'Lat Pulldown',
  'Lateral Raise (Dumbbell)',
];

const DEMO_GENERATOR = [
  'Bench Press (Barbell)',
  'Incline Bench Press (Dumbbell)',
  'Overhead Press (Barbell)',
  'Lateral Raise (Dumbbell)',
  'Triceps Pushdown',
  'Overhead Triceps Extension',
  'Deadlift (Barbell)',
  'Pull Up',
  'Bent Over Row (Barbell)',
  'Seated Cable Row',
  'Face Pull',
  'Biceps Curl (Barbell)',
  'Hammer Curl',
  'Back Squat (Barbell)',
  'Romanian Deadlift (Barbell)',
  'Leg Press',
  'Lying Leg Curl',
  'Leg Extension',
  'Standing Calf Raise',
];

describe('catalog', () => {
  it('ships the full seed catalog, not the old interim list', () => {
    expect(ALL_EXERCISES.length).toBeGreaterThan(250);
  });

  it('gives every exercise a name, an equipment label and at least one muscle', () => {
    for (const ex of ALL_EXERCISES) {
      expect(ex.name.length).toBeGreaterThan(0);
      expect(ex.equipment.length).toBeGreaterThan(0);
      expect(ex.muscles.length).toBeGreaterThan(0);
      expect(ex.defaultRestSeconds).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = new Set(ALL_EXERCISES.map((e) => e.id));
    expect(ids.size).toBe(ALL_EXERCISES.length);
  });
});

describe('named references resolve', () => {
  it('resolves every exercise the demo generator uses', () => {
    const unresolved = DEMO_GENERATOR.filter((n) => resolveExercise(n) === null);
    expect(unresolved).toEqual([]);
  });

  it('resolves every exercise in the Log tab suggestion', () => {
    const unresolved = LOG_TAB_SUGGESTION.filter((n) => resolveExercise(n) === null);
    expect(unresolved).toEqual([]);
  });

  it('resolves every exercise in every routine template', () => {
    const unresolved: string[] = [];
    for (const t of TEMPLATES) {
      for (const name of t.exerciseIds) {
        if (resolveExercise(name) === null) unresolved.push(`${t.name}: ${name}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('leaves no template empty', () => {
    for (const t of TEMPLATES) {
      const resolved = t.exerciseIds.filter((n) => resolveExercise(n) !== null);
      expect(resolved.length).toBe(t.exerciseIds.length);
    }
  });

  it('returns null for something that genuinely is not an exercise', () => {
    expect(resolveExercise('xyzzy not a real movement at all')).toBeNull();
  });
});
