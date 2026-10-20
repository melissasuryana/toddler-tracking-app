/**
 * Migration runner behaviour (issue #43): ordered application from the
 * `user_version` cursor, gap/ordering enforcement, idempotent re-runs, and
 * rollback of a failing migration.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIGRATIONS,
  assertOrdered,
  currentVersion,
  pendingMigrations,
  runMigrations,
  type Migration,
} from "../index.ts";
import { openTestDriver } from "./helpers.ts";

test("the shipped migration list is ordered 1..n with no gaps", () => {
  assert.doesNotThrow(() => assertOrdered(MIGRATIONS));
});

test("assertOrdered rejects gaps and reordering", () => {
  const gap: Migration[] = [
    { index: 1, name: "a", sql: "" },
    { index: 3, name: "b", sql: "" },
  ];
  assert.throws(() => assertOrdered(gap), /no gaps/);
  const reordered: Migration[] = [
    { index: 2, name: "b", sql: "" },
    { index: 1, name: "a", sql: "" },
  ];
  assert.throws(() => assertOrdered(reordered), /no gaps/);
});

test("pendingMigrations returns only the suffix after the applied version", () => {
  const list: Migration[] = [
    { index: 1, name: "a", sql: "" },
    { index: 2, name: "b", sql: "" },
    { index: 3, name: "c", sql: "" },
  ];
  assert.deepEqual(
    pendingMigrations(list, 0).map((migration) => migration.name),
    ["a", "b", "c"]
  );
  assert.deepEqual(
    pendingMigrations(list, 2).map((migration) => migration.name),
    ["c"]
  );
  assert.deepEqual(pendingMigrations(list, 3), []);
});

test("runMigrations applies the schema and advances user_version", () => {
  const driver = openTestDriver();
  const result = runMigrations(driver);
  assert.equal(result.fromVersion, 0);
  assert.equal(result.toVersion, MIGRATIONS.length);
  assert.deepEqual(
    result.applied,
    MIGRATIONS.map((migration) => migration.name)
  );
  assert.equal(currentVersion(driver), MIGRATIONS.length);
  const tables = driver
    .prepareSync(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    )
    .all<{ name: string }>()
    .map((row) => row.name);
  assert.ok(tables.includes("children"));
  assert.ok(tables.includes("preferences"));
  driver.closeSync();
});

test("runMigrations is idempotent on a current database", () => {
  const driver = openTestDriver();
  runMigrations(driver);
  const second = runMigrations(driver);
  assert.deepEqual(second.applied, []);
  assert.equal(second.fromVersion, MIGRATIONS.length);
  assert.equal(second.toVersion, MIGRATIONS.length);
  driver.closeSync();
});

test("a failing migration rolls back and leaves the cursor untouched", () => {
  const driver = openTestDriver();
  const broken: Migration[] = [
    { index: 1, name: "ok", sql: "CREATE TABLE t (id TEXT);" },
    { index: 2, name: "broken", sql: "THIS IS NOT SQL;" },
  ];
  assert.throws(() => runMigrations(driver, broken));
  assert.equal(currentVersion(driver), 1, "first migration stays applied");
  const tables = driver
    .prepareSync("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all<{ name: string }>();
  assert.deepEqual(
    tables.map((row) => row.name),
    ["t"]
  );
  driver.closeSync();
});
