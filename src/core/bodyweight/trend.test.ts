import { describe, expect, it } from 'vitest';

import { smoothWeightSeries } from './smoothing';
import {
  MIN_POINTS_FOR_RATE,
  RATE_WINDOW_DAYS,
  lagCorrectedTrendKg,
  spacingWeights,
  tCritical95,
  weeklyRateKg,
  weightedLinearFit,
} from './trend';
import { MS_PER_DAY, type WeightEntry } from './types';

const START = Date.UTC(2025, 0, 1, 7, 0, 0);

function daily(weights: readonly number[], startAt = START): WeightEntry[] {
  return weights.map((kg, index) => ({ at: startAt + index * MS_PER_DAY, kg }));
}

/** A clean linear ramp of `kgPerDay` over `days` days, one weigh-in a day. */
function ramp(startKg: number, kgPerDay: number, days: number): WeightEntry[] {
  return daily(Array.from({ length: days }, (_, index) => startKg + kgPerDay * index));
}

describe('tCritical95', () => {
  it('uses the real small-sample table rather than 1.96 everywhere', () => {
    expect(tCritical95(1)).toBe(12.706);
    expect(tCritical95(2)).toBe(4.303);
    expect(tCritical95(10)).toBe(2.228);
    expect(tCritical95(30)).toBe(2.042);
  });

  it('falls back to the normal limit above df 30', () => {
    expect(tCritical95(31)).toBe(1.96);
    expect(tCritical95(1000)).toBe(1.96);
  });

  it('is infinite with no residual degrees of freedom', () => {
    expect(tCritical95(0)).toBe(Number.POSITIVE_INFINITY);
    expect(tCritical95(-1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('weightedLinearFit', () => {
  it('recovers a perfect line exactly, with zero error and r-squared 1', () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 100 - 0.25 * x, w: 1 }));
    const fit = weightedLinearFit(points);
    expect(fit?.slope).toBeCloseTo(-0.25, 12);
    expect(fit?.intercept).toBeCloseTo(100, 12);
    expect(fit?.rSquared).toBeCloseTo(1, 12);
    expect(fit?.slopeStandardError).toBeCloseTo(0, 12);
  });

  it('returns null with fewer than two usable points or no x-variance', () => {
    expect(weightedLinearFit([])).toBeNull();
    expect(weightedLinearFit([{ x: 1, y: 2, w: 1 }])).toBeNull();
    expect(
      weightedLinearFit([
        { x: 1, y: 2, w: 1 },
        { x: 1, y: 3, w: 1 },
      ]),
    ).toBeNull();
  });

  it('ignores zero-weight and non-finite points', () => {
    const fit = weightedLinearFit([
      { x: 0, y: 0, w: 1 },
      { x: 1, y: 1, w: 1 },
      { x: 2, y: 99, w: 0 },
      { x: 3, y: Number.NaN, w: 1 },
    ]);
    expect(fit?.count).toBe(2);
    expect(fit?.slope).toBeCloseTo(1, 12);
  });

  it('reduces to the unweighted standard error when all weights are equal', () => {
    const points = [
      { x: 0, y: 0, w: 3 },
      { x: 1, y: 1.1, w: 3 },
      { x: 2, y: 1.9, w: 3 },
      { x: 3, y: 3.1, w: 3 },
    ];
    const weighted = weightedLinearFit(points);
    const unweighted = weightedLinearFit(points.map((p) => ({ ...p, w: 1 })));
    expect(weighted?.slope).toBeCloseTo(unweighted?.slope ?? 0, 12);
    expect(weighted?.slopeStandardError ?? 0).toBeCloseTo(
      unweighted?.slopeStandardError ?? 0,
      12,
    );
  });
});

describe('spacingWeights', () => {
  it('gives interior points the full gap and the ends half of it', () => {
    expect(spacingWeights([0, 1, 2, 3])).toEqual([0.5, 1, 1, 0.5]);
  });

  it('handles empty and single-point inputs', () => {
    expect(spacingWeights([])).toEqual([]);
    expect(spacingWeights([5])).toEqual([1]);
  });

  it('stops a same-morning cluster from outvoting the rest of the month', () => {
    const cluster = [0, 0.01, 0.02, 0.03, 0.04, 0.05].map((x) => ({ x, y: 101 }));
    const spread = [7, 14, 21, 28].map((x) => ({ x, y: 100 - 0.1 * x }));
    const xs = [...cluster, ...spread].map((p) => p.x);
    const weights = spacingWeights(xs);

    const spaced = weightedLinearFit(
      [...cluster, ...spread].map((p, index) => ({ ...p, w: weights[index] ?? 1e-6 })),
    );
    const equal = weightedLinearFit([...cluster, ...spread].map((p) => ({ ...p, w: 1 })));

    expect(spaced?.slope ?? 0).toBeCloseTo(-0.1, 1);
    expect(Math.abs((spaced?.slope ?? 0) + 0.1)).toBeLessThan(
      Math.abs((equal?.slope ?? 0) + 0.1),
    );
  });
});

describe('weeklyRateKg', () => {
  it('reports nothing at all with no data', () => {
    const rate = weeklyRateKg([]);
    expect(rate.confidence).toBe('none');
    expect(rate.kgPerWeek).toBe(0);
    expect(rate.sampleCount).toBe(0);
    expect(rate.ci95KgPerWeek).toBeNull();
  });

  it('refuses a weekly rate from two weigh-ins a month apart', () => {
    const entries: WeightEntry[] = [
      { at: START, kg: 90 },
      { at: START + 30 * MS_PER_DAY, kg: 87 },
    ];
    const rate = weeklyRateKg(smoothWeightSeries(entries));
    expect(rate.confidence).toBe('none');
    expect(rate.kgPerWeek).toBe(0);
    expect(rate.reason).toContain(`${MIN_POINTS_FOR_RATE}`);
  });

  it('refuses a rate from three weigh-ins inside a single week', () => {
    const rate = weeklyRateKg(smoothWeightSeries(daily([90, 89.8, 89.6, 89.5])));
    expect(rate.confidence).toBe('none');
    expect(rate.spanDays).toBe(3);
  });

  it('recovers a clean 0.7 kg/week loss with high confidence', () => {
    const series = smoothWeightSeries(ramp(90, -0.1, 120));
    const rate = weeklyRateKg(series);
    expect(rate.kgPerWeek).toBeCloseTo(-0.7, 2);
    expect(rate.percentPerWeek).toBeCloseTo(
      (rate.kgPerWeek / (series[series.length - 1]?.trendKg ?? 1)) * 100,
      6,
    );
    expect(rate.confidence).toBe('high');
    expect(rate.reason).toBeNull();
    expect(rate.rSquared).toBeGreaterThan(0.999);
    expect(rate.spanDays).toBe(RATE_WINDOW_DAYS);
    expect(rate.coverage).toBeCloseTo(1, 6);
  });

  it('recovers a clean gain as a positive rate', () => {
    const rate = weeklyRateKg(smoothWeightSeries(ramp(70, 0.05, 120)));
    expect(rate.kgPerWeek).toBeCloseTo(0.35, 2);
  });

  it('brackets the true rate inside its 95% interval', () => {
    const noisy = Array.from({ length: 60 }, (_, index) => {
      const wobble = [0.4, -0.3, 0.2, -0.5, 0.1, 0.3, -0.2][index % 7] ?? 0;
      return 90 - 0.1 * index + wobble;
    });
    const rate = weeklyRateKg(smoothWeightSeries(daily(noisy)));
    const ci = rate.ci95KgPerWeek;
    expect(ci).not.toBeNull();
    expect(ci?.[0] ?? 0).toBeLessThan(-0.7);
    expect(ci?.[1] ?? 0).toBeGreaterThan(-0.7);
  });

  it('tiers confidence by how much data actually exists', () => {
    const low = weeklyRateKg(smoothWeightSeries(daily([90, 89.9, 89.7, 89.6, 89.4, 89.3, 89.2, 89])));
    expect(low.confidence).toBe('low');

    const sparse = daily(Array.from({ length: 20 }, (_, index) => 90 - 0.1 * index)).filter(
      (_, index) => index % 2 === 0,
    );
    const moderate = weeklyRateKg(smoothWeightSeries(sparse));
    expect(moderate.confidence).toBe('moderate');
    expect(moderate.reason).not.toBeNull();
  });

  it('degrades from high to low when the same span is barely sampled', () => {
    const base = ramp(90, -0.1, 120);
    const dense = weeklyRateKg(smoothWeightSeries(base));
    const sparse = weeklyRateKg(
      smoothWeightSeries(base.filter((_, index) => index % 9 === 0)),
    );
    expect(dense.confidence).toBe('high');
    expect(sparse.confidence).toBe('low');
    // Same underlying truth, so the number survives; only the confidence drops.
    expect(Math.abs(sparse.kgPerWeek - dense.kgPerWeek)).toBeLessThan(0.1);
  });

  it('only looks inside its window', () => {
    // A month of fast loss, then a month of maintenance: a 14-day window must
    // report the maintenance, not the history before it.
    const falling = ramp(100, -0.2, 30);
    const flat = Array.from({ length: 30 }, (_, index) => ({
      at: START + (30 + index) * MS_PER_DAY,
      kg: 94,
    }));
    const rate = weeklyRateKg(smoothWeightSeries([...falling, ...flat]), { windowDays: 14 });
    expect(Math.abs(rate.kgPerWeek)).toBeLessThan(0.2);
    expect(rate.windowDays).toBe(14);
    expect(rate.spanDays).toBe(14);
  });

  it('is robust to a two-week gap in the middle of the window', () => {
    const full = ramp(90, -0.1, 120);
    const gapped = full.filter((_, index) => index < 90 || index > 104);
    const withGap = weeklyRateKg(smoothWeightSeries(gapped), { windowDays: 60 });
    const withoutGap = weeklyRateKg(smoothWeightSeries(full), { windowDays: 60 });
    expect(withGap.kgPerWeek).toBeLessThan(0);
    expect(Math.abs(withGap.kgPerWeek - withoutGap.kgPerWeek)).toBeLessThan(0.2);
    expect(withGap.coverage).toBeLessThan(withoutGap.coverage);
  });
});

describe('lagCorrectedTrendKg', () => {
  it('matches the research worked example: 0.5 kg/week reads 0.71 kg high', () => {
    const kgPerDay = -0.5 / 7;
    const series = smoothWeightSeries(ramp(90, kgPerDay, 120));
    const last = series[series.length - 1];
    const lag = (last?.trendKg ?? 0) - (last?.kg ?? 0);
    expect(lag).toBeCloseTo(0.714, 1);
    expect(Math.abs(lag - 0.714)).toBeLessThan(0.05);
  });

  it('puts the corrected estimate back on the real weight', () => {
    const series = smoothWeightSeries(ramp(90, -0.5 / 7, 120));
    const last = series[series.length - 1];
    const rate = weeklyRateKg(series);
    const corrected = lagCorrectedTrendKg(last?.trendKg ?? 0, rate.kgPerWeek);
    expect(corrected).toBeCloseTo(last?.kg ?? 0, 1);
  });

  it('leaves a flat trend alone', () => {
    expect(lagCorrectedTrendKg(80, 0)).toBe(80);
  });

  it('corrects upward while gaining and downward while losing', () => {
    expect(lagCorrectedTrendKg(80, 0.7)).toBeCloseTo(81, 10);
    expect(lagCorrectedTrendKg(80, -0.7)).toBeCloseTo(79, 10);
  });

  it('degrades safely on non-finite input', () => {
    expect(lagCorrectedTrendKg(80, Number.NaN)).toBe(80);
    expect(Number.isNaN(lagCorrectedTrendKg(Number.NaN, 1))).toBe(true);
  });
});
