/**
 * ids.ts — identity and ordering primitives for the local database.
 *
 * Two problems are solved here, both of them consequences of being offline-first:
 *
 *  1. IDENTITY. Rows are created on a phone that may not see a server for three
 *     days, so the primary key must be generated on the client, must be unique
 *     without coordination, and must sort by creation time (a time-ordered key
 *     makes btree inserts append instead of fragmenting, and keeps the 40 sets of
 *     one workout on adjacent pages). We use ULID: 48-bit millisecond timestamp +
 *     80 bits of randomness, Crockford Base32, 26 characters, lexicographically
 *     sortable as plain TEXT. Monotonic within a millisecond so two ids minted in
 *     the same tick still sort in creation order.
 *
 *  2. ORDERING. Child collections (sets inside an exercise, exercises inside a
 *     workout) are ordered by a fractional index string `pos`, never an integer
 *     position. An integer position requires renumbering every sibling on insert,
 *     which is a guaranteed conflict storm when two offline devices both insert
 *     "between set 2 and set 3". A fractional index lets both devices mint a
 *     distinct key in that gap and both rows survive, ordered deterministically.
 *
 * Source: research brief "Stronger 2.0 — offline-first data architecture",
 * PART 0 (conventions: `pos text`, client-generated time-ordered PK) and
 * PART 3 / ids.ts (the base-62 `between` midpoint algorithm, whose worked example
 * between('a','b') === 'aU' is asserted in the tests).
 *
 * This module is pure TypeScript. The clock and the randomness source are
 * injected, so every function here is deterministic under test and the module
 * itself imports nothing from react, react-native or expo-*.
 */

/** Monotonic-ish wall clock, in milliseconds since the Unix epoch. */
export type NowFn = () => number;

/** Cryptographic randomness source. Must return exactly `byteCount` bytes. */
export type RandomBytesFn = (byteCount: number) => Uint8Array;

/* ------------------------------------------------------------------------- */
/* ULID                                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Crockford Base32 alphabet: digits plus uppercase letters, with I, L, O and U
 * removed so a ULID read aloud or typed by a human cannot be confused with a
 * different one. Its index order matches ASCII order, which is what makes a
 * ULID sortable with a plain TEXT comparison in SQLite.
 */
export const CROCKFORD32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Characters of the timestamp component (48 bits at 5 bits per char, rounded up). */
export const ULID_TIME_LENGTH = 10;
/** Characters of the randomness component (80 bits at 5 bits per char). */
export const ULID_RANDOM_LENGTH = 16;
/** Total ULID length in characters. */
export const ULID_LENGTH = ULID_TIME_LENGTH + ULID_RANDOM_LENGTH;
/** Bytes of entropy behind the randomness component (80 bits). */
export const ULID_RANDOM_BYTES = 10;
/** Largest timestamp a 48-bit ULID can carry: 10889-08-02T05:31:50.655Z. */
export const ULID_MAX_TIME_MS = 281_474_976_710_655; // 2**48 - 1

/** A minted ULID: 26 uppercase Crockford Base32 characters. */
export type Ulid = string;

/**
 * Encode a millisecond timestamp as the 10-character ULID time component.
 *
 * @param ms Milliseconds since the Unix epoch, an integer in [0, ULID_MAX_TIME_MS].
 * @returns 10 Crockford Base32 characters, most significant first.
 */
export function encodeUlidTime(ms: number): string {
  if (!Number.isInteger(ms)) throw new RangeError(`ULID time must be an integer, got ${ms}`);
  if (ms < 0) throw new RangeError(`ULID time must not be negative, got ${ms}`);
  if (ms > ULID_MAX_TIME_MS) throw new RangeError(`ULID time ${ms} exceeds 48 bits`);
  let out = '';
  let rest = ms;
  for (let i = 0; i < ULID_TIME_LENGTH; i++) {
    const mod = rest % 32;
    out = charAt(mod) + out;
    rest = (rest - mod) / 32;
  }
  return out;
}

/**
 * Decode the timestamp embedded in a ULID.
 *
 * @param id A 26-character ULID.
 * @returns Milliseconds since the Unix epoch.
 */
