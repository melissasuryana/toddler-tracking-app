# Server-authoritative shared data on a self-hosted home server

Status: accepted

Post-MVP, family members see the same data when they open the web app on the home LAN. We considered keeping the app purely local-first and adding a self-hosted sync engine (Option A), and briefly revisiting Apple CloudKit sharing; we chose a **server-authoritative API** instead (Option B): one SQLite database lives on the home server behind a small Node API, and browsers read and write it directly. When the phone is on the LAN it uses that same API as its store, so phone and web share **one** database and there is no conflict-resolution engine and no replica to reconcile. (The phone's local-first capture — working when the server is down or the family is away from home — is the deliberately deferred offline piece, not part of this milestone.)

Chosen for the user's stated optimization — simplest possible setup, easy to test during development before deploying to the home server. A server-authoritative model has no sync transport, no conflict resolution, and no per-device replica to reconcile; the whole dev loop is `npm run server` + `npx expo start` against `localhost` (or a GitHub Codespace). The sync-engine paths all got meaningfully heavier or riskier since the September 2026 research (`docs/research/expo-local-first-storage.md`): expo-sqlite removed libSQL support in SDK 58, Turso's React Native sync bindings are pre-release, PowerSync self-hosting needs Postgres logical replication plus 2–3 containers, and Zero replaces the data layer entirely. CloudKit was rejected: there is no automatic expo-sqlite↔CloudKit sync (a hand-built mapping/outbox/conflict layer), it requires a paid Apple Developer account and custom dev builds, it is iOS-only with no viable family web app, and it is the least locally-testable option on the table.

The server is **Node + SQLite via Drizzle**, reusing the sync-ready MVP schema (UUIDv7 ids, UTC `occurred_at` + IANA `occurred_tz`, scrubbed tombstones) almost verbatim. First boot creates and migrates the database file; there is no separate database-setup step on the laptop, the Codespace, or the home server. Access control is a **single shared family passphrase** (long, unique), cookie-stored, with no account system; network scope is **LAN-only**. There is **no per-Entry caregiver attribution** — one anonymous family pot; the spec's data model is unchanged. Development data is **throwaway seed/fixture data** repopulated on each Codespace spin-up; real data only ever lives on the home server after the go-live rehearsal.

## Consequences

- **Offline capture on the phone is deferred, not dropped.** Because the phone uses the LAN API as its store when home, logging depends on the server being up; local-first capture (phone keeps working offline / away from home) is an accepted gap and a candidate follow-up ticket.
- **One database, one network.** Phone and web share the server's database only while the phone is on the LAN. Away from home the phone cannot log or view shared data until an offline/local-capture layer is added later.
- **A private-by-default posture for child health data** is preserved: LAN-only, a real passphrase, and no public exposure. In Codespaces, forwarded ports are kept private (GitHub-authenticated) with the passphrase as a second layer.
- **No attribution** means the timeline cannot show who logged an Entry. If that is ever wanted it is a small additive migration (a nullable display-name field), deliberately deferred.

## Considered Options

- **Self-hosted sync engine (Option A, keep local-first)** — rejected: every candidate got heavier or riskier since the Sept 2026 research (expo-sqlite dropped libSQL in SDK 58; Turso RN sync pre-release; PowerSync needs Postgres logical replication + 2–3 containers; Zero replaces the data layer; Jazz 2.0 alpha). Adds sync transport, conflict resolution, and per-device replicas for a two-person family app.
- **Apple iCloud/CloudKit sharing (CKShare)** — rejected: no automatic expo-sqlite↔CloudKit sync (hand-built mapping/outbox/merge layer), requires $99/yr Apple Developer Program and custom dev builds, iOS-only with no viable family web app, and not locally testable (needs two iCloud accounts/devices; cannot run on localhost).
- **Server-authoritative for all devices including offline-first phone** — rejected: conflates "shared viewing" with "offline capture"; the phone staying usable when the server is down or the family is away is a separate concern, deferred.
- **Export/import bridge (phone stays pure local-first, occasional manual push to server)** — rejected: sharing is manual and stale between pushes, and export/dedup semantics need their own design.
- **Postgres on the home server** — rejected: extra container and DB-server setup with no benefit at two-person scale; SQLite removes the entire database-setup step.
- **Managed cloud (Turso/Supabase)** — rejected: violates the self-hosted premise of the ticket.
- **Per-person accounts / per-Entry attribution** — rejected for MVP scope: account system is out of proportion to a two-person LAN app, and attribution is a small additive migration if ever wanted.
- **Real data in the dev Codespace** — rejected: re-introduces a split-brain/sync problem; dev data is reseeded fixtures, real data lives only on the home server.

Resolves GitHub issue #41 (child of wayfinder map #1). Relies on the sync-ready schema decisions recorded under issue #7 and on `docs/research/expo-local-first-storage.md` for the sync-candidate baseline.
