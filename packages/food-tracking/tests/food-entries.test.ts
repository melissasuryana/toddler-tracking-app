import assert from "node:assert/strict";
import { test } from "node:test";
import { EntryValidationError, openDatabase } from "@keepsake/local-data";
import {
  FoodEntries,
  FoodEntryValidationError,
  FoodTracking,
  MealEntries,
  REACTION_SEVERITIES,
  REACTION_SYMPTOMS,
  deriveFoodStatus,
  introductionHeadsUpsFrom,
  mealDraftFromIntroduction,
  normalizeIntroductionContent,
  normalizeReactionContent,
  type IntroductionEntryInput,
  type ReactionEntryInput,
} from "../index.ts";
import { openTestDriver } from "./helpers.ts";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_123;

function setup() {
  const database = openDatabase(openTestDriver());
  const child = database.children.create({
    name: "Ada",
    birthdate: "2024-03-01",
    sex: "female",
  });
  const otherChild = database.children.create({
    name: "Grace",
    birthdate: "2023-04-02",
    sex: "female",
  });
  return {
    database,
    child,
    otherChild,
    entries: new FoodEntries(database),
    foods: new FoodTracking(database),
    meals: new MealEntries(database),
  };
}

function introduction(
  childId: string,
  extra: Partial<IntroductionEntryInput> = {}
): IntroductionEntryInput {
  return {
    childId,
    occurredAt: T0,
    occurredTz: "UTC",
    foodId: "apple",
    ...extra,
  };
}

function reaction(
  childId: string,
  extra: Partial<ReactionEntryInput> = {}
): ReactionEntryInput {
  return {
    childId,
    occurredAt: T0 + 1,
    occurredTz: "UTC",
    foodIds: ["apple"],
    severity: "mild",
    ...extra,
  };
}

test("Introduction persists exactly one named Food, optional note and single Texture", () => {
  const { database, child, entries, foods } = setup();
  const custom = foods.createCustomFood({ name: "Custom food" });
  const created = entries.createIntroduction(
    introduction(child.id, {
      foodId: custom.id,
      occurredTz: "Asia/Kolkata",
      note: "  First taste  ",
      texture: "mashed",
    })
  );
  assert.equal(created.kind, "introduction");
  assert.equal(created.occurredAt, T0);
  assert.equal(created.occurredTz, "Asia/Kolkata");
  assert.deepEqual(created.content, {
    foodId: custom.id,
    texture: "mashed",
    note: "First taste",
  });
  assert.deepEqual(database.entries.contentFor(created.id), created.content);
  assert.deepEqual(database.entries.associationsFor(created.id), [
    { associationType: "food", associatedId: custom.id },
  ]);
  assert.deepEqual(new FoodEntries(database).get(created.id), created);
  assert.equal(foods.statusFor(child.id, custom.id, T0).exposureCount, 1);
  assert.deepEqual(
    entries.createIntroduction(
      introduction(child.id, { note: "   ", texture: null })
    ).content,
    { foodId: "apple", texture: null }
  );
  database.close();
});

test("Reaction deduplicates Foods/symptoms and permits every severity and seeded symptom", () => {
  const { database, child, entries } = setup();
  for (const severity of REACTION_SEVERITIES) {
    const created = entries.createReaction(
      reaction(child.id, {
        foodIds: ["apple", "pear", "apple"],
        severity,
        symptoms: [...REACTION_SYMPTOMS, "vomiting"],
        note: "  Observed after lunch  ",
      })
    );
    assert.equal(created.kind, "reaction");
    assert.deepEqual(created.content, {
      foodIds: ["apple", "pear"],
      severity,
      symptoms: [...REACTION_SYMPTOMS],
      note: "Observed after lunch",
    });
    assert.deepEqual(new FoodEntries(database).get(created.id), created);
    assert.deepEqual(database.entries.associationsFor(created.id), [
      { associationType: "food", associatedId: "apple" },
      { associationType: "food", associatedId: "pear" },
    ]);
  }
  assert.deepEqual(entries.createReaction(reaction(child.id)).content, {
    foodIds: ["apple"],
    severity: "mild",
    symptoms: [],
  });
  database.close();
});