export function decodeUlidTime(id: string): number {
  if (id.length !== ULID_LENGTH) {
    throw new RangeError(`ULID must be ${ULID_LENGTH} chars, got ${id.length}`);
  }
  let ms = 0;
  for (let i = 0; i < ULID_TIME_LENGTH; i++) {
    const c = id.charAt(i);
    const v = CROCKFORD32.indexOf(c);
    if (v < 0) throw new RangeError(`invalid ULID character ${JSON.stringify(c)} at index ${i}`);
    ms = ms * 32 + v;
  }
  return ms;
}

/**
 * True if `value` is a syntactically valid, decodable ULID: 26 Crockford Base32
 * characters whose leading character does not overflow 48 bits of timestamp.
 */
export function isUlid(value: string): boolean {
  if (value.length !== ULID_LENGTH) return false;
  for (let i = 0; i < value.length; i++) {
    if (CROCKFORD32.indexOf(value.charAt(i)) < 0) return false;
  }
  return CROCKFORD32.indexOf(value.charAt(0)) <= 7;
}

/**
 * Build a ULID from an explicit timestamp and an explicit 10-byte randomness
 * buffer. Exposed for tests and for replaying a recorded id; application code
 * uses {@link createUlidFactory}.
 *
 * @param ms Milliseconds since the Unix epoch.
 * @param randomness Exactly {@link ULID_RANDOM_BYTES} bytes (80 bits).
 */
export function ulidFromParts(ms: number, randomness: Uint8Array): Ulid {
  if (randomness.length !== ULID_RANDOM_BYTES) {
    throw new RangeError(
      `ULID randomness must be ${ULID_RANDOM_BYTES} bytes, got ${randomness.length}`,
    );
  }
  return encodeUlidTime(ms) + encodeRandomness(randomness);
}

/** A ULID generator. Calling it mints the next id. */
export type UlidFactory = () => Ulid;

export interface UlidFactoryOptions {
  /** Wall clock. Injected so tests can freeze or rewind time. */
  readonly now: NowFn;
  /** Randomness source. Injected so tests can make generation deterministic. */
  readonly randomBytes: RandomBytesFn;
}

/**
 * Create a monotonic ULID generator.
 *
 * Monotonicity rule (ULID spec): when two ids are minted inside the same
 * millisecond, the second reuses the timestamp and increments the previous
 * randomness by one rather than drawing fresh bytes. That guarantees
 * `id(n) < id(n+1)` as strings, so `ORDER BY id` stands in for "the order the
 * user actually did it" even when two sets land in the same tick.
 *
 * A clock that goes backwards (NTP correction, or a phone that cold-booted after
 * the battery died) is clamped to the last observed millisecond rather than
 * allowed to mint an id that sorts before rows already written. Ordering
 * correctness matters more here than a perfect wall-clock read; the
 * authoritative times of a workout are `started_at` / `completed_at`, never the
 * id.
 *
 * @param options Injected clock and randomness.
 * @returns A function minting strictly increasing 26-character ULIDs.
 */
export function createUlidFactory(options: UlidFactoryOptions): UlidFactory {
  const { now, randomBytes } = options;
  let lastMs = -1;
  // Annotated rather than inferred: TypeScript 6 parameterises Uint8Array over
  // its backing buffer, and an injected randomBytes may hand back a view over
  // any ArrayBufferLike (a SharedArrayBuffer, or a Node Buffer's pool).
  let lastRandom: Uint8Array<ArrayBufferLike> = new Uint8Array(ULID_RANDOM_BYTES);

  return function ulid(): Ulid {
    const wall = Math.floor(now());
    if (!Number.isFinite(wall)) throw new RangeError(`clock returned a non-finite value: ${wall}`);
    if (wall > lastMs) {
      lastMs = wall;
      lastRandom = takeRandomBytes(randomBytes);
    } else {
      // Same millisecond, or a clock that moved backwards: keep the timestamp
      // and increment the entropy so the new id still sorts after the last one.
      lastRandom = incrementRandomness(lastRandom);
    }
    return ulidFromParts(lastMs, lastRandom);
  };
}

function takeRandomBytes(randomBytes: RandomBytesFn): Uint8Array {
  const bytes = randomBytes(ULID_RANDOM_BYTES);
  if (bytes.length !== ULID_RANDOM_BYTES) {
    throw new RangeError(`randomBytes returned ${bytes.length} bytes, expected ${ULID_RANDOM_BYTES}`);
  }
  // Copy: the caller may reuse its buffer, and we hold on to these bytes.
  return Uint8Array.from(bytes);
}

