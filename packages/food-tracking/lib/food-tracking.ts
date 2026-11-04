import {
  isUuidV7,
  uuidv7,
  type LocalDatabase,
  type LocalTransaction,
  type StoredFoodInput,
} from "@keepsake/local-data";
import {
  FOOD_CATEGORIES,
  SEEDED_FOODS,
  isAllergenTagValue,
  type AllergenTag,
  type Food,
  type FoodCategory,
} from "./catalogue.ts";
import { foodIdsInHistory, statusFor } from "./status.ts";
import type {
  FoodStatusName,
  FoodWatchPeriod,
  IntroductionHeadsUp,
  ResetStatusCounts,
} from "./types.ts";

export interface CustomFoodInput {
  readonly name: string;
  readonly category?: FoodCategory | null;
  readonly allergenTags?: readonly AllergenTag[];
}

export interface FoodStatus {
  readonly foodId: string;
  readonly status: FoodStatusName;
  readonly exposureCount: number;
  readonly watchPeriod: FoodWatchPeriod | null;
  readonly safeReason: "watch-expired" | "manual" | null;
}

export interface IntroductionHeadsUpOptions {
  readonly suppress?: boolean;
  readonly excludeEntryId?: string;
}

export class FoodTracking {
  private readonly database: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.database = database;
  }

  listFoods(): Food[] {
    const custom = this.database.foods.listCustomFoods().map(toCustomFood);
    return [...SEEDED_FOODS, ...custom].sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    );
  }

  getFood(foodId: string): Food | null {
    const seeded = SEEDED_FOODS.find((food) => food.id === foodId);
    if (seeded) return seeded;
    const custom = this.database.foods.getCustomFood(foodId);
    return custom ? toCustomFood(custom) : null;
  }

  createCustomFood(input: CustomFoodInput): Food {
    const normalized = normalizeCustomFood(input);
    const stored = this.database.foods.createCustomFood({
      id: uuidv7(),
      ...normalized,
    });
    return toCustomFood(stored);
  }

  updateCustomFood(foodId: string, input: CustomFoodInput): Food {
    if (!isUuidV7(foodId) || !this.database.foods.getCustomFood(foodId)) {
      throw new Error("Only an existing custom Food can be edited.");
    }
    const normalized = normalizeCustomFood(input);
    return this.database.transaction((transaction) => {
      if (
        transaction.children
          .list()
          .some(
            (child) =>
              statusFor(transaction, child.id, foodId, Date.now()).status !==
              "untried"
          )
      ) {
        throw new Error("Only an untried custom Food can be edited.");
      }
      return toCustomFood(
        transaction.foods.updateCustomFood(foodId, normalized)
      );
    });
  }

  deleteCustomFood(foodId: string): boolean {
    if (!isUuidV7(foodId) || !this.database.foods.getCustomFood(foodId)) {
      return false;
    }
    return this.database.transaction((transaction) => {
      const children = transaction.children.list();
      if (
        children.some(
          (child) =>
            statusFor(transaction, child.id, foodId, Date.now()).status !==
            "untried"
        )
      ) {
        return false;
      }
      return transaction.foods.deleteCustomFood(foodId);
    });
  }

  statusFor(
    childId: string,
    foodId: string,
    now: number = Date.now()
  ): FoodStatus {
    this.assertFoodExists(foodId);
    assertInstant(now);
    return statusFor(this.database, childId, foodId, now);
  }

  markSafe(
    childId: string,
    foodId: string,
    now: number = Date.now()
  ): FoodStatus | null {
    this.assertFoodExists(foodId);
    assertInstant(now);
    return this.database.transaction((transaction) => {
      const current = statusFor(transaction, childId, foodId, now);
      if (current.status !== "trying" && current.status !== "untried") return null;
      const cycleEntryId =
        current.status === "trying" && current.watchPeriod
          ? current.watchPeriod.openingIntroductionId
          : null;
      transaction.foods.setManualSafeMarker(
        childId,
        foodId,
        cycleEntryId
      );
      return statusFor(transaction, childId, foodId, now);
    });
  }

  resetStatusCounts(childId: string, foodId: string): ResetStatusCounts {
    this.assertFoodExists(foodId);
    const childEntries = this.database.entries.listForChild(childId);
    let introductionCount = 0;
    let singleReactionCount = 0;
    let sharedReactionCount = 0;

    for (const entry of childEntries) {
      if (entry.kind === "introduction") {
        const associations = this.database.entries.associationsFor(entry.id);
        if (
          associations.some(
            (a) => a.associationType === "food" && a.associatedId === foodId
          )
        ) {
          introductionCount += 1;
        }
      } else if (entry.kind === "reaction") {
        const foodAssociations = this.database.entries
          .associationsFor(entry.id)
          .filter((a) => a.associationType === "food");
        const matches = foodAssociations.some((a) => a.associatedId === foodId);
        if (matches) {
          if (foodAssociations.length <= 1) {
            singleReactionCount += 1;
          } else {
            sharedReactionCount += 1;
          }
        }
      }
    }

    const marker = this.database.foods.manualSafeMarker(childId, foodId);
    const hasManualSafeDecision = marker !== null;
    const canReset =
      introductionCount > 0 ||
      singleReactionCount > 0 ||
      sharedReactionCount > 0 ||
      hasManualSafeDecision;

    return {
      introductionCount,
      singleReactionCount,
      sharedReactionCount,
      hasManualSafeDecision,
      canReset,
    };
  }

  resetStatus(
    childId: string,
    foodId: string,
    now: number = Date.now()
  ): FoodStatus {
    this.assertFoodExists(foodId);
    assertInstant(now);
    return this.database.transaction((transaction) => {
      const counts = this.resetStatusCounts(childId, foodId);
      if (!counts.canReset) {
        throw new Error("Food is already untried with no tracking history.");
      }
      const childEntries = transaction.entries.listForChild(childId);
      for (const entry of childEntries) {
        if (entry.kind === "introduction") {
          const associations = transaction.entries.associationsFor(entry.id);
          if (
            associations.some(
              (a) => a.associationType === "food" && a.associatedId === foodId
            )
          ) {
            transaction.entries.scrub(entry.id, now);
          }
        } else if (entry.kind === "reaction") {
          const foodAssociations = transaction.entries
            .associationsFor(entry.id)
            .filter((a) => a.associationType === "food");
          const matches = foodAssociations.some(
            (a) => a.associatedId === foodId
          );
          if (matches) {
            if (foodAssociations.length <= 1) {
              transaction.entries.scrub(entry.id, now);
            } else {
              transaction.entries.removeAssociation(entry.id, "food", foodId);
              const content = transaction.entries.contentFor(entry.id);
              if (content && Array.isArray((content as { foodIds?: unknown }).foodIds)) {
                const updatedFoodIds = (
                  (content as { foodIds: string[] }).foodIds
                ).filter((id) => id !== foodId);
                transaction.entries.setContent(entry.id, {
                  ...content,
                  foodIds: updatedFoodIds,
                });
              }
              const updatedAt = Math.max(now, entry.updatedAt + 1);
              this.database.driver
                .prepareSync(
                  "UPDATE entries SET updated_at = ? WHERE id = ?"
                )
                .run(updatedAt, entry.id);
            }
          }
        }
      }

      transaction.foods.clearManualSafeMarker(childId, foodId);

      return statusFor(transaction, childId, foodId, now);
    });
  }

  introductionHeadsUps(
    childId: string,
    foodId: string,
    occurredAt: number,
    options: IntroductionHeadsUpOptions = {}
  ): IntroductionHeadsUp[] {
    this.assertFoodExists(foodId);
    assertInstant(occurredAt);
    if (options.suppress) return [];

    const transaction: LocalTransaction = this.database;
    const targetStatus = statusFor(
      transaction,
      childId,
      foodId,
      occurredAt,
      options.excludeEntryId
    );
    return introductionHeadsUpsFrom(
      this.getFood(foodId)!,
      targetStatus,
      foodIdsInHistory(transaction, childId).map((otherFoodId) =>
        statusFor(
          transaction,
          childId,
          otherFoodId,
          occurredAt,
          options.excludeEntryId
        )
      ),
      options
    );
  }

  private assertFoodExists(foodId: string): void {
    if (!this.getFood(foodId))
      throw new Error(`Food does not exist: ${foodId}`);
  }
}