test("content validation rejects unnamed/unknown Foods, multiple textures and custom symptoms", () => {
  const { database, child, entries } = setup();
  for (const extra of [
    { foodId: "" },
    { foodId: "  " },
    { foodId: "not-a-food" },
    { foodId: ["apple", "pear"] as never },
    { texture: "crunchy" as never },
    { texture: ["mashed", "purée"] as never },
    { note: 42 as never },
  ]) {
    assert.throws(
      () => entries.createIntroduction(introduction(child.id, extra)),
      FoodEntryValidationError
    );
  }
  for (const extra of [
    { foodIds: [] },
    { foodIds: ["not-a-food"] },
    { foodIds: ["apple", ""] },
    { foodIds: "apple" as never },
    { severity: undefined as never },
    { severity: "critical" as never },
    { symptoms: ["itching"] as never },
    { symptoms: null as never },
    { symptoms: "rash/hives" as never },
    { note: false as never },
  ]) {
    assert.throws(
      () => entries.createReaction(reaction(child.id, extra)),
      FoodEntryValidationError
    );
  }
  assert.deepEqual(database.entries.listForChild(child.id), []);
  assert.deepEqual(normalizeIntroductionContent({ foodId: "apple" }), {
    foodId: "apple",
    texture: null,
  });
  assert.deepEqual(
    normalizeReactionContent({
      foodIds: ["apple"],
      severity: "mild",
      note: " ",
    }),
    { foodIds: ["apple"], severity: "mild", symptoms: [] }
  );
  database.close();
});

test("Entry validation rejects future/invalid timestamps, timezone, and missing Child atomically", () => {
  const { database, child, entries } = setup();
  for (const extra of [
    { occurredAt: Date.now() + DAY },
    { occurredAt: -1 },
    { occurredAt: 0.5 },
    { occurredAt: Number.NaN },
    { occurredTz: "not/a-zone" },
    { childId: "missing" },
  ]) {
    assert.throws(
      () => entries.createIntroduction(introduction(child.id, extra)),
      EntryValidationError
    );
    assert.throws(
      () => entries.createReaction(reaction(child.id, extra)),
      EntryValidationError
    );
  }
  assert.throws(() =>
    entries.createIntroduction(
      introduction("00000000-0000-7000-8000-000000000000")
    )
  );
  assert.deepEqual(entries.listForChild(child.id), []);
  assert.equal(
    database.driver
      .prepareSync("SELECT count(*) AS count FROM entry_content")
      .get<{ count: number }>()?.count,
    0
  );
  database.close();
});

test("CRUD preserves Entry identity, Child, createdAt and recorded timezone; clears old content", () => {
  const { database, child, otherChild, entries, meals } = setup();
  const intro = entries.createIntroduction(
    introduction(child.id, { note: "Old note", texture: "purée" })
  );
  const updated = entries.updateIntroduction(
    intro.id,
    introduction(child.id, { occurredAt: T0 - DAY, foodId: "pear" })
  );
  assert.ok(updated);
  assert.equal(updated.id, intro.id);
  assert.equal(updated.childId, intro.childId);
  assert.equal(updated.createdAt, intro.createdAt);
  assert.ok(updated.updatedAt > intro.updatedAt);
  assert.equal(updated.occurredAt, T0 - DAY);
  assert.deepEqual(updated.content, { foodId: "pear", texture: null });
  assert.deepEqual(database.entries.contentFor(intro.id), updated.content);
  assert.deepEqual(database.entries.associationsFor(intro.id), [
    { associationType: "food", associatedId: "pear" },
  ]);
  assert.throws(
    () =>
      entries.updateIntroduction(
        intro.id,
        introduction(otherChild.id, { foodId: "pear" })
      ),
    EntryValidationError
  );
  assert.throws(
    () =>
      entries.updateIntroduction(
        intro.id,
        introduction(child.id, { occurredTz: "Europe/London" })
      ),
    EntryValidationError
  );
  const reacted = entries.createReaction(
    reaction(child.id, {
      foodIds: ["apple", "pear"],
      severity: "severe",
      symptoms: ["swelling"],
      note: "Old",
    })
  );
  const corrected = entries.updateReaction(
    reacted.id,
    reaction(child.id, { foodIds: ["banana"], severity: "moderate" })
  );
  assert.ok(corrected);
  assert.equal(corrected.id, reacted.id);
  assert.equal(corrected.childId, reacted.childId);
  assert.equal(corrected.createdAt, reacted.createdAt);
  assert.ok(corrected.updatedAt > reacted.updatedAt);
  assert.deepEqual(corrected.content, {
    foodIds: ["banana"],
    severity: "moderate",
    symptoms: [],
  });
  assert.deepEqual(database.entries.contentFor(reacted.id), corrected.content);
  assert.deepEqual(database.entries.associationsFor(reacted.id), [
    { associationType: "food", associatedId: "banana" },
  ]);
  assert.throws(
    () => entries.updateReaction(reacted.id, reaction(otherChild.id)),
    EntryValidationError
  );
  const meal = meals.create(introduction(child.id));
  assert.equal(entries.get(meal.id), null);
  assert.equal(entries.get("missing"), null);
  assert.equal(
    entries.updateIntroduction("missing", introduction(child.id)),
    null
  );
  assert.equal(entries.updateReaction(intro.id, reaction(child.id)), null);
  assert.equal(
    entries.updateIntroduction(reacted.id, introduction(child.id)),
    null
  );
  assert.equal(entries.updateReaction(meal.id, reaction(child.id)), null);
  assert.equal(entries.delete(meal.id), false);
  assert.ok(meals.get(meal.id));
  assert.deepEqual(entries.listForChild(otherChild.id), []);
  assert.deepEqual(
    entries.listForChild(child.id).map((entry) => entry.id),
    [reacted.id, intro.id]
  );
  database.close();
});

