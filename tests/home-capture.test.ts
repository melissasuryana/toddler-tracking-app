import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { openDatabase } from "@keepsake/local-data";
import { RoutineEntries, normalizeRoutineContent } from "@keepsake/routine";
import {
  FoodEntries,
  FoodTracking,
  MealEntries,
} from "@keepsake/food-tracking";
import { openTestDriver } from "./fixtures/sqlite.ts";
import {
  routineDraft,
  routineInput,
} from "../app/src/components/routineDraft.ts";
import {
  entrySummary,
  latestEntries,
  type LoggedEntry,
} from "../app/src/components/entryPresentation.ts";
import {
  localDateTime,
  resolveEntryTimestamp,
} from "../app/src/components/entryTimestamp.ts";

const AT = Date.parse("2024-11-03T06:30:59.987Z");
const WHEN = { occurredAt: AT, occurredTz: "America/New_York" };

test("Home's five routine form drafts round-trip every field without changing recorded instants", () => {
  const database = openDatabase(openTestDriver());
  try {
    const child = database.children.create({
      name: "Ada",
      birthdate: "2023-01-01",
      sex: "female",
    });
    const routine = new RoutineEntries(database);
    const cases = [
      { kind: "feed", side: "right", durationSeconds: 90 },
      { kind: "diaper_change", change: "both", note: "Changed" },
      {
        kind: "medical",
        category: "medication",
        name: "Medicine",
        dose: "5 ml",
        note: "After food",
      },
      { kind: "medical", category: "vaccine", name: "Vaccine", note: "Done" },
      {
        kind: "medical",
        category: "symptom",
        description: "Cough",
        note: "Morning",
      },
      {
        kind: "medical",
        category: "temperature",
        value: 99.5,
        unit: "F",
        note: "Check",
      },
      {
        kind: "growth",
        weightKg: 10.2,
        heightCm: 80,
        headCircumferenceCm: 45.4,
      },
      {
        kind: "sleep_session",
        startAt: AT - 3_600_123,
        quality: "poor",
        factors: ["illness", "custom factor"],
      },
    ] as const;
    for (const content of cases) {
      const entry = routine.create({ childId: child.id, ...WHEN, ...content });
      const draft = routineDraft(entry);
      const local = localDateTime(entry.occurredAt, entry.occurredTz);
      const timestamp = resolveEntryTimestamp(
        entry,
        false,
        local.date,
        local.time
      );
      assert.ok(timestamp.ok);
      const input = routineInput(
        child.id,
        entry.kind,
        timestamp,
        draft,
        entry.kind === "sleep_session" ? entry.content.startAt : undefined
      );
      assert.deepEqual(normalizeRoutineContent(input), entry.content);
      const updated = routine.update(entry.id, input);
      assert.ok(updated);
      assert.equal(updated.id, entry.id);
      assert.equal(updated.childId, entry.childId);
      assert.equal(updated.createdAt, entry.createdAt);
      assert.equal(updated.occurredAt, AT);
      assert.equal(updated.occurredTz, WHEN.occurredTz);
      assert.ok(updated.updatedAt > entry.updatedAt);
    }
  } finally {
    database.close();
  }
});

test("routine drafts require explicit Sleep quality and valid numbers while preserving optional clears", () => {
  const draft = routineDraft();
  assert.throws(
    () => routineInput("child", "sleep_session", WHEN, draft, AT - 60_000),
    /quality/
  );
  assert.throws(
    () =>
      routineInput("child", "medical", WHEN, {
        ...draft,
        category: "temperature",
      }),
    /temperature/
  );
  assert.throws(
    () =>
      routineInput("child", "growth", WHEN, {
        ...draft,
        weightKg: "not a number",
      }),
    /number/
  );
  assert.deepEqual(routineInput("child", "feed", WHEN, draft), {
    childId: "child",
    kind: "feed",
    ...WHEN,
    side: undefined,
    durationSeconds: undefined,
  });
  assert.throws(
    () => normalizeRoutineContent(routineInput("child", "growth", WHEN, draft)),
    /measurement/
  );
});

