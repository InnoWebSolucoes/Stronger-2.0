/**
 * The overall strength score, the named rank ladder, and points to the next rank.
 *
 * SCORE. S = 36 + 18·z, clipped to [0, 120]. One z unit is 18 points, a named band is 15
 * points (0.833 z) and a sub-tier is 5 points. That places the band floors on the
 * published percentile anchors — Intermediate I at exactly the 50th percentile, Advanced I
 * at the 80th, Elite I at the 95th — and reproduces the reference design exactly: a score
 * of 27 is Novice II with Novice III at 31.0, and 20.85 is the 20th percentile, "Top 80%".
 *
 * AGGREGATION. The overall z is the pattern-weighted mean of the six movement patterns
 * DIVIDED BY sqrt(wᵀRw). That divisor is the correction most apps miss: pattern z-scores
 * correlate at 0.58-0.85 within a lifter, so their weighted mean has an SD well below 1.
 * Skip the correction and every consistent lifter is dragged toward the 50th percentile
 * and "Top X%" is simply wrong.
 *
 * COLD START. The corrected z is then combined with a prior on the lifter's overall
 * strength, weighted by how much of the six-pattern picture has actually been measured.
 * One logged set covers 17% of the picture, so its influence is heavily discounted and
 * the result is reported as "Calibrating" with a range — never as a rank.
 *
 * DECAY. Rank does not decay. See {@link RANK_DECAY_POLICY}.
 *
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3)
 * @see https://strengthlevel.com/about
 */

import { stalenessSd } from './classify';
import { normCdf, percentileWithConfidence, topPercent, type PercentileEstimate } from './percentile';
import {
  EXPERIENCE_PRIOR,
  LABEL_SD_THRESHOLD,
  PATTERN_CORRELATION,
  PATTERN_WEIGHTS,
  RANK_LADDER,
  SCORE_CLIP,
  SCORE_INTERCEPT,
  SCORE_SLOPE,
  SCORING_PATTERNS,
  SUB_TIER_WIDTH,
  UNKNOWN_EXPERIENCE_PRIOR,
  type Experience,
  type MethodologyNote,
  type ScoringPattern,
  type StrengthPrior,
} from './standards-data';

/**
 * Residual SD, in z units, of predicting an unmeasured pattern from the measured ones.
 * Derived from the pattern correlation matrix: the mean pairwise correlation is 0.687, so
 * the unexplained part is sqrt(1 − 0.687²) = 0.727. This is what makes a single logged
 * lift an honest 17% of the picture rather than the whole of it.
 */
export const SIGMA_UNMEASURED_PATTERN = 0.727;

/**
 * Rank decay policy — the product decision, deliberately different from the research
 * brief's suggested −0.012 z/week staleness drift.
 *
 * Rank measures demonstrated capability. Nothing except lifting moves it: not a missed
 * week, not a deload, not an injury lay-off, not a streak. What the passage of time does
 * change is how confident the app is that the number is still current, so staleness
 * widens the confidence band and the UI says when the number was last verified. A user
 * who comes back after six months sees the rank they earned, with a "verify it" prompt —
 * not a demotion they did not agree to.
 */
export const RANK_DECAY_POLICY = {
  scoreDecaysWithInactivity: false,
  confidenceDecaysWithInactivity: true,
  explanation:
    'Your rank reflects what you have demonstrated in the gym. It never drops because time passed, only because the reference population changes at a published recalibration. Time away widens the confidence range and asks you to re-verify the lift.',
} as const;

/** Where a score sits on the named ladder. */
export interface RankPosition {
  /** Full display label, e.g. "Novice II". */
  readonly label: string;
  /** Band name, e.g. "Novice". */
  readonly tier: string;
  /** Roman sub-tier, or null in bands without sub-tiers. */
  readonly sub: string | null;
  /** Score, rounded to one decimal for display. */
  readonly score: number;
  /** Label of the next rank up, or null at the top of the ladder. */
  readonly nextLabel: string | null;
  /** Score at which the next rank is reached, or null at the top. */
  readonly nextAt: number | null;
  /** Points still needed for the next rank, or null at the top. */
  readonly pointsToNext: number | null;
  /** Score at which this exact rank begins — the boundary the lifter last crossed. */
  readonly floor: number;
  /** 0-1 progress from the current rank's floor to the next rank. */
  readonly progress: number;
  /** Percentile of the reference population at this score. */
  readonly percentile: number;
  /** The X in "Top X%". */
  readonly topPercent: number;
}

