import { uuidv7 } from "./child.ts";

export const ENTRY_KINDS = [
  "feed",
  "diaper_change",
  "sleep_session",
  "medical",
  "growth",
  "meal",
  "introduction",
  "reaction",
] as const;

export type EntryKind = (typeof ENTRY_KINDS)[number];

export interface EntryInput {
  readonly id?: string;
  readonly childId: string;
  readonly kind: EntryKind;
  readonly occurredAt: number;
  readonly occurredTz: string;
  readonly isSeed?: boolean;
}

export interface Entry extends Omit<EntryInput, "id" | "isSeed"> {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt: null;
  readonly isSeed: boolean;
}

export interface EntryFieldError {
  readonly field: keyof EntryInput;
  readonly message: string;
}

export interface ValidEntryInput extends EntryInput {
  readonly id: string;
  readonly isSeed: boolean;
}

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SLUG_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isUuidV7(value: string): boolean {
  return typeof value === "string" && UUID_V7.test(value);
}

export function isSlugId(value: string): boolean {
  return typeof value === "string" && SLUG_ID.test(value);
}

export function isIanaTimezone(value: string): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function validateEntryInput(
  input: EntryInput,
  now: number = Date.now()
):
  | { ok: true; value: ValidEntryInput }
  | { ok: false; errors: EntryFieldError[] } {
  const errors: EntryFieldError[] = [];
  const isSeed = input.isSeed ?? false;
  const id = input.id ?? (isSeed ? "" : uuidv7());

  if (!isUuidV7(input.childId)) {
    errors.push({ field: "childId", message: "Child id must be a UUIDv7." });
  }
  if (!ENTRY_KINDS.includes(input.kind)) {
    errors.push({ field: "kind", message: "Entry kind is not supported." });
  }
  if (!Number.isSafeInteger(input.occurredAt) || input.occurredAt < 0) {
    errors.push({
      field: "occurredAt",
      message: "Occurred time must be UTC epoch milliseconds.",
    });
  } else if (input.occurredAt > now) {
    errors.push({
      field: "occurredAt",
      message: "Occurred time cannot be in the future.",
    });
  }
  if (!isIanaTimezone(input.occurredTz)) {
    errors.push({
      field: "occurredTz",
      message: "Occurred timezone must be a valid IANA timezone.",
    });
  }
  if (isSeed ? !isSlugId(id) : !isUuidV7(id)) {
    errors.push({
      field: "id",
      message: isSeed
        ? "Seed Entry id must be a lowercase slug."
        : "Entry id must be a UUIDv7.",
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...input,
      id,
      occurredTz: input.occurredTz.trim(),
      isSeed,
    },
  };
}
