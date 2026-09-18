/**
 * Exponentially weighted moving average for daily bodyweight - the Hacker's
 * Diet / Libra trend line, in continuous time.
 *
 * Raw scale readings are dominated by water and gut content: John Walker's
 * worked example shows daily readings spanning 6 lb while true weight moved
 * 1 lb, a 6:1 noise-to-signal ratio, which is the whole justification for
 * smoothing. The recurrence is
 *
 *     trend += (1 - e^(-dt/tau)) * (weight - trend),  tau = 10 days
 *
 * At dt = 1 day this gives alpha = 1 - e^(-0.1) = 0.09516, i.e. Walker's "add
 * one tenth of the difference" rule, an equivalent simple moving average of
 * N = 2/alpha - 1 = 20.0 days, and a half-life of tau*ln2 = 6.93 days.
 *
 * The dt-aware exponent (Libra's engineering detail) is what makes irregular
 * sampling correct: a user who skips ten days gets a trend that steps toward
 * the new reading instead of crawling, and no missing day is ever imputed.
 *
 * Sources:
 * - Hacker's Diet signal/noise: https://www.fourmilab.ch/hackdiet/e4/signalnoise.html
 * - Libra's continuous-time form: https://libra-app.eu/support/trend/
 * - Research brief, sections "Hacker's Diet trend" and "Libra uses a
 *   continuous-time EWMA that correctly handles irregular weigh-in gaps".
 *
 * UNITS: kilograms throughout; time constants in days.
 */

import {
  MS_PER_DAY,
  normaliseEntries,
  type SmoothedPoint,
  type SmoothedSeries,
  type WeightEntry,
} from './types';

/**
 * Smoothing time constant in days. tau = 10 reproduces the Hacker's Diet daily
 * alpha = 0.1 rule and fourmilab's stated ~20-day SMA equivalence.
 */
export const TAU_DAYS = 10;

/** Per-day smoothing factor at tau = 10 days: 1 - e^(-0.1) = 0.0951626... */
export const DAILY_ALPHA = 1 - Math.exp(-1 / TAU_DAYS);

/** Equivalent simple-moving-average length, N = 2/alpha - 1 =~ 20.02 days. */
export const EQUIVALENT_SMA_DAYS = 2 / DAILY_ALPHA - 1;

/** Half-life of the filter, tau*ln2 =~ 6.93 days. */
export const HALF_LIFE_DAYS = TAU_DAYS * Math.LN2;

/** Consistency constant converting a median absolute deviation to a sigma estimate for normal data. */
export const MAD_TO_SIGMA = 1.4826;

/**
 * Huber tuning constant. Residuals beyond k*sigma are damped to k*sigma;
 * k = 1.345 is the standard choice giving 95% asymptotic efficiency at the
 * normal distribution.
 */
export const HUBER_K = 1.345;

/**
 * Floor on the robust residual scale, as a fraction of current bodyweight.
 *
 * 0.35% is the measured within-week bodyweight fluctuation (weekend gain,
 * weekday loss; heaviest Monday, lightest Friday) from the PLOS ONE
 * weight-loss-maintenance cohort, n = 1,421:
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC7192384/
 *
 * Without a floor, an unnaturally steady run of readings drives the MAD to
 * zero and the gate would reject ordinary physiological variation.
 */
export const WITHIN_WEEK_FLUCTUATION_FRACTION = 0.0035;

/** Number of trailing raw residuals used to estimate the residual scale. */
export const RESIDUAL_WINDOW = 20;

/** Residuals required before the outlier gate engages at all. */
export const MIN_RESIDUALS_FOR_GATE = 5;

/** Tuning for {@link smoothWeightSeries}. All fields optional. */
export interface SmoothingOptions {
  /** Time constant in days. Default {@link TAU_DAYS} (10). */
  readonly tauDays?: number;
  /** Huber cut-off in robust sigmas. Default {@link HUBER_K} (1.345). */
  readonly huberK?: number;
  /** Set false to apply every residual in full. Default true. */
  readonly gateOutliers?: boolean;
  /** Trailing residuals used for the scale estimate. Default {@link RESIDUAL_WINDOW}. */
  readonly residualWindow?: number;
  /** Residuals needed before gating starts. Default {@link MIN_RESIDUALS_FOR_GATE}. */
  readonly minResidualsForGate?: number;
  /** Scale floor as a fraction of bodyweight. Default {@link WITHIN_WEEK_FLUCTUATION_FRACTION}. */
  readonly minScaleFraction?: number;
}

