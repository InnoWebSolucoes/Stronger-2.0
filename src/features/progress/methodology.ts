/**
 * "How this is calculated" copy for every computed health figure on this tab.
 *
 * Apple Guideline 1.4.1 rejects health calculations whose method is not
 * published, and AGENTS.md §6 makes the same rule internal: e1RM, readiness,
 * capacity and percentile each need an in-app disclosure with its citation.
 *
 * `@core/standards` publishes its own map (`STANDARDS_METHODOLOGY`) and it is
 * used verbatim where it covers a number. `@core/scoring`, `@core/readiness`
 * and `@core/bodyweight` do not export one, so the notes below were written
 * against those modules' own doc comments and cited sources rather than by
 * editing `src/core`, which is not this screen's to change.
 */

import { SAFETY_SOURCES } from '@core/bodyweight';
import { STANDARDS_META, methodologyFor } from '@core/standards';

/** One disclosure, as the sheet renders it. */
export interface Disclosure {
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly url: string | null;
}

function fromStandards(key: string, title: string, fallback: Disclosure): Disclosure {
  const note = methodologyFor(key);
  if (note === undefined) return fallback;
  return { title, summary: note.summary, source: note.source, url: note.url };
}

export const E1RM_DISCLOSURE: Disclosure = {
  title: 'How e1RM is estimated',
  summary:
    'Each completed working set is converted to an estimated one-rep max, then the session\'s figure is the confidence-weighted 80th percentile of those estimates, capped by the best well-evidenced set. The estimator blends the weight-dependent equation with the RTS RPE chart, because no single classical formula holds across both a heavy triple and a set of ten. Reps beyond twelve from failure are discarded rather than extrapolated. When RPE is left blank a reps-in-reserve prior is applied by set type — two for a straight working set, zero for a set taken to failure — so a submaximal set is not read as a maximal one. Bodyweight movements are scored on total system load: your bodyweight times the measured fraction actually moved, plus anything added.',
  source:
    'Epley 1985 / Brzycki 1993 via LeSuer et al. 1997 JSCR 11(4):211-213; Reactive Training Systems RPE chart; Nuzzo 2024 meta-regression. Implemented in src/core/scoring.',
  url: null,
};

export const RANK_DISCLOSURE: Disclosure = fromStandards('overallStanding', 'How your rank is set', {
  title: 'How your rank is set',
  summary:
    'Your best lift in each of the six compound movement patterns is scored against the published per-sex, per-bodyweight distribution, corrected for the fact that those patterns are correlated, and combined with a prior so that one logged set cannot produce a rank. Until the estimate is tighter than one sub-tier, a range is shown instead of a rank.',
  source: STANDARDS_META.source,
  url: STANDARDS_META.url,
});

export const PERCENTILE_DISCLOSURE: Disclosure = fromStandards(
  'percentileWithConfidence',
  'How your percentile is set',
  {
    title: 'How your percentile is set',
    summary:
      'The five published strength levels are fixed percentiles, not buckets. Fitting a curve through them recovers the underlying distribution, so your lift becomes a standardised score and that score becomes a percentile, with a confidence band that widens for machines and for stale estimates.',
    source: STANDARDS_META.source,
    url: STANDARDS_META.url,
  },
);

export const LEVEL_DISCLOSURE: Disclosure = fromStandards('classifyLift', 'How a lift is classified', {
  title: 'How a lift is classified',
  summary:
    'Your estimated one-rep max is compared against the published table for your sex and bodyweight, age-graded under 23 and over 40. A classification stays provisional until at least two sets from two separate sessions support it.',
  source: STANDARDS_META.source,
  url: STANDARDS_META.url,
});

export const READINESS_DISCLOSURE: Disclosure = {
  title: 'How readiness is calculated',
  summary:
    'Every completed set deposits fatigue on the muscles it involves, scaled by relative intensity, proximity to failure, eccentric loading and how much tension the movement puts on the muscle at long lengths. That fatigue then decays exponentially on two separate compartments per muscle — structural damage on a slow clock (20-40 hours depending on the muscle) and metabolic fatigue on a fast one (8-13 hours). The percentage is what remains. It is modelled from your training log only: no wearable, heart-rate or sleep data is used here, so treat it as an estimate of training stress, not a medical measurement.',
  source:
    'Two-compartment fatigue/recovery model implemented in src/core/readiness, per docs/research/muscle-readiness-recovery-model-for-stronger-2-0-p.md. Volume landmarks after Israetel (Renaissance Periodization) MV/MEV/MAV/MRV.',
  url: null,
};

export const TREND_DISCLOSURE: Disclosure = {
  title: 'How the weight trend works',
  summary:
    'Daily bodyweight swings by a kilo or more from water, food and glycogen, so the raw scale reading is mostly noise. The line you see is an exponentially weighted moving average with a 10-day time constant — the Hacker\'s Diet method — evaluated in continuous time so that skipping days does not distort it. A Huber gate damps a single wild reading instead of letting it drag the whole line. The kg/week figure is a weighted regression over the last 28 days of that smoothed series, reported with the confidence its sample size actually supports.',
  source:
    "John Walker, The Hacker's Diet (1991), moving-average chapter; Huber robust weighting. Implemented in src/core/bodyweight/smoothing.ts and trend.ts.",
  url: 'https://www.fourmilab.ch/hackdiet/',
};

export const PROJECTION_DISCLOSURE: Disclosure = {
  title: 'How the projection works',
  summary:
    'The projection extends your current smoothed rate of change to your goal and is always shown as a band, never a single date, because the rate itself has a confidence interval. It is capped at 90 days, or twice the history you have logged, whichever is shorter. When the rate cannot be told apart from zero, when it points away from the goal, or when the goal is beyond that horizon, no date is shown at all — a confident-looking date built on four weigh-ins would be a fiction.',
  source: 'Projection band and horizon caps implemented in src/core/bodyweight/projection.ts.',
  url: null,
};

export const GOAL_SAFETY_DISCLOSURE: Disclosure = {
  title: 'How goal limits are set',
  summary: [
    SAFETY_SOURCES.cdc.guidance,
    SAFETY_SOURCES.nhsNice.guidance,
    SAFETY_SOURCES.bmiFloor.guidance,
    SAFETY_SOURCES.underEighteen.guidance,
  ].join(' '),
  source: [
    SAFETY_SOURCES.cdc.organisation,
    SAFETY_SOURCES.nhsNice.organisation,
    SAFETY_SOURCES.bmiFloor.organisation,
  ].join('; '),
  url: SAFETY_SOURCES.cdc.url,
};

export const SPLIT_DISCLOSURE: Disclosure = {
  title: 'How the split is measured',
  summary:
    'Volume is load times reps on every completed working set, credited to each muscle the movement trains, weighted by how much that muscle is involved — full credit to the prime mover, half to a strong synergist, less to a stabiliser. Warm-ups are excluded. "Over-" and "under-worked" are relative to your own all-time split, not to anyone else\'s idea of a balanced programme.',
  source:
    'Volume model in src/core/scoring/volume.ts; involvement weights from the exercise catalog\'s ordered muscle list.',
  url: null,
};
