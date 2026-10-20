# toddler-tracking-app

A local-first mobile app for tracking a toddler's daily routine (Expo / React
Native + TypeScript). See `CONTEXT.md` for the domain vocabulary and
`docs/adr/` for decisions.

## Layout

npm workspaces: `app/` is the Expo app (expo-router, Keepsake theme), and
`packages/*` are deep modules (see `packages/README.md`):

- `packages/design-system` — Keepsake (Direction D) tokens + stroke icons.
- `packages/local-data` — Child + preferences persistence on expo-sqlite +
  Drizzle, behind an injectable driver boundary (tests run on `node:sqlite`).

## Commands

- `npm install` — install all workspaces.
- `npm test` — Node's built-in test runner (`node --test`) over
  `packages/*/tests` and `tests/` (TypeScript via type stripping).
- `npm run typecheck` — `tsc --noEmit` for the packages/tests (root) and the
  app workspace.
- `npm run lint:boundaries` — dependency-cruiser deep-module rules over
  `packages` and `app/src`.
- `npm start` — start the Expo dev server (iOS target; `npm run ios`,
  `npm run android`, `npm run web` inside `app/`).
