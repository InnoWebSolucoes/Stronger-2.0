import { describe, expect, it } from 'vitest';

import {
  BRZYCKI_POLE_REPS,
  DEFAULT_RIR_PRIOR,
  E1RM_FORMULA_META,
  E1RM_MAX_REPS,
  E1RM_MAX_RIR,
  LANDER_POLE_REPS,
  RIR_SOURCE_CONFIDENCE,
  RTS_PCT_BY_REPS_TO_FAILURE,
  blendedE1rm,
  brzycki,
  buildRpeChart,
  calibrateK,
  e1rmWithK,
  epley,
  epleyUnguarded,
  estimateSetE1rm,
  lander,
  lombardi,
  mayhew,
  oconner,
  percentOf1rm,
  personalisedRirPrior,
  repConfidencePenalty,
  resolveRir,
  rirToRpe,
  rpeToRir,
  rtsE1rm,
  rtsBlendWeight,
  rtsPercent,
  rtsPercentForRepsToFailure,
  wathan,
  wdK,
  weightDependent,
} from './e1rm';
import type { E1rmFormulaId } from './e1rm';
import type { LoggedSet } from './types';

const round1 = (x: number | null): number | null => (x === null ? null : Math.round(x * 10) / 10);

function set(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: 'set-1',
    exerciseId: 'barbell-bench-press',
    setType: 'normal',
    reps: 5,
    weightKg: 100,
    completed: true,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- *
 * TABLE A — %1RM implied by every formula, transcribed from the research brief *
 * -------------------------------------------------------------------------- */

/** [reps, epley, brzycki, lander, lombardi, mayhew, oconner, wathan, wd@20, wd@100, rts] */
const TABLE_A: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
])[] = [
  [1, 100.0, 100.0, 98.6, 100.0, 91.9, 97.6, 98.7, 100.0, 100.0, 100.0],
  [2, 93.8, 97.2, 96.0, 93.3, 89.7, 95.2, 95.1, 91.8, 94.9, 95.5],
  [3, 90.9, 94.4, 93.3, 89.6, 87.7, 93.0, 91.8, 86.1, 91.1, 92.2],
  [4, 88.2, 91.7, 90.6, 87.1, 85.8, 90.9, 88.7, 81.4, 87.9, 89.2],
  [5, 85.7, 88.9, 87.9, 85.1, 84.0, 88.9, 85.8, 77.5, 85.1, 86.3],
  [6, 83.3, 86.1, 85.3, 83.6, 82.3, 87.0, 83.1, 74.0, 82.5, 83.7],
  [8, 78.9, 80.6, 79.9, 81.2, 79.2, 83.3, 78.3, 68.1, 78.0, 78.6],
  [10, 75.0, 75.0, 74.6, 79.4, 76.4, 80.0, 74.2, 63.3, 74.1, 73.9],
  [12, 71.4, 69.4, 69.2, 78.0, 73.9, 76.9, 70.7, 59.3, 70.7, null],
  [15, 66.7, 61.1, 61.2, 76.3, 70.6, 72.7, 66.3, 54.2, 66.3, null],
];

