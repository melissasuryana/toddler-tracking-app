/**
 * SQLite schema for the local database (Drizzle definitions).
 *
 * Child, preference, local metadata, and the shared Entry base row. Entry-kind
 * content and seeded catalog tables are added by their owning domain tickets.
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { EntryKind } from "./entry.ts";

/** Sex vocabulary from CONTEXT.md: required on the Child for growth charts. */
export type ChildSex = "female" | "male";

export const children = sqliteTable("children", {
  /** UUIDv7: time-ordered, locally generated, sync-friendly. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Calendar date, ISO `YYYY-MM-DD`. Validated nonfuture at the boundary. */
  birthdate: text("birthdate").notNull(),
  sex: text("sex").notNull().$type<ChildSex>(),
  /** App-relative path to a copied photo asset; null when never picked. */
  photo: text("photo"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** Preferences: tiny key-value store (temperature unit, …). */
export const preferences = sqliteTable("preferences", {
  key: text("key").primaryKey(),
  /** JSON-serialized value. */
  value: text("value").notNull(),
});

/** Internal local-data bookkeeping (seed completion, future metadata). */
export const metadata = sqliteTable("metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** IANA zones registered after validation; SQLite triggers enforce membership. */
export const entryTimezones = sqliteTable("entry_timezones", {
  name: text("name").primaryKey(),
});

/** The stable, sync-ready metadata shared by every Entry kind. */
export const entries = sqliteTable(
  "entries",
  {
    /** UUIDv7 for caregiver-created rows; stable slugs for bundled seed rows. */
    id: text("id").primaryKey(),
    childId: text("child_id").references(() => children.id, {
      onDelete: "restrict",
    }),
    kind: text("kind").$type<EntryKind>(),
    /** UTC epoch milliseconds, independent of the recorded civil timezone. */
    occurredAt: integer("occurred_at"),
    /** IANA timezone captured when the Entry occurred. */
    occurredTz: text("occurred_tz"),
    createdAt: integer("created_at"),
    updatedAt: integer("updated_at"),
    /** A scrubbed tombstone retains this timestamp and the Entry id only. */
    deletedAt: integer("deleted_at"),
    isSeed: integer("is_seed", { mode: "boolean" }),
  },
  (table) => [
    index("entries_child_occurred_idx").on(table.childId, table.occurredAt),
    index("entries_child_kind_idx").on(table.childId, table.kind),
  ]
);

/** Entry-owned links (Foods, symptoms, factors); deleted with their Entry. */
export const entryAssociations = sqliteTable(
  "entry_associations",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    associationType: text("association_type").notNull(),
    associatedId: text("associated_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.entryId, table.associationType, table.associatedId],
    }),
  ]
);

/** Kind-specific fields owned by an Entry and scrubbed with its tombstone. */
export const entryContent = sqliteTable("entry_content", {
  entryId: text("entry_id")
    .primaryKey()
    .references(() => entries.id, { onDelete: "cascade" }),
  contentJson: text("content_json").notNull(),
});

/** Parent-created Foods; the bundled read-only catalogue stays in its domain package. */
export const customFoods = sqliteTable("custom_foods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  allergenTagsJson: text("allergen_tags_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** A manual-safe decision is valid only for the watch cycle it names. */
export const manualSafeMarkers = sqliteTable(
  "manual_safe_markers",
  {
    childId: text("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    foodId: text("food_id").notNull(),
    cycleEntryId: text("cycle_entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.childId, table.foodId] })]
);

/** A single durable in-progress Sleep timer per Child, separate from Entries. */
export const runningSleepTimers = sqliteTable("running_sleep_timers", {
  childId: text("child_id")
    .primaryKey()
    .references(() => children.id, { onDelete: "cascade" }),
  startedAt: integer("started_at").notNull(),
  startedTz: text("started_tz")
    .notNull()
    .references(() => entryTimezones.name, { onDelete: "restrict" }),
});
