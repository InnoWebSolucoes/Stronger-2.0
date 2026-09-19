import { describe, expect, it, vi } from 'vitest';

/**
 * `badges.ts` imports its icons from `lucide-react-native`, which ships
 * untranspiled React Native source that plain node cannot parse. The catalogue
 * itself is pure data, so the icon module is stubbed out rather than loaded —
 * nothing under test reads an icon.
 */
vi.mock('lucide-react-native', () => {
  const Stub = () => null;
  return {
    Activity: Stub, Anchor: Stub, Atom: Stub, Award: Stub, BadgeCheck: Stub, BookOpen: Stub,
    Bone: Stub, Bike: Stub, Boxes: Stub, Cake: Stub, CalendarCheck: Stub, CalendarDays: Stub,
    Clock: Stub, Compass: Stub, Crown: Stub, Dumbbell: Stub, Flag: Stub, Flame: Stub,
    Gauge: Stub, Gem: Stub, Grip: Stub, Hammer: Stub, Hourglass: Stub, Infinity: Stub,
    Layers: Stub, Magnet: Stub, Medal: Stub, Milestone: Stub, Moon: Stub, Mountain: Stub,
    Orbit: Stub, Package: Stub, PartyPopper: Stub, Plane: Stub, Radar: Stub, Repeat: Stub,
    Rocket: Stub, Ruler: Stub, Scale: Stub, Ship: Stub, Shield: Stub, Skull: Stub,
    Sparkles: Stub, Star: Stub, Sun: Stub, Sunrise: Stub, Sword: Stub, Swords: Stub,
    Target: Stub, Telescope: Stub, Timer: Stub, TrendingUp: Stub, Trophy: Stub, Truck: Stub,
    Weight: Stub, Wrench: Stub, Zap: Stub,
  };
});

import { BADGES, evaluateBadges, progressLabel } from './badges';
import { computeProfileStats } from './stats';
import { generateDemoData } from '@/features/demo/generate';

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

const emptyStats = () =>
  computeProfileStats({ history: [], bodyweightKg: 80, joinedAt: NOW, weighIns: 0 });

const demoStats = () => {
  const { workouts, bodyweight } = generateDemoData(NOW, 34, 78.9);
  return computeProfileStats({
    history: workouts,
    bodyweightKg: 78.9,
    joinedAt: NOW,
    weighIns: bodyweight.length,
  });
};

describe('profile stats', () => {
  it('an empty log produces zeros, not NaN or junk', () => {
    const s = emptyStats();
    expect(s.workouts).toBe(0);
    expect(s.currentWeekStreak).toBe(0);
    expect(s.weeks).toHaveLength(0);
    expect(s.bestLifts).toHaveLength(0);
    expect(s.favouriteExercise).toBeNull();
    expect(s.topMuscle).toBeNull();
    for (const [key, value] of Object.entries(s)) {
      if (typeof value === 'number') expect(Number.isFinite(value), key).toBe(true);
    }
  });

  it('the demo log produces a coherent snapshot', () => {
    const s = demoStats();
    expect(s.workouts).toBeGreaterThan(50);
    expect(s.volumeKg).toBeGreaterThan(0);
    expect(s.sets).toBeGreaterThan(0);
    expect(s.reps).toBeGreaterThanOrEqual(s.sets);
    expect(s.bestLifts.length).toBeGreaterThan(3);
    expect(s.favouriteExercise).not.toBeNull();
    expect(s.topMuscle).not.toBeNull();
    // Weekly mechanic, not daily: a target between 1 and 6, and a live streak.
    expect(s.weeklyTarget).toBeGreaterThanOrEqual(1);
    expect(s.weeklyTarget).toBeLessThanOrEqual(6);
    expect(s.currentWeekStreak).toBeGreaterThan(0);
    expect(s.longestWeekStreak).toBeGreaterThanOrEqual(s.currentWeekStreak);
    expect(s.activeWeeks).toBeLessThanOrEqual(s.weeks.length);
    expect(s.avgSessionSec).toBeGreaterThan(0);
    expect(s.longestSessionSec).toBeGreaterThanOrEqual(s.avgSessionSec);
    // Best lifts are sorted by estimated 1RM, heaviest first.
    const e1rms = s.bestLifts.map((b) => b.e1rmKg);
    expect([...e1rms].sort((a, b) => b - a)).toEqual(e1rms);
  });
});

describe('badge catalogue', () => {
  it('is at least forty distinct achievements', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(new Set(BADGES.map((b) => b.name)).size).toBe(BADGES.length);
  });

  it('spans every category and rarity', () => {
    const categories = new Set(BADGES.map((b) => b.category));
    const rarities = new Set(BADGES.map((b) => b.rarity));
    expect(categories).toEqual(
      new Set(['consistency', 'volume', 'strength', 'variety', 'milestone']),
    );
    expect(rarities).toEqual(
      new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    );
  });

  it('awards nothing to an empty log — no participation trophies', () => {
    const earned = evaluateBadges(emptyStats()).filter((b) => b.earned);
    expect(earned).toHaveLength(0);
  });

  it('awards a meaningful but incomplete subset to the demo log', () => {
    const evaluated = evaluateBadges(demoStats());
    const earned = evaluated.filter((b) => b.earned);
    // Real progress, but the legendary tiers are still years away.
    expect(earned.length).toBeGreaterThan(8);
    expect(earned.length).toBeLessThan(BADGES.length);
    expect(earned.some((b) => b.def.rarity === 'legendary')).toBe(false);
    // Earned badges sort ahead of locked ones.
    const firstLocked = evaluated.findIndex((b) => !b.earned);
    expect(evaluated.slice(firstLocked).every((b) => !b.earned)).toBe(true);
  });

  it('every evaluation yields a usable progress bar and label', () => {
    for (const stats of [emptyStats(), demoStats()]) {
      for (const b of evaluateBadges(stats)) {
        expect(Number.isFinite(b.value), b.def.id).toBe(true);
        expect(b.target, b.def.id).toBeGreaterThan(0);
        expect(b.progress, b.def.id).toBeGreaterThanOrEqual(0);
        expect(b.progress, b.def.id).toBeLessThanOrEqual(1);
        expect(progressLabel(b)).not.toContain('NaN');
      }
    }
  });
});
