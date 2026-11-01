import type { StatusKey } from "@keepsake/design-system";
import type { Food, FoodEntry } from "@keepsake/food-tracking";

export interface FoodBrowserItem {
  readonly food: Food;
  readonly status: StatusKey;
}

export function filterFoodItems(
  items: readonly FoodBrowserItem[],
  options: {
    readonly query: string;
    readonly status: StatusKey | "all";
    readonly source: "seed" | "custom" | "all";
  }
): FoodBrowserItem[] {
  const query = options.query.trim().toLocaleLowerCase();
  return items.filter(({ food, status }) => {
    const matchesStatus = options.status === "all" || status === options.status;
    const matchesSource =
      options.source === "all" || food.source === options.source;
    const matchesQuery =
      !query ||
      [food.name, food.category ?? "", ...food.allergenTags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    return matchesStatus && matchesSource && matchesQuery;
  });
}

export function introductionHistoryForFood(
  entries: readonly FoodEntry[],
  foodId: string,
  now: number
): Extract<FoodEntry, { kind: "introduction" }>[] {
  return entries
    .filter(
      (entry): entry is Extract<FoodEntry, { kind: "introduction" }> =>
        entry.kind === "introduction" &&
        entry.content.foodId === foodId &&
        entry.occurredAt <= now
    )
    .sort(
      (left, right) =>
        right.occurredAt - left.occurredAt ||
        right.createdAt - left.createdAt ||
        right.id.localeCompare(left.id)
    );
}
