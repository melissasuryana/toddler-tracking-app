import assert from "node:assert/strict";
import { test } from "node:test";
import type { Food, FoodEntry } from "@keepsake/food-tracking";
import {
  filterFoodItems,
  introductionHistoryForFood,
} from "../app/src/components/foodBrowser.ts";

const apple: Food = {
  id: "apple",
  name: "Apple",
  category: "fruit",
  allergenTags: [],
  source: "seed",
};
const customFood: Food = {
  id: "lentil-loaf",
  name: "Lentil loaf",
  category: "proteins",
  allergenTags: ["soy"],
  source: "custom",
};

function introduction(
  id: string,
  occurredAt: number,
  foodId = "apple"
): Extract<FoodEntry, { kind: "introduction" }> {
  return {
    id,
    childId: "child",
    kind: "introduction",
    occurredAt,
    occurredTz: "UTC",
    createdAt: occurredAt,
    updatedAt: occurredAt,
    deletedAt: null,
    isSeed: false,
    content: { foodId },
  };
}

test("Food browser filters seeded and custom Foods by supplied status, query, and source", () => {
  const items = [
    { food: apple, status: "trying" as const },
    { food: customFood, status: "untried" as const },
  ];
  assert.deepEqual(
    filterFoodItems(items, {
      query: " fruit ",
      status: "all",
      source: "all",
    }).map(({ food }) => food.id),
    ["apple"]
  );
  assert.deepEqual(
    filterFoodItems(items, {
      query: "soy",
      status: "untried",
      source: "custom",
    }).map(({ food }) => food.id),
    ["lentil-loaf"]
  );
  assert.deepEqual(
    filterFoodItems(items, {
      query: "",
      status: "safe",
      source: "all",
    }),
    []
  );
});

test("Food detail history contains only live Introductions for that Food up to now", () => {
  const entries: FoodEntry[] = [
    introduction("old", 10),
    introduction("new", 20),
    introduction("other-food", 30, "pear"),
    introduction("future", 50),
    {
      id: "reaction",
      childId: "child",
      kind: "reaction",
      occurredAt: 35,
      occurredTz: "UTC",
      createdAt: 35,
      updatedAt: 35,
      deletedAt: null,
      isSeed: false,
      content: { foodIds: ["apple"], severity: "mild", symptoms: [] },
    },
  ];
  assert.deepEqual(
    introductionHistoryForFood(entries, "apple", 40).map((entry) => entry.id),
    ["new", "old"]
  );
});
