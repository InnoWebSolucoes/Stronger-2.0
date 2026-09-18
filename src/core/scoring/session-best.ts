/**
 * Picking the trustworthy e1RM from a session.
 *
 * A session of one exercise produces many sets and therefore many e1RM
 * samples. Taking the raw MAX of those samples is wrong twice over: a maximum
 * over noisy estimates is upward-biased by construction, and a single mistyped
 * weight becomes a permanent fake PR that anchors the trend line forever.
 *
 * The rule:
 *   1. drop samples below {@link MIN_SAMPLE_CONFIDENCE} when better-sourced
 *      samples exist in the same session;
 *   2. take the confidence-weighted 80th percentile of what remains;
 *   3. cap it at the best sample that came from a confidence ≥ 0.7 source.
 *
 * With the typical 1–3 qualifying sets this reduces to "the best honest set";
 * with 6+ sets it resists one flukey entry.
 *
 * Source: research brief §"Pick the session e1RM as a confidence-weighted 80th
 * percentile capped by the best high-confidence sample, not a raw max".
 */

import type { E1rmSample } from './e1rm';
import { weightedQuantile } from './stats';

/** Quantile used for the session best. Source: research brief §3. */
export const SESSION_BEST_QUANTILE = 0.8;

/** Samples below this confidence are dropped when better ones exist. */
export const MIN_SAMPLE_CONFIDENCE = 0.4;

/** Samples at or above this confidence may set the ceiling. */
export const TRUSTED_SAMPLE_CONFIDENCE = 0.7;

/** Sample counts at or below this fall back to a plain best-of. */
export const SESSION_BEST_SMALL_SAMPLE = 2;

/** The session's chosen e1RM, with enough context to explain the choice. */
export interface SessionBest {
  /** The sample the app should treat as this session's e1RM. */
  sample: E1rmSample;
  /** The confidence-weighted 80th-percentile value, kg, before capping. */
  quantileKg: number;
  /** The ceiling imposed by the best trusted sample, kg. */
  ceilingKg: number;
  /** Samples that survived the confidence filter. */
  consideredCount: number;
  /** Samples dropped for low confidence. */
  droppedCount: number;
  /** True when the raw maximum was rejected in favour of a lower sample. */
  cappedFromMax: boolean;
}

/**
 * Best e1RM for one exercise in one session, or null if there is nothing to
 * pick from.
 *
 * Units: every value is kilograms. The returned `sample` is always one of the
 * inputs — the app shows a real set, never a synthesised number.
 *
 * Source: research brief §3 "sessionBestE1rm".
 */
export function sessionBest(samples: readonly E1rmSample[]): SessionBest | null {
  const finite = samples.filter((s) => Number.isFinite(s.e1rmKg) && s.e1rmKg > 0);
  if (finite.length === 0) return null;

  const strong = finite.filter((s) => s.confidence >= MIN_SAMPLE_CONFIDENCE);
  const pool = strong.length > 0 ? strong : finite;
  const droppedCount = finite.length - pool.length;

  const maxKg = pool.reduce((acc, s) => Math.max(acc, s.e1rmKg), 0);

  if (pool.length <= SESSION_BEST_SMALL_SAMPLE) {
    const best = pickHighest(pool);
    if (best === null) return null;
    return {
      sample: best,
      quantileKg: best.e1rmKg,
      ceilingKg: best.e1rmKg,
      consideredCount: pool.length,
      droppedCount,
      cappedFromMax: false,
    };
  }

  const sorted = [...pool].sort((a, b) => a.e1rmKg - b.e1rmKg);
  const quantileKg = weightedQuantile(
    sorted.map((s) => s.e1rmKg),
    sorted.map((s) => s.confidence),
    SESSION_BEST_QUANTILE,
  );

  const trusted = pool.filter((s) => s.confidence >= TRUSTED_SAMPLE_CONFIDENCE);
  const ceilingKg =
    trusted.length > 0 ? trusted.reduce((acc, s) => Math.max(acc, s.e1rmKg), 0) : maxKg;

  const target = Math.min(Number.isFinite(quantileKg) ? quantileKg : maxKg, ceilingKg);
  const chosen = nearestTo(pool, target);
  if (chosen === null) return null;

  return {
    sample: chosen,
    quantileKg: Number.isFinite(quantileKg) ? quantileKg : maxKg,
    ceilingKg,
    consideredCount: pool.length,
    droppedCount,
    cappedFromMax: chosen.e1rmKg < maxKg - 1e-9,
  };
}

/**
 * Convenience wrapper returning just the chosen sample, matching the shape the
 * rest of the app consumes. Units: kilograms.
 */
export function sessionBestE1rm(samples: readonly E1rmSample[]): E1rmSample | null {
  return sessionBest(samples)?.sample ?? null;
}

/**
 * Session bests for every exercise in a mixed list of samples, keyed by the
 * stable exercise slug.
 *
 * Source: research brief §3.
 */
export function sessionBestsByExercise(
  samples: readonly E1rmSample[],
): Map<string, SessionBest> {
  const byExercise = new Map<string, E1rmSample[]>();
  for (const s of samples) {
    const bucket = byExercise.get(s.exerciseId);
    if (bucket === undefined) byExercise.set(s.exerciseId, [s]);
    else bucket.push(s);
  }
  const out = new Map<string, SessionBest>();
  for (const [exerciseId, bucket] of byExercise) {
    const best = sessionBest(bucket);
    if (best !== null) out.set(exerciseId, best);
  }
  return out;
}

function pickHighest(pool: readonly E1rmSample[]): E1rmSample | null {
  let best: E1rmSample | null = null;
  for (const s of pool) {
    if (best === null || s.e1rmKg > best.e1rmKg) best = s;
  }
  return best;
}

function nearestTo(pool: readonly E1rmSample[], target: number): E1rmSample | null {
  let best: E1rmSample | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const s of pool) {
    const d = Math.abs(s.e1rmKg - target);
    if (d < bestDistance - 1e-12 || (Math.abs(d - bestDistance) <= 1e-12 && best !== null && s.e1rmKg > best.e1rmKg)) {
      best = s;
      bestDistance = d;
    }
  }
  return best;
}
