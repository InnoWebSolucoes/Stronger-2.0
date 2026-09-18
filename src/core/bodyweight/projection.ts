/**
 * Projection to a goal weight - as a date BAND, never a single confident date,
 * and declining outright when the data cannot support a guess.
 *
 * The band comes from the measured 95% interval on the weekly rate: the fast
 * end of that interval gives the earliest plausible date, the slow end the
 * latest. It is capped at min(90 days, 2x history), per the research brief, so
 * a fortnight of weigh-ins can never produce a confident date nine months out.
 *
 * Deliberately NOT modelled: a built-in deceleration constant. Real weight loss
 * plateaus, but the research brief gives no citable decay figure, and inventing
 * one would put a fabricated number in front of a user. Callers who have a
 * reason to damp may pass `decayHalfLifeDays`; the closed-form solution is
 * exported as {@link timeToGoalDays} and defaults to no damping.
 *
 * Sources:
 * - Research brief Summary: "the projection is shown as a date band, damped and
 *   capped at min(90 days, 2x history), never a single confident date."
 * - Libra forecast, capped extrapolation: https://libra-app.eu/support/forecast/
 * - 0.35% within-week fluctuation (the goal-reached tolerance):
 *   https://pmc.ncbi.nlm.nih.gov/articles/PMC7192384/
 *
 * UNITS: kg, days, epoch ms UTC.
 */

import { MS_PER_DAY, type ConfidenceLevel, type SmoothedSeries } from './types';
import { WITHIN_WEEK_FLUCTUATION_FRACTION } from './smoothing';
import { weeklyRateKg, type WeeklyRate, type WeeklyRateOptions } from './trend';

/** Hard ceiling on any projection horizon, days. */
export const MAX_HORIZON_DAYS = 90;

/** Horizon may not exceed this multiple of the history actually recorded. */
export const HISTORY_HORIZON_MULTIPLE = 2;

/** Confidence tiers that are allowed to produce a projection. */
export const MIN_CONFIDENCE_FOR_PROJECTION: ConfidenceLevel = 'moderate';

/** Why a projection was refused. Each maps to user-facing copy in the UI. */
export type ProjectionDeclineReason =
  | 'no-data'
  | 'insufficient-confidence'
  | 'rate-not-distinguishable-from-zero'
  | 'moving-away-from-goal'
  | 'beyond-horizon'
  | 'plateau-before-goal';

/** The goal is already met, within normal daily fluctuation. */
export interface ProjectionAchieved {
  readonly status: 'achieved';
  /** Signed kg still to go; at or past the goal this is <= the tolerance. */
  readonly remainingKg: number;
}

/** No projection will be shown, and why. */
export interface ProjectionDeclined {
  readonly status: 'declined';
  readonly reason: ProjectionDeclineReason;
  /** Plain-language explanation, safe to show verbatim. */
  readonly message: string;
  /** Signed kg still to go, when it could be computed. */
  readonly remainingKg: number | null;
  /** The cap that was applied, days. Present for `beyond-horizon`. */
  readonly horizonDays: number | null;
}

/** A projection, always a band. */
export interface ProjectionBand {
  readonly status: 'projected';
  /** Signed kg still to go: negative when the goal is below current weight. */
  readonly remainingKg: number;
  /** Earliest plausible arrival, days from `asOf` (fast end of the rate interval). */
  readonly earliestDays: number;
  /** Central estimate, days from `asOf`. Shown as context, never on its own. */
  readonly centralDays: number;
  /** Latest plausible arrival, days from `asOf` (slow end, capped at the horizon). */
  readonly latestDays: number;
  /** Earliest plausible arrival, epoch ms UTC. */
  readonly earliestAt: number;
  /** Central estimate, epoch ms UTC. */
  readonly centralAt: number;
  /** Latest plausible arrival, epoch ms UTC. */
  readonly latestAt: number;
  /** True when the late edge hit the horizon cap and means "at least this long". */
  readonly latestIsCapped: boolean;
  /** Cap applied, days: min(90, 2 x history). */
  readonly horizonDays: number;
  /** Confidence inherited from the rate estimate. */
  readonly confidence: ConfidenceLevel;
  /** Rate used, kg per week (negative when losing). */
  readonly kgPerWeek: number;
}

/** Result of {@link projectToGoal}. */
export type Projection = ProjectionAchieved | ProjectionDeclined | ProjectionBand;

