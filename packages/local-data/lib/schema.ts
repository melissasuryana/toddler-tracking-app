/**
 * SQLite schema for the local database (Drizzle definitions).
 *
 * Ticket #43 scope: the Child record (CONTEXT.md: name, birthdate, sex for
 * growth charts, optional photo) and a key-value preferences table. The eight
 * Entry kinds and seed data arrive in later tickets as appended tables plus
 * ordered migrations — this file is append-only from here on.
 */
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
