import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { MigrationDriver } from "./driver.ts";
import {
  isSlugId,
  validateEntryInput,
  type EntryFieldError,
  type Entry,
  type EntryInput,
} from "./entry.ts";
import type { LocalOrm } from "./orm.ts";
import {
  entries,
  entryAssociations,
  entryContent,
  metadata,
} from "./schema.ts";

export class EntryValidationError extends Error {
  readonly errors: readonly EntryFieldError[];

  constructor(errors: readonly EntryFieldError[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "EntryValidationError";
    this.errors = errors;
  }
}

export interface EntryAssociation {
  readonly associationType: string;
  readonly associatedId: string;
}

export type EntryContentValue =
  | string
  | number
  | boolean
  | null
  | readonly EntryContentValue[]
  | { readonly [key: string]: EntryContentValue };

export type EntryContent = Readonly<Record<string, EntryContentValue>>;

type Atomic = <T>(operation: () => T) => T;

type EntryRow = typeof entries.$inferSelect;

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    childId: row.childId!,
    kind: row.kind! as Entry["kind"],
    occurredAt: row.occurredAt!,
    occurredTz: row.occurredTz!,
    createdAt: row.createdAt!,
    updatedAt: row.updatedAt!,
    deletedAt: null,
    isSeed: row.isSeed ?? false,
  };
}

export class EntryRepository {
  private readonly orm: LocalOrm;
  private readonly driver: MigrationDriver;
  private readonly atomic: Atomic;

  constructor(orm: LocalOrm, driver: MigrationDriver, atomic: Atomic) {
    this.orm = orm;
    this.driver = driver;
    this.atomic = atomic;
  }

  create(input: EntryInput): Entry {
    const result = validateEntryInput(input);
    if (!result.ok) throw new EntryValidationError(result.errors);
    return this.atomic(() => {
      const now = Date.now();
      const value = result.value;
      this.driver
        .prepareSync(
          "INSERT INTO entry_timezones (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
        )
        .run(value.occurredTz);
      this.orm
        .insert(entries)
        .values({
          id: value.id,
          childId: value.childId,
          kind: value.kind,
          occurredAt: value.occurredAt,
          occurredTz: value.occurredTz,
          createdAt: now,
          updatedAt: now,
          isSeed: value.isSeed,
        })
        .run();
      return {
        id: value.id,
        childId: value.childId,
        kind: value.kind,
        occurredAt: value.occurredAt,
        occurredTz: value.occurredTz,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        isSeed: value.isSeed,
      };
    });
  }

  get(id: string): Entry | null {
    const row = this.orm
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
      .get();
    return row ? toEntry(row) : null;
  }

  listForChild(childId: string): Entry[] {
    return this.orm
      .select()
      .from(entries)
      .where(and(eq(entries.childId, childId), isNull(entries.deletedAt)))
      .orderBy(
        desc(entries.occurredAt),
        asc(entries.createdAt),
        asc(entries.id)
      )
      .all()
      .map(toEntry);
  }

  addAssociation(
    entryId: string,
    associationType: string,
    associatedId: string
  ): void {
    if (
      associationType.trim().length === 0 ||
      associatedId.trim().length === 0
    ) {
      throw new TypeError("Entry association type and id are required.");
    }
    this.orm
      .insert(entryAssociations)
      .values({
        entryId,
        associationType: associationType.trim(),
        associatedId: associatedId.trim(),
      })
      .onConflictDoNothing()
      .run();
  }

  associationsFor(entryId: string): EntryAssociation[] {
    return this.driver
      .prepareSync(
        `SELECT association_type, associated_id
         FROM entry_associations
         WHERE entry_id = ?
         ORDER BY association_type, associated_id`
      )
      .all<{ association_type: string; associated_id: string }>(entryId)
      .map(({ association_type, associated_id }) => ({
        associationType: association_type,
        associatedId: associated_id,
      }));
  }

  setContent(entryId: string, content: EntryContent): void {
    const contentJson = serializeEntryContent(content);
    this.atomic(() => {
      this.orm
        .insert(entryContent)
        .values({ entryId, contentJson })
        .onConflictDoUpdate({
          target: entryContent.entryId,
          set: { contentJson },
        })
        .run();
    });
  }

  contentFor(entryId: string): EntryContent | null {
    const row = this.driver
      .prepareSync("SELECT content_json FROM entry_content WHERE entry_id = ?")
      .get<{ content_json: string }>(entryId);
    return row ? (JSON.parse(row.content_json) as EntryContent) : null;
  }

  /**
   * Permanently removes the live row (cascading its owned associations) and
   * replaces it with the id + deleted_at tombstone in the same transaction.
   */
  scrub(id: string, deletedAt: number = Date.now()): boolean {
    if (!Number.isSafeInteger(deletedAt) || deletedAt < 0) {
      throw new RangeError("Deletion time must be UTC epoch milliseconds.");
    }
    return this.atomic(() => {
      const existing = this.driver
        .prepareSync("SELECT deleted_at FROM entries WHERE id = ?")
        .get<{ deleted_at: number | null }>(id);
      if (!existing || existing.deleted_at !== null) return false;
      this.driver.prepareSync("DELETE FROM entries WHERE id = ?").run(id);
      this.driver
        .prepareSync("INSERT INTO entries (id, deleted_at) VALUES (?, ?)")
        .run(id, deletedAt);
      return true;
    });
  }
}

function serializeEntryContent(content: EntryContent): string {
  if (
    content === null ||
    typeof content !== "object" ||
    Array.isArray(content) ||
    !isJsonValue(content)
  ) {
    throw new TypeError("Entry content must be a JSON object.");
  }
  return JSON.stringify(content);
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
  }
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, ancestors))
    : Object.values(value).every((item) => isJsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

export class MetadataRepository {
  private readonly orm: LocalOrm;

  constructor(orm: LocalOrm) {
    this.orm = orm;
  }

  get(key: string): string | null {
    const row = this.orm
      .select()
      .from(metadata)
      .where(eq(metadata.key, key))
      .get();
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.orm
      .insert(metadata)
      .values({ key, value })
      .onConflictDoUpdate({
        target: metadata.key,
        set: { value },
      })
      .run();
  }
}

export type SeedValue = string | number | boolean | null;
export interface SeedRow {
  readonly id: string;
  readonly is_seed: true;
  readonly [column: string]: SeedValue;
}

const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class SeedRepository {
  private readonly driver: MigrationDriver;

  constructor(driver: MigrationDriver) {
    this.driver = driver;
  }

  /** Insert bundled seed rows without ever replacing an existing row. */
  insertIfMissing(table: string, rows: readonly SeedRow[]): void {
    if (!SQL_IDENTIFIER.test(table)) {
      throw new TypeError("Seed table must be a SQL identifier.");
    }
    for (const row of rows) {
      if (!isSlugId(row.id) || row.is_seed !== true) {
        throw new TypeError("Seed rows require a slug id and is_seed=true.");
      }
      const columns = Object.keys(row).sort();
      if (columns.some((column) => !SQL_IDENTIFIER.test(column))) {
        throw new TypeError("Seed columns must be SQL identifiers.");
      }
      const values = columns.map((column) => row[column]);
      if (
        values.some(
          (value) =>
            value === undefined ||
            (typeof value === "number" && !Number.isFinite(value))
        )
      ) {
        throw new TypeError("Seed values must be defined and finite.");
      }
      const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const statement = this.driver.prepareSync(
        `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`
      );
      statement.run(
        ...values.map((value) =>
          typeof value === "boolean" ? Number(value) : value
        )
      );
    }
  }
}
