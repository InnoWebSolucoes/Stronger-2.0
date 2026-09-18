/**
 * Shared types and time primitives for the bodyweight analytics engine.
 *
 * Pure TypeScript: zero imports from react / react-native / expo-* (AGENTS.md §2).
 *
 * UNITS: every weight in this module is KILOGRAMS, the canonical stored unit
 * (AGENTS.md, "Weights are stored in kg as the canonical unit, always"). No
 * function here converts to pounds; display conversion belongs to the render
 * layer and a stored value is never round-tripped through another unit.
 *
 * TIME: every instant is epoch milliseconds in UTC. Calendar-day bucketing
 * takes an explicit UTC offset parameter, because `src/core` may not read the
 * device clock or time zone.
 */

/** Milliseconds in one 24-hour day. */
export const MS_PER_DAY = 86_400_000;

/** Milliseconds in one 7-day week. */
export const MS_PER_WEEK = MS_PER_DAY * 7;

/** A single bodyweight observation as stored by the app. */
export interface WeightEntry {
  /** Instant of the weigh-in, epoch milliseconds UTC. */
  readonly at: number;
  /** Bodyweight in kilograms. Canonical unit; never converted in storage. */
  readonly kg: number;
}

/** One weigh-in after exponential smoothing. See `smoothing.ts`. */
export interface SmoothedPoint {
  /** Instant of the weigh-in, epoch milliseconds UTC. */
  readonly at: number;
  /** The raw scale reading, kg. */
  readonly kg: number;
  /** The smoothed trend value at this instant, kg. */
  readonly trendKg: number;
  /** `kg` minus the trend carried in from the previous point, kg. */
  readonly residualKg: number;
  /**
   * Huber weight applied to this reading's deviation from the recent residual
   * median, in (0, 1]. 1 means the reading was accepted in full; below 1 means
   * the outlier gate damped it.
   */
  readonly gateFactor: number;
  /** True when the Huber gate damped this reading (i.e. `gateFactor < 1`). */
  readonly isOutlier: boolean;
  /** Days elapsed since the previous weigh-in. 0 for the first point. */
  readonly deltaDays: number;
}

/** A smoothed weigh-in series, ordered ascending by `at`. */
export type SmoothedSeries = readonly SmoothedPoint[];

/**
 * How much the underlying data supports a derived number.
 *
 * `none` means "do not show this figure at all" — it is not a synonym for zero.
 * Per AGENTS.md, "0 kg" and "—" are different things.
 */
export type ConfidenceLevel = 'none' | 'low' | 'moderate' | 'high';

/** Narrowing guard: a finite instant and a strictly positive, finite weight. */
export function isUsableWeightEntry(entry: WeightEntry | null | undefined): entry is WeightEntry {
  if (entry === null || entry === undefined) return false;
  if (!Number.isFinite(entry.at)) return false;
  if (!Number.isFinite(entry.kg)) return false;
  return entry.kg > 0;
}

/**
 * Sorts entries ascending by instant without mutating the input.
 *
 * `Array.prototype.sort` is specified stable (ES2019), so entries sharing an
 * instant keep their original relative order.
 */
export function sortEntriesAscending(entries: readonly WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.at - b.at);
}

/**
 * Drops unusable rows (NaN instants, non-finite or non-positive weights) and
 * returns the remainder sorted ascending.
 *
 * Nothing is imputed: missing weigh-ins stay missing. Imputation is documented
 * to cause "large underestimations of body-weight variability due to regression
 * toward the mean" (JMIR smart-scale validation study), so gaps are handled by
 * the Δt-aware smoothing exponent instead.
 */
export function normaliseEntries(entries: readonly WeightEntry[]): WeightEntry[] {
  return sortEntriesAscending(entries.filter(isUsableWeightEntry));
}

/** Signed elapsed days from instant `fromAt` to instant `toAt`. */
export function daysBetween(fromAt: number, toAt: number): number {
  return (toAt - fromAt) / MS_PER_DAY;
}

/**
 * Calendar-day bucket for an instant, as an integer count of local days since
 * the Unix epoch.
 *
 * @param at Instant, epoch ms UTC.
 * @param utcOffsetMinutes Minutes to add to UTC to reach the user's local time
 *   (e.g. `60` for UTC+1, `-300` for UTC-5). Supplied by the caller because
 *   `src/core` may not read the device time zone.
 */
export function localDayIndex(at: number, utcOffsetMinutes = 0): number {
  return Math.floor((at + utcOffsetMinutes * 60_000) / MS_PER_DAY);
}

/** Instant (epoch ms UTC) of the start of the given local calendar day. */
export function startOfLocalDayMs(dayIndex: number, utcOffsetMinutes = 0): number {
  return dayIndex * MS_PER_DAY - utcOffsetMinutes * 60_000;
}
