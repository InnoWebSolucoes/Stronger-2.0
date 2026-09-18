/**
 * Headline bodyweight statistics for the Bodyweight tab: overall change,
 * average, all-time range, and the tracking-consistency data behind the
 * heatmap.
 *
 * Every function works on RAW entries rather than smoothed values, because
 * these are statements about what was actually recorded ("your lightest
 * weigh-in was 78.2 kg"), not about the trend. The trend belongs to
 * `smoothing.ts` and `trend.ts`.
 *
 * Nothing here imputes a missing day. Imputation is documented to produce
 * "large underestimations of body-weight variability due to regression toward
 * the mean" (JMIR smart-scale simulation/validation study), which would corrupt
 * exactly the range and consistency numbers this module reports.
 *
 * Every figure that can be zero has a distinct "no data" representation
 * (`null`), because per AGENTS.md "0 kg" and "-" are different things.
 *
 * UNITS: kilograms; instants are epoch ms UTC; calendar bucketing takes an
 * explicit UTC offset because `src/core` may not read the device time zone.
 */

import {
  MS_PER_DAY,
  localDayIndex,
  normaliseEntries,
  startOfLocalDayMs,
  type WeightEntry,
} from './types';

/** Change between the first and last weigh-in in a set. */
export interface OverallChange {
  /** First recorded weight, kg. */
  readonly firstKg: number;
  /** Instant of the first weigh-in, epoch ms UTC. */
  readonly firstAt: number;
  /** Latest recorded weight, kg. */
  readonly lastKg: number;
  /** Instant of the latest weigh-in, epoch ms UTC. */
  readonly lastAt: number;
  /** lastKg - firstKg, kg. Negative means lost. */
  readonly changeKg: number;
  /** Change as a percentage of the first weight. Negative means lost. */
  readonly changePercent: number;
  /** Days from the first to the last weigh-in. */
  readonly spanDays: number;
  /** Usable weigh-ins counted. */
  readonly entryCount: number;
}

/** Lightest and heaviest weigh-in in a set. */
export interface WeightRange {
  /** Lightest recorded weight, kg. */
  readonly minKg: number;
  /** Instant of the lightest weigh-in, epoch ms UTC. */
  readonly minAt: number;
  /** Heaviest recorded weight, kg. */
  readonly maxKg: number;
  /** Instant of the heaviest weigh-in, epoch ms UTC. */
  readonly maxAt: number;
  /** maxKg - minKg, kg. Always >= 0. */
  readonly rangeKg: number;
}

/** One cell of the tracking heatmap: a single local calendar day. */
export interface ConsistencyDay {
  /** Local calendar day as an integer count of days since the epoch. */
  readonly dayIndex: number;
  /** Instant of the start of that local day, epoch ms UTC. */
  readonly startAt: number;
  /** Weigh-ins recorded that day. 0 for an empty cell. */
  readonly entryCount: number;
  /** Mean of that day's weigh-ins, kg, or `null` when none were recorded. */
  readonly meanKg: number | null;
}

/** Tracking consistency over a window, feeding the heatmap. */
export interface TrackingConsistency {
  /** One cell per day in the window, ascending. Empty days included by default. */
  readonly days: readonly ConsistencyDay[];
  /** First local day in the window. */
  readonly fromDayIndex: number;
  /** Last local day in the window, inclusive. */
  readonly toDayIndex: number;
  /** Days in the window, inclusive of both ends. */
  readonly daysInPeriod: number;
  /** Days in the window with at least one weigh-in. */
  readonly daysLogged: number;
  /** daysLogged / daysInPeriod as a percentage, 0-100. */
  readonly consistencyPercent: number;
  /** Consecutive logged days ending at the window's last day (one grace day; see notes). */
  readonly currentStreakDays: number;
  /** Longest run of consecutive logged days in the window. */
  readonly longestStreakDays: number;
  /** Longest run of consecutive unlogged days in the window. */
  readonly longestGapDays: number;
  /** Average weigh-ins per week over the window. */
  readonly logsPerWeek: number;
}

/** Options for {@link trackingConsistency}. */
export interface ConsistencyOptions {
  /**
   * Minutes to add to UTC for the user's local time (60 for UTC+1). Required in
   * spirit: a heatmap drawn in the wrong time zone puts weigh-ins on the wrong
   * squares. Defaults to 0 (UTC).
   */
  readonly utcOffsetMinutes?: number;
  /** Window start instant, epoch ms UTC. Default: the first weigh-in. */
  readonly fromAt?: number;
  /** Window end instant, epoch ms UTC. Default: the last weigh-in. */
  readonly toAt?: number;
  /** Emit cells for days with no weigh-in. Default true (the heatmap needs them). */
  readonly includeEmptyDays?: boolean;
}

