# toddler-tracking-app

A local-first mobile app for tracking a toddler's daily routine (Expo / React
Native + TypeScript). See `CONTEXT.md` for the domain vocabulary and
`docs/adr/` for decisions.

## Layout

npm workspaces: `app/` is the Expo app (expo-router, Keepsake theme), and
`packages/*` are deep modules (see `packages/README.md`):

- `packages/design-system` — Keepsake (Direction D) tokens + stroke icons.
- `packages/food-tracking` — Food catalogue, deterministic status, and watch rules.
- `packages/routine` — Routine Entry validation, persistence, and timestamp rules.
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
- In GitHub Codespaces, run `expo-web` to start the private browser preview on port 5000.

## Entry details

Opening any Entry from Home, the Ledger, or recent food Entries shows the compact
snapshot from `prototypes/entry-view-modes.html` (Variant C). Tap a recorded field
or timestamp to edit it in place, then save or cancel that field's changes.
Missing optional values remain visible as "Not recorded"; empty selections show
"None recorded". There is no separate Edit button or editing screen.
Sleep duration is calculated from its timestamps. Introductions retain the
"Also log a meal" shortcut, and deletion still requires confirmation.

### Unified-surface design study

Run `npm run prototype:entries`, then open
`http://localhost:5001/entry-view-modes.html?study=unified&variant=A`.
The throwaway study compares logging forms, footer-free inline edits, and Food
views side by side: **A** Snapshot grid, **B** Ruled ledger, **C** Focused record.
Use the floating arrows to switch layouts, the Entry selector for all eight
kinds, and the Food Status/day-night controls for alternate states.

Choices commit immediately; text and grouped timestamps commit on leaving their
inline editor. Logging retains its create action and timestamp section directly
above it. All changes are synthetic and in memory; production editing behavior
is unchanged. Reload or Reset demo discards edits. The original Entry view study
remains available without `study=unified`.

For HTMLPreview, prefix the GitHub HTML file URL with
`https://htmlpreview.github.io/?` and append `?study=unified&variant=A` to
the file URL. Use a commit SHA in place of the branch name for a permanent
link: branches may be deleted after merge. The prototype preserves this
wrapped source URL when changing controls so refresh continues to work.

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

## Security checks

Install [Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
and put `gitleaks` on your PATH before committing. Verify the downloaded archive
against the release checksums. Run `npm install` to activate Husky hooks.

Pre-commit runs `npm run check:secrets` against the complete staged diff with
redacted output, then `npm run check:security:dependencies` against the full
lockfile, including unchanged, transitive, and development dependencies. Stage or
stash all manifest and lockfile edits first so the audit matches the index.
Missing Gitleaks, audit service errors, and advisories of any severity block
commits, except for the narrowly scoped, expiring exception below. The existing
changed-dependency health screen still runs afterward.
Jev remains an optional supplementary check, not the security enforcement layer.
Git's `--no-verify` bypasses local hooks; CI provides an independent check.

The Security workflow runs on pull requests, pushes, weekly, and manually:

- Gitleaks scans full Git history, without a blanket baseline or allowlist.
  `.gitleaksignore` excludes only exact historical fingerprints for the
  repeated GitHub homepage analytics metadata occurrence in the deleted,
  incorrectly downloaded `cloudflared.deb` HTML file; new findings in that
  path are still scanned.
- npm audits the committed lockfile without installing dependencies or running
  package lifecycle scripts. CI and local hooks both use
  `npm run check:security:dependencies`, a built-in-Node audit wrapper that
  includes development, optional, and peer dependencies and fails closed on
  subprocess errors, invalid reports, and unknown or cyclic vulnerability edges.
- CodeQL analyzes JavaScript/TypeScript with the extended security query suite.

Dependabot checks npm and GitHub Actions updates weekly. Existing vulnerabilities
or historical secrets can make the initial checks fail; remediate them rather
than lowering the threshold. Rotate exposed credentials before removing them.

### Temporary glob, minimatch, and deepmerge advisory exceptions

**Owner:** repository maintainers. **Approved scope:** temporary exclusion of
[GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) (glob),
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
(minimatch), and
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
(deepmerge), expiring **2026-12-01 at 00:00 UTC**. As checked on 2026-11-01,
glob and minimatch are fixed only in majors (glob 14.0.2, minimatch 11.0.1)
incompatible with the glob 7 / minimatch 3 consumers in Expo and React Native
tooling, and deepmerge has no patched release. These are build-time tooling
dependencies; this is risk acceptance, not remediation. node-forge is
remediated by the `overrides` pin to 1.4.2.

`scripts/audit-dependencies.mjs` matches each exact advisory URL, package and
dependency identity, affected range, and only the currently locked versions
(glob 7.2.3/13.0.6, minimatch 3.1.5/9.0.9/10.2.6, deepmerge 4.3.1). Other
versions, aliases, new advisories, and other packages still block. An ancestor
is accepted only when every advisory reachable through its `via` graph is one of
these exceptions. Every accepted run warns with the advisory and expiration
date, and the exception blocks at expiration while the advisory is present.

Maintainers must monitor upstream releases, upgrade as soon as compatible
versions exist, and remove each exception and this policy in the same change.
Extending an expiry or changing scope requires fresh maintainer approval.

Other advisories are remediated with pinned upstream **PostCSS 8.5.31** and
**uuid 11.1.1** (the last CommonJS major, scoped to xcode). Two narrow workspace
adapters preserve existing consumer APIs without copying upstream algorithms:

- `@keepsake/query-decoder-compat` exposes patched **decode-uri-component 0.5.1**
  as the callable CommonJS export expected by query-string 7. This retains Expo
  Router's existing parsing and serialization API. Its upstream npm alias
  remains visible to the dependency audit. Node must support synchronous
  `require(ESM)` (Node 20.19+, already required by this Expo/React Native line).
- `@keepsake/metro-image-size-compat` delegates buffers to patched
  **image-size 2.0.4** and reads file-path inputs synchronously for SDK 54 Metro.
  It is scoped only to Metro's image-size dependency. Metro 0.83.8's published
  backport was tested but its root-ancestor traversal regression breaks this
  workspace's Expo resolver, so the compatible Metro 0.83.3 is retained.

Remove each adapter when its consumer supports the patched upstream API.
Compatibility tests cover query decoding, Metro buffer and file-path image
dimensions, xcode UUID generation, and PostCSS. Expo web export validates the
combined workspace resolver and bundler.

Maintainers must enable GitHub Code Security for private repositories where
required, and select advanced CodeQL setup rather than duplicate default setup.
After the first workflow run, require the `Secrets`, `Dependencies`, and `CodeQL`
checks in the branch ruleset. Also enable code-scanning merge protection for
CodeQL alerts: a successful analysis job means scanning completed, not that it
found no vulnerabilities. Enable GitHub secret scanning and push protection
where the repository's plan supports them. These settings are not enabled by
committing workflow files.

### Application-security review requirements

For every code review, assess the changed code for:

- Input validation, injection, unsafe file/path handling, and untrusted URLs.
- Authentication and authorization at any exposed trust boundaries.
- Child-data privacy: storage, export/deletion, logs, analytics, and network
  disclosure; keep credentials and child health data out of agent/AI requests.
- Secret exposure, cryptographic misuse, and insecure platform configuration.
- Dependency advisories, including transitive lockfile changes, and available
  Security workflow results and CodeQL alerts.

Report concrete attack paths and impact with severity, file/line, and remediation.
Mark each area checked or not applicable, and disclose unavailable evidence or
checks not run. Use synthetic data for verification.
