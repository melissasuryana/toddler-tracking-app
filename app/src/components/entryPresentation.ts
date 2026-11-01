import type { RoutineEntry } from "@keepsake/routine";
import type { IconName, TrackerKey } from "@keepsake/design-system";
import type { EntryKind } from "@keepsake/local-data";
import type {
  Food,
  FoodEntry,
  FoodStatusName,
  MealEntry,
} from "@keepsake/food-tracking";

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

export function timelineEntryPresentation(kind: EntryKind): {
  icon: IconName;
  tracker: TrackerKey;
} {
  switch (kind) {
    case "feed":
      return { icon: "feed", tracker: "feed" };
    case "diaper_change":
      return { icon: "diaper", tracker: "diaper" };
    case "sleep_session":
      return { icon: "sleep", tracker: "sleep" };
    case "medical":
      return { icon: "medical", tracker: "medical" };
    case "growth":
      return { icon: "growth", tracker: "growth" };
    case "meal":
      return { icon: "meal", tracker: "meal" };
    case "introduction":
      return { icon: "introduction", tracker: "introduction" };
    case "reaction":
      return { icon: "reaction", tracker: "reaction" };
  }
}

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

export function entriesForLocalDate(
  entries: readonly LoggedEntry[],
  date: string
): LoggedEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.deletedAt === null &&
        localDateKey(entry.occurredAt, entry.occurredTz) === date
    )
    .sort(
      (a, b) =>
        b.occurredAt - a.occurredAt ||
        b.createdAt - a.createdAt ||
        b.id.localeCompare(a.id)
    );
}

/** Monday-first calendar dates for the week containing an ISO local date. */
export function weekDates(date: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const monday = new Date(Date.UTC(year, month - 1, day - ((weekday + 6) % 7)));
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setUTCDate(monday.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

export function shiftCalendarDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function localDateKey(epoch: number, timezone: string): string {
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(epoch)
      .map(({ type, value }) => [type, value])
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

export function timelineEntrySummary(
  entry: LoggedEntry,
  foods: readonly Food[],
  foodStatus: (foodId: string) => FoodStatusName
): string {
  const foodName = (id: string) =>
    foods.find((food) => food.id === id)?.name ?? "Food";
  const withStatus = (id: string) =>
    `${foodName(id)} · ${capitalize(foodStatus(id))}`;

  if (entry.kind === "meal") return `${entry.content.amount}/5`;
  if (entry.kind === "introduction") return withStatus(entry.content.foodId);
  if (entry.kind === "reaction") {
    return entry.content.foodIds.map(withStatus).join(", ");
  }
  return entrySummary(entry, foods);
}

function capitalize(value: string): string {
  return value.length ? value[0]!.toUpperCase() + value.slice(1) : value;
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
