import { describe, expect, it } from 'vitest';

import { DEFAULT_LIFT_EVIDENCE, measurementTau } from './classify';
import {
  MAX_NAMED_SOURCES,
  MIN_DIRECT_CONTRIBUTION,
  MIN_EVIDENCE_MASS,
  MIN_OBSERVATION_TAU,
  MUSCLE_DISPLAY_NAMES,
  MUSCLE_ROLLUP_METHODOLOGY,
  SIGMA_BETWEEN_MUSCLES,
  bestProbeFor,
  contributionsFor,
  effectiveTau,
  muscleObservationFromLift,
  rollupMuscles,
  solveMuscleScores,
} from './muscle-rollup';
import type { MuscleObservation } from './muscle-rollup';
import {
  MUSCLES,
  MUSCLE_CONTRIBUTIONS,
  UNKNOWN_EXPERIENCE_PRIOR,
  requireStandard,
  type Experience,
  type MuscleGroup,
} from './standards-data';

const EXPERIENCES: readonly (Experience | undefined)[] = [
  undefined,
  'never',
  'under_3m',
  '3_12m',
  '1_2y',
  '2_5y',
  '5y_plus',
];

/** A well-evidenced observation: repeated across sessions, logged recently. */
const solid = (exerciseId: string, z: number, tau = 0.3, ageDays = 3): MuscleObservation => ({
  exerciseId,
  z,
  tau,
  ageDays,
  qualified: true,
});

/** A triceps-heavy history: bench, dips, pushdowns and overhead extensions. */
const tricepsHistory: readonly MuscleObservation[] = [
  solid('bench_press', 1.0, 0.28),
  solid('dip', 1.3, 0.32),
  solid('tricep_pushdown', 1.7, 0.42),
  solid('overhead_tricep_ext', 1.6, 0.42),
  solid('close_grip_bench_press', 1.5, 0.28),
];

describe('the contribution matrix this module rests on', () => {
  it('has rows summing to 1.0, which is what lets the global term be identified', () => {
    for (const [id, row] of Object.entries(MUSCLE_CONTRIBUTIONS)) {
      const total = Object.values(row).reduce((sum, w) => sum + w, 0);
      expect(total, `contribution row ${id} must sum to 1.0`).toBeCloseTo(1.0, 6);
    }
  });

  it('names every muscle group for the UI', () => {
    for (const muscle of MUSCLES) expect(MUSCLE_DISPLAY_NAMES[muscle].length).toBeGreaterThan(2);
  });

  it('exposes an exercise row and refuses to invent one', () => {
    expect(contributionsFor('bench_press')?.triceps).toBeCloseTo(0.28, 10);
    expect(contributionsFor('not_an_exercise')).toBeUndefined();
  });
});