test("public writes replay backdated corrections, terminal Reactions, and later rechallenges", () => {
  const { database, child, otherChild, entries, foods } = setup();
  const intro = entries.createIntroduction(introduction(child.id));
  const repeat = entries.createIntroduction(
    introduction(child.id, { occurredAt: T0 + DAY })
  );
  assert.equal(
    foods.statusFor(child.id, "apple", T0 + DAY).watchPeriod
      ?.openingIntroductionId,
    intro.id
  );
  assert.equal(foods.statusFor(child.id, "apple", T0 + DAY).exposureCount, 2);
  assert.equal(foods.statusFor(child.id, "apple", T0 + 3 * DAY).status, "safe");
  const reacted = entries.createReaction(
    reaction(child.id, { occurredAt: T0 + 4 * DAY, foodIds: ["apple", "pear"] })
  );
  assert.equal(foods.statusFor(child.id, "pear", T0 + 4 * DAY).status, "avoid");
  assert.equal(
    foods.statusFor(child.id, "apple", T0 + 4 * DAY).status,
    "avoid"
  );
  assert.equal(
    foods.statusFor(otherChild.id, "apple", T0 + 4 * DAY).status,
    "untried"
  );
  const retry = entries.createIntroduction(
    introduction(child.id, { occurredAt: T0 + 4 * DAY + 1 })
  );
  assert.equal(
    foods.statusFor(child.id, "apple", T0 + 4 * DAY + 1).watchPeriod
      ?.openingIntroductionId,
    retry.id
  );
  entries.updateReaction(
    reacted.id,
    reaction(child.id, { occurredAt: retry.occurredAt, foodIds: ["apple"] })
  );
  assert.equal(
    foods.statusFor(child.id, "apple", retry.occurredAt).status,
    "avoid"
  );
  assert.equal(
    foods.statusFor(child.id, "pear", retry.occurredAt).status,
    "untried"
  );
  entries.delete(reacted.id);
  assert.equal(
    foods.statusFor(child.id, "apple", retry.occurredAt).status,
    "safe"
  );
  entries.delete(intro.id);
  entries.delete(repeat.id);
  assert.equal(
    foods.statusFor(child.id, "apple", retry.occurredAt).watchPeriod
      ?.openingIntroductionId,
    retry.id
  );
  entries.delete(retry.id);
  assert.equal(
    foods.statusFor(child.id, "apple", retry.occurredAt).status,
    "untried"
  );
  database.close();
});

