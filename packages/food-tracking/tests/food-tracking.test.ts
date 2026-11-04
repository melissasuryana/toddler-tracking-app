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
  assert.deepEqual(foods.getFood("edamame")?.allergenTags, ["soy"]);
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
  const editable = foods.createCustomFood({ name: "Editable puree" });

  const introduced = foods.createCustomFood({
    name: "Trial Food",
    category: "fruit",
  });
  addFoodEntry(database, child.id, "introduction", [introduced.id], T0);
  assert.equal(foods.deleteCustomFood(introduced.id), false);
  assert.throws(
    () =>
      foods.updateCustomFood(introduced.id, {
        name: "Updated Trial Food",
        category: "compound",
        allergenTags: ["sesame"],
      }),
    /untried custom Food/
  );
  assert.equal(foods.getFood(introduced.id)?.name, "Trial Food");

  const edited = foods.updateCustomFood(editable.id, {
    name: "Edited Ada puree",
    category: "compound",
    allergenTags: ["sesame"],
  });
  assert.equal(edited.name, "Edited Ada puree");
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

test("manual-safe is cycle-bound and cannot resurrect after its Introduction changes", () => {
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

test("cycle-bound manual-safe retains manual safeReason even after watchPeriod endsAt", () => {
  const { database, child, foods } = setup();
  const custom = foods.createCustomFood({ name: "Manual safe item" });
  addFoodEntry(database, child.id, "introduction", [custom.id], T0);

  const manuallySafe = foods.markSafe(child.id, custom.id, T0 + 1);
  assert.equal(manuallySafe?.status, "safe");
  assert.equal(manuallySafe?.safeReason, "manual");

  // Before 3 days
  assert.equal(
    foods.statusFor(child.id, custom.id, T0 + 2 * DAY).safeReason,
    "manual"
  );

  // After 3 days (watch period expired)
  const afterExpiration = foods.statusFor(child.id, custom.id, T0 + 5 * DAY);
  assert.equal(afterExpiration.status, "safe");
  assert.equal(afterExpiration.safeReason, "manual");

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

test("manual-safe supports untried foods and establishes safe status without introduction", () => {
  const { database, child, foods } = setup();

  // Untried food can be marked safe directly
  assert.equal(foods.statusFor(child.id, "apple", T0).status, "untried");
  const marked = foods.markSafe(child.id, "apple", T0);
  assert.ok(marked);
  assert.equal(marked.status, "safe");
  assert.equal(marked.safeReason, "manual");
  assert.equal(marked.exposureCount, 0);
  assert.equal(marked.watchPeriod, null);

  const marker = database.foods.manualSafeMarker(child.id, "apple");
  assert.ok(marker);
  assert.equal(marker.cycleEntryId, null);

  // Status derives as safe with manual reason
  const derived = foods.statusFor(child.id, "apple", T0 + 100);
  assert.equal(derived.status, "safe");
  assert.equal(derived.safeReason, "manual");
  assert.equal(derived.exposureCount, 0);

  // Cannot mark safe when already safe
  assert.equal(foods.markSafe(child.id, "apple", T0 + 200), null);

  // Logging an introduction invalidates untried manual safe and starts trying
  const introId = addFoodEntry(database, child.id, "introduction", ["apple"], T0 + 300);
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  assert.equal(foods.statusFor(child.id, "apple", T0 + 300).status, "trying");

  // While trying, marking safe is cycle-bound to that introduction
  const markedCycle = foods.markSafe(child.id, "apple", T0 + 400);
  assert.ok(markedCycle);
  assert.equal(database.foods.manualSafeMarker(child.id, "apple")?.cycleEntryId, introId);

  // Logging reaction invalidates and sets avoid
  addFoodEntry(database, child.id, "reaction", ["apple"], T0 + 500);
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  assert.equal(foods.statusFor(child.id, "apple", T0 + 500).status, "avoid");

  // Cannot mark safe when avoid
  assert.equal(foods.markSafe(child.id, "apple", T0 + 600), null);

  database.close();
});

test("resetStatusCounts accurately reports counts and canReset eligibility", () => {
  const { database, child, foods } = setup();

  // Untried food with no entries or markers cannot be reset
  assert.deepEqual(foods.resetStatusCounts(child.id, "banana"), {
    canReset: false,
    introductionCount: 0,
    singleReactionCount: 0,
    sharedReactionCount: 0,
    hasManualSafeDecision: false,
  });

  // Untried food with manual safe marker CAN be reset
  foods.markSafe(child.id, "banana", T0);
  assert.deepEqual(foods.resetStatusCounts(child.id, "banana"), {
    canReset: true,
    introductionCount: 0,
    singleReactionCount: 0,
    sharedReactionCount: 0,
    hasManualSafeDecision: true,
  });

  // Add 2 introductions
  addFoodEntry(database, child.id, "introduction", ["banana"], T0 + 100);
  addFoodEntry(database, child.id, "introduction", ["banana"], T0 + 200);

  // Add 1 single-food reaction
  const singleReaction = database.entries.create({
    childId: child.id,
    kind: "reaction",
    occurredAt: T0 + 300,
    occurredTz: "UTC",
  });
  database.entries.setContent(singleReaction.id, {
    foodIds: ["banana"],
    symptoms: [{ name: "hives", severity: "mild" }],
  });
  database.entries.addAssociation(singleReaction.id, "food", "banana");

  // Add 1 shared reaction with pear
  const sharedReaction = database.entries.create({
    childId: child.id,
    kind: "reaction",
    occurredAt: T0 + 400,
    occurredTz: "UTC",
  });
  database.entries.setContent(sharedReaction.id, {
    foodIds: ["banana", "pear"],
    symptoms: [{ name: "rash", severity: "mild" }],
  });
  database.entries.addAssociation(sharedReaction.id, "food", "banana");
  database.entries.addAssociation(sharedReaction.id, "food", "pear");

  assert.deepEqual(foods.resetStatusCounts(child.id, "banana"), {
    canReset: true,
    introductionCount: 2,
    singleReactionCount: 1,
    sharedReactionCount: 1,
    hasManualSafeDecision: false,
  });

  database.close();
});

test("resetStatus atomically scrubs introductions, single-food reactions, prunes shared reactions, and clears markers", () => {
  const { database, child, foods } = setup();

  // Banana: 2 introductions, 1 single-food reaction, 1 shared reaction with pear
  const intro1 = addFoodEntry(database, child.id, "introduction", ["banana"], T0 + 100);
  const intro2 = addFoodEntry(database, child.id, "introduction", ["banana"], T0 + 200);

  const singleReaction = database.entries.create({
    childId: child.id,
    kind: "reaction",
    occurredAt: T0 + 300,
    occurredTz: "UTC",
  });
  database.entries.setContent(singleReaction.id, {
    foodIds: ["banana"],
    symptoms: [{ name: "hives", severity: "mild" }],
  });
  database.entries.addAssociation(singleReaction.id, "food", "banana");

  // Pear: 1 introduction
  const pearIntro = addFoodEntry(database, child.id, "introduction", ["pear"], T0 + 50);

  const sharedReaction = database.entries.create({
    childId: child.id,
    kind: "reaction",
    occurredAt: T0 + 400,
    occurredTz: "UTC",
  });
  database.entries.setContent(sharedReaction.id, {
    foodIds: ["banana", "pear"],
    symptoms: [{ name: "rash", severity: "mild" }],
  });
  database.entries.addAssociation(sharedReaction.id, "food", "banana");
  database.entries.addAssociation(sharedReaction.id, "food", "pear");

  // Rechallenge banana and mark safe
  addFoodEntry(database, child.id, "introduction", ["banana"], T0 + 500);
  foods.markSafe(child.id, "banana", T0 + 501);

  // Verify initial status
  assert.equal(foods.statusFor(child.id, "banana", T0 + 501).status, "safe");
  assert.equal(foods.statusFor(child.id, "pear", T0 + 501).status, "avoid");

  // Reset banana status
  const resetResult = foods.resetStatus(child.id, "banana");
  assert.equal(resetResult.status, "untried");
  assert.equal(resetResult.safeReason, null);
  assert.equal(resetResult.watchPeriod, null);
  assert.equal(resetResult.exposureCount, 0);

  // Banana is now untried
  const statusAfter = foods.statusFor(child.id, "banana", T0 + 600);
  assert.equal(statusAfter.status, "untried");
  assert.equal(statusAfter.exposureCount, 0);
  assert.equal(database.foods.manualSafeMarker(child.id, "banana"), null);

  // Introductions for banana are scrubbed
  assert.equal(database.entries.get(intro1), null);
  assert.equal(database.entries.get(intro2), null);

  // Single food reaction is scrubbed
  assert.equal(database.entries.get(singleReaction.id), null);

  // Shared reaction is NOT scrubbed, but banana is removed from it
  const preservedReaction = database.entries.get(sharedReaction.id);
  assert.ok(preservedReaction);
  const sharedContent = database.entries.contentFor(sharedReaction.id) as {
    foodIds: string[];
  };
  assert.deepEqual(sharedContent.foodIds, ["pear"]);
  const sharedAssocs = database.entries.associationsFor(sharedReaction.id);
  assert.deepEqual(sharedAssocs, [
    { associationType: "food", associatedId: "pear" },
  ]);

  // Pear remains avoid with its introduction intact
  assert.ok(database.entries.get(pearIntro));
  assert.equal(foods.statusFor(child.id, "pear", T0 + 600).status, "avoid");

  // Resetting an already untried food with no history throws
  assert.throws(
    () => foods.resetStatus(child.id, "banana"),
    /Food is already untried/
  );

  database.close();
});

