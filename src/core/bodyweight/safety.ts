/**
 * Weight-goal guardrails. These are a hard constraint of the product, not a
 * configurable nicety, and every rejection carries its source so the UI can
 * show why.
 *
 * Why this module exists: a University of Louisville survey of 105 diagnosed
 * eating-disorder patients found 30% had used MyFitnessPal and believed it
 * contributed to their disorder; 6.78% (1,261/18,601) of one weight-loss app
 * community wanted an underweight target. MyFitnessPal's underweight warning is
 * dismissible. Ours is not: the floor is hard, under-18s get no weight goal at
 * all, and loss is capped at 1% of bodyweight per week.
 *
 * Carrying the citation with every rejection also satisfies Apple Guideline
 * 1.4.1, which requires health calculations to disclose their data and
 * methodology (apps have been rejected for unsourced BMI maths).
 *
 * Sources:
 * - CDC, 1-2 lb/week: https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html
 * - NHS England / NICE, 0.5-1 kg/week sustainable range.
 * - BMI 18.5 underweight threshold (WHO classification, used by NHS/CDC).
 * - ED evidence: https://mhealth.jmir.org/2017/10/e150/ ,
 *   https://pmc.ncbi.nlm.nih.gov/articles/PMC8832499/
 * - Research brief, sections "Eating-disorder risk is measurable...",
 *   "Safe-rate guidance to hard-code" and "Apple Guideline 1.4.1".
 *
 * UNITS: kilograms and metres; rates in kg per week or percent of bodyweight
 * per week.
 */

import { MS_PER_DAY, MS_PER_WEEK, type SmoothedSeries } from './types';
import { trendAtInstant } from './smoothing';

/** A citable guideline backing a guardrail. */
export interface SafetySource {
  /** Stable identifier for analytics and for the in-app "how this works" sheet. */
  readonly id: string;
  /** Issuing body. */
  readonly organisation: string;
  /** What the guidance says, in one sentence, safe to show verbatim. */
  readonly guidance: string;
  /** Canonical URL, or `null` where the research brief cited no single page. */
  readonly url: string | null;
}

/** The guidelines this module enforces. */
export const SAFETY_SOURCES = {
  cdc: {
    id: 'cdc-1-2-lb-per-week',
    organisation: 'CDC',
    guidance:
      'People who lose weight at a gradual, steady pace of about 1 to 2 pounds a week are more likely to keep it off.',
    url: 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html',
  },
  nhsNice: {
    id: 'nhs-nice-0-5-1-kg-per-week',
    organisation: 'NHS England, supported by NICE',
    guidance: '0.5 to 1 kg per week is the sustainable rate of weight loss for most adults.',
    url: null,
  },
  bmiFloor: {
    id: 'bmi-18-5-underweight-threshold',
    organisation: 'WHO BMI classification (used by the NHS and CDC)',
    guidance: 'A BMI below 18.5 is classified as underweight.',
    url: null,
  },
  underEighteen: {
    id: 'no-weight-goals-under-18',
    organisation: 'Stronger 2.0 safety policy',
    guidance:
      'Weight goals are not offered under 18: adolescent weight changes with growth, and app-based weight goal-setting is linked to disordered weight-control behaviour.',
    url: 'https://mhealth.jmir.org/2017/10/e150/',
  },
} as const satisfies Record<string, SafetySource>;

/** BMI below which a goal weight is refused outright. */
export const BMI_UNDERWEIGHT_THRESHOLD = 18.5;

/** Minimum age, in years, for any weight goal at all. */
export const MIN_AGE_FOR_WEIGHT_GOAL_YEARS = 18;

/** Hard cap on weight loss: 1% of current bodyweight per week. */
export const MAX_LOSS_FRACTION_PER_WEEK = 0.01;

/** Lower bound of the NHS/NICE sustainable range, kg per week. */
export const NHS_MIN_LOSS_KG_PER_WEEK = 0.5;

/** Upper bound of the NHS/NICE sustainable range, kg per week. */
export const NHS_MAX_LOSS_KG_PER_WEEK = 1;

/** Exact international pound in kilograms, for restating the CDC range. */
export const KG_PER_POUND = 0.45359237;

/** CDC range restated in kg per week: 1-2 lb = 0.4536-0.9072 kg. */
export const CDC_RANGE_KG_PER_WEEK: readonly [number, number] = [
  1 * KG_PER_POUND,
  2 * KG_PER_POUND,
];