describe('cold start', () => {
  it('classifies nothing from a brand-new user with one logged set', () => {
    const tau = measurementTau(requireStandard('bench_press'), DEFAULT_LIFT_EVIDENCE);
    for (const experience of EXPERIENCES) {
      const rollup = rollupMuscles({
        observations: [{ exerciseId: 'bench_press', z: 2.8, tau }],
        ...(experience === undefined ? {} : { experience }),
      });
      expect(rollup.ranked).toHaveLength(0);
      expect(rollup.strongest).toBeNull();
      expect(rollup.biggestOpportunity).toBeNull();
      for (const m of rollup.muscles) {
        expect(m.label, `${m.muscle} must not be labelled from one set`).toBeNull();
        expect(m.rank).toBeNull();
        expect(m.state).not.toBe('ranked');
      }
    }
  });

  it('cannot be crowned Elite by an absurd first set, at any claimed precision', () => {
    for (const exerciseId of ['leg_extension', 'seated_calf_raise', 'bench_press', 'back_squat']) {
      for (const z of [3, 4, 5, 6]) {
        for (const tau of [0.01, 0.1, 0.3]) {
          const rollup = rollupMuscles({ observations: [{ exerciseId, z, tau }], experience: '5y_plus' });
          expect(rollup.ranked, `${exerciseId} z=${z} tau=${tau}`).toHaveLength(0);
          for (const m of rollup.muscles) expect(m.label).toBeNull();
        }
      }
    }
  });

  it('puts the trained muscle in calibrating with an honest range instead of silence', () => {
    const tau = measurementTau(requireStandard('bench_press'), DEFAULT_LIFT_EVIDENCE);
    const rollup = rollupMuscles({ observations: [{ exerciseId: 'bench_press', z: 2.8, tau }], experience: 'never' });
    const chest = rollup.muscles.find((m) => m.muscle === 'chest');
    expect(chest?.state).toBe('calibrating');
    expect(chest?.label).toBeNull();
    expect(chest?.provisionalLabel).not.toBeNull();
    expect(chest?.rangeLabels[0]).not.toBe(chest?.rangeLabels[1]);
    expect(chest?.explanation).toContain('another session');
  });

  it('says nothing at all about a muscle the user has never loaded', () => {
    const rollup = rollupMuscles({ observations: [solid('bench_press', 1.2, 0.28)], experience: '2_5y' });
    const calves = rollup.muscles.find((m) => m.muscle === 'calves');
    expect(calves?.state).toBe('insufficient_data');
    expect(calves?.label).toBeNull();
    expect(calves?.provisionalLabel).toBeNull();
    expect(calves?.rank).toBeNull();
    expect(calves?.evidenceMass).toBe(0);
    expect(calves?.suggestedExerciseId).toBe('seated_calf_raise');
    expect(calves?.explanation).toContain('not enough data');
  });

  it('reports every muscle as insufficient when there is no history at all', () => {
    const rollup = rollupMuscles({ observations: [] });
    expect(rollup.insufficient).toHaveLength(MUSCLES.length);
    expect(rollup.ranked).toHaveLength(0);
    expect(rollup.calibrating).toHaveLength(0);
    for (const m of rollup.muscles) {
      expect(m.label).toBeNull();
      expect(m.provisionalLabel).toBeNull();
      expect(m.suggestedExerciseId).not.toBeNull();
      expect(m.explanation).toContain(MUSCLE_DISPLAY_NAMES[m.muscle]);
    }
    expect(rollup.explanation).toContain('No muscle group has enough data');
  });

  it('will not label a muscle that only ever gets crumbs of a compound lift', () => {
    // Leg press gives the calves 4% of its load ceiling: real, but not a calf test.
    const rollup = rollupMuscles({
      observations: [solid('leg_press', 1.5, 0.48), solid('back_squat', 1.4, 0.28)],
      experience: '2_5y',
    });
    const calves = rollup.muscles.find((m) => m.muscle === 'calves');
    expect(calves?.evidenceMass).toBeGreaterThan(0);
    expect(calves?.evidenceMass).toBeLessThan(MIN_EVIDENCE_MASS);
    expect(calves?.state).toBe('insufficient_data');
    expect(calves?.directExercises).toHaveLength(0);
  });
});

