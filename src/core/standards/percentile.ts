/**
 * Score -> population percentile, with an explicit, honest confidence level.
 *
 * DISTRIBUTION ASSUMPTIONS (disclosed here because the UI must be able to cite them)
 * ---------------------------------------------------------------------------------
 * 1. Inside one (exercise, sex, bodyweight) cell, the five published level loads ARE the
 *    5th / 20th / 50th / 80th / 95th percentiles of that cell's load distribution. The
 *    engine therefore maps load -> z with a monotone spline through those five
 *    (ln load, z) points. It does NOT assume a lognormal distribution: for the male
 *    80 kg bench the implied log-space sigma falls monotonically from 0.3405 at the 5th
 *    percentile to 0.2626 at the 95th, so a single lognormal fit would misplace an Elite
 *    lifter by roughly a third of a tier.
 * 2. Beyond the outer anchors (below P5, above P95) the mapping extrapolates linearly in
 *    ln load, which is equivalent to assuming a lognormal tail with the local sigma of
 *    the outermost segment. Percentiles outside [5, 95] are therefore model
 *    extrapolation, not measurement, and the display is clamped to [0.1%, 99%].
 * 3. The aggregate z (across patterns, or a muscle's posterior mean) is treated as
 *    standard normal. That holds because each component is already a percentile-mapped
 *    z and the weighted combination is divided by sqrt(wᵀRw) to undo the variance
 *    shrinkage caused by the 0.58-0.85 correlations between lifts.
 * 4. The reference population is gym-app lifters who submit 1RM calculations. It is
 *    self-reported, not verified, and is inflated at the top relative to a true
 *    population sample. Competitive powerlifter medians sit near this population's
 *    Advanced level. The UI must always name the population next to the number.
 *
 * "Confidence" here is about the USER's evidence, not the reference dataset: it is a
 * function of the posterior SD of their z, which grows when they have logged few sets,
 * few sessions, only machine lifts, or nothing recently.
 *
 * @see https://strengthlevel.com/about
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md
 */

import {
  LABEL_SD_THRESHOLD,
  SCORE_INTERCEPT,
  SCORE_SLOPE,
  STANDARDS_META,
  type MethodologyNote,
} from './standards-data';

/** How much the reported percentile can be trusted, given the user's own evidence. */
export type Confidence = 'high' | 'moderate' | 'low' | 'insufficient';

/** Posterior SD (z units) at or below which confidence is 'high'. */
export const CONFIDENCE_SD_HIGH = 0.2;
/** Posterior SD at or below which confidence is 'moderate'. This is the labelling gate. */
export const CONFIDENCE_SD_MODERATE = LABEL_SD_THRESHOLD;
/** Posterior SD at or below which confidence is 'low'; above it, 'insufficient'. */
export const CONFIDENCE_SD_LOW = 0.6;

/** z multiplier for a 90% interval (the 95th-percentile point of the standard normal). */
const Z_90 = 1.6449;

/** A percentile estimate with its uncertainty and its provenance. */
export interface PercentileEstimate {
  /** Point estimate, 0-1. */
  readonly percentile: number;
  /** Display integer for "Top X%", clamped to [0.1, 99]. */
  readonly topPercent: number;
  /** Ready-to-render label, e.g. "Top 34%". */
  readonly label: string;
  /** 90% credible interval on the percentile, 0-1, from the posterior SD. */
  readonly interval: readonly [number, number];
  /** Confidence bucket derived from the posterior SD. */
  readonly confidence: Confidence;
  /** The posterior SD in z units that produced the interval. */
  readonly sdZ: number;
  /** Plain-English sentence the UI can surface verbatim. */
  readonly explanation: string;
  /** Which population the percentile is against. */
  readonly population: string;
}

/**
 * Gauss error function, Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
 * @param x real argument
 * @returns erf(x)
 * @see Abramowitz & Stegun, Handbook of Mathematical Functions, eq. 7.1.26
 */
