import assert from "node:assert/strict";
import { test } from "node:test";
import { FoodTracking, SEEDED_FOODS } from "../index.ts";
import {
  openDatabase,
  type EntryKind,
  type LocalDatabase,
} from "@keepsake/local-data";
import { openTestDriver } from "./helpers.ts";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

function setup() {
  const database = openDatabase(openTestDriver());
  const child = database.children.create({
    name: "Ada",
    birthdate: "2024-03-01",
    sex: "female",
  });
  return { database, child, foods: new FoodTracking(database) };
}

function addFoodEntry(
  database: LocalDatabase,
  childId: string,
  kind: Extract<EntryKind, "introduction" | "reaction" | "meal">,
  foodIds: readonly string[],
  occurredAt: number,
  createdAt?: number
): string {
  const entry = database.entries.create({
    childId,
    kind,
    occurredAt,
    occurredTz: "UTC",
  });
  if (createdAt !== undefined) {
    database.driver
      .prepareSync("UPDATE entries SET created_at = ? WHERE id = ?")
      .run(createdAt, entry.id);
  }
  for (const foodId of foodIds) {
    database.entries.addAssociation(entry.id, "food", foodId);
  }
  return entry.id;
}

test("the authored catalogue is stable, validated, and read-only", () => {
  const { database, foods } = setup();
  assert.ok(SEEDED_FOODS.length >= 300);
  assert.equal(
    new Set(SEEDED_FOODS.map((food) => food.id)).size,
    SEEDED_FOODS.length
  );
  assert.equal(foods.getFood("banana")?.name, "Banana");
  assert.equal(foods.getFood("banana")?.source, "seed");
  assert.deepEqual(foods.getFood("sesame-oil")?.allergenTags, ["sesame"]);
  assert.throws(
    () =>
      foods.updateCustomFood("banana", {
        name: "Banana",
        category: "fruit",
      }),
    /custom Food/
  );
  database.close();
});

test("custom Foods persist, accept missing imported categories, and delete only while untried", () => {
  const { database, child, foods } = setup();
  const custom = foods.createCustomFood({
    name: "  Ada's puree  ",
    allergenTags: ["milk"],
  });
  assert.equal(custom.name, "Ada's puree");
  assert.equal(custom.category, null);
  assert.equal(custom.source, "custom");
  assert.deepEqual(foods.getFood(custom.id)?.allergenTags, ["milk"]);
  assert.equal(foods.deleteCustomFood(custom.id), true);

  const introduced = foods.createCustomFood({
    name: "Trial Food",
    category: "fruit",
  });
  addFoodEntry(database, child.id, "introduction", [introduced.id], T0);
  assert.equal(foods.deleteCustomFood(introduced.id), false);
  const edited = foods.updateCustomFood(introduced.id, {
    name: "Updated Trial Food",
    category: "compound",
    allergenTags: ["sesame"],
  });
  assert.equal(edited.name, "Updated Trial Food");
  assert.deepEqual(edited.allergenTags, ["sesame"]);
  assert.throws(
    () =>
      foods.createCustomFood({
        name: "invalid",
        allergenTags: ["unknown" as never],
      }),
    /Allergen Tag/
  );
  database.close();
});