describe('contribution-weighted rollup', () => {
  it('classifies triceps from the four exercises that train them, at their real weights', () => {
    const rollup = rollupMuscles({ observations: tricepsHistory, experience: '2_5y' });
    const triceps = rollup.muscles.find((m) => m.muscle === 'triceps');
    expect(triceps?.state).toBe('ranked');
    expect(triceps?.label).not.toBeNull();
    expect(triceps?.rank?.label).toBe(triceps?.label);
    expect(triceps?.directExercises).toHaveLength(5);
    expect(triceps?.qualifiedExercises).toHaveLength(5);
    // Contribution mass: 0.28 + 0.38 + 0.88 + 0.88 + 0.46.
    expect(triceps?.evidenceMass).toBeCloseTo(2.88, 6);
    expect(triceps?.topSources[0]?.exerciseId).toBe('tricep_pushdown');
    expect(triceps?.topSources.length).toBeLessThanOrEqual(MAX_NAMED_SOURCES);
    expect(triceps?.explanation).toContain('Triceps');
    expect(triceps?.explanation).toContain('Tricep Pushdown');
  });

  it('separates a muscle from the ones it shares a lift with', () => {
    // Same bench press, but the pushdowns say the triceps are far ahead of the chest.
    const rollup = rollupMuscles({
      observations: [
        solid('bench_press', 1.0, 0.28),
        solid('tricep_pushdown', 2.2, 0.42),
        solid('overhead_tricep_ext', 2.2, 0.42),
        solid('cable_fly', 0.6, 0.42),
      ],
      experience: '2_5y',
    });
    const triceps = rollup.muscles.find((m) => m.muscle === 'triceps');
    const chest = rollup.muscles.find((m) => m.muscle === 'chest');
    expect(triceps?.z ?? 0).toBeGreaterThan(chest?.z ?? 0);
  });

  it('weights a lift by how much it limits the muscle, not by how much it is felt', () => {
    // A pushdown owns 88% of its ceiling for the triceps; a bench press 28%. Moving the
    // pushdown must move the triceps more than moving the bench does.
    const base = solveMuscleScores([solid('bench_press', 1.0, 0.3), solid('tricep_pushdown', 1.0, 0.3)]);
    const pushdownUp = solveMuscleScores([solid('bench_press', 1.0, 0.3), solid('tricep_pushdown', 2.0, 0.3)]);
    const benchUp = solveMuscleScores([solid('bench_press', 2.0, 0.3), solid('tricep_pushdown', 1.0, 0.3)]);
    const fromPushdown = pushdownUp.theta.triceps - base.theta.triceps;
    const fromBench = benchUp.theta.triceps - base.theta.triceps;
    expect(fromPushdown).toBeGreaterThan(fromBench);
  });

  it('partitions every muscle into exactly one state', () => {
    const rollup = rollupMuscles({ observations: tricepsHistory, experience: '2_5y' });
    const total = rollup.ranked.length + rollup.calibrating.length + rollup.insufficient.length;
    expect(total).toBe(MUSCLES.length);
    const seen = new Set<MuscleGroup>([...rollup.ranked, ...rollup.calibrating, ...rollup.insufficient]);
    expect(seen.size).toBe(MUSCLES.length);
  });

  it('frames the weakest ranked muscle as an opportunity, not a failure', () => {
    const rollup = rollupMuscles({
      observations: [
        solid('tricep_pushdown', 2.0, 0.3),
        solid('overhead_tricep_ext', 2.0, 0.3),
        solid('close_grip_bench_press', 1.9, 0.28),
        solid('barbell_curl', -0.6, 0.3),
        solid('hammer_curl', -0.5, 0.3),
        solid('chin_up', -0.4, 0.32),
      ],
      experience: '2_5y',
    });
    expect(rollup.ranked.length).toBeGreaterThan(0);
    if (rollup.biggestOpportunity !== null) {
      expect(rollup.explanation).toContain('Biggest opportunity');
      const weakest = rollup.muscles.find((m) => m.muscle === rollup.biggestOpportunity);
      const strongest = rollup.muscles.find((m) => m.muscle === rollup.strongest);
      expect(weakest?.z ?? 0).toBeLessThan(strongest?.z ?? 0);
    }
  });

  it('ignores exercises it has no contribution row for instead of throwing', () => {
    const rollup = rollupMuscles({
      observations: [solid('not_an_exercise', 3.0, 0.2), ...tricepsHistory],
      experience: '2_5y',
    });
    const reference = rollupMuscles({ observations: tricepsHistory, experience: '2_5y' });
    expect(rollup.global).toBeCloseTo(reference.global, 12);
  });
});