/** Read an array element, failing loudly instead of silently producing NaN. */
function at<T>(values: readonly T[], index: number): T {
  const v = values[index];
  if (v === undefined) throw new RangeError(`index ${index} out of range (length ${values.length})`);
  return v;
}

/**
 * Rank points from a standardised score. S = 36 + 18·z, clipped to [0, 120].
 * @param z standardised score against the reference population
 * @returns rank points
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3)
 */
export function scoreFromZ(z: number): number {
  return Math.max(at(SCORE_CLIP, 0), Math.min(at(SCORE_CLIP, 1), SCORE_INTERCEPT + SCORE_SLOPE * z));
}

/**
 * Standardised score from rank points. Exact inverse of {@link scoreFromZ} inside the clip.
 * @param score rank points
 * @returns the z-score
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3)
 */
export function zFromScore(score: number): number {
  return (score - SCORE_INTERCEPT) / SCORE_SLOPE;
}

/**
 * Place a score on the named rank ladder and compute the points to the next rank.
 *
 * Bands are 15 points wide with three 5-point sub-tiers, so "5.2 pts to Novice III" is a
 * real distance on the same scale as the score itself, not a percentage of a hidden bar.
 *
 * @param score rank points
 * @returns the label, the next rank, the points to it, and the percentile
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 3)
 */
export function rankFromScore(score: number): RankPosition {
  const s = Math.max(at(SCORE_CLIP, 0), Math.min(at(SCORE_CLIP, 1), score));

  let bandIndex = 0;
  for (let i = 0; i < RANK_LADDER.length; i++) {
    if (s >= at(RANK_LADDER, i).from) bandIndex = i;
  }
  const band = at(RANK_LADDER, bandIndex);

  const subIndex =
    band.subTiers.length > 0 ? Math.min(band.subTiers.length - 1, Math.floor((s - band.from) / SUB_TIER_WIDTH)) : -1;
  const sub = subIndex >= 0 ? at(band.subTiers, subIndex) : null;
  const label = sub === null ? band.tier : `${band.tier} ${sub}`;

  let nextAt: number | null = null;
  let nextLabel: string | null = null;
  const floor = subIndex >= 0 ? band.from + subIndex * SUB_TIER_WIDTH : band.from;

  if (subIndex >= 0 && subIndex < band.subTiers.length - 1) {
    nextAt = band.from + (subIndex + 1) * SUB_TIER_WIDTH;
    nextLabel = `${band.tier} ${at(band.subTiers, subIndex + 1)}`;
  } else if (bandIndex < RANK_LADDER.length - 1) {
    const next = at(RANK_LADDER, bandIndex + 1);
    nextAt = next.from;
    nextLabel = next.subTiers.length > 0 ? `${next.tier} ${at(next.subTiers, 0)}` : next.tier;
  }

  const percentile = normCdf(zFromScore(s));
  return {
    label,
    tier: band.tier,
    sub,
    score: Math.round(s * 10) / 10,
    nextLabel,
    nextAt,
    floor,
    pointsToNext: nextAt === null ? null : Math.round((nextAt - s) * 10) / 10,
    progress: nextAt === null ? 1 : (s - floor) / (nextAt - floor),
    percentile,
    topPercent: topPercent(percentile),
  };
}

/** Result of combining the six pattern z-scores into one. */
export interface PatternAggregate {
  /** Correlation-corrected overall z. */
  readonly z: number;
  /** The plain weighted mean, before the correlation correction. */
  readonly meanZ: number;
  /** sqrt(wᵀRw) — the SD of the weighted mean of correlated standard normals. */
  readonly correlationFactor: number;
  /** Total pattern weight actually measured, 0-1. */
  readonly coverage: number;
  /** Which patterns contributed. */
  readonly patterns: readonly ScoringPattern[];
}

