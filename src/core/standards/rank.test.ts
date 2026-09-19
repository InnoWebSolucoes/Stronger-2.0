import { describe, expect, it } from 'vitest';

import {
  EWMA_ALPHA,
  MAX_DAILY_MOVE,
  RANK_DECAY_POLICY,
  RANK_HYSTERESIS,
  RANK_METHODOLOGY,
  SIGMA_UNMEASURED_PATTERN,
  aggregatePatternZ,
  overallStanding,
  rankFromScore,
  scoreFromZ,
  smoothDisplayScore,
  zFromScore,
} from './rank';
import type { PatternBest } from './rank';
import {
  LABEL_SD_THRESHOLD,
  RANK_LADDER,
  SCORE_CLIP,
  SCORE_INTERCEPT,
  SCORE_SLOPE,
  SCORING_PATTERNS,
  SUB_TIER_WIDTH,
  type Experience,
  type ScoringPattern,
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

describe('scoreFromZ / zFromScore', () => {
  it('puts the median lifter at 36 points and one z unit at 18', () => {
    expect(scoreFromZ(0)).toBe(SCORE_INTERCEPT);
    expect(scoreFromZ(1) - scoreFromZ(0)).toBeCloseTo(SCORE_SLOPE, 10);
  });

  it('clips to the published range', () => {
    expect(scoreFromZ(-99)).toBe(SCORE_CLIP[0]);
    expect(scoreFromZ(99)).toBe(SCORE_CLIP[1]);
  });

  it('round-trips inside the clip', () => {
    for (const z of [-2, -0.833, 0, 0.5, 0.833, 1.667, 2.5]) {
      expect(zFromScore(scoreFromZ(z))).toBeCloseTo(z, 10);
    }
  });
});

describe('rankFromScore', () => {
  it('reproduces the reference UI exactly: 27 points is Novice II, needing 31.0 for Novice III', () => {
    const r = rankFromScore(27);
    expect(r.label).toBe('Novice II');
    expect(r.tier).toBe('Novice');
    expect(r.sub).toBe('II');
    expect(r.nextLabel).toBe('Novice III');
    expect(r.nextAt).toBe(31.0);
    expect(r.pointsToNext).toBe(4.0);
    expect(r.progress).toBeCloseTo(0.2, 10);
  });

  it('rolls over from the last sub-tier of a band into the next band', () => {
    const r = rankFromScore(35.5);
    expect(r.label).toBe('Novice III');
    expect(r.nextLabel).toBe('Intermediate I');
    expect(r.nextAt).toBe(36.0);
  });

  it('puts the band floors on the published percentile anchors', () => {
    expect(rankFromScore(scoreFromZ(0)).label).toBe('Intermediate I');
    expect(rankFromScore(51).label).toBe('Advanced I');
    expect(rankFromScore(66).label).toBe('Elite I');
    expect(rankFromScore(scoreFromZ(0)).percentile).toBeCloseTo(0.5, 6);
    expect(rankFromScore(51).percentile).toBeCloseTo(0.798, 2);
    expect(rankFromScore(66).percentile).toBeCloseTo(0.952, 2);
    for (const band of RANK_LADDER) {
      const r = rankFromScore(band.from);
      expect(r.tier).toBe(band.tier);
      expect(r.floor).toBe(band.from);
      expect(zFromScore(band.from)).toBeCloseTo(band.zFrom, 2);
      expect(r.percentile).toBeCloseTo(band.percentileFrom, 2);
    }
  });

  it('reproduces the reference "Top 80%" reading at 20.85 points', () => {
    const r = rankFromScore(20.85);
    expect(r.percentile).toBeCloseTo(0.2, 2);
    expect(r.topPercent).toBe(80);
  });

  it('covers every score in the ladder with no gap, and never reports a negative distance', () => {
    let previousScore = -1;
    for (let s = 0; s <= 120; s += 0.25) {
      const r = rankFromScore(s);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.score).toBeGreaterThanOrEqual(previousScore);
      previousScore = r.score;
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(1);
      if (r.pointsToNext !== null) expect(r.pointsToNext).toBeGreaterThanOrEqual(0);
      if (r.nextAt !== null) expect(r.nextAt).toBeGreaterThan(s - 1e-9);
    }
  });

  it('has no rank above the top of the ladder', () => {
    const top = rankFromScore(120);
    expect(top.nextLabel).toBeNull();
    expect(top.nextAt).toBeNull();
    expect(top.pointsToNext).toBeNull();
    expect(top.progress).toBe(1);
  });

  it('keeps the ladder itself contiguous and 15 points wide with 5-point sub-tiers', () => {
    RANK_LADDER.forEach((band, i) => {
      const next = RANK_LADDER[i + 1];
      if (next !== undefined) expect(band.to).toBe(next.from);
      if (band.subTiers.length > 0) {
        expect(band.subTiers.length * SUB_TIER_WIDTH).toBe(band.to - band.from);
      }
    });
  });
});