/**
 * Big-endian +1 over the 80-bit randomness field, with carry. Overflow means
 * 2^80 ids inside one millisecond, which is impossible in practice and is a bug
 * if it ever happens, so it throws rather than wrapping and colliding.
 */
function incrementRandomness(input: Uint8Array): Uint8Array {
  const out = Uint8Array.from(input);
  for (let i = out.length - 1; i >= 0; i--) {
    const b = out[i] ?? 0;
    if (b < 0xff) {
      out[i] = b + 1;
      return out;
    }
    out[i] = 0;
  }
  throw new RangeError('ULID randomness overflow within a single millisecond');
}

/** Encode 80 bits (10 bytes) as 16 Crockford Base32 characters, MSB first. */
function encodeRandomness(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | (bytes[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += charAt((buffer >> bits) & 31);
    }
    // Keep only the bits still owed, so the 32-bit shift above never overflows.
    buffer &= (1 << bits) - 1;
  }
  // 80 bits is an exact multiple of 5, so nothing is left over.
  return out;
}

function charAt(index: number): string {
  const c = CROCKFORD32.charAt(index);
  if (c === '') throw new RangeError(`base32 index out of range: ${index}`);
  return c;
}

/* ------------------------------------------------------------------------- */
/* Fractional indexing (`pos`)                                                */
/* ------------------------------------------------------------------------- */

/**
 * Base-62 ordering alphabet. Its index order matches ASCII order
 * ('0'..'9' < 'A'..'Z' < 'a'..'z'), so `ORDER BY pos` in SQLite — a plain BINARY
 * text collation — produces exactly the order this module computes.
 */
export const POS_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Index of the lowest character in {@link POS_ALPHABET} (the digit '0'). */
const POS_ZERO = POS_ALPHABET.charAt(0);

/**
 * The `pos` given to the first row of an empty collection: the midpoint of the
 * alphabet, so there is as much room to prepend as there is to append.
 * Equal to `between(null, null)`.
 */
export const POS_FIRST = 'U';

/** True if `value` is a usable fractional index (non-empty, in-alphabet). */
export function isValidPos(value: string): boolean {
  if (value.length === 0) return false;
  for (let i = 0; i < value.length; i++) {
    if (POS_ALPHABET.indexOf(value.charAt(i)) < 0) return false;
  }
  return true;
}

/**
 * Mint a fractional index strictly between two neighbours.
 *
 * A key is read as a base-62 fraction: 'U' is 30/62, 'aU' is 36/62 + 30/62^2,
 * and so on. Between any two distinct fractions there is always another, so a
 * gap can never run out and no sibling row is ever renumbered.
 *
 * The algorithm strips the common prefix of the two keys, then looks at the
 * first differing digit. If the two digits have room between them it emits their
 * midpoint (floor, with an absent low digit treated as -1 and an absent high
 * digit as 62 — the convention the research brief uses, which is why
 * `between('a','b')` is `'aU'` and not `'aV'`). If the digits are consecutive it
 * keeps the low digit and descends one level, where the gap is the full
 * alphabet.
 *
 * Invariant: a minted key never ends in the lowest character '0'. A key ending
 * in '0' has nothing strictly below it that is not also below its own prefix,
 * so it would make "insert at the head" impossible forever. Where the naive
 * midpoint would produce one, this descends instead — `between(null,'2')` is
 * `'0U'`, not `'0'`. This is the bug in the brief's PART 3 sketch, which
 * returns `'0U'` for `between(null,'0')` — a key strictly *greater* than its
 * upper bound. `hi` is therefore rejected if it ends in '0'; nothing this module
 * mints ever does.
 *
 * @param lo The neighbour above which to insert, or null for "start of list".
 * @param hi The neighbour below which to insert, or null for "end of list".
 * @returns A new key `k` with `lo < k < hi` under plain string comparison.
 * @throws RangeError if `lo >= hi`, if either key contains a character outside
 *         {@link POS_ALPHABET}, or if `hi` ends in '0'.
 *
 * Source: research brief PART 3, ids.ts `between()`, corrected for the head-of
 * -list case. Worked example: between('a', 'b') === 'aU'.
 */
