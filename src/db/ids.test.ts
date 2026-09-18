import { describe, expect, it } from 'vitest';

import {
  CROCKFORD32,
  POS_ALPHABET,
  POS_FIRST,
  ULID_LENGTH,
  ULID_MAX_TIME_MS,
  ULID_RANDOM_BYTES,
  between,
  compareOrdered,
  createUlidFactory,
  decodeUlidTime,
  encodeUlidTime,
  isUlid,
  isValidPos,
  posAfter,
  posBefore,
  positionsBetween,
  ulidFromParts,
} from './ids';

/** Deterministic randomness: a counter, so every test run mints the same ids. */
function seededRandomBytes(seed = 0): (n: number) => Uint8Array {
  let state = seed >>> 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      // xorshift32 — no crypto strength needed, only repeatability.
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      out[i] = state & 0xff;
    }
    return out;
  };
}

function fixedClock(startMs: number): { now: () => number; set: (ms: number) => void } {
  let ms = startMs;
  return { now: () => ms, set: (next: number) => { ms = next; } };
}

describe('ULID encoding', () => {
  it('encodes the epoch as ten zeroes and the 48-bit ceiling as 7ZZZZZZZZZ', () => {
    // Ten base-32 characters hold 50 bits; a ULID timestamp is 48, so the two
    // spare high bits cap the leading character at '7'. That cap is what
    // isUlid() checks.
    expect(encodeUlidTime(0)).toBe('0000000000');
    expect(encodeUlidTime(ULID_MAX_TIME_MS)).toBe('7ZZZZZZZZZ');
  });

  it('matches the ULID specification worked example for the timestamp component', () => {
    // 1469918176385 ms -> "01ARYZ6S41" (the ULID spec's canonical example
    // 01ARZ3NDEKTSV4RRFFQ69G5FAV uses the same encoding).
    expect(encodeUlidTime(1_469_918_176_385)).toBe('01ARYZ6S41');
    expect(decodeUlidTime('01ARYZ6S41' + 'Z'.repeat(16))).toBe(1_469_918_176_385);
  });

  it('round-trips arbitrary timestamps', () => {
    const zero = new Uint8Array(ULID_RANDOM_BYTES);
    for (const ms of [0, 1, 999, 1_000_000, 1_700_000_000_000, ULID_MAX_TIME_MS]) {
      expect(decodeUlidTime(ulidFromParts(ms, zero))).toBe(ms);
    }
  });

  it('encodes 80 zero bits and 80 one bits at the extremes of the random field', () => {
    const zero = new Uint8Array(ULID_RANDOM_BYTES);
    const ones = new Uint8Array(ULID_RANDOM_BYTES).fill(0xff);
    expect(ulidFromParts(0, zero)).toBe('0'.repeat(26));
    expect(ulidFromParts(0, ones)).toBe('0000000000' + 'Z'.repeat(16));
  });

  it('rejects out-of-range and malformed input rather than silently truncating', () => {
    expect(() => encodeUlidTime(-1)).toThrow(RangeError);
    expect(() => encodeUlidTime(1.5)).toThrow(RangeError);
    expect(() => encodeUlidTime(ULID_MAX_TIME_MS + 1)).toThrow(RangeError);
    expect(() => ulidFromParts(0, new Uint8Array(9))).toThrow(RangeError);
    expect(() => decodeUlidTime('TOOSHORT')).toThrow(RangeError);
    expect(() => decodeUlidTime('U' + '0'.repeat(25))).toThrow(RangeError); // U is not in Crockford32
  });

  it('validates ULID shape', () => {
    expect(isUlid('0'.repeat(26))).toBe(true);
    expect(isUlid('7' + 'Z'.repeat(25))).toBe(true);
    expect(isUlid('8' + 'Z'.repeat(25))).toBe(false); // timestamp overflows 48 bits
    expect(isUlid('0'.repeat(25))).toBe(false);
    expect(isUlid('I' + '0'.repeat(25))).toBe(false); // I is excluded from Crockford32
    expect(isUlid('')).toBe(false);
  });

  it('excludes the four ambiguous letters from the alphabet', () => {
    for (const c of ['I', 'L', 'O', 'U']) expect(CROCKFORD32.includes(c)).toBe(false);
    expect(CROCKFORD32).toHaveLength(32);
  });
});

