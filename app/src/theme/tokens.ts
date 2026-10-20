/**
 * Keepsake theme resolution — the pure core of the app-side theme adapter
 * from docs/adr/0005-keepsake-native-styling.md. Owns ONLY resolution and
 * lookup helpers: every value flows through from @keepsake/design-system
 * tokens; this file adds no token values of its own.
 */
import {
  radius,
  rule,
  space,
  themes,
  typography,
  type ColorTokens,
  type DiscTint,
  type PillTint,
  type StatusKey,
  type ThemeName,
  type TrackerKey,
  type TypographyTokens,
} from "@keepsake/design-system";

export type { ThemeName } from "@keepsake/design-system";

/** What a screen can ask the theme for. */
export interface Theme {
  readonly name: ThemeName;
  readonly colors: ColorTokens;
  readonly typography: TypographyTokens;
  readonly space: typeof space;
  readonly rule: typeof rule;
  readonly radius: typeof radius;
  /** Icon-disc tint for one Entry kind (tracker disc). */
  readonly discTint: (tracker: TrackerKey) => DiscTint;
  /** Pill tint for one Food Status. */
  readonly statusPillTint: (status: StatusKey) => PillTint;
}

/** React Native font stacks have no CSS fallback lists; the serif voice maps
 *  to the platform serif (New York on iOS) exactly as the token intends. */
const SERIF_FONT = "Georgia";
const SANS_FONT = undefined; // RN default sans (San Francisco / Roboto)

export interface NativeFonts {
  readonly serif: string;
  readonly sans: string | undefined;
}

export const nativeFonts: NativeFonts = { serif: SERIF_FONT, sans: SANS_FONT };

/**
 * Resolves a `ThemeName` to the full token lookup. `useColorScheme()`'s
 * null/unspecified resolves to day — the ledger's resting state.
 */
export function resolveTheme(
  scheme: "light" | "dark" | null | undefined
): Theme {
  const name: ThemeName = scheme === "dark" ? "night" : "day";
  const colors = themes[name];
  return {
    name,
    colors,
    typography,
    space,
    rule,
    radius,
    discTint: (tracker) => colors.tracker[tracker],
    statusPillTint: (status) => colors.status[status],
  };
}