/**
 * Combine per-pattern z-scores into one overall z, correcting for the fact that the
 * patterns are correlated (ρ ≈ 0.58-0.85).
 *
 * The weighted mean of k correlated standard normals has SD sqrt(wᵀRw) < 1. Dividing by
 * it restores the unit scale, which is what makes "Top 30%" true rather than "Top 33%":
 * being 0.45 z above average on every single lift is rarer than being 0.45 z above on one.
 *
 * @param zByPattern best z-score for each measured pattern
 * @returns the corrected z, the raw mean, the correlation factor and the coverage
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 10)
 */
export function aggregatePatternZ(zByPattern: Readonly<Partial<Record<ScoringPattern, number>>>): PatternAggregate {
  const present = SCORING_PATTERNS.filter((p) => zByPattern[p] !== undefined);
  if (present.length === 0) {
    return { z: 0, meanZ: 0, correlationFactor: 1, coverage: 0, patterns: [] };
  }

  const coverage = present.reduce((sum, p) => sum + PATTERN_WEIGHTS[p], 0);
  const weights = present.map((p) => PATTERN_WEIGHTS[p] / coverage);

  let meanZ = 0;
  present.forEach((p, i) => {
    const z = zByPattern[p];
    if (z === undefined) return;
    meanZ += at(weights, i) * z;
  });

  let variance = 0;
  present.forEach((p, i) => {
    present.forEach((q, j) => {
      const row = PATTERN_CORRELATION[SCORING_PATTERNS.indexOf(p)];
      if (row === undefined) return;
      const rho = row[SCORING_PATTERNS.indexOf(q)];
      if (rho === undefined) return;
      variance += at(weights, i) * at(weights, j) * rho;
    });
  });

  const correlationFactor = Math.sqrt(Math.max(variance, 1e-6));
  return { z: meanZ / correlationFactor, meanZ, correlationFactor, coverage, patterns: present };
}

/** The best evidence the user has for one movement pattern. */
export interface PatternBest {
  readonly pattern: ScoringPattern;
  /** z-score of the best qualifying lift in this pattern. */
  readonly z: number;
  /** Measurement noise of that lift as a probe of strength, in z units. */
  readonly tau: number;
  /** Days since the lift was performed. Affects the confidence band only, never the score. */
  readonly ageDays?: number;
}

/** Everything the overall standing needs. */
export interface OverallInput {
  readonly patterns: readonly PatternBest[];
  /** Self-declared training history, used as the cold-start prior. */
  readonly experience?: Experience;
}

/** The user's overall world standing. */
export interface OverallStanding {
  /** Posterior mean z after the cold-start prior. */
  readonly z: number;
  /** Posterior SD in z units. */
  readonly sdZ: number;
  /** Rank points from the posterior mean. */
  readonly score: number;
  /** Position on the named ladder. */
  readonly rank: RankPosition;
  /** Percentile with its confidence band. */
  readonly percentile: PercentileEstimate;
  /** Share of the six-pattern picture that has been measured, 0-1. */
  readonly coverage: number;
  /** How many patterns contributed. */
  readonly patternsCovered: number;
  /** Correlation-corrected z from the measurements alone, before the prior. */
  readonly observedZ: number;
  /** sqrt(wᵀRw) for the measured patterns. */
  readonly correlationFactor: number;
  /** 'ranked' once the posterior SD is under one sub-tier, 'calibrating' until then. */
  readonly state: 'ranked' | 'calibrating';
  /** What to render: the rank label, or "Calibrating". */
  readonly displayLabel: string;
  /** Rank labels one posterior SD either side, for the calibrating range. */
  readonly rangeLabels: readonly [string, string];
  /** The prior that was applied. */
  readonly prior: StrengthPrior;
  /** Patterns with no qualifying lift yet. */
  readonly missingPatterns: readonly ScoringPattern[];
  /** Plain-English sentence the UI can surface verbatim. */
  readonly explanation: string;
}

/**
 * The user's overall world standing: score, rank, points to next rank and percentile,
 * with cold-start shrinkage so a single logged set cannot crown anyone Elite.
 *
 * The measured patterns are aggregated with the correlation correction, then treated as
 * one noisy observation of the lifter's latent strength with SD
 * sqrt(measurement² + (0.727·uncovered)²) — measurement error plus the residual
 * uncertainty of everything not yet measured. That is combined with the experience prior
 * in the usual precision-weighted way. With all six patterns logged across several
 * sessions the prior is irrelevant; with one set it dominates, which is the point.
 *
 * Staleness never enters the mean. See {@link RANK_DECAY_POLICY}.
 *
 * @param input the per-pattern bests and the self-declared experience level
 * @returns the full standing, including UI copy and the calibrating range
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Parts 3 and 5)
 */
