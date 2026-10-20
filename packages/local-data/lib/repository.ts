/**
 * Child + preferences repositories: row ↔ domain mapping through Drizzle's
 * typed query builders (schema in ./schema.ts) over the injected driver.
 * Validation lives in ./child.ts and runs here too, so no path can persist
 * an invalid Child.
 */
import { asc, eq, sql } from "drizzle-orm";
import {
  CHILD_SEXES,
  uuidv7,
  validateChildInput,
  type ChildInput,
  type ChildSex,
} from "./child.ts";
import type { LocalOrm } from "./orm.ts";
import { children, preferences } from "./schema.ts";
import type { PreferenceKey, PreferenceTypes } from "./preferences.ts";
import { parsePreference } from "./preferences.ts";

/** The persisted Child (CONTEXT.md). */
export interface Child {
  readonly id: string;
  readonly name: string;
  /** ISO `YYYY-MM-DD`, guaranteed real and nonfuture at write time. */
  readonly birthdate: string;
  readonly sex: ChildSex;
  /** App-relative path to a copied photo asset; null when never picked. */
  readonly photo: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

type ChildRow = typeof children.$inferSelect;

function toChild(row: ChildRow): Child {
  return {
    id: row.id,
    name: row.name,
    birthdate: row.birthdate,
    sex: CHILD_SEXES.includes(row.sex) ? row.sex : "female",
    photo: row.photo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ChildRepository {
  private readonly orm: LocalOrm;

  constructor(orm: LocalOrm) {
    this.orm = orm;
  }

  /** All children, oldest first. The MVP UI assumes one. */
  list(): Child[] {
    return this.orm
      .select()
      .from(children)
      .orderBy(asc(children.createdAt))
      .all()
      .map(toChild);
  }

  /** The first (MVP: only) Child, or null on a fresh install. */
  first(): Child | null {
    const row = this.orm
      .select()
      .from(children)
      .orderBy(asc(children.createdAt))
      .limit(1)
      .get();
    return row ? toChild(row) : null;
  }

  /** True when at least one Child exists — the onboarding gate's question. */
  exists(): boolean {
    const row = this.orm
      .select({ one: sql<number>`1` })
      .from(children)
      .limit(1)
      .get();
    return row !== undefined;
  }

  /**
   * Persists a new Child after validation. Throws `ChildValidationError`
   * with caregiver-readable field errors when the input is invalid.
   */
  create(input: ChildInput): Child {
    const result = validateChildInput(input);
    if (!result.ok) {
      throw new ChildValidationError(result.errors);
    }
    const now = new Date();
    const id = uuidv7();
    this.orm
      .insert(children)
      .values({
        id,
        name: result.value.name,
        birthdate: result.value.birthdate,
        sex: result.value.sex,
        photo: result.value.photo,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const created = this.orm
      .select()
      .from(children)
      .where(eq(children.id, id))
      .get();
    if (!created) {
      throw new Error("Child insert failed: row not readable after insert");
    }
    return toChild(created);
  }
}

/** Thrown when a Child write fails validation; carries every field error. */
export class ChildValidationError extends Error {
  readonly errors: readonly { field: string; message: string }[];

  constructor(errors: readonly { field: string; message: string }[]) {
    super(errors.map((error) => error.message).join(" "));
    this.name = "ChildValidationError";
    this.errors = errors;
  }
}

export class PreferenceRepository {
  private readonly orm: LocalOrm;

  constructor(orm: LocalOrm) {
    this.orm = orm;
  }

  /** Reads a preference; null when unset. */
  get<K extends PreferenceKey>(key: K): PreferenceTypes[K] | null {
    const row = this.orm
      .select()
      .from(preferences)
      .where(eq(preferences.key, key))
      .get();
    return parsePreference(key, row?.value ?? null);
  }

  /** Writes a preference, replacing any previous value. */
  set<K extends PreferenceKey>(key: K, value: PreferenceTypes[K]): void {
    this.orm
      .insert(preferences)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({
        target: preferences.key,
        set: { value: String(value) },
      })
      .run();
  }
}
