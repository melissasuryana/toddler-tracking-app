/**
 * Generates the Keepsake token stylesheet: one CSS custom property per color
 * token under `:root` (day) and `[data-theme="night"]`, plus the small set of
 * helper classes the direction relies on (icon discs, status pills, tracker
 * disc tints). Components stay app-side; this sheet is the token layer the
 * handoff table in docs/design/design-directions.html promises.
 */
import {
  themes,
  typography,
  type ColorTokens,
  type StatusKey,
  type ThemeName,
  type TrackerKey,
} from "./tokens.ts";

/** Custom-property name for a color token, e.g. `--keepsake-accent`. */
export function tokenVarName(token: keyof ColorTokens): string {
  return `--keepsake-${kebab(String(token))}`;
}

/** Custom-property name for a tracker disc pair. */
export function trackerVarNames(tracker: TrackerKey): {
  background: string;
  foreground: string;
} {
  return {
    background: `--keepsake-tracker-${tracker}-bg`,
    foreground: `--keepsake-tracker-${tracker}-fg`,
  };
}

/** Custom-property names for a Food Status pill triple. */
export function statusVarNames(status: StatusKey): {
  background: string;
  border: string;
  foreground: string;
} {
  return {
    background: `--keepsake-status-${status}-bg`,
    border: `--keepsake-status-${status}-border`,
    foreground: `--keepsake-status-${status}-fg`,
  };
}

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
] as const satisfies readonly (keyof ColorTokens)[];

const TRACKER_KEYS = [
  "feed",
  "diaper",
  "sleep",
  "meal",
  "introduction",
  "medical",
  "reaction",
  "growth",
] as const satisfies readonly TrackerKey[];

const STATUS_KEYS = [
  "safe",
  "trying",
  "untried",
  "avoid",
] as const satisfies readonly StatusKey[];

function kebab(camel: string): string {
  return camel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function declarations(colors: ColorTokens, indent: string): string[] {
  const lines: string[] = [];
  const push = (name: string, value: string) =>
    lines.push(`${indent}${name}: ${value};`);

  for (const token of BASE_TOKENS) {
    push(tokenVarName(token), colors[token] as string);
  }
  push(`${tokenVarName("accentChip")}-bg`, colors.accentChip.background);
  push(`${tokenVarName("accentChip")}-border`, colors.accentChip.border);
  push(`${tokenVarName("accentChip")}-fg`, colors.accentChip.foreground);
  push(`${tokenVarName("safeChip")}-bg`, colors.safeChip.background);
  push(`${tokenVarName("safeChip")}-border`, colors.safeChip.border);
  push(`${tokenVarName("safeChip")}-fg`, colors.safeChip.foreground);
  for (const key of TRACKER_KEYS) {
    const vars = trackerVarNames(key);
    push(vars.background, colors.tracker[key].background);
    push(vars.foreground, colors.tracker[key].foreground);
  }
  for (const key of STATUS_KEYS) {
    const vars = statusVarNames(key);
    push(vars.background, colors.status[key].background);
    push(vars.border, colors.status[key].border);
    push(vars.foreground, colors.status[key].foreground);
  }
  return lines;
}

/**
 * The full Keepsake token stylesheet. `selector` defaults to `:root`; the
 * night theme is always emitted under `[data-theme="night"]`.
 */
export function buildKeepsakeCss(selector = ":root"): string {
  const out: string[] = [];
  const themeSelectors: Record<ThemeName, string> = {
    day: selector,
    night: `[data-theme="night"]`,
  };

  for (const name of Object.keys(themes) as ThemeName[]) {
    out.push(`${themeSelectors[name]} {`);
    out.push(...declarations(themes[name], "  "));
    out.push(`}`);
    out.push(``);
  }

  out.push(`${selector} {`);
  out.push(`  --keepsake-font-serif: ${typography.serifStack};`);
  out.push(`  --keepsake-font-sans: ${typography.sansStack};`);
  out.push(`}`);
  out.push(``);

  out.push(`.keepsake-icon-disc {`);
  out.push(`  display: inline-grid;`);
  out.push(`  place-items: center;`);
  out.push(`  border-radius: 50%;`);
  out.push(`  background: var(--keepsake-disc-bg, var(--keepsake-rule-thin));`);
  out.push(`  color: var(--keepsake-disc-fg, var(--keepsake-meta));`);
  out.push(`}`);
  out.push(``);

  out.push(`.keepsake-status-pill {`);
  out.push(`  display: inline-block;`);
  out.push(`  border-radius: 999px;`);
  out.push(`  border: 1px solid var(--keepsake-status-border);`);
  out.push(`  background: var(--keepsake-status-bg);`);
  out.push(`  color: var(--keepsake-status-fg);`);
  out.push(`}`);
  out.push(``);

  for (const key of TRACKER_KEYS) {
    const vars = trackerVarNames(key);
    out.push(`.keepsake-tracker-${key} {`);
    out.push(`  --keepsake-disc-bg: var(${vars.background});`);
    out.push(`  --keepsake-disc-fg: var(${vars.foreground});`);
    out.push(`}`);
    out.push(``);
  }

  for (const key of STATUS_KEYS) {
    const vars = statusVarNames(key);
    out.push(`.keepsake-status-${key} {`);
    out.push(`  --keepsake-status-bg: var(${vars.background});`);
    out.push(`  --keepsake-status-border: var(${vars.border});`);
    out.push(`  --keepsake-status-fg: var(${vars.foreground});`);
    out.push(`}`);
    out.push(``);
  }

  return `${out.join("\n").trimEnd()}\n`;
}
