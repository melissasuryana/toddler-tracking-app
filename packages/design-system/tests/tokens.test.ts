import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  day,
  night,
  radius,
  rule,
  space,
  themes,
  typography,
  type ColorTokens,
} from "../index.ts";

const HEX = /^#[0-9A-F]{6}$/;

/** Source of the design direction, for cross-checking the recorded tokens. */
const directionHtml = readFileSync(
  join(process.cwd(), "docs/design/design-directions.html"),
  "utf8"
);

const BASE_TOKENS: readonly (keyof ColorTokens)[] = [
  "paper",
  "sheet",
  "ink",
  "meta",
  "ruleStrong",
  "ruleThin",
  "chipBorder",
  "accent",
  "accentInk",
  "accentSoft",
  "accentWash",
  "accentWashInk",
  "danger",
  "dangerInk",
  "dangerSoft",
  "dangerWash",
  "sleepBand",
  "sleepInk",
];

const TRACKERS = [
  "feed",
  "diaper",
  "sleep",
  "meal",
  "introduction",
  "medical",
  "reaction",
  "growth",
] as const;

const STATUSES = ["safe", "trying", "untried", "avoid"] as const;

function collectHexes(colors: ColorTokens): string[] {
  const hexes = BASE_TOKENS.map((token) => colors[token] as string);
  for (const key of TRACKERS) {
    hexes.push(colors.tracker[key].background, colors.tracker[key].foreground);
  }
  for (const key of STATUSES) {
    hexes.push(
      colors.status[key].background,
      colors.status[key].border,
      colors.status[key].foreground
    );
  }
  hexes.push(
    colors.accentChip.background,
    colors.accentChip.border,
    colors.accentChip.foreground,
    colors.safeChip.background,
    colors.safeChip.border,
    colors.safeChip.foreground
  );
  return hexes;
}

test("every color token is an uppercase 6-digit hex value", () => {
  for (const theme of Object.values(themes)) {
    for (const hex of collectHexes(theme)) {
      assert.match(hex, HEX, `not a hex color: ${hex}`);
    }
  }
});

test("day and night themes carry the same token shape", () => {
  assert.deepEqual(Object.keys(night).sort(), Object.keys(day).sort());
  for (const key of TRACKERS) {
    assert.ok(night.tracker[key], `night missing tracker ${key}`);
  }
  for (const key of STATUSES) {
    assert.ok(night.status[key], `night missing status ${key}`);
  }
});

test("the eight Entry kinds each have an icon-disc tint", () => {
  assert.deepEqual(Object.keys(day.tracker).sort(), [...TRACKERS].sort());
  assert.deepEqual(Object.keys(night.tracker).sort(), [...TRACKERS].sort());
});

test("the four Food Statuses each have a pill tint", () => {
  assert.deepEqual(Object.keys(day.status).sort(), [...STATUSES].sort());
  assert.deepEqual(Object.keys(night.status).sort(), [...STATUSES].sort());
});

test("signature day values match the Keepsake palette in the design doc", () => {
  // Palette swatch grid, docs/design/design-directions.html #dir-d.
  assert.equal(day.paper, "#FBF6EE");
  assert.equal(day.ink, "#33302A");
  assert.equal(day.accent, "#C96F4A");
  assert.equal(day.sleepBand, "#EEF2E8");
  assert.equal(day.danger, "#B4552E");
  assert.equal(day.tracker.feed.background, "#F6E3C2"); // Butter
  assert.equal(day.tracker.diaper.background, "#DCEBF2"); // Rain
  assert.equal(day.tracker.meal.background, "#D9E4D0"); // Sage
});

test("every recorded token value appears in the design direction document", () => {
  const html = directionHtml.toLowerCase();
  for (const theme of Object.values(themes)) {
    for (const hex of collectHexes(theme)) {
      if (DOCUMENTED_OVERRIDES.has(hex)) continue;
      assert.ok(
        html.includes(hex.toLowerCase()),
        `${hex} is not used anywhere in docs/design/design-directions.html`
      );
    }
  }
});

/**
 * The one deliberate departure from the doc's rendered colors: the untried
 * pill glyph darkens #9A917E → #6F675A (both doc colors) so the smallest pill
 * clears 3:1. See tokens.ts and the contrast budget test.
 */
const DOCUMENTED_OVERRIDES = new Set(["#6F675A"]);

test("night mode dims paper to umber and softens the accent", () => {
  assert.equal(night.paper, "#24211C");
  assert.equal(night.sheet, "#2B2721");
  assert.equal(night.accent, "#E8A582");
  assert.equal(night.danger, "#E07B52");
  assert.notEqual(night.paper, day.paper);
  for (const key of TRACKERS) {
    assert.notEqual(
      night.tracker[key].background,
      day.tracker[key].background,
      `tracker ${key} disc should mute at night`
    );
  }
});

test("Ledger bones: hairline rules, radius on pills only, 18px page margin", () => {
  assert.equal(rule.hairline, 1);
  assert.equal(rule.alert, 2);
  assert.equal(radius.pill, 999);
  assert.equal(space.page, 18);
});

test("typography keeps the serif/sans system stacks and documented scale", () => {
  assert.match(typography.serifStack, /Iowan Old Style/);
  assert.match(typography.sansStack, /Avenir Next/);
  assert.equal(typography.display.fontSize, 26);
  assert.equal(typography.sheetTitle.fontSize, 21);
  assert.equal(typography.dataFigure.fontSize, 32);
  assert.equal(typography.dataFigure.fontVariantNumeric, "tabular-nums");
  assert.equal(typography.meta.fontSize, 10);
  assert.equal(typography.meta.textTransform, "uppercase");
});
