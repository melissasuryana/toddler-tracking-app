import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatKeepsakeTimestamp,
  localDateTime,
  resolveEntryTimestamp,
} from "../app/src/components/entryTimestamp.ts";

const MOCK_NOW = Date.parse("2026-10-28T14:30:00Z"); // 2026-10-28 in UTC

test("formatKeepsakeTimestamp standard style formats morning times as 'This morning, ...'", () => {
  const result = formatKeepsakeTimestamp(
    "2026-10-28",
    "09:41",
    "UTC",
    "standard",
    MOCK_NOW
  );
  assert.equal(result, "This morning, 9:41 AM");
});

test("formatKeepsakeTimestamp standard style formats afternoon times as 'Today, ...'", () => {
  const result = formatKeepsakeTimestamp(
    "2026-10-28",
    "14:15",
    "UTC",
    "standard",
    MOCK_NOW
  );
  assert.equal(result, "Today, 2:15 PM");
});

test("formatKeepsakeTimestamp standard style formats yesterday as 'Yesterday, ...'", () => {
  const result = formatKeepsakeTimestamp(
    "2026-10-27",
    "21:10",
    "UTC",
    "standard",
    MOCK_NOW
  );
  assert.equal(result, "Yesterday, 9:10 PM");
});

test("formatKeepsakeTimestamp standard style formats other dates in current year with month and day", () => {
  const result = formatKeepsakeTimestamp(
    "2026-10-12",
    "10:30",
    "UTC",
    "standard",
    MOCK_NOW
  );
  assert.equal(result, "Oct 12, 10:30 AM");
});

test("formatKeepsakeTimestamp standard style formats dates in different year with year included", () => {
  const result = formatKeepsakeTimestamp(
    "2025-05-04",
    "08:00",
    "UTC",
    "standard",
    MOCK_NOW
  );
  assert.equal(result, "May 4, 2025, 8:00 AM");
});

test("formatKeepsakeTimestamp sleep style formats today as '[time] (today)'", () => {
  const result = formatKeepsakeTimestamp(
    "2026-10-28",
    "06:58",
    "UTC",
    "sleep",
    MOCK_NOW
  );
  assert.equal(result, "6:58 AM (today)");
});

test("formatKeepsakeTimestamp sleep style formats yesterday as '[time] (yesterday)'", () => {
  const result = formatKeepsakeTimestamp(
    "2026-10-27",
    "20:42",
    "UTC",
    "sleep",
    MOCK_NOW
  );
  assert.equal(result, "8:42 PM (yesterday)");
});

test("formatKeepsakeTimestamp reaction style formats today as simple time string", () => {
  const result = formatKeepsakeTimestamp(
    "2026-10-28",
    "11:20",
    "UTC",
    "reaction",
    MOCK_NOW
  );
  assert.equal(result, "11:20 AM");
});
