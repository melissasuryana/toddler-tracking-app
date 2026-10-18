import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  getIcon,
  icons,
  renderIconSprite,
  renderIconSvg,
  type IconName,
} from "../index.ts";

/** Source design doc, so the icon set can't silently drift from it. */
const directionHtml = readFileSync(
  join(process.cwd(), "docs/design/design-directions.html"),
  "utf8"
);

const EXPECTED: readonly IconName[] = [
  "feed",
  "diaper",
  "sleep",
  "meal",
  "introduction",
  "medical",
  "reaction",
  "growth",
  "now",
  "timeline",
  "foods",
  "settings",
  "check",
  "search",
];

test("the set covers the eight Entry kinds, four tabs, and UI glyphs", () => {
  assert.deepEqual(icons.map((icon) => icon.name).sort(), [...EXPECTED].sort());
  assert.equal(EXPECTED.length, 14);
});

test("icon names are unique and on the shared 24px grid", () => {
  const names = new Set<IconName>();
  for (const icon of icons) {
    assert.ok(!names.has(icon.name), `duplicate icon ${icon.name}`);
    names.add(icon.name);
    assert.equal(icon.viewBox, "0 0 24 24");
  }
});

test("icons are stroke-only: no fills, colors, or emoji", () => {
  for (const icon of icons) {
    assert.doesNotMatch(icon.body, /fill=/i, `${icon.name} sets fill`);
    assert.doesNotMatch(
      icon.body,
      /#[0-9a-f]{3,8}/i,
      `${icon.name} hardcodes a color`
    );
    // eslint-disable-next-line no-control-regex
    assert.doesNotMatch(
      icon.body,
      /[^\x00-\x7F]/,
      `${icon.name} has non-ASCII`
    );
  }
});

test("every icon body matches the sprite in the design direction document", () => {
  const compact = (markup: string) =>
    markup.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
  const html = compact(directionHtml);
  for (const icon of icons) {
    assert.ok(
      html.includes(compact(icon.body)),
      `${icon.name} body not found in docs/design/design-directions.html`
    );
  }
});

test("getIcon throws for unknown names", () => {
  assert.throws(() => getIcon("nope" as IconName), /Unknown Keepsake icon/);
  assert.equal(getIcon("feed").name, "feed");
});

test("renderIconSvg draws with currentColor stroke and no fill", () => {
  const svg = renderIconSvg("check");
  assert.match(svg, /^<svg /);
  assert.match(svg, /stroke="currentColor"/);
  assert.match(svg, /fill="none"/);
  assert.match(svg, /stroke-width="1\.7"/);
  assert.match(svg, /<path d="M5 12\.5l4\.5 4\.5L19 7\.5" \/>/);
});

test("renderIconSprite emits one namespaced symbol per icon", () => {
  const sprite = renderIconSprite();
  assert.equal((sprite.match(/<symbol /g) ?? []).length, EXPECTED.length);
  for (const name of EXPECTED) {
    assert.match(sprite, new RegExp(`id="keepsake-i-${name}"`));
  }
  assert.match(sprite, /aria-hidden="true"/);
});
