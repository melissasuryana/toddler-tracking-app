import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "@keepsake/local-data";
import {
  resolveLocalTimestamp,
  RoutineEntries,
  RoutineValidationError,
  type RoutineEntry,
} from "../index.ts";
import { openTestDriver } from "./helpers.ts";

const NOW = Date.parse("2024-11-03T12:00:00Z");
const RECORDED_AT = Date.parse("2024-11-02T10:00:00Z");

function assertTemperatureUnit(
  entry: RoutineEntry | null,
  unit: "C" | "F"
): void {
  assert.ok(
    entry &&
      entry.kind === "medical" &&
      entry.content.category === "temperature"
  );
  assert.equal(entry.content.unit, unit);
}

function setup() {
  const database = openDatabase(openTestDriver());
  const child = database.children.create({
    name: "Ada",
    birthdate: "2023-03-01",
    sex: "female",
  });
  return {
    database,
    child,
    entries: new RoutineEntries(database, () => NOW),
  };
}

test("routine entries create, query, update, and scrub through public packages", () => {
  const { database, child, entries } = setup();
  const feed = entries.create({
    childId: child.id,
    kind: "feed",
    occurredAt: RECORDED_AT,
    occurredTz: "America/Los_Angeles",
    side: "left",
    durationSeconds: 180,
  });
  assert.equal(feed.kind, "feed");
  assert.deepEqual(feed.content, { side: "left", durationSeconds: 180 });
  assert.equal(entries.get(feed.id)?.id, feed.id);
  assert.equal(entries.listForChild(child.id).length, 1);
  const diaper = entries.create({
    childId: child.id,
    kind: "diaper_change",
    change: "both",
    note: "  changed  ",
    occurredAt: RECORDED_AT - 2_000,
    occurredTz: "America/Los_Angeles",
  });
  assert.deepEqual(diaper.content, { change: "both", note: "changed" });
  assert.deepEqual(
    entries.listForChild(child.id).map(({ id }) => id),
    [feed.id, diaper.id]
  );

  const updated = entries.update(feed.id, {
    childId: child.id,
    kind: "feed",
    occurredAt: RECORDED_AT - 3_000,
    occurredTz: "America/Los_Angeles",
    side: "right",
  });
  assert.ok(updated);
  assert.equal(updated.id, feed.id);
  assert.equal(updated.childId, feed.childId);
  assert.equal(updated.createdAt, feed.createdAt);
  assert.equal(updated.occurredTz, feed.occurredTz);
  assert.ok(updated.updatedAt > feed.updatedAt);
  assert.deepEqual(updated.content, { side: "right" });
  assert.throws(
    () =>
      entries.update(feed.id, {
        childId: child.id,
        kind: "feed",
        occurredAt: RECORDED_AT - 2_000,
        occurredTz: "UTC",
      }),
    RoutineValidationError
  );
  assert.deepEqual(
    entries.listForChild(child.id).map(({ id }) => id),
    [diaper.id, feed.id]
  );

  assert.equal(entries.delete(feed.id), true);
  assert.equal(entries.get(feed.id), null);
  assert.equal(database.entries.contentFor(feed.id), null);
  assert.equal(entries.delete(feed.id), false);
  database.close();
});

test("sleep, Medical, and Growth entries enforce required domain values", () => {
  const { database, child, entries } = setup();
  assert.throws(
    () =>
      entries.create({
        childId: child.id,
        kind: "sleep_session",
        occurredAt: RECORDED_AT,
        occurredTz: "UTC",
        startAt: RECORDED_AT,
        quality: "okay",
      }),
    RoutineValidationError
  );
  const sleep = entries.create({
    childId: child.id,
    kind: "sleep_session",
    occurredAt: RECORDED_AT + 3_600_000,
    occurredTz: "UTC",
    startAt: RECORDED_AT,
    quality: "poor",
    factors: ["caregiver factor", "illness"],
  });
  assert.deepEqual(sleep.content, {
    startAt: RECORDED_AT,
    quality: "poor",
    factors: ["caregiver factor", "illness"],
  });

  assert.throws(
    () =>
      entries.create({
        childId: child.id,
        kind: "medical",
        category: "vaccine",
        name: "  ",
        occurredAt: RECORDED_AT,
        occurredTz: "UTC",
      }),
    RoutineValidationError
  );
  const temperature = entries.create({
    childId: child.id,
    kind: "medical",
    category: "temperature",
    value: 37.5,
    unit: "C",
    occurredAt: RECORDED_AT,
    occurredTz: "UTC",
  });
  assert.deepEqual(temperature.content, {
    category: "temperature",
    value: 37.5,
    unit: "C",
  });

  assert.throws(
    () =>
      entries.create({
        childId: child.id,
        kind: "growth",
        weightKg: 0,
        occurredAt: RECORDED_AT,
        occurredTz: "UTC",
      }),
    RoutineValidationError
  );
  const growth = entries.create({
    childId: child.id,
    kind: "growth",
    heightCm: 89.2,
    occurredAt: RECORDED_AT,
    occurredTz: "UTC",
  });
  assert.deepEqual(growth.content, { heightCm: 89.2 });
  database.close();
});

