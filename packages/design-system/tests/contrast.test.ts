import assert from "node:assert/strict";
import { test } from "node:test";
import { day, night, type ColorTokens } from "../index.ts";

/**
 * Contrast budget for Keepsake. The design doc flags "pastel-on-paper needs
 * AA audit" as the direction's known risk, so these tests pin which pairings
 * pass and at which WCAG criterion:
 *  - AA_NORMAL (4.5:1) for body text and Food Status pills
 *  - AA_LARGE (3:1) for 24px+ serif figures, caps meta labels, and
 *    underlined action labels
 *  - AA_NON_TEXT (3:1) for icon glyphs on their discs
 */

/** WCAG 2.x relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (at) => parseInt(hex.slice(at, at + 2), 16) / 255
  );
  const [r, g, b] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;
const AA_NON_TEXT = 3.0;

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

function audit(fg: string, bg: string, min: number, pair: string): void {
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= min,
    `${pair}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, below ${min}:1`
  );
}

function auditTheme(colors: ColorTokens, theme: string): void {
  // Primary text on both page surfaces — full AA.
  audit(colors.ink, colors.paper, AA_NORMAL, `${theme} ink/paper`);
  audit(colors.ink, colors.sheet, AA_NORMAL, `${theme} ink/sheet`);
  // Meta text renders as 10px/600 caps or italic serif — budget large.
  audit(colors.meta, colors.paper, AA_LARGE, `${theme} meta/paper`);
  audit(colors.meta, colors.sheet, AA_LARGE, `${theme} meta/sheet`);
  audit(
    colors.sleepInk,
    colors.sleepBand,
    AA_NORMAL,
    `${theme} sleep ink/band`
  );
  audit(
    colors.accentWashInk,
    colors.accentWash,
    AA_LARGE,
    `${theme} watch meta/wash`
  );

  // Accent serves large serif italics and underlined 650-weight labels;
  // danger (clay) also headlines the delete sheet, so it budgets full AA.
  audit(colors.accent, colors.paper, AA_LARGE, `${theme} accent/paper`);
  audit(colors.danger, colors.paper, AA_NORMAL, `${theme} danger/paper`);

  // Icon glyphs on their discs are non-text UI.
  for (const key of TRACKERS) {
    audit(
      colors.tracker[key].foreground,
      colors.tracker[key].background,
      AA_NON_TEXT,
      `${theme} tracker ${key} disc`
    );
  }

  // Status pills are small uppercase text — the strictest pastel pairing.
  for (const key of STATUSES) {
    const pill = colors.status[key];
    const ratio = contrastRatio(pill.foreground, pill.background);
    const minimum = PILL_EXCEPTIONS.has(`${theme}:${key}`)
      ? AA_LARGE
      : AA_NORMAL;
    assert.ok(
      ratio >= minimum,
      `${theme} status ${key} pill: ${pill.foreground} on ${pill.background} ` +
        `is ${ratio.toFixed(2)}:1, below ${minimum}:1`
    );
  }
}

/**
 * Pills the design doc renders below AA normal text (all 9px/700 uppercase
 * with a tinted border, closer to large-text/bold criteria). Each entry is a
 * known-risk acknowledgement, not a pass to add more.
 */
const PILL_EXCEPTIONS = new Set(["day:trying", "day:avoid"]);

test("day palette meets its contrast budget", () => {
  auditTheme(day, "day");
});

test("night palette meets its contrast budget", () => {
  auditTheme(night, "night");
});

test("non-exception Food Status pills clear AA for normal text in both themes", () => {
  for (const [theme, colors] of [
    ["day", day],
    ["night", night],
  ] as const) {
    for (const key of STATUSES) {
      if (PILL_EXCEPTIONS.has(`${theme}:${key}`)) continue;
      audit(
        colors.status[key].foreground,
        colors.status[key].background,
        AA_NORMAL,
        `${theme} status ${key} pill`
      );
    }
  }
});

test("known risk: the pastel pairings still below AA normal text stay listed", () => {
  // Documents, rather than hides, the gaps the design doc calls out. If a
  // future token update fixes one, remove it here and the budget audits
  // above keep it from regressing.
  const belowAaText: [string, number][] = [
    ["day meta on paper", contrastRatio(day.meta, day.paper)],
    ["day meta on sheet", contrastRatio(day.meta, day.sheet)],
    [
      "day watch meta on wash",
      contrastRatio(day.accentWashInk, day.accentWash),
    ],
    ["day accent on paper", contrastRatio(day.accent, day.paper)],
    [
      "day trying pill",
      contrastRatio(day.status.trying.foreground, day.status.trying.background),
    ],
    [
      "day avoid pill",
      contrastRatio(day.status.avoid.foreground, day.status.avoid.background),
    ],
  ];
  for (const [label, ratio] of belowAaText) {
    assert.ok(
      ratio < AA_NORMAL,
      `${label} now passes AA normal (${ratio.toFixed(2)}:1) — remove it from the known-risk list`
    );
  }
});
