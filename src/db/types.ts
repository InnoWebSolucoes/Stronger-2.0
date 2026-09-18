/**
 * types.ts — the narrow database interface everything above the driver talks to.
 *
 * `client.ts` is the only file that knows about expo-sqlite. Recovery and the
 * query modules take a {@link SqlDatabase} instead, which means their logic can
 * be reasoned about — and their pure parts tested — without a device, and means
 * swapping the driver (op-sqlite, a web VFS, a test double) touches one file.
 *
 * The shape deliberately mirrors what every SQLite driver already offers, so the
 * adapter in client.ts is a thin wrapper and not a query layer of its own.
 */

/** A value SQLite can bind to a parameter. Booleans are 0/1, dates are ISO text. */
export type SqlValue = string | number | null | Uint8Array;

/** Positional bind parameters, in `?` order. */
export type SqlParams = readonly SqlValue[];

/** Result of a statement that changes rows. */
export interface SqlRunResult {
  /** Rows inserted, updated or deleted. */
  readonly changes: number;
}

/**
 * Anything that can run a statement: the database itself, or a transaction
 * handle inside {@link SqlDatabase.transaction}.
 */
export interface SqlExecutor {
  /** Run a query and return every row. */
  getAll<T>(sql: string, params?: SqlParams): Promise<T[]>;
  /** Run a query and return the first row, or null when there is none. */
  getFirst<T>(sql: string, params?: SqlParams): Promise<T | null>;
  /** Run a statement that changes rows. */
  run(sql: string, params?: SqlParams): Promise<SqlRunResult>;
}

/** A database connection. */
export interface SqlDatabase extends SqlExecutor {
  /**
   * Run `fn` inside one transaction, committing on return and rolling back on
   * throw. Every multi-row mutation in this layer goes through here: a set and
   * the aggregates it changes must land together or not at all.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  /** Execute one or more statements with no parameters (PRAGMAs, DDL). */
  exec(sql: string): Promise<void>;
  /** Close the connection. */
  close(): Promise<void>;
}