export function overallStanding(input: OverallInput): OverallStanding {
  const prior = input.experience === undefined ? UNKNOWN_EXPERIENCE_PRIOR : EXPERIENCE_PRIOR[input.experience];

  const zByPattern: Partial<Record<ScoringPattern, number>> = {};
  const tauByPattern: Partial<Record<ScoringPattern, number>> = {};
  const staleByPattern: Partial<Record<ScoringPattern, number>> = {};
  for (const best of input.patterns) {
    const existing = zByPattern[best.pattern];
    if (existing === undefined || best.z > existing) {
      zByPattern[best.pattern] = best.z;
      tauByPattern[best.pattern] = best.tau;
      staleByPattern[best.pattern] = best.ageDays ?? 0;
    }
  }

  const aggregate = aggregatePatternZ(zByPattern);
  const missingPatterns = SCORING_PATTERNS.filter((p) => zByPattern[p] === undefined);

  // Measurement noise propagated through the same linear map as the mean.
  let measurementVariance = 0;
  let stalenessVariance = 0;
  if (aggregate.patterns.length > 0) {
    for (const p of aggregate.patterns) {
      const w = PATTERN_WEIGHTS[p] / aggregate.coverage;
      const tau = tauByPattern[p] ?? 0.5;
      measurementVariance += w * w * tau * tau;
      const stale = stalenessSd(staleByPattern[p] ?? 0);
      stalenessVariance += w * w * stale * stale;
    }
    const scale = aggregate.correlationFactor * aggregate.correlationFactor;
    measurementVariance /= scale;
    stalenessVariance /= scale;
  }

  const uncovered = Math.max(0, 1 - aggregate.coverage);
  const unmeasuredSd = SIGMA_UNMEASURED_PATTERN * uncovered;
  const observationVariance = measurementVariance + unmeasuredSd * unmeasuredSd;

  let z: number;
  let sdZ: number;
  if (aggregate.patterns.length === 0 || observationVariance <= 0) {
    z = prior.mu;
    sdZ = prior.sigma;
  } else {
    const obsPrecision = 1 / observationVariance;
    const priorPrecision = 1 / (prior.sigma * prior.sigma);
    const precision = obsPrecision + priorPrecision;
    z = (aggregate.z * obsPrecision + prior.mu * priorPrecision) / precision;
    sdZ = Math.sqrt(1 / precision);
  }

  const score = scoreFromZ(z);
  const rank = rankFromScore(score);
  const state: 'ranked' | 'calibrating' = sdZ <= LABEL_SD_THRESHOLD ? 'ranked' : 'calibrating';
  const lo = rankFromScore(scoreFromZ(z - sdZ)).label;
  const hi = rankFromScore(scoreFromZ(z + sdZ)).label;

  // The band the UI shows includes staleness; the score above deliberately does not.
  const percentile = percentileWithConfidence(z, Math.sqrt(sdZ * sdZ + stalenessVariance));

  const explanation =
    state === 'ranked'
      ? `${rank.label} · ${rank.score} pts${rank.pointsToNext === null ? '' : ` · ${rank.pointsToNext} to ${rank.nextLabel ?? ''}`}. Based on ${aggregate.patterns.length} of ${SCORING_PATTERNS.length} movement patterns, ${percentile.label} of app lifters.`
      : `Calibrating — somewhere between ${lo} and ${hi}. ${missingPatterns.length} of ${SCORING_PATTERNS.length} movement patterns have no logged lift yet, so this is an estimate, not a rank.`;

  return {
    z,
    sdZ,
    score,
    rank,
    percentile,
    coverage: aggregate.coverage,
    patternsCovered: aggregate.patterns.length,
    observedZ: aggregate.z,
    correlationFactor: aggregate.correlationFactor,
    state,
    displayLabel: state === 'ranked' ? rank.label : 'Calibrating',
    rangeLabels: [lo, hi],
    prior,
    missingPatterns,
    explanation,
  };
}

