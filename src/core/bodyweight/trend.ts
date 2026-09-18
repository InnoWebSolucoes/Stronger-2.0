/**
 * Rate of bodyweight change in kg per week, with an honest confidence tier.
 *
 * Method: weighted ordinary least squares on the SMOOTHED trend values over a
 * 28-day window. Regressing on the smoothed series rather than raw weights is
 * what stops the figure jumping every morning (Libra does the same, on a 7-day
 * window; 7 days is too short because it re-fits over a series whose own time
 * constant is 7-10 days, so the research brief specifies 28).
 *
 * Weights are half the gap on either side of each point ("Voronoi" or
 * trapezoidal spacing weights, summing to the window span). This is what makes
 * the slope robust to gaps and to clustering: five weigh-ins inside one morning
 * cannot outvote a lone weigh-in that stands for a whole week.
 *
 * Sources:
 * - Libra forecast method (regression on trend values): https://libra-app.eu/support/forecast/
 * - Hacker's Diet lag on a ramp: https://www.fourmilab.ch/hackdiet/e4/signalnoise.html
 * - Research brief, sections "Libra's forecast" and the lag-correction note in
 *   the Summary ("a first-order filter trailing a ramp sits r*tau behind").
 *
 * UNITS: kg for weight, days for x, kg/week for every reported rate.
 */

import { MS_PER_DAY, type ConfidenceLevel, type SmoothedSeries } from './types';
import { TAU_DAYS } from './smoothing';

/** Default regression window in days. 28 per the research brief. */
export const RATE_WINDOW_DAYS = 28;

/** Distinct calendar-ish days of data required before any rate is reported. */
export const MIN_POINTS_FOR_RATE = 3;

/** Minimum span in days before any rate is reported. */
export const MIN_SPAN_DAYS_FOR_RATE = 7;

/** One weighted-least-squares line fit. Slope is per day in the unit of y. */
export interface LinearFit {
  /** Slope, y-units per day. */
  readonly slope: number;
  /** Intercept at x = 0, y-units. */
  readonly intercept: number;
  /** Standard error of the slope, y-units per day. `null` when df < 1. */
  readonly slopeStandardError: number | null;
  /** Weighted coefficient of determination in [0, 1]. */
  readonly rSquared: number;
  /** Number of points in the fit. */
  readonly count: number;
}

/** A point for {@link weightedLinearFit}. */
export interface FitPoint {
  readonly x: number;
  readonly y: number;
  /** Non-negative relative weight. */
  readonly w: number;
}

/** Rate of change of bodyweight, with the evidence behind it. */
export interface WeeklyRate {
  /** Rate of change, kg per week. Negative means losing. 0 when unknown. */
  readonly kgPerWeek: number;
  /** Rate as a percentage of current bodyweight per week. Negative means losing. */
  readonly percentPerWeek: number;
  /** Standard error of the rate, kg per week. `null` when it cannot be estimated. */
  readonly standardErrorKgPerWeek: number | null;
  /** Two-sided 95% interval for the rate, kg per week. `null` when df < 1. */
  readonly ci95KgPerWeek: readonly [number, number] | null;
  /** How much the data supports the figure. `none` means: do not display it. */
  readonly confidence: ConfidenceLevel;
  /** Plain-language reason the confidence is not `high`. `null` when it is. */
  readonly reason: string | null;
  /** Smoothed points inside the window. */
  readonly sampleCount: number;
  /** Distinct local-ish days inside the window (UTC days; see `stats.ts` for local bucketing). */
  readonly distinctDays: number;
  /** Days from the first to the last point in the window. */
  readonly spanDays: number;
  /** distinctDays / (spanDays + 1), in [0, 1]. How densely the span was sampled. */
  readonly coverage: number;
  /** Weighted r-squared of the fit, in [0, 1]. */
  readonly rSquared: number;
  /** Window actually used, days. */
  readonly windowDays: number;
}

/** Options for {@link weeklyRateKg}. */
export interface WeeklyRateOptions {
  /** Regression window in days. Default {@link RATE_WINDOW_DAYS} (28). */
  readonly windowDays?: number;
  /** Instant the window ends at, epoch ms UTC. Default: the last point. */
  readonly asOf?: number;
}

/**
 * Two-sided 95% critical value of Student's t.
 *
 * Exact table for df 1-30 (standard t-table, 0.025 upper tail), then the normal
 * limit 1.960 above df 30. Small-sample honesty matters here: with four
 * weigh-ins, using 1.96 would understate the interval by ~40%.
 *
 * @param df Residual degrees of freedom (n - 2 for a line fit).
 * @returns The critical value, or `Number.POSITIVE_INFINITY` when df < 1.
 */
export function tCritical95(df: number): number {
  if (!Number.isFinite(df) || df < 1) return Number.POSITIVE_INFINITY;
  const table = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
    2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
    2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
  ];
  const index = Math.floor(df) - 1;
  return table[index] ?? 1.96;
}

