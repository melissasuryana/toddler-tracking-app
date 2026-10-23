/**
 * Database lifecycle: open (via the injected driver), run startup migrations,
 * and expose the repositories. This is the composition root the app wires to
 * expo-sqlite (`../expo.ts`); tests wire it to `node:sqlite`.
 *
 * Seed tasks run once, in order, after migrations and commit with their marker.
 */
import type { MigrationDriver } from "./driver.ts";
import { isIanaTimezone } from "./entry.ts";
import {
  EntryRepository,
  MetadataRepository,
  SeedRepository,
} from "./foundation.ts";
import {
  currentVersion,
  runMigrations,
  MIGRATIONS,
  type Migration,
} from "./migrations.ts";
import { createOrm, type LocalOrm } from "./orm.ts";
import { ChildRepository, PreferenceRepository } from "./repository.ts";

export interface LocalTransaction {
  readonly children: ChildRepository;
  readonly preferences: PreferenceRepository;
  readonly entries: EntryRepository;
  readonly metadata: MetadataRepository;
  readonly seeds: SeedRepository;
}

/** A one-time seed task; `key` guards re-runs via local metadata. */
export interface SeedTask {
  readonly key: string;
  run(db: LocalTransaction): void;
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
  transaction<T>(operation: (db: LocalTransaction) => T): T {
    assertSynchronousFunction(operation);
    let active = true;
    const transaction = transactionScope(this, () => active);
    if (this.transactionDepth === 0) {
      let result!: T;
      try {
        this.driver.withTransactionSync(() => {
          this.transactionDepth = 1;
          try {
            result = assertSynchronous(operation(transaction));
          } finally {
            this.transactionDepth = 0;
          }
        });
        return result;
      } finally {
        active = false;
      }
    }

    const savepoint = `local_data_${++this.savepointSequence}`;
    this.driver.execSync(`SAVEPOINT ${savepoint}`);
    this.transactionDepth += 1;
    try {
      const result = assertSynchronous(operation(transaction));
      this.driver.execSync(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      this.driver.execSync(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      this.driver.execSync(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    } finally {
      this.transactionDepth -= 1;
      active = false;
    }
  }

  close(): void {
    this.driver.closeSync();
  }
}

/**
 * Opens the database: runs pending migrations, then any unrun seed tasks.
 * Seed completion is recorded under the `seed:<key>` metadata key so seeds are
 * idempotent across restarts.
 */
export function openDatabase(
  driver: MigrationDriver,
  options: OpenDatabaseOptions = {}
): LocalDatabase {
  driver.execSync("PRAGMA foreign_keys = ON");
  const version = currentVersion(driver);
  if (version >= 2 && version < 3) {
    const invalid = driver
      .prepareSync("SELECT occurred_tz FROM entries WHERE deleted_at IS NULL")
      .all<{ occurred_tz: string }>()
      .find((row) => !isIanaTimezone(row.occurred_tz));
    if (invalid) {
      throw new Error(
        `Cannot migrate invalid Entry timezone: ${invalid.occurred_tz}`
      );
    }
  }
  runMigrations(driver, options.migrations ?? MIGRATIONS);
  if (currentVersion(driver) >= 3) registerIanaTimezones(driver);
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
    assertSynchronousFunction(seed.run);
    db.transaction((transaction) => {
      if (db.metadata.get(marker) !== null) return;
      const result = seed.run(transaction) as unknown;
      assertSynchronous(result);
      db.metadata.set(marker, "done");
    });
  }
  return db;
}

function registerIanaTimezones(driver: MigrationDriver): void {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const names = new Set(["UTC", "Etc/UTC", "GMT", ...supported]);
  driver.withTransactionSync(() => {
    const insert = driver.prepareSync(
      "INSERT INTO entry_timezones (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
    );
    for (const name of names) insert.run(name);
  });
}

function assertSynchronousFunction(
  operation: (...args: never[]) => unknown
): void {
  const source = Function.prototype.toString.call(operation);
  if (
    Object.prototype.toString.call(operation) === "[object AsyncFunction]" ||
    source.startsWith("async ") ||
    source.startsWith("async(") ||
    source.includes("[native code]")
  ) {
    throw new TypeError("Local database callbacks must be synchronous.");
  }
}

function transactionScope(
  db: LocalDatabase,
  isActive: () => boolean
): LocalTransaction {
  const scopedRepository = <T extends object>(repository: T): T =>
    new Proxy(repository, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver) as unknown;
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          if (!isActive()) {
            throw new Error("The database transaction is no longer active.");
          }
          return Reflect.apply(value, target, args);
        };
      },
    });
  return {
    children: scopedRepository(db.children),
    preferences: scopedRepository(db.preferences),
    entries: scopedRepository(db.entries),
    metadata: scopedRepository(db.metadata),
    seeds: scopedRepository(db.seeds),
  };
}

function assertSynchronous<T>(value: T): T {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value
  ) {
    if (typeof value === "object" && value !== null) {
      void Promise.resolve(value).catch(() => undefined);
    }
    throw new TypeError("Local database transactions must be synchronous.");
  }
  return value;
}