describe('TABLE A: every formula reproduces the research brief exactly', () => {
  const ids: readonly E1rmFormulaId[] = [
    'epley',
    'brzycki',
    'lander',
    'lombardi',
    'mayhew',
    'oconner',
    'wathan',
  ];

  it.each(TABLE_A)(
    'at %i reps',
    (reps, ...expected) => {
      // `it.each` widens each tuple row to the union of its column types, so
      // `reps` arrives typed `number | null` even though column 0 is always a
      // rep count. Assert that as a test precondition rather than casting it.
      expect(reps).not.toBeNull();
      if (reps === null) return;

      ids.forEach((id, i) => {
        expect(round1(percentOf1rm(id, 100, reps)), `${id} @ ${reps} reps`).toBe(expected[i]);
      });

      const wd20 = weightDependent(20, reps);
      const wd100 = weightDependent(100, reps);
      expect(wd20).not.toBeNull();
      expect(wd100).not.toBeNull();
      expect(round1(wd20 === null ? null : (20 / wd20) * 100)).toBe(expected[7]);
      expect(round1(wd100 === null ? null : (100 / wd100) * 100)).toBe(expected[8]);
      expect(round1(rtsPercentForRepsToFailure(reps))).toBe(expected[9]);
    },
  );

  it('shows WD at 20 kg is dramatically steeper than at 100 kg', () => {
    // A 5RM curl is a far higher fraction of curl max than a 5RM squat is of
    // squat max: 77.5% vs 85.1%. This is the whole point of a load-dependent k.
    const wd20 = weightDependent(20, 5);
    const wd100 = weightDependent(100, 5);
    expect(wd20).not.toBeNull();
    expect(wd100).not.toBeNull();
    if (wd20 === null || wd100 === null) return;
    expect(round1((20 / wd20) * 100)).toBe(77.5);
    expect(round1((100 / wd100) * 100)).toBe(85.1);
  });

  it('shows WD at 100 kg tracks the RTS chart to within 1.3 percentage points', () => {
    for (let n = 2; n <= 10; n += 1) {
      const wd = weightDependent(100, n);
      const rts = rtsPercentForRepsToFailure(n);
      expect(wd).not.toBeNull();
      expect(rts).not.toBeNull();
      if (wd === null || rts === null) continue;
      expect(Math.abs((100 / wd) * 100 - rts)).toBeLessThan(1.3);
    }
  });

  it('shows every formula fans out above 12 reps, which is why 12 is the cap', () => {
    const row = TABLE_A[TABLE_A.length - 1];
    expect(row).toBeDefined();
    if (row === undefined) return;
    const classical = [row[1], row[2], row[3], row[4], row[5], row[6], row[7]];
    expect(Math.max(...classical) - Math.min(...classical)).toBeGreaterThan(15);
    expect(E1RM_MAX_REPS).toBe(12);
  });
});

/* -------------------------------------------------------------------------- *
 * The one-rep identity problem                                                 *
 * -------------------------------------------------------------------------- */

