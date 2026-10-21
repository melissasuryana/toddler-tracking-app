/**
 * Theme adapter resolution (ADR 0005): system appearance resolves day/night,
 * both palettes flow through unchanged, and the disc/pill tint helpers read
 * the design-system tracker/status tints for the active theme.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  day,
  night,
  radius,
  rule,
  size,
  space,
  typography,
} from "@keepsake/design-system";
import { resolveTheme } from "../app/src/theme/tokens.ts";

test("light or unknown system appearance resolves to day", () => {
  assert.equal(resolveTheme("light").name, "day");
  assert.equal(resolveTheme(null).name, "day");
  assert.equal(resolveTheme(undefined).name, "day");
});

test("dark system appearance resolves to night", () => {
  assert.equal(resolveTheme("dark").name, "night");
});

test("the adapter exposes the design-system token objects unchanged", () => {
  const theme = resolveTheme("dark");
  assert.equal(theme.colors, night, "night palette flows through by reference");
  assert.equal(resolveTheme("light").colors, day);
  assert.equal(theme.typography, typography);
  assert.equal(theme.space, space);
  assert.equal(theme.rule, rule);
  assert.equal(theme.radius, radius);
  assert.equal(theme.size, size);
});

test("discTint resolves the tracker disc tint per Entry kind and theme", () => {
  assert.equal(resolveTheme("light").discTint("feed"), day.tracker.feed);
  assert.equal(resolveTheme("dark").discTint("feed"), night.tracker.feed);
  assert.equal(resolveTheme("dark").discTint("medical"), night.tracker.medical);
  assert.notEqual(day.tracker.feed, night.tracker.feed);
});

test("statusPillTint resolves the Food Status pill tint per theme", () => {
  assert.equal(resolveTheme("light").statusPillTint("safe"), day.status.safe);
  assert.equal(
    resolveTheme("dark").statusPillTint("avoid"),
    night.status.avoid
  );
});
