/**
 * Lifecycle + repository integration against a real SQLite engine
 * (`node:sqlite` behind the driver boundary): Child + preferences survive a
 * close/reopen, the Child gate flips on creation, invalid input cannot be
 * persisted, and seed tasks run once.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ChildValidationError,
  openDatabase,
  type MigrationDriver,
  type SeedTask,
} from "../index.ts";
import { openTestDriver } from "./helpers.ts";

/** Opens the lifecycle against the test driver. */
function open(driver: MigrationDriver, seeds?: readonly SeedTask[]) {
  return openDatabase(driver, { seeds });
}

/** Simulates an app restart: reopen the same driver through the lifecycle. */
function reopen(driver: MigrationDriver) {
  return open(driver);
}

test("fresh database has no Child; creating one flips the gate and survives reopen", () => {
  const driver = openTestDriver();
  let db = open(driver);
  assert.equal(db.children.exists(), false);
  assert.equal(db.children.first(), null);

  const created = db.children.create({
    name: "Ada",
    birthdate: "2024-03-01",
    sex: "female",
  });
  assert.match(created.id, /^[0-9a-f-]{36}$/);
  assert.equal(db.children.exists(), true);

  db = reopen(driver);
  const persisted = db.children.first();
  assert.ok(persisted);
  assert.equal(persisted.id, created.id);
  assert.equal(persisted.name, "Ada");
  assert.equal(persisted.birthdate, "2024-03-01");
  assert.equal(persisted.sex, "female");
  assert.equal(persisted.photo, null);
  driver.closeSync();
});

test("repository refuses to persist an invalid Child", () => {
  const driver = openTestDriver();
  const db = open(driver);
  assert.throws(
    () =>
      db.children.create({ name: "", birthdate: "2999-01-01", sex: "female" }),
    (error: unknown) => {
      assert.ok(error instanceof ChildValidationError);
      assert.deepEqual(error.errors.map((entry) => entry.field).sort(), [
        "birthdate",
        "name",
      ]);
      return true;
    }
  );
  assert.equal(db.children.exists(), false);
  driver.closeSync();
});

test("preferences round-trip and survive reopen; unset keys read as null", () => {
  const driver = openTestDriver();
  let db = open(driver);
  assert.equal(db.preferences.get("temperatureUnit"), null);

  db.preferences.set("temperatureUnit", "F");
  assert.equal(db.preferences.get("temperatureUnit"), "F");

  db = reopen(driver);
  assert.equal(db.preferences.get("temperatureUnit"), "F");

  db.preferences.set("temperatureUnit", "C");
  assert.equal(db.preferences.get("temperatureUnit"), "C");
  driver.closeSync();
});

test("malformed stored preference values read as null", () => {
  const driver = openTestDriver();
  const db = open(driver);
  driver
    .prepareSync("INSERT INTO preferences (key, value) VALUES (?, ?)")
    .run("temperatureUnit", "kelvin");
  assert.equal(db.preferences.get("temperatureUnit"), null);
  driver.closeSync();
});

test("seed tasks run once, in order, after migrations", () => {
  const driver = openTestDriver();
  const calls: string[] = [];
  const seeds: SeedTask[] = [
    { key: "first", run: () => void calls.push("first") },
    { key: "second", run: () => void calls.push("second") },
  ];
  open(driver, seeds);
  open(driver, seeds);
  assert.deepEqual(calls, ["first", "second"]);
  driver.closeSync();
});
