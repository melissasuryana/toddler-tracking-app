/**
 * Startup migration runner — pure ordering/bookkeeping logic, executed
 * against any injected `MigrationDriver`.
 *
 * Forward-compatible contract (issue #43): later tickets append new
 * migrations to `MIGRATIONS` in order — never edit or reorder shipped ones —
 * and the runner applies exactly the pending suffix, in `index` order, each
 * inside its own transaction. The `user_version` pragma is the cursor.
 */

import type { MigrationDriver } from "./driver.ts";

export interface Migration {
  /** 1-based ordinal; must be strictly ascending across the list. */
  readonly index: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * Ordered migrations. #1 creates Child + preferences (ticket #43). Entry
 * tables and seeding hooks land here as #2+ in later tickets.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    index: 1,
    name: "0001_child_and_preferences",
    sql: `
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  birthdate TEXT NOT NULL,
  sex TEXT NOT NULL,
  photo TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
  },
];

/** Reads the applied-migration cursor (`PRAGMA user_version`). */
export function currentVersion(db: MigrationDriver): number {
  const row = db
    .prepareSync("PRAGMA user_version")
    .get<{ user_version: number }>();
  return row?.user_version ?? 0;
}

/** Throws unless the list is strictly ascending from index 1 with no gaps. */
export function assertOrdered(migrations: readonly Migration[]): void {
  migrations.forEach((migration, position) => {
    const expected = position + 1;
    if (migration.index !== expected) {
      throw new Error(
        `Migrations must be ordered 1..n with no gaps: expected index ${expected}, got ${migration.index} (${migration.name})`
      );
    }
  });
}

/** The pending suffix of the list, in application order. */
export function pendingMigrations(
  migrations: readonly Migration[],
  appliedVersion: number
): Migration[] {
  return migrations.filter((migration) => migration.index > appliedVersion);
}

/**
 * Applies every pending migration in order, each in its own transaction, and
 * advances `user_version` to the final index. Idempotent: re-running on a
 * current database is a no-op.
 */
export function runMigrations(
  db: MigrationDriver,
  migrations: readonly Migration[] = MIGRATIONS
): { applied: string[]; fromVersion: number; toVersion: number } {
  assertOrdered(migrations);
  const fromVersion = currentVersion(db);
  const applied: string[] = [];
  for (const migration of pendingMigrations(migrations, fromVersion)) {
    db.withTransactionSync(() => {
      db.execSync(migration.sql);
      db.execSync(`PRAGMA user_version = ${migration.index}`);
    });
    applied.push(migration.name);
  }
  return {
    applied,
    fromVersion,
    toVersion: fromVersion + applied.length,
  };
}
