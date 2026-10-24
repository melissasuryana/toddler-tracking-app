# toddler-tracking-app

A local-first mobile app for tracking a toddler's daily routine (Expo / React
Native + TypeScript). See `CONTEXT.md` for the domain vocabulary and
`docs/adr/` for decisions.

## Layout

npm workspaces: `app/` is the Expo app (expo-router, Keepsake theme), and
`packages/*` are deep modules (see `packages/README.md`):

- `packages/design-system` — Keepsake (Direction D) tokens + stroke icons.
- `packages/food-tracking` — Food catalogue, deterministic status, and watch rules.
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

## Dependency health

The existing Husky pre-commit hook runs `npm run check:dependencies` before
formatting, typechecking, tests, and the Jev gate. The check uses the Git index
(not unstaged edits), comparing root, app, and `packages/*` manifests and resolved
direct dependencies against HEAD. Stage the updated `package-lock.json` with
dependency changes. Unchanged dependencies and internal workspace links are
excluded; lockfile-only direct version changes are included.

New or changed production, development, optional, and peer dependencies must:

- Exist on the public npm registry at the locked version, with matching integrity.
- Have a non-deprecated selected version and latest release.
- Have a latest release published within the last 365 days.
- Have at least 100 npm downloads during the last month.
- Have no non-withdrawn OSV advisories for the selected version.

These are conservative screening thresholds, not guarantees of quality.
Registry, download, or advisory lookup failures block the commit with an error;
retry when connectivity returns. No credentials are needed, and requests send
only package names and versions, not source code. Git/URL/local external
dependencies need a published npm alternative. Only direct dependencies are
screened; retain normal lockfile/transitive vulnerability review.

**Code review:** for each new or updated dependency, cite dated registry,
upstream repository/release history, security policy/advisories, and download
evidence. Confirm the name is the intended upstream package (including aliases),
the repository is active and not archived, releases are regular, reported
vulnerabilities receive timely patches, and the selected version includes those
patches. Treat unavailable security-response history as unverified rather than
proof of safety. Review transitive changes in the lockfile as well.

A stable, low-download, or private package may require an exception. Record
the failed signal, evidence, rationale, and maintainer approval in the review
before deliberately using Git's `--no-verify` escape hatch (which bypasses all
hooks). There is no automatic offline pass or persistent allowlist.
