import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyMealSuggestion,
  FoodTracking,
  MealEntries,
  MealValidationError,
} from "../index.ts";
import type { MealNameSuggestion, MealSuggestionFields } from "../index.ts";
import { openDatabase } from "@keepsake/local-data";
import { openTestDriver } from "./helpers.ts";

const T0 = 1_700_000_000_000;

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
  return { database, child, otherChild, meals: new MealEntries(database) };
}

function mealInput(
  childId: string,
  occurredAt = T0,
  extra: Partial<Parameters<MealEntries["create"]>[0]> = {}
) {
  return { childId, occurredAt, occurredTz: "UTC", ...extra };
}

test("new Meals default to amount four and normalize optional fields", () => {
  const { database, child, meals } = setup();
  const meal = meals.create(
    mealInput(child.id, T0, {
      name: "  Oatmeal and pear  ",
      note: "  Breakfast  ",
      categories: ["grains & cereals", "fruit", "fruit"],
      allergenTags: ["milk"],
      textures: ["mashed"],
      feedingStyles: ["spoon-fed"],
    })
  );

  assert.equal(meal.content.amount, 4);
  assert.equal(meal.content.name, "Oatmeal and pear");
  assert.equal(meal.content.note, "Breakfast");
  assert.deepEqual(meal.content.categories, ["grains & cereals", "fruit"]);
  assert.deepEqual(meal.content.allergenTags, ["milk"]);
  assert.deepEqual(meal.content.textures, ["mashed"]);
  assert.deepEqual(meal.content.feedingStyles, ["spoon-fed"]);
  assert.equal(meals.get(meal.id)?.content.name, "Oatmeal and pear");
  database.close();
});

test("Meals allow no name or flags and normalize whitespace-only optional text", () => {
  const { database, child, meals } = setup();
  const meal = meals.create(
    mealInput(child.id, T0, { name: "   ", note: "   " })
  );

  assert.equal(meal.content.name, undefined);
  assert.equal(meal.content.note, undefined);
  assert.deepEqual(meal.content.categories, []);
  assert.deepEqual(meal.content.allergenTags, []);
  assert.deepEqual(meal.content.textures, []);
  assert.deepEqual(meal.content.feedingStyles, []);
  database.close();
});

test("defaults follow the latest non-deleted Meal by occurrence then creation time", () => {
  const { database, child, meals } = setup();
  meals.create(
    mealInput(child.id, T0, {
      textures: ["purée"],
      feedingStyles: ["spoon-fed"],
    })
  );
  const latest = meals.create(
    mealInput(child.id, T0 + 1, {
      textures: ["firm finger food"],
      feedingStyles: ["self-fed with hands"],
    })
  );
  const tieBreak = meals.create(
    mealInput(child.id, T0 + 1, {
      textures: ["mashed"],
      feedingStyles: ["self-fed with utensils"],
    })
  );
  database.driver
    .prepareSync("UPDATE entries SET created_at = ? WHERE id = ?")
    .run(latest.createdAt + 100, tieBreak.id);
  assert.deepEqual(meals.defaultsForChild(child.id), {
    textures: ["mashed"],
    feedingStyles: ["self-fed with utensils"],
  });

  meals.delete(tieBreak.id);
  assert.deepEqual(meals.defaultsForChild(child.id), {
    textures: ["firm finger food"],
    feedingStyles: ["self-fed with hands"],
  });
  meals.delete(latest.id);
  assert.deepEqual(meals.defaultsForChild(child.id), {
    textures: ["purée"],
    feedingStyles: ["spoon-fed"],
  });
  assert.deepEqual(meals.defaultsForChild("unknown"), {
    textures: [],
    feedingStyles: [],
  });
  database.close();
});

