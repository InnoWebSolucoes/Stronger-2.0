import { describe, expect, it } from 'vitest';
import { MASS_EQUIVALENTS, PICKABLE_EQUIVALENTS, getEquivalent } from './catalog';
import {
  IDEAL_COUNT,
  MAX_COUNT,
  MIN_COUNT,
  WHOLE_HI,
  WHOLE_LO,
  countScore,
  displayCount,
  nextMilestone,
  pickEquivalents,
  roundness,
  spectacleWeight,
  type Comparison,
} from './select';
import { COOLDOWN_SPAN, appendShown, type ShownRecord } from './variety';

/** A pick is only acceptable if it lands in the window or is a deliberate "a whole X". */
function inSatisfyingWindow(c: Comparison): boolean {
  if (c.isWhole) return c.count >= WHOLE_LO && c.count <= WHOLE_HI;
  return c.count >= MIN_COUNT && c.count <= MAX_COUNT;
}

describe('countScore', () => {
  it('peaks at the ideal count of 6.5x', () => {
    expect(countScore(IDEAL_COUNT)).toBeCloseTo(1, 10);
    expect(countScore(3)).toBeLessThan(countScore(IDEAL_COUNT));
    expect(countScore(20)).toBeLessThan(countScore(IDEAL_COUNT));
  });

  it('matches the research reference curve', () => {
    // Values from the log-Gaussian with sigma 0.95 below / 1.15 above the 6.5x ideal.
    expect(countScore(1.5)).toBeCloseTo(0.3, 2);
    expect(countScore(3)).toBeCloseTo(0.72, 2);
    expect(countScore(12)).toBeCloseTo(0.87, 2);
    // The brief's inline comment says 0.46 here; the constants it ships give 0.50,
    // and the constants are authoritative.
    expect(countScore(25)).toBeCloseTo(0.5, 2);
    expect(countScore(40)).toBeCloseTo(0.29, 2);
  });

  it('hard-zeroes outside the 1.5x to 40x window', () => {
    expect(countScore(1.49)).toBe(0);
    expect(countScore(40.01)).toBe(0);
    expect(countScore(60)).toBe(0);
    expect(countScore(18_000)).toBe(0); // "18,000 bananas"
    expect(countScore(0.03)).toBe(0); // "0.03 blue whales"
  });

  it('treats a count of about one as the special whole-object case', () => {
    expect(countScore(1)).toBeCloseTo(0.97, 10);
    expect(countScore(WHOLE_LO)).toBeCloseTo(0.97, 10);
    expect(countScore(WHOLE_HI)).toBeCloseTo(0.97, 10);
    expect(countScore(1.13)).toBe(0); // out of the whole window and under 1.5x
  });

  it('refuses zero, negative and non-finite counts', () => {
    expect(countScore(0)).toBe(0);
    expect(countScore(-4)).toBe(0);
    expect(countScore(Number.NaN)).toBe(0);
    expect(countScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('spectacleWeight', () => {
  it('is all relatability at one light session and all spectacle at lifetime scale', () => {
    expect(spectacleWeight(1000)).toBe(0);
    expect(spectacleWeight(500)).toBe(0);
    expect(spectacleWeight(1_000_000)).toBe(1);
    expect(spectacleWeight(50_000_000)).toBe(1);
  });

  it('crosses over smoothly through the session range', () => {
    expect(spectacleWeight(31_623)).toBeCloseTo(0.5, 2); // 10^4.5
    expect(spectacleWeight(20_000)).toBeGreaterThan(0);
    expect(spectacleWeight(20_000)).toBeLessThan(1);
  });

  it('is defined at zero and below', () => {
    expect(spectacleWeight(0)).toBe(0);
    expect(spectacleWeight(-100)).toBe(0);
  });
});

describe('displayCount and roundness', () => {
  it('rounds by magnitude', () => {
    expect(displayCount(2.94)).toBe(2.9);
    expect(displayCount(9.96)).toBe(10);
    expect(displayCount(38.4)).toBe(38);
    expect(displayCount(1237)).toBe(1235);
  });

  it('prefers counts that survive rounding and are not suspiciously round', () => {
    expect(roundness(2.9)).toBeGreaterThan(roundness(4.0));
    expect(roundness(0)).toBe(0);
    expect(roundness(Number.NaN)).toBe(0);
  });
});

describe('pickEquivalents', () => {
  const opts = { sessionIndex: 1 } as const;

  it('returns nothing at all for an empty session', () => {
    expect(pickEquivalents(0, opts)).toEqual([]);
    expect(pickEquivalents(-100, opts)).toEqual([]);
    expect(pickEquivalents(Number.NaN, opts)).toEqual([]);
  });

  it.each([500, 2400, 6800, 12_500, 20_000, 45_000, 180_000, 1_600_000])(
    'keeps every pick inside the satisfying window at %i kg',
    (total) => {
      const picks = pickEquivalents(total, opts);
      expect(picks.length).toBeGreaterThanOrEqual(2);
      for (const pick of picks) {
        expect(inSatisfyingWindow(pick), `${pick.entry.id} at ${pick.count}x`).toBe(true);
      }
    },
  );

  it('never picks the same entry twice, nor two masses close enough to be the same number', () => {
    for (let session = 1; session <= 30; session++) {
      for (const total of [500, 4000, 20_000, 1_600_000]) {
        const picks = pickEquivalents(total, { sessionIndex: session });
        const ids = new Set(picks.map((p) => p.entry.id));
        expect(ids.size).toBe(picks.length);
        // The same-category penalty is a soft 0.35, so a third pick may share a category
        // when the objects are otherwise unalike (an adult human and a fridge-freezer).
        // Two of three is the limit; all three sharing one category is not shipped.
        const categories = new Set(picks.map((p) => p.entry.category));
        expect(categories.size, `${total} kg, session ${session}`).toBeGreaterThanOrEqual(
          picks.length - 1,
        );
        for (let i = 0; i < picks.length; i++) {
          for (let j = i + 1; j < picks.length; j++) {
            const a = picks[i];
            const b = picks[j];
            if (a === undefined || b === undefined) continue;
            const dex = Math.abs(Math.log10(a.entry.massKg) - Math.log10(b.entry.massKg));
            expect(dex, `${a.entry.id} vs ${b.entry.id}`).toBeGreaterThanOrEqual(0.15);
          }
        }
      }
    }
  });

  it('is fully deterministic — the same workout renders identically forever', () => {
    const history: ShownRecord[] = [{ id: 'blue-whale', sessionIndex: 40 }];
    const first = pickEquivalents(18_420, { sessionIndex: 41, history });
    for (let i = 0; i < 5; i++) {
      const again = pickEquivalents(18_420, { sessionIndex: 41, history });
      expect(again.map((p) => p.entry.id)).toEqual(first.map((p) => p.entry.id));
      expect(again.map((p) => p.count)).toEqual(first.map((p) => p.count));
    }
  });

  it('leans on relatability for a light session and spectacle for a lifetime total', () => {
    const light = pickEquivalents(500, opts);
    const lifetime = pickEquivalents(1_600_000, opts);
    const mean = (picks: Comparison[], key: 'relatability' | 'spectacle'): number =>
      picks.reduce((sum, p) => sum + p.entry[key], 0) / Math.max(1, picks.length);
    expect(mean(light, 'relatability')).toBeGreaterThan(mean(lifetime, 'relatability'));
    expect(mean(lifetime, 'spectacle')).toBeGreaterThan(mean(light, 'spectacle'));
  });

  it('honours the requested number of comparisons', () => {
    expect(pickEquivalents(20_000, { sessionIndex: 3, want: 2 })).toHaveLength(2);
    expect(pickEquivalents(20_000, { sessionIndex: 3, want: 1 })).toHaveLength(1);
    expect(pickEquivalents(20_000, { sessionIndex: 3, want: 3 }).length).toBeLessThanOrEqual(3);
  });

  it('respects category and id exclusions', () => {
    const picks = pickEquivalents(20_000, {
      sessionIndex: 5,
      excludeCategories: ['animal', 'marine'],
      excludeIds: ['ambulance'],
    });
    for (const pick of picks) {
      expect(pick.entry.category).not.toBe('animal');
      expect(pick.entry.category).not.toBe('marine');
      expect(pick.entry.id).not.toBe('ambulance');
    }
  });

  it('never offers a legend-tier object as a session comparison', () => {
    for (const total of [500, 20_000, 1_600_000, 40_000_000]) {
      for (const pick of pickEquivalents(total, opts)) {
        expect(pick.entry.milestoneOnly ?? false, pick.entry.id).toBe(false);
      }
    }
  });

  it('pushes recently shown entries away without breaking the window', () => {
    const fresh = pickEquivalents(20_000, { sessionIndex: 12 });
    const firstId = fresh[0]?.entry.id;
    expect(firstId).toBeDefined();
    const history = appendShown([], 11, fresh.map((p) => p.entry.id));
    const afterCooldown = pickEquivalents(20_000, { sessionIndex: 12, history });
    expect(afterCooldown.map((p) => p.entry.id)).not.toContain(firstId);
    for (const pick of afterCooldown) expect(inSatisfyingWindow(pick)).toBe(true);
  });

  it('gives four-sessions-a-week variety, with repeats no closer than the cooldown span', () => {
    let history: ShownRecord[] = [];
    const leaders: string[] = [];
    for (let session = 1; session <= 12; session++) {
      const picks = pickEquivalents(18_000 + session * 250, { sessionIndex: session, history });
      const leader = picks[0];
      expect(leader).toBeDefined();
      if (leader === undefined) continue;
      leaders.push(leader.entry.id);
      history = appendShown(history, session, picks.map((p) => p.entry.id));
    }
    // Someone training four times a week sees eight different headline objects before
    // any of them comes round again, and never two sessions in a row.
    expect(new Set(leaders).size).toBeGreaterThanOrEqual(COOLDOWN_SPAN);
    const lastSeen = new Map<string, number>();
    leaders.forEach((id, index) => {
      const previous = lastSeen.get(id);
      if (previous !== undefined) {
        expect(index - previous, `${id} repeated too soon`).toBeGreaterThanOrEqual(COOLDOWN_SPAN);
      }
      lastSeen.set(id, index);
    });
  });

  it('degrades gracefully when the total is smaller than anything in the catalogue', () => {
    expect(pickEquivalents(0.4, opts)).toEqual([]); // "0.4 bags of sugar" is not shipped
    const barelyThere = pickEquivalents(1.2, opts);
    for (const pick of barelyThere) expect(pick.count).toBeGreaterThanOrEqual(0.75);
  });

  it('still finds comparisons for an absurd total', () => {
    const picks = pickEquivalents(60_000_000, opts);
    expect(picks.length).toBeGreaterThanOrEqual(1);
    for (const pick of picks) expect(pick.count).toBeLessThan(MAX_COUNT * 10);
  });

  it('works against a custom pool', () => {
    const pool = PICKABLE_EQUIVALENTS.filter((e) => e.category === 'gym');
    const picks = pickEquivalents(400, { sessionIndex: 2, catalogue: pool });
    for (const pick of picks) expect(pick.entry.category).toBe('gym');
  });
});

describe('nextMilestone', () => {
  it('reproduces the research worked example', () => {
    const progress = nextMilestone(1_600_000);
    expect(progress?.entry.id).toBe('titanic');
    expect(progress?.pct).toBeCloseTo(3.06, 2);
    expect(progress?.remainingKg).toBeCloseTo(50_710_000, 0);
  });

  it('advances to the next legend once one is passed', () => {
    expect(nextMilestone(60_000_000)?.entry.id).toBe('nimitz-carrier');
    expect(nextMilestone(0)?.entry.id).toBe('titanic');
  });

  it('returns null past the last legend and for invalid input', () => {
    expect(nextMilestone(6_000_000_000)).toBeNull();
    expect(nextMilestone(-1)).toBeNull();
    expect(nextMilestone(Number.NaN)).toBeNull();
  });

  it('only ever names legend-tier objects', () => {
    for (const total of [1000, 500_000, 1_600_000, 90_000_000, 400_000_000]) {
      const progress = nextMilestone(total);
      if (progress === null) continue;
      expect(progress.entry.massKg).toBeGreaterThan(total);
      expect(getEquivalent(progress.entry.id)).toBeDefined();
      expect(MASS_EQUIVALENTS).toContain(progress.entry);
    }
  });
});