describe('recency', () => {
  it('widens an old lift instead of rewriting it', () => {
    expect(effectiveTau(0.4, 0)).toBeCloseTo(0.4, 10);
    expect(effectiveTau(0.4, 56)).toBeCloseTo(0.4, 10);
    expect(effectiveTau(0.4, 200)).toBeGreaterThan(0.4);
    expect(effectiveTau(0.4, 400)).toBeGreaterThan(effectiveTau(0.4, 200));
  });

  it('floors the claimed precision at the uncertainty of the contribution matrix', () => {
    expect(effectiveTau(0.0001, 0)).toBeCloseTo(MIN_OBSERVATION_TAU, 10);
    expect(MIN_OBSERVATION_TAU).toBeGreaterThan(0);
  });

  it('lets a recent lift outweigh a stale one of the same size', () => {
    const fresh = solveMuscleScores([solid('tricep_pushdown', 2.0, 0.42, 0)], { mu0: -0.5, sigma0: 1.1 });
    const stale = solveMuscleScores([solid('tricep_pushdown', 2.0, 0.42, 400)], { mu0: -0.5, sigma0: 1.1 });
    expect(stale.thetaSd.triceps).toBeGreaterThan(fresh.thetaSd.triceps);
    expect(stale.theta.triceps).toBeLessThan(fresh.theta.triceps);
    expect(stale.theta.triceps).toBeGreaterThan(-0.5);
  });

  it('prefers the fresh lift when a stale one disagrees', () => {
    const rollup = rollupMuscles({
      observations: [solid('tricep_pushdown', 0.2, 0.42, 500), solid('tricep_pushdown', 1.6, 0.42, 2)],
      experience: '2_5y',
    });
    const triceps = rollup.muscles.find((m) => m.muscle === 'triceps');
    expect(triceps?.z ?? 0).toBeGreaterThan(0.9);
    expect(triceps?.freshestAgeDays).toBe(2);
  });

  it('tells a returning lifter their number is old rather than demoting them', () => {
    const rollup = rollupMuscles({
      observations: [
        solid('tricep_pushdown', 1.4, 0.3, 300),
        solid('overhead_tricep_ext', 1.4, 0.3, 300),
        solid('close_grip_bench_press', 1.4, 0.28, 300),
      ],
      experience: '2_5y',
    });
    const triceps = rollup.muscles.find((m) => m.muscle === 'triceps');
    expect(triceps?.freshestAgeDays).toBe(300);
    if (triceps?.state === 'ranked') expect(triceps.explanation).toContain('re-testing');
  });
});

describe('solveMuscleScores', () => {
  it('falls back to the lifter prior, not to "Intermediate", when there is no evidence', () => {
    const solved = solveMuscleScores([]);
    expect(solved.global).toBeCloseTo(UNKNOWN_EXPERIENCE_PRIOR.mu, 10);
    expect(solved.globalSd).toBeCloseTo(UNKNOWN_EXPERIENCE_PRIOR.sigma, 10);
    for (const muscle of MUSCLES) {
      expect(solved.theta[muscle]).toBeCloseTo(UNKNOWN_EXPERIENCE_PRIOR.mu, 10);
      expect(solved.thetaSd[muscle]).toBeCloseTo(
        Math.sqrt(UNKNOWN_EXPERIENCE_PRIOR.sigma ** 2 + SIGMA_BETWEEN_MUSCLES ** 2),
        6,
      );
    }
  });

  it('shrinks an unmeasured muscle toward the measured overall level', () => {
    const solved = solveMuscleScores(
      [solid('back_squat', 1.6, 0.28), solid('deadlift', 1.6, 0.28), solid('bench_press', 1.6, 0.28)],
      { mu0: -0.5, sigma0: 1.1 },
    );
    expect(solved.theta.calves).toBeCloseTo(solved.global, 6);
    expect(solved.thetaSd.calves).toBeGreaterThan(solved.thetaSd.quads);
  });

  it('is pure: same input, same output, no clock and no randomness', () => {
    const a = solveMuscleScores(tricepsHistory);
    const b = solveMuscleScores(tricepsHistory);
    expect(a).toEqual(b);
  });

  it('never returns a non-finite posterior, however degenerate the input', () => {
    const solved = solveMuscleScores([
      { exerciseId: 'bench_press', z: Number.NaN, tau: 0.3 },
      { exerciseId: 'back_squat', z: 1.2, tau: 0 },
      { exerciseId: 'deadlift', z: -4, tau: 1e6 },
    ]);
    expect(Number.isFinite(solved.global)).toBe(true);
    for (const muscle of MUSCLES) {
      expect(Number.isFinite(solved.theta[muscle]), muscle).toBe(true);
      expect(solved.thetaSd[muscle]).toBeGreaterThan(0);
    }
  });

  it('solves only the muscles it is asked for', () => {
    const solved = solveMuscleScores(tricepsHistory, { muscles: ['triceps', 'chest'] });
    expect(Number.isFinite(solved.theta.triceps)).toBe(true);
    const rollup = rollupMuscles({ observations: tricepsHistory, muscles: ['triceps', 'chest'] });
    expect(rollup.muscles).toHaveLength(2);
  });
});