/** Persisted state for the smoothed, hysteresis-guarded display score. */
export interface DisplayState {
  /** Score currently shown to the user. */
  readonly shown: number;
  /** Label currently shown, which may lag `shown` because of hysteresis. */
  readonly lastLabel: string;
  /** Epoch milliseconds of the last update. */
  readonly updatedAt: number;
}

/** EWMA weight on the newest computed score. */
export const EWMA_ALPHA = 0.35;
/** Points a score must clear a rank boundary by before the label flips. */
export const RANK_HYSTERESIS = 1.0;
/** Maximum points the displayed score may move per day. */
export const MAX_DAILY_MOVE = 3.0;

/**
 * Smooth the displayed score and suppress label flapping.
 *
 * A raw score recomputed after every set jitters: an e1RM from a five-rep set is not the
 * same number as one from a triple. This applies an EWMA, caps the daily movement, and
 * requires a boundary to be cleared by {@link RANK_HYSTERESIS} points before the label
 * changes — so a user does not watch "Novice III" flicker on and off between sets.
 *
 * Time is injected, never read: `src/core` has no clock.
 *
 * @param previous the persisted display state, or null on first render
 * @param rawScore the freshly computed score
 * @param now epoch milliseconds, supplied by the caller
 * @returns the new display state to persist and render
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 12)
 */
export function smoothDisplayScore(previous: DisplayState | null, rawScore: number, now: number): DisplayState {
  if (previous === null) {
    return { shown: rawScore, lastLabel: rankFromScore(rawScore).label, updatedAt: now };
  }
  let next = previous.shown + EWMA_ALPHA * (rawScore - previous.shown);
  const days = Math.max((now - previous.updatedAt) / 864e5, 0.25);
  const cap = MAX_DAILY_MOVE * days;
  next = Math.max(previous.shown - cap, Math.min(previous.shown + cap, next));

  const candidate = rankFromScore(next);
  let label = candidate.label;
  // Promote only once the boundary INTO the candidate rank has been cleared by the
  // hysteresis margin. The boundary must come from the candidate, not from the previous
  // score: a label already held back sits below its own score, and measuring from that
  // score would pin it to the boundary above and strand the label a whole rank behind.
  if (candidate.label !== previous.lastLabel && next > previous.shown) {
    if (next < candidate.floor + RANK_HYSTERESIS) label = previous.lastLabel;
  }
  return { shown: next, lastLabel: label, updatedAt: now };
}

/** Plain-English methodology the UI can surface for anything in this module. */
export const RANK_METHODOLOGY: Readonly<Record<string, MethodologyNote>> = {
  scoreFromZ: {
    summary:
      'Turns your standardised strength into points: 36 points is the median lifter, every 18 points is one standard deviation, and each named rank is 15 points wide.',
    source: 'Stronger 2.0 rank scale, calibrated to the published percentile anchors',
    url: 'https://strengthlevel.com/about',
  },
  zFromScore: {
    summary: 'Converts rank points back into a standardised score.',
    source: 'Stronger 2.0 rank scale, calibrated to the published percentile anchors',
    url: 'https://strengthlevel.com/about',
  },
  rankFromScore: {
    summary:
      'Names your rank and sub-tier and tells you exactly how many points remain to the next one, on the same scale as the score itself.',
    source: 'Stronger 2.0 rank ladder (15-point bands, three 5-point sub-tiers)',
    url: 'https://strengthlevel.com/about',
  },
  aggregatePatternZ: {
    summary:
      'Combines your best lift in each movement pattern into one number, correcting for the fact that strong lifters tend to be strong at everything — without that correction everyone is squashed toward average.',
    source: 'Pattern correlation matrix (ρ = 0.58-0.85), research brief Part 2',
    url: 'https://symmetricstrength.com/about',
  },
  overallStanding: {
    summary:
      'Your overall standing against 27M app lifters. Patterns you have not trained are treated as unknown rather than assumed average, so the app says "calibrating" instead of guessing until you have logged enough.',
    source: 'strengthlevel.com 2026 refresh; Symmetric Strength category-average design',
    url: 'https://strengthlevel.com/about',
  },
  smoothDisplayScore: {
    summary:
      'Smooths the displayed score so it does not jump around between sets, and requires a rank boundary to be properly cleared before the label changes.',
    source: 'Stronger 2.0 display guard rails, research brief Part 5 section 12',
    url: 'https://strengthlevel.com/about',
  },
};