/**
 * Change between the first and last weigh-in.
 *
 * @param entries Raw weigh-ins, kg, any order.
 * @returns {@link OverallChange}, or `null` when there are no usable entries.
 *   A single entry yields a change of 0 over a span of 0 days - which the UI
 *   should render as "-", not as "0.0 kg".
 */
export function overallChange(entries: readonly WeightEntry[]): OverallChange | null {
  const clean = normaliseEntries(entries);
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first === undefined || last === undefined) return null;

  const changeKg = last.kg - first.kg;
  return {
    firstKg: first.kg,
    firstAt: first.at,
    lastKg: last.kg,
    lastAt: last.at,
    changeKg,
    changePercent: first.kg > 0 ? (changeKg / first.kg) * 100 : 0,
    spanDays: (last.at - first.at) / MS_PER_DAY,
    entryCount: clean.length,
  };
}

/**
 * Arithmetic mean of the weigh-ins, kg.
 *
 * Note this is a mean over ENTRIES, not over time: a week of twice-daily
 * weighing counts twice as much as a week of daily weighing. Use
 * {@link timeWeightedAverageKg} when the sampling is irregular.
 *
 * @returns kg, or `null` when there are no usable entries.
 */
export function averageKg(entries: readonly WeightEntry[]): number | null {
  const clean = normaliseEntries(entries);
  if (clean.length === 0) return null;
  const total = clean.reduce((sum, entry) => sum + entry.kg, 0);
  return total / clean.length;
}

/**
 * Time-weighted mean weight, kg: the area under the linearly interpolated
 * weight curve divided by the elapsed time (trapezoidal rule). Unbiased when
 * weigh-ins are irregularly spaced.
 *
 * @returns kg, or `null` when there are no usable entries. With a single entry,
 *   or several at one instant, it returns that weight.
 */
export function timeWeightedAverageKg(entries: readonly WeightEntry[]): number | null {
  const clean = normaliseEntries(entries);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0]?.kg ?? null;

  let area = 0;
  let duration = 0;
  for (let i = 1; i < clean.length; i += 1) {
    const left = clean[i - 1];
    const right = clean[i];
    if (left === undefined || right === undefined) continue;
    const dt = right.at - left.at;
    if (dt <= 0) continue;
    area += ((left.kg + right.kg) / 2) * dt;
    duration += dt;
  }
  if (duration <= 0) return averageKg(clean);
  return area / duration;
}

/**
 * Lightest and heaviest weigh-ins on record.
 *
 * Ties resolve to the EARLIEST instant, so "lightest ever" points at when it
 * was first reached.
 *
 * @returns {@link WeightRange}, or `null` when there are no usable entries.
 */
export function allTimeRange(entries: readonly WeightEntry[]): WeightRange | null {
  const clean = normaliseEntries(entries);
  const seed = clean[0];
  if (seed === undefined) return null;

  let minKg = seed.kg;
  let minAt = seed.at;
  let maxKg = seed.kg;
  let maxAt = seed.at;
  for (const entry of clean) {
    if (entry.kg < minKg) {
      minKg = entry.kg;
      minAt = entry.at;
    }
    if (entry.kg > maxKg) {
      maxKg = entry.kg;
      maxAt = entry.at;
    }
  }
  return { minKg, minAt, maxKg, maxAt, rangeKg: maxKg - minKg };
}

/**
 * Buckets weigh-ins into local calendar days.
 *
 * @param entries Raw weigh-ins.
 * @param utcOffsetMinutes Minutes to add to UTC for local time.
 * @returns Map from local day index (days since the epoch) to that day's
 *   entries, in ascending instant order.
 */
export function groupByLocalDay(
  entries: readonly WeightEntry[],
  utcOffsetMinutes = 0,
): Map<number, WeightEntry[]> {
  const byDay = new Map<number, WeightEntry[]>();
  for (const entry of normaliseEntries(entries)) {
    const day = localDayIndex(entry.at, utcOffsetMinutes);
    const bucket = byDay.get(day);
    if (bucket === undefined) byDay.set(day, [entry]);
    else bucket.push(entry);
  }
  return byDay;
}

