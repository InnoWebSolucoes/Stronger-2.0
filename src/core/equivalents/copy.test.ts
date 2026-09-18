import { describe, expect, it } from 'vitest';
import { MASS_EQUIVALENTS, getEquivalent, type MassEquivalent } from './catalog';
import { nextMilestone, pickEquivalents, type Comparison } from './select';
import {
  HERO_TEMPLATES,
  assertCleanCopy,
  barTravelLine,
  bodyweightLine,
  climbLine,
  comparisonSentence,
  formatCount,
  formatDuration,
  formatKg,
  formatNumber,
  funAside,
  heroLine,
  isHedged,
  lintCopy,
  milestoneLine,
  phrase,
  templateFor,
  tensionLine,
  workLine,
} from './copy';
import { STEP_COUNTS, pickFoodComparison, pickHeightComparison } from './framings';

function comparison(id: string, totalKg: number): Comparison {
  const entry = getEquivalent(id);
  if (entry === undefined) throw new Error(`missing ${id}`);
  const count = totalKg / entry.massKg;
  const shown = count < 10 ? Math.round(count * 10) / 10 : Math.round(count);
  return { entry, count, shown, isWhole: count >= 0.92 && count <= 1.12, score: 1 };
}

describe('number formatting', () => {
  it('groups thousands the same way on every device', () => {
    expect(formatNumber(18_420, 0)).toBe('18,420');
    expect(formatNumber(1_600_000, 0)).toBe('1,600,000');
    expect(formatNumber(3.0587, 1)).toBe('3.1');
    expect(formatNumber(4, 1)).toBe('4');
    expect(formatNumber(0, 0)).toBe('0');
    expect(formatNumber(Number.NaN, 0)).toBe('0');
    expect(formatNumber(-250, 0)).toBe('-250');
  });

  it('formats kilogram totals and counts', () => {
    expect(formatKg(18_420)).toBe('18,420 kg');
    expect(formatKg(0)).toBe('0 kg');
    expect(formatCount(3.4)).toBe('3.4');
    expect(formatCount(38)).toBe('38');
  });

  it('formats durations', () => {
    expect(formatDuration(424)).toBe('7:04');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(3750)).toBe('1:02:30');
  });
});

describe('phrase', () => {
  it('never says "1.0 blue whales"', () => {
    const whole = comparison('blue-whale', 110_000);
    expect(phrase(whole)).toBe('a whole blue whale');
    expect(phrase(whole)).not.toContain('1.0');
  });

  it('handles the near-miss just under a whole object', () => {
    const nearly = comparison('blue-whale', 92_000); // 0.836x
    expect(phrase(nearly)).toBe('not quite a whole blue whale');
  });

  it('handles just over a whole object', () => {
    const over = comparison('blue-whale', 140_000); // 1.27x
    expect(phrase(over)).toBe('a whole blue whale, and then some');
  });

  it('pluralises normally in the satisfying window', () => {
    expect(phrase(comparison('african-elephant', 18_420))).toBe('3.5 African elephants');
    expect(phrase(comparison('concert-grand', 18_420))).toBe('38 concert grand pianos');
  });

  it('keeps a count and a digit-leading noun apart', () => {
    // "20 25 kg plates" is unreadable.
    expect(phrase(comparison('bumper-plate', 500))).toBe('20 × 25 kg plates');
  });
});

