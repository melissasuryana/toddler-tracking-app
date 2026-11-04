import assert from "node:assert/strict";
import { test } from "node:test";
import {
  openDatabase,
  type LocalDatabase,
} from "@keepsake/local-data";
import { FoodTracking, SEEDED_FOODS } from "@keepsake/food-tracking";
import { openTestDriver } from "../packages/food-tracking/tests/helpers.ts";

const T0 = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const database = openDatabase(openTestDriver());
  const child = database.children.create({
    name: "Ada",
    birthdate: "2024-03-01",
    sex: "female",
  });
  const foods = new FoodTracking(database);
  return { database, child, foods };
}

test("Ticket 94: Mark safe on untried food establishes safe status without introduction", () => {
  const { database, child, foods } = setup();
  const apple = "apple";

  // Initially untried
  const initialStatus = foods.statusFor(child.id, apple, T0);
  assert.equal(initialStatus.status, "untried");
  assert.equal(initialStatus.exposureCount, 0);

  // Mark safe directly while untried
  const marked = foods.markSafe(child.id, apple, T0);
  assert.ok(marked);
  assert.equal(marked.status, "safe");
  assert.equal(marked.safeReason, "manual");
  assert.equal(marked.exposureCount, 0);
  assert.equal(marked.watchPeriod, null);

  // Derivation reflects safe manually
  const current = foods.statusFor(child.id, apple, T0 + 100);
  assert.equal(current.status, "safe");
  assert.equal(current.safeReason, "manual");
  assert.equal(current.exposureCount, 0);

  // Marker in DB has cycleEntryId = null
  const marker = database.foods.manualSafeMarker(child.id, apple);
  assert.ok(marker);
  assert.equal(marker.childId, child.id);
  assert.equal(marker.foodId, apple);
  assert.equal(marker.cycleEntryId, null);

  // Calling markSafe again returns null
  assert.equal(foods.markSafe(child.id, apple, T0 + 200), null);

  database.close();
});

test("Ticket 94: Mark safe on trying food binds to watch cycle", () => {
  const { database, child, foods } = setup();
  const banana = "banana";

  // Create introduction -> trying
  const intro = database.entries.create({
    childId: child.id,
    kind: "introduction",
    occurredAt: T0,
    occurredTz: "UTC",
  });
  database.entries.setContent(intro.id, { foodId: banana });
  database.entries.addAssociation(intro.id, "food", banana);

  const tryingStatus = foods.statusFor(child.id, banana, T0);
  assert.equal(tryingStatus.status, "trying");
  assert.ok(tryingStatus.watchPeriod);

  // Mark safe while trying
  const marked = foods.markSafe(child.id, banana, T0 + 100);
  assert.ok(marked);
  assert.equal(marked.status, "safe");
  assert.equal(marked.safeReason, "manual");

  // Marker binds to opening introduction
  const marker = database.foods.manualSafeMarker(child.id, banana);
  assert.ok(marker);
  assert.equal(marker.cycleEntryId, intro.id);

  database.close();
});

test("Ticket 94: Reset status counts and eligibility check", () => {
  const { database, child, foods } = setup();
  const pear = "pear";

  // Untried with no history cannot be reset
  assert.deepEqual(foods.resetStatusCounts(child.id, pear), {
    canReset: false,
    introductionCount: 0,
    singleReactionCount: 0,
    sharedReactionCount: 0,
    hasManualSafeDecision: false,
  });

  // Untried marked safe CAN be reset (marker will be cleared)
  foods.markSafe(child.id, pear, T0);
  assert.deepEqual(foods.resetStatusCounts(child.id, pear), {
    canReset: true,
    introductionCount: 0,
    singleReactionCount: 0,
    sharedReactionCount: 0,
    hasManualSafeDecision: true,
  });

  database.close();
});

