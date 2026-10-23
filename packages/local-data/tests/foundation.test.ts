import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EntryValidationError,
  isIanaTimezone,
  isSlugId,
  isUuidV7,
  MIGRATIONS,
  openDatabase,
  type EntryInput,
  type LocalTransaction,
  type SeedTask,
} from "../index.ts";
import { openTestDriver } from "./helpers.ts";

function childInput() {
  return {
    name: "Ada",
    birthdate: "2024-03-01",
    sex: "female" as const,
  };
}

function entryInput(childId: string): EntryInput {
  return {
    childId,
    kind: "feed",
    occurredAt: Date.now() - 1_000,
    occurredTz: "America/Los_Angeles",
  };
}

test("Entry schema and repository enforce sync-ready metadata", () => {
  const driver = openTestDriver();
  const db = openDatabase(driver);
  const child = db.children.create(childInput());
  const entry = db.entries.create(entryInput(child.id));

  assert.equal(isUuidV7(entry.id), true);
  assert.equal(entry.childId, child.id);
  assert.equal(entry.occurredTz, "America/Los_Angeles");
  assert.equal(entry.createdAt, entry.updatedAt);
  assert.equal(entry.isSeed, false);
  assert.equal(db.entries.get(entry.id)?.id, entry.id);
  assert.deepEqual(
    db.entries.listForChild(child.id).map((item) => item.id),
    [entry.id]
  );
  const seeded = db.entries.create({
    ...entryInput(child.id),
    id: "imported-seed",
    isSeed: true,
  });
  assert.equal(seeded.id, "imported-seed");
  assert.equal(seeded.isSeed, true);
  assert.equal(isIanaTimezone("Mars/Olympus"), false);
  assert.equal(isSlugId("food-123"), true);
  assert.equal(isSlugId("food--123"), false);

  assert.throws(
    () =>
      db.entries.create({
        ...entryInput(child.id),
        occurredTz: "Not/A_Timezone",
      }),
    (error: unknown) => error instanceof EntryValidationError
  );
  assert.throws(() =>
    driver
      .prepareSync(
        `INSERT INTO entries
          (id, child_id, kind, occurred_at, occurred_tz, created_at, updated_at, is_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .run(
        "not-a-uuid",
        child.id,
        "feed",
        Date.now(),
        "UTC",
        Date.now(),
        Date.now()
      )
  );
  assert.throws(
    () =>
      driver
        .prepareSync(
          `INSERT INTO entries
          (id, child_id, kind, occurred_at, occurred_tz, created_at, updated_at, is_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
        )
        .run(
          "018f0000-0000-7000-8000-000000000001",
          child.id,
          "feed",
          Date.now(),
          "Invalid/Timezone",
          Date.now(),
          Date.now()
        ),
    /registered IANA timezone/
  );
  assert.throws(() =>
    driver
      .prepareSync(
        `INSERT INTO entries
          (id, child_id, kind, occurred_at, occurred_tz, created_at, updated_at, is_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(
        "018f0000-0000-7000-8000-000000000002",
        child.id,
        "feed",
        Date.now(),
        "UTC",
        Date.now(),
        Date.now()
      )
  );
  driver.closeSync();
});

test("scrub cascades package-owned associations and leaves only the tombstone", () => {
  const driver = openTestDriver();
  const db = openDatabase(driver);
  const child = db.children.create(childInput());
  const entry = db.entries.create(entryInput(child.id));
  const content = { side: "left", durationSeconds: 120 };
  db.entries.setContent(entry.id, content);
  db.entries.addAssociation(entry.id, "food", "pear");
  assert.deepEqual(db.entries.contentFor(entry.id), content);
  assert.deepEqual(db.entries.associationsFor(entry.id), [
    { associationType: "food", associatedId: "pear" },
  ]);

  assert.equal(db.entries.scrub(entry.id, 1_800_000_000_000), true);
  assert.equal(db.entries.get(entry.id), null);
  assert.equal(db.entries.contentFor(entry.id), null);
  assert.deepEqual(db.entries.associationsFor(entry.id), []);
  assert.deepEqual(
    driver.prepareSync("SELECT * FROM entries WHERE id = ?").get(entry.id),
    {
      id: entry.id,
      child_id: null,
      kind: null,
      occurred_at: null,
      occurred_tz: null,
      created_at: null,
      updated_at: null,
      deleted_at: 1_800_000_000_000,
      is_seed: null,
    }
  );
  assert.equal(db.entries.scrub(entry.id, 1_800_000_000_001), false);
  assert.throws(
    () => db.entries.addAssociation(entry.id, "food", "apple"),
    /live Entry/
  );
  driver.closeSync();
});

test("transaction rolls back multiple writes, including a nested scrub", () => {
  const driver = openTestDriver();
  const db = openDatabase(driver);
  const child = db.children.create(childInput());
  const existing = db.entries.create(entryInput(child.id));
  db.entries.setContent(existing.id, { note: "preserved until commit" });
  db.entries.addAssociation(existing.id, "food", "pear");
  let rolledBackId = "";

  assert.throws(() =>
    db.transaction((tx) => {
      rolledBackId = tx.entries.create(entryInput(child.id)).id;
      assert.equal(tx.entries.scrub(existing.id, 1_800_000_000_000), true);
      throw new Error("forced failure");
    })
  );
  assert.equal(db.entries.get(rolledBackId), null);
  assert.equal(db.entries.get(existing.id)?.id, existing.id);
  assert.deepEqual(db.entries.contentFor(existing.id), {
    note: "preserved until commit",
  });
  assert.deepEqual(db.entries.associationsFor(existing.id), [
    { associationType: "food", associatedId: "pear" },
  ]);
  assert.equal(
    driver
      .prepareSync("SELECT COUNT(*) AS count FROM entries WHERE id = ?")
      .get<{ count: number }>(rolledBackId)?.count,
    0
  );
  driver.closeSync();
});

test("transaction rejects async callbacks before they can write", () => {
  const driver = openTestDriver();
  const db = openDatabase(driver);
  let called = false;
  const asyncOperation = async (_tx: LocalTransaction) => {
    called = true;
  };

  assert.throws(
    () => db.transaction(asyncOperation),
    /callbacks must be synchronous/
  );
  assert.equal(called, false);
  driver.closeSync();
});

test("transaction scopes reject writes after a thenable callback is rolled back", async () => {
  const driver = openTestDriver();
  const db = openDatabase(driver);

  assert.throws(
    () =>
      db.transaction((tx) => {
        tx.metadata.set("before", "rolled back");
        return Promise.resolve().then(() =>
          tx.metadata.set("after", "must not escape")
        );
      }),
    /transactions must be synchronous/
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(db.metadata.get("before"), null);
  assert.equal(db.metadata.get("after"), null);
  driver.closeSync();
});

test("seed rows are insert-if-missing and seed markers commit atomically", () => {
  const driver = openTestDriver();
  driver.execSync(
    "CREATE TABLE catalog (id TEXT PRIMARY KEY, name TEXT NOT NULL, is_seed INTEGER NOT NULL)"
  );
  driver
    .prepareSync("INSERT INTO catalog (id, name, is_seed) VALUES (?, ?, ?)")
    .run("oatmeal", "Caregiver's name", 0);

  let runs = 0;
  const seed: SeedTask = {
    key: "catalog",
    run(db) {
      runs += 1;
      db.seeds.insertIfMissing("catalog", [
        { id: "oatmeal", name: "Seed name", is_seed: true },
        { id: "pear", name: "Pear", is_seed: true },
      ]);
    },
  };
  let db = openDatabase(driver, { seeds: [seed] });
  db = openDatabase(driver, { seeds: [seed] });
  assert.equal(runs, 1);
  assert.equal(
    driver
      .prepareSync("SELECT name FROM catalog WHERE id = ?")
      .get<{ name: string }>("oatmeal")?.name,
    "Caregiver's name"
  );
  assert.equal(
    driver
      .prepareSync("SELECT COUNT(*) AS count FROM catalog")
      .get<{ count: number }>()?.count,
    2
  );
  assert.equal(db.metadata.get("seed:catalog"), "done");

  const failingSeed: SeedTask = {
    key: "failure",
    run(database) {
      database.seeds.insertIfMissing("catalog", [
        { id: "plum", name: "Plum", is_seed: true },
      ]);
      database.metadata.set("partial", "value");
      throw new Error("seed failed");
    },
  };
  assert.throws(
    () => openDatabase(driver, { seeds: [failingSeed] }),
    /seed failed/
  );
  assert.equal(db.metadata.get("seed:failure"), null);
  assert.equal(db.metadata.get("partial"), null);
  assert.equal(
    driver
      .prepareSync("SELECT COUNT(*) AS count FROM catalog WHERE id = ?")
      .get<{ count: number }>("plum")?.count,
    0
  );
  driver.closeSync();
});

test("legacy seed preference markers migrate to metadata", () => {
  const driver = openTestDriver();
  openDatabase(driver, { migrations: [MIGRATIONS[0]!] });
  driver
    .prepareSync("INSERT INTO preferences (key, value) VALUES (?, ?)")
    .run("seed:legacy", "done");

  const db = openDatabase(driver);
  assert.equal(db.metadata.get("seed:legacy"), "done");
  assert.equal(
    driver
      .prepareSync("SELECT COUNT(*) AS count FROM preferences WHERE key = ?")
      .get<{ count: number }>("seed:legacy")?.count,
    0
  );
  driver.closeSync();
});

test("migration refuses to register invalid legacy Entry timezones", () => {
  const driver = openTestDriver();
  const versionTwo = MIGRATIONS.slice(0, 2);
  const db = openDatabase(driver, { migrations: versionTwo });
  const child = db.children.create(childInput());
  driver
    .prepareSync(
      `INSERT INTO entries
        (id, child_id, kind, occurred_at, occurred_tz, created_at, updated_at, is_seed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(
      "018f0000-0000-7000-8000-000000000003",
      child.id,
      "feed",
      Date.now(),
      "Invalid/Timezone",
      Date.now(),
      Date.now()
    );

  assert.throws(
    () => openDatabase(driver),
    /Cannot migrate invalid Entry timezone/
  );
  driver.closeSync();
});
