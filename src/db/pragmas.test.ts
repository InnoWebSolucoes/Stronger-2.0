import { describe, expect, it } from 'vitest';

import {
  BUSY_TIMEOUT_MS,
  WAL_AUTOCHECKPOINT_PAGES,
  checkpointStatement,
  durabilityPragmas,
  expectedPragmas,
  openPragmas,
  pragmaMismatches,
} from './pragmas';

describe('openPragmas', () => {
  it('puts the database in WAL mode with foreign keys enforced', () => {
    const statements = openPragmas('ios');
    expect(statements).toContain('PRAGMA journal_mode = WAL');
    expect(statements).toContain('PRAGMA foreign_keys = ON');
  });

  it('applies the documented busy timeout and WAL checkpoint threshold', () => {
    const statements = openPragmas('android');
    expect(statements).toContain(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    expect(statements).toContain(`PRAGMA wal_autocheckpoint = ${WAL_AUTOCHECKPOINT_PAGES}`);
    expect(BUSY_TIMEOUT_MS).toBe(3000);
    expect(WAL_AUTOCHECKPOINT_PAGES).toBe(200);
  });

  it('sets journal mode before anything that depends on it', () => {
    const statements = openPragmas('ios', 'live_workout');
    const journal = statements.indexOf('PRAGMA journal_mode = WAL');
    const sync = statements.findIndex((s) => s.startsWith('PRAGMA synchronous'));
    expect(journal).toBe(0);
    expect(sync).toBeGreaterThan(journal);
  });

  it('starts in browsing durability unless told otherwise', () => {
    expect(openPragmas('ios')).toContain('PRAGMA synchronous = NORMAL');
    expect(openPragmas('ios', 'live_workout')).toContain('PRAGMA synchronous = FULL');
  });
});

describe('durabilityPragmas', () => {
  it('raises synchronous to FULL for a live workout and drops it for browsing', () => {
    expect(durabilityPragmas('android', 'live_workout')).toEqual(['PRAGMA synchronous = FULL']);
    expect(durabilityPragmas('android', 'browsing')).toEqual(['PRAGMA synchronous = NORMAL']);
  });

  it('adds fullfsync on iOS, where fsync does not flush the drive cache', () => {
    // Without this, synchronous = FULL is a comforting lie on the platform the
    // app ships on first.
    expect(durabilityPragmas('ios', 'live_workout')).toEqual([
      'PRAGMA synchronous = FULL',
      'PRAGMA fullfsync = ON',
    ]);
    expect(durabilityPragmas('ios', 'browsing')).toEqual([
      'PRAGMA synchronous = NORMAL',
      'PRAGMA fullfsync = OFF',
    ]);
  });

  it('does not emit fullfsync where it has no meaning', () => {
    for (const platform of ['android', 'web'] as const) {
      expect(durabilityPragmas(platform, 'live_workout').some((s) => s.includes('fullfsync'))).toBe(false);
    }
  });
});

describe('checkpointStatement', () => {
  it('defaults to PASSIVE, which can never block the UI on the way to background', () => {
    expect(checkpointStatement()).toBe('PRAGMA wal_checkpoint(PASSIVE)');
    expect(checkpointStatement('TRUNCATE')).toBe('PRAGMA wal_checkpoint(TRUNCATE)');
  });
});

describe('pragmaMismatches', () => {
  it('is silent when the connection matches the contract', () => {
    expect(pragmaMismatches('browsing', { journalMode: 'wal', foreignKeys: 1, synchronous: 1 })).toEqual([]);
    expect(pragmaMismatches('live_workout', { journalMode: 'WAL', foreignKeys: 1, synchronous: 2 })).toEqual([]);
  });

  it('reports a connection that silently fell back to rollback-journal mode', () => {
    const problems = pragmaMismatches('browsing', { journalMode: 'delete', foreignKeys: 1, synchronous: 1 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('journal_mode');
  });

  it('reports a live workout running at less than FULL durability', () => {
    const problems = pragmaMismatches('live_workout', { journalMode: 'wal', foreignKeys: 1, synchronous: 1 });
    expect(problems.join(' ')).toContain('synchronous');
  });

  it('reports foreign keys left off, which silently orphans sets', () => {
    const problems = pragmaMismatches('browsing', { journalMode: 'wal', foreignKeys: 0, synchronous: 1 });
    expect(problems.join(' ')).toContain('foreign_keys');
  });

  it('maps the durability modes onto the integers SQLite reports', () => {
    expect(expectedPragmas('browsing').synchronous).toBe(1);
    expect(expectedPragmas('live_workout').synchronous).toBe(2);
  });
});
