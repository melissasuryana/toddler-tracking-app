# Token-only native styling: Keepsake day/night theming without a component library

Status: accepted

The MVP app (Expo / React Native + TypeScript, per the build-ready spec in issue #8) must implement the approved visual direction — **D — Keepsake** (Ledger grid × Bloom palette), `docs/design/design-directions.html` — whose tokens already live in `packages/design-system`. `buildKeepsakeCss` generates a CSS token sheet, but React Native has no CSS cascade and no CSS custom properties, so the generated sheet cannot drive native screens. Adding a native theming/component library (Tamagui, NativeWind, gluestack, …) was considered and rejected: the design system's public surface is deliberately token-level (color/typography tokens for day + night, spacing, radius, rule widths, the 14-icon stroke set), and adopting a library would either fork those tokens into a second source of truth or bury them under a theme format the design doc never promised.

Instead, the app composition package consumes `packages/design-system` tokens **directly as typed values** through the package's root entry points, and keeps a tiny app-side adapter (`ThemeProvider` + `useTheme()` hook) that resolves the active `ThemeName` (`"day" | "night"`, from the `useColorScheme()` system appearance, overridable in Settings) to a `ColorTokens`/`TypographyTokens` lookup. Icon rendering uses the design system's structured icon data (`icons`, `renderIconSvg`) via `react-native-svg`, exactly as the package header anticipates — no emoji in product UI.

## Consequences

- `packages/design-system` stays the single source of truth for Keepsake; `buildKeepsakeCss` remains the web/prototype surface, untouched.
- The app-side adapter owns *only* theme resolution and lookup helpers (disc tint per Entry kind, status pill tint per Food Status, spacing/radius/rule constants); it owns no new token values and no component library.
- Day/night switching is live: re-render on appearance change, no reload. Token additions land in `packages/design-system` and flow through the adapter unchanged.

## Considered Options

- **Adopt a native component/theming library (Tamagui, NativeWind, gluestack)** — rejected: second token source of truth, heavier dependency, and component defaults that fight the Ledger grid (hairline rules, no radius on rows) rather than help it.
- **Hand-copy token values into app code** — rejected: silent drift from `packages/design-system`; the tokens package exists precisely to be imported.
- **Generate a RN StyleSheet module from tokens at build time** — rejected: codegen step for a lookup a 30-line adapter provides; revisit only if the token surface grows past hand-mapping.

Recorded while breaking spec #8 into implementation tickets (#43–#54); ticket #43 (app shell) relies on this adapter.
