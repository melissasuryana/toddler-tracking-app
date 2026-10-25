import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  localDateTime,
  resolveEntryTimestamp,
  timestampOptions,
} from "../app/src/components/entryTimestamp.ts";

test("untouched Meal and food timestamps preserve exact instant, including DST folds", () => {
  for (const occurredAt of [
    Date.parse("2026-11-01T05:30:27.123Z"),
    Date.parse("2026-11-01T06:30:59.987Z"),
  ]) {
    const original = { occurredAt, occurredTz: "America/New_York" };
    const local = localDateTime(occurredAt, original.occurredTz);
    assert.deepEqual(
      resolveEntryTimestamp(original, false, local.date, local.time),
      {
        ok: true,
        ...original,
      }
    );
  }
});

test("editing a backdate resolves local time and requires an explicit DST occurrence", () => {
  const original = {
    occurredAt: Date.parse("2025-11-02T05:30:42.999Z"),
    occurredTz: "America/New_York",
  };
  assert.equal(
    resolveEntryTimestamp(original, true, "2025-11-02", "01:30").ok,
    false
  );
  const options = timestampOptions("2025-11-02T01:30", original.occurredTz);
  assert.equal(options.length, 2);
  assert.deepEqual(
    options.map((option) => option.ok && option.occurredAt),
    [Date.parse("2025-11-02T05:30:00Z"), Date.parse("2025-11-02T06:30:00Z")]
  );
  const edited = resolveEntryTimestamp(
    original,
    true,
    "2025-11-02",
    "01:30",
    -300
  );
  assert.equal(
    edited.ok && edited.occurredAt,
    Date.parse("2025-11-02T06:30:00Z")
  );
});

test("edited nonexistent local times are rejected", () => {
  const original = { occurredAt: 1, occurredTz: "America/New_York" };
  assert.equal(
    resolveEntryTimestamp(original, true, "2025-03-09", "02:30").ok,
    false
  );
  assert.equal(
    timestampOptions("2025-03-09T02:30", original.occurredTz).length,
    0
  );
});

const source = (name: string) =>
  readFileSync(
    new URL(`../app/src/components/${name}.tsx`, import.meta.url),
    "utf8"
  );

test("Meal and Introduction drafts remain independently mounted across tab switches", () => {
  const logging = source("FoodLogging");
  assert.match(logging, /key=\{`meal-\$\{mealDraft\}`\}/);
  assert.match(logging, /key=\{`introduction-\$\{introductionDraft\}`\}/);
  assert.match(logging, /display: !editing && tab === "meal"/);
  assert.match(logging, /display: !editing && tab === "introduction"/);
  assert.match(logging, /onCancel=\{\(\) => setVisible\(false\)\}/);
  assert.match(logging, /prefilledTimestamp=\{mealPrefill\}/);
});

test("Reaction severity precedes the bounded, trying-first Food picker", () => {
  const form = source("FoodEntryForm");
  assert.ok(
    form.indexOf("Severity · required") <
      form.indexOf('accessibilityLabel="Search Foods"')
  );
  assert.match(form, /data\.reactionFoods\(childId\)/);
  assert.match(form, /nestedScrollEnabled/);
  assert.match(
    form,
    /if \(!severity\) throw new Error\("Choose a severity\."\)/
  );
  assert.match(form, /REACTION_SYMPTOMS\.map/);
});

test("irreversible deletion is explicit and keeping an entry only dismisses confirmation", () => {
  const form = source("FoodEntryForm");
  assert.match(form, /This can’t be undone/);
  assert.match(
    form,
    /label="Keep it"\s+selected=\{false\}\s+onPress=\{\(\) => setConfirmDelete\(false\)\}/
  );
  assert.match(form, /label="Delete permanently"/);
  assert.match(form, /data\.deleteFoodEntry\(entry\.id\)/);
});

test("both form kinds use exact-until-edited timestamps immediately before Save", () => {
  const meal = source("MealForm");
  const food = source("FoodEntryForm");
  assert.match(meal, /resolveEntryTimestamp\(/);
  assert.match(food, /resolveEntryTimestamp\(/);
  assert.ok(
    meal.indexOf('<FieldLabel label="When"') < meal.indexOf("onPress={save}")
  );
  assert.ok(food.indexOf("<MetaLabel>When") < food.indexOf("onPress={save}"));
});