/** Inputs for {@link projectToGoal}. */
export interface ProjectionInput {
  /** Current smoothed (ideally lag-corrected) bodyweight, kg. */
  readonly currentKg: number;
  /** Goal bodyweight, kg. Validate it with `safety.ts` before projecting. */
  readonly goalKg: number;
  /** Rate estimate from `weeklyRateKg`. */
  readonly rate: WeeklyRate;
  /** Days of weigh-in history available, used for the 2x history cap. */
  readonly historyDays: number;
  /** Instant the projection is made from, epoch ms UTC. */
  readonly asOf: number;
  /** Optional rate half-life in days for a damped projection. Default: none. */
  readonly decayHalfLifeDays?: number | null;
  /** Lowest confidence tier allowed to project. Default `moderate`. */
  readonly minConfidence?: ConfidenceLevel;
  /** "Close enough" tolerance as a fraction of bodyweight. Default 0.35%. */
  readonly achievedToleranceFraction?: number;
}

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/**
 * Days to close a weight gap at a given rate, optionally with the rate decaying
 * exponentially (a plateau model).
 *
 * Undamped: t = remaining / rate.
 * Damped with half-life H: the rate is r0*2^(-t/H), so cumulative change is
 * r0*H/ln2 * (1 - 2^(-t/H)) and the total change is asymptotically bounded by
 * r0*H/ln2. If the gap exceeds that bound the goal is never reached.
 *
 * @param remainingKg Signed kg still to go (goal - current).
 * @param ratePerDayKg Signed kg per day.
 * @param decayHalfLifeDays Rate half-life in days, or null/undefined for none.
 * @returns Days (>= 0), or `null` when the goal is unreachable at this rate.
 */
export function timeToGoalDays(
  remainingKg: number,
  ratePerDayKg: number,
  decayHalfLifeDays?: number | null,
): number | null {
  if (!Number.isFinite(remainingKg) || !Number.isFinite(ratePerDayKg)) return null;
  if (remainingKg === 0) return 0;
  if (ratePerDayKg === 0) return null;
  if (Math.sign(remainingKg) !== Math.sign(ratePerDayKg)) return null;

  if (decayHalfLifeDays === null || decayHalfLifeDays === undefined || decayHalfLifeDays <= 0) {
    return remainingKg / ratePerDayKg;
  }

  const totalPossible = (ratePerDayKg * decayHalfLifeDays) / Math.LN2;
  const fractionUsed = remainingKg / totalPossible;
  if (fractionUsed >= 1) return null;
  return -decayHalfLifeDays * Math.log2(1 - fractionUsed);
}

/**
 * Horizon cap in days: min(90, 2 x days of history).
 *
 * @param historyDays Days between the first and last weigh-in.
 */
export function projectionHorizonDays(historyDays: number): number {
  const fromHistory = Math.max(0, historyDays) * HISTORY_HORIZON_MULTIPLE;
  return Math.min(MAX_HORIZON_DAYS, fromHistory);
}

function decline(
  reason: ProjectionDeclineReason,
  message: string,
  remainingKg: number | null,
  horizonDays: number | null = null,
): ProjectionDeclined {
  return { status: 'declined', reason, message, remainingKg, horizonDays };
}

/**
 * Projects arrival at a goal weight as a date band, or declines.
 *
 * Refuses to project when:
 * - confidence is below `minConfidence` (default `moderate`);
 * - the 95% interval on the rate includes zero, so the slow end never arrives;
 * - the trend is moving away from the goal;
 * - the central estimate is beyond min(90 days, 2x history);
 * - a damped rate plateaus before the goal.
 *
 * When the LATE edge alone exceeds the horizon it is clamped and
 * `latestIsCapped` is set, which the UI should render as "or later".
 *
 * @param input See {@link ProjectionInput}. Weights in kg, instants in epoch ms.
 * @returns {@link Projection} - achieved, declined, or a band.
 */
