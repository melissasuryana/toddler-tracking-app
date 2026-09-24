# Research: local-first storage options for Expo

Resolves GitHub issue #2 (part of wayfinder map #1). Research date: 2026-09-24.

**Question:** Which local storage should the toddler routine tracker use on Expo —
`expo-sqlite`, WatermelonDB, MMKV/AsyncStorage, or other credible options — given:
offline-first (offline-only MVP), structured event data with queries (cross-tracker
timeline, per-tracker filters), and a planned cloud-sync milestone later?

## Recommendation (gist)

**Use `expo-sqlite` (optionally with Drizzle ORM) for all structured event data, and
`expo-sqlite/kv-store` for simple preferences.** It is the only credible option that
runs in Expo Go with zero extra native config, gives full SQL querying for
timeline/filter queries, and is maintained first-party with each Expo SDK. Keep the
sync milestone open: `expo-sqlite` has no built-in sync protocol, but its libSQL build
option + `syncLibSQL()` (Turso offline sync), the SQLite session extension
(`createSession*`, changesets), and Drizzle give viable sync paths later — and a plain
SQLite schema keeps the door open to adopting a sync engine (RxDB, LiveStore,
PowerSync, or WatermelonDB) without a data-model rewrite.

## Options compared

### 1. expo-sqlite (first-party Expo SQLite) — RECOMMENDED