test("manual-safe survives note/texture edits but not time, Food, backdating, or deletion", () => {
  const { database, child, entries, foods } = setup();
  const intro = entries.createIntroduction(introduction(child.id));
  entries.createIntroduction(introduction(child.id, { foodId: "pear" }));
  const markBoth = () => {
    foods.markSafe(child.id, "apple", T0 + 10);
    foods.markSafe(child.id, "pear", T0 + 10);
  };
  markBoth();
  entries.updateIntroduction(
    intro.id,
    introduction(child.id, { note: "Changed", texture: "mashed" })
  );
  assert.equal(
    foods.statusFor(child.id, "apple", T0 + 10).safeReason,
    "manual"
  );
  entries.updateIntroduction(
    intro.id,
    introduction(child.id, { foodId: "pear" })
  );
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  assert.equal(database.foods.manualSafeMarker(child.id, "pear"), null);
  entries.updateIntroduction(intro.id, introduction(child.id));
  markBoth();
  entries.updateIntroduction(
    intro.id,
    introduction(child.id, { occurredAt: T0 - 1 })
  );
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  foods.markSafe(child.id, "apple", T0 + 10);
  const backdated = entries.createIntroduction(
    introduction(child.id, { occurredAt: T0 - 2 })
  );
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  entries.delete(backdated.id);
  assert.equal(foods.statusFor(child.id, "apple", T0 + 10).status, "trying");
  foods.markSafe(child.id, "apple", T0 + 10);
  entries.delete(intro.id);
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  assert.equal(foods.statusFor(child.id, "apple", T0 + 10).status, "untried");
  database.close();
});

test("Reaction insertion invalidates manual-safe and correction/deletion never resurrects it", () => {
  const { database, child, entries, foods } = setup();
  entries.createIntroduction(introduction(child.id));
  foods.markSafe(child.id, "apple", T0 + 1);
  const reacted = entries.createReaction(reaction(child.id));
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  entries.updateReaction(
    reacted.id,
    reaction(child.id, { foodIds: ["pear"], severity: "severe" })
  );
  assert.equal(foods.statusFor(child.id, "apple", T0 + 10).status, "trying");
  entries.delete(reacted.id);
  assert.equal(foods.statusFor(child.id, "pear", T0 + 10).status, "untried");
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  database.close();
});

test("Reaction content-only edits preserve rechallenge manual-safe; Food corrections invalidate both sides", () => {
  const { database, child, entries, foods } = setup();
  const reacted = entries.createReaction(reaction(child.id));
  entries.createIntroduction(introduction(child.id, { occurredAt: T0 + 2 }));
  entries.createIntroduction(
    introduction(child.id, { occurredAt: T0 + 2, foodId: "pear" })
  );
  foods.markSafe(child.id, "apple", T0 + 3);
  foods.markSafe(child.id, "pear", T0 + 3);
  entries.updateReaction(
    reacted.id,
    reaction(child.id, {
      severity: "severe",
      symptoms: ["swelling"],
      note: "Corrected details",
    })
  );
  assert.equal(foods.statusFor(child.id, "apple", T0 + 3).safeReason, "manual");
  assert.equal(foods.statusFor(child.id, "pear", T0 + 3).safeReason, "manual");
  entries.updateReaction(reacted.id, reaction(child.id, { foodIds: ["pear"] }));
  assert.equal(database.foods.manualSafeMarker(child.id, "apple"), null);
  assert.equal(database.foods.manualSafeMarker(child.id, "pear"), null);
  assert.equal(foods.statusFor(child.id, "apple", T0 + 3).status, "trying");
  assert.equal(foods.statusFor(child.id, "pear", T0 + 3).status, "trying");
  database.close();
});