/** Loss rate, in percent of bodyweight per week, above which the detector arms. */
export const RAPID_LOSS_PERCENT_PER_WEEK = 1;

/** Consecutive weeks above {@link RAPID_LOSS_PERCENT_PER_WEEK} before it fires. */
export const RAPID_LOSS_CONSECUTIVE_WEEKS = 3;

/** Tolerance absorbing binary floating-point error in boundary comparisons. */
const EPSILON = 1e-9;

/**
 * Body mass index, kg/m^2.
 *
 * @param kg Bodyweight in kilograms.
 * @param heightM Height in metres.
 * @returns BMI, or `null` for non-finite or non-positive inputs.
 */
export function bmi(kg: number, heightM: number): number | null {
  if (!Number.isFinite(kg) || !Number.isFinite(heightM)) return null;
  if (kg <= 0 || heightM <= 0) return null;
  return kg / (heightM * heightM);
}

/**
 * Lowest goal weight the app will accept: the weight at BMI 18.5 for this
 * height.
 *
 * @param heightM Height in metres.
 * @returns kg, or `null` when height is unusable.
 */
export function minimumSafeGoalKg(heightM: number): number | null {
  if (!Number.isFinite(heightM) || heightM <= 0) return null;
  return BMI_UNDERWEIGHT_THRESHOLD * heightM * heightM;
}

/**
 * Whether a weight is below the BMI 18.5 underweight threshold for a height.
 *
 * @returns `null` when it cannot be determined.
 */
export function isUnderweight(kg: number, heightM: number): boolean | null {
  const value = bmi(kg, heightM);
  if (value === null) return null;
  return value < BMI_UNDERWEIGHT_THRESHOLD - EPSILON;
}

/**
 * Fastest loss the app will accept for a given bodyweight: 1% per week.
 *
 * @param currentKg Current bodyweight, kg.
 * @returns kg per week (a positive magnitude), or `null` for unusable input.
 */
export function maxLossKgPerWeek(currentKg: number): number | null {
  if (!Number.isFinite(currentKg) || currentKg <= 0) return null;
  return currentKg * MAX_LOSS_FRACTION_PER_WEEK;
}

/** Why a goal was refused. */
export type GoalRejectionCode =
  | 'invalid-input'
  | 'under-18'
  | 'height-required'
  | 'below-bmi-floor'
  | 'rate-above-one-percent';

/** Why a goal was accepted but flagged. */
export type GoalWarningCode = 'rate-above-nhs-range' | 'rate-below-nhs-range';

/** A single rejection or warning, with the guidance behind it. */
export interface GoalIssue<Code extends string = string> {
  readonly code: Code;
  /** Plain-language explanation, safe to show verbatim. */
  readonly message: string;
  /** The guideline this rests on. `null` only for malformed input. */
  readonly source: SafetySource | null;
}

/** Result of {@link validateWeightGoal}. */
export interface GoalValidation {
  /** True only when there are no rejections. Warnings do not block. */
  readonly allowed: boolean;
  /** Blocking problems. Empty when allowed. */
  readonly rejections: readonly GoalIssue<GoalRejectionCode>[];
  /** Non-blocking flags the UI should surface. */
  readonly warnings: readonly GoalIssue<GoalWarningCode>[];
  /** Lowest acceptable goal weight, kg, or `null` without a height. */
  readonly minimumSafeGoalKg: number | null;
  /** BMI the goal would produce, or `null` without a height. */
  readonly goalBmi: number | null;
  /** The 1%/week cap in kg per week, or `null` for unusable input. */
  readonly maxLossKgPerWeek: number | null;
  /** Implied loss rate, kg per week, positive for loss. `null` if not supplied. */
  readonly impliedLossKgPerWeek: number | null;
  /** Recommended range, kg per week: NHS 0.5-1 kg clipped by the 1% cap. */
  readonly recommendedLossKgPerWeek: readonly [number, number] | null;
}