- **Expo Go / dev build:** Included in Expo Go. Works on Android, iOS, macOS, tvOS, and
  web (web in alpha). No config plugin required for basic use.
  [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Queries:** Full SQLite — arbitrary SQL, prepared statements, transactions,
  `PRAGMA user_version`-based migrations, FTS3/4/5 enabled by default
  (`enableFTS: true`), WAL mode recommended. Cross-tracker timeline =
  `SELECT ... ORDER BY timestamp`; per-tracker filters = plain `WHERE`. This is exactly
  the app's query shape.
  [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Sync:** No built-in sync protocol. But three relevant building blocks:
  - Config-plugin option `useLibSQL` builds against libSQL instead of stock SQLite, and
    `db.syncLibSQL()` syncs the local DB with a remote libSQL server (e.g. Turso).
    Expo's local-first guide points at Turso's Offline Sync (public beta) used with
    `expo-sqlite` for bidirectional sync.
    [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/) ·
    [Source](https://docs.expo.dev/guides/local-first/)
  - `createSessionAsync`/`createSessionSync` expose the SQLite session extension
    (changesets) — the low-level primitive a custom sync layer needs.
    [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/)
  - Third-party layers sit on top of it: Drizzle ORM (typed schema + migration
    generation via drizzle-kit, official expo-sqlite integration guide), Knex dialect,
    RxDB's SQLite storage adapter, TinyBase persistence, `y-expo-sqlite`.
    [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/) ·
    [Source](https://docs.expo.dev/guides/local-first/)
- **Maintenance:** First-party Expo module; docs live at SDK 57 (current) with recent
  feature additions (tagged-template `db.sql`, dev-tools DB inspector, kv-store).
  Highest-trust maintenance of all options.
- **Extras:** `expo-sqlite/kv-store` is a drop-in AsyncStorage replacement with sync
  APIs — covers the MMKV/AsyncStorage "preferences" niche without another dependency.
  SQLCipher encryption is available via config plugin (requires prebuild, not Expo Go).
  [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/)

### 2. WatermelonDB — NOT RECOMMENDED (for this project, now)

- **Expo Go:** No. Requires native code (CocoaPods `simdjson` pod, optional manual JSI
  wiring in `MainApplication`). Official installation docs cover React Native
  (bare/prebuilt), web, Windows, Node — no Expo path, no official config plugin. Using
  it with Expo means `expo prebuild` + a development build + manual native edits.
  Open upstream issues confirm friction: "Support Expo" (#1909), "Expo SDK 52
  dependency issues" (#1892), "Expo SDK 54 with native + web: TypeError" (#1953),
  "WatermelonDb not working on expo EAS update" (#1954).
  [Source](https://watermelondb.dev/docs/Installation) ·
  [Source](https://github.com/Nozbe/WatermelonDB/issues?q=expo)
- **Queries:** Good — lazy, relational, observable (RxJS) queries on SQLite; would
  handle timeline/filters well and re-render reactively.
  [Source](https://github.com/Nozbe/WatermelonDB)
- **Sync:** Its headline strength: a documented sync protocol — client-side sync
  primitives plus a built-in `synchronize()` adapter; you bring your own backend
  implementing two endpoints (pullChanges/pushChanges).
  [Source](https://watermelondb.dev/docs/Sync/Intro)
- **Maintenance (decisive concern):** Latest stable 0.28.0 released 2025-04-07;
  0.28.1-0 prerelease 2025-07-24; npm record last modified 2025-07-24. Open,
  unanswered maintainer-facing questions: "Has WatermelonDB been abandoned?" (#1963,
  Apr 2026 — notes ~8 months without updates and unreviewed PRs) and "Question:
  Current support status for React Native New Architecture / Expo SDK 54+" (#1969,
  Jun 2026). For an MVP starting in 2026 on current Expo SDKs, betting the core data
  layer on a project with open abandonment questions is a poor risk trade.
  [Source](https://registry.npmjs.org/@nozbe/watermelondb) ·
  [Source](https://github.com/Nozbe/WatermelonDB/issues/1963) ·
  [Source](https://github.com/Nozbe/WatermelonDB/issues/1969)
- **Note:** If sync becomes the dominant requirement later, re-evaluate — its protocol
  is still the most battle-tested bring-your-own-backend sync design in RN. Notably,
  Expo's own local-first tools guide (updated Aug 2026) does not list WatermelonDB.
  [Source](https://docs.expo.dev/guides/local-first/)

### 3. MMKV / AsyncStorage — WRONG TOOL for event data

- **react-native-mmkv:** Actively maintained (v4.3.2, 2026-06-22), extremely fast,
  synchronous, encrypted key-value storage. But it is **key-value only**: no queries,
  no relations, no indexes. Storing events means serializing JSON blobs and filtering
  in JS — the wrong shape for timeline + per-tracker filter queries. V4 is a Nitro
  Module requiring `npx expo prebuild` (not in Expo Go) and RN ≥ 0.76.
  [Source](https://github.com/margelo/react-native-mmkv)
- **AsyncStorage:** Same key-value limitation, slower, and `expo-sqlite/kv-store` is a
  drop-in replacement that removes the need for it.
  [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Verdict:** Fine for settings/flags/onboarding state; not a candidate for the event
  store. And for the MVP even that niche is covered by `expo-sqlite/kv-store`, so no
  extra dependency is needed.

### 4. Other credible options (worth knowing, not chosen for MVP)

From Expo's own local-first guide and ecosystem docs:

- **Drizzle ORM on expo-sqlite:** Not a storage engine — a typed schema/migration/query
  layer over expo-sqlite with an official Expo integration. Low-risk add-on; recommended
  companion rather than an alternative.
  [Source](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **RxDB:** Reactive, offline-first NoSQL DB with replication plugins (HTTP, GraphQL,
  Supabase); runs on Expo via its SQLite storage adapter wrapping expo-sqlite. A real
  sync story, but a heavier conceptual model (NoSQL documents) for a small MVP.
  [Source](https://docs.expo.dev/guides/local-first/)
- **LiveStore:** SQLite-based, event-sourced local-first data layer with first-class
  Expo support (Expo blog partnership). Event sourcing fits "toddler event log" well;
  still young. Strong candidate to revisit at the sync milestone.
  [Source](https://docs.expo.dev/guides/local-first/)
- **Turso offline sync + expo-sqlite/libSQL:** Bidirectional sync for SQLite, public
  beta, officially demoed with expo-sqlite. The lowest-migration sync path from a plain
  expo-sqlite MVP. Automatic conflict resolution not yet available.
  [Source](https://docs.expo.dev/guides/local-first/)
- **TinyBase, Legend-State, Yjs, Jazz, PowerSync, ElectricSQL, Instant, Prisma (early
  access):** All listed in Expo's guide; each either adds a hosted-service dependency
  (against the offline-only MVP goal), a CRDT/state-management layer we don't need yet,
  or early-access risk. None beats plain expo-sqlite for this MVP's scope.
  [Source](https://docs.expo.dev/guides/local-first/)

## Decision matrix

| Option            | Expo Go?                   | Structured queries           | Sync path                                              | Maintenance (2026)                         | Verdict                   |
| ----------------- | -------------------------- | ---------------------------- | ------------------------------------------------------ | ------------------------------------------ | ------------------------- |
| expo-sqlite       | ✅ built in                | ✅ full SQL, FTS, migrations | libSQL/Turso beta, session changesets, or layer on top | ✅ first-party, current SDK 57             | **Pick**                  |
| WatermelonDB      | ❌ prebuild + native edits | ✅ reactive relational       | ✅ best-in-class protocol                              | ⚠️ stale releases; open "abandoned?" issue | Revisit at sync milestone |
| react-native-mmkv | ❌ prebuild (Nitro)        | ❌ key-value only            | none                                                   | ✅ active (v4.3.2)                         | Prefs only (unnecessary)  |
| AsyncStorage      | ✅                         | ❌ key-value only            | none                                                   | maintenance-mode                           | Superseded by kv-store    |
| RxDB / LiveStore  | ✅ via expo-sqlite         | ✅                           | ✅ built-in                                            | active but young/smaller                   | Revisit at sync milestone |

## Consequences for the app

1. One `events` table (or a small number of typed tables) in expo-sqlite; `timestamp`
   index powers the cross-tracker timeline; `tracker_type` (+ per-tracker payload
   columns or JSON payload) powers per-tracker filters. No reactivity framework needed
   for MVP — refetch on write or a thin query hook is enough at this data volume.
2. Use `PRAGMA user_version` migrations from day one (the pattern in Expo's docs) so the
   schema can evolve toward whichever sync design is chosen later.
3. Use `expo-sqlite/kv-store` for preferences/settings; add nothing else.
4. When the sync milestone lands, re-run a short evaluation among: Turso/libSQL
   (`useLibSQL` + `syncLibSQL()`), LiveStore, RxDB replication, WatermelonDB (if
   maintenance recovers), or a custom changeset-based layer on the session extension.
   Because the MVP data already lives in plain SQLite tables, all of these stay open.

## Sources

- expo-sqlite API reference (Expo SDK 57): https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo local-first guide (mod. 2026-08-27): https://docs.expo.dev/guides/local-first/
- WatermelonDB installation docs: https://watermelondb.dev/docs/Installation
- WatermelonDB sync docs: https://watermelondb.dev/docs/Sync/Intro
- WatermelonDB repo + issues (#1909, #1892, #1953, #1954, #1963, #1969):
  https://github.com/Nozbe/WatermelonDB · https://github.com/Nozbe/WatermelonDB/issues?q=expo
- WatermelonDB npm release history: https://registry.npmjs.org/@nozbe/watermelondb
- react-native-mmkv repo (v4, Nitro): https://github.com/margelo/react-native-mmkv
- react-native-mmkv npm release history: https://registry.npmjs.org/react-native-mmkv