test("status replay preserves the anchor, expires before same-time entries, and orders Reaction last", () => {
  const { database, child, foods } = setup();
  const apple = "apple";
  const first = addFoodEntry(database, child.id, "introduction", [apple], T0);
  addFoodEntry(database, child.id, "introduction", [apple], T0 + DAY);

  const duringWatch = foods.statusFor(child.id, apple, T0 + DAY);
  assert.equal(duringWatch.status, "trying");
  assert.equal(duringWatch.exposureCount, 2);
  assert.equal(duringWatch.watchPeriod?.openingIntroductionId, first);
  assert.equal(duringWatch.watchPeriod?.endsAt, T0 + 3 * DAY);
  assert.equal(foods.statusFor(child.id, apple, T0 + 3 * DAY).status, "safe");

  addFoodEntry(database, child.id, "introduction", [apple], T0 + 3 * DAY);
  assert.equal(foods.statusFor(child.id, apple, T0 + 3 * DAY).status, "safe");

  const reactionId = addFoodEntry(
    database,
    child.id,
    "reaction",
    [apple, "pear"],
    T0 + 4 * DAY,
    1
  );
  addFoodEntry(database, child.id, "introduction", [apple], T0 + 4 * DAY, 2);
  assert.equal(foods.statusFor(child.id, apple, T0 + 4 * DAY).status, "avoid");
  assert.equal(foods.statusFor(child.id, "pear", T0 + 4 * DAY).status, "avoid");

  const rechallenge = addFoodEntry(
    database,
    child.id,
    "introduction",
    [apple],
    T0 + 4 * DAY + 1
  );
  assert.equal(
    foods.statusFor(child.id, apple, T0 + 4 * DAY + 1).status,
    "trying"
  );
  assert.equal(
    foods.statusFor(child.id, apple, T0 + 4 * DAY + 1).watchPeriod
      ?.openingIntroductionId,
    rechallenge
  );
  assert.equal(database.entries.get(reactionId)?.kind, "reaction");
  database.close();
});

test("same-kind introductions use created time and ID as stable tie-breakers", () => {
  const { database, child, foods } = setup();
  const first = addFoodEntry(
    database,
    child.id,
    "introduction",
    ["apple"],
    T0,
    100
  );
  const second = addFoodEntry(
    database,
    child.id,
    "introduction",
    ["apple"],
    T0,
    100
  );
  const expected = [first, second].sort()[0];
  const result = foods.statusFor(child.id, "apple", T0);
  assert.equal(result.watchPeriod?.openingIntroductionId, expected);
  assert.equal(
    foods.statusFor(child.id, "apple", T0).watchPeriod?.openingIntroductionId,
    expected
  );
  database.close();
});

test("manual-safe is cycle-bound, survives clock passage and irrelevant edits, and cannot resurrect", () => {
  const { database, child, foods } = setup();
  const custom = foods.createCustomFood({ name: "Watch item" });
  const opening = addFoodEntry(
    database,
    child.id,
    "introduction",
    [custom.id],
    T0
  );
  const manuallySafe = foods.markSafe(child.id, custom.id, T0 + 1);
  assert.equal(manuallySafe?.status, "safe");
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 2 * DAY).safeReason,
    "manual"
  );

  const contentEntry = database.entries.listForChild(child.id)[0]!;
  database.entries.setContent(contentEntry.id, { note: "changed only note" });
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 2 * DAY).safeReason,
    "manual"
  );
  foods.updateCustomFood(custom.id, { name: "Renamed", allergenTags: ["egg"] });
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 2 * DAY).safeReason,
    "manual"
  );

  const backdated = addFoodEntry(
    database,
    child.id,
    "introduction",
    [custom.id],
    T0 - 1
  );
  assert.equal(database.foods.manualSafeMarker(child.id, custom.id), null);
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 2 * DAY).status,
    "trying"
  );
  assert.equal(database.entries.scrub(backdated), true);
  assert.equal(database.foods.manualSafeMarker(child.id, custom.id), null);
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 2 * DAY).status,
    "trying"
  );

  const editedTimeEntry = addFoodEntry(
    database,
    child.id,
    "introduction",
    [custom.id],
    T0 + DAY
  );
  assert.equal(
    foods.markSafe(child.id, custom.id, T0 + DAY + 1)?.status,
    "safe"
  );
  database.driver
    .prepareSync("UPDATE entries SET occurred_at = ? WHERE id = ?")
    .run(T0 + 2 * DAY, editedTimeEntry);
  assert.equal(database.foods.manualSafeMarker(child.id, custom.id), null);
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 2 * DAY).status,
    "trying"
  );
  assert.equal(
    foods.markSafe(child.id, custom.id, T0 + 2 * DAY + 1)?.safeReason,
    "manual"
  );
  addFoodEntry(database, child.id, "reaction", [custom.id], T0 + 3 * DAY);
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 3 * DAY).status,
    "avoid"
  );
  assert.equal(database.foods.manualSafeMarker(child.id, custom.id), null);
  addFoodEntry(
    database,
    child.id,
    "introduction",
    [custom.id],
    T0 + 3 * DAY + 1
  );
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 3 * DAY + 1).status,
    "trying"
  );
  assert.equal(database.foods.manualSafeMarker(child.id, custom.id), null);
  assert.ok(database.entries.get(opening));
  database.close();
});