test("routine validation rejects future and malformed timestamps", () => {
  const { database, child, entries } = setup();
  assert.throws(
    () =>
      entries.create({
        childId: child.id,
        kind: "diaper_change",
        change: "wet",
        occurredAt: NOW + 1,
        occurredTz: "UTC",
      }),
    RoutineValidationError
  );
  assert.throws(
    () =>
      entries.create({
        childId: child.id,
        kind: "growth",
        weightKg: Number.NaN,
        occurredAt: RECORDED_AT,
        occurredTz: "UTC",
      }),
    RoutineValidationError
  );
  database.close();
});

test("routine summaries and recorded-day groups re-derive after timestamp edits", () => {
  const { database, child, entries } = setup();
  const first = entries.create({
    childId: child.id,
    kind: "feed",
    occurredAt: Date.parse("2024-11-02T23:59:00Z"),
    occurredTz: "UTC",
  });
  const second = entries.create({
    childId: child.id,
    kind: "diaper_change",
    change: "wet",
    occurredAt: Date.parse("2024-11-03T00:01:00Z"),
    occurredTz: "UTC",
  });
  assert.equal(entries.feedCountForChild(child.id), 1);
  assert.deepEqual(
    entries
      .groupForChildByRecordedDay(child.id)
      .map(({ localDate }) => localDate),
    ["2024-11-03", "2024-11-02"]
  );

  entries.update(first.id, {
    childId: child.id,
    kind: "feed",
    occurredAt: Date.parse("2024-11-03T00:02:00Z"),
    occurredTz: "UTC",
  });
  assert.equal(entries.latestEntriesForChild(child.id).feed?.id, first.id);
  assert.deepEqual(
    entries
      .groupForChildByRecordedDay(child.id)
      .map(({ localDate, entries }) => [localDate, entries.length]),
    [["2024-11-03", 2]]
  );
  assert.equal(
    entries.latestEntriesForChild(child.id).diaper_change?.id,
    second.id
  );
  database.close();
});

test("temperature defaults follow Settings without rewriting history; name suggestions are live and Child-scoped", () => {
  const { database, child, entries } = setup();
  const firstTemperature = entries.create({
    childId: child.id,
    kind: "medical",
    category: "temperature",
    value: 37,
    occurredAt: RECORDED_AT,
    occurredTz: "UTC",
  });
  assertTemperatureUnit(firstTemperature, "C");

  database.preferences.set("temperatureUnit", "F");
  const secondTemperature = entries.create({
    childId: child.id,
    kind: "medical",
    category: "temperature",
    value: 98.6,
    occurredAt: RECORDED_AT,
    occurredTz: "UTC",
  });
  assertTemperatureUnit(secondTemperature, "F");
  const editedTemperature = entries.update(firstTemperature.id, {
    childId: child.id,
    kind: "medical",
    category: "temperature",
    value: 36.8,
    occurredAt: RECORDED_AT,
    occurredTz: "UTC",
  });
  assertTemperatureUnit(editedTemperature, "C");

  const medicine = entries.create({
    childId: child.id,
    kind: "medical",
    category: "medication",
    name: "  Acetaminophen ",
    occurredAt: RECORDED_AT,
    occurredTz: "UTC",
  });
  entries.create({
    childId: child.id,
    kind: "medical",
    category: "vaccine",
    name: "Acetaminophen",
    occurredAt: RECORDED_AT,
    occurredTz: "UTC",
  });
  assert.deepEqual(entries.medicalNameSuggestions(child.id, "medication"), [
    "Acetaminophen",
  ]);
  assert.equal(entries.delete(medicine.id), true);
  assert.deepEqual(entries.medicalNameSuggestions(child.id, "medication"), []);
  database.close();
});

test("local timestamp resolution rejects DST gaps and disambiguates repeated times by offset", () => {
  const gap = resolveLocalTimestamp(
    "2024-03-10T02:30",
    "America/New_York",
    undefined,
    NOW
  );
  assert.equal(gap.ok, false);

  const ambiguous = resolveLocalTimestamp(
    "2024-11-03T01:30",
    "America/New_York",
    undefined,
    NOW
  );
  assert.equal(ambiguous.ok, false);
  if (ambiguous.ok) return;
  assert.match(ambiguous.error, /offset/);

  const daylight = resolveLocalTimestamp(
    "2024-11-03T01:30",
    "America/New_York",
    -240,
    NOW
  );
  const standard = resolveLocalTimestamp(
    "2024-11-03T01:30",
    "America/New_York",
    -300,
    NOW
  );
  assert.equal(daylight.ok, true);
  assert.equal(standard.ok, true);
  if (!daylight.ok || !standard.ok) return;
  assert.equal(standard.occurredAt - daylight.occurredAt, 3_600_000);
  assert.equal(daylight.utcOffsetMinutes, -240);

  const future = resolveLocalTimestamp(
    "2024-12-01T01:30",
    "America/New_York",
    undefined,
    NOW
  );
  assert.equal(future.ok, false);
});
