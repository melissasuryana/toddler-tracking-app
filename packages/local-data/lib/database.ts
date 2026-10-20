/**
 * Database lifecycle: open (via the injected driver), run startup migrations,
 * and expose the repositories. This is the composition root the app wires to
 * expo-sqlite (`../expo.ts`); tests wire it to `node:sqlite`.
 *
 * Seeding hook: later tickets register seed tasks (foods database, symptom
 * checklist, …) which run once, in order, after migrations.
 */
import type { MigrationDriver } from "./driver.ts";
import { runMigrations, MIGRATIONS, type Migration } from "./migrations.ts";
import { createOrm, type LocalOrm } from "./orm.ts";
import { ChildRepository, PreferenceRepository } from "./repository.ts";

/** A one-time seed task; `key` guards re-runs via the preferences table. */
export interface SeedTask {
  readonly key: string;
  run(db: LocalDatabase): void;
}

export interface OpenDatabaseOptions {
  /** Override the migration list (tests); defaults to the shipped list. */
  readonly migrations?: readonly Migration[];
  /** Seed tasks to run after migrations (stub until the seeding tickets). */
  readonly seeds?: readonly SeedTask[];
}

export class LocalDatabase {
  readonly children: ChildRepository;
  readonly preferences: PreferenceRepository;
  readonly driver: MigrationDriver;
  /** The Drizzle handle — the typed query layer later tickets build on. */
  readonly orm: LocalOrm;

  constructor(driver: MigrationDriver) {
    this.driver = driver;
    this.orm = createOrm(driver);
    this.children = new ChildRepository(this.orm);
    this.preferences = new PreferenceRepository(this.orm);
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
  runMigrations(driver, options.migrations ?? MIGRATIONS);
  const db = new LocalDatabase(driver);
  for (const seed of options.seeds ?? []) {
    const marker = `seed:${seed.key}`;
    if (
      driver
        .prepareSync("SELECT value FROM preferences WHERE key = ?")
        .get(marker)
    ) {
      continue;
    }
    seed.run(db);
    driver
      .prepareSync(
        "INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(marker, "done");
  }
  return db;
}