/**
 * Weighted ordinary least squares fit of y = intercept + slope*x.
 *
 * Weights are normalised to sum to n, so the residual variance estimate
 * sum(w*e^2)/(n-2) and hence the slope standard error reduce to the ordinary
 * unweighted formulas when all weights are equal.
 *
 * @param points x in days, y in kg, w a non-negative relative weight.
 * @returns The fit, or `null` for fewer than two points or zero x-variance.
 */
export function weightedLinearFit(points: readonly FitPoint[]): LinearFit | null {
  const usable = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.w) && p.w > 0,
  );
  const n = usable.length;
  if (n < 2) return null;

  const weightSum = usable.reduce((total, p) => total + p.w, 0);
  if (weightSum <= 0) return null;
  const scale = n / weightSum;

  let sw = 0;
  let swx = 0;
  let swy = 0;
  let swxx = 0;
  let swxy = 0;
  for (const p of usable) {
    const w = p.w * scale;
    sw += w;
    swx += w * p.x;
    swy += w * p.y;
    swxx += w * p.x * p.x;
    swxy += w * p.x * p.y;
  }

  const denominator = sw * swxx - swx * swx;
  if (denominator === 0 || !Number.isFinite(denominator)) return null;

  const slope = (sw * swxy - swx * swy) / denominator;
  const intercept = (swy * swxx - swx * swxy) / denominator;

  const meanY = swy / sw;
  let weightedResidualSquares = 0;
  let weightedTotalSquares = 0;
  for (const p of usable) {
    const w = p.w * scale;
    const residual = p.y - (intercept + slope * p.x);
    weightedResidualSquares += w * residual * residual;
    weightedTotalSquares += w * (p.y - meanY) * (p.y - meanY);
  }

  const df = n - 2;
  let slopeStandardError: number | null = null;
  if (df >= 1) {
    const variance = weightedResidualSquares / df;
    const slopeVariance = (variance * sw) / denominator;
    slopeStandardError = slopeVariance > 0 ? Math.sqrt(slopeVariance) : 0;
  }

  const rSquared =
    weightedTotalSquares > 0
      ? Math.max(0, Math.min(1, 1 - weightedResidualSquares / weightedTotalSquares))
      : 1;

  return { slope, intercept, slopeStandardError, rSquared, count: n };
}

/**
 * Spacing weights for irregularly sampled points: half the gap on either side.
 *
 * @param xs Strictly non-decreasing x values, days.
 * @returns One weight per x, summing to the span (plus a small floor for
 *   duplicated x values so a repeated instant is not silently dropped).
 */
export function spacingWeights(xs: readonly number[]): number[] {
  const n = xs.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const floor = 1e-6;
  const weights: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const here = xs[i];
    const before = xs[i - 1];
    const after = xs[i + 1];
    if (here === undefined) {
      weights.push(floor);
      continue;
    }
    const left = before === undefined ? 0 : (here - before) / 2;
    const right = after === undefined ? 0 : (after - here) / 2;
    weights.push(Math.max(floor, left + right));
  }
  return weights;
}

const EMPTY_RATE: WeeklyRate = {
  kgPerWeek: 0,
  percentPerWeek: 0,
  standardErrorKgPerWeek: null,
  ci95KgPerWeek: null,
  confidence: 'none',
  reason: 'No weigh-ins yet.',
  sampleCount: 0,
  distinctDays: 0,
  spanDays: 0,
  coverage: 0,
  rSquared: 0,
  windowDays: RATE_WINDOW_DAYS,
};

/**
 * Weekly rate of change from a smoothed series.
 *
 * Confidence tiers, decided by how much data actually exists rather than by the
 * interval alone (the interval is optimistic: smoothed points are
 * autocorrelated, so the nominal standard error is a lower bound on the true
 * uncertainty):
 * - `none`    - fewer than 3 points, or a span under 7 days. Two weigh-ins a
 *               month apart do not support a weekly rate; the UI shows nothing.
 * - `low`     - 3+ points over 7+ days.
 * - `moderate`- 8+ distinct days over 14+ days.
 * - `high`    - 14+ distinct days over 21+ days with at least 50% day coverage.
 *
 * @param series Smoothed series from `smoothWeightSeries`, ascending by instant.
 * @param options Window length and window end instant.
 * @returns A {@link WeeklyRate}; never null. kg per week, negative when losing.
 */
