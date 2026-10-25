import type {
  RoutineEntry,
  RoutineEntryInput,
  RoutineEntryKind,
  SleepQuality,
} from "@keepsake/routine";
import type { EntryTimestamp } from "./entryTimestamp.ts";

export interface RoutineDraft {
  side: "" | "left" | "right";
  durationSeconds: string;
  change: "wet" | "dirty" | "both";
  note: string;
  category: "medication" | "vaccine" | "symptom" | "temperature";
  name: string;
  dose: string;
  description: string;
  value: string;
  unit: "C" | "F";
  weightKg: string;
  heightCm: string;
  headCircumferenceCm: string;
  quality: SleepQuality | null;
  factors: readonly string[];
}

export function routineDraft(
  entry?: RoutineEntry,
  unit: "C" | "F" = "C"
): RoutineDraft {
  const draft: RoutineDraft = {
    side: "",
    durationSeconds: "",
    change: "wet",
    note: "",
    category: "medication",
    name: "",
    dose: "",
    description: "",
    value: "",
    unit,
    weightKg: "",
    heightCm: "",
    headCircumferenceCm: "",
    quality: null,
    factors: [],
  };
  if (!entry) return draft;
  const content = entry.content;
  for (const key of [
    "durationSeconds",
    "value",
    "weightKg",
    "heightCm",
    "headCircumferenceCm",
  ] as const) {
    if (key in content)
      draft[key] = String(content[key as keyof typeof content] ?? "");
  }
  if ("note" in content) draft.note = content.note ?? "";
  switch (entry.kind) {
    case "feed":
      draft.side = entry.content.side ?? "";
      break;
    case "diaper_change":
      draft.change = entry.content.change;
      break;
    case "sleep_session":
      draft.quality = entry.content.quality;
      draft.factors = entry.content.factors ?? [];
      break;
    case "medical": {
      const medical = entry.content;
      draft.category = medical.category;
      if ("name" in medical) draft.name = medical.name;
      if ("dose" in medical) draft.dose = medical.dose ?? "";
      if ("description" in medical) draft.description = medical.description;
      if ("unit" in medical) draft.unit = medical.unit;
      break;
    }
  }
  return draft;
}

function numeric(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Enter a valid number.");
  return number;
}

export function routineInput(
  childId: string,
  kind: RoutineEntryKind,
  timestamp: EntryTimestamp,
  draft: RoutineDraft,
  startAt?: number
): RoutineEntryInput {
  const common = {
    childId,
    occurredAt: timestamp.occurredAt,
    occurredTz: timestamp.occurredTz,
  };
  switch (kind) {
    case "feed":
      return {
        ...common,
        kind,
        side: draft.side || undefined,
        durationSeconds: numeric(draft.durationSeconds),
      };
    case "diaper_change":
      return { ...common, kind, change: draft.change, note: draft.note };
    case "growth":
      return {
        ...common,
        kind,
        weightKg: numeric(draft.weightKg),
        heightCm: numeric(draft.heightCm),
        headCircumferenceCm: numeric(draft.headCircumferenceCm),
      };
    case "sleep_session":
      if (!draft.quality) throw new Error("Choose a Sleep quality.");
      if (startAt === undefined) throw new Error("Enter a Sleep start.");
      return {
        ...common,
        kind,
        startAt,
        quality: draft.quality,
        factors: draft.factors,
      };
    case "medical":
      switch (draft.category) {
        case "medication":
          return {
            ...common,
            kind,
            category: draft.category,
            name: draft.name,
            dose: draft.dose,
            note: draft.note,
          };
        case "vaccine":
          return {
            ...common,
            kind,
            category: draft.category,
            name: draft.name,
            note: draft.note,
          };
        case "symptom":
          return {
            ...common,
            kind,
            category: draft.category,
            description: draft.description,
            note: draft.note,
          };
        case "temperature": {
          const value = numeric(draft.value);
          if (value === undefined) throw new Error("Enter a temperature.");
          return {
            ...common,
            kind,
            category: draft.category,
            value,
            unit: draft.unit,
            note: draft.note,
          };
        }
      }
  }
}