test("all eight Home Entry kinds persist offline, edit with stable identity, and scrub through public boundaries", () => {
  const path = `.home-capture-${randomUUID()}.sqlite`;
  let database = openDatabase(openTestDriver(path));
  try {
    const child = database.children.create({
      name: "Ada",
      birthdate: "2023-01-01",
      sex: "female",
    });
    const routine = new RoutineEntries(database);
    const meals = new MealEntries(database);
    const foodEntries = new FoodEntries(database);
    const common = { childId: child.id, ...WHEN };
    const originals: LoggedEntry[] = [
      routine.create({ ...common, kind: "feed" }),
      routine.create({ ...common, kind: "diaper_change", change: "wet" }),
      routine.create({
        ...common,
        kind: "sleep_session",
        startAt: AT - 3_600_000,
        quality: "great",
      }),
      routine.create({
        ...common,
        kind: "medical",
        category: "symptom",
        description: "Cough",
      }),
      routine.create({ ...common, kind: "growth", weightKg: 10 }),
      meals.create({
        ...common,
        amount: 4,
        name: "Lunch",
        categories: [],
        allergenTags: [],
        textures: [],
        feedingStyles: [],
      }),
      foodEntries.createIntroduction({ ...common, foodId: "apple" }),
      foodEntries.createReaction({
        ...common,
        foodIds: ["egg"],
        severity: "mild",
      }),
    ];
    database.close();
    database = openDatabase(openTestDriver(path));
    const restoredRoutine = new RoutineEntries(database);
    const restoredMeals = new MealEntries(database);
    const restoredFoods = new FoodEntries(database);
    const restored = latestEntries(
      [
        ...restoredRoutine.listForChild(child.id),
        ...restoredMeals.listForChild(child.id),
        ...restoredFoods.listForChild(child.id),
      ],
      child.id
    );
    assert.equal(restored.length, 8);
    for (const original of originals) {
      const entry = restored.find((item) => item.id === original.id)!;
      assert.deepEqual({ ...entry, isSeed: Boolean(entry.isSeed) }, original);
      let updated: LoggedEntry | null;
      if (entry.kind === "meal")
        updated = restoredMeals.update(entry.id, {
          ...entry,
          ...entry.content,
          note: "Edited",
        });
      else if (entry.kind === "introduction")
        updated = restoredFoods.updateIntroduction(entry.id, {
          ...entry,
          ...entry.content,
          note: "Edited",
        });
      else if (entry.kind === "reaction")
        updated = restoredFoods.updateReaction(entry.id, {
          ...entry,
          ...entry.content,
          note: "Edited",
        });
      else
        updated = restoredRoutine.update(
          entry.id,
          routineInput(
            child.id,
            entry.kind,
            entry,
            routineDraft(entry),
            entry.kind === "sleep_session" ? entry.content.startAt : undefined
          )
        );
      assert.ok(updated);
      assert.equal(updated.id, original.id);
      assert.equal(updated.childId, original.childId);
      assert.equal(updated.createdAt, original.createdAt);
      assert.equal(updated.occurredAt, original.occurredAt);
      assert.ok(updated.updatedAt > original.updatedAt);
      const remove =
        entry.kind === "meal"
          ? () => restoredMeals.delete(entry.id)
          : entry.kind === "introduction" || entry.kind === "reaction"
            ? () => restoredFoods.delete(entry.id)
            : () => restoredRoutine.delete(entry.id);
      assert.equal(remove(), true);
      assert.equal(database.entries.get(entry.id), null);
      assert.equal(database.entries.contentFor(entry.id), null);
    }
    assert.deepEqual(restoredRoutine.listForChild(child.id), []);
    assert.deepEqual(restoredMeals.listForChild(child.id), []);
    assert.deepEqual(restoredFoods.listForChild(child.id), []);
    assert.deepEqual(restoredMeals.nameSuggestions(child.id, ""), []);
  } finally {
    database.close();
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(path + suffix, { force: true });
  }
});