describe('hero copy', () => {
  it('rotates templates deterministically and out of phase with the entries', () => {
    expect(HERO_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const seen = new Set<string>();
    for (let session = 1; session <= HERO_TEMPLATES.length; session++) {
      seen.add(templateFor(session));
      expect(templateFor(session)).toBe(templateFor(session));
    }
    expect(seen.size).toBe(HERO_TEMPLATES.length);
  });

  it('builds a full hero line', () => {
    const picks = pickEquivalents(18_420, { sessionIndex: 7 });
    const line = heroLine(18_420, picks, 7);
    expect(line).toContain('18,420 kg');
    expect(lintCopy(line)).toEqual([]);
  });

  it('degrades to one clause, then to the bare number', () => {
    const single = [comparison('african-elephant', 18_420)];
    expect(heroLine(18_420, single, 1)).toBe('18,420 kg moved. That is 3.5 African elephants.');
    expect(heroLine(0, [], 1)).toBe('0 kg moved.');
  });

  it('writes the plain comparison sentence', () => {
    const picks = [
      comparison('african-elephant', 18_420),
      comparison('concert-grand', 18_420),
    ];
    expect(comparisonSentence(picks)).toBe(
      'That is 3.5 African elephants, or 38 concert grand pianos.',
    );
    expect(comparisonSentence([])).toBe('');
  });

  it('takes its aside only from a verified catalogue fact', () => {
    const picks = [comparison('blue-whale', 1_600_000)];
    expect(funAside(picks)).toBe(
      'The largest animal that has ever existed. Including the dinosaurs.',
    );
    expect(funAside([comparison('mattress', 500)])).toBe('');
  });

  it('flags masses that should be hedged in the UI', () => {
    expect(isHedged(comparison('polar-bear', 2000))).toBe(true); // representative
    expect(isHedged(comparison('blue-whale', 500_000))).toBe(false); // verified
  });
});

describe('framing copy', () => {
  it('states bodyweight multiples', () => {
    expect(bodyweightLine(216.7)).toBe('You lifted your own bodyweight 217 times.');
    expect(bodyweightLine(1.2)).toBe('That is 1.2 times your own bodyweight.');
    expect(bodyweightLine(0)).toBe('');
  });

  it('states bar travel against a landmark', () => {
    expect(barTravelLine(287, pickHeightComparison(287))).toBe(
      'The bar travelled 287 m. Almost the Eiffel Tower.',
    );
    expect(barTravelLine(93, pickHeightComparison(93))).toBe(
      'The bar travelled 93 m. The height of the Statue of Liberty.',
    );
    expect(barTravelLine(2, pickHeightComparison(2))).toBe('The bar travelled 2 m.');
    expect(barTravelLine(0, null)).toBe('');
  });

  it('states time under tension against session length', () => {
    expect(tensionLine(424, 42 * 60)).toBe('42 minutes in the gym. 7:04 of it under load.');
    expect(tensionLine(424, 0)).toBe('7:04 under load.');
    expect(tensionLine(0, 2520)).toBe('');
  });

  it('keeps mechanical work primary and kcal secondary', () => {
    const line = workLine(74_922, 110, pickFoodComparison(110));
    expect(line.startsWith('Mechanical work: 75 kJ.')).toBe(true);
    expect(line).toContain('Roughly 110 kcal.');
    expect(line).toContain('About 1 banana.');
    expect(workLine(0, 0, null)).toBe('');
  });

  it('states the lifetime milestone', () => {
    expect(milestoneLine(1_600_000, nextMilestone(1_600_000))).toBe(
      'Lifetime: 1,600,000 kg — 3.1% of the Titanic.',
    );
    expect(milestoneLine(0, nextMilestone(0))).toBe('Lifetime: 0 kg — 0% of the Titanic.');
    expect(milestoneLine(6_000_000_000, null)).toBe('Lifetime: 6,000,000,000 kg.');
  });

  it('states stair climbs', () => {
    const esb = STEP_COUNTS[0];
    expect(esb).toBeDefined();
    if (esb === undefined) return;
    expect(climbLine(1576, esb)).toBe('1,576 steps. That is the Empire State Building.');
    expect(climbLine(3152, esb)).toBe(
      '3,152 steps. That is the Empire State Building, 2 times over.',
    );
    expect(climbLine(0, esb)).toBe('');
  });
});

describe('tone lint', () => {
  it('rejects the bad worked copy from the research brief', () => {
    const bad =
      "🔥🔥 BEAST MODE! You absolutely CRUSHED 18,420 kg today!! 💪 That's like 2.9 ambulances! Amazing work champ, keep it up!! 🚀";
    const problems = lintCopy(bad);
    expect(problems).toContain('banned praise word');
    expect(problems).toContain('no exclamation marks');
    expect(problems).toContain('at most one emoji per screen');
    expect(problems).toContain('banned construction');
    expect(() => assertCleanCopy(bad)).toThrow(/tone rules/);
  });

  it('accepts the good worked copy from the research brief', () => {
    const good = [
      '18,420 kg',
      'That is 3.4 African elephants, or 38 concert grand pianos.',
      'You lifted your own bodyweight 216 times.',
      'The bar travelled 287 m. Almost the Eiffel Tower.',
      '42 minutes in the gym. 7:04 of it under load.',
      'Lifetime: 1,604,000 kg — 3.1% of the Titanic.',
    ].join('\n');
    expect(lintCopy(good)).toEqual([]);
  });

  it('allows one emoji but not two', () => {
    expect(lintCopy('18,420 kg. 🐘')).toEqual([]);
    expect(lintCopy('18,420 kg. 🐘🐘')).toContain('at most one emoji per screen');
  });

  it('does not flag monster trucks, which are objects rather than praise', () => {
    expect(lintCopy('That is 4.4 monster trucks.')).toEqual([]);
    expect(lintCopy('You were a monster today.')).toContain('banned praise word');
  });

  it('passes every catalogue fact', () => {
    const withFacts = MASS_EQUIVALENTS.filter((e: MassEquivalent) => e.fun !== undefined);
    expect(withFacts.length).toBeGreaterThan(40);
    for (const e of withFacts) {
      expect(lintCopy(e.fun ?? ''), e.id).toEqual([]);
    }
  });

  it('passes every line the system can generate across the whole volume range', () => {
    for (const total of [500, 2400, 6800, 12_500, 20_000, 45_000, 250_000, 1_600_000]) {
      for (let session = 1; session <= 12; session++) {
        const picks = pickEquivalents(total, { sessionIndex: session });
        const lines = [
          heroLine(total, picks, session),
          comparisonSentence(picks),
          funAside(picks),
          milestoneLine(total, nextMilestone(total)),
        ];
        for (const line of lines) {
          expect(lintCopy(line), `${total} kg session ${session}: ${line}`).toEqual([]);
        }
      }
    }
  });
});