/**
 * Fraction of the gap between a reading and the running trend that the trend
 * moves: 1 - e^(-dt/tau).
 *
 * @param deltaDays Days since the previous weigh-in. Values <= 0 (a duplicate
 *   or same-instant reading) return 0, leaving the trend untouched.
 * @param tauDays Time constant in days. Default {@link TAU_DAYS}.
 * @returns A factor in [0, 1).
 */
export function smoothingPower(deltaDays: number, tauDays: number = TAU_DAYS): number {
  if (!Number.isFinite(deltaDays) || deltaDays <= 0) return 0;
  if (!Number.isFinite(tauDays) || tauDays <= 0) return 1;
  return 1 - Math.exp(-deltaDays / tauDays);
}

/**
 * Median of a numeric sample, in the unit of the sample.
 *
 * @returns `undefined` for an empty sample, which is a different thing from 0.
 */
export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const upper = sorted[mid];
  if (upper === undefined) return undefined;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1];
  return lower === undefined ? upper : (lower + upper) / 2;
}

/**
 * Median absolute deviation about the median - a 50%-breakdown-point scale
 * estimator, so a single spike cannot inflate it. Same unit as the input, not
 * yet scaled to sigma; see {@link MAD_TO_SIGMA}.
 *
 * @returns `undefined` for an empty sample.
 */
export function medianAbsoluteDeviation(values: readonly number[]): number | undefined {
  const centre = median(values);
  if (centre === undefined) return undefined;
  return median(values.map((value) => Math.abs(value - centre)));
}

/**
 * Robust estimate of residual spread in kg: max(1.4826*MAD, fraction*weight).
 *
 * @param residuals Recent raw residuals (reading - trend), kg.
 * @param referenceKg Current bodyweight used for the physiological floor, kg.
 * @param minScaleFraction Floor as a fraction of bodyweight. Default
 *   {@link WITHIN_WEEK_FLUCTUATION_FRACTION} (0.35%, PLOS ONE PMC7192384).
 * @returns Scale in kg, never negative.
 */
export function robustScaleKg(
  residuals: readonly number[],
  referenceKg: number,
  minScaleFraction: number = WITHIN_WEEK_FLUCTUATION_FRACTION,
): number {
  const mad = medianAbsoluteDeviation(residuals) ?? 0;
  const floor = Math.max(0, referenceKg) * Math.max(0, minScaleFraction);
  return Math.max(mad * MAD_TO_SIGMA, floor);
}

/**
 * Smooths a bodyweight series with the continuous-time Hacker's Diet EWMA and
 * a Huber gate on outliers.
 *
 * Behaviour that matters:
 * - The first entry seeds the trend exactly (trendKg === kg, residual 0). There
 *   is no warm-up ramp and no zero-start artefact.
 * - Gaps are handled by the dt-aware exponent. Nothing is imputed, because
 *   imputation is documented to understate bodyweight variability (JMIR
 *   smart-scale validation study).
 * - Two readings sharing an instant give dt = 0, hence power 0: the second is
 *   recorded but cannot move the trend.
 * - Once {@link MIN_RESIDUALS_FOR_GATE} residuals exist, a residual more than
 *   k*sigma away from the recent residual MEDIAN is pulled back to that limit,
 *   so a post-carb-load 2 kg spike moves the trend by a few tens of grams
 *   rather than alpha*2 = 0.19 kg or 2 kg - while a genuine ramp, whose
 *   residuals are consistently offset, passes through undamped.
 *
 * Input need not be sorted; unusable rows are dropped by `normaliseEntries`.
 *
 * @param entries Raw weigh-ins, kg.
 * @param options See {@link SmoothingOptions}.
 * @returns One {@link SmoothedPoint} per usable entry, ascending by instant.
 */
