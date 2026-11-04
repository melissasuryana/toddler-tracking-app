import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "@keepsake/local-data";
import { RoutineEntries } from "@keepsake/routine";
import {
  FoodEntries,
  FoodTracking,
  MealEntries,
} from "@keepsake/food-tracking";
import {
  entryDetailContext,
  entryDetailFields,
  entryDetailText,
  entryTime,
} from "../app/src/components/entryDetails.ts";
import type { LoggedEntry } from "../app/src/components/entryPresentation.ts";
import { openTestDriver } from "./fixtures/sqlite.ts";

const WHEN = {
  occurredAt: Date.parse("2024-11-03T06:30:59.987Z"),
  occurredTz: "America/New_York",
};

function setup() {
  const database = openDatabase(openTestDriver());
  const child = database.children.create({
    name: "Demo",
    birthdate: "2023-01-01",
    sex: "female",
  });
  return {
    database,
    common: { childId: child.id, ...WHEN },
    routine: new RoutineEntries(database),
    meals: new MealEntries(database),
    entries: new FoodEntries(database),
    foods: new FoodTracking(database).listFoods(),
  };
}

test("compact snapshots explicitly enumerate recorded fields for all eight Entry kinds", () => {
  const { database, common, routine, meals, entries, foods } = setup();
  try {
    const cases: readonly [LoggedEntry, readonly string[]][] = [
      [routine.create({ ...common, kind: "feed" }), ["Side", "Duration"]],
      [
        routine.create({ ...common, kind: "diaper_change", change: "wet" }),
        ["Change", "Note"],
      ],
      [
        routine.create({
          ...common,
          kind: "sleep_session",
          startAt: common.occurredAt - 3_600_000,
          quality: "great",
        }),
        ["Fell asleep", "Woke up", "Duration", "Quality", "Factors"],
      ],
      [
        routine.create({
          ...common,
          kind: "medical",
          category: "medication",
          name: "Vitamin D",
        }),
        ["Type", "Name", "Dose", "Note"],
      ],
      [
        routine.create({ ...common, kind: "growth", weightKg: 6.42 }),
        ["Weight", "Height", "Head circumference"],
      ],
      [
        meals.create(common),
        [
          "Meal name",
          "Amount eaten",
          "Food categories",
          "Allergens",
          "Texture",
          "Feeding style",
          "Note",
        ],
      ],
      [
        entries.createIntroduction({ ...common, foodId: "apple" }),
        ["Food", "Texture", "Note"],
      ],
      [
        entries.createReaction({
          ...common,
          foodIds: ["apple"],
          severity: "mild",
        }),
        ["Suspected foods", "Severity", "Symptoms", "Note"],
      ],
    ];
    for (const [entry, expected] of cases) {
      const fields = entryDetailFields(entry, foods);
      assert.deepEqual(
        fields.map((field) => field.label),
        expected,
        entry.kind
      );
      assert.equal(
        new Set(fields.map((field) => field.key)).size,
        fields.length
      );
      assert.deepEqual(
        fields.filter((field) => field.readOnly).map((field) => field.key),
        entry.kind === "sleep_session" ? ["duration"] : []
      );
    }
  } finally {
    database.close();
  }
});

test("missing scalar values and empty multi-selects stay distinguishable", () => {
  const { database, common, routine, meals, entries, foods } = setup();
  try {
    assert.equal(entryDetailText(null), "Not recorded");
    assert.equal(entryDetailText(""), "Not recorded");
    assert.equal(entryDetailText([]), "None recorded");
    assert.equal(
      entryDetailText(["Mashed", "Soft finger food"]),
      "Mashed, Soft finger food"
    );
    assert.deepEqual(
      entryDetailFields(routine.create({ ...common, kind: "feed" }), foods).map(
        (field) => field.value
      ),
      [null, null]
    );
    assert.deepEqual(
      entryDetailFields(meals.create(common), foods).map(
        (field) => field.value
      ),
      [null, "4 of 5", [], [], [], [], null]
    );
    assert.deepEqual(
      entryDetailFields(
        entries.createIntroduction({ ...common, foodId: "apple" }),
        foods
      ).map((field) => field.value),
      ["Apple", null, null]
    );
  } finally {
    database.close();
  }
});

