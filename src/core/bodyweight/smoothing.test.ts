import { describe, expect, it } from 'vitest';

import {
  DAILY_ALPHA,
  EQUIVALENT_SMA_DAYS,
  HALF_LIFE_DAYS,
  HUBER_K,
  MAD_TO_SIGMA,
  TAU_DAYS,
  WITHIN_WEEK_FLUCTUATION_FRACTION,
  latestTrendKg,
  median,
  medianAbsoluteDeviation,
  robustScaleKg,
  smoothWeightSeries,
  smoothingPower,
  trendAtInstant,
} from './smoothing';
import { MS_PER_DAY, type WeightEntry } from './types';

const START = Date.UTC(2025, 0, 1, 7, 0, 0);

/** Daily weigh-ins starting at START, one per day at the same time of day. */
function daily(weights: readonly number[], startAt = START): WeightEntry[] {
  return weights.map((kg, index) => ({ at: startAt + index * MS_PER_DAY, kg }));
}

function repeat(value: number, count: number): number[] {
  return Array.from({ length: count }, () => value);
}

describe('constants match the Hacker’s Diet / fourmilab figures', () => {
  it('reproduces alpha = 1 - e^(-0.1) = 0.09516 at tau = 10 days', () => {
    expect(TAU_DAYS).toBe(10);
    expect(DAILY_ALPHA).toBeCloseTo(0.0951626, 7);
  });

  it("is within half a percentage point of Walker's 'one tenth of the difference'", () => {
    expect(Math.abs(DAILY_ALPHA - 0.1)).toBeLessThan(0.005);
  });

  it('is equivalent to a ~20-day simple moving average (N = 2/alpha - 1)', () => {
    expect(EQUIVALENT_SMA_DAYS).toBeCloseTo(20.02, 2);
  });

  it('has a half-life of 6.93 days', () => {
    expect(HALF_LIFE_DAYS).toBeCloseTo(6.931, 3);
  });

  it('uses the standard Huber constant and the PLOS ONE 0.35% fluctuation floor', () => {
    expect(HUBER_K).toBe(1.345);
    expect(WITHIN_WEEK_FLUCTUATION_FRACTION).toBe(0.0035);
    expect(MAD_TO_SIGMA).toBe(1.4826);
  });
});

describe('smoothingPower', () => {
  it('is alpha at one day', () => {
    expect(smoothingPower(1)).toBeCloseTo(DAILY_ALPHA, 12);
  });

  it('is 1 - 1/e after a gap of exactly tau days', () => {
    expect(smoothingPower(10)).toBeCloseTo(0.6321206, 7);
  });

  it('approaches but never reaches 1 for very long gaps', () => {
    expect(smoothingPower(365)).toBeGreaterThan(0.99);
    expect(smoothingPower(365)).toBeLessThan(1);
  });

  it('is 0 for a zero, negative or non-finite gap, so the trend cannot move', () => {
    expect(smoothingPower(0)).toBe(0);
    expect(smoothingPower(-3)).toBe(0);
    expect(smoothingPower(Number.NaN)).toBe(0);
  });
});

describe('median / MAD / robust scale', () => {
  it('returns undefined rather than 0 for an empty sample', () => {
    expect(median([])).toBeUndefined();
    expect(medianAbsoluteDeviation([])).toBeUndefined();
  });

  it('averages the middle pair for an even sample', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([5])).toBe(5);
  });

  it('is not moved by a single extreme value', () => {
    expect(median([1, 2, 3, 4, 1000])).toBe(3);
    expect(medianAbsoluteDeviation([1, 2, 3, 4, 1000])).toBe(1);
  });

  it('floors the scale at 0.35% of bodyweight when readings are implausibly steady', () => {
    expect(robustScaleKg(repeat(0, 10), 80)).toBeCloseTo(0.28, 10);
  });

  it('uses 1.4826 * MAD once real variability exists', () => {
    const residuals = [-1, -0.5, 0, 0.5, 1];
    expect(robustScaleKg(residuals, 80)).toBeCloseTo(0.5 * MAD_TO_SIGMA, 10);
  });
});

