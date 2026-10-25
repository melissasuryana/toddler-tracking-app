import type { RoutineEntry } from "@keepsake/routine";
import type { Food, FoodEntry, MealEntry } from "@keepsake/food-tracking";

export type LoggedEntry = RoutineEntry | FoodEntry | MealEntry;

export const ENTRY_LABELS = {
  feed: "Feed",
  diaper_change: "Diaper Change",
  sleep_session: "Sleep Session",
  medical: "Medical Entry",
  growth: "Growth Measurement",
  meal: "Meal",
  introduction: "Introduction",
  reaction: "Reaction",
} as const;

export function latestEntries(
  entries: readonly (
    LoggedEntry | { readonly id: string; readonly deletedAt: number }
  )[],
  childId: string,
  limit = 10
) {
  return entries
    .filter(
      (entry): entry is LoggedEntry =>
        entry.deletedAt === null && entry.childId === childId
    )
    .sort(
      (a, b) =>
        b.occurredAt - a.occurredAt ||
        b.createdAt - a.createdAt ||
        b.id.localeCompare(a.id)
    )
    .slice(0, limit);
}

export function entrySummary(
  entry: LoggedEntry,
  foods: readonly Food[] = []
): string {
  const foodName = (id: string) =>
    foods.find((food) => food.id === id)?.name ?? "Food";
  switch (entry.kind) {
    case "feed":
      return [
        "Breastfeeding",
        entry.content.side,
        entry.content.durationSeconds === undefined
          ? ""
          : `${entry.content.durationSeconds}s`,
      ]
        .filter(Boolean)
        .join(" · ");
    case "diaper_change":
      return entry.content.change;
    case "sleep_session":
      return `${Math.round((entry.occurredAt - entry.content.startAt) / 60_000)}m · ${entry.content.quality}`;
    case "growth":
      return [
        entry.content.weightKg === undefined
          ? ""
          : `${entry.content.weightKg} kg`,
        entry.content.heightCm === undefined
          ? ""
          : `${entry.content.heightCm} cm height`,
        entry.content.headCircumferenceCm === undefined
          ? ""
          : `${entry.content.headCircumferenceCm} cm head`,
      ]
        .filter(Boolean)
        .join(" · ");
    case "medical": {
      const content = entry.content;
      return content.category === "temperature"
        ? `${content.value} °${content.unit}`
        : content.category === "symptom"
          ? content.description
          : `${content.category} · ${content.name}${content.category === "medication" && content.dose ? ` · ${content.dose}` : ""}`;
    }
    case "meal":
      return `${entry.content.name || "Meal"} · ${entry.content.amount}/5`;
    case "introduction":
      return foodName(entry.content.foodId);
    case "reaction":
      return `${entry.content.severity} · ${entry.content.foodIds.map(foodName).join(", ")}`;
  }
}