describe('ULID generation', () => {
  it('produces well-formed, unique, ascending ids', () => {
    const clock = fixedClock(1_700_000_000_000);
    const ulid = createUlidFactory({ now: clock.now, randomBytes: seededRandomBytes(7) });
    const ids: string[] = [];
    for (let i = 0; i < 500; i++) {
      if (i % 5 === 0) clock.set(1_700_000_000_000 + i);
      ids.push(ulid());
    }
    for (const id of ids) {
      expect(id).toHaveLength(ULID_LENGTH);
      expect(isUlid(id)).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]! > ids[i - 1]!).toBe(true);
    }
  });

  it('is monotonic inside a single millisecond by incrementing entropy, not redrawing it', () => {
    const clock = fixedClock(1_700_000_000_000);
    const ulid = createUlidFactory({ now: clock.now, randomBytes: () => new Uint8Array(ULID_RANDOM_BYTES) });
    const a = ulid();
    const b = ulid();
    const c = ulid();
    expect(decodeUlidTime(a)).toBe(1_700_000_000_000);
    expect(decodeUlidTime(b)).toBe(1_700_000_000_000);
    expect(a.slice(10)).toBe('0'.repeat(16));
    expect(b.slice(10)).toBe('0'.repeat(15) + '1');
    expect(c.slice(10)).toBe('0'.repeat(15) + '2');
    expect(a < b && b < c).toBe(true);
  });

  it('carries across byte boundaries when entropy is saturated', () => {
    const clock = fixedClock(1_700_000_000_000);
    const saturated = new Uint8Array(ULID_RANDOM_BYTES).fill(0xff);
    saturated[ULID_RANDOM_BYTES - 1] = 0xfe;
    const ulid = createUlidFactory({ now: clock.now, randomBytes: () => saturated });
    const a = ulid();
    const b = ulid();
    expect(a.slice(10)).toBe('ZZZZZZZZZZZZZZZY');
    expect(b.slice(10)).toBe('Z'.repeat(16));
    expect(b > a).toBe(true);
    // The next one would overflow 80 bits within the same millisecond.
    expect(() => ulid()).toThrow(RangeError);
  });

  it('never mints a descending id when the wall clock jumps backwards', () => {
    // The exact scenario in the brief: a phone whose battery died cold-boots with
    // a skewed clock. Ids must still sort after everything already written.
    const clock = fixedClock(1_700_000_000_000);
    const ulid = createUlidFactory({ now: clock.now, randomBytes: seededRandomBytes(3) });
    const before = ulid();
    clock.set(1_600_000_000_000); // one hundred billion ms in the past
    const after = ulid();
    expect(after > before).toBe(true);
    expect(decodeUlidTime(after)).toBe(1_700_000_000_000);
  });

  it('rejects a randomness source that returns the wrong number of bytes', () => {
    const ulid = createUlidFactory({ now: () => 0, randomBytes: () => new Uint8Array(4) });
    expect(() => ulid()).toThrow(RangeError);
  });

  it('does not alias the buffer handed back by the randomness source', () => {
    // A native getRandomBytes may reuse one scratch buffer. If we kept a
    // reference, a later fill would retroactively change an already-minted id.
    const shared = new Uint8Array(ULID_RANDOM_BYTES);
    const clock = fixedClock(1);
    const ulid = createUlidFactory({ now: clock.now, randomBytes: () => shared });
    const first = ulid();
    shared.fill(0xff);
    clock.set(2);
    const second = ulid();
    expect(first.slice(10)).toBe('0'.repeat(16));
    expect(second.slice(10)).toBe('Z'.repeat(16));
  });
});