describe('behaviour at one rep', () => {
  it('returns exactly the weight lifted for Epley (guarded), Brzycki, Lombardi and WD', () => {
    expect(epley(100, 1)).toBe(100);
    expect(brzycki(100, 1)).toBeCloseTo(100, 10);
    expect(lombardi(100, 1)).toBe(100);
    expect(weightDependent(100, 1)).toBe(100);
  });

  it('shows raw Epley is 3.33% hot at one rep, which is why the guard exists', () => {
    expect(epleyUnguarded(100, 1)).toBeCloseTo(103.3333333, 6);
  });

  it('shows Mayhew predicts a 1RM 8.9% ABOVE a single the lifter just pressed', () => {
    expect(mayhew(100, 1)).toBeCloseTo(108.86, 2);
    expect(round1(percentOf1rm('mayhew', 100, 1))).toBe(91.9);
  });

  it('shows Wathan, Lander and O\'Conner are also non-identity at one rep', () => {
    // The requirement is that none of the three returns the weight lifted for a
    // genuine single: each predicts a 1RM strictly ABOVE it. That is what makes
    // them unsafe for display, so assert it directly.
    for (const fn of [wathan, lander, oconner]) {
      const single = fn(100, 1);
      expect(single, fn.name).not.toBeNull();
      if (single === null) continue;
      expect(single, fn.name).toBeGreaterThan(100);
    }
    // Magnitudes, to a tolerance. These are computed floats — O'Conner's
    // 100 × (1 + 0.025) is 102.49999999999999 in IEEE-754 — so exact equality on
    // them asserts the binary representation, not the formula.
    expect(wathan(100, 1)).toBeCloseTo(101.3, 1);
    expect(lander(100, 1)).toBeCloseTo(101.39, 2);
    expect(oconner(100, 1)).toBeCloseTo(102.5, 10);
  });

  it('marks the four non-identity formulas as unsafe for display', () => {
    for (const id of ['mayhew', 'wathan', 'lander', 'oconner'] as const) {
      expect(E1RM_FORMULA_META[id].identityAtOneRep, id).toBe(false);
      expect(E1RM_FORMULA_META[id].safeForDisplay, id).toBe(false);
    }
    for (const id of ['epley', 'brzycki', 'lombardi', 'wd', 'rts', 'blend'] as const) {
      expect(E1RM_FORMULA_META[id].identityAtOneRep, id).toBe(true);
      expect(E1RM_FORMULA_META[id].safeForDisplay, id).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Domain guards                                                                *
 * -------------------------------------------------------------------------- */

describe('domain guards', () => {
  it('guards Brzycki before it explodes at its pole', () => {
    expect(BRZYCKI_POLE_REPS).toBe(37);
    // Unguarded, 36 reps would return 36x the weight and 37 would divide by zero.
    expect(brzycki(100, 37)).toBeNull();
    expect(brzycki(100, 36)).toBeNull();
    expect(brzycki(100, 21)).toBeNull();
    expect(brzycki(100, 20)).not.toBeNull();
  });

  it('guards Lander before its pole at 37.9 reps', () => {
    // Lander is 1RM = 100w / (101.3 − 2.67123r), so the pole is exactly where
    // the denominator hits zero: r = 101.3 / 2.67123 = 37.92260494229250...
    // (check: 2.67123 × 37.9226049 = 101.3). The 37.9233 asserted here before
    // was not that quotient — the implementation was right, the test was not.
    expect(LANDER_POLE_REPS).toBeCloseTo(37.9226049, 7);
    expect(lander(100, 38)).toBeNull();
    expect(lander(100, 21)).toBeNull();
  });

  it('never returns a negative or infinite estimate anywhere in its domain', () => {
    const fns = [epley, brzycki, lander, lombardi, mayhew, oconner, wathan, weightDependent];
    for (const fn of fns) {
      for (let reps = 1; reps <= 30; reps += 0.5) {
        const value = fn(100, reps);
        if (value === null) continue;
        expect(Number.isFinite(value), `${fn.name} @ ${reps}`).toBe(true);
        expect(value, `${fn.name} @ ${reps}`).toBeGreaterThan(0);
      }
    }
  });

  it('rejects zero, negative and non-finite input', () => {
    const fns = [epley, brzycki, lander, lombardi, mayhew, oconner, wathan, weightDependent];
    for (const fn of fns) {
      expect(fn(0, 5), fn.name).toBeNull();
      expect(fn(-100, 5), fn.name).toBeNull();
      expect(fn(100, 0), fn.name).toBeNull();
      expect(fn(100, -3), fn.name).toBeNull();
      expect(fn(Number.NaN, 5), fn.name).toBeNull();
      expect(fn(100, Number.POSITIVE_INFINITY), fn.name).toBeNull();
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The weight-dependent equation                                                *
 * -------------------------------------------------------------------------- */

describe('weight-dependent equation (arXiv:2603.17495)', () => {
  it('reproduces the published k(w) values exactly', () => {
    expect(wdK(10)).toBeCloseTo(8.0, 2);
    expect(wdK(15)).toBeCloseTo(9.85, 2);
    expect(wdK(25)).toBeCloseTo(12.19, 2);
    expect(wdK(55)).toBeCloseTo(15.8, 2);
    expect(wdK(70)).toBeCloseTo(16.91, 2);
    expect(wdK(80)).toBeCloseTo(17.52, 2);
    expect(wdK(150)).toBeCloseTo(20.4, 2);
  });

  it('reproduces the published worked example: 13 kg curl x 10 reps', () => {
    // Brzycki 17.3 kg; weight-dependent 22.1 kg. The 4.8 kg gap is the entire
    // argument for a load-dependent k on light isolation work.
    expect(round1(brzycki(13, 10))).toBe(17.3);
    expect(round1(weightDependent(13, 10))).toBe(22.1);
  });

  it('floors k so light loads cannot blow the equation up', () => {
    expect(wdK(0.001)).toBe(0.5);
    expect(wdK(1e-9)).toBe(0.5);
    const tiny = weightDependent(0.5, 8);
    expect(tiny).not.toBeNull();
    expect(Number.isFinite(tiny ?? Number.NaN)).toBe(true);
  });

  it('is monotonic in reps and in load', () => {
    for (let reps = 2; reps <= 12; reps += 1) {
      const lower = weightDependent(100, reps - 1);
      const higher = weightDependent(100, reps);
      expect(lower).not.toBeNull();
      expect(higher).not.toBeNull();
      if (lower === null || higher === null) continue;
      expect(higher).toBeGreaterThan(lower);
    }
  });

  it('accepts an explicit k for a calibrated lifter', () => {
    expect(e1rmWithK(60, 5, 12)).toBeCloseTo(60 * (1 + Math.pow(4, 0.85) / 12), 10);
    expect(e1rmWithK(60, 1, 12)).toBe(60);
    expect(e1rmWithK(60, 5, 0)).toBeCloseTo(60 * (1 + Math.pow(4, 0.85) / 0.5), 10);
  });
});

/* -------------------------------------------------------------------------- *
 * TABLE B — the RPE chart, generated from ten numbers                          *
 * -------------------------------------------------------------------------- */

describe('TABLE B: the RTS RPE chart', () => {
  const EXPECTED: Record<string, (number | null)[]> = {
    'RPE 10': [100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9],
    'RPE 9.5': [97.8, 93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, null],
    'RPE 9': [95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, null],
    'RPE 8.5': [93.9, 90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, null, null],
    'RPE 8': [92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, null, null],
    'RPE 7.5': [90.7, 87.8, 85.0, 82.4, 79.9, 77.4, 75.1, null, null, null],
    'RPE 7': [89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, null, null, null],
    'RPE 6.5': [87.8, 85.0, 82.4, 79.9, 77.4, 75.1, null, null, null, null],
    'RPE 6': [86.3, 83.7, 81.1, 78.6, 76.2, 73.9, null, null, null, null],
  };

  it('generates all 90 cells from the ten stored numbers', () => {
    expect(buildRpeChart()).toEqual(EXPECTED);
  });

  it('stores ten numbers, not ninety', () => {
    expect(RTS_PCT_BY_REPS_TO_FAILURE).toEqual([
      100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9,
    ]);
  });

  it('proves the grid is one curve: RPE 9 @ r === RPE 10 @ r+1, in every cell', () => {
    for (let reps = 1; reps <= 9; reps += 1) {
      expect(rtsPercent(reps, 9), `reps ${reps}`).toBe(rtsPercent(reps + 1, 10));
    }
  });

  it('interpolates half-RPE values: RPE 9.5 for a single is 97.75%', () => {
    expect(rtsPercent(1, 9.5)).toBeCloseTo(97.75, 10);
    expect(round1(rtsPercent(1, 9.5))).toBe(97.8);
  });

  it('rejects the fake linear chart circulating on calculator sites', () => {
    // fitnesscalcs.com and friends publish a flat 2.5%-per-step grid that puts
    // 5 reps @ RPE 8 at 80.0% and 10 reps @ RPE 10 at 77.5%. Both are wrong.
    expect(rtsPercent(5, 8)).toBe(81.1);
    expect(rtsPercent(5, 8)).not.toBe(80.0);
    expect(rtsPercent(10, 10)).toBe(73.9);
    expect(rtsPercent(10, 10)).not.toBe(77.5);
  });

  it('returns null off the published table rather than extrapolating', () => {
    expect(rtsPercent(11, 10)).toBeNull();
    expect(rtsPercent(7, 6)).toBeNull();
    expect(rtsPercent(5, 5.5)).toBeNull();
    expect(rtsPercent(5, 10.5)).toBeNull();
    expect(rtsPercent(0, 10)).toBeNull();
    expect(rtsPercentForRepsToFailure(0)).toBeNull();
    expect(rtsPercentForRepsToFailure(10.5)).toBeNull();
  });

  it('converts RPE to RIR and back', () => {
    expect(rpeToRir(8)).toBe(2);
    expect(rpeToRir(10)).toBe(0);
    expect(rirToRpe(2)).toBe(8);
    expect(rirToRpe(0)).toBe(10);
  });

  it('produces an e1RM from the chart', () => {
    // 100 kg x 5 reps @ RPE 8 is 81.1% of max -> 123.3 kg.
    expect(rtsE1rm(100, 5, 8)).toBeCloseTo(123.305, 3);
    expect(rtsE1rm(100, 1, 10)).toBe(100);
    expect(rtsE1rm(0, 5, 8)).toBeNull();
    expect(rtsE1rm(100, 11, 10)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- *
 * TABLE C — the Nuzzo 2024 reality check                                       *
 * -------------------------------------------------------------------------- */

describe('TABLE C: every formula runs hot at high reps (Nuzzo 2024)', () => {
  const ANCHORS: readonly (readonly [
    label: string,
    pct: number,
    reps: number,
    epley: number,
    brzycki: number,
    wd: number,
  ])[] = [
    ['90% x 4 reps', 90, 4, 102.0, 98.2, 102.7],
    ['80% x 9 reps', 80, 9, 104.0, 102.9, 106.7],
    ['70% x 14 reps', 70, 14, 102.7, 109.6, 106.6],
  ];

  it.each(ANCHORS)('%s', (_label, pct, reps, expectedEpley, expectedBrzycki, expectedWd) => {
    expect(round1(epley(pct, reps))).toBe(expectedEpley);
    expect(round1(brzycki(pct, reps))).toBe(expectedBrzycki);
    expect(round1(weightDependent(pct, reps))).toBe(expectedWd);
  });

  it('is within 3% of truth at 4 reps and badly wrong at 14', () => {
    expect(Math.abs((brzycki(90, 4) ?? 0) - 100)).toBeLessThan(3);
    expect(Math.abs((brzycki(70, 14) ?? 0) - 100)).toBeGreaterThan(9);
  });
});

/* -------------------------------------------------------------------------- *
 * The recommended blended estimator                                            *
 * -------------------------------------------------------------------------- */

describe('the load-dependent blend', () => {
  it('cross-fades exactly as specified: 0% under 40 kg, 36% at 100 kg, capped at 60%', () => {
    expect(rtsBlendWeight(0)).toBe(0);
    expect(rtsBlendWeight(20)).toBe(0);
    expect(rtsBlendWeight(40)).toBe(0);
    expect(rtsBlendWeight(100)).toBeCloseTo(0.36, 10);
    expect(rtsBlendWeight(140)).toBeCloseTo(0.6, 10);
    expect(rtsBlendWeight(300)).toBe(0.6);
  });

  it('is pure WD on a light isolation lift', () => {
    expect(blendedE1rm(20, 8)).toBe(weightDependent(20, 8));
  });

  it('mixes WD and RTS at 100 kg', () => {
    const wd = weightDependent(100, 7);
    const rts = rtsE1rm(100, 5, 8); // 5 reps @ RPE 8 === 7 reps to failure
    expect(wd).toBeCloseTo(124.733, 3);
    expect(rts).toBeCloseTo(123.305, 3);
    expect(blendedE1rm(100, 7)).toBeCloseTo(0.64 * 124.73315 + 0.36 * 123.30456, 3);
    expect(blendedE1rm(100, 7)).toBeCloseTo(124.219, 3);
  });

  it('falls back to pure WD past the end of the RTS chart', () => {
    expect(blendedE1rm(100, 11)).toBe(weightDependent(100, 11));
    expect(blendedE1rm(100, 12)).toBe(weightDependent(100, 12));
  });

  it('is an identity at one rep at every load', () => {
    for (const load of [10, 40, 100, 200]) {
      expect(blendedE1rm(load, 1), `${load} kg`).toBe(load);
    }
  });

  it('returns null outside its domain', () => {
    expect(blendedE1rm(0, 5)).toBeNull();
    expect(blendedE1rm(100, 0)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- *
 * The set-level pipeline                                                       *
 * -------------------------------------------------------------------------- */

describe('resolving proximity to failure', () => {
  it('prefers an explicit RIR, then an explicit RPE', () => {
    expect(resolveRir(set({ rirObserved: 1, rpe: 8 }))).toEqual({
      rir: 1,
      confidence: 1,
      source: 'explicitRir',
    });
    expect(resolveRir(set({ rpe: 8 }))).toEqual({
      rir: 2,
      confidence: 1,
      source: 'explicitRpe',
    });
  });

  it('treats an AMRAP or failure flag as RIR 0 at 0.85 confidence', () => {
    expect(resolveRir(set({ setType: 'amrap' }))).toEqual({
      rir: 0,
      confidence: 0.85,
      source: 'amrapFlag',
    });
    expect(resolveRir(set({ setType: 'failure' }))).toEqual({
      rir: 0,
      confidence: 0.85,
      source: 'amrapFlag',
    });
  });

  it('treats a fatigue-detected set as RIR 0.5 at 0.7 confidence', () => {
    expect(resolveRir(set({ fatigueDetected: true }))).toEqual({
      rir: 0.5,
      confidence: 0.7,
      source: 'fatigueDetected',
    });
  });

  it('falls back to a conservative set-type prior at 0.45 confidence', () => {
    expect(resolveRir(set())).toEqual({ rir: 2, confidence: 0.45, source: 'prior' });
    expect(resolveRir(set({ setType: 'dropset' })).rir).toBe(1);
    expect(resolveRir(set({ setType: 'cluster' })).rir).toBe(1);
    expect(resolveRir(set({ setType: 'myorep' })).rir).toBe(0);
    expect(DEFAULT_RIR_PRIOR.normal).toBe(2);
    expect(RIR_SOURCE_CONFIDENCE.prior).toBe(0.45);
  });

  it('never returns a negative RIR, even from an over-reported RPE', () => {
    expect(resolveRir(set({ rpe: 11 })).rir).toBe(0);
    expect(resolveRir(set({ rirObserved: -2 })).rir).toBe(0);
  });

  it('personalises the prior by shrinking the lifter\'s own median toward it', () => {
    expect(personalisedRirPrior('normal', [])).toBe(2);
    // 8 observations of RIR 0 against a prior of 2 -> exactly halfway.
    expect(personalisedRirPrior('normal', [0, 0, 0, 0, 0, 0, 0, 0])).toBeCloseTo(1, 10);
    // 24 observations -> the lifter's own data carries 75%.
    const many = Array.from({ length: 24 }, () => 0);
    expect(personalisedRirPrior('normal', many)).toBeCloseTo(0.5, 10);
  });
});

describe('estimateSetE1rm', () => {
  it('estimates 5 reps @ 100 kg at RPE 8 as 7 reps to failure', () => {
    const sample = estimateSetE1rm(set({ rpe: 8 }));
    expect(sample).not.toBeNull();
    if (sample === null) return;
    expect(sample.repsToFailure).toBe(7);
    expect(sample.method).toBe('blend');
    expect(sample.rirSource).toBe('explicitRpe');
    expect(sample.e1rmKg).toBeCloseTo(124.219, 3);
    // Confidence: explicit RPE (1.0) tapered by the rep penalty at n = 7.
    expect(sample.confidence).toBeCloseTo(0.82, 10);
  });

  it('estimates the same reps-to-failure from a blank RPE, at much lower confidence', () => {
    const sample = estimateSetE1rm(set({ rpe: null }));
    expect(sample).not.toBeNull();
    if (sample === null) return;
    expect(sample.repsToFailure).toBe(7);
    expect(sample.e1rmKg).toBeCloseTo(124.219, 3);
    // 0.45 (prior) x 0.82 (rep taper) = 0.369, per the research brief.
    expect(sample.confidence).toBeCloseTo(0.369, 10);
  });

  it('estimates a set taken to failure as 5 reps to failure', () => {
    const sample = estimateSetE1rm(set({ setType: 'failure' }));
    expect(sample).not.toBeNull();
    if (sample === null) return;
    expect(sample.repsToFailure).toBe(5);
    expect(sample.e1rmKg).toBeCloseTo(116.929, 3);
    expect(sample.confidence).toBeCloseTo(0.85 * 0.91, 10);
  });

  it('applies the rep confidence taper as specified', () => {
    expect(repConfidencePenalty(1)).toBe(1);
    expect(repConfidencePenalty(3)).toBe(1);
    expect(repConfidencePenalty(7)).toBeCloseTo(0.82, 10);
    expect(repConfidencePenalty(12)).toBeCloseTo(0.595, 10);
    expect(repConfidencePenalty(40)).toBeCloseTo(0.55, 10);
  });

  it('refuses sets that cannot support an estimate', () => {
    expect(estimateSetE1rm(set({ completed: false }))).toBeNull();
    expect(estimateSetE1rm(set({ setType: 'warmup' }))).toBeNull();
    expect(estimateSetE1rm(set({ reps: 0 }))).toBeNull();
    expect(estimateSetE1rm(set({ reps: 31 }))).toBeNull();
    expect(estimateSetE1rm(set({ weightKg: 0 }))).toBeNull();
    // 5 reps in reserve says nothing about a maximum.
    expect(estimateSetE1rm(set({ rpe: 5 }))).toBeNull();
    expect(estimateSetE1rm(set({ rirObserved: E1RM_MAX_RIR + 0.5 }))).toBeNull();
    // 11 reps + 2 RIR = 13 reps to failure, past the hard cap of 12.
    expect(estimateSetE1rm(set({ reps: 11 }))).toBeNull();
    expect(estimateSetE1rm(set({ reps: 10 }))).not.toBeNull();
  });

  it('uses the system load for a bodyweight exercise, not the added weight', () => {
    const pullUp = set({ exerciseId: 'pull-up', weightKg: 0, reps: 5, rpe: 9 });
    expect(estimateSetE1rm(pullUp)).toBeNull(); // 0 kg external load alone is nothing
    const sample = estimateSetE1rm(pullUp, { totalLoadKg: 80 });
    expect(sample).not.toBeNull();
    if (sample === null) return;
    expect(sample.loadKg).toBe(80);
    expect(sample.repsToFailure).toBe(6);
  });

  it('honours an explicit formula choice', () => {
    const sample = estimateSetE1rm(set({ rpe: 10 }), { formula: 'brzycki' });
    expect(sample?.method).toBe('brzycki');
    expect(sample?.e1rmKg).toBeCloseTo(112.5, 10);
  });

  it('falls back to WD when the chosen formula runs off its table', () => {
    // 10 reps + 2 RIR = 12 reps to failure; the RTS chart stops at 10.
    const sample = estimateSetE1rm(set({ reps: 10, rpe: null }), { formula: 'rts' });
    expect(sample).not.toBeNull();
    expect(sample?.method).toBe('wd');
    expect(sample?.e1rmKg).toBe(weightDependent(100, 12));
  });

  it('uses a calibrated k when one is supplied', () => {
    const sample = estimateSetE1rm(set({ rpe: 10 }), { calibratedK: 12 });
    expect(sample?.method).toBe('wd');
    expect(sample?.e1rmKg).toBe(e1rmWithK(100, 5, 12));
  });

  it('honours an overridden RIR prior', () => {
    const sample = estimateSetE1rm(set({ rpe: null }), { rirPrior: 0 });
    expect(sample?.repsToFailure).toBe(5);
  });
});

/* -------------------------------------------------------------------------- *
 * Per-user, per-exercise k calibration                                         *
 * -------------------------------------------------------------------------- */

describe('calibrateK', () => {
  /** A lifter whose true k is 12 on a lift around 60 kg, per the research brief. */
  function simulate(trueK: number, oneRepMax: number, repsToFailure: readonly number[]) {
    return repsToFailure.map((n) => ({
      weightKg: oneRepMax / (1 + Math.pow(n - 1, 0.85) / trueK),
      repsToFailure: n,
    }));
  }

  it('recovers a simulated true k of 12 from six near-failure sets', () => {
    const sets = simulate(12, 80, [3, 4, 5, 6, 8, 10]);
    const result = calibrateK(sets);
    expect(result.n).toBe(6);
    expect(result.rawK).not.toBeNull();
    expect(result.rawK ?? 0).toBeGreaterThan(11.5);
    expect(result.rawK ?? 0).toBeLessThan(12.5);
  });

  it('shrinks toward the population prior and still beats it', () => {
    const sets = simulate(12, 80, [3, 4, 5, 6, 8, 10]);
    const result = calibrateK(sets);
    expect(Math.abs(result.k - 12)).toBeLessThan(Math.abs(result.priorK - 12));
    // 6 sets against a prior strength of 8: the prior still carries most weight.
    expect(result.shrunk).toBe(true);
    expect(result.k).toBeGreaterThan(Math.min(12, result.priorK));
    expect(result.k).toBeLessThan(Math.max(12, result.priorK));
  });

  it('shrinks less as evidence accumulates', () => {
    const few = calibrateK(simulate(12, 80, [3, 5, 8]));
    const many = calibrateK(simulate(12, 80, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    expect(Math.abs(many.k - 12)).toBeLessThan(Math.abs(few.k - 12));
    expect(many.shrunk).toBe(false);
  });

  it('returns the population prior untouched when there is not enough data', () => {
    const result = calibrateK([{ weightKg: 60, repsToFailure: 5 }]);
    expect(result.rawK).toBeNull();
    expect(result.k).toBe(wdK(60));
    expect(result.n).toBe(1);
    expect(result.shrunk).toBe(true);
  });

  it('ignores singles, over-long sets and garbage loads', () => {
    const result = calibrateK([
      { weightKg: 60, repsToFailure: 1 },
      { weightKg: 60, repsToFailure: 20 },
      { weightKg: 0, repsToFailure: 5 },
      { weightKg: 60, repsToFailure: 4 },
      { weightKg: 55, repsToFailure: 6 },
      { weightKg: 50, repsToFailure: 8 },
    ]);
    expect(result.n).toBe(3);
  });

  it('gives a grinder a lower k than an endurance lifter', () => {
    // Reps fall off a cliff: each extra rep costs a lot of load -> low k.
    const grinder = calibrateK(simulate(6, 100, [2, 3, 4, 5, 6, 8]));
    // Can rep out near max: each extra rep costs little -> high k.
    const enduring = calibrateK(simulate(30, 100, [2, 3, 4, 5, 6, 8]));
    expect(grinder.rawK ?? 0).toBeLessThan(enduring.rawK ?? 0);
    expect(grinder.k).toBeLessThan(enduring.k);
  });
});
