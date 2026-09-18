/**
 * pragmas.ts — the durability configuration of the local database.
 *
 * READ THIS BEFORE CHANGING A VALUE HERE. Every constant in this file is a
 * crash-safety decision, and every one of them looks like a free performance win
 * to someone who does not know what it is buying. SQLite's defaults are not
 * durable against power loss, and "the phone died mid-set" is power loss.
 *
 * Source: research brief, PART 4 (durability.ts) and the finding "SQLite's
 * default settings are not durable against power loss", citing
 * https://avi.im/blag/2025/sqlite-fsync/.
 *
 * This module is pure: it returns SQL strings and makes no connection, so the
 * policy can be tested in node and read by anyone auditing the crash-safety
 * contract in README.md.
 */

/** The platforms whose fsync behaviour differs in a way that matters here. */
export type DbPlatform = 'ios' | 'android' | 'web';

/**
 * How much durability the database is currently buying.
 *
 * - `browsing`   the user is scrolling history, looking at charts, editing a
 *                routine. Losing the last few milliseconds of such a write to a
 *                power cut is an annoyance, not a lost PR.
 * - `live_workout` a session is in progress. Every committed set must survive
 *                the battery dying one millisecond later.
 */
export type DurabilityMode = 'browsing' | 'live_workout';

/**
 * How long a writer waits for a lock before giving up with SQLITE_BUSY.
 *
 * 3000 ms. Under WAL there is normally only one writer (this app), so a busy
 * lock means a checkpoint or the sync engine is mid-write. Three seconds is far
 * longer than either takes and still short enough that a genuine deadlock
 * surfaces as an error the user can be told about rather than a frozen UI.
 * Zero — the SQLite default — turns a routine overlap into a spurious failure
 * while a set is being written.
 */
export const BUSY_TIMEOUT_MS = 3000;

/**
 * Pages of WAL allowed to accumulate before SQLite checkpoints automatically.
 *
 * 200 pages (~800 KB at the 4 KB default page size), versus SQLite's default of
 * 1000. Crash recovery replays the whole WAL, so recovery time is O(WAL size),
 * and this database is opened on the critical path of a cold start — before the
 * first frame. A smaller WAL means a faster, more predictable launch after a
 * force-kill, at the cost of checkpointing more often. That trade is correct
 * here: checkpoints happen while the user is reading the screen, launches happen
 * while the user is waiting.
 */
export const WAL_AUTOCHECKPOINT_PAGES = 200;

/**
 * PRAGMAs applied once when the connection is opened, in this order.
 *
 * `journal_mode = WAL` is persistent (it is a property of the database file, not
 * the connection) but is re-stated on every open because a database restored
 * from a backup or copied between devices can come back in rollback-journal
 * mode, and that mode needs `synchronous = EXTRA` to be durable at all.
 *
 * @param platform Which OS this connection is running on.
 * @param mode Durability to start in. Defaults to `browsing`; recovery raises it
 *             if it finds a live session.
 * @returns PRAGMA statements to execute in order.
 */
export function openPragmas(platform: DbPlatform, mode: DurabilityMode = 'browsing'): string[] {
  return [
    // Readers do not block the writer and the writer does not block readers, so
    // the history list can render while the set the user just ticked is being
    // committed. Also: a WAL commit is an append, which is the cheapest thing
    // this app can do 300 times per session.
    'PRAGMA journal_mode = WAL',

    // Enforced, not assumed. Deleting a workout must take its exercises and sets
    // with it; SQLite leaves this OFF by default and it is per-connection, so
    // forgetting it silently orphans rows that then sync as ghosts.
    'PRAGMA foreign_keys = ON',

    // See BUSY_TIMEOUT_MS.
    `PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`,

    // See WAL_AUTOCHECKPOINT_PAGES.
    `PRAGMA wal_autocheckpoint = ${WAL_AUTOCHECKPOINT_PAGES}`,

    // Temp b-trees (ORDER BY on the history query, the aggregate recompute) stay
    // in RAM instead of hitting the filesystem. No durability cost: temp data is
    // by definition not worth recovering.
    'PRAGMA temp_store = MEMORY',

    ...durabilityPragmas(platform, mode),
  ];
}