export function erf(x: number): number {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Standard normal CDF: the share of the reference population below this z-score.
 * @param z standard normal deviate
 * @returns probability in [0, 1]
 * @see Abramowitz & Stegun, Handbook of Mathematical Functions, eq. 7.1.26
 */
export function normCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Inverse standard normal CDF (Acklam's rational approximation, |rel. error| < 1.15e-9).
 * @param p probability in (0, 1)
 * @returns the z-score with that cumulative probability; ±Infinity at the endpoints
 * @see P. Acklam, "An algorithm for computing the inverse normal cumulative distribution function"
 */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0,
    4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const idx = (arr: number[], i: number): number => {
    const v = arr[i];
    if (v === undefined) throw new RangeError('normInv: coefficient table corrupted');
    return v;
  };

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((idx(c, 0) * q + idx(c, 1)) * q + idx(c, 2)) * q + idx(c, 3)) * q + idx(c, 4)) * q + idx(c, 5)) /
      ((((idx(d, 0) * q + idx(d, 1)) * q + idx(d, 2)) * q + idx(d, 3)) * q + 1)
    );
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((idx(c, 0) * q + idx(c, 1)) * q + idx(c, 2)) * q + idx(c, 3)) * q + idx(c, 4)) * q + idx(c, 5)) /
      ((((idx(d, 0) * q + idx(d, 1)) * q + idx(d, 2)) * q + idx(d, 3)) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((idx(a, 0) * r + idx(a, 1)) * r + idx(a, 2)) * r + idx(a, 3)) * r + idx(a, 4)) * r + idx(a, 5)) * q) /
    (((((idx(b, 0) * r + idx(b, 1)) * r + idx(b, 2)) * r + idx(b, 3)) * r + idx(b, 4)) * r + 1)
  );
}

/**
 * Percentile of the reference population a z-score sits at.
 * @param z standard normal deviate produced by the standards engine
 * @returns percentile in [0, 1]
 * @see https://strengthlevel.com/about (levels are fixed percentile anchors)
 */
export function percentileFromZ(z: number): number {
  return normCdf(z);
}

/**
 * Percentile of the reference population a rank SCORE sits at.
 * Inverse of `rank.scoreFromZ`; both use SCORE_INTERCEPT / SCORE_SLOPE so the two
 * directions cannot drift apart.
 * @param score rank score in points
 * @returns percentile in [0, 1]
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3)
 */
export function percentileFromScore(score: number): number {
  return normCdf((score - SCORE_INTERCEPT) / SCORE_SLOPE);
}

/**
 * Convert a percentile into the "Top X%" number the UI shows, clamped to [0.1, 99] so
 * the app never claims "Top 0%" or "Top 100%" from an extrapolated tail.
 * @param percentile share of the population below the lifter, 0-1
 * @returns the X in "Top X%"
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3, display rule)
 */
export function topPercent(percentile: number): number {
  const raw = 100 * (1 - percentile);
  const rounded = raw < 1 ? Math.round(raw * 10) / 10 : Math.round(raw);
  return Math.max(0.1, Math.min(99, rounded));
}

/**
 * Render the "Top X%" label for a percentile.
 * @param percentile share of the population below the lifter, 0-1
 * @returns e.g. "Top 34%"
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3, display rule)
 */
export function topPercentLabel(percentile: number): string {
  return `Top ${topPercent(percentile)}%`;
}

/**
 * Bucket a posterior SD (in z units) into a confidence level.
 * 0.35 z is about one and a quarter sub-tiers and is the threshold below which a hard
 * tier label may be shown at all.
 * @param sdZ posterior standard deviation of the lifter's z, in z units
 * @returns the confidence bucket
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Recommendations)
 */
export function confidenceFromSd(sdZ: number): Confidence {
  if (!Number.isFinite(sdZ) || sdZ > CONFIDENCE_SD_LOW) return 'insufficient';
  if (sdZ <= CONFIDENCE_SD_HIGH) return 'high';
  if (sdZ <= CONFIDENCE_SD_MODERATE) return 'moderate';
  return 'low';
}

/** Human sentence for each confidence bucket. */
const CONFIDENCE_COPY: Readonly<Record<Confidence, string>> = {
  high: 'Based on enough recent sets across several sessions to be confident.',
  moderate: 'Based on a reasonable amount of recent data; expect small movement as you log more.',
  low: 'Based on limited data, so this is an estimate — log more sessions to tighten it.',
  insufficient: 'Not enough data yet to place you on the scale with any confidence.',
};

/**
 * Map a z-score and its posterior SD to a percentile with an explicit confidence level
 * and a 90% credible interval. The interval is the percentile of z ± 1.6449·sd, so a
 * lifter with one logged set gets a visibly wide band instead of a false precision.
 *
 * @param z posterior mean z-score
 * @param sdZ posterior SD in z units (0 means "treat as exact"; only valid for demos)
 * @returns the estimate, its interval, its confidence bucket and UI copy
 * @see https://strengthlevel.com/about (percentile anchors and reference population)
 */
