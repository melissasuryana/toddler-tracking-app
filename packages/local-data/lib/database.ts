/**
 * Database lifecycle: open (via the injected driver), run startup migrations,
 * and expose the repositories. This is the composition root the app wires to
 * expo-sqlite (`../expo.ts`); tests wire it to `node:sqlite`.
 *
 * Seed tasks run once, in order, after migrations and commit with their marker.
 */
import type { MigrationDriver } from "./driver.ts";
import {
  EntryRepository,
  MetadataRepository,
  SeedRepository,
} from "./foundation.ts";
import { runMigrations, MIGRATIONS, type Migration } from "./migrations.ts";
import { createOrm, type LocalOrm } from "./orm.ts";
import { ChildRepository, PreferenceRepository } from "./repository.ts";

/** A one-time seed task; `key` guards re-runs via local metadata. */
export interface SeedTask {
  readonly key: string;
  run(db: LocalDatabase): void;
}

export interface OpenDatabaseOptions {
  /** Override the migration list (tests); defaults to the shipped list. */
  readonly migrations?: readonly Migration[];
  /** Idempotent seed tasks to run after migrations. */
  readonly seeds?: readonly SeedTask[];
}

export class LocalDatabase {
  readonly children: ChildRepository;
  readonly preferences: PreferenceRepository;
  readonly entries: EntryRepository;
  readonly metadata: MetadataRepository;
  readonly seeds: SeedRepository;
  readonly driver: MigrationDriver;
  /** The Drizzle handle — the typed query layer later tickets build on. */
  readonly orm: LocalOrm;
  private transactionDepth = 0;
  private savepointSequence = 0;

  constructor(driver: MigrationDriver) {
    this.driver = driver;
    this.orm = createOrm(driver);
    this.children = new ChildRepository(this.orm);
    this.preferences = new PreferenceRepository(this.orm);
    this.entries = new EntryRepository(this.orm, driver, (operation) =>
      this.transaction(() => operation())
    );
    this.metadata = new MetadataRepository(this.orm);
    this.seeds = new SeedRepository(driver);
  }

  /**
   * Runs synchronous writes atomically. Nested calls use savepoints so domain
   * mutations such as scrubbing can compose with a larger transaction.
   */
  transaction<T>(operation: (db: LocalDatabase) => T): T {
    if (this.transactionDepth === 0) {
      let result!: T;
      this.driver.withTransactionSync(() => {
        this.transactionDepth = 1;
        try {
          result = assertSynchronous(operation(this));
        } finally {
          this.transactionDepth = 0;
        }
      });
      return result;
    }

    const savepoint = `local_data_${++this.savepointSequence}`;
    this.driver.execSync(`SAVEPOINT ${savepoint}`);
    this.transactionDepth += 1;
    try {
      const result = assertSynchronous(operation(this));
      this.driver.execSync(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      this.driver.execSync(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      this.driver.execSync(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  close(): void {
    this.driver.closeSync();
  }
}

/**
 * Opens the database: runs pending migrations, then any unrun seed tasks.
 * Seed completion is recorded under the `seed:<key>` preference so seeds are
 * idempotent across restarts.
 */
export function openDatabase(
  driver: MigrationDriver,
  options: OpenDatabaseOptions = {}
): LocalDatabase {
  driver.execSync("PRAGMA foreign_keys = ON");
  runMigrations(driver, options.migrations ?? MIGRATIONS);
  const db = new LocalDatabase(driver);
  const seedKeys = new Set<string>();
  const seeds = options.seeds ?? [];
  for (const seed of seeds) {
    if (seed.key.trim().length === 0 || seedKeys.has(seed.key)) {
      throw new Error("Seed task keys must be non-empty and unique.");
    }
    seedKeys.add(seed.key);
  }
  for (const seed of seeds) {
    const marker = `seed:${seed.key}`;
    if (db.metadata.get(marker) !== null) continue;
    db.transaction(() => {
      if (db.metadata.get(marker) !== null) return;
      const result = seed.run(db) as unknown;
      assertSynchronous(result);
      db.metadata.set(marker, "done");
    });
  }
  return db;
}

function assertSynchronous<T>(value: T): T {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value
  ) {
    throw new TypeError("Local database transactions must be synchronous.");
  }
  return value;
}
