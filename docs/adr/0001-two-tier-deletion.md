# Two-tier deletion: archived vs permanently deleted

Deleting an Entry always archives it first: a `deleted_at` timestamp hides it from every view except Recently Deleted, where it can be restored. Permanent deletion is an explicit second step inside Recently Deleted that wipes all content fields but keeps the row's id and `deleted_at` as a scrubbed tombstone.

Chosen over plain hard deletes so the future sync milestone can propagate deletions: a fully removed row leaves no trace, and any other device still holding it would sync it back — permanent deletion would resurrect. Chosen over tombstone-only retention (keeping the full row forever) so "permanent" stays honest about the data.

## Considered Options

- **Hard delete only** — rejected: un-syncable; deletions can't propagate and rows resurrect on sync.
- **Soft delete only, rows retained forever** — rejected: no honest "permanent delete," and archived data accumulates without a purge story.
