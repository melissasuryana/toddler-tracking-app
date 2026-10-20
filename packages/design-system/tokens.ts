/**
 * Keepsake design tokens — Direction D of docs/design/design-directions.html
 * (the merged pick: Ledger's ruled grid + Bloom's garden palette and serif
 * voice). Day values come from the Palette swatch grid and the `.d-*` rules
 * (lines 1474-2202); night values from `.d-screen.night …` (lines 1816-2253).
 */

export type ThemeName = "day" | "night";

export interface ColorToken {
  /** Stable token name, e.g. "accent". */
  readonly name: string;
  /** Human label from the design doc, e.g. "Terracotta". */
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

/** Tracker keys for the eight Entry kinds. */
export type TrackerKey =
  | "feed"
  | "diaper"
  | "sleep"
  | "meal"
  | "introduction"
  | "medical"
  | "reaction"
  | "growth";

/** Food Status keys (CONTEXT.md). */
export type StatusKey = "safe" | "trying" | "untried" | "avoid";

/** One icon-disc tint: the disc fill plus the glyph color drawn on it. */
export interface DiscTint {
  readonly background: string;
  readonly foreground: string;
}

/** Pill / selection-chip tint: fill, border, and text colors. */
export interface PillTint {
  readonly background: string;
  readonly border: string;
  readonly foreground: string;
}

export interface ColorTokens {
  readonly paper: string;
  readonly sheet: string;
  readonly ink: string;
  readonly meta: string;
  readonly ruleStrong: string;
  readonly ruleThin: string;
  readonly chipBorder: string;
  readonly accent: string;
  readonly accentInk: string;
  readonly accentSoft: string;
  readonly accentWash: string;
  readonly accentChip: PillTint;
  readonly accentWashInk: string;
  readonly danger: string;
  readonly dangerInk: string;
  readonly dangerSoft: string;
  readonly dangerWash: string;
  readonly sleepBand: string;
  readonly sleepInk: string;
  readonly safeChip: PillTint;
  readonly tracker: Record<TrackerKey, DiscTint>;
  readonly status: Record<StatusKey, PillTint>;
}

/**
 * Day palette. Bases from the swatch grid (Paper #FBF6EE, Umber #33302A,
 * Terracotta #C96F4A, Sage Wash #EEF2E8, Sage #D9E4D0, Butter #F6E3C2,
 * Rain #DCEBF2, Clay #B4552E); the rest are the working colors used by the
 * ten direction screens.
 */
export const day: ColorTokens = {
  paper: "#FBF6EE",
  sheet: "#FFFDF8",
  ink: "#33302A",
  meta: "#8B8375",
  ruleStrong: "#33302A",
  ruleThin: "#E9DFCD",
  chipBorder: "#E5D9C4",
  accent: "#C96F4A",
  accentInk: "#8A5A3D",
  accentSoft: "#E8A582",
  accentWash: "#FDF1E7",
  accentChip: {
    background: "#F3E3D3",
    border: "#D8B794",
    foreground: "#8A5A3D",
  },
  accentWashInk: "#A5775C",
  danger: "#B4552E",
  dangerInk: "#8A4526",
  dangerSoft: "#E07B52",
  dangerWash: "#F3DDD4",
  sleepBand: "#EEF2E8",
  sleepInk: "#55694E",
  safeChip: {
    background: "#D9E4D0",
    border: "#A9C19D",
    foreground: "#4C6A43",
  },
  tracker: {
    feed: { background: "#F6E3C2", foreground: "#A4741F" },
    diaper: { background: "#DCEBF2", foreground: "#4A7B96" },
    sleep: { background: "#DCEBF2", foreground: "#4A7B96" },
    meal: { background: "#D9E4D0", foreground: "#55694E" },
    introduction: { background: "#D9E4D0", foreground: "#55694E" },
    medical: { background: "#EEDDE8", foreground: "#9A5C80" },
    reaction: { background: "#F3DDD4", foreground: "#B4552E" },
    growth: { background: "#DCEBF2", foreground: "#4A7B96" },
  },
  status: {
    safe: { background: "#E3EDDC", border: "#A9C19D", foreground: "#4C6A43" },
    trying: {
      background: "#FDF1E7",
      border: "#D8B794",
      foreground: "#C96F4A",
    },
    untried: {
      background: "#EFE9DC",
      border: "#D8D0BD",
      // Doc glyph is #9A917E on the same wash; #6F675A is the doc's body-copy
      // umber, promoted so the smallest pill in the app clears 3:1.
      foreground: "#6F675A",
    },
    avoid: { background: "#F3DDD4", border: "#CF9B85", foreground: "#B4552E" },
  },
};

/**
 * Night palette — the 3am surface: paper dims to deep umber, discs mute to
 * tonal versions, terracotta softens to #E8A582. No glare.
 */
export const night: ColorTokens = {
  paper: "#24211C",
  sheet: "#2B2721",
  ink: "#F0E9DA",
  meta: "#9A917E",
  ruleStrong: "#F0E9DA",
  ruleThin: "#3D382F",
  chipBorder: "#4A4438",
  accent: "#E8A582",
  accentInk: "#D9B598",
  accentSoft: "#E8A582",
  accentWash: "#332418",
  accentChip: {
    background: "#453526",
    border: "#6B4A38",
    foreground: "#D9B598",
  },
  accentWashInk: "#B08A6F",
  danger: "#E07B52",
  dangerInk: "#E07B52",
  dangerSoft: "#E07B52",
  dangerWash: "#332418",
  sleepBand: "#2E2A22",
  sleepInk: "#A9B39B",
  safeChip: {
    background: "#3F4A37",
    border: "#6B7A58",
    foreground: "#C8D4B8",
  },
  tracker: {
    feed: { background: "#3D3626", foreground: "#E0C98F" },
    diaper: { background: "#2C3A40", foreground: "#8FB8CC" },
    sleep: { background: "#2C3A40", foreground: "#8FB8CC" },
    meal: { background: "#333A2C", foreground: "#A9B39B" },
    introduction: { background: "#333A2C", foreground: "#A9B39B" },
    medical: { background: "#3D3238", foreground: "#C49AB4" },
    reaction: { background: "#332418", foreground: "#E07B52" },
    growth: { background: "#2C3A40", foreground: "#8FB8CC" },
  },
  status: {
    safe: { background: "#3F4A37", border: "#6B7A58", foreground: "#C8D4B8" },
    trying: {
      background: "#332418",
      border: "#6B4A38",
      foreground: "#E8A582",
    },
    untried: {
      background: "#2B2721",
      border: "#4A4438",
      foreground: "#9A917E",
    },
    avoid: { background: "#332418", border: "#6B4A38", foreground: "#E07B52" },
  },
};

export const themes: Record<ThemeName, ColorTokens> = { day, night };

export interface TypographyTokens {
  /**
   * Serif voice: display headings, data figures, italic timestamps.
   * Maps to New York on iOS without bundling fonts.
   */
  readonly serifStack: string;
  /** Sans workhorse: labels, rows, buttons. */
  readonly sansStack: string;
  readonly display: { readonly fontSize: number; readonly fontWeight: number };
  readonly sheetTitle: {
    readonly fontSize: number;
    readonly fontWeight: number;
  };
  /** Body copy and ledger rows — the document's working body size. */
  readonly body: { readonly fontSize: number; readonly fontWeight: number };
  readonly dataFigure: {
    readonly fontSize: number;
    readonly fontWeight: number;
    readonly fontVariantNumeric: "tabular-nums";
  };
  readonly meta: {
    readonly fontSize: number;
    readonly fontWeight: number;
    readonly letterSpacingEm: number;
    readonly textTransform: "uppercase";
  };
}

export const typography: TypographyTokens = {
  serifStack:
    '"Iowan Old Style", Palatino, "Palatino Linotype", ui-serif, Georgia, serif',
  sansStack: '"Avenir Next", Avenir, "Segoe UI", Roboto, sans-serif',
  display: { fontSize: 26, fontWeight: 500 },
  sheetTitle: { fontSize: 21, fontWeight: 500 },
  body: { fontSize: 15, fontWeight: 400 },
  dataFigure: {
    fontSize: 32,
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
  },
  meta: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacingEm: 0.12,
    textTransform: "uppercase",
  },
};

/** Spacing scale in px. `page` is the strict page margin everything aligns to. */
export const space = {
  page: 18,
  rowGap: 12,
  rowBlock: 10,
  sheetBlock: 14,
} as const;

/** Radius in px. Circles for discs and pills; radius lives on buttons, never on rows. */
export const radius = {
  pill: 999,
} as const;

/** Hairline rule widths — the Ledger bones. */
export const rule = {
  hairline: 1,
  /** Top rule of the Watch band — the one alert surface. */
  alert: 2,
} as const;