describe('aggregatePatternZ', () => {
  it('reports nothing for no evidence rather than inventing an average', () => {
    const agg = aggregatePatternZ({});
    expect(agg.coverage).toBe(0);
    expect(agg.patterns).toHaveLength(0);
    expect(agg.z).toBe(0);
  });

  it('leaves a single pattern untouched but reports its low coverage', () => {
    const agg = aggregatePatternZ({ horizontal_press: 1.5 });
    expect(agg.z).toBeCloseTo(1.5, 10);
    expect(agg.correlationFactor).toBeCloseTo(1, 10);
    expect(agg.coverage).toBeCloseTo(0.17, 10);
  });

  it('corrects for pattern correlation: being above average everywhere is rarer than anywhere', () => {
    const all: Partial<Record<ScoringPattern, number>> = {};
    for (const p of SCORING_PATTERNS) all[p] = 1;
    const agg = aggregatePatternZ(all);
    expect(agg.meanZ).toBeCloseTo(1, 10);
    expect(agg.correlationFactor).toBeLessThan(1);
    expect(agg.z).toBeGreaterThan(agg.meanZ);
    expect(agg.z).toBeCloseTo(1.159, 3);
    expect(agg.coverage).toBeCloseTo(1, 10);
  });
});

describe('overallStanding cold start', () => {
  const absurd: readonly number[] = [1, 2, 3, 4, 5, 6];

  it('never classifies a brand-new user with one logged set, however heavy the set', () => {
    for (const pattern of SCORING_PATTERNS) {
      for (const z of absurd) {
        for (const experience of EXPERIENCES) {
          // tau 0.01 is a caller claiming an impossibly precise measurement.
          const patterns: PatternBest[] = [{ pattern, z, tau: 0.01 }];
          const standing = overallStanding(experience === undefined ? { patterns } : { patterns, experience });
          expect(standing.state).toBe('calibrating');
          expect(standing.displayLabel).toBe('Calibrating');
          expect(standing.sdZ).toBeGreaterThan(LABEL_SD_THRESHOLD);
          expect(standing.patternsCovered).toBe(1);
          expect(standing.missingPatterns).toHaveLength(SCORING_PATTERNS.length - 1);
        }
      }
    }
  });

  it('shrinks a single wild set toward the declared experience instead of taking it at face value', () => {
    const standing = overallStanding({
      patterns: [{ pattern: 'horizontal_press', z: 4, tau: 0.46 }],
      experience: 'never',
    });
    expect(standing.observedZ).toBeCloseTo(4, 10);
    expect(standing.z).toBeLessThan(standing.observedZ);
    expect(standing.explanation).toContain('Calibrating');
    expect(standing.explanation).toContain('movement patterns');
  });

  it('falls back to the prior alone when there is no evidence at all', () => {
    const standing = overallStanding({ patterns: [], experience: '3_12m' });
    expect(standing.z).toBe(standing.prior.mu);
    expect(standing.sdZ).toBe(standing.prior.sigma);
    expect(standing.coverage).toBe(0);
    expect(standing.state).toBe('calibrating');
    expect(standing.rank.tier).not.toBe('Elite');
  });

  it('treats unmeasured patterns as unknown, not as average', () => {
    expect(SIGMA_UNMEASURED_PATTERN).toBeCloseTo(0.727, 3);
    const one = overallStanding({ patterns: [{ pattern: 'squat', z: 2, tau: 0.3 }], experience: '2_5y' });
    const six = overallStanding({
      patterns: SCORING_PATTERNS.map((pattern) => ({ pattern, z: 2, tau: 0.3 })),
      experience: '2_5y',
    });
    expect(six.sdZ).toBeLessThan(one.sdZ);
    expect(six.coverage).toBeCloseTo(1, 10);
  });
});

describe('overallStanding when the picture is complete', () => {
  const strong: PatternBest[] = SCORING_PATTERNS.map((pattern) => ({ pattern, z: 2.0, tau: 0.2 }));

  it('ranks a fully measured lifter and agrees with the ladder', () => {
    const standing = overallStanding({ patterns: strong, experience: '5y_plus' });
    expect(standing.state).toBe('ranked');
    expect(standing.sdZ).toBeLessThanOrEqual(LABEL_SD_THRESHOLD);
    expect(standing.displayLabel).toBe(standing.rank.label);
    expect(standing.rank.label).toBe(rankFromScore(standing.score).label);
    expect(standing.patternsCovered).toBe(SCORING_PATTERNS.length);
    expect(standing.missingPatterns).toHaveLength(0);
    expect(standing.explanation).toContain(standing.rank.label);
  });

  it('keeps the best lift per pattern when several are supplied', () => {
    const standing = overallStanding({
      patterns: [
        { pattern: 'squat', z: 0.2, tau: 0.3 },
        { pattern: 'squat', z: 1.8, tau: 0.3 },
      ],
      experience: '2_5y',
    });
    expect(standing.observedZ).toBeCloseTo(1.8, 10);
    expect(standing.patternsCovered).toBe(1);
  });
});