/** Inputs for {@link validateWeightGoal}. */
export interface WeightGoalInput {
  /** Current bodyweight, kg. */
  readonly currentKg: number;
  /** Requested goal weight, kg. */
  readonly goalKg: number;
  /** Age in years. Under 18 is refused outright. */
  readonly ageYears: number;
  /** Height in metres. Required to enforce the BMI floor on a loss goal. */
  readonly heightM?: number | null;
  /** Requested rate, kg per week. Positive or negative; magnitude is used. */
  readonly targetRateKgPerWeek?: number | null;
  /** Requested target date, epoch ms UTC. Used with `asOf` if no rate is given. */
  readonly targetDateAt?: number | null;
  /** Instant the request is made, epoch ms UTC. Needed with `targetDateAt`. */
  readonly asOf?: number | null;
}

/**
 * Validates a requested weight goal against every hard guardrail.
 *
 * Rejects, each with its source:
 * - age under 18 (no weight goals at all, in either direction);
 * - a loss goal with no height, because the BMI floor cannot be enforced;
 * - a goal below BMI 18.5 for the given height;
 * - a requested loss faster than 1% of current bodyweight per week.
 *
 * Warns, without blocking, when the requested loss is outside the NHS/NICE
 * 0.5-1 kg per week range but still inside the 1% cap - which happens for
 * heavier users, for whom 1% exceeds 1 kg.
 *
 * Boundaries are inclusive on the safe side: a goal at exactly BMI 18.5, an age
 * of exactly 18, and a rate of exactly 1%/week are all accepted.
 *
 * @param input See {@link WeightGoalInput}. Weights kg, height metres.
 * @returns {@link GoalValidation}.
 */
export function validateWeightGoal(input: WeightGoalInput): GoalValidation {
  const rejections: GoalIssue<GoalRejectionCode>[] = [];
  const warnings: GoalIssue<GoalWarningCode>[] = [];

  const { currentKg, goalKg, ageYears } = input;
  const heightM = input.heightM ?? null;

  const inputsUsable =
    Number.isFinite(currentKg) &&
    currentKg > 0 &&
    Number.isFinite(goalKg) &&
    goalKg > 0 &&
    Number.isFinite(ageYears) &&
    ageYears >= 0;

  if (!inputsUsable) {
    rejections.push({
      code: 'invalid-input',
      message: 'A goal needs a current weight, a goal weight and an age.',
      source: null,
    });
    return {
      allowed: false,
      rejections,
      warnings,
      minimumSafeGoalKg: heightM === null ? null : minimumSafeGoalKg(heightM),
      goalBmi: null,
      maxLossKgPerWeek: null,
      impliedLossKgPerWeek: null,
      recommendedLossKgPerWeek: null,
    };
  }

  const floorKg = heightM === null ? null : minimumSafeGoalKg(heightM);
  const goalBmi = heightM === null ? null : bmi(goalKg, heightM);
  const capKgPerWeek = maxLossKgPerWeek(currentKg);
  const isLossGoal = goalKg < currentKg;

  if (ageYears < MIN_AGE_FOR_WEIGHT_GOAL_YEARS) {
    rejections.push({
      code: 'under-18',
      message:
        'Weight goals are not available under 18. You can still log your weight and see your trend.',
      source: SAFETY_SOURCES.underEighteen,
    });
  }

  if (isLossGoal && (heightM === null || floorKg === null)) {
    rejections.push({
      code: 'height-required',
      message:
        'Add your height first: we check every goal against a BMI 18.5 floor and cannot do that without it.',
      source: SAFETY_SOURCES.bmiFloor,
    });
  } else if (floorKg !== null && goalKg < floorKg - EPSILON) {
    rejections.push({
      code: 'below-bmi-floor',
      message: `That goal would put you below a BMI of ${BMI_UNDERWEIGHT_THRESHOLD}, which is classified as underweight. The lowest goal we can accept for your height is ${floorKg.toFixed(1)} kg.`,
      source: SAFETY_SOURCES.bmiFloor,
    });
  }

  let impliedLossKgPerWeek: number | null = null;
  if (input.targetRateKgPerWeek !== null && input.targetRateKgPerWeek !== undefined) {
    if (Number.isFinite(input.targetRateKgPerWeek)) {
      impliedLossKgPerWeek = Math.abs(input.targetRateKgPerWeek);
    }
  } else if (
    input.targetDateAt !== null &&
    input.targetDateAt !== undefined &&
    input.asOf !== null &&
    input.asOf !== undefined &&
    Number.isFinite(input.targetDateAt) &&
    Number.isFinite(input.asOf) &&
    input.targetDateAt > input.asOf
  ) {
    const weeks = (input.targetDateAt - input.asOf) / MS_PER_WEEK;
    if (weeks > 0) impliedLossKgPerWeek = Math.abs(goalKg - currentKg) / weeks;
  }

  if (impliedLossKgPerWeek !== null && isLossGoal && capKgPerWeek !== null) {
    if (impliedLossKgPerWeek > capKgPerWeek + EPSILON) {
      rejections.push({
        code: 'rate-above-one-percent',
        message: `That pace is about ${impliedLossKgPerWeek.toFixed(2)} kg a week. We cap loss at 1% of bodyweight a week, which is ${capKgPerWeek.toFixed(2)} kg for you. The CDC advises 1-2 lb (0.45-0.91 kg) a week and the NHS 0.5-1 kg a week.`,
        source: SAFETY_SOURCES.cdc,
      });
    } else if (impliedLossKgPerWeek > NHS_MAX_LOSS_KG_PER_WEEK + EPSILON) {
      warnings.push({
        code: 'rate-above-nhs-range',
        message: `${impliedLossKgPerWeek.toFixed(2)} kg a week is above the NHS/NICE sustainable range of 0.5-1 kg a week, though still inside our 1%-of-bodyweight cap.`,
        source: SAFETY_SOURCES.nhsNice,
      });
    } else if (
      impliedLossKgPerWeek > 0 &&
      impliedLossKgPerWeek < NHS_MIN_LOSS_KG_PER_WEEK - EPSILON
    ) {
      warnings.push({
        code: 'rate-below-nhs-range',
        message: `${impliedLossKgPerWeek.toFixed(2)} kg a week is slower than the NHS/NICE range of 0.5-1 kg a week. That is safe, it will just take longer.`,
        source: SAFETY_SOURCES.nhsNice,
      });
    }
  }

  const recommendedLossKgPerWeek: readonly [number, number] | null =
    capKgPerWeek === null
      ? null
      : [
          Math.min(NHS_MIN_LOSS_KG_PER_WEEK, capKgPerWeek),
          Math.min(NHS_MAX_LOSS_KG_PER_WEEK, capKgPerWeek),
        ];

  return {
    allowed: rejections.length === 0,
    rejections,
    warnings,
    minimumSafeGoalKg: floorKg,
    goalBmi,
    maxLossKgPerWeek: capKgPerWeek,
    impliedLossKgPerWeek,
    recommendedLossKgPerWeek,
  };
}

