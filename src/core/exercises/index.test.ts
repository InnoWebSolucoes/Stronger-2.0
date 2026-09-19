import { describe, expect, it } from 'vitest';

import {
  SEED_EXERCISES,
  contributionOf,
  exercisesByMuscle,
  findExercise,
  isCatalogExercise,
  searchExercises,
} from './index';

describe('findExercise', () => {
  it('resolves a known slug', () => {
    const bench = findExercise('bench-press--barbell');
    expect(bench?.name).toBe('Bench Press (Barbell)');
  });

  it('returns undefined for an id that is not in the catalog', () => {
    expect(findExercise('not-a-real-exercise')).toBeUndefined();
    expect(isCatalogExercise('not-a-real-exercise')).toBe(false);
  });

  it('resolves every row it seeded', () => {
    const missing = SEED_EXERCISES.filter((e) => findExercise(e.id) === undefined);
    expect(missing.map((e) => e.id)).toEqual([]);
  });
});

describe('searchExercises', () => {
  it('returns nothing for an empty query', () => {
    expect(searchExercises('')).toEqual([]);
    expect(searchExercises('   ')).toEqual([]);
  });

  it('finds an exercise by a partial name', () => {
    const hits = searchExercises('bench');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.exercise.id === 'bench-press--barbell')).toBe(true);
  });

  it('ranks the exact name first', () => {
    const hits = searchExercises('bench press barbell');
    expect(hits[0]?.exercise.id).toBe('bench-press--barbell');
  });

  it('prefers the plain lift over its variants for an ambiguous query', () => {
    const hits = searchExercises('pull up');
    expect(hits[0]?.exercise.id).toBe('pull-up--bodyweight');
  });

  it('finds an exercise by a curated alias', () => {
    const hits = searchExercises('rdl');
    expect(hits[0]?.exercise.id).toBe('romanian-deadlift--barbell');
  });

  it('finds an exercise by a generated equipment-first alias', () => {
    const hits = searchExercises('barbell bench press');
    expect(hits[0]?.exercise.id).toBe('bench-press--barbell');
  });

  it('finds an exercise by gym slang', () => {
    const hits = searchExercises('bss');
    expect(hits.some((h) => h.exercise.id === 'bulgarian-split-squat--dumbbell')).toBe(true);
  });

  it('finds an exercise by a common misspelling of triceps', () => {
    const hits = searchExercises('tricep pushdown');
    expect(hits.some((h) => h.exercise.components.movementId === 'triceps_pushdown')).toBe(true);
  });

  it('ignores punctuation and case', () => {
    const hits = searchExercises('  FARMERS  WALK!! ');
    expect(hits.some((h) => h.exercise.components.movementId === 'farmers_walk')).toBe(true);
  });

  it('returns hits in descending score order', () => {
    const hits = searchExercises('squat');
    const scores = hits.map((h) => h.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('honours the limit', () => {
    expect(searchExercises('press', { limit: 3 })).toHaveLength(3);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchExercises('zzzzqqqq')).toEqual([]);
  });
});

describe('exercisesByMuscle', () => {
  it('returns exercises for a muscle group, heaviest contribution first', () => {
    const chest = exercisesByMuscle('chest');
    expect(chest.length).toBeGreaterThan(10);
    const weights = chest.map((e) => contributionOf(e, 'chest'));
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('only returns exercises that actually train the group', () => {
    const offenders = exercisesByMuscle('calves').filter((e) => contributionOf(e, 'calves') <= 0);
    expect(offenders.map((e) => e.id)).toEqual([]);
  });

  it('accepts an anatomical muscle id and resolves it to its group', () => {
    expect(exercisesByMuscle('pec_major_sternal')).toEqual(exercisesByMuscle('chest'));
  });

  it('puts a calf raise at the top of the calves list', () => {
    const top = exercisesByMuscle('calves')[0];
    expect(top?.components.movementId).toBe('calf_raise');
  });

  it('puts a curl at the top of the biceps list', () => {
    const top = exercisesByMuscle('biceps')[0];
    expect(top?.components.movementId).toContain('curl');
  });

  it('returns an empty list for a group nothing trains rather than throwing', () => {
    expect(Array.isArray(exercisesByMuscle('hip_flexors'))).toBe(true);
  });
});

describe('search reaches the words people actually type', () => {
  // Every one of these returned nothing before the plural retry and the alias
  // pass. They are the queries a gym user types, not the catalog's own wording.
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['rower', 'Row (Rowing Machine)'],
    ['exercise bike', 'Cycle'],
    ['skipping', 'Jump Rope'],
    ['jogging', 'Run'],
    ['situp', 'Sit Up'],
    ['hamstring curl', 'Lying Leg Curl (Machine)'],
  ];

  for (const [query, expected] of cases) {
    it(`finds ${expected} from "${query}"`, () => {
      expect(searchExercises(query, { limit: 3 })[0]?.exercise.name).toBe(expected);
    });
  }
});

describe('plural queries', () => {
  it('falls back to the singular when the plural matches nothing', () => {
    expect(searchExercises('leg raises')[0]?.exercise.name).toBe('Hanging Leg Raise');
    expect(searchExercises('pull ups')[0]?.exercise.name).toBe('Pull Up');
    expect(searchExercises('calf raises')[0]?.exercise.components.movementId).toBe('calf_raise');
  });

  it('never lets the fallback override a query that already matched', () => {
    // "press" ends in 's' but must not be retried as "pres".
    const hits = searchExercises('press', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.exercise.name.toLowerCase()).toContain('press');
    }
  });

  it('leaves a word that only looks plural alone', () => {
    // "triceps" must not become "tricep" and "biceps" must not become "bicep".
    expect(searchExercises('triceps')[0]?.exercise.name).toContain('Triceps');
    expect(searchExercises('biceps')[0]?.exercise.name).toContain('Biceps');
  });
});