export function weeklyRateKg(
  series: SmoothedSeries,
  options: WeeklyRateOptions = {},
): WeeklyRate {
  const windowDays = options.windowDays ?? RATE_WINDOW_DAYS;
  if (series.length === 0) return { ...EMPTY_RATE, windowDays };

  const last = series[series.length - 1];
  if (last === undefined) return { ...EMPTY_RATE, windowDays };

  const asOf = options.asOf ?? last.at;
  const from = asOf - windowDays * MS_PER_DAY;
  const window = series.filter((point) => point.at >= from && point.at <= asOf);

  const first = window[0];
  const final = window[window.length - 1];
  if (first === undefined || final === undefined) {
    return {
      ...EMPTY_RATE,
      windowDays,
      reason: `No weigh-ins in the last ${windowDays} days.`,
    };
  }

  const spanDays = (final.at - first.at) / MS_PER_DAY;
  const distinctDays = new Set(window.map((p) => Math.floor(p.at / MS_PER_DAY))).size;
  const coverage = spanDays > 0 ? Math.min(1, distinctDays / (spanDays + 1)) : distinctDays > 0 ? 1 : 0;
  const referenceKg = final.trendKg;

  const base = {
    sampleCount: window.length,
    distinctDays,
    spanDays,
    coverage,
    windowDays,
  };

  if (window.length < MIN_POINTS_FOR_RATE || spanDays < MIN_SPAN_DAYS_FOR_RATE) {
    return {
      ...EMPTY_RATE,
      ...base,
      reason:
        window.length < MIN_POINTS_FOR_RATE
          ? `Only ${window.length} weigh-in${window.length === 1 ? '' : 's'} in the window; ${MIN_POINTS_FOR_RATE} over ${MIN_SPAN_DAYS_FOR_RATE}+ days are needed.`
          : `Weigh-ins span ${spanDays.toFixed(1)} days; ${MIN_SPAN_DAYS_FOR_RATE} days are needed.`,
    };
  }

  const xs = window.map((point) => (point.at - first.at) / MS_PER_DAY);
  const weights = spacingWeights(xs);
  const fit = weightedLinearFit(
    window.map((point, index) => ({
      x: xs[index] ?? 0,
      y: point.trendKg,
      w: weights[index] ?? 1e-6,
    })),
  );

  if (fit === null) {
    return {
      ...EMPTY_RATE,
      ...base,
      reason: 'Weigh-ins do not span enough time to fit a line.',
    };
  }

  const kgPerWeek = fit.slope * 7;
  const standardErrorKgPerWeek =
    fit.slopeStandardError === null ? null : fit.slopeStandardError * 7;
  const df = fit.count - 2;
  const tCritical = tCritical95(df);
  const ci95KgPerWeek: readonly [number, number] | null =
    standardErrorKgPerWeek === null || !Number.isFinite(tCritical)
      ? null
      : [
          kgPerWeek - tCritical * standardErrorKgPerWeek,
          kgPerWeek + tCritical * standardErrorKgPerWeek,
        ];

  let confidence: ConfidenceLevel = 'low';
  let reason: string | null =
    'Based on a short history; the weekly rate will firm up with more weigh-ins.';
  if (distinctDays >= 14 && spanDays >= 21 && coverage >= 0.5) {
    confidence = 'high';
    reason = null;
  } else if (distinctDays >= 8 && spanDays >= 14) {
    confidence = 'moderate';
    reason = 'Fewer than 14 days weighed in the last three weeks.';
  }

  return {
    kgPerWeek,
    percentPerWeek: referenceKg > 0 ? (kgPerWeek / referenceKg) * 100 : 0,
    standardErrorKgPerWeek,
    ci95KgPerWeek,
    confidence,
    reason,
    rSquared: fit.rSquared,
    ...base,
  };
}

/**
 * Lag-corrects a trend value.
 *
 * A first-order filter following a ramp settles r*tau behind it, so while you
 * are losing weight the trend line reads high. At 0.5 kg/week (r = 0.0714
 * kg/day) and tau = 10 days the raw trend sits 0.71 kg above true bodyweight.
 * This returns the lag-corrected estimate: trendKg + ratePerDay*tau.
 *
 * Source: research brief Summary, "we expose lag correction - a first-order
 * filter trailing a ramp sits r*tau behind, so at 0.5 kg/week the raw trend
 * reads 0.71 kg high."
 *
 * Note: daily sampling makes the exact discrete lag tau' = (1-alpha)/alpha =
 * 9.51 days rather than 10, a ~5% difference on the correction itself, which is
 * well inside the noise this filter exists to remove.
 *
 * @param trendKg Smoothed trend value, kg.
 * @param kgPerWeek Rate of change, kg per week (negative when losing).
 * @param tauDays Filter time constant, days. Default {@link TAU_DAYS}.
 * @returns Lag-corrected bodyweight estimate, kg.
 */
export function lagCorrectedTrendKg(
  trendKg: number,
  kgPerWeek: number,
  tauDays: number = TAU_DAYS,
): number {
  if (!Number.isFinite(trendKg)) return Number.NaN;
  if (!Number.isFinite(kgPerWeek)) return trendKg;
  return trendKg + (kgPerWeek / 7) * tauDays;
}
