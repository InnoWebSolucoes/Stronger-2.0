import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROM_M,
  DEFAULT_TEMPO_SEC,
  ECCENTRIC_FACTOR,
  FOOD_KCAL,
  G,
  GROSS_EFFICIENCY,
  HEIGHTS_M,
  MIN_BAR_DISTANCE_M,
  REFERENCE_HEIGHT_CM,
  ROM_BY_PATTERN,
  STEP_COUNTS,
  STEP_RISE_M,
  barDistanceM,
  bodyweightMultiples,
  climbsOf,
  estimatedKcal,
  heightClimbedM,
  mechanicalWorkJ,
  pickFoodComparison,
  pickHeightComparison,
  romForPattern,
  tensionRatio,
  timeUnderTensionSec,
  type FramingSet,
} from './framings';

/** A representative 25-set session: squats, bench, rows, curls. */
const SESSION: FramingSet[] = [
  ...Array.from({ length: 5 }, () => ({ pattern: 'back-squat', reps: 5, weightKg: 140 })),
  ...Array.from({ length: 5 }, () => ({ pattern: 'bench-press', reps: 8, weightKg: 90 })),
  ...Array.from({ length: 5 }, () => ({ pattern: 'barbell-row', reps: 10, weightKg: 70 })),
  ...Array.from({ length: 5 }, () => ({ pattern: 'lat-pulldown', reps: 10, weightKg: 60 })),
  ...Array.from({ length: 5 }, () => ({ pattern: 'bicep-curl', reps: 12, weightKg: 30 })),
];

describe('ranges of motion', () => {
  it('uses the researched values at the reference height', () => {
    expect(ROM_BY_PATTERN['back-squat']).toBe(0.58);
    expect(ROM_BY_PATTERN['bench-press']).toBe(0.4);
    expect(ROM_BY_PATTERN['deadlift']).toBe(0.55);
    expect(ROM_BY_PATTERN['calf-raise']).toBe(0.14);
    expect(DEFAULT_ROM_M).toBe(0.45);
    expect(REFERENCE_HEIGHT_CM).toBe(175);
  });

  it('falls back to the default for an unknown pattern', () => {
    expect(romForPattern('cable-woodchop')).toBe(DEFAULT_ROM_M);
  });

  it('scales linearly with lifter height', () => {
    expect(romForPattern('back-squat', 200)).toBeCloseTo(0.58 * (200 / 175), 10);
    expect(romForPattern('back-squat', 175)).toBeCloseTo(0.58, 10);
    expect(romForPattern('back-squat', 0)).toBeCloseTo(0.58, 10); // bad input falls back to reference
    expect(romForPattern('back-squat', Number.NaN)).toBeCloseTo(0.58, 10);
  });
});

describe('barDistanceM', () => {
  it('sums reps times range of motion, both phases by default', () => {
    const concentric = barDistanceM(SESSION, 175, false);
    // 25*0.58 + 40*0.40 + 50*0.42 + 50*0.60 + 60*0.50 = 14.5 + 16 + 21 + 30 + 30
    expect(concentric).toBeCloseTo(111.5, 6);
    expect(barDistanceM(SESSION)).toBeCloseTo(223, 6);
  });

  it('lands in the range the research predicts for a 25-set session', () => {
    expect(barDistanceM(SESSION)).toBeGreaterThan(MIN_BAR_DISTANCE_M);
    expect(barDistanceM(SESSION)).toBeGreaterThan(100);
    expect(barDistanceM(SESSION)).toBeLessThan(400);
  });

  it('handles an empty session and junk rep counts', () => {
    expect(barDistanceM([])).toBe(0);
    expect(barDistanceM([{ pattern: 'back-squat', reps: 0 }])).toBe(0);
    expect(barDistanceM([{ pattern: 'back-squat', reps: -5 }])).toBe(0);
    expect(barDistanceM([{ pattern: 'back-squat', reps: Number.NaN }])).toBe(0);
  });
});

describe('pickHeightComparison', () => {
  it('prefers a landmark the session nearly reached', () => {
    const near = pickHeightComparison(287); // research worked copy: "almost the Eiffel Tower"
    expect(near?.landmark.id).toBe('eiffel');
    expect(near?.isNearMiss).toBe(true);
    expect(near?.isWhole).toBe(false);
  });

  it('recognises a landmark reached outright', () => {
    const whole = pickHeightComparison(93);
    expect(whole?.landmark.id).toBe('liberty');
    expect(whole?.isWhole).toBe(true);
  });

  it('prefers the tallest landmark rather than a huge count of small ones', () => {
    const tall = pickHeightComparison(200);
    expect(tall?.landmark.id).toBe('pyramid');
    expect(tall?.count).toBeCloseTo(200 / 138.5, 6);
  });

  it('returns null when nothing is close enough to be worth saying', () => {
    expect(pickHeightComparison(2)).toBeNull();
    expect(pickHeightComparison(0)).toBeNull();
    expect(pickHeightComparison(-10)).toBeNull();
    expect(pickHeightComparison(Number.NaN)).toBeNull();
  });

  it('uses the verified landmark heights', () => {
    const byId = new Map(HEIGHTS_M.map((h) => [h.id, h.m]));
    expect(byId.get('liberty')).toBe(93);
    expect(byId.get('eiffel')).toBe(330);
    expect(byId.get('empire-state')).toBe(443.2);
    expect(byId.get('burj')).toBe(828);
    expect(byId.get('everest')).toBe(8848.86);
    expect(byId.get('karman')).toBe(100_000);
  });
});

