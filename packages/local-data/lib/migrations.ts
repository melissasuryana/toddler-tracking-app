/**
 * Startup migration runner — pure ordering/bookkeeping logic, executed
 * against any injected `MigrationDriver`.
 *
 * Forward-compatible contract: append migrations in order — never edit or
 * reorder shipped ones — and apply the pending suffix in `index` order, each
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
 * Ordered migrations. #1 creates Child + preferences; #2 adds local metadata
 * and the sync-ready Entry base table.
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
  {
    index: 2,
    name: "0002_entries_and_metadata",
    sql: `
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO metadata (key, value)
  SELECT key, value FROM preferences WHERE key LIKE 'seed:%'
  ON CONFLICT(key) DO NOTHING;
DELETE FROM preferences WHERE key LIKE 'seed:%';
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY NOT NULL,
  child_id TEXT REFERENCES children(id) ON DELETE RESTRICT,
  kind TEXT,
  occurred_at INTEGER,
  occurred_tz TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  deleted_at INTEGER,
  is_seed INTEGER,
  CHECK (
    (is_seed = 0
      AND id GLOB '????????-????-7???-[89ab]???-????????????'
      AND id NOT GLOB '*[^0-9a-f-]*')
    OR (is_seed = 1
      AND length(id) > 0
      AND id GLOB '[a-z0-9]*'
      AND id NOT GLOB '*[^a-z0-9-]*'
      AND id NOT GLOB '*--*'
      AND id NOT GLOB '*-')
    OR (deleted_at IS NOT NULL AND (
      (id GLOB '????????-????-7???-[89ab]???-????????????'
        AND id NOT GLOB '*[^0-9a-f-]*')
      OR (
        length(id) > 0
        AND id GLOB '[a-z0-9]*'
        AND id NOT GLOB '*[^a-z0-9-]*'
        AND id NOT GLOB '*--*'
        AND id NOT GLOB '*-'
      )
    ))
  ),
  CHECK (
    (deleted_at IS NULL
      AND child_id IS NOT NULL
      AND kind IS NOT NULL
      AND kind IN (
        'feed', 'diaper_change', 'sleep_session', 'medical',
        'growth', 'meal', 'introduction', 'reaction'
      )
      AND typeof(occurred_at) = 'integer'
      AND occurred_at >= 0
      AND occurred_tz IS NOT NULL
      AND length(trim(occurred_tz)) > 0
      AND typeof(created_at) = 'integer'
      AND created_at >= 0
      AND typeof(updated_at) = 'integer'
      AND updated_at >= 0
      AND is_seed IS NOT NULL
      AND is_seed IN (0, 1)
    )
    OR
    (deleted_at IS NOT NULL
      AND typeof(deleted_at) = 'integer'
      AND deleted_at >= 0
      AND child_id IS NULL
      AND kind IS NULL
      AND occurred_at IS NULL
      AND occurred_tz IS NULL
      AND created_at IS NULL
      AND updated_at IS NULL
      AND is_seed IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS entries_child_occurred_idx
  ON entries(child_id, occurred_at);
CREATE INDEX IF NOT EXISTS entries_child_kind_idx
  ON entries(child_id, kind);
`,
  },
  {
    index: 3,
    name: "0003_entry_timezone_registry_and_associations",
    sql: `
CREATE TABLE IF NOT EXISTS entry_timezones (
  name TEXT PRIMARY KEY
);
INSERT OR IGNORE INTO entry_timezones (name)
  SELECT DISTINCT occurred_tz FROM entries
  WHERE deleted_at IS NULL AND occurred_tz IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS entries_timezone_insert
BEFORE INSERT ON entries
WHEN NEW.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM entry_timezones WHERE name = NEW.occurred_tz
  )
BEGIN
  SELECT RAISE(ABORT, 'Entry timezone must be a registered IANA timezone');
END;
CREATE TRIGGER IF NOT EXISTS entries_timezone_update
BEFORE UPDATE OF occurred_tz, deleted_at ON entries
WHEN NEW.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM entry_timezones WHERE name = NEW.occurred_tz
  )
BEGIN
  SELECT RAISE(ABORT, 'Entry timezone must be a registered IANA timezone');
END;
CREATE TABLE IF NOT EXISTS entry_associations (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  association_type TEXT NOT NULL CHECK (length(trim(association_type)) > 0),
  associated_id TEXT NOT NULL CHECK (length(trim(associated_id)) > 0),
  PRIMARY KEY (entry_id, association_type, associated_id)
);
CREATE TRIGGER IF NOT EXISTS entry_associations_live_insert
BEFORE INSERT ON entry_associations
WHEN NOT EXISTS (
  SELECT 1 FROM entries
  WHERE id = NEW.entry_id AND deleted_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Entry associations require a live Entry');
END;
CREATE TRIGGER IF NOT EXISTS entry_associations_live_update
BEFORE UPDATE OF entry_id ON entry_associations
WHEN NOT EXISTS (
  SELECT 1 FROM entries
  WHERE id = NEW.entry_id AND deleted_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'Entry associations require a live Entry');
END;
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