export function between(lo: string | null, hi: string | null): string {
  const low = lo ?? '';
  const high = hi ?? '';
  if (low !== '' && !isValidPos(low)) throw new RangeError(`invalid pos ${JSON.stringify(low)}`);
  if (high !== '' && !isValidPos(high)) throw new RangeError(`invalid pos ${JSON.stringify(high)}`);
  if (high.endsWith(POS_ZERO)) {
    throw new RangeError(
      `pos ${JSON.stringify(high)} ends in '${POS_ZERO}'; nothing can be inserted before it`,
    );
  }
  if (high !== '' && low >= high) {
    throw new RangeError(`pos bounds out of order: ${JSON.stringify(low)} >= ${JSON.stringify(high)}`);
  }
  return mintBetween(low, high === '' ? null : high);
}

/**
 * Core of {@link between}. `low` is '' for "no lower bound"; `high` is null for
 * "no upper bound". Precondition: low < high, and high does not end in '0'.
 */
function mintBetween(low: string, high: string | null): string {
  if (high !== null) {
    // Strip the longest common prefix and recurse on the remainder. `low < high`
    // guarantees the prefix cannot swallow the whole of `high`.
    let n = 0;
    while (n < low.length && n < high.length && low.charAt(n) === high.charAt(n)) n++;
    if (n > 0) {
      const highTail = high.slice(n);
      if (highTail === '') throw new RangeError('pos bounds out of order after prefix strip');
      return high.slice(0, n) + mintBetween(low.slice(n), highTail);
    }
  }

  const l = low === '' ? -1 : POS_ALPHABET.indexOf(low.charAt(0));
  const h = high === null ? POS_ALPHABET.length : POS_ALPHABET.indexOf(high.charAt(0));

  if (h - l > 1) {
    const mid = Math.floor((l + h) / 2);
    // mid === 0 would end the key in '0'. Emit it as a prefix instead and take
    // the midpoint one level down, where we are already strictly below `high`.
    if (mid === 0) return POS_ZERO + mintBetween('', null);
    return POS_ALPHABET.charAt(mid);
  }

  // The two digits are consecutive (or the low bound is absent and the high
  // digit is '0'), so there is no room at this level: keep the low digit and
  // descend, where the whole alphabet is available.
  if (l >= 0) return POS_ALPHABET.charAt(l) + mintBetween(low.slice(1), null);
  const highTail = high === null ? '' : high.slice(1);
  return POS_ZERO + mintBetween('', highTail === '' ? null : highTail);
}

/**
 * The `pos` for a row appended to the end of a collection.
 * @param last The current last `pos`, or null when the collection is empty.
 */
export function posAfter(last: string | null): string {
  return last === null ? POS_FIRST : between(last, null);
}

/**
 * The `pos` for a row prepended to the front of a collection.
 * @param first The current first `pos`, or null when the collection is empty.
 */
export function posBefore(first: string | null): string {
  return first === null ? POS_FIRST : between(null, first);
}

/**
 * Mint `count` ascending keys strictly between two neighbours. Used when a
 * routine is materialised into a live workout, so every exercise and set gets an
 * ordered key without one round trip per row.
 *
 * @param lo Lower neighbour, or null for "start of list".
 * @param hi Upper neighbour, or null for "end of list".
 * @param count How many keys to mint. Must be a non-negative integer.
 */
export function positionsBetween(lo: string | null, hi: string | null, count: number): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`count must be a non-negative integer, got ${count}`);
  }
  const out: string[] = [];
  let cursor = lo;
  for (let i = 0; i < count; i++) {
    const next = between(cursor, hi);
    out.push(next);
    cursor = next;
  }
  return out;
}

/**
 * Total order over ordered rows: `pos` first, ULID as the tie-break.
 *
 * Two offline devices can independently mint the *same* `pos` — they both saw
 * the same neighbours and both computed the same midpoint. That is not a bug and
 * must not be repaired by renumbering; it is resolved by falling back to the id,
 * which is unique. Every query over an ordered collection sorts by `(pos, id)`
 * for exactly this reason.
 *
 * @returns negative if `a` sorts first, positive if `b` sorts first, 0 if equal.
 */
export function compareOrdered(a: { pos: string; id: string }, b: { pos: string; id: string }): number {
  if (a.pos < b.pos) return -1;
  if (a.pos > b.pos) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
