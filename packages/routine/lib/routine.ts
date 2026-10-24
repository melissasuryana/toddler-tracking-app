import {
  DEFAULT_TEMPERATURE_UNIT,
  EntryValidationError,
  type Entry,
  type EntryKind,
  type LocalDatabase,
  type EntryContent,
  type TemperatureUnit,
} from "@keepsake/local-data";

export type RoutineEntryKind =
  "feed" | "diaper_change" | "sleep_session" | "medical" | "growth";

interface RoutineTimestamp {
  readonly childId: string;
  readonly occurredAt: number;
  readonly occurredTz: string;
}

export type RoutineEntryInput =
  | (RoutineTimestamp & {
      readonly kind: "feed";
      readonly side?: "left" | "right";
      readonly durationSeconds?: number;
    })
  | (RoutineTimestamp & {
      readonly kind: "diaper_change";
      readonly change: "wet" | "dirty" | "both";
      readonly note?: string;
    })
  | (RoutineTimestamp & {
      readonly kind: "sleep_session";
      readonly startAt: number;
      readonly quality: "poor" | "okay" | "great";
      readonly factors?: readonly string[];
    })
  | (RoutineTimestamp & {
      readonly kind: "medical";
      readonly category: "medication" | "vaccine";
      readonly name: string;
      readonly dose?: string;
      readonly note?: string;
    })
  | (RoutineTimestamp & {
      readonly kind: "medical";
      readonly category: "symptom";
      readonly description: string;
      readonly note?: string;
    })
  | (RoutineTimestamp & {
      readonly kind: "medical";
      readonly category: "temperature";
      readonly value: number;
      readonly unit?: TemperatureUnit;
      readonly note?: string;
    })
  | (RoutineTimestamp & {
      readonly kind: "growth";
      readonly weightKg?: number;
      readonly heightCm?: number;
      readonly headCircumferenceCm?: number;
    });

export interface FeedContent {
  readonly side?: "left" | "right";
  readonly durationSeconds?: number;
}

export interface DiaperChangeContent {
  readonly change: "wet" | "dirty" | "both";
  readonly note?: string;
}

export interface SleepSessionContent {
  readonly startAt: number;
  readonly quality: "poor" | "okay" | "great";
  readonly factors?: readonly string[];
}

export type MedicalContent =
  | {
      readonly category: "medication";
      readonly name: string;
      readonly dose?: string;
      readonly note?: string;
    }
  | {
      readonly category: "vaccine";
      readonly name: string;
      readonly note?: string;
    }
  | {
      readonly category: "symptom";
      readonly description: string;
      readonly note?: string;
    }
  | {
      readonly category: "temperature";
      readonly value: number;
      readonly unit: TemperatureUnit;
      readonly note?: string;
    };

export interface GrowthContent {
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly headCircumferenceCm?: number;
}

export type RoutineEntryContent =
  | FeedContent
  | DiaperChangeContent
  | SleepSessionContent
  | MedicalContent
  | GrowthContent;

export type RoutineEntry =
  | (Omit<Entry, "kind"> & {
      readonly kind: "feed";
      readonly content: FeedContent;
    })
  | (Omit<Entry, "kind"> & {
      readonly kind: "diaper_change";
      readonly content: DiaperChangeContent;
    })
  | (Omit<Entry, "kind"> & {
      readonly kind: "sleep_session";
      readonly content: SleepSessionContent;
    })
  | (Omit<Entry, "kind"> & {
      readonly kind: "medical";
      readonly content: MedicalContent;
    })
  | (Omit<Entry, "kind"> & {
      readonly kind: "growth";
      readonly content: GrowthContent;
    });

export interface RoutineDayGroup {
  readonly localDate: string;
  readonly entries: readonly RoutineEntry[];
}

export type RoutineEntrySummary = Partial<
  Readonly<Record<RoutineEntryKind, RoutineEntry>>
>;

export interface RoutineFieldError {
  readonly field: string;
  readonly message: string;
}

export class RoutineValidationError extends Error {
  readonly errors: readonly RoutineFieldError[];

  constructor(errors: readonly RoutineFieldError[]) {
    super(errors.map(({ message }) => message).join(" "));
    this.name = "RoutineValidationError";
    this.errors = errors;
  }
}

export const SLEEP_QUALITY_FACTOR_SEEDS = [
  "many wakeups",
  "illness",
  "fussiness/cries",
  "long awake time",
] as const;

export class RoutineEntries {
  private readonly database: LocalDatabase;
  private readonly now: () => number;

  constructor(database: LocalDatabase, now: () => number = Date.now) {
    this.database = database;
    this.now = now;
  }

  create(input: RoutineEntryInput): RoutineEntry {
    const content = validateAndNormalize(
      input,
      this.now(),
      this.temperatureUnitDefault()
    );
    const entry = this.database.transaction((transaction) => {
      const created = transaction.entries.create({
        childId: input.childId,
        kind: input.kind,
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
      });
      transaction.entries.setContent(created.id, asEntryContent(content));
      return created;
    });
    return attachContent(entry, asEntryContent(content));
  }