describe('mechanical work', () => {
  it('is mass times gravity times range of motion, per rep', () => {
    const work = mechanicalWorkJ([{ pattern: 'back-squat', reps: 10, weightKg: 100 }]);
    expect(work).toBeCloseTo(10 * 100 * G * 0.58, 6);
    expect(work).toBeCloseTo(5687.857, 3);
  });

  it('ignores sets with no recorded load', () => {
    expect(mechanicalWorkJ([{ pattern: 'back-squat', reps: 10 }])).toBe(0);
    expect(mechanicalWorkJ([{ pattern: 'back-squat', reps: 10, weightKg: 0 }])).toBe(0);
  });

  it('converts to kcal with the 22% efficiency and 0.35 eccentric factor', () => {
    expect(GROSS_EFFICIENCY).toBe(0.22);
    expect(ECCENTRIC_FACTOR).toBe(0.35);
    const kcal = estimatedKcal(5687.857);
    expect(kcal).toBeCloseTo((5687.857 * 1.35) / 0.22 / 4184, 6);
    expect(kcal).toBeCloseTo(8.34, 2);
    expect(estimatedKcal(0)).toBe(0);
    expect(estimatedKcal(-1)).toBe(0);
  });

  it('gives a whole-session figure in a believable range', () => {
    const kcal = estimatedKcal(mechanicalWorkJ(SESSION));
    expect(kcal).toBeGreaterThan(50);
    expect(kcal).toBeLessThan(500);
  });
});

describe('food comparisons', () => {
  it('uses the researched kcal values', () => {
    const byId = new Map(FOOD_KCAL.map((f) => [f.id, f.kcal]));
    expect(byId.get('banana')).toBe(105);
    expect(byId.get('big-mac')).toBe(563);
    expect(byId.get('doughnut')).toBe(250);
  });

  it('picks the smallest sensible count', () => {
    expect(pickFoodComparison(600)?.food.id).toBe('big-mac');
    expect(pickFoodComparison(240)?.food.id).toBe('beer-pint');
    expect(pickFoodComparison(20)).toBeNull(); // below one square of chocolate
    expect(pickFoodComparison(0)).toBeNull();
  });
});

describe('time under tension', () => {
  it('uses the measured tempo where there is one and the default otherwise', () => {
    expect(DEFAULT_TEMPO_SEC).toBe(3.2);
    expect(timeUnderTensionSec([{ pattern: 'back-squat', reps: 10 }])).toBeCloseTo(32, 6);
    expect(
      timeUnderTensionSec([{ pattern: 'back-squat', reps: 10, tempoSec: 4 }]),
    ).toBeCloseTo(40, 6);
    expect(timeUnderTensionSec([])).toBe(0);
  });

  it('gives a ratio of the session actually spent under load', () => {
    const tut = timeUnderTensionSec(SESSION);
    expect(tut).toBeCloseTo(225 * 3.2, 6);
    const ratio = tensionRatio(tut, 42 * 60);
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.4);
  });

  it('never exceeds one or divides by zero', () => {
    expect(tensionRatio(100, 50)).toBe(1);
    expect(tensionRatio(100, 0)).toBe(0);
    expect(tensionRatio(0, 100)).toBe(0);
    expect(tensionRatio(Number.NaN, 100)).toBe(0);
  });
});

describe('bodyweight multiples', () => {
  it('divides volume by bodyweight, both in kg', () => {
    expect(bodyweightMultiples(18_420, 85)).toBeCloseTo(216.7, 1); // research worked copy: 216 times
    expect(bodyweightMultiples(500, 62)).toBeCloseTo(8.06, 2);
  });

  it('refuses unknown or impossible bodyweights', () => {
    expect(bodyweightMultiples(18_420, 0)).toBe(0);
    expect(bodyweightMultiples(18_420, -85)).toBe(0);
    expect(bodyweightMultiples(0, 85)).toBe(0);
    expect(bodyweightMultiples(Number.NaN, 85)).toBe(0);
  });
});

describe('height climbed', () => {
  it('uses the working stair riser of 0.17 m', () => {
    expect(STEP_RISE_M).toBe(0.17);
    expect(heightClimbedM(100)).toBeCloseTo(17, 10);
    expect(heightClimbedM(0)).toBe(0);
    expect(heightClimbedM(-20)).toBe(0);
  });

  it('counts climbs of the real landmark step counts', () => {
    const esb = STEP_COUNTS.find((c) => c.id === 'esb');
    expect(esb?.steps).toBe(1576);
    const eiffel = STEP_COUNTS.find((c) => c.id === 'eiffel');
    expect(eiffel?.steps).toBe(1665);
    if (esb === undefined) return;
    expect(climbsOf(3152, esb)).toBeCloseTo(2, 10);
    expect(climbsOf(0, esb)).toBe(0);
  });
});