test("changing an Introduction's Food invalidates old and new Food markers", () => {
  const { database, child, foods } = setup();
  const oldFood = foods.createCustomFood({ name: "Old Food" });
  const newFood = foods.createCustomFood({ name: "New Food" });
  const oldIntroduction = addFoodEntry(
    database,
    child.id,
    "introduction",
    [oldFood.id],
    T0
  );
  addFoodEntry(database, child.id, "introduction", [newFood.id], T0 + 1);

  assert.equal(
    foods.markSafe(child.id, oldFood.id, T0 + 2)?.safeReason,
    "manual"
  );
  assert.equal(
    foods.markSafe(child.id, newFood.id, T0 + 2)?.safeReason,
    "manual"
  );
  database.driver
    .prepareSync(
      `UPDATE entry_associations SET associated_id = ?
       WHERE entry_id = ? AND associated_id = ?`
    )
    .run(newFood.id, oldIntroduction, oldFood.id);

  assert.equal(database.foods.manualSafeMarker(child.id, oldFood.id), null);
  assert.equal(database.foods.manualSafeMarker(child.id, newFood.id), null);
  assert.equal(foods.statusFor(child.id, oldFood.id, T0 + 2).status, "untried");
  assert.equal(foods.statusFor(child.id, newFood.id, T0 + 2).status, "trying");
  database.close();
});

test("deleting the only Introduction returns to untried, but a Reaction remains avoid", () => {
  const { database, child, foods } = setup();
  const custom = foods.createCustomFood({ name: "Delete evidence" });
  const introduction = addFoodEntry(
    database,
    child.id,
    "introduction",
    [custom.id],
    T0
  );
  assert.equal(foods.statusFor(child.id, custom.id, T0).status, "trying");
  database.entries.scrub(introduction);
  assert.equal(foods.statusFor(child.id, custom.id, T0).status, "untried");

  addFoodEntry(database, child.id, "reaction", [custom.id], T0 + 1);
  assert.equal(foods.statusFor(child.id, custom.id, T0 + 1).status, "avoid");
  database.close();
});

test("Meals do not count as exposure; heads-ups are queryable and suppressible", () => {
  const { database, child, foods } = setup();
  addFoodEntry(database, child.id, "meal", ["peanut"], T0);
  assert.equal(foods.statusFor(child.id, "peanut", T0).exposureCount, 0);
  assert.equal(foods.statusFor(child.id, "peanut", T0).status, "untried");
  assert.deepEqual(foods.introductionHeadsUps(child.id, "peanut", T0), [
    { kind: "first-allergen-food", foodId: "peanut" },
  ]);

  addFoodEntry(database, child.id, "introduction", ["apple"], T0);
  assert.deepEqual(foods.introductionHeadsUps(child.id, "peanut", T0 + DAY), [
    { kind: "first-allergen-food", foodId: "peanut" },
    { kind: "overlapping-introductions", foodId: "apple" },
  ]);
  assert.deepEqual(
    foods.introductionHeadsUps(child.id, "peanut", T0 + DAY, {
      suppress: true,
    }),
    []
  );
  database.close();
});