test("Wake corrections are atomic, retain timer on invalid save, and warn rather than block overlap", () => {
  const database = openDatabase(openTestDriver());
  try {
    const child = database.children.create({
      name: "Ada",
      birthdate: "2023-01-01",
      sex: "female",
    });
    const routine = new RoutineEntries(database, () => AT + 3_600_000);
    routine.create({
      childId: child.id,
      ...WHEN,
      kind: "sleep_session",
      startAt: AT - 3_600_000,
      quality: "okay",
    });
    const timer = routine.startSleepTimer({
      childId: child.id,
      startedAt: AT - 1_800_000,
      startedTz: WHEN.occurredTz,
    });
    assert.throws(
      () =>
        routine.stopSleepTimer(child.id, {
          startAt: AT + 1,
          endedAt: AT,
          quality: "poor",
        }),
      /after/
    );
    assert.deepEqual(
      new RoutineEntries(database).getSleepTimer(child.id),
      timer
    );
    assert.equal(routine.listForChild(child.id).length, 1);
    const entry = routine.stopSleepTimer(child.id, {
      startAt: AT - 3_000_123,
      endedAt: AT + 60_987,
      quality: "poor",
      factors: ["many wakeups"],
    });
    assert.equal(entry.kind, "sleep_session");
    if (entry.kind !== "sleep_session") return;
    assert.equal(entry.content.startAt, AT - 3_000_123);
    assert.equal(entry.occurredAt, AT + 60_987);
    assert.deepEqual(entry.content.factors, ["many wakeups"]);
    assert.equal(
      routine.hasSleepSessionOverlap(
        child.id,
        entry.content.startAt,
        entry.occurredAt,
        entry.id
      ),
      true
    );
    assert.equal(routine.getSleepTimer(child.id), null);
  } finally {
    database.close();
  }
});

test("Latest uses occurrence order, isolates Child, excludes Deleted content, and displays Meal names", () => {
  const database = openDatabase(openTestDriver());
  try {
    const first = database.children.create({
      name: "Ada",
      birthdate: "2023-01-01",
      sex: "female",
    });
    const second = database.children.create({
      name: "Grace",
      birthdate: "2023-01-01",
      sex: "female",
    });
    const routine = new RoutineEntries(database);
    const older = routine.create({ childId: first.id, ...WHEN, kind: "feed" });
    const newer = routine.create({
      childId: first.id,
      ...WHEN,
      occurredAt: AT + 100,
      kind: "diaper_change",
      change: "dirty",
    });
    const other = routine.create({
      childId: second.id,
      ...WHEN,
      occurredAt: AT + 200,
      kind: "feed",
    });
    const deleted = {
      ...older,
      id: "deleted",
      deletedAt: AT + 300,
      occurredAt: AT + 500,
    };
    assert.deepEqual(
      latestEntries([older, deleted, other, newer], first.id).map(
        (entry) => entry.id
      ),
      [newer.id, older.id]
    );
    const meals = new MealEntries(database);
    const meal = meals.create({
      childId: first.id,
      ...WHEN,
      amount: 4,
      name: "Oats",
      categories: [],
      allergenTags: [],
    });
    assert.equal(entrySummary(meal), "Oats · 4/5");
    const unnamed = meals.update(meal.id, {
      ...meal,
      ...meal.content,
      name: "",
    })!;
    assert.equal(entrySummary(unnamed), "Meal · 4/5");
  } finally {
    database.close();
  }
});

test("Watch Card mark-safe and contextual Reaction remain per Food and derive again after deletion", () => {
  const database = openDatabase(openTestDriver());
  try {
    const child = database.children.create({
      name: "Ada",
      birthdate: "2023-01-01",
      sex: "female",
    });
    const entries = new FoodEntries(database);
    const tracking = new FoodTracking(database);
    entries.createIntroduction({ childId: child.id, ...WHEN, foodId: "apple" });
    assert.equal(
      tracking.statusFor(child.id, "apple", AT + 1).status,
      "trying"
    );
    assert.equal(tracking.markSafe(child.id, "apple", AT + 1)?.status, "safe");
    const reaction = entries.createReaction({
      childId: child.id,
      ...WHEN,
      occurredAt: AT + 2,
      foodIds: ["apple"],
      severity: "moderate",
    });
    assert.equal(tracking.statusFor(child.id, "apple", AT + 3).status, "avoid");
    assert.equal(tracking.statusFor(child.id, "egg", AT + 3).status, "untried");
    entries.delete(reaction.id);
    assert.equal(
      tracking.statusFor(child.id, "apple", AT + 3).status,
      "trying"
    );
  } finally {
    database.close();
  }
});
