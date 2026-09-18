/**
 * Tiny order statistics used across the scoring module.
 *
 * Deliberately dependency-free and robust-by-default: every aggregate the app
 * shows a user is computed from medians and weighted quantiles rather than
 * means, because a single mistyped weight must never move a trend line or mint
 * a permanent fake PR.
 *
 * Source: research brief §"Utilities" and §"Pick the session best as a
 * confidence-weighted 80th percentile".
 */

/**
 * Median of a sample, in the sample's own units.
 *
 * Returns NaN for an empty sample — an empty sample has no median, and 0 would
 * be a lie ("0 kg" and "—" are different things, per AGENTS.md).
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) {
    const m = sorted[mid];
    return m === undefined ? Number.NaN : m;
  }
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (lo === undefined || hi === undefined) return Number.NaN;
  return (lo + hi) / 2;
}

/**
 * Median absolute deviation, scaled by 1.4826 so it estimates the standard
 * deviation of a normal sample. Units: same as the input.
 *
 * Source: Hampel (1974); the 1.4826 constant is 1/Φ⁻¹(0.75).
 */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const med = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - med)));
}

/**
 * Weighted quantile of an ALREADY-SORTED ascending sample.
 *
 * `values[i]` must pair with `weights[i]`. Walks the cumulative weight and
 * returns the first value at or past the `q` fraction of total weight, so a
 * high-confidence sample counts for more than a guessed one.
 *
 * Returns NaN if the inputs are empty or mismatched in length.
 */
export function weightedQuantile(
  sortedValues: readonly number[],
  weights: readonly number[],
  q: number,
): number {
  if (sortedValues.length === 0 || sortedValues.length !== weights.length) {
    return Number.NaN;
  }
  const last = sortedValues[sortedValues.length - 1];
  const fallback = last === undefined ? Number.NaN : last;
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return fallback;

  const target = Math.min(1, Math.max(0, q)) * total;
  let acc = 0;
  for (let i = 0; i < sortedValues.length; i += 1) {
    const w = weights[i];
    const v = sortedValues[i];
    if (w === undefined || v === undefined) continue;
    acc += Math.max(0, w);
    if (acc >= target) return v;
  }
  return fallback;
}

/** Sum of a sample. Empty sample sums to 0 (an empty total really is zero). */
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Round to 3 decimals. Used only to keep binary-float dust out of values that
 * are compared for equality (plate residuals), never for display.
 */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
