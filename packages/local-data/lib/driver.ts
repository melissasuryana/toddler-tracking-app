/**
 * The thin native boundary between this package's pure logic and a concrete
 * SQLite engine. The app injects an expo-sqlite-backed implementation; tests
 * inject Node's `node:sqlite`. Everything above this interface (schema,
 * migrations, repositories) is engine-agnostic and testable in plain Node.
 */

/** Minimal statement surface both expo-sqlite and node:sqlite provide. */
export interface SqliteStatement {
  all<T = unknown>(...params: unknown[]): T[];
  get<T = unknown>(...params: unknown[]): T | undefined;
  run(...params: unknown[]): void;
}

/**
 * Minimal database surface. `execSync` matches expo-sqlite's name;
 * node:sqlite calls it `exec` — the test adapter wraps it.
 */
export interface MigrationDriver {
  execSync(sql: string): void;
  prepareSync(sql: string): SqliteStatement;
  withTransactionSync(fn: () => void): void;
  closeSync(): void;
}
