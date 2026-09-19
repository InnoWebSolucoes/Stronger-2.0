/**
 * Smoke tests for the Progress tab's derivations.
 *
 * These are not unit tests of the engines — those live in `src/core`. They
 * check the two things this layer can get wrong on its own: that a populated
 * profile produces coherent numbers, and that an empty one produces "no data"
 * rather than a flattering one.
 */

import { describe, expect, it } from 'vitest';
import { generateDemoData } from '@/features/demo/generate';
import type { CompletedWorkout } from '@/features/workout/types';
import { journeyStats, rangeStart, strengthProfile, summariseLifts, trainingSplit } from './analytics';
import { readinessView } from './readiness';

const NOW = Date.UTC(2026, 8, 19);
const LIFTER = { sex: 'male', bodyweightKg: 78.9, age: 28 } as const;

describe('the demo profile', () => {
  const { workouts } = generateDemoData(NOW, 34, 78.9);
  const lifts = summariseLifts(workouts, 78.9);

  it('produces an e1RM series for the lifts it logged', () => {
    expect(lifts.length).toBeGreaterThan(5);
    const withPoints = lifts.filter((l) => l.points.length >= 2);
    expect(withPoints.length).toBeGreaterThan(3);
    for (const lift of withPoints) {
      expect(lift.currentE1rmKg).not.toBeNull();
      expect(lift.currentE1rmKg ?? 0).toBeGreaterThan(0);
    }
  });

  it('ranks the lifter without crowning them', () => {
    const profile = strengthProfile(lifts, LIFTER, NOW);
    expect(profile).not.toBeNull();
    if (profile === null) return;
    expect(profile.standing.patternsCovered).toBeGreaterThan(0);
    expect(profile.standing.rank.score).toBeGreaterThan(0);
    expect(profile.standing.rank.score).toBeLessThanOrEqual(120);
  });

  it('counts journey totals and the range delta consistently', () => {
    const stats = journeyStats(workouts, lifts, rangeStart('3M', NOW));
    expect(stats.all.workouts).toBe(workouts.length);
    expect(stats.delta.workouts).toBeLessThanOrEqual(stats.all.workouts);
    expect(stats.all.volumeKg).toBeGreaterThan(0);
    expect(stats.all.prs).toBeGreaterThan(0);
  });

  it('splits volume into shares that sum to one', () => {
    const split = trainingSplit(workouts, rangeStart('ALL', NOW), 78.9);
    expect(split.length).toBeGreaterThan(3);
    const total = split.reduce((acc, s) => acc + s.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('reports readiness under 100% for something trained recently', () => {
    const view = readinessView(workouts, NOW);
    expect(view.trained.length).toBeGreaterThan(0);
    expect(view.recommendation.length).toBeGreaterThan(0);
    const lowest = view.muscles[0];
    expect(lowest).toBeDefined();
    expect(lowest?.pct ?? 100).toBeLessThan(100);
  });
});

describe('an empty profile', () => {
  const empty: CompletedWorkout[] = [];

  it('has no lifts, no stats and no rank', () => {
    const lifts = summariseLifts(empty, 78.9);
    expect(lifts).toEqual([]);
    expect(strengthProfile(lifts, LIFTER, NOW)).toBeNull();
    expect(trainingSplit(empty, Number.NEGATIVE_INFINITY, 78.9)).toEqual([]);

    const stats = journeyStats(empty, lifts, rangeStart('1M', NOW));
    expect(stats.all).toEqual({ workouts: 0, volumeKg: 0, prs: 0, seconds: 0 });
  });

  it('reads as fully recovered rather than as an error', () => {
    const view = readinessView(empty, NOW);
    expect(view.trained).toEqual([]);
    expect(view.muscles.every((m) => m.pct === 100)).toBe(true);
    expect(view.recommendation.length).toBeGreaterThan(0);
  });
});

describe('a single logged set', () => {
  it('never produces a ranked standing', () => {
    const one: CompletedWorkout[] = [
      {
        id: 'w1',
        name: 'First session',
        startedAt: NOW - 3600_000,
        finishedAt: NOW,
        durationSec: 3600,
        volumeKg: 400,
        totalReps: 5,
        totalSets: 1,
        exercises: [
          {
            id: 'e1',
            // The real catalog id. Exercise ids are stable slugs of their
            // components (AGENTS.md), so a bare movement name matches nothing
            // and would make this test pass for the wrong reason.
            exerciseId: 'back-squat--barbell',
            name: 'Back Squat (Barbell)',
            muscles: ['Quads', 'Glutes'],
            restSeconds: 180,
            sets: [
              { id: 's1', type: 'normal', weightKg: 80, reps: 5, rpe: null, done: true },
            ],
          },
        ],
      },
    ];

    const lifts = summariseLifts(one, 78.9);
    const profile = strengthProfile(lifts, LIFTER, NOW);
    expect(profile).not.toBeNull();
    if (profile === null) return;
    // One pattern, one session: the cold-start prior must keep this calibrating.
    expect(profile.standing.state).toBe('calibrating');
    expect(profile.standing.displayLabel.toLowerCase()).not.toContain('elite');
  });
});
