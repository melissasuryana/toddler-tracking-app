# Single-tier deletion: confirm and scrub

Supersedes the user-facing half of [0001](0001-two-tier-deletion.md) (the Archived tier and the Recently Deleted view). 0001's sync rationale for the tombstone still stands.

Deleting an Entry is a single step: a confirm dialog ("This can't be undone") wipes all content fields, leaving only the row's id and `deleted_at` as a scrubbed tombstone so future sync can propagate the deletion without resurrecting rows. There is no Recently Deleted screen, no restorable tier, no pending-delete state, and no restore path.

Chosen over keeping a restorable Archived tier so the MVP carries no trash view and "delete" stays honest about the data — retained content in the SQLite file is a real liability for child health data with no purge story. An undo toast with a grace period was considered and rejected: a pending tier would reintroduce "restorable" into the schema and every query under a new name for a UI courtesy. If testing later shows mis-taps are a problem, a client-side undo toast can be added with no schema change.

Every Entry is therefore either live (editable any time) or permanently gone — the editing policy is uniform, with no exception for archived Entries.

## Considered Options

- **Two-tier deletion with Recently Deleted** — rejected: extra screen and a restorable tier the MVP doesn't need; "archive" language obscures what the user asked for.
- **Undo toast with a pending-delete grace period** — rejected: reintroduces a restorable state into the schema and every query; can be added client-side later without schema change.
- **Soft delete only, rows retained forever** — rejected: no honest "permanent delete"; content accumulates without a purge story (see 0001).
- **Hard delete only** — rejected: un-syncable; deletions can't propagate and rows resurrect on sync (see 0001).
