/**
 * The Drizzle wiring (lib/orm.ts): typed select/insert/upsert over the
 * injected driver boundary, proven here against node:sqlite so the same
 * session implementation serves expo-sqlite in the app unchanged. Imported
 * through the entry point like any consumer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { openDatabase, preferences } from "../index.ts";
import { openTestDriver } from "./helpers.ts";

test("Drizzle typed queries run over the injected driver", () => {
  const db = openDatabase(openTestDriver());

  db.preferences.set("temperatureUnit", "F");
  const rows = db.orm.select().from(preferences).all();
  assert.deepEqual(rows, [{ key: "temperatureUnit", value: "F" }]);

  db.preferences.set("temperatureUnit", "C");
  const row = db.orm
    .select()
    .from(preferences)
    .where(eq(preferences.key, "temperatureUnit"))
    .get();
  assert.deepEqual(row, { key: "temperatureUnit", value: "C" });

  db.driver.closeSync();
});
