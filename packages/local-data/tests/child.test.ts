/**
 * Child validation rules (issue #43): name required, birthdate required and
 * nonfuture, sex required — the gate before any logging UI is reachable.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isIsoDate,
  todayIsoDate,
  uuidv7,
  validateChildInput,
} from "../index.ts";

const TODAY = "2026-10-20";

test("a complete Child input validates and trims the name", () => {
  const result = validateChildInput(
    { name: "  Ada  ", birthdate: "2024-03-01", sex: "female" },
    TODAY
  );
  assert.ok(result.ok);
  assert.deepEqual(result.value, {
    name: "Ada",
    birthdate: "2024-03-01",
    sex: "female",
    photo: null,
  });
});

test("name is required", () => {
  for (const name of ["", "   "]) {
    const result = validateChildInput(
      { name, birthdate: "2024-03-01", sex: "female" },
      TODAY
    );
    assert.ok(!result.ok);
    assert.deepEqual(
      result.errors.map((error) => error.field),
      ["name"]
    );
  }
});

test("birthdate is required", () => {
  const result = validateChildInput(
    { name: "Ada", birthdate: "", sex: "female" },
    TODAY
  );
  assert.ok(!result.ok);
  assert.equal(result.errors[0]?.field, "birthdate");
});

test("birthdate must be a real ISO calendar date", () => {
  for (const birthdate of ["2024-13-01", "2024-02-30", "01-03-2024", "soon"]) {
    const result = validateChildInput(
      { name: "Ada", birthdate, sex: "male" },
      TODAY
    );
    assert.ok(!result.ok, `expected ${birthdate} to fail`);
    assert.equal(result.errors[0]?.field, "birthdate");
  }
  assert.equal(isIsoDate("2024-02-29"), true); // leap day is real
  assert.equal(isIsoDate("2025-02-29"), false);
});

test("birthdate must be nonfuture; today is allowed", () => {
  const future = validateChildInput(
    { name: "Ada", birthdate: "2026-10-21", sex: "female" },
    TODAY
  );
  assert.ok(!future.ok);
  assert.match(future.errors[0]?.message ?? "", /future/);
  const bornToday = validateChildInput(
    { name: "Ada", birthdate: TODAY, sex: "female" },
    TODAY
  );
  assert.ok(bornToday.ok);
});

test("sex is required (needed later for growth charts)", () => {
  const result = validateChildInput(
    // @ts-expect-error - deliberately missing/invalid sex
    { name: "Ada", birthdate: "2024-03-01", sex: undefined },
    TODAY
  );
  assert.ok(!result.ok);
  assert.deepEqual(
    result.errors.map((error) => error.field),
    ["sex"]
  );
});

test("photo is optional and defaults to null", () => {
  const withPhoto = validateChildInput(
    {
      name: "Ada",
      birthdate: "2024-03-01",
      sex: "female",
      photo: "photos/ada.jpg",
    },
    TODAY
  );
  assert.ok(withPhoto.ok);
  assert.equal(withPhoto.value.photo, "photos/ada.jpg");
});

test("uuidv7 produces RFC 9562 shape with version 7 and time ordering", () => {
  const id = uuidv7();
  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  const later = uuidv7();
  assert.ok(id <= later, "uuids should sort by creation time");
});

test("todayIsoDate returns YYYY-MM-DD", () => {
  assert.match(todayIsoDate(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(todayIsoDate(new Date("2026-10-20T09:42:00Z")), "2026-10-20");
});