test("Ticket 94: Reset status scrubs introductions, single-food reactions, prunes shared reactions, and reverts to untried", () => {
  const { database, child, foods } = setup();
  const egg = "egg";
  const dairy = "whole-milk";

  // 1. Log two introductions for egg
  const intro1 = database.entries.create({
    childId: child.id,
    kind: "introduction",
    occurredAt: T0,
    occurredTz: "UTC",
  });
  database.entries.setContent(intro1.id, { foodId: egg });
  database.entries.addAssociation(intro1.id, "food", egg);

  const intro2 = database.entries.create({
    childId: child.id,
    kind: "introduction",
    occurredAt: T0 + DAY,
    occurredTz: "UTC",
  });
  database.entries.setContent(intro2.id, { foodId: egg });
  database.entries.addAssociation(intro2.id, "food", egg);

  // 2. Log single-food reaction for egg
  const singleRx = database.entries.create({
    childId: child.id,
    kind: "reaction",
    occurredAt: T0 + 2 * DAY,
    occurredTz: "UTC",
  });
  database.entries.setContent(singleRx.id, {
    foodIds: [egg],
    symptoms: [{ name: "vomiting", severity: "moderate" }],
  });
  database.entries.addAssociation(singleRx.id, "food", egg);

  // 3. Log introduction for dairy
  const dairyIntro = database.entries.create({
    childId: child.id,
    kind: "introduction",
    occurredAt: T0 + 3 * DAY,
    occurredTz: "UTC",
  });
  database.entries.setContent(dairyIntro.id, { foodId: dairy });
  database.entries.addAssociation(dairyIntro.id, "food", dairy);

  // 4. Log shared reaction for egg and dairy
  const sharedRx = database.entries.create({
    childId: child.id,
    kind: "reaction",
    occurredAt: T0 + 4 * DAY,
    occurredTz: "UTC",
  });
  database.entries.setContent(sharedRx.id, {
    foodIds: [egg, dairy],
    symptoms: [{ name: "hives", severity: "severe" }],
  });
  database.entries.addAssociation(sharedRx.id, "food", egg);
  database.entries.addAssociation(sharedRx.id, "food", dairy);

  // Verify counts before reset
  const countsBefore = foods.resetStatusCounts(child.id, egg);
  assert.equal(countsBefore.canReset, true);
  assert.equal(countsBefore.introductionCount, 2);
  assert.equal(countsBefore.singleReactionCount, 1);
  assert.equal(countsBefore.sharedReactionCount, 1);
  assert.equal(countsBefore.hasManualSafeDecision, false);

  // Reset status for egg
  const resetStatus = foods.resetStatus(child.id, egg);
  assert.equal(resetStatus.status, "untried");
  assert.equal(resetResultCount(resetStatus), 0);
  assert.equal(resetStatus.safeReason, null);
  assert.equal(resetStatus.watchPeriod, null);

  // Introductions for egg are scrubbed
  assert.equal(database.entries.get(intro1.id), null);
  assert.equal(database.entries.get(intro2.id), null);

  // Single-food reaction for egg is scrubbed
  assert.equal(database.entries.get(singleRx.id), null);

  // Shared reaction is pruned: egg removed, dairy preserved
  const sharedStillExists = database.entries.get(sharedRx.id);
  assert.ok(sharedStillExists);
  const sharedContent = database.entries.contentFor(sharedRx.id) as {
    foodIds: string[];
    symptoms: unknown[];
  };
  assert.deepEqual(sharedContent.foodIds, [dairy]);
  const sharedAssociations = database.entries.associationsFor(sharedRx.id);
  assert.deepEqual(sharedAssociations, [
    { associationType: "food", associatedId: dairy },
  ]);

  // Dairy is still in avoid status due to the shared reaction!
  const dairyStatus = foods.statusFor(child.id, dairy, T0 + 5 * DAY);
  assert.equal(dairyStatus.status, "avoid");
  assert.ok(database.entries.get(dairyIntro.id));

  // Egg is untried with canReset: false
  assert.deepEqual(foods.resetStatusCounts(child.id, egg), {
    canReset: false,
    introductionCount: 0,
    singleReactionCount: 0,
    sharedReactionCount: 0,
    hasManualSafeDecision: false,
  });

  database.close();
});

test("Ticket 94: Reset status integrates with FoodEntries repository", async () => {
  const { database, child, foods } = setup();
  const { FoodEntries } = await import("@keepsake/food-tracking");
  const foodEntries = new FoodEntries(database);

  const intro = foodEntries.createIntroduction({
    childId: child.id,
    occurredAt: T0,
    occurredTz: "UTC",
    foodId: "banana",
  });
  const rx = foodEntries.createReaction({
    childId: child.id,
    occurredAt: T0 + DAY,
    occurredTz: "UTC",
    foodIds: ["banana"],
    severity: "mild",
  });

  assert.equal(foodEntries.listForChild(child.id).length, 2);
  assert.equal(foods.statusFor(child.id, "banana", T0 + 2 * DAY).status, "avoid");

  foods.resetStatus(child.id, "banana");

  assert.equal(foodEntries.listForChild(child.id).length, 0);
  assert.equal(foods.statusFor(child.id, "banana", T0 + 2 * DAY).status, "untried");

  database.close();
});

function resetResultCount(status: { exposureCount: number }) {
  return status.exposureCount;
}
