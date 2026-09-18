import { describe, expect, it } from 'vitest';
import {
  MAX_COUNT,
  MIN_COUNT,
  WHOLE_HI,
  WHOLE_LO,
  appendShown,
  barDistanceM,
  bodyweightLine,
  bodyweightMultiples,
  comparisonSentence,
  heroLine,
  lintCopy,
  milestoneLine,
  nextMilestone,
  phrase,
  pickEquivalents,
  type Comparison,
  type ShownRecord,
} from './index';

/** The three totals the finish screen has to survive: a light session, a strong session, a lifetime. */
const LIGHT_SESSION_KG = 500;
const STRONG_SESSION_KG = 20_000;
const LIFETIME_KG = 1_600_000;

function assertNotEmbarrassing(picks: Comparison[], label: string): void {
  expect(picks.length, label).toBeGreaterThanOrEqual(2);
  for (const pick of picks) {
    const ok = pick.isWhole
      ? pick.count >= WHOLE_LO && pick.count <= WHOLE_HI
      : pick.count >= MIN_COUNT && pick.count <= MAX_COUNT;
    expect(ok, `${label}: ${pick.count}x ${pick.entry.plural}`).toBe(true);

    const text = phrase(pick);
    expect(text, label).not.toMatch(/^0/); // "0.03 blue whales"
    expect(text, label).not.toMatch(/\b\d{3,}\b/); // "18,000 bananas"
    expect(text, label).not.toMatch(/\b1\.0 /); // "1.0 blue whales"
    expect(lintCopy(text), label).toEqual([]);
  }
  const categories = new Set(picks.map((p) => p.entry.category));
  expect(categories.size, `${label}: categories`).toBeGreaterThanOrEqual(picks.length - 1);
}

describe('a 500 kg session', () => {
  it('produces everyday objects at a satisfying count', () => {
    const picks = pickEquivalents(LIGHT_SESSION_KG, { sessionIndex: 1 });
    assertNotEmbarrassing(picks, '500 kg');
    // A light session leans on things the user has physically handled.
    const meanRelatability =
      picks.reduce((sum, p) => sum + p.entry.relatability, 0) / picks.length;
    expect(meanRelatability).toBeGreaterThan(0.7);
    expect(lintCopy(heroLine(LIGHT_SESSION_KG, picks, 1))).toEqual([]);
  });

  it('never reaches for a landmark to describe 500 kg', () => {
    for (let session = 1; session <= 20; session++) {
      const picks = pickEquivalents(LIGHT_SESSION_KG, { sessionIndex: session });
      for (const pick of picks) {
        // Nothing heavier than the session itself, allowing for the "a whole racehorse"
        // case where the count sits just under 1.
        expect(pick.entry.massKg, pick.entry.id).toBeLessThanOrEqual(LIGHT_SESSION_KG / WHOLE_LO);
        expect(pick.entry.category, pick.entry.id).not.toBe('space');
      }
    }
  });
});

describe('a 20,000 kg session', () => {
  it('produces vehicle- and animal-scale comparisons', () => {
    const picks = pickEquivalents(STRONG_SESSION_KG, { sessionIndex: 1 });
    assertNotEmbarrassing(picks, '20,000 kg');
    for (const pick of picks) {
      expect(pick.entry.massKg).toBeGreaterThan(400); // nothing counted in the thousands
      expect(pick.entry.massKg).toBeLessThan(STRONG_SESSION_KG / (MIN_COUNT * 0.6));
    }
  });

  it('holds up across a month of training without repeating itself', () => {
    let history: ShownRecord[] = [];
    const headlines: string[] = [];
    for (let session = 1; session <= 16; session++) {
      const picks = pickEquivalents(STRONG_SESSION_KG, { sessionIndex: session, history });
      assertNotEmbarrassing(picks, `20,000 kg session ${session}`);
      const leader = picks[0];
      if (leader === undefined) continue;
      headlines.push(leader.entry.id);
      history = appendShown(history, session, picks.map((p) => p.entry.id));
    }
    expect(new Set(headlines).size).toBeGreaterThanOrEqual(10);
  });
});

describe('a 1,600,000 kg lifetime total', () => {
  it('reaches for spectacle without leaving the window', () => {
    const picks = pickEquivalents(LIFETIME_KG, { sessionIndex: 1 });
    assertNotEmbarrassing(picks, '1.6 M kg');
    const meanSpectacle = picks.reduce((sum, p) => sum + p.entry.spectacle, 0) / picks.length;
    expect(meanSpectacle).toBeGreaterThan(0.7);
  });

  it('puts the blue whale in range, as the research predicts', () => {
    const marineOnly = pickEquivalents(LIFETIME_KG, {
      sessionIndex: 1,
      want: 3,
      excludeCategories: ['space', 'aircraft', 'structure', 'vehicle', 'industrial', 'animal'],
    });
    const whale = marineOnly[0];
    expect(whale).toBeDefined();
    if (whale === undefined) return;
    expect(whale.entry.id).toBe('blue-whale');
    expect(whale.count).toBeCloseTo(14.55, 2);
    expect(phrase(whale)).toBe('15 blue whales');
  });

  it('drives the career line off the Titanic', () => {
    expect(milestoneLine(LIFETIME_KG, nextMilestone(LIFETIME_KG))).toBe(
      'Lifetime: 1,600,000 kg — 3.1% of the Titanic.',
    );
  });
});

describe('a whole finish screen', () => {
  it('assembles cleanly from volume, comparisons and framings', () => {
    const totalKg = 18_420;
    const sessionIndex = 41;
    const bodyweightKg = 85;
    const sets = [
      ...Array.from({ length: 5 }, () => ({ pattern: 'back-squat', reps: 5, weightKg: 140 })),
      ...Array.from({ length: 5 }, () => ({ pattern: 'bench-press', reps: 8, weightKg: 90 })),
      ...Array.from({ length: 5 }, () => ({ pattern: 'barbell-row', reps: 10, weightKg: 70 })),
    ];

    const picks = pickEquivalents(totalKg, { sessionIndex });
    const screen = [
      heroLine(totalKg, picks, sessionIndex),
      comparisonSentence(picks),
      bodyweightLine(bodyweightMultiples(totalKg, bodyweightKg)),
      milestoneLine(LIFETIME_KG, nextMilestone(LIFETIME_KG)),
    ];

    for (const line of screen) {
      expect(line.length).toBeGreaterThan(0);
      expect(lintCopy(line), line).toEqual([]);
    }
    expect(barDistanceM(sets)).toBeGreaterThan(50);

    // The same workout, re-opened years later, renders identically.
    const again = pickEquivalents(totalKg, { sessionIndex });
    expect(again.map((p) => p.entry.id)).toEqual(picks.map((p) => p.entry.id));
    expect(heroLine(totalKg, again, sessionIndex)).toBe(screen[0]);
  });
});
