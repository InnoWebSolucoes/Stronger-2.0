/**
 * Deterministic anti-repetition for volume equivalents.
 *
 * Source: docs/research/stronger-2-0-volume-equivalents-system-finish-scre.md,
 * "Deterministic variety needs both a cooldown and a rotation term" and PART 3.
 *
 * There is no `Math.random()` anywhere in this module, and there never can be:
 * the ids chosen for a workout are persisted on that workout, and re-opening a
 * summary years later must render the identical sentence. Everything here is a
 * pure function of (entry id, session index, shown history).
 *
 * Pure TypeScript: no react / react-native / expo imports.
 */

/** Sessions before a previously shown entry is fully free to appear again. */
export const COOLDOWN_SPAN = 8;

/** How many past sessions of shown ids the picker keeps. */
export const HISTORY_DEPTH = 12;

/** One past appearance: entry `id` shown at the user's lifetime workout number `sessionIndex`. */
export interface ShownRecord {
  readonly id: string;
  readonly sessionIndex: number;
}

/**
 * FNV-1a 32-bit hash of a string, returned as an unsigned 32-bit integer.
 * Source: Fowler–Noll–Vo, offset basis 0x811c9dc5, prime 0x01000193.
 * Used only to give each entry a stable, well-spread starting phase — never for security.
 */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 1/φ, the golden-ratio conjugate. The low-discrepancy step used by {@link rotation}. */
export const PHI_INV = 0.6180339887498949;

/**
 * Low-discrepancy per-entry rotation offset in [-1, 1], unitless.
 *
 * Advancing `sessionIndex` by one advances every entry's phase by 1/φ, which
 * spreads entries evenly over time without ever repeating a cycle the user can
 * spot. The same (id, sessionIndex) pair returns the same value forever.
 *
 * Source: research PART 3, `rotation`. Amplitude is deliberately small (weighted
 * 0.12 in the score) so rotation reorders good candidates but can never promote a
 * candidate whose count falls outside the 1.5–40x window.
 */
export function rotation(id: string, sessionIndex: number): number {
  const phase = hash32(id) / 4294967296 + sessionIndex * PHI_INV;
  const u = phase - Math.floor(phase); // positive modulo 1, also correct for negative indices
  return Math.cos(2 * Math.PI * u);
}

/**
 * Penalty in [0, 1] for an entry the user has seen recently.
 * 1.0 if it was shown in the immediately preceding session, decaying linearly to
 * 0 once {@link COOLDOWN_SPAN} sessions have passed. Never negative, so an entry
 * shown in the *future* (a re-render of an older summary) is not rewarded.
 *
 * Source: research PART 3, `cooldownPenalty`.
 */
export function cooldownPenalty(
  id: string,
  history: readonly ShownRecord[],
  sessionIndex: number,
): number {
  let last = Number.NEGATIVE_INFINITY;
  for (const record of history) {
    if (record.id === id && record.sessionIndex > last) last = record.sessionIndex;
  }
  if (!Number.isFinite(last)) return 0;
  const gap = sessionIndex - last;
  if (gap >= COOLDOWN_SPAN || gap < 0) return 0;
  return 1 - gap / COOLDOWN_SPAN;
}

/**
 * Append the ids shown at `sessionIndex` to the history and trim it to the most
 * recent {@link HISTORY_DEPTH} sessions. Returns a new array; the input is untouched.
 *
 * Call this at finish time with the ids that were actually rendered, then persist
 * the result (or just re-query the last 12 workouts' stored ids on next launch).
 */
export function appendShown(
  history: readonly ShownRecord[],
  sessionIndex: number,
  ids: readonly string[],
): ShownRecord[] {
  const next = [...history, ...ids.map((id) => ({ id, sessionIndex }))];
  next.sort((a, b) => a.sessionIndex - b.sessionIndex);
  const cutoff = sessionIndex - HISTORY_DEPTH;
  return next.filter((r) => r.sessionIndex > cutoff);
}

/** Ids seen within the last {@link COOLDOWN_SPAN} sessions, newest first. Useful for debugging a pick. */
export function recentIds(history: readonly ShownRecord[], sessionIndex: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const record of [...history].sort((a, b) => b.sessionIndex - a.sessionIndex)) {
    const gap = sessionIndex - record.sessionIndex;
    if (gap < 0 || gap >= COOLDOWN_SPAN) continue;
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record.id);
  }
  return out;
}

/** Milliseconds in one UTC day. */
const MS_PER_DAY = 86400000;

/**
 * Fallback session index derived from a workout's UTC date (days since the Unix epoch).
 *
 * Use this only when the real lifetime workout number is unknown — a fresh install or a
 * restored account, per the research "Risks" section. It is still fully deterministic:
 * the same workout timestamp always yields the same index, so the same comparison.
 *
 * @param epochMs workout start time in milliseconds since the Unix epoch (injected, never read from a clock here)
 */
export function sessionIndexFromEpochMs(epochMs: number): number {
  if (!Number.isFinite(epochMs)) return 0;
  return Math.floor(epochMs / MS_PER_DAY);
}
