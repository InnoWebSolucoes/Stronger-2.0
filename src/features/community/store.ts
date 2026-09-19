import { create } from 'zustand';
import { loadRaw, saveRaw } from '@/features/workout/storage';
import { muscleShares } from '@/ui/charts/MuscleMap';
import type { CompletedWorkout } from '@/features/workout/types';
import { FIXTURE_AUTHORS, FIXTURE_GROUPS, fixturePosts } from './fixtures';
import { SELF_AUTHOR_ID, initialsOf, type FeedAuthor, type FeedPost, type Group } from './types';

const KEY = 'community';

/**
 * Local community store.
 *
 * Follows the same shape as `@/features/routines/store`: zustand for state,
 * loadRaw/saveRaw for durability, fire-and-forget writes. There is no network
 * layer because there is no backend — everything a user does here (likes,
 * groups, shared sessions) is a row on this device, and the UI says so.
 *
 * ARTICLE 9: `shareWorkout` copies only session metrics and the derived muscle
 * shares. Progress photos and bodyweight are health data under GDPR Art. 9 and
 * AGENTS.md constraint 5 forbids auto-attaching them to a social post — so this
 * store has no field they could travel in, which is a stronger guarantee than a
 * check at the call site.
 */

type Persisted = {
  /** Post ids the user has liked. */
  liked: string[];
  /** The user's own shared posts. */
  shared: FeedPost[];
  /** Groups created on this device. */
  groups: Group[];
  /** Group ids the user has joined, fixture or otherwise. */
  joined: string[];
};

const EMPTY: Persisted = { liked: [], shared: [], groups: [], joined: [] };

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export type FeedTab = 'following' | 'discover';

type State = {
  hydrated: boolean;
  /** Sample posts, materialised once at hydrate with launch-relative times. */
  fixtures: FeedPost[];
  shared: FeedPost[];
  liked: string[];
  groups: Group[];
  joined: string[];

  hydrate: () => Promise<void>;
  toggleLike: (postId: string) => void;
  isLiked: (postId: string) => boolean;
  likeCount: (post: FeedPost) => number;

  shareWorkout: (workout: CompletedWorkout, caption?: string) => FeedPost;
  unshare: (postId: string) => void;
  isShared: (workoutId: string) => boolean;

  createGroup: (name: string) => Group | null;
  toggleJoin: (groupId: string) => void;
  leaveOrDeleteGroup: (groupId: string) => void;
};

export const useCommunity = create<State>((set, get) => {
  const persist = () => {
    const { liked, shared, groups, joined } = get();
    const payload: Persisted = { liked, shared, groups, joined };
    void saveRaw(KEY, JSON.stringify(payload));
  };

  return {
    hydrated: false,
    fixtures: [],
    shared: [],
    liked: [],
    groups: [],
    joined: [],

    hydrate: async () => {
      const raw = await loadRaw(KEY);
      let saved: Persisted = EMPTY;
      try {
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Persisted>;
          saved = {
            liked: Array.isArray(parsed.liked) ? parsed.liked : [],
            shared: Array.isArray(parsed.shared) ? parsed.shared : [],
            groups: Array.isArray(parsed.groups) ? parsed.groups : [],
            joined: Array.isArray(parsed.joined) ? parsed.joined : [],
          };
        }
      } catch {
        saved = EMPTY;
      }
      set({
        fixtures: fixturePosts(Date.now()),
        liked: saved.liked,
        shared: saved.shared,
        groups: saved.groups,
        joined: saved.joined,
        hydrated: true,
      });
    },

    toggleLike: (postId) => {
      const liked = get().liked;
      set({
        liked: liked.includes(postId)
          ? liked.filter((id) => id !== postId)
          : [postId, ...liked],
      });
      persist();
    },

    isLiked: (postId) => get().liked.includes(postId),

    likeCount: (post) => post.likes + (get().liked.includes(post.id) ? 1 : 0),

    shareWorkout: (workout, caption) => {
      const trimmed = caption?.trim();
      const post: FeedPost = {
        id: uid('own'),
        authorId: SELF_AUTHOR_ID,
        createdAt: Date.now(),
        ...(trimmed ? { caption: trimmed } : {}),
        workoutName: workout.name,
        durationSec: workout.durationSec,
        volumeKg: workout.volumeKg,
        totalReps: workout.totalReps,
        totalSets: workout.totalSets,
        exerciseCount: workout.exercises.length,
        shares: muscleShares(workout.exercises),
        likes: 0,
        comments: 0,
        sourceWorkoutId: workout.id,
      };
      set({ shared: [post, ...get().shared] });
      persist();
      return post;
    },

    unshare: (postId) => {
      set({
        shared: get().shared.filter((p) => p.id !== postId),
        liked: get().liked.filter((id) => id !== postId),
      });
      persist();
    },

    isShared: (workoutId) => get().shared.some((p) => p.sourceWorkoutId === workoutId),

    createGroup: (name) => {
      const clean = name.trim();
      if (clean.length === 0) return null;
      const group: Group = {
        id: uid('g'),
        name: clean,
        initials: initialsOf(clean),
        members: 1,
        mine: true,
      };
      set({ groups: [group, ...get().groups], joined: [group.id, ...get().joined] });
      persist();
      return group;
    },

    toggleJoin: (groupId) => {
      const joined = get().joined;
      set({
        joined: joined.includes(groupId)
          ? joined.filter((id) => id !== groupId)
          : [groupId, ...joined],
      });
      persist();
    },

    leaveOrDeleteGroup: (groupId) => {
      set({
        groups: get().groups.filter((g) => g.id !== groupId),
        joined: get().joined.filter((id) => id !== groupId),
      });
      persist();
    },
  };
});

/** Fixture author lookup. Returns undefined for the user's own posts. */
export function authorFor(id: string): FeedAuthor | undefined {
  return FIXTURE_AUTHORS.find((a) => a.id === id);
}

/** Fixture groups plus any the user created, user's first. */
export function allGroups(mine: readonly Group[]): Group[] {
  return [...mine, ...FIXTURE_GROUPS];
}

/**
 * The feed for a tab.
 *
 * Following = accounts the user follows, plus their own posts. Discover = every
 * sample account. Own posts are always visible in Following so a share has a
 * visible destination.
 */
export function feedFor(
  tab: FeedTab,
  fixtures: readonly FeedPost[],
  shared: readonly FeedPost[],
): FeedPost[] {
  const followedIds = new Set(FIXTURE_AUTHORS.filter((a) => a.followed).map((a) => a.id));
  const pool =
    tab === 'following'
      ? [...shared, ...fixtures.filter((p) => followedIds.has(p.authorId))]
      : [...shared, ...fixtures];
  return pool.sort((a, b) => b.createdAt - a.createdAt);
}
