import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  buildKeepsakeCss,
  day,
  night,
  statusVarNames,
  tokenVarName,
  trackerVarNames,
  typography,
} from "../index.ts";

const css = buildKeepsakeCss();

const BASE_TOKENS = [
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
] as const;

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

test("tokenVarName kebab-cases the token", () => {
  assert.equal(tokenVarName("accent"), "--keepsake-accent");
  assert.equal(tokenVarName("ruleStrong"), "--keepsake-rule-strong");
});

test("stylesheet declares every base token for both themes", () => {
  for (const token of BASE_TOKENS) {
    const name = tokenVarName(token);
    for (const colors of [day, night]) {
      assert.match(
        css,
        new RegExp(`${name}: ${colors[token]};`),
        `missing ${name} for a theme`
      );
    }
  }
});

test("stylesheet declares tracker and status vars for both themes", () => {
  for (const key of TRACKERS) {
    const vars = trackerVarNames(key);
    assert.match(
      css,
      new RegExp(`${vars.background}: ${day.tracker[key].background};`)
    );
    assert.match(
      css,
      new RegExp(`${vars.background}: ${night.tracker[key].background};`)
    );
  }
  for (const key of STATUSES) {
    const vars = statusVarNames(key);
    for (const colors of [day, night]) {
      assert.match(
        css,
        new RegExp(`${vars.background}: ${colors.status[key].background};`)
      );
      assert.match(
        css,
        new RegExp(`${vars.border}: ${colors.status[key].border};`)
      );
      assert.match(
        css,
        new RegExp(`${vars.foreground}: ${colors.status[key].foreground};`)
      );
    }
  }
});

test('night values live under [data-theme="night"] only', () => {
  const blocks = css.split(/\n\n/);
  const nightBlock = blocks.find((block) =>
    block.startsWith('[data-theme="night"]')
  );
  assert.ok(nightBlock, "no night block");
  assert.match(nightBlock, /--keepsake-paper: #24211C;/);
  const dayBlock = blocks.find((block) => block.startsWith(":root"));
  assert.ok(dayBlock, "no :root block");
  assert.match(dayBlock, /--keepsake-paper: #FBF6EE;/);
  assert.doesNotMatch(dayBlock, /#24211C/);
});

test("stylesheet exposes the font stacks and helper classes", () => {
  assert.match(
    css,
    new RegExp(`--keepsake-font-serif: ${typography.serifStack};`)
  );
  assert.match(css, /\.keepsake-icon-disc \{/);
  assert.match(css, /\.keepsake-status-pill \{/);
  for (const key of TRACKERS) {
    assert.match(css, new RegExp(`\\.keepsake-tracker-${key} \\{`));
  }
  for (const key of STATUSES) {
    assert.match(css, new RegExp(`\\.keepsake-status-${key} \\{`));
  }
});

test("stylesheet contains no url() references or comments", () => {
  assert.doesNotMatch(css, /url\(/);
  assert.doesNotMatch(css, /\/\*/);
});

test("custom selector replaces :root", () => {
  const scoped = buildKeepsakeCss(".app");
  assert.match(scoped, /^\.app \{/);
  assert.doesNotMatch(scoped, /:root/);
  assert.match(scoped, /\[data-theme="night"\] \{/);
});

test("stylesheet snapshot", (t: TestContext) => {
  t.assert.snapshot(css);
});