test("Medical snapshots use subtype-specific labels and recorded temperature units", () => {
  const { database, common, routine, foods } = setup();
  try {
    const cases = [
      [
        { category: "medication", name: "Vitamin D", dose: "400 IU" },
        ["Medication", "Vitamin D", "400 IU", null],
      ],
      [{ category: "vaccine", name: "DTaP" }, ["Vaccine", "DTaP", null]],
      [
        { category: "symptom", description: "congestion" },
        ["Symptom", "congestion", null],
      ],
      [
        { category: "temperature", value: 99.5, unit: "F" },
        ["Temperature", "99.5 °F", null],
      ],
    ] as const;
    for (const [content, values] of cases) {
      const entry = routine.create({ ...common, kind: "medical", ...content });
      assert.deepEqual(
        entryDetailFields(entry, foods).map((field) => field.value),
        values
      );
    }
  } finally {
    database.close();
  }
});

test("snapshots resolve Food names, human units, and chips without exposing storage keys", () => {
  const { database, common, routine, entries, meals, foods } = setup();
  try {
    const feed = routine.create({
      ...common,
      kind: "feed",
      side: "right",
      durationSeconds: 90,
    });
    assert.deepEqual(
      entryDetailFields(feed, foods).map((field) => field.value),
      ["Right", "1.5 minutes"]
    );
    const growth = routine.create({
      ...common,
      kind: "growth",
      weightKg: 6.42,
      heightCm: 62.1,
      headCircumferenceCm: 40,
    });
    assert.deepEqual(
      entryDetailFields(growth, foods).map((field) => field.value),
      ["6.42 kg", "62.1 cm", "40 cm"]
    );
    const reaction = entries.createReaction({
      ...common,
      foodIds: ["apple", "banana"],
      severity: "moderate",
      symptoms: ["rash/hives"],
    });
    assert.deepEqual(
      entryDetailFields(reaction, foods).map((field) => field.value),
      [["Apple", "Banana"], "Moderate", ["Rash/hives"], null]
    );
    const meal = meals.create({
      ...common,
      name: "oat breakfast",
      categories: ["grains & cereals"],
      allergenTags: ["wheat"],
      textures: ["mashed"],
      feedingStyles: ["spoon-fed"],
      note: "ate slowly",
    });
    assert.deepEqual(
      entryDetailFields(meal, foods).map((field) => field.value),
      [
        "oat breakfast",
        "4 of 5",
        ["Grains & cereals"],
        ["Wheat"],
        ["Mashed"],
        ["Spoon-fed"],
        "ate slowly",
      ]
    );
  } finally {
    database.close();
  }
});

test("Sleep duration uses actual instants across DST and both times use the recorded timezone", () => {
  const { database, common, routine, foods } = setup();
  try {
    const entry = routine.create({
      ...common,
      kind: "sleep_session",
      startAt: common.occurredAt - 7_200_000,
      quality: "okay",
    });
    assert.ok(entry.kind === "sleep_session");
    const fields = entryDetailFields(entry, foods);
    assert.equal(
      fields[0]!.value,
      entryTime(entry.content.startAt, common.occurredTz)
    );
    assert.equal(
      fields[1]!.value,
      entryTime(entry.occurredAt, common.occurredTz)
    );
    assert.equal(fields[2]!.value, "2 hr 0 min");
    assert.equal(fields[2]!.readOnly, true);
    assert.deepEqual(fields[4]!.value, []);
  } finally {
    database.close();
  }
});

test("derived Food status stays separate from editable Entry fields", () => {
  const { database, common, entries, meals, foods } = setup();
  try {
    const intro = entries.createIntroduction({ ...common, foodId: "apple" });
    const reaction = entries.createReaction({
      ...common,
      foodIds: ["apple"],
      severity: "mild",
    });
    assert.match(entryDetailContext(intro)!, /derived/);
    assert.match(entryDetailContext(reaction)!, /not a diagnosis/);
    for (const entry of [intro, reaction]) {
      assert.ok(
        entryDetailFields(entry, foods).every(
          (field) => !/status|watch/i.test(field.key)
        )
      );
    }
    assert.equal(entryDetailContext(meals.create(common)), null);
  } finally {
    database.close();
  }
});