/**
 * Keeps only the first weigh-in of each local day.
 *
 * First-of-day de-duplication is how we reconcile our own entries with peer
 * sources (HealthKit / Health Connect), which can write several readings a day.
 *
 * @param entries Raw weigh-ins.
 * @param utcOffsetMinutes Minutes to add to UTC for local time.
 * @returns One entry per local day, ascending.
 */
export function firstEntryPerLocalDay(
  entries: readonly WeightEntry[],
  utcOffsetMinutes = 0,
): WeightEntry[] {
  const out: WeightEntry[] = [];
  let lastDay: number | null = null;
  for (const entry of normaliseEntries(entries)) {
    const day = localDayIndex(entry.at, utcOffsetMinutes);
    if (day === lastDay) continue;
    lastDay = day;
    out.push(entry);
  }
  return out;
}

/**
 * Tracking consistency over a window: the heatmap cells plus streaks.
 *
 * Streak rule: `currentStreakDays` counts back from the window's last day. If
 * that last day has no weigh-in the count starts from the day before instead -
 * one grace day - because a streak should not read as broken at 09:00 before
 * the user has stepped on the scale. A second consecutive missed day breaks it.
 *
 * @param entries Raw weigh-ins, kg.
 * @param options Time zone offset and window; see {@link ConsistencyOptions}.
 * @returns {@link TrackingConsistency}. With no entries and no explicit window,
 *   every count is 0 and `days` is empty.
 */
export function trackingConsistency(
  entries: readonly WeightEntry[],
  options: ConsistencyOptions = {},
): TrackingConsistency {
  const utcOffsetMinutes = options.utcOffsetMinutes ?? 0;
  const includeEmptyDays = options.includeEmptyDays ?? true;
  const clean = normaliseEntries(entries);
  const byDay = groupByLocalDay(clean, utcOffsetMinutes);

  const firstEntry = clean[0];
  const lastEntry = clean[clean.length - 1];
  const fromAt = options.fromAt ?? firstEntry?.at;
  const toAt = options.toAt ?? lastEntry?.at;

  if (fromAt === undefined || toAt === undefined) {
    return {
      days: [],
      fromDayIndex: 0,
      toDayIndex: 0,
      daysInPeriod: 0,
      daysLogged: 0,
      consistencyPercent: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
      longestGapDays: 0,
      logsPerWeek: 0,
    };
  }

  const fromDayIndex = localDayIndex(fromAt, utcOffsetMinutes);
  const toDayIndex = Math.max(fromDayIndex, localDayIndex(toAt, utcOffsetMinutes));
  const daysInPeriod = toDayIndex - fromDayIndex + 1;

  const days: ConsistencyDay[] = [];
  const logged: boolean[] = [];
  let daysLogged = 0;
  let entriesInPeriod = 0;
  let longestStreakDays = 0;
  let longestGapDays = 0;
  let streak = 0;
  let gap = 0;

  for (let day = fromDayIndex; day <= toDayIndex; day += 1) {
    const bucket = byDay.get(day) ?? [];
    const entryCount = bucket.length;
    const hasEntries = entryCount > 0;
    logged.push(hasEntries);

    if (hasEntries) {
      daysLogged += 1;
      entriesInPeriod += entryCount;
      streak += 1;
      longestStreakDays = Math.max(longestStreakDays, streak);
      gap = 0;
    } else {
      streak = 0;
      gap += 1;
      longestGapDays = Math.max(longestGapDays, gap);
    }

    if (hasEntries || includeEmptyDays) {
      days.push({
        dayIndex: day,
        startAt: startOfLocalDayMs(day, utcOffsetMinutes),
        entryCount,
        meanKg: hasEntries
          ? bucket.reduce((sum, entry) => sum + entry.kg, 0) / entryCount
          : null,
      });
    }
  }

  let cursor = logged.length - 1;
  if (cursor >= 0 && logged[cursor] === false) cursor -= 1; // one grace day
  let currentStreakDays = 0;
  while (cursor >= 0 && logged[cursor] === true) {
    currentStreakDays += 1;
    cursor -= 1;
  }

  return {
    days,
    fromDayIndex,
    toDayIndex,
    daysInPeriod,
    daysLogged,
    consistencyPercent: daysInPeriod > 0 ? (daysLogged / daysInPeriod) * 100 : 0,
    currentStreakDays,
    longestStreakDays,
    longestGapDays,
    logsPerWeek: daysInPeriod > 0 ? (entriesInPeriod / daysInPeriod) * 7 : 0,
  };
}
