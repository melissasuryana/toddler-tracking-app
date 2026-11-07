import type { Food } from "@keepsake/food-tracking";
import type { LoggedEntry } from "./entryPresentation.ts";

export interface EntryDetailField {
  readonly key:
    | "occurredAt"
    | "startAt"
    | "side"
    | "durationMinutes"
    | "change"
    | "note"
    | "duration"
    | "quality"
    | "factors"
    | "category"
    | "name"
    | "description"
    | "temperature"
    | "dose"
    | "weightKg"
    | "heightCm"
    | "headCircumferenceCm"
    | "amount"
    | "categories"
    | "allergenTags"
    | "textures"
    | "feedingStyles"
    | "foodId"
    | "texture"
    | "foodIds"
    | "severity"
    | "symptoms";
  readonly label: string;
  readonly value: string | readonly string[] | null;
  readonly readOnly?: boolean;
}

export function entryDetailText(value: EntryDetailField["value"]): string {
  return typeof value === "string"
    ? value || "Not recorded"
    : value === null
      ? "Not recorded"
      : value.join(", ") || "None recorded";
}

export function detailLabel(value: string): string {
  return value ? value[0]!.toLocaleUpperCase() + value.slice(1) : value;
}

export function entryTime(epoch: number, timezone: string): string {
  return new Date(epoch).toLocaleString(undefined, {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function entryDetailFields(
  entry: LoggedEntry,
  foods: readonly Food[]
): readonly EntryDetailField[] {
  const field = (
    key: EntryDetailField["key"],
    label: string,
    value: EntryDetailField["value"],
    readOnly = false
  ): EntryDetailField => ({ key, label, value, readOnly });
  const foodName = (id: string) =>
    foods.find((food) => food.id === id)?.name ?? "Unavailable Food";
  switch (entry.kind) {
    case "feed":
      return [
        field(
          "side",
          "Side",
          entry.content.side ? detailLabel(entry.content.side) : null
        ),
        field(
          "durationMinutes",
          "Duration",
          entry.content.durationSeconds === undefined
            ? null
            : `${entry.content.durationSeconds / 60} minutes`
        ),
      ];
    case "diaper_change":
      return [
        field("change", "Change", detailLabel(entry.content.change)),
        field("note", "Note", entry.content.note ?? null),
      ];
    case "sleep_session": {
      const minutes = Math.round(
        (entry.occurredAt - entry.content.startAt) / 60_000
      );
      return [
        field(
          "startAt",
          "Fell asleep",
          entryTime(entry.content.startAt, entry.occurredTz)
        ),
        field(
          "occurredAt",
          "Woke up",
          entryTime(entry.occurredAt, entry.occurredTz)
        ),
        field(
          "duration",
          "Duration",
          minutes >= 60
            ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
            : `${minutes} min`,
          true
        ),
        field("quality", "Quality", detailLabel(entry.content.quality)),
        field("factors", "Factors", entry.content.factors ?? []),
      ];
    }
    case "medical": {
      const content = entry.content;
      return [
        field("category", "Type", detailLabel(content.category)),
        ...(content.category === "medication" || content.category === "vaccine"
          ? [field("name", "Name", content.name)]
          : content.category === "symptom"
            ? [field("description", "Description", content.description)]
            : [
                field(
                  "temperature",
                  "Temperature",
                  `${content.value} °${content.unit}`
                ),
              ]),
        ...(content.category === "medication"
          ? [field("dose", "Dose", content.dose ?? null)]
          : []),
        field("note", "Note", content.note ?? null),
      ];
    }
    case "growth":
      return [
        field(
          "weightKg",
          "Weight",
          entry.content.weightKg === undefined
            ? null
            : `${entry.content.weightKg} kg`
        ),
        field(
          "heightCm",
          "Height",
          entry.content.heightCm === undefined
            ? null
            : `${entry.content.heightCm} cm`
        ),
        field(
          "headCircumferenceCm",
          "Head circumference",
          entry.content.headCircumferenceCm === undefined
            ? null
            : `${entry.content.headCircumferenceCm} cm`
        ),
      ];
    case "meal":
      return [
        field("name", "Meal name", entry.content.name ?? null),
        field("amount", "Amount eaten", `${entry.content.amount} of 5`),
        field(
          "categories",
          "Food categories",
          entry.content.categories.map(detailLabel)
        ),
        field(
          "allergenTags",
          "Allergens",
          entry.content.allergenTags.map(detailLabel)
        ),
        field("textures", "Texture", entry.content.textures.map(detailLabel)),
        field(
          "feedingStyles",
          "Feeding style",
          entry.content.feedingStyles.map(detailLabel)
        ),
        field("note", "Note", entry.content.note ?? null),
      ];
    case "introduction":
      return [
        field("foodId", "Food", foodName(entry.content.foodId)),
        field(
          "texture",
          "Texture",
          entry.content.texture ? detailLabel(entry.content.texture) : null
        ),
        field("note", "Note", entry.content.note ?? null),
      ];
    case "reaction":
      return [
        field(
          "foodIds",
          "Suspected foods",
          entry.content.foodIds.map(foodName)
        ),
        field("severity", "Severity", detailLabel(entry.content.severity)),
        field("symptoms", "Symptoms", entry.content.symptoms.map(detailLabel)),
        field("note", "Note", entry.content.note ?? null),
      ];
  }
}

export function entryDetailContext(entry: LoggedEntry): string | null {
  if (entry.kind === "introduction")
    return "Food status is derived from Introduction and Reaction history; it is context, not a field recorded on this Entry.";
  if (entry.kind === "reaction")
    return "Reaction history can affect Food status. Recorded symptoms and severity are observations, not a diagnosis.";
  return null;
}