test("Meal name suggestions are child-scoped, recent, substring-filtered, deduplicated, and capped", () => {
  const { database, child, otherChild, meals } = setup();
  const first = meals.create(
    mealInput(child.id, T0, {
      name: "Rice Bowl",
      categories: ["grains & cereals"],
      textures: ["soft finger food"],
      feedingStyles: ["self-fed with hands"],
    })
  );
  const newerDuplicate = meals.create(
    mealInput(child.id, T0 + 1, {
      name: "  rice bowl ",
      categories: ["compound"],
      allergenTags: ["egg"],
      textures: ["mashed"],
    })
  );
  for (let i = 0; i < 10; i += 1) {
    meals.create(mealInput(child.id, T0 + 2 + i, { name: `Meal ${i}` }));
  }
  meals.create(mealInput(otherChild.id, T0 + 100, { name: "Rice bowl" }));

  const allSuggestions = meals.nameSuggestions(child.id);
  assert.equal(allSuggestions.length, 10);
  assert.equal(allSuggestions[0]?.name, "Meal 9");

  const rice = meals.nameSuggestions(child.id, "BOWL");
  assert.equal(rice.length, 1);
  assert.equal(rice[0]?.name, "rice bowl");
  assert.deepEqual(rice[0]?.categories, ["compound"]);
  assert.deepEqual(rice[0]?.allergenTags, ["egg"]);
  assert.deepEqual(rice[0]?.textures, ["mashed"]);
  assert.deepEqual(rice[0]?.feedingStyles, []);

  meals.delete(newerDuplicate.id);
  assert.equal(meals.nameSuggestions(child.id, "bowl")[0]?.name, "Rice Bowl");
  assert.ok(meals.get(first.id));
  database.close();
});

test("explicit suggestion selection preserves edited and shortcut-prefilled fields", () => {
  const current: MealSuggestionFields & {
    readonly occurredOn: string;
    readonly occurredAt: string;
    readonly amount: number;
    readonly note: string;
  } = {
    categories: ["vegetables"],
    allergenTags: ["milk"],
    textures: [],
    feedingStyles: ["self-fed with hands"],
    occurredOn: "2024-01-01",
    occurredAt: "08:30",
    amount: 3,
    note: "Carefully edited",
  };
  const suggestion: MealNameSuggestion = {
    name: "Fruit bowl",
    categories: ["fruit"],
    allergenTags: ["egg"],
    textures: ["mashed"],
    feedingStyles: ["spoon-fed"],
  };

  assert.deepEqual(
    applyMealSuggestion(
      current,
      suggestion,
      new Set(["categories", "textures"])
    ),
    {
      categories: ["vegetables"],
      allergenTags: ["egg"],
      textures: [],
      feedingStyles: ["spoon-fed"],
      occurredOn: "2024-01-01",
      occurredAt: "08:30",
      amount: 3,
      note: "Carefully edited",
    }
  );
});

test("Meal edits preserve Entry identity and clear names without affecting Food Status", () => {
  const { database, child, meals } = setup();
  const foods = new FoodTracking(database);
  const created = meals.create(
    mealInput(child.id, T0, {
      amount: 2,
      name: "Toast",
      categories: ["grains & cereals"],
      allergenTags: ["peanut"],
    })
  );
  const updated = meals.update(
    created.id,
    mealInput(child.id, T0 + 5, {
      amount: 5,
      name: "  ",
      categories: [],
    })
  );

  assert.ok(updated);
  assert.equal(updated?.id, created.id);
  assert.equal(updated?.childId, created.childId);
  assert.equal(updated?.createdAt, created.createdAt);
  assert.ok((updated?.updatedAt ?? 0) > created.updatedAt);
  assert.equal(updated?.content.name, undefined);
  assert.equal(updated?.content.amount, 5);
  assert.equal(
    database.entries
      .listForChild(child.id)
      .filter((entry) => entry.kind === "meal").length,
    1
  );
  assert.equal(foods.statusFor(child.id, "peanut", T0 + 5).exposureCount, 0);
  assert.equal(foods.statusFor(child.id, "peanut", T0 + 5).status, "untried");
  database.close();
});

test("Meal validation enforces amount, name length, and supported flag values", () => {
  const { database, child, meals } = setup();
  assert.throws(
    () => meals.create(mealInput(child.id, T0, { amount: 0 })),
    MealValidationError
  );
  assert.throws(
    () => meals.create(mealInput(child.id, T0, { amount: 2.5 })),
    MealValidationError
  );
  assert.throws(
    () => meals.create(mealInput(child.id, T0, { name: "x".repeat(101) })),
    MealValidationError
  );
  assert.throws(
    () =>
      meals.create(
        mealInput(child.id, T0, { categories: ["invalid" as never] })
      ),
    MealValidationError
  );
  database.close();
});