test("association failures roll back create/update content, evidence and manual-safe invalidation", () => {
  const { database, child, entries, foods } = setup();
  const intro = entries.createIntroduction(introduction(child.id));
  foods.markSafe(child.id, "apple", T0 + 1);
  const marker = database.foods.manualSafeMarker(child.id, "apple");
  database.driver.execSync(`
    CREATE TRIGGER reject_pear BEFORE INSERT ON entry_associations
    WHEN NEW.associated_id = 'pear'
    BEGIN SELECT RAISE(ABORT, 'injected association failure'); END;
  `);
  assert.throws(
    () =>
      entries.createReaction(
        reaction(child.id, { foodIds: ["apple", "pear"] })
      ),
    /injected association failure/
  );
  assert.deepEqual(entries.listForChild(child.id), [intro]);
  assert.deepEqual(database.foods.manualSafeMarker(child.id, "apple"), marker);
  assert.throws(
    () =>
      entries.updateIntroduction(
        intro.id,
        introduction(child.id, {
          occurredAt: T0 - 1,
          foodId: "pear",
          note: "Must not persist",
        })
      ),
    /injected association failure/
  );
  assert.deepEqual(entries.get(intro.id), intro);
  assert.deepEqual(database.foods.manualSafeMarker(child.id, "apple"), marker);
  assert.deepEqual(database.entries.associationsFor(intro.id), [
    { associationType: "food", associatedId: "apple" },
  ]);
  const reacted = entries.createReaction(
    reaction(child.id, { foodIds: ["banana"] })
  );
  assert.throws(
    () =>
      entries.updateReaction(
        reacted.id,
        reaction(child.id, {
          foodIds: ["apple", "pear"],
          note: "Must roll back",
        })
      ),
    /injected association failure/
  );
  assert.deepEqual(entries.get(reacted.id), reacted);
  assert.deepEqual(database.foods.manualSafeMarker(child.id, "apple"), marker);
  database.close();
});

test("failed scrubbing rolls back content removal, associations and manual-safe invalidation", () => {
  const { database, child, entries, foods } = setup();
  const intro = entries.createIntroduction(introduction(child.id));
  foods.markSafe(child.id, "apple", T0 + 1);
  const marker = database.foods.manualSafeMarker(child.id, "apple");
  database.driver.execSync(`
    CREATE TRIGGER reject_tombstone BEFORE INSERT ON entries
    WHEN NEW.deleted_at IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'injected scrub failure'); END;
  `);
  assert.throws(() => entries.delete(intro.id), /injected scrub failure/);
  assert.deepEqual(entries.get(intro.id), intro);
  assert.deepEqual(database.foods.manualSafeMarker(child.id, "apple"), marker);
  assert.deepEqual(database.entries.associationsFor(intro.id), [
    { associationType: "food", associatedId: "apple" },
  ]);
  database.close();
});

test("deleted Entries retain only tombstones, with no content/associations or editable history", () => {
  const { database, child, entries } = setup();
  for (const created of [
    entries.createIntroduction(introduction(child.id, { note: "Private" })),
    entries.createReaction(
      reaction(child.id, { symptoms: ["swelling"], note: "Private" })
    ),
  ]) {
    assert.throws(() => entries.delete(created.id, -1), RangeError);
    assert.ok(entries.get(created.id));
    assert.equal(entries.delete(created.id, T0 + DAY), true);
    assert.equal(entries.delete(created.id), false);
    assert.equal(entries.get(created.id), null);
    assert.equal(database.entries.contentFor(created.id), null);
    assert.deepEqual(database.entries.associationsFor(created.id), []);
    const row = database.driver
      .prepareSync("SELECT * FROM entries WHERE id = ?")
      .get<Record<string, unknown>>(created.id);
    assert.equal(row?.id, created.id);
    assert.equal(row?.deleted_at, T0 + DAY);
    for (const [key, value] of Object.entries(row!)) {
      if (key !== "id" && key !== "deleted_at") assert.equal(value, null);
    }
  }
  assert.deepEqual(entries.listForChild(child.id), []);
  assert.equal(entries.delete("missing"), false);
  database.close();
});

test("Reaction picker includes all statuses/custom Foods and sorts trying first then name", () => {
  const { database, child, otherChild, entries, foods } = setup();
  const custom = foods.createCustomFood({ name: "AAA custom" });
  entries.createIntroduction(introduction(child.id, { foodId: "pear" }));
  entries.createIntroduction(introduction(child.id, { foodId: "banana" }));
  entries.createIntroduction(
    introduction(child.id, { foodId: "apple", occurredAt: T0 - 4 * DAY })
  );
  entries.createReaction(reaction(child.id, { foodIds: ["peanut"] }));
  const list = entries.reactionFoods(child.id, T0 + 10);
  assert.deepEqual(
    list.slice(0, 2).map((food) => food.id),
    ["banana", "pear"]
  );
  assert.ok(list.some((food) => food.id === "apple"));
  assert.ok(list.some((food) => food.id === "peanut"));
  assert.ok(list.some((food) => food.id === custom.id));
  assert.equal(list.length, foods.listFoods().length);
  assert.deepEqual(
    list.slice(2).map((food) => food.id),
    foods
      .listFoods()
      .filter((food) => !["banana", "pear"].includes(food.id))
      .map((food) => food.id)
  );
  assert.deepEqual(
    entries.reactionFoods(otherChild.id, T0 + 10),
    foods.listFoods()
  );
  assert.throws(() => entries.reactionFoods(child.id, -1), RangeError);
  database.close();
});

