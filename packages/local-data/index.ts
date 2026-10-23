/**
 * local-data — the local-first persistence package: expo-sqlite + Drizzle
 * behind a small interface (issue #43). Scope for now: the Child record and
 * key-value preferences, plus the open/migrate/seed lifecycle later tickets
 * extend with the eight Entry kinds and seed data.
 *
 * Entry points:
 *  - `index.ts` (this file): engine-agnostic surface — domain types,
 *    validation, repositories, migrations, and the lifecycle composition.
 *    Importable in plain Node (tests) because it never touches native modules.
 *  - `expo.ts`: the expo-sqlite adapter (`openAppDatabase`) — app-only.
 */
export {
  LocalDatabase,
  openDatabase,
  type OpenDatabaseOptions,
  type SeedTask,
} from "./lib/database.ts";
export type { MigrationDriver, SqliteStatement } from "./lib/driver.ts";
export {
  MIGRATIONS,
  assertOrdered,
  currentVersion,
  pendingMigrations,
  runMigrations,
  type Migration,
} from "./lib/migrations.ts";
export {
  ChildRepository,
  ChildValidationError,
  PreferenceRepository,
  type Child,
} from "./lib/repository.ts";
export {
  EntryRepository,
  EntryValidationError,
  MetadataRepository,
  SeedRepository,
  type EntryAssociation,
  type SeedRow,
  type SeedValue,
} from "./lib/foundation.ts";
export type { LocalTransaction } from "./lib/database.ts";
export {
  ENTRY_KINDS,
  isIanaTimezone,
  isSlugId,
  isUuidV7,
  validateEntryInput,
  type Entry,
  type EntryFieldError,
  type EntryInput,
  type EntryKind,
  type ValidEntryInput,
} from "./lib/entry.ts";
export {
  CHILD_SEXES,
  isIsoDate,
  todayIsoDate,
  uuidv7,
  validateChildInput,
  type ChildFieldError,
  type ChildInput,
  type ChildSex,
  type ValidChild,
} from "./lib/child.ts";
export {
  DEFAULT_TEMPERATURE_UNIT,
  TEMPERATURE_UNITS,
  formatTemperatureUnit,
  parsePreference,
  parseTemperatureUnit,
  type PreferenceKey,
  type PreferenceTypes,
  type TemperatureUnit,
} from "./lib/preferences.ts";
export {
  children,
  entries,
  entryAssociations,
  entryTimezones,
  metadata,
  preferences,
} from "./lib/schema.ts";
export { createOrm, type LocalOrm } from "./lib/orm.ts";