export function projectToGoal(input: ProjectionInput): Projection {
  const {
    currentKg,
    goalKg,
    rate,
    historyDays,
    asOf,
    decayHalfLifeDays = null,
    minConfidence = MIN_CONFIDENCE_FOR_PROJECTION,
    achievedToleranceFraction = WITHIN_WEEK_FLUCTUATION_FRACTION,
  } = input;

  if (!Number.isFinite(currentKg) || currentKg <= 0 || !Number.isFinite(goalKg) || goalKg <= 0) {
    return decline('no-data', 'Not enough weigh-ins to project anything yet.', null);
  }

  const remainingKg = goalKg - currentKg;
  const tolerance = Math.abs(currentKg * achievedToleranceFraction);
  if (Math.abs(remainingKg) <= tolerance) {
    return { status: 'achieved', remainingKg };
  }

  const horizonDays = projectionHorizonDays(historyDays);

  if (CONFIDENCE_ORDER[rate.confidence] < CONFIDENCE_ORDER[minConfidence]) {
    return decline(
      'insufficient-confidence',
      rate.reason ?? 'Not enough weigh-ins yet to estimate a date.',
      remainingKg,
      horizonDays,
    );
  }

  const ci = rate.ci95KgPerWeek;
  if (ci === null) {
    return decline(
      'insufficient-confidence',
      'Not enough weigh-ins to put a range on the date.',
      remainingKg,
      horizonDays,
    );
  }

  const direction = Math.sign(remainingKg);
  if (Math.sign(rate.kgPerWeek) !== direction || rate.kgPerWeek === 0) {
    return decline(
      'moving-away-from-goal',
      'Your trend is not currently moving toward this goal.',
      remainingKg,
      horizonDays,
    );
  }

  const [ciLow, ciHigh] = ci;
  const fastKgPerWeek = direction > 0 ? Math.max(ciLow, ciHigh) : Math.min(ciLow, ciHigh);
  const slowKgPerWeek = direction > 0 ? Math.min(ciLow, ciHigh) : Math.max(ciLow, ciHigh);

  if (Math.sign(slowKgPerWeek) !== direction || slowKgPerWeek === 0) {
    return decline(
      'rate-not-distinguishable-from-zero',
      'Your rate of change is still within the margin of error, so any date would be a guess.',
      remainingKg,
      horizonDays,
    );
  }

  const centralDays = timeToGoalDays(remainingKg, rate.kgPerWeek / 7, decayHalfLifeDays);
  const earliestRaw = timeToGoalDays(remainingKg, fastKgPerWeek / 7, decayHalfLifeDays);
  const latestRaw = timeToGoalDays(remainingKg, slowKgPerWeek / 7, decayHalfLifeDays);

  if (centralDays === null || earliestRaw === null) {
    return decline(
      'plateau-before-goal',
      'At a rate that keeps slowing, this goal would not be reached.',
      remainingKg,
      horizonDays,
    );
  }

  if (centralDays > horizonDays) {
    return decline(
      'beyond-horizon',
      `This goal is further out than ${Math.round(horizonDays)} days, which is as far as we will estimate from the data you have.`,
      remainingKg,
      horizonDays,
    );
  }

  const earliestDays = Math.max(0, Math.min(earliestRaw, horizonDays));
  const uncappedLatest = latestRaw === null ? Number.POSITIVE_INFINITY : latestRaw;
  const latestIsCapped = uncappedLatest > horizonDays;
  const latestDays = latestIsCapped ? horizonDays : uncappedLatest;

  return {
    status: 'projected',
    remainingKg,
    earliestDays,
    centralDays,
    latestDays,
    earliestAt: asOf + earliestDays * MS_PER_DAY,
    centralAt: asOf + centralDays * MS_PER_DAY,
    latestAt: asOf + latestDays * MS_PER_DAY,
    latestIsCapped,
    horizonDays,
    confidence: rate.confidence,
    kgPerWeek: rate.kgPerWeek,
  };
}

/** Options for {@link projectGoalFromSeries}. */
export interface ProjectFromSeriesOptions extends WeeklyRateOptions {
  readonly decayHalfLifeDays?: number | null;
  readonly minConfidence?: ConfidenceLevel;
  readonly achievedToleranceFraction?: number;
}

/**
 * Convenience wrapper: computes the weekly rate from a smoothed series and
 * projects to `goalKg` from the last weigh-in.
 *
 * @param series Smoothed series from `smoothWeightSeries`.
 * @param goalKg Goal bodyweight, kg (validate with `safety.ts` first).
 * @param options Rate window plus {@link ProjectionInput} tuning.
 * @returns {@link Projection}.
 */
export function projectGoalFromSeries(
  series: SmoothedSeries,
  goalKg: number,
  options: ProjectFromSeriesOptions = {},
): Projection {
  const first = series[0];
  const last = series[series.length - 1];
  if (first === undefined || last === undefined) {
    return decline('no-data', 'Not enough weigh-ins to project anything yet.', null);
  }
  const rate = weeklyRateKg(series, options);
  return projectToGoal({
    currentKg: last.trendKg,
    goalKg,
    rate,
    historyDays: (last.at - first.at) / MS_PER_DAY,
    asOf: last.at,
    decayHalfLifeDays: options.decayHalfLifeDays ?? null,
    minConfidence: options.minConfidence ?? MIN_CONFIDENCE_FOR_PROJECTION,
    achievedToleranceFraction:
      options.achievedToleranceFraction ?? WITHIN_WEEK_FLUCTUATION_FRACTION,
  });
}