test("Introduction shortcut is a separate editable Meal draft with EXACT time/tz and fresh defaults", () => {
  const { database, child, otherChild, entries, foods, meals } = setup();
  const firstMeal = meals.create({
    ...introduction(child.id),
    occurredAt: T0 + DAY,
    textures: ["firm finger food"],
    feedingStyles: ["self-fed with hands"],
  });
  meals.create({
    ...introduction(otherChild.id),
    occurredAt: T0 + 2 * DAY,
    feedingStyles: ["spoon-fed"],
  });
  const intro = entries.createIntroduction(
    introduction(child.id, {
      foodId: "peanut",
      texture: "purée",
      note: "Introduction only",
      occurredTz: "America/New_York",
    })
  );
  const before = database.entries.listForChild(child.id).length;
  const statusBefore = foods.statusFor(child.id, "peanut", T0 + 1);
  const draft = entries.mealDraftForIntroduction(intro.id);
  assert.deepEqual(draft, {
    childId: child.id,
    occurredAt: T0,
    occurredTz: "America/New_York",
    amount: 4,
    categories: ["nuts & seeds"],
    allergenTags: ["peanut"],
    textures: ["purée"],
    feedingStyles: ["self-fed with hands"],
  });
  assert.equal(database.entries.listForChild(child.id).length, before);
  assert.deepEqual(foods.statusFor(child.id, "peanut", T0 + 1), statusBefore);
  const meal = meals.create({ ...draft, name: "Edited Meal", amount: 2 });
  assert.equal(meal.occurredAt, intro.occurredAt);
  assert.equal(meal.occurredTz, intro.occurredTz);
  assert.deepEqual(database.entries.associationsFor(meal.id), []);
  assert.deepEqual(foods.statusFor(child.id, "peanut", T0 + 1), statusBefore);
  entries.updateIntroduction(
    intro.id,
    introduction(child.id, {
      foodId: "pear",
      occurredTz: "America/New_York",
    })
  );
  assert.deepEqual(entries.mealDraftForIntroduction(intro.id).textures, []);
  meals.delete(firstMeal.id);
  assert.deepEqual(entries.mealDraftForIntroduction(intro.id).feedingStyles, [
    "self-fed with hands",
  ]);
  entries.delete(intro.id);
  assert.ok(meals.get(meal.id));
  assert.throws(
    () => entries.mealDraftForIntroduction(intro.id),
    FoodEntryValidationError
  );
  assert.throws(
    () => entries.mealDraftForIntroduction(meal.id),
    FoodEntryValidationError
  );
  database.close();
});

test("shortcut clears remembered textures, uses latest nondeleted Meal styles, and supports uncategorized Food", () => {
  const { database, child, entries, foods, meals } = setup();
  const custom = foods.createCustomFood({
    name: "Uncategorized",
    allergenTags: ["egg"],
  });
  const intro = entries.createIntroduction(
    introduction(child.id, { foodId: custom.id })
  );
  assert.deepEqual(
    entries.mealDraftForIntroduction(intro.id).feedingStyles,
    []
  );
  meals.create({
    ...introduction(child.id),
    textures: ["mashed"],
    feedingStyles: ["spoon-fed"],
  });
  const latest = meals.create({
    ...introduction(child.id),
    occurredAt: T0 + DAY,
    feedingStyles: ["self-fed with utensils"],
  });
  const draft = entries.mealDraftForIntroduction(intro.id);
  assert.deepEqual(draft.categories, []);
  assert.deepEqual(draft.allergenTags, ["egg"]);
  assert.deepEqual(draft.textures, []);
  assert.deepEqual(draft.feedingStyles, ["self-fed with utensils"]);
  meals.delete(latest.id);
  assert.deepEqual(entries.mealDraftForIntroduction(intro.id).feedingStyles, [
    "spoon-fed",
  ]);
  const savedMeal = meals.create(draft);
  meals.delete(savedMeal.id);
  assert.ok(entries.get(intro.id));
  database.close();
});