export function introductionHeadsUpsFrom(
  food: Food,
  targetStatus: FoodStatus,
  otherStatuses: readonly FoodStatus[],
  options: IntroductionHeadsUpOptions = {}
): IntroductionHeadsUp[] {
  if (options.suppress) return [];
  const headsUps: IntroductionHeadsUp[] = [];
  if (targetStatus.exposureCount === 0 && food.allergenTags.length > 0) {
    headsUps.push({ kind: "first-allergen-food", foodId: food.id });
  }
  for (const status of otherStatuses) {
    if (status.foodId !== food.id && status.status === "trying") {
      headsUps.push({
        kind: "overlapping-introductions",
        foodId: status.foodId,
      });
    }
  }
  return headsUps;
}

function normalizeCustomFood(
  input: CustomFoodInput
): Omit<StoredFoodInput, "id"> {
  const name = input.name.trim();
  if (!name) throw new TypeError("Food name is required.");
  const category = input.category ?? null;
  if (category !== null && !FOOD_CATEGORIES.includes(category)) {
    throw new TypeError("Food Category is not supported.");
  }
  const allergenTags = [...new Set(input.allergenTags ?? [])];
  if (allergenTags.some((tag) => !isAllergenTagValue(tag))) {
    throw new TypeError("Allergen Tag is not supported.");
  }
  return { name, category, allergenTags };
}

function toCustomFood(food: {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly allergenTags: readonly string[];
}): Food {
  return Object.freeze({
    id: food.id,
    name: food.name,
    category: food.category as FoodCategory | null,
    allergenTags: Object.freeze([
      ...food.allergenTags,
    ]) as readonly AllergenTag[],
    source: "custom" as const,
  });
}

function assertInstant(instant: number): void {
  if (!Number.isSafeInteger(instant) || instant < 0) {
    throw new RangeError("Food tracking time must be UTC epoch milliseconds.");
  }
}
