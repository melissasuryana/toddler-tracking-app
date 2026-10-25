import assert from "node:assert/strict";
import { test } from "node:test";
import {
  localDateTime,
  resolveEntryTimestamp,
  timestampOptions,
} from "../app/src/components/entryTimestamp.ts";
import {
  EMPTY_FOOD_DRAFTS,
  foodDraftsReducer,
} from "../app/src/components/foodDrafts.ts";

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

test("switching away and reopening keeps the existing independent draft identities", () => {
  const meal = foodDraftsReducer(EMPTY_FOOD_DRAFTS, {
    type: "open",
    kind: "meal",
  });
  const intro = foodDraftsReducer(meal, { type: "open", kind: "introduction" });
  const reopened = foodDraftsReducer(intro, { type: "open", kind: "meal" });
  assert.equal(reopened.revisions, meal.revisions);
  assert.deepEqual(reopened.started, ["meal", "introduction"]);
  assert.deepEqual(EMPTY_FOOD_DRAFTS.started, []);
});

test("saving one kind never resets another unsaved draft", () => {
  const all = ["meal", "introduction", "reaction"] as const;
  let state = EMPTY_FOOD_DRAFTS;
  for (const kind of all)
    state = foodDraftsReducer(state, { type: "open", kind });
  for (const kind of all) {
    const saved = foodDraftsReducer(state, { type: "saved", kind });
    assert.deepEqual(
      saved.started,
      all.filter((item) => item !== kind)
    );
    assert.equal(saved.revisions[kind], state.revisions[kind] + 1);
    for (const other of all.filter((item) => item !== kind)) {
      assert.equal(saved.revisions[other], state.revisions[other]);
    }
  }
});

test("contextual Introduction and Reaction selections stay isolated", () => {
  const intro = foodDraftsReducer(EMPTY_FOOD_DRAFTS, {
    type: "open",
    kind: "introduction",
    foodId: "egg",
  });
  const reaction = foodDraftsReducer(intro, {
    type: "open",
    kind: "reaction",
    foodId: "peanut",
  });
  assert.deepEqual(reaction.contextualFoods, {
    introduction: "egg",
    reaction: "peanut",
  });
  const saved = foodDraftsReducer(reaction, {
    type: "saved",
    kind: "reaction",
  });
  assert.equal(saved.contextualFoods.introduction, "egg");
  assert.equal(saved.contextualFoods.reaction, undefined);
  assert.equal(saved.revisions.introduction, intro.revisions.introduction);
  const reopened = foodDraftsReducer(reaction, {
    type: "open",
    kind: "reaction",
    foodId: "peanut",
  });
  assert.equal(reopened.revisions, reaction.revisions);
});

test("Meal shortcut starts an independent draft with exact timestamp and explicit texture clear", () => {
  const draft = {
    childId: "child",
    occurredAt: 1_763_004_600_123,
    occurredTz: "America/New_York",
    amount: 4,
    categories: ["proteins"] as const,
    allergenTags: ["egg"] as const,
    textures: [],
    feedingStyles: [],
  };
  let state = foodDraftsReducer(EMPTY_FOOD_DRAFTS, {
    type: "open",
    kind: "introduction",
    foodId: "egg",
  });

  test("shortcut from an existing Introduction preserves an unrelated unsaved Introduction draft", () => {
    const state = foodDraftsReducer(EMPTY_FOOD_DRAFTS, {
      type: "open",
      kind: "introduction",
      foodId: "egg",
    });
    const draft = {
      childId: "child",
      occurredAt: 1_763_004_600_123,
      occurredTz: "UTC",
      amount: 4,
      categories: [],
      allergenTags: [],
      textures: [],
      feedingStyles: [],
    };
    const shortcut = foodDraftsReducer(state, {
      type: "meal-shortcut",
      draft,
      preserveIntroductionDraft: true,
    });
    assert.ok(shortcut.started.includes("introduction"));
    assert.equal(shortcut.revisions.introduction, state.revisions.introduction);
    assert.equal(shortcut.contextualFoods, state.contextualFoods);
    assert.equal(shortcut.contextualFoods.introduction, "egg");
    assert.equal(shortcut.mealPrefill, draft);
  });
  state = foodDraftsReducer(state, {
    type: "open",
    kind: "reaction",
    foodId: "peanut",
  });
  const shortcut = foodDraftsReducer(state, { type: "meal-shortcut", draft });
  assert.deepEqual(shortcut.started, ["reaction", "meal"]);
  assert.equal(shortcut.mealPrefill, draft);
  assert.equal(shortcut.mealPrefill?.occurredAt, draft.occurredAt);
  assert.deepEqual(shortcut.mealPrefill?.textures, []);
  assert.equal(
    shortcut.revisions.introduction,
    state.revisions.introduction + 1
  );
  assert.equal(shortcut.revisions.meal, state.revisions.meal + 1);
  assert.equal(shortcut.revisions.reaction, state.revisions.reaction);
  const switched = foodDraftsReducer(shortcut, {
    type: "open",
    kind: "introduction",
  });
  assert.equal(switched.mealPrefill, draft);
  const saved = foodDraftsReducer(switched, { type: "saved", kind: "meal" });
  assert.equal(saved.mealPrefill, undefined);
  assert.ok(saved.started.includes("introduction"));
});
