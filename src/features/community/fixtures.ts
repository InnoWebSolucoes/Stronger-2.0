import { toShares, type FeedAuthor, type FeedPost, type Group } from './types';

/**
 * Sample accounts and sessions.
 *
 * These exist so the feed has shape before sync ships. They are labelled as
 * samples in the UI and their timestamps are anchored to app launch, not to a
 * clock on a server — nothing here should be mistaken for live activity.
 *
 * Volumes span a deliberately wide range (5.1 t to 21.4 t) precisely so the
 * muscle map can be checked: the maps must read with equal intensity, because
 * they shade by share of the session, not by absolute tonnage.
 */

const HOUR = 3_600_000;

export const FIXTURE_AUTHORS: readonly FeedAuthor[] = [
  { id: 'a_nadia', name: 'Nadia Okonkwo', handle: 'nadialifts', initials: 'NO', sample: true, followed: true },
  { id: 'a_tom', name: 'Tom Reyes', handle: 'tomreyes', initials: 'TR', sample: true, followed: true },
  { id: 'a_ingrid', name: 'Ingrid Bakke', handle: 'ingridb', initials: 'IB', sample: true, followed: true },
  { id: 'a_marcus', name: 'Marcus Hale', handle: 'halehaus', initials: 'MH', sample: true, followed: false },
  { id: 'a_yuki', name: 'Yuki Tanaka', handle: 'yuki_t', initials: 'YT', sample: true, followed: false },
  { id: 'a_priya', name: 'Priya Raman', handle: 'priyalifts', initials: 'PR', sample: true, followed: false },
];

type Seed = {
  id: string;
  authorId: string;
  hoursAgo: number;
  caption?: string;
  workoutName: string;
  durationSec: number;
  volumeKg: number;
  totalReps: number;
  totalSets: number;
  exerciseCount: number;
  weights: Record<string, number>;
  likes: number;
  comments: number;
};

const SEEDS: readonly Seed[] = [
  {
    id: 'p_1',
    authorId: 'a_nadia',
    hoursAgo: 3,
    caption: 'Back to 5×5 after the deload. Everything moved.',
    workoutName: 'Lower A',
    durationSec: 4_920,
    volumeKg: 11_240,
    totalReps: 146,
    totalSets: 21,
    exerciseCount: 5,
    weights: { Quads: 34, Glutes: 24, Hamstrings: 19, 'Lower Back': 11, Calves: 8, Abs: 4 },
    likes: 24,
    comments: 5,
  },
  {
    id: 'p_2',
    authorId: 'a_tom',
    hoursAgo: 9,
    caption: 'First time benching 100 for reps. Small bar, big day.',
    workoutName: 'Push',
    durationSec: 3_780,
    volumeKg: 8_960,
    totalReps: 128,
    totalSets: 19,
    exerciseCount: 6,
    weights: { Chest: 33, Triceps: 24, 'Front Delts': 22, 'Side Delts': 15, Abs: 6 },
    likes: 41,
    comments: 12,
  },
  {
    id: 'p_3',
    authorId: 'a_ingrid',
    hoursAgo: 22,
    workoutName: 'Pull',
    durationSec: 4_260,
    volumeKg: 9_870,
    totalReps: 152,
    totalSets: 22,
    exerciseCount: 7,
    weights: { Lats: 30, 'Upper Back': 24, Biceps: 18, Traps: 12, 'Rear Delts': 9, Forearms: 7 },
    likes: 18,
    comments: 2,
  },
  {
    id: 'p_4',
    authorId: 'a_marcus',
    hoursAgo: 31,
    caption: 'Deadlift day. 21 tonnes moved, knees intact.',
    workoutName: 'Deadlift + accessories',
    durationSec: 5_640,
    volumeKg: 21_400,
    totalReps: 118,
    totalSets: 20,
    exerciseCount: 5,
    weights: { 'Lower Back': 26, Glutes: 24, Hamstrings: 22, 'Upper Back': 16, Traps: 12 },
    likes: 63,
    comments: 9,
  },
  {
    id: 'p_5',
    authorId: 'a_yuki',
    hoursAgo: 40,
    caption: 'Arms only. Not sorry.',
    workoutName: 'Arms',
    durationSec: 2_340,
    volumeKg: 5_120,
    totalReps: 164,
    totalSets: 18,
    exerciseCount: 6,
    weights: { Biceps: 42, Triceps: 38, Forearms: 20 },
    likes: 31,
    comments: 7,
  },
  {
    id: 'p_6',
    authorId: 'a_priya',
    hoursAgo: 53,
    caption: 'Full body, 45 minutes, in and out before work.',
    workoutName: 'Full Body',
    durationSec: 2_700,
    volumeKg: 7_450,
    totalReps: 138,
    totalSets: 18,
    exerciseCount: 6,
    weights: {
      Quads: 16,
      Chest: 15,
      'Upper Back': 14,
      Lats: 11,
      Hamstrings: 10,
      Glutes: 9,
      'Front Delts': 8,
      Triceps: 7,
      Biceps: 6,
      Abs: 4,
    },
    likes: 12,
    comments: 1,
  },
  {
    id: 'p_7',
    authorId: 'a_nadia',
    hoursAgo: 74,
    workoutName: 'Calf punishment',
    durationSec: 1_080,
    volumeKg: 6_300,
    totalReps: 180,
    totalSets: 12,
    exerciseCount: 2,
    // Single-region session — the map has to still look deliberate here.
    weights: { Calves: 100 },
    likes: 9,
    comments: 4,
  },
];

/**
 * Posts, newest first. Timestamps are relative to module load so the feed
 * always reads sensibly, without pretending anything arrived from a network.
 */
export function fixturePosts(now: number): FeedPost[] {
  return SEEDS.map((s) => ({
    id: s.id,
    authorId: s.authorId,
    createdAt: now - s.hoursAgo * HOUR,
    ...(s.caption ? { caption: s.caption } : {}),
    workoutName: s.workoutName,
    durationSec: s.durationSec,
    volumeKg: s.volumeKg,
    totalReps: s.totalReps,
    totalSets: s.totalSets,
    exerciseCount: s.exerciseCount,
    shares: toShares(s.weights),
    likes: s.likes,
    comments: s.comments,
  })).sort((a, b) => b.createdAt - a.createdAt);
}

export const FIXTURE_GROUPS: readonly Group[] = [
  { id: 'g_5am', name: '5am Club', initials: '5C', members: 34, mine: false },
  { id: 'g_pull', name: 'Pull Day Society', initials: 'PD', members: 112, mine: false },
  { id: 'g_ldn', name: 'South London Barbell', initials: 'SL', members: 58, mine: false },
  { id: 'g_first', name: 'First Pull-Up', initials: 'FP', members: 203, mine: false },
];