describe('rank does not decay', () => {
  it('states the policy explicitly for the disclosure sheet', () => {
    expect(RANK_DECAY_POLICY.scoreDecaysWithInactivity).toBe(false);
    expect(RANK_DECAY_POLICY.confidenceDecaysWithInactivity).toBe(true);
    expect(RANK_DECAY_POLICY.explanation.length).toBeGreaterThan(40);
  });

  it('gives a six-month lay-off the same score, only a wider band', () => {
    const fresh = overallStanding({
      patterns: SCORING_PATTERNS.map((pattern) => ({ pattern, z: 1.5, tau: 0.25, ageDays: 0 })),
      experience: '2_5y',
    });
    const stale = overallStanding({
      patterns: SCORING_PATTERNS.map((pattern) => ({ pattern, z: 1.5, tau: 0.25, ageDays: 365 })),
      experience: '2_5y',
    });
    expect(stale.z).toBeCloseTo(fresh.z, 12);
    expect(stale.score).toBeCloseTo(fresh.score, 12);
    expect(stale.rank.label).toBe(fresh.rank.label);
    expect(stale.percentile.sdZ).toBeGreaterThan(fresh.percentile.sdZ);
  });
});

describe('smoothDisplayScore', () => {
  const t0 = 1_700_000_000_000;
  const day = 864e5;

  it('shows the raw score on first render', () => {
    const state = smoothDisplayScore(null, 42, t0);
    expect(state.shown).toBe(42);
    expect(state.lastLabel).toBe(rankFromScore(42).label);
    expect(state.updatedAt).toBe(t0);
  });

  it('moves a fraction of the way, never all of it', () => {
    const state = smoothDisplayScore({ shown: 40, lastLabel: 'Intermediate I', updatedAt: t0 }, 41, t0 + day);
    expect(state.shown).toBeCloseTo(40 + EWMA_ALPHA * 1, 10);
  });

  it('caps how far the displayed score can move in a day', () => {
    const state = smoothDisplayScore({ shown: 20, lastLabel: 'Novice I', updatedAt: t0 }, 120, t0 + day);
    expect(state.shown).toBeLessThanOrEqual(20 + MAX_DAILY_MOVE + 1e-9);
  });

  it('holds the old label until the boundary is cleared by the hysteresis margin', () => {
    const justOver = smoothDisplayScore({ shown: 35.9, lastLabel: 'Novice III', updatedAt: t0 }, 36.2, t0 + day);
    expect(justOver.shown).toBeGreaterThan(36);
    expect(justOver.shown).toBeLessThan(36 + RANK_HYSTERESIS);
    expect(justOver.lastLabel).toBe('Novice III');
  });

  it('does not strand a held-back label a whole rank behind the score', () => {
    // A label held back by hysteresis sits BELOW its own score. The next update must
    // still measure against the boundary it is waiting on, not the one above it.
    const held = { shown: 36.9, lastLabel: 'Novice III', updatedAt: t0 };
    const after = smoothDisplayScore(held, 38.5, t0 + day);
    expect(after.shown).toBeGreaterThan(36 + RANK_HYSTERESIS);
    expect(after.lastLabel).toBe('Intermediate I');
  });

  it('exposes the floor of the current rank so the boundary is knowable', () => {
    expect(rankFromScore(38.5).floor).toBe(36);
    expect(rankFromScore(27).floor).toBe(26);
    expect(rankFromScore(2).floor).toBe(0);
  });

  it('takes the clock as a parameter and is pure', () => {
    const previous = { shown: 30, lastLabel: 'Novice II', updatedAt: t0 };
    const a = smoothDisplayScore(previous, 33, t0 + day);
    const b = smoothDisplayScore(previous, 33, t0 + day);
    expect(a).toEqual(b);
    expect(previous.shown).toBe(30);
  });
});

describe('disclosure (Apple Guideline 1.4.1)', () => {
  it('publishes a plain-English method and a citable source for every exported calculation', () => {
    for (const key of [
      'scoreFromZ',
      'zFromScore',
      'rankFromScore',
      'aggregatePatternZ',
      'overallStanding',
      'smoothDisplayScore',
    ]) {
      const note = RANK_METHODOLOGY[key];
      expect(note, `missing methodology for ${key}`).toBeDefined();
      expect(note?.summary.length ?? 0).toBeGreaterThan(30);
      expect(note?.source.length ?? 0).toBeGreaterThan(5);
      expect(note?.url ?? '').toMatch(/^https?:\/\//);
    }
  });
});