test("public Introduction writes feed existing suppressible heads-ups using backdated history", () => {
  const { database, child, otherChild, entries, foods } = setup();
  assert.deepEqual(foods.introductionHeadsUps(child.id, "peanut", T0), [
    { kind: "first-allergen-food", foodId: "peanut" },
  ]);
  const intro = entries.createIntroduction(introduction(child.id));
  assert.deepEqual(foods.introductionHeadsUps(child.id, "peanut", T0 + DAY), [
    { kind: "first-allergen-food", foodId: "peanut" },
    { kind: "overlapping-introductions", foodId: "apple" },
  ]);
  assert.deepEqual(foods.introductionHeadsUps(child.id, "peanut", T0 - 1), [
    { kind: "first-allergen-food", foodId: "peanut" },
  ]);
  assert.deepEqual(
    foods.introductionHeadsUps(child.id, "peanut", T0 + DAY, {
      suppress: true,
    }),
    []
  );
  entries.createIntroduction(introduction(child.id, { foodId: "peanut" }));
  assert.ok(
    foods
      .introductionHeadsUps(child.id, "peanut", T0 + 1)
      .every((headsUp) => headsUp.kind !== "first-allergen-food")
  );
  assert.deepEqual(
    foods.introductionHeadsUps(otherChild.id, "apple", T0 + DAY),
    []
  );
  entries.delete(intro.id);
  assert.deepEqual(foods.introductionHeadsUps(child.id, "banana", T0 + DAY), [
    { kind: "overlapping-introductions", foodId: "peanut" },
  ]);
  database.close();
});

test("pure preview helpers share persisted status, heads-ups, and shortcut behavior", () => {
  const { database, child, entries, foods } = setup();
  const intro = entries.createIntroduction(
    introduction(child.id, { texture: "mashed" })
  );
  entries.createReaction(reaction(child.id, { occurredAt: T0 + DAY }));
  const history = database.entries.listForChild(child.id);
  const associationsFor = (entryId: string) =>
    database.entries.associationsFor(entryId);
  const appleStatus = deriveFoodStatus(
    "apple",
    history,
    associationsFor,
    null,
    T0
  );
  assert.deepEqual(appleStatus, foods.statusFor(child.id, "apple", T0));
  assert.equal(appleStatus.status, "trying");
  foods.markSafe(child.id, "apple", T0);
  assert.deepEqual(
    deriveFoodStatus(
      "apple",
      history,
      associationsFor,
      database.foods.manualSafeMarker(child.id, "apple"),
      T0
    ),
    foods.statusFor(child.id, "apple", T0)
  );
  assert.deepEqual(
    deriveFoodStatus("apple", history, associationsFor, null, T0 + DAY),
    foods.statusFor(child.id, "apple", T0 + DAY)
  );
  const peanut = foods.getFood("peanut")!;
  const target = deriveFoodStatus("peanut", history, associationsFor, null, T0);
  assert.deepEqual(introductionHeadsUpsFrom(peanut, target, [appleStatus]), [
    { kind: "first-allergen-food", foodId: "peanut" },
    { kind: "overlapping-introductions", foodId: "apple" },
  ]);
  assert.deepEqual(
    introductionHeadsUpsFrom(peanut, target, [appleStatus], { suppress: true }),
    []
  );
  assert.deepEqual(
    mealDraftFromIntroduction(intro, foods.getFood("apple")!, {
      textures: ["purée"],
      feedingStyles: [],
    }),
    entries.mealDraftForIntroduction(intro.id)
  );
  assert.throws(
    () =>
      mealDraftFromIntroduction(intro, peanut, {
        textures: [],
        feedingStyles: [],
      }),
    FoodEntryValidationError
  );
  database.close();
});
