import { describe, expect, it } from 'vitest';
import {
  MASS_EQUIVALENTS,
  MILESTONE_EQUIVALENTS,
  MILESTONE_THRESHOLD_KG,
  PICKABLE_EQUIVALENTS,
  countOf,
  getEquivalent,
  isMilestone,
  type MassEquivalent,
} from './catalog';

/** Small helper: fetch an entry that the test asserts must exist. */
function entry(id: string): MassEquivalent {
  const found = getEquivalent(id);
  expect(found, `catalogue is missing "${id}"`).toBeDefined();
  if (found === undefined) throw new Error(`missing ${id}`);
  return found;
}

describe('catalogue shape', () => {
  it('holds the full researched set', () => {
    expect(MASS_EQUIVALENTS).toHaveLength(139);
  });

  it('has unique stable ids', () => {
    const ids = new Set(MASS_EQUIVALENTS.map((e) => e.id));
    expect(ids.size).toBe(MASS_EQUIVALENTS.length);
  });

  it('uses slug ids, never indices or generated uuids', () => {
    for (const e of MASS_EQUIVALENTS) {
      expect(e.id, e.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(e.id, e.id).not.toMatch(/^\d+$/);
    }
  });

  it('is sorted ascending by mass', () => {
    for (let i = 1; i < MASS_EQUIVALENTS.length; i++) {
      const prev = MASS_EQUIVALENTS[i - 1];
      const curr = MASS_EQUIVALENTS[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      if (prev === undefined || curr === undefined) continue;
      expect(curr.massKg).toBeGreaterThanOrEqual(prev.massKg);
    }
  });

  it('gives every entry a positive finite mass in kg', () => {
    for (const e of MASS_EQUIVALENTS) {
      expect(Number.isFinite(e.massKg), e.id).toBe(true);
      expect(e.massKg, e.id).toBeGreaterThan(0);
    }
  });

  it('spans 1 kg to 5.9 billion kg', () => {
    const masses = MASS_EQUIVALENTS.map((e) => e.massKg);
    expect(Math.min(...masses)).toBe(1);
    expect(Math.max(...masses)).toBe(5_900_000_000);
  });

  it('has real density at every order of magnitude from 1 kg to 10,000,000 kg', () => {
    // A single session is a few thousand kg; a lifetime total is over a million.
    // Every decade in between needs candidates or the picker falls back to a bad ratio.
    for (let decade = 0; decade <= 6; decade++) {
      const lo = 10 ** decade;
      const hi = 10 ** (decade + 1);
      const inBand = PICKABLE_EQUIVALENTS.filter((e) => e.massKg >= lo && e.massKg < hi);
      expect(inBand.length, `decade 1e${decade}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('describes every entry completely', () => {
    for (const e of MASS_EQUIVALENTS) {
      expect(e.name.length, e.id).toBeGreaterThan(0);
      expect(e.singular.length, e.id).toBeGreaterThan(0);
      expect(e.plural.length, e.id).toBeGreaterThan(0);
      expect(e.emoji.length, e.id).toBeGreaterThan(0);
      expect(e.icon, e.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(e.relatability, e.id).toBeGreaterThanOrEqual(0);
      expect(e.relatability, e.id).toBeLessThanOrEqual(1);
      expect(e.spectacle, e.id).toBeGreaterThanOrEqual(0);
      expect(e.spectacle, e.id).toBeLessThanOrEqual(1);
      expect(['verified', 'representative', 'estimate']).toContain(e.confidence);
      expect(e.source.length, e.id).toBeGreaterThan(0);
      expect(e.sourceUrl, e.id).toMatch(/^https?:\/\//);
      if (e.fun !== undefined) expect(e.fun.length, e.id).toBeLessThanOrEqual(90);
    }
  });

  it('splits pickable from milestone entries without overlap', () => {
    expect(PICKABLE_EQUIVALENTS.length + MILESTONE_EQUIVALENTS.length).toBe(
      MASS_EQUIVALENTS.length,
    );
    for (const e of PICKABLE_EQUIVALENTS) expect(isMilestone(e), e.id).toBe(false);
    for (const e of MILESTONE_EQUIVALENTS) {
      expect(e.massKg, e.id).toBeGreaterThanOrEqual(MILESTONE_THRESHOLD_KG);
    }
    expect(MILESTONE_EQUIVALENTS).toHaveLength(7);
  });
});

describe('verified masses (ground truth from the research brief)', () => {
  it('uses the real ambulance and piano masses, not the brief example copy', () => {
    // The original spec copy said "4,000 kg = 2.9 ambulances or 45 pianos".
    // 2.9 ambulances implies 1,380 kg each; 45 pianos implies 89 kg each. Both are wrong.
    const ambulance = entry('ambulance');
    const piano = entry('concert-grand');
    expect(ambulance.massKg).toBe(5380); // WAS 300 Sprinter Type B, max total weight
    expect(piano.massKg).toBe(480); // Steinway Model D, 990 lb

    expect(countOf(4000, ambulance)).toBeCloseTo(0.74, 2);
    expect(countOf(4000, piano)).toBeCloseTo(8.33, 2);

    expect(countOf(4000, ambulance)).not.toBeCloseTo(2.9, 1);
    expect(countOf(4000, piano)).not.toBeCloseTo(45, 0);
  });

  it('carries the verified spectacle anchors', () => {
    expect(entry('blue-whale').massKg).toBe(110_000); // NOAA Fisheries average
    expect(entry('blue-whale-tongue').massKg).toBe(2700); // NAMMCO
    expect(entry('blue-whale-heart').massKg).toBe(180); // NOAA / ROM Trout River specimen
    expect(entry('iss').massKg).toBe(419_725); // NASA, 925,335 lb
    expect(entry('statue-of-liberty').massKg).toBe(204_100); // NPS total, not the 156 t copper+steel figure
    expect(entry('big-ben-bell').massKg).toBe(13_700); // UK Parliament, the Great Bell
    expect(entry('christ-the-redeemer').massKg).toBe(635_000);
    expect(entry('saturn-v').massKg).toBe(2_900_000);
    expect(entry('stonehenge-sarsen').massKg).toBe(20_000); // Science Advances 2020
    expect(entry('african-elephant').massKg).toBe(5300);
  });

  it('keeps both Eiffel Tower figures, labelled so the copy is never ambiguous', () => {
    const iron = entry('eiffel-iron');
    const whole = entry('eiffel-tower');
    expect(iron.massKg).toBe(7_300_000); // SETE, ironwork only
    expect(whole.massKg).toBe(10_100_000); // SETE, including foundations and fittings
    expect(iron.singular).toContain('ironwork');
    expect(whole.singular).toContain('whole');
  });

  it('bakes the weight basis into aircraft names', () => {
    expect(entry('boeing-747-empty').massKg).toBe(220_100);
    expect(entry('boeing-747-loaded').massKg).toBe(447_700);
    expect(entry('a380-empty').massKg).toBe(277_000);
    expect(entry('a380-loaded').massKg).toBe(575_000);
    expect(entry('boeing-747-empty').singular).toContain('empty');
    expect(entry('boeing-747-loaded').singular).toContain('loaded');
  });

  it('keeps legend-tier objects out of the per-session picker', () => {
    expect(entry('titanic').massKg).toBe(52_310_000);
    expect(entry('empire-state').massKg).toBe(331_000_000);
    expect(entry('great-pyramid').massKg).toBe(5_900_000_000);
    for (const id of ['titanic', 'empire-state', 'great-pyramid']) {
      expect(isMilestone(entry(id)), id).toBe(true);
    }
  });

  it('flags contested masses as estimates rather than asserting them', () => {
    expect(entry('t-rex').confidence).toBe('estimate');
    expect(entry('argentinosaurus').confidence).toBe('estimate');
    expect(entry('woolly-mammoth').confidence).toBe('estimate');
    expect(entry('blue-whale').confidence).toBe('verified');
  });
});

describe('lookup helpers', () => {
  it('finds an entry by slug and survives a retired id', () => {
    expect(getEquivalent('blue-whale')?.name).toBe('blue whale');
    expect(getEquivalent('not-a-real-id')).toBeUndefined();
  });

  it('counts in kilograms and refuses non-positive totals', () => {
    const whale = entry('blue-whale');
    expect(countOf(1_600_000, whale)).toBeCloseTo(14.55, 2); // research worked example
    expect(countOf(0, whale)).toBe(0);
    expect(countOf(-500, whale)).toBe(0);
    expect(countOf(Number.NaN, whale)).toBe(0);
    expect(countOf(Number.POSITIVE_INFINITY, whale)).toBe(0);
  });
});