export function percentileWithConfidence(z: number, sdZ: number): PercentileEstimate {
  const sd = Number.isFinite(sdZ) && sdZ > 0 ? sdZ : 0;
  const percentile = normCdf(z);
  const lo = normCdf(z - Z_90 * sd);
  const hi = normCdf(z + Z_90 * sd);
  const confidence = confidenceFromSd(sd);
  const band =
    sd > 0 ? ` Range: Top ${topPercent(hi)}% to Top ${topPercent(lo)}% (90% confidence).` : '';
  return {
    percentile,
    topPercent: topPercent(percentile),
    label: topPercentLabel(percentile),
    interval: [lo, hi],
    confidence,
    sdZ: sd,
    explanation: `You are stronger than about ${Math.round(percentile * 1000) / 10}% of ${STANDARDS_META.populationLabel.replace(/^vs\.\s*/, '')}. ${CONFIDENCE_COPY[confidence]}${band}`,
    population: STANDARDS_META.populationLabel,
  };
}

/**
 * Map a rank score and its posterior SD to a percentile estimate.
 * @param score rank score in points
 * @param sdZ posterior SD in z units
 * @returns the same estimate {@link percentileWithConfidence} returns
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3)
 */
export function percentileFromScoreWithConfidence(score: number, sdZ: number): PercentileEstimate {
  return percentileWithConfidence((score - SCORE_INTERCEPT) / SCORE_SLOPE, sdZ);
}

/** Plain-English methodology the UI can surface for anything in this module. */
export const PERCENTILE_METHODOLOGY: Readonly<Record<string, MethodologyNote>> = {
  erf: {
    summary: 'Standard maths routine used to turn a strength score into a population percentage.',
    source: 'Abramowitz & Stegun, Handbook of Mathematical Functions, eq. 7.1.26',
    url: 'https://personal.math.ubc.ca/~cbm/aands/page_299.htm',
  },
  normCdf: {
    summary: 'Converts a standardised strength score into the share of lifters below it.',
    source: 'Abramowitz & Stegun, Handbook of Mathematical Functions, eq. 7.1.26',
    url: 'https://personal.math.ubc.ca/~cbm/aands/page_299.htm',
  },
  normInv: {
    summary: 'Converts a population percentage back into a standardised strength score.',
    source: "Acklam's inverse normal CDF approximation (|relative error| < 1.15e-9)",
    url: 'https://en.wikipedia.org/wiki/Normal_distribution#Generating_values_from_normal_distribution',
  },
  percentileFromZ: {
    summary: 'Places your standardised score against the reference population of app lifters.',
    source: 'strengthlevel.com 2026 refresh — levels are fixed percentile anchors (P5/P20/P50/P80/P95)',
    url: 'https://strengthlevel.com/about',
  },
  percentileFromScore: {
    summary: 'Places your rank score against the reference population of app lifters.',
    source: 'strengthlevel.com 2026 refresh — levels are fixed percentile anchors (P5/P20/P50/P80/P95)',
    url: 'https://strengthlevel.com/about',
  },
  topPercent: {
    summary: 'Turns your percentile into the "Top X%" figure, capped so extrapolated tails never read as Top 0%.',
    source: 'Stronger 2.0 display rule, research brief Part 3',
    url: 'https://strengthlevel.com/about',
  },
  topPercentLabel: {
    summary: 'Formats your percentile as "Top X%".',
    source: 'Stronger 2.0 display rule, research brief Part 3',
    url: 'https://strengthlevel.com/about',
  },
  confidenceFromSd: {
    summary:
      'Decides how much to trust your placement from how much you have logged: fewer sets, fewer sessions, machine-only lifts and stale data all widen the estimate.',
    source: 'Stronger 2.0 labelling gate (posterior SD < 0.35 z, about one sub-tier)',
    url: 'https://strengthlevel.com/about',
  },
  percentileWithConfidence: {
    summary:
      'Gives your percentile against 27M app lifters together with an honest confidence range, which stays wide until you have logged enough.',
    source: 'strengthlevel.com 2026 refresh (195,513,376 lifts / 27,893,268 users)',
    url: 'https://strengthlevel.com/about',
  },
  percentileFromScoreWithConfidence: {
    summary: 'Gives the percentile and confidence range that match a displayed rank score.',
    source: 'strengthlevel.com 2026 refresh (195,513,376 lifts / 27,893,268 users)',
    url: 'https://strengthlevel.com/about',
  },
};