/**
 * The PRAGMAs that decide whether a committed transaction survives power loss.
 * Settable at runtime on a live connection, which is what makes the
 * browsing/live-workout split possible.
 *
 * `synchronous = NORMAL` in WAL mode: a committed transaction survives an
 * application crash (a force-kill, an OOM kill, a JS exception) but "might roll
 * back following a power loss". That is acceptable while browsing.
 *
 * `synchronous = FULL` during a live workout: every commit is fsynced before it
 * returns, so a set that has shown its checkmark has reached the disk. This is
 * the single most important line in the database layer.
 *
 * `fullfsync = ON` on iOS: on Apple platforms `fsync()` returns once the data
 * reaches the drive's write cache, not the platter, so `synchronous = FULL`
 * alone does not mean durable. F_FULLFSYNC flushes that cache. Without it, the
 * FULL setting is a comforting lie on exactly the platform the app ships on
 * first. It costs nothing on Android, where fsync already flushes.
 *
 * @param platform Which OS this connection is running on.
 * @param mode The durability level to move to.
 * @returns PRAGMA statements to execute in order.
 */
export function durabilityPragmas(platform: DbPlatform, mode: DurabilityMode): string[] {
  const statements = [`PRAGMA synchronous = ${mode === 'live_workout' ? 'FULL' : 'NORMAL'}`];
  if (platform === 'ios') {
    statements.push(`PRAGMA fullfsync = ${mode === 'live_workout' ? 'ON' : 'OFF'}`);
  }
  return statements;
}

/**
 * Checkpoint the WAL back into the main database file.
 *
 * `PASSIVE` is what runs when the app is backgrounded: it copies whatever it can
 * without ever blocking a reader or writer, so it cannot stall the UI on the way
 * out. It is the reason a launch after a force-kill has a small WAL to replay.
 *
 * `TRUNCATE` blocks until the WAL is empty and resets it to zero length; it is
 * for maintenance and for making a backup copy consistent, never for the
 * background handler.
 *
 * @param kind Checkpoint aggressiveness.
 */
export function checkpointStatement(kind: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'PASSIVE'): string {
  return `PRAGMA wal_checkpoint(${kind})`;
}

/** The PRAGMA values a correctly configured connection must report back. */
export interface PragmaExpectation {
  readonly journalMode: 'wal';
  readonly foreignKeys: 1;
  readonly synchronous: 1 | 2;
  readonly busyTimeoutMs: number;
  readonly walAutocheckpointPages: number;
}

/**
 * What {@link openPragmas} should have produced, for a post-open self-check.
 *
 * `synchronous` is reported by SQLite as an integer: 1 = NORMAL, 2 = FULL. A
 * connection that reports 0 (OFF) or a journal mode other than `wal` is not safe
 * to run a workout on, and the caller should say so loudly rather than let the
 * user train on it.
 *
 * @param mode The durability mode the connection was configured for.
 */
export function expectedPragmas(mode: DurabilityMode): PragmaExpectation {
  return {
    journalMode: 'wal',
    foreignKeys: 1,
    synchronous: mode === 'live_workout' ? 2 : 1,
    busyTimeoutMs: BUSY_TIMEOUT_MS,
    walAutocheckpointPages: WAL_AUTOCHECKPOINT_PAGES,
  };
}

/**
 * Compare what SQLite actually reports against {@link expectedPragmas}.
 *
 * @param mode The durability mode the connection was configured for.
 * @param actual The values read back with `PRAGMA journal_mode` etc.
 * @returns A list of human-readable mismatches; empty means the connection is
 *          configured as the crash-safety contract requires.
 */
export function pragmaMismatches(
  mode: DurabilityMode,
  actual: { journalMode: string; foreignKeys: number; synchronous: number },
): string[] {
  const expected = expectedPragmas(mode);
  const problems: string[] = [];
  if (actual.journalMode.toLowerCase() !== expected.journalMode) {
    problems.push(`journal_mode is ${actual.journalMode}, expected ${expected.journalMode}`);
  }
  if (actual.foreignKeys !== expected.foreignKeys) {
    problems.push(`foreign_keys is ${actual.foreignKeys}, expected ${expected.foreignKeys}`);
  }
  if (actual.synchronous !== expected.synchronous) {
    problems.push(
      `synchronous is ${actual.synchronous}, expected ${expected.synchronous}` +
        ` (${mode === 'live_workout' ? 'FULL' : 'NORMAL'})`,
    );
  }
  return problems;
}