describe('smoothWeightSeries', () => {
  it('returns nothing for no entries', () => {
    expect(smoothWeightSeries([])).toEqual([]);
    expect(latestTrendKg([])).toBeUndefined();
  });

  it('seeds the trend exactly on the first entry, with no warm-up artefact', () => {
    const series = smoothWeightSeries(daily([82.4]));
    expect(series).toHaveLength(1);
    expect(series[0]?.trendKg).toBe(82.4);
    expect(series[0]?.residualKg).toBe(0);
    expect(series[0]?.deltaDays).toBe(0);
    expect(series[0]?.gateFactor).toBe(1);
  });

  it('holds a constant weight exactly constant', () => {
    const series = smoothWeightSeries(daily(repeat(80, 30)));
    expect(latestTrendKg(series)).toBeCloseTo(80, 10);
  });

  it('does not move anything like 2 kg for a single 2 kg spike', () => {
    const series = smoothWeightSeries(daily([...repeat(80, 20), 82]));
    const trend = latestTrendKg(series) ?? Number.NaN;
    // Gate: sigma floors at 0.35% * 80 = 0.28 kg, limit = 1.345 * 0.28 = 0.3766,
    // so the applied residual is 0.3766 and the trend moves 0.09516 * 0.3766.
    expect(trend - 80).toBeCloseTo(0.0358, 3);
    expect(trend - 80).toBeLessThan(0.1);
  });

  it('would move 0.19 kg for that same spike with the gate switched off', () => {
    const series = smoothWeightSeries(daily([...repeat(80, 20), 82]), { gateOutliers: false });
    expect((latestTrendKg(series) ?? 0) - 80).toBeCloseTo(2 * DAILY_ALPHA, 6);
  });

  it('flags the spike as an outlier and leaves the raw reading untouched', () => {
    const series = smoothWeightSeries(daily([...repeat(80, 20), 82]));
    const spike = series[series.length - 1];
    expect(spike?.kg).toBe(82);
    expect(spike?.isOutlier).toBe(true);
    expect(spike?.gateFactor).toBeGreaterThan(0);
    expect(spike?.gateFactor).toBeLessThan(1);
    expect(series[10]?.isOutlier).toBe(false);
  });

  it('recovers within a fortnight of a one-off spike', () => {
    const series = smoothWeightSeries(daily([...repeat(80, 20), 82, ...repeat(80, 14)]));
    expect(latestTrendKg(series)).toBeCloseTo(80, 1);
  });

  it('does not damp a genuine steady loss, only noise', () => {
    const ramp = Array.from({ length: 60 }, (_, index) => 90 - 0.1 * index);
    const series = smoothWeightSeries(daily(ramp));
    const gated = series.filter((point) => point.isOutlier);
    expect(gated).toHaveLength(0);
    // The trend tracks the ramp, sitting the expected lag above it: a
    // first-order filter trailing a ramp settles r*tau behind, which for
    // 0.1 kg/day sampled daily is 0.1 * (1 - alpha)/alpha = 0.951 kg.
    const last = series[series.length - 1];
    expect((last?.trendKg ?? 0) - (last?.kg ?? 0)).toBeCloseTo(0.951, 2);
  });

  it('steps appropriately after a ten-day gap instead of crawling', () => {
    const entries: WeightEntry[] = [
      { at: START, kg: 80 },
      { at: START + 10 * MS_PER_DAY, kg: 90 },
    ];
    // 1 - e^(-10/10) = 0.63212 of the 10 kg difference.
    expect(latestTrendKg(smoothWeightSeries(entries))).toBeCloseTo(86.3212, 4);
  });

  it('moves less over one day than over ten, for the same difference', () => {
    const oneDay = smoothWeightSeries([
      { at: START, kg: 80 },
      { at: START + MS_PER_DAY, kg: 90 },
    ]);
    const tenDays = smoothWeightSeries([
      { at: START, kg: 80 },
      { at: START + 10 * MS_PER_DAY, kg: 90 },
    ]);
    expect(latestTrendKg(oneDay) ?? 0).toBeLessThan(latestTrendKg(tenDays) ?? 0);
    expect(latestTrendKg(oneDay)).toBeCloseTo(80 + 10 * DAILY_ALPHA, 6);
  });

  it('cannot move the trend on a second reading at the same instant', () => {
    const series = smoothWeightSeries([
      { at: START, kg: 80 },
      { at: START, kg: 84 },
    ]);
    expect(series).toHaveLength(2);
    expect(series[1]?.trendKg).toBe(80);
    expect(series[1]?.deltaDays).toBe(0);
  });

  it('sorts unsorted input before smoothing', () => {
    const ascending = smoothWeightSeries(daily([80, 81, 82]));
    const shuffled = smoothWeightSeries([
      { at: START + 2 * MS_PER_DAY, kg: 82 },
      { at: START, kg: 80 },
      { at: START + MS_PER_DAY, kg: 81 },
    ]);
    expect(shuffled.map((point) => point.trendKg)).toEqual(
      ascending.map((point) => point.trendKg),
    );
  });

  it('drops unusable rows rather than poisoning the trend', () => {
    const series = smoothWeightSeries([
      { at: START, kg: 80 },
      { at: START + MS_PER_DAY, kg: 0 },
      { at: START + 2 * MS_PER_DAY, kg: -5 },
      { at: START + 3 * MS_PER_DAY, kg: Number.NaN },
      { at: Number.NaN, kg: 81 },
      { at: START + 4 * MS_PER_DAY, kg: 81 },
    ]);
    expect(series).toHaveLength(2);
    expect(latestTrendKg(series)).toBeGreaterThan(80);
    expect(latestTrendKg(series)).toBeLessThan(81);
  });

  it('suppresses day-to-day water noise (6:1 noise-to-signal, per Walker)', () => {
    const noisy = Array.from({ length: 40 }, (_, index) => 80 + (index % 2 === 0 ? 0.9 : -0.9));
    const series = smoothWeightSeries(daily(noisy));
    const trends = series.slice(20).map((point) => point.trendKg);
    for (const value of trends) expect(Math.abs(value - 80)).toBeLessThan(0.2);
  });

  it('respects a caller-supplied time constant', () => {
    const fast = smoothWeightSeries(daily([80, 90]), { tauDays: 1 });
    const slow = smoothWeightSeries(daily([80, 90]), { tauDays: 30 });
    expect(latestTrendKg(fast) ?? 0).toBeGreaterThan(latestTrendKg(slow) ?? 0);
  });
});

describe('trendAtInstant', () => {
  const series = smoothWeightSeries(daily([80, 81, 82]));

  it('is undefined for an empty series', () => {
    expect(trendAtInstant([], START)).toBeUndefined();
  });

  it('clamps outside the series instead of extrapolating', () => {
    expect(trendAtInstant(series, START - 100 * MS_PER_DAY)).toBe(80);
    expect(trendAtInstant(series, START + 100 * MS_PER_DAY)).toBe(
      series[series.length - 1]?.trendKg,
    );
  });

  it('interpolates linearly between weigh-ins', () => {
    const left = series[0]?.trendKg ?? 0;
    const right = series[1]?.trendKg ?? 0;
    expect(trendAtInstant(series, START + MS_PER_DAY / 2)).toBeCloseTo((left + right) / 2, 10);
  });

  it('hits the stored value exactly on a weigh-in instant', () => {
    expect(trendAtInstant(series, START + MS_PER_DAY)).toBe(series[1]?.trendKg);
  });
});
