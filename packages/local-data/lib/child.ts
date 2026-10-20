/**
 * Child validation and id generation — pure domain logic for the Child record
 * (CONTEXT.md), shared by onboarding, the repository, and tests. No I/O here.
 */

/** Sex vocabulary from CONTEXT.md: required on the Child for growth charts. */
export type ChildSex = "female" | "male";

export const CHILD_SEXES: readonly ChildSex[] = ["female", "male"];

/** Input accepted when creating a Child (before id/timestamps exist). */
export interface ChildInput {
  readonly name: string;
  /** Calendar date, ISO `YYYY-MM-DD`. */
  readonly birthdate: string;
  readonly sex: ChildSex;
  /** App-relative path to a copied photo asset; omit when never picked. */
  readonly photo?: string | null;
}

/** A validated Child input, safe to persist. */
export interface ValidChild {
  readonly name: string;
  readonly birthdate: string;
  readonly sex: ChildSex;
  readonly photo: string | null;
}

/** One validation failure: which field, and a caregiver-readable reason. */
export interface ChildFieldError {
  readonly field: "name" | "birthdate" | "sex" | "photo";
  readonly message: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in strict `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Today's calendar date in UTC as `YYYY-MM-DD` (birthdates are dates, not instants). */
export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Validates Child creation input: name is required (non-blank), birthdate is
 * required, a real ISO date, and nonfuture, and sex is required (needed for
 * growth charts). Returns the cleaned value or the full list of field errors.
 */
export function validateChildInput(
  input: ChildInput,
  today: string = todayIsoDate()
): { ok: true; value: ValidChild } | { ok: false; errors: ChildFieldError[] } {
  const errors: ChildFieldError[] = [];

  const name = input.name.trim();
  if (name.length === 0) {
    errors.push({ field: "name", message: "Name is required." });
  }

  const birthdate = input.birthdate.trim();
  if (birthdate.length === 0) {
    errors.push({ field: "birthdate", message: "Birthdate is required." });
  } else if (!isIsoDate(birthdate)) {
    errors.push({
      field: "birthdate",
      message: "Birthdate must be a real date, YYYY-MM-DD.",
    });
  } else if (birthdate > today) {
    errors.push({
      field: "birthdate",
      message: "Birthdate cannot be in the future.",
    });
  }

  if (!CHILD_SEXES.includes(input.sex)) {
    errors.push({ field: "sex", message: "Sex is required." });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { name, birthdate, sex: input.sex, photo: input.photo ?? null },
  };
}

/**
 * Generates a UUIDv7 (RFC 9562): a 48-bit millisecond timestamp followed by
 * random bits, so ids sort roughly by creation time. Child ids are local
 * secrets only — no clock precision is meaningful beyond ordering.
 */
export function uuidv7(): string {
  const now = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now >>> 24) & 0xff;
  bytes[3] = (now >>> 16) & 0xff;
  bytes[4] = (now >>> 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = 0x70 | (bytes[6] & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // variant 10
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
