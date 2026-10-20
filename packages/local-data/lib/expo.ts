/**
 * The expo-sqlite wiring for `LocalDatabase` — the only file in this package
 * that imports a native module. The engine-agnostic surface (`index.ts`)
 * stays importable in plain Node for tests.
 */
import { openDatabaseSync } from "expo-sqlite";
import {
  openDatabase,
  type LocalDatabase,
  type OpenDatabaseOptions,
} from "./database.ts";
import type { MigrationDriver } from "./driver.ts";

export const DATABASE_NAME = "keepsake.db";

/**
 * Opens (creating on first launch) the app database, applies pending
 * migrations and unrun seeds, and returns the repositories. Call once at
 * startup, before any repository use.
 */
export function openAppDatabase(
  options: OpenDatabaseOptions = {}
): LocalDatabase {
  const driver = openDatabaseSync(DATABASE_NAME) as unknown as MigrationDriver;
  return openDatabase(driver, options);
}