  get(id: string): RoutineEntry | null {
    const entry = this.database.entries.get(id);
    if (!entry || !isRoutineKind(entry.kind)) return null;
    const content = this.database.entries.contentFor(id);
    return content ? attachContent(entry, content) : null;
  }

  listForChild(childId: string): RoutineEntry[] {
    return this.database.entries
      .listForChild(childId)
      .filter((entry): entry is Entry & { kind: RoutineEntryKind } =>
        isRoutineKind(entry.kind)
      )
      .flatMap((entry) => {
        const content = this.database.entries.contentFor(entry.id);
        return content ? [attachContent(entry, content)] : [];
      });
  }

  groupForChildByRecordedDay(childId: string): RoutineDayGroup[] {
    const groups = new Map<string, RoutineEntry[]>();
    for (const entry of this.listForChild(childId)) {
      const localDate = dateInTimezone(entry.occurredAt, entry.occurredTz);
      const entries = groups.get(localDate) ?? [];
      entries.push(entry);
      groups.set(localDate, entries);
    }
    return [...groups].map(([localDate, entries]) => ({
      localDate,
      entries,
    }));
  }

  latestEntriesForChild(childId: string): RoutineEntrySummary {
    const summary: Partial<Record<RoutineEntryKind, RoutineEntry>> = {};
    const kinds: readonly RoutineEntryKind[] = [
      "feed",
      "diaper_change",
      "sleep_session",
      "medical",
      "growth",
    ];
    for (const kind of kinds) {
      const entry = this.database.entries.latestForChildKind(childId, kind);
      const content = entry && this.database.entries.contentFor(entry.id);
      if (entry && content) summary[kind] = attachContent(entry, content);
    }
    return summary;
  }

  feedCountForChild(childId: string): number {
    return this.database.entries
      .listForChild(childId)
      .filter((entry) => entry.kind === "feed").length;
  }

  medicalNameSuggestions(
    childId: string,
    category: "medication" | "vaccine"
  ): string[] {
    const names = new Map<string, string>();
    const entries = this.database.entries
      .listForChild(childId)
      .sort(
        (left, right) =>
          right.occurredAt - left.occurredAt ||
          right.createdAt - left.createdAt ||
          left.id.localeCompare(right.id)
      );
    for (const entry of entries) {
      if (entry.kind !== "medical") continue;
      const content = this.database.entries.contentFor(entry.id);
      if (
        content?.category !== category ||
        typeof content.name !== "string" ||
        content.name.trim().length === 0
      ) {
        continue;
      }
      const name = content.name.trim();
      const key = name.toLowerCase();
      if (!names.has(key)) names.set(key, name);
    }
    return [...names.values()];
  }

  temperatureUnitDefault(): TemperatureUnit {
    return (
      this.database.preferences.get("temperatureUnit") ??
      DEFAULT_TEMPERATURE_UNIT
    );
  }

  update(id: string, input: RoutineEntryInput): RoutineEntry | null {
    const existingEntry = this.get(id);
    const existingUnit =
      input.kind === "medical" &&
      input.category === "temperature" &&
      existingEntry?.kind === "medical" &&
      existingEntry.content.category === "temperature" &&
      (existingEntry.content.unit === "C" || existingEntry.content.unit === "F")
        ? existingEntry.content.unit
        : this.temperatureUnitDefault();
    const content = validateAndNormalize(input, this.now(), existingUnit);
    const updated = this.database.transaction((transaction) => {
      let entry: Entry | null;
      try {
        entry = transaction.entries.update(id, {
          childId: input.childId,
          kind: input.kind,
          occurredAt: input.occurredAt,
          occurredTz: input.occurredTz,
        });
      } catch (error) {
        if (error instanceof EntryValidationError) {
          throw new RoutineValidationError(error.errors);
        }
        throw error;
      }
      if (!entry) return null;
      transaction.entries.setContent(id, asEntryContent(content));
      return entry;
    });
    return updated ? attachContent(updated, asEntryContent(content)) : null;
  }

  delete(id: string, deletedAt: number = this.now()): boolean {
    return this.database.transaction((transaction) => {
      const entry = transaction.entries.get(id);
      return (
        entry !== null &&
        isRoutineKind(entry.kind) &&
        transaction.entries.scrub(id, deletedAt)
      );
    });
  }
}