export function smoothWeightSeries(
  entries: readonly WeightEntry[],
  options: SmoothingOptions = {},
): SmoothedSeries {
  const tauDays = options.tauDays ?? TAU_DAYS;
  const huberK = options.huberK ?? HUBER_K;
  const gateOutliers = options.gateOutliers ?? true;
  const residualWindow = Math.max(1, Math.floor(options.residualWindow ?? RESIDUAL_WINDOW));
  const minResidualsForGate = Math.max(
    1,
    Math.floor(options.minResidualsForGate ?? MIN_RESIDUALS_FOR_GATE),
  );
  const minScaleFraction = options.minScaleFraction ?? WITHIN_WEEK_FLUCTUATION_FRACTION;

  const clean = normaliseEntries(entries);
  const out: SmoothedPoint[] = [];
  const recentResiduals: number[] = [];

  let trend = 0;
  let previousAt = 0;
  let seeded = false;

  for (const entry of clean) {
    if (!seeded) {
      trend = entry.kg;
      seeded = true;
      previousAt = entry.at;
      out.push({
        at: entry.at,
        kg: entry.kg,
        trendKg: trend,
        residualKg: 0,
        gateFactor: 1,
        isOutlier: false,
        deltaDays: 0,
      });
      continue;
    }

    const deltaDays = (entry.at - previousAt) / MS_PER_DAY;
    const power = smoothingPower(deltaDays, tauDays);
    const residual = entry.kg - trend;

    // The gate is centred on the MEDIAN recent residual, not on zero. A first-
    // order filter following a real downward ramp sits systematically above the
    // readings, so a zero-centred gate would treat steady weight loss itself as
    // a run of outliers and flatten the very signal we want.
    let gateFactor = 1;
    let appliedResidual = residual;
    if (gateOutliers && recentResiduals.length >= minResidualsForGate) {
      const centre = median(recentResiduals) ?? 0;
      const scale = robustScaleKg(recentResiduals, trend, minScaleFraction);
      const limit = huberK * scale;
      const deviation = residual - centre;
      const magnitude = Math.abs(deviation);
      if (limit > 0 && magnitude > limit) {
        gateFactor = limit / magnitude;
        appliedResidual = centre + deviation * gateFactor;
      }
    }

    trend += power * appliedResidual;
    previousAt = entry.at;

    // The scale estimate uses RAW residuals, so the gate adapts to genuine
    // variability without being inflated by the spikes it is meant to damp.
    recentResiduals.push(residual);
    if (recentResiduals.length > residualWindow) recentResiduals.shift();

    out.push({
      at: entry.at,
      kg: entry.kg,
      trendKg: trend,
      residualKg: residual,
      gateFactor,
      isOutlier: gateFactor < 1,
      deltaDays,
    });
  }

  return out;
}

/**
 * Most recent smoothed value.
 *
 * @returns kg, or `undefined` for an empty series.
 */
export function latestTrendKg(series: SmoothedSeries): number | undefined {
  return series[series.length - 1]?.trendKg;
}

/**
 * Trend value at an arbitrary instant, by linear interpolation between the
 * bracketing smoothed points. Instants outside the series clamp to the first or
 * last value: the filter is never extrapolated here, which is the job of
 * `trend.ts` and `projection.ts`.
 *
 * @param series Smoothed series, ascending by instant.
 * @param at Instant to evaluate, epoch ms UTC.
 * @returns kg, or `undefined` when the series is empty.
 */
export function trendAtInstant(series: SmoothedSeries, at: number): number | undefined {
  if (series.length === 0) return undefined;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === undefined || last === undefined) return undefined;
  if (at <= first.at) return first.trendKg;
  if (at >= last.at) return last.trendKg;

  for (let i = 1; i < series.length; i += 1) {
    const right = series[i];
    const left = series[i - 1];
    if (right === undefined || left === undefined) continue;
    if (right.at < at) continue;
    const span = right.at - left.at;
    if (span <= 0) return right.trendKg;
    const fraction = (at - left.at) / span;
    return left.trendKg + fraction * (right.trendKg - left.trendKg);
  }
  return last.trendKg;
}