/** One evaluated week for the rapid-loss detector. */
export interface RapidLossWeek {
  /** Start of the week, epoch ms UTC. */
  readonly startAt: number;
  /** End of the week, epoch ms UTC. */
  readonly endAt: number;
  /** Trend weight at the start of the week, kg. */
  readonly startTrendKg: number;
  /** Trend weight at the end of the week, kg. */
  readonly endTrendKg: number;
  /** Loss over the week, kg per week (positive means weight went down). */
  readonly lossKgPerWeek: number;
  /** Loss as a percentage of that week's starting weight (positive means down). */
  readonly lossPercentPerWeek: number;
  /** True when this week alone exceeded the threshold. */
  readonly aboveThreshold: boolean;
}

/** Result of {@link detectRapidLoss}. */
export interface RapidLossResult {
  /** True when the threshold was exceeded for every required consecutive week. */
  readonly triggered: boolean;
  /** Consecutive weeks above the threshold, counting back from the most recent. */
  readonly consecutiveWeeksAbove: number;
  /** The weeks evaluated, oldest first. Empty when it could not be evaluated. */
  readonly weeks: readonly RapidLossWeek[];
  /** Threshold in use, percent of bodyweight per week. */
  readonly thresholdPercentPerWeek: number;
  /** Consecutive weeks required to fire. */
  readonly requiredConsecutiveWeeks: number;
  /** Copy to show when triggered, otherwise `null`. */
  readonly message: string | null;
  /** Guidance behind the threshold when triggered, otherwise `null`. */
  readonly source: SafetySource | null;
  /** Why it could not be evaluated, otherwise `null`. */
  readonly reason: string | null;
}