describe('fractional indexing', () => {
  it('reproduces the research brief worked example', () => {
    expect(between('a', 'b')).toBe('aU');
  });

  it('gives the midpoint of the alphabet to the first row of an empty list', () => {
    expect(between(null, null)).toBe(POS_FIRST);
    expect(posAfter(null)).toBe(POS_FIRST);
    expect(posBefore(null)).toBe(POS_FIRST);
  });

  it('appends after and prepends before an existing key', () => {
    const first = POS_FIRST;
    const last = posAfter(first);
    const head = posBefore(first);
    expect(last > first).toBe(true);
    expect(head < first).toBe(true);
  });

  it('always lands strictly between its two neighbours', () => {
    const pairs: Array<[string | null, string | null]> = [
      [null, null],
      [null, '2'],
      ['z', null],
      ['a', 'b'],
      ['a', 'a1'],
      ['0', '1'],
      ['00', '01'],
      ['zzzzzzzz', null],
      ['a0U', 'a1'],
    ];
    for (const [lo, hi] of pairs) {
      const mid = between(lo, hi);
      expect(isValidPos(mid)).toBe(true);
      if (lo !== null) expect(mid > lo).toBe(true);
      if (hi !== null) expect(mid < hi).toBe(true);
    }
  });

  it('can always insert between any two neighbours, no matter how many times', () => {
    // The property that makes integer positions unnecessary: the gap never runs
    // out. 400 consecutive insertions into the *same* gap must all succeed and
    // stay ordered.
    let lo = 'a';
    const hi = 'b';
    const minted: string[] = [];
    for (let i = 0; i < 400; i++) {
      const mid = between(lo, hi);
      expect(mid > lo).toBe(true);
      expect(mid < hi).toBe(true);
      minted.push(mid);
      lo = mid; // squeeze against the rising floor: the hardest direction
    }
    expect(new Set(minted).size).toBe(minted.length);
    const sorted = [...minted].sort();
    expect(sorted).toEqual(minted);
  });

  it('survives repeated insertion at the head of the list', () => {
    let hi = POS_FIRST;
    const minted: string[] = [];
    for (let i = 0; i < 200; i++) {
      const mid = between(null, hi);
      expect(mid < hi).toBe(true);
      minted.push(mid);
      hi = mid;
    }
    expect(new Set(minted).size).toBe(minted.length);
  });

  it('keeps a randomly shuffled list totally ordered and collision-free', () => {
    // Deterministic pseudo-random insertions at arbitrary slots, which is what a
    // user dragging sets around actually produces.
    let seed = 123456789;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const list: string[] = [POS_FIRST];
    for (let i = 0; i < 1000; i++) {
      const slot = Math.floor(rand() * (list.length + 1));
      const lo = slot === 0 ? null : (list[slot - 1] ?? null);
      const hi = slot === list.length ? null : (list[slot] ?? null);
      const mid = between(lo, hi);
      list.splice(slot, 0, mid);
    }
    expect(new Set(list).size).toBe(list.length);
    for (let i = 1; i < list.length; i++) {
      expect(list[i]! > list[i - 1]!).toBe(true);
    }
  });

  it('mints a run of ascending keys for a materialised routine', () => {
    const keys = positionsBetween('a', 'b', 5);
    expect(keys).toHaveLength(5);
    for (let i = 0; i < keys.length; i++) {
      expect(keys[i]! > (i === 0 ? 'a' : keys[i - 1]!)).toBe(true);
      expect(keys[i]! < 'b').toBe(true);
    }
    expect(positionsBetween(null, null, 0)).toEqual([]);
    expect(() => positionsBetween(null, null, -1)).toThrow(RangeError);
  });

  it('rejects inverted or malformed bounds instead of producing a silent misorder', () => {
    expect(() => between('b', 'a')).toThrow(RangeError);
    expect(() => between('a', 'a')).toThrow(RangeError);
    expect(() => between('a!', 'b')).toThrow(RangeError);
    expect(() => between('a', 'b#')).toThrow(RangeError);
    expect(isValidPos('')).toBe(false);
  });

  it('never mints a key ending in the lowest character, and refuses one as an upper bound', () => {
    // A key ending in '0' can never be prepended to: it is the dead end that
    // makes a naive midpoint implementation lose rows at the head of a list.
    expect(between(null, '2')).toBe('0U');
    expect(between(null, '1')).toBe('0U');
    expect(() => between(null, '0')).toThrow(RangeError);
    expect(() => between(null, 'a0')).toThrow(RangeError);

    let hi: string | null = null;
    for (let i = 0; i < 300; i++) {
      const k = between(null, hi);
      expect(k.endsWith('0')).toBe(false);
      hi = k;
    }
  });

  it('orders its alphabet the same way SQLite compares TEXT', () => {
    for (let i = 1; i < POS_ALPHABET.length; i++) {
      expect(POS_ALPHABET.charCodeAt(i) > POS_ALPHABET.charCodeAt(i - 1)).toBe(true);
    }
  });
});

describe('compareOrdered', () => {
  it('sorts by pos, then breaks ties on id so two devices agree', () => {
    const a = { pos: 'U', id: '01AAAAAAAAAAAAAAAAAAAAAAAA' };
    const b = { pos: 'U', id: '01BBBBBBBBBBBBBBBBBBBBBBBB' };
    const c = { pos: 'V', id: '01AAAAAAAAAAAAAAAAAAAAAAAA' };
    expect(compareOrdered(a, b)).toBeLessThan(0);
    expect(compareOrdered(b, a)).toBeGreaterThan(0);
    expect(compareOrdered(a, c)).toBeLessThan(0);
    expect(compareOrdered(a, { ...a })).toBe(0);
    const rows = [c, b, a];
    expect([...rows].sort(compareOrdered)).toEqual([a, b, c]);
  });
});
