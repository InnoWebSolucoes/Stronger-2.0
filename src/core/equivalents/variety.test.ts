import { describe, expect, it } from 'vitest';
import {
  COOLDOWN_SPAN,
  HISTORY_DEPTH,
  PHI_INV,
  appendShown,
  cooldownPenalty,
  hash32,
  recentIds,
  rotation,
  sessionIndexFromEpochMs,
  type ShownRecord,
} from './variety';

describe('hash32', () => {
  it('is FNV-1a: deterministic, unsigned, 32-bit', () => {
    for (const s of ['', 'a', 'blue-whale', 'concert-grand']) {
      const h = hash32(s);
      expect(h).toBe(hash32(s));
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
    expect(hash32('')).toBe(0x811c9dc5); // the FNV offset basis, untouched
  });

  it('separates similar ids', () => {
    expect(hash32('eiffel-iron')).not.toBe(hash32('eiffel-tower'));
  });
});

describe('rotation', () => {
  it('stays inside [-1, 1] and never uses randomness', () => {
    for (const id of ['blue-whale', 'ambulance', 'sugar-bag']) {
      for (let session = 0; session < 50; session++) {
        const r = rotation(id, session);
        expect(r).toBeGreaterThanOrEqual(-1);
        expect(r).toBeLessThanOrEqual(1);
        expect(rotation(id, session)).toBe(r); // identical on every call, forever
      }
    }
  });

  it('advances by the golden-ratio step so sessions never form a short cycle', () => {
    expect(PHI_INV).toBeCloseTo(0.6180339887, 9);
    const values = new Set<number>();
    for (let session = 0; session < 40; session++) values.add(rotation('blue-whale', session));
    expect(values.size).toBeGreaterThan(35);
  });

  it('handles a zero or negative session index without producing NaN', () => {
    expect(Number.isFinite(rotation('blue-whale', 0))).toBe(true);
    expect(Number.isFinite(rotation('blue-whale', -7))).toBe(true);
  });
});

describe('cooldownPenalty', () => {
  const history: ShownRecord[] = [
    { id: 'blue-whale', sessionIndex: 10 },
    { id: 'ambulance', sessionIndex: 4 },
  ];

  it('is zero for an entry never shown', () => {
    expect(cooldownPenalty('sugar-bag', history, 11)).toBe(0);
  });

  it('decays linearly from 1 over the cooldown span', () => {
    expect(cooldownPenalty('blue-whale', history, 11)).toBeCloseTo(1 - 1 / COOLDOWN_SPAN, 10);
    expect(cooldownPenalty('blue-whale', history, 14)).toBeCloseTo(1 - 4 / COOLDOWN_SPAN, 10);
    expect(cooldownPenalty('blue-whale', history, 18)).toBe(0);
    expect(cooldownPenalty('blue-whale', history, 30)).toBe(0);
  });

  it('uses the most recent appearance when an entry was shown twice', () => {
    const repeated: ShownRecord[] = [
      { id: 'ambulance', sessionIndex: 1 },
      { id: 'ambulance', sessionIndex: 9 },
    ];
    expect(cooldownPenalty('ambulance', repeated, 10)).toBeCloseTo(0.875, 10);
  });

  it('does not reward a record from the future (re-opening an old summary)', () => {
    expect(cooldownPenalty('blue-whale', history, 8)).toBe(0);
  });

  it('is zero for an empty history', () => {
    expect(cooldownPenalty('blue-whale', [], 5)).toBe(0);
  });
});

describe('appendShown', () => {
  it('adds the shown ids and trims to the history depth', () => {
    let history: ShownRecord[] = [];
    for (let session = 1; session <= 30; session++) {
      history = appendShown(history, session, [`entry-${session}`, `other-${session}`]);
    }
    const oldest = Math.min(...history.map((r) => r.sessionIndex));
    expect(oldest).toBe(30 - HISTORY_DEPTH + 1);
    expect(history).toHaveLength(HISTORY_DEPTH * 2);
  });

  it('does not mutate the input', () => {
    const original: ShownRecord[] = [{ id: 'a', sessionIndex: 1 }];
    const next = appendShown(original, 2, ['b']);
    expect(original).toHaveLength(1);
    expect(next).toHaveLength(2);
  });

  it('accepts an empty id list', () => {
    expect(appendShown([{ id: 'a', sessionIndex: 1 }], 2, [])).toHaveLength(1);
  });
});

describe('recentIds', () => {
  it('lists ids inside the cooldown window, newest first, without duplicates', () => {
    const history: ShownRecord[] = [
      { id: 'a', sessionIndex: 1 },
      { id: 'b', sessionIndex: 9 },
      { id: 'c', sessionIndex: 10 },
      { id: 'b', sessionIndex: 10 },
    ];
    expect(recentIds(history, 11)).toEqual(['c', 'b']);
  });
});

describe('sessionIndexFromEpochMs', () => {
  it('maps a workout timestamp to a stable day ordinal', () => {
    const day = 86_400_000;
    expect(sessionIndexFromEpochMs(0)).toBe(0);
    expect(sessionIndexFromEpochMs(day * 19_000 + 1)).toBe(19_000);
    expect(sessionIndexFromEpochMs(Date.UTC(2026, 0, 1))).toBe(
      sessionIndexFromEpochMs(Date.UTC(2026, 0, 1) + 3600_000),
    );
    expect(sessionIndexFromEpochMs(Number.NaN)).toBe(0);
  });
});