describe('bridging from classifyLift', () => {
  it('carries the evidence bar across so a provisional lift cannot license a label', () => {
    const provisional = muscleObservationFromLift({
      exerciseId: 'bench_press',
      z: 2.5,
      score: 81,
      position: { level: 'elite', progressToNext: 1, nextLevel: null, zToNext: null },
      percentile: {
        percentile: 0.99,
        topPercent: 1,
        label: 'Top 1%',
        interval: [0.9, 0.999],
        confidence: 'low',
        sdZ: 0.46,
        explanation: '',
        population: '',
      },
      thresholdsKg: { beginner: 40, novice: 60, intermediate: 80, advanced: 100, elite: 120 },
      nextLevelLoadKg: null,
      kgToNextLevel: null,
      tau: 0.46,
      state: 'provisional',
      provisionalReasons: ['single_session'],
      bodyweightClamped: false,
      ageMode: 'open',
      explanation: '',
    });
    expect(provisional.qualified).toBe(false);
    expect(provisional.exerciseId).toBe('bench_press');
    expect(provisional.z).toBe(2.5);
    expect(provisional.tau).toBe(0.46);
    const rollup = rollupMuscles({ observations: [provisional], experience: '5y_plus' });
    expect(rollup.ranked).toHaveLength(0);
  });
});

describe('bestProbeFor', () => {
  it('suggests the exercise that would teach the app the most about a muscle', () => {
    expect(bestProbeFor('calves')).toBe('seated_calf_raise');
    expect(bestProbeFor('quads')).toBe('leg_extension');
    expect(bestProbeFor('hamstrings')).toBe('lying_leg_curl');
    expect(bestProbeFor('triceps')).toMatch(/tricep/);
  });

  it('has a probe for every muscle group, so no muscle is structurally unrankable', () => {
    // Guards the interaction between the evidence bar and the catalog: if the bar is
    // ever raised above what the matrix can supply for some muscle, that muscle becomes
    // a permanently dead cell on the body map and nothing else would notice.
    for (const muscle of MUSCLES) {
      const probe = bestProbeFor(muscle);
      expect(probe, muscle).not.toBeNull();
      const w = probe === null ? 0 : (MUSCLE_CONTRIBUTIONS[probe]?.[muscle] ?? 0);
      expect(w, muscle).toBeGreaterThanOrEqual(MIN_DIRECT_CONTRIBUTION);
    }
  });

  it('can eventually rank every muscle group given enough of the right training', () => {
    const observations = Object.keys(MUSCLE_CONTRIBUTIONS).map((exerciseId) => solid(exerciseId, 1.2, 0.28));
    const rollup = rollupMuscles({ observations, experience: '2_5y' });
    expect(rollup.insufficient, `unreachable: ${rollup.insufficient.join(', ')}`).toHaveLength(0);
  });
});

describe('disclosure (Apple Guideline 1.4.1)', () => {
  it('publishes a plain-English method and a citable source for every exported calculation', () => {
    for (const key of [
      'solveMuscleScores',
      'rollupMuscles',
      'effectiveTau',
      'muscleState',
      'bestProbeFor',
      'contributionsFor',
    ]) {
      const note = MUSCLE_ROLLUP_METHODOLOGY[key];
      expect(note, `missing methodology for ${key}`).toBeDefined();
      expect(note?.summary.length ?? 0).toBeGreaterThan(30);
      expect(note?.source.length ?? 0).toBeGreaterThan(5);
      expect(note?.url ?? '').toMatch(/^https?:\/\//);
    }
  });

  it('gives every muscle a sentence the UI can show verbatim', () => {
    const rollup = rollupMuscles({ observations: tricepsHistory, experience: '2_5y' });
    for (const m of rollup.muscles) {
      expect(m.explanation.length, m.muscle).toBeGreaterThan(30);
      expect(m.explanation).toContain(m.displayName);
      expect(m.explanation).not.toContain('undefined');
      expect(m.explanation).not.toMatch(/_[a-z]/);
    }
    expect(rollup.explanation).not.toContain('undefined');
  });
});