/** Options for {@link detectRapidLoss}. */
export interface RapidLossOptions {
  /** Instant to evaluate from, epoch ms UTC. Default: the last weigh-in. */
  readonly asOf?: number;
  /** Threshold, percent per week. Default {@link RAPID_LOSS_PERCENT_PER_WEEK}. */
  readonly thresholdPercentPerWeek?: number;
  /** Consecutive weeks required. Default {@link RAPID_LOSS_CONSECUTIVE_WEEKS}. */
  readonly consecutiveWeeks?: number;
}

/**
 * Fires when smoothed bodyweight has fallen faster than 1% per week for three
 * consecutive weeks.
 *
 * Each week is measured on the SMOOTHED series (raw readings would trigger on a
 * single dehydrated morning), between interpolated trend values seven days
 * apart. Every week must contain at least one real weigh-in, and the history
 * must reach back across all three weeks, otherwise the detector reports that
 * it could not evaluate rather than guessing.
 *
 * The threshold is strict: exactly 1.0%/week does not fire.
 *
 * @param series Smoothed series from `smoothWeightSeries`.
 * @param options See {@link RapidLossOptions}.
 * @returns {@link RapidLossResult}.
 */
export function detectRapidLoss(
  series: SmoothedSeries,
  options: RapidLossOptions = {},
): RapidLossResult {
  const thresholdPercentPerWeek =
    options.thresholdPercentPerWeek ?? RAPID_LOSS_PERCENT_PER_WEEK;
  const requiredConsecutiveWeeks = Math.max(
    1,
    Math.floor(options.consecutiveWeeks ?? RAPID_LOSS_CONSECUTIVE_WEEKS),
  );

  const base = {
    triggered: false,
    consecutiveWeeksAbove: 0,
    weeks: [] as readonly RapidLossWeek[],
    thresholdPercentPerWeek,
    requiredConsecutiveWeeks,
    message: null,
    source: null,
  };

  const first = series[0];
  const last = series[series.length - 1];
  if (first === undefined || last === undefined) {
    return { ...base, reason: 'No weigh-ins to evaluate.' };
  }

  const asOf = options.asOf ?? last.at;
  const windowStart = asOf - requiredConsecutiveWeeks * MS_PER_WEEK;
  if (first.at > windowStart) {
    const days = Math.round((asOf - first.at) / MS_PER_DAY);
    return {
      ...base,
      reason: `Only ${days} days of history; ${requiredConsecutiveWeeks * 7} are needed.`,
    };
  }

  const weeks: RapidLossWeek[] = [];
  for (let index = requiredConsecutiveWeeks - 1; index >= 0; index -= 1) {
    const endAt = asOf - index * MS_PER_WEEK;
    const startAt = endAt - MS_PER_WEEK;
    const hasEntry = series.some((point) => point.at > startAt && point.at <= endAt);
    if (!hasEntry) {
      return {
        ...base,
        reason: 'At least one weigh-in is needed in each of the weeks evaluated.',
      };
    }
    const startTrendKg = trendAtInstant(series, startAt);
    const endTrendKg = trendAtInstant(series, endAt);
    if (startTrendKg === undefined || endTrendKg === undefined || startTrendKg <= 0) {
      return { ...base, reason: 'Trend could not be evaluated over this window.' };
    }
    const lossKgPerWeek = startTrendKg - endTrendKg;
    const lossPercentPerWeek = (lossKgPerWeek / startTrendKg) * 100;
    weeks.push({
      startAt,
      endAt,
      startTrendKg,
      endTrendKg,
      lossKgPerWeek,
      lossPercentPerWeek,
      aboveThreshold: lossPercentPerWeek > thresholdPercentPerWeek + EPSILON,
    });
  }

  let consecutiveWeeksAbove = 0;
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    if (weeks[index]?.aboveThreshold === true) consecutiveWeeksAbove += 1;
    else break;
  }

  const triggered = consecutiveWeeksAbove >= requiredConsecutiveWeeks;
  return {
    triggered,
    consecutiveWeeksAbove,
    weeks,
    thresholdPercentPerWeek,
    requiredConsecutiveWeeks,
    message: triggered
      ? `Your weight has been dropping faster than ${thresholdPercentPerWeek}% a week for ${requiredConsecutiveWeeks} weeks running. The NHS suggests 0.5-1 kg a week and the CDC 1-2 lb a week; losing faster than that is hard to sustain. Consider easing off, and speak to a doctor if this was not deliberate.`
      : null,
    source: triggered ? SAFETY_SOURCES.nhsNice : null,
    reason: null,
  };
}
