import type { MuscleShares } from '@/ui/charts/MuscleMap';

/**
 * Community is entirely local. There is no backend, no fetch and no socket in
 * this feature — the fixture accounts below are sample data shipped in the
 * bundle, and the user's own posts are written to the same on-device store the
 * rest of the app uses. Nothing in here should ever be made to *look* like it
 * talked to a server.
 */

export type FeedAuthor = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  /** Sample accounts. Never presented as real people who did something today. */
  sample: true;
  /** Whether the user follows them — drives the Following tab. */
  followed: boolean;
};

/** The user's own posts carry this instead of a fixture author id. */
export const SELF_AUTHOR_ID = 'self';

export type FeedPost = {
  id: string;
  /** A fixture author id, or SELF_AUTHOR_ID. */
  authorId: string;
  createdAt: number;
  caption?: string;
  workoutName: string;
  durationSec: number;
  volumeKg: number;
  totalReps: number;
  totalSets: number;
  exerciseCount: number;
  /** Per-muscle share of the session, 0..1. Drives the muscle map. */
  shares: MuscleShares;
  /** Baseline like count. The user's own like is tracked separately. */
  likes: number;
  comments: number;
  /**
   * Set when this post was shared from the user's own history, so a session
   * cannot be posted twice and can be taken down again.
   */
  sourceWorkoutId?: string;
};

export type Group = {
  id: string;
  name: string;
  initials: string;
  members: number;
  /** True for groups the user created on this device. */
  mine: boolean;
};

/** Normalise raw per-muscle weights into shares summing to 1. */
export function toShares(weights: Readonly<Record<string, number>>): MuscleShares {
  let total = 0;
  for (const v of Object.values(weights)) total += Math.max(0, v);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    if (v > 0) out[k] = v / total;
  }
  return out;
}

/** Two letters from a name, for avatar tiles. Never more than two. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0);
  const first = parts[0];
  if (!first) return '?';
  const second = parts[1];
  const a = first.charAt(0);
  const b = second ? second.charAt(0) : first.charAt(1);
  return (a + (b ?? '')).toUpperCase();
}