function validateAndNormalize(
  input: RoutineEntryInput,
  now: number,
  defaultTemperatureUnit: TemperatureUnit
): RoutineEntryContent {
  const errors: RoutineFieldError[] = [];
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
  if (
    input.kind === "sleep_session" &&
    (!Number.isSafeInteger(input.startAt) ||
      input.startAt < 0 ||
      input.startAt >= input.occurredAt)
  ) {
    errors.push({
      field: "startAt",
      message: "Sleep must end after its start time.",
    });
  }

  let content: Record<string, unknown>;
  switch (input.kind) {
    case "feed":
      content = {};
      if (input.side !== undefined) {
        if (input.side !== "left" && input.side !== "right") {
          errors.push({ field: "side", message: "Choose left or right." });
        } else {
          content.side = input.side;
        }
      }
      if (input.durationSeconds !== undefined) {
        if (
          !Number.isFinite(input.durationSeconds) ||
          input.durationSeconds < 0
        ) {
          errors.push({
            field: "durationSeconds",
            message: "Duration must be zero or greater.",
          });
        } else {
          content.durationSeconds = input.durationSeconds;
        }
      }
      break;
    case "diaper_change":
      content = { change: input.change };
      if (!["wet", "dirty", "both"].includes(input.change)) {
        errors.push({
          field: "change",
          message: "Choose wet, dirty, or both.",
        });
      }
      addOptionalText(content, "note", input.note, errors);
      break;
    case "sleep_session":
      content = { startAt: input.startAt, quality: input.quality };
      if (!["poor", "okay", "great"].includes(input.quality)) {
        errors.push({
          field: "quality",
          message: "Choose poor, okay, or great sleep quality.",
        });
      }
      if (input.factors !== undefined) {
        const factors = normalizeList(input.factors, "factors", errors);
        if (factors) content.factors = factors;
      }
      break;
    case "medical":
      content = { category: input.category };
      if (input.category === "medication" || input.category === "vaccine") {
        const name = normalizeRequiredText(input.name, "name", errors);
        if (name) content.name = name;
        if (input.category === "medication") {
          addOptionalText(content, "dose", input.dose, errors);
        }
      } else if (input.category === "symptom") {
        const description = normalizeRequiredText(
          input.description,
          "description",
          errors
        );
        if (description) content.description = description;
      } else if (input.category === "temperature") {
        if (!Number.isFinite(input.value)) {
          errors.push({
            field: "value",
            message: "Temperature must be a finite number.",
          });
        } else {
          content.value = input.value;
        }
        const unit =
          input.unit === undefined ? defaultTemperatureUnit : input.unit;
        if (unit !== "C" && unit !== "F") {
          errors.push({ field: "unit", message: "Choose °C or °F." });
        } else {
          content.unit = unit;
        }
      } else {
        errors.push({
          field: "category",
          message: "Choose a supported Medical Entry category.",
        });
      }
      addOptionalText(content, "note", input.note, errors);
      break;
    case "growth":
      content = {};
      for (const [field, value] of [
        ["weightKg", input.weightKg],
        ["heightCm", input.heightCm],
        ["headCircumferenceCm", input.headCircumferenceCm],
      ] as const) {
        if (value === undefined) continue;
        if (!Number.isFinite(value) || value <= 0) {
          errors.push({
            field,
            message: `${field} must be a finite value greater than zero.`,
          });
        } else {
          content[field] = value;
        }
      }
      if (Object.keys(content).length === 0) {
        errors.push({
          field: "growth",
          message: "Enter at least one growth measurement.",
        });
      }
      break;
  }

  if (errors.length > 0) throw new RoutineValidationError(errors);
  return content as RoutineEntryContent;
}

function normalizeRequiredText(
  value: string,
  field: string,
  errors: RoutineFieldError[]
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({ field, message: `${field} is required.` });
    return undefined;
  }
  return value.trim();
}

function addOptionalText(
  content: Record<string, unknown>,
  field: string,
  value: string | undefined,
  errors: RoutineFieldError[]
): void {
  if (value === undefined) return;
  if (typeof value !== "string") {
    errors.push({ field, message: `${field} must be text.` });
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length > 0) content[field] = trimmed;
}

function normalizeList(
  values: readonly string[],
  field: string,
  errors: RoutineFieldError[]
): string[] | undefined {
  if (!Array.isArray(values)) {
    errors.push({ field, message: `${field} must be a list of text values.` });
    return undefined;
  }
  const normalized = values.map((value) =>
    typeof value === "string" ? value.trim() : ""
  );
  if (normalized.some((value) => value.length === 0)) {
    errors.push({ field, message: `${field} cannot contain blank values.` });
    return undefined;
  }
  return [...new Set(normalized)];
}

function isRoutineKind(kind: EntryKind): kind is RoutineEntryKind {
  return [
    "feed",
    "diaper_change",
    "sleep_session",
    "medical",
    "growth",
  ].includes(kind);
}

function attachContent(entry: Entry, content: EntryContent): RoutineEntry {
  switch (entry.kind) {
    case "feed":
      return { ...entry, kind: "feed", content: content as FeedContent };
    case "diaper_change":
      return {
        ...entry,
        kind: "diaper_change",
        content: content as unknown as DiaperChangeContent,
      };
    case "sleep_session":
      return {
        ...entry,
        kind: "sleep_session",
        content: content as unknown as SleepSessionContent,
      };
    case "medical":
      return {
        ...entry,
        kind: "medical",
        content: content as unknown as MedicalContent,
      };
    case "growth":
      return {
        ...entry,
        kind: "growth",
        content: content as unknown as GrowthContent,
      };
    default:
      throw new TypeError("Entry is not a Routine Entry.");
  }
}

function asEntryContent(content: RoutineEntryContent): EntryContent {
  return content as unknown as EntryContent;
}

function dateInTimezone(epoch: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(epoch);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}
