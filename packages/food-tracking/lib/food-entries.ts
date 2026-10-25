import type {
  Entry,
  EntryContent,
  LocalDatabase,
  LocalTransaction,
} from "@keepsake/local-data";
import type { Food } from "./catalogue.ts";
import { FoodTracking } from "./food-tracking.ts";
import {
  MEAL_TEXTURES,
  MealEntries,
  type MealDefaults,
  type MealEntryInput,
  type MealTexture,
} from "./meals.ts";
import { deriveFoodStatus } from "./status.ts";

export const REACTION_SEVERITIES = ["mild", "moderate", "severe"] as const;
export const REACTION_SYMPTOMS = [
  "rash/hives",
  "vomiting",
  "diarrhea",
  "swelling",
  "breathing issues",
] as const;

export type ReactionSeverity = (typeof REACTION_SEVERITIES)[number];
export type ReactionSymptom = (typeof REACTION_SYMPTOMS)[number];

interface FoodEntryInput {
  readonly childId: string;
  readonly occurredAt: number;
  readonly occurredTz: string;
  readonly note?: string;
}

export interface IntroductionEntryInput extends FoodEntryInput {
  readonly foodId: string;
  readonly texture?: MealTexture | null;
}

export interface ReactionEntryInput extends FoodEntryInput {
  readonly foodIds: readonly string[];
  readonly severity: ReactionSeverity;
  readonly symptoms?: readonly ReactionSymptom[];
}

export interface IntroductionContent {
  readonly foodId: string;
  readonly texture?: MealTexture | null;
  readonly note?: string;
}

export interface ReactionContent {
  readonly foodIds: readonly string[];
  readonly severity: ReactionSeverity;
  readonly symptoms: readonly ReactionSymptom[];
  readonly note?: string;
}

export type IntroductionEntry = Omit<Entry, "kind"> & {
  readonly kind: "introduction";
  readonly content: IntroductionContent;
};

export type ReactionEntry = Omit<Entry, "kind"> & {
  readonly kind: "reaction";
  readonly content: ReactionContent;
};

export type FoodEntry = IntroductionEntry | ReactionEntry;

export class FoodEntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoodEntryValidationError";
  }
}

export class FoodEntries {
  private readonly database: LocalDatabase;
  private readonly foods: FoodTracking;

  constructor(database: LocalDatabase) {
    this.database = database;
    this.foods = new FoodTracking(database);
  }

  createIntroduction(input: IntroductionEntryInput): IntroductionEntry {
    const content = normalizeIntroductionContent(input);
    this.assertFoodsExist([content.foodId]);
    return this.database.transaction((transaction) => {
      const entry = transaction.entries.create({
        childId: input.childId,
        kind: "introduction",
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
      });
      transaction.entries.setContent(entry.id, toStoredContent(content));
      transaction.entries.addAssociation(entry.id, "food", content.foodId);
      return { ...entry, kind: "introduction", content };
    });
  }

  updateIntroduction(
    id: string,
    input: IntroductionEntryInput
  ): IntroductionEntry | null {
    const content = normalizeIntroductionContent(input);
    this.assertFoodsExist([content.foodId]);
    return this.database.transaction((transaction) => {
      const existing = transaction.entries.get(id);
      if (!existing || existing.kind !== "introduction") return null;
      const entry = this.updateEntry(transaction, existing, {
        childId: input.childId,
        kind: "introduction",
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
      });
      if (!entry) return null;
      transaction.entries.setContent(id, toStoredContent(content));
      this.replaceFoodAssociations(transaction, id, [content.foodId]);
      return { ...entry, kind: "introduction", content };
    });
  }

  createReaction(input: ReactionEntryInput): ReactionEntry {
    const content = normalizeReactionContent(input);
    this.assertFoodsExist(content.foodIds);
    return this.database.transaction((transaction) => {
      const entry = transaction.entries.create({
        childId: input.childId,
        kind: "reaction",
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
      });
      transaction.entries.setContent(entry.id, toStoredContent(content));
      for (const foodId of content.foodIds) {
        transaction.entries.addAssociation(entry.id, "food", foodId);
      }
      return { ...entry, kind: "reaction", content };
    });
  }

  updateReaction(id: string, input: ReactionEntryInput): ReactionEntry | null {
    const content = normalizeReactionContent(input);
    this.assertFoodsExist(content.foodIds);
    return this.database.transaction((transaction) => {
      const existing = transaction.entries.get(id);
      if (!existing || existing.kind !== "reaction") return null;
      const entry = this.updateEntry(transaction, existing, {
        childId: input.childId,
        kind: "reaction",
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
      });
      if (!entry) return null;
      transaction.entries.setContent(id, toStoredContent(content));
      this.replaceFoodAssociations(transaction, id, content.foodIds);
      return { ...entry, kind: "reaction", content };
    });
  }

  get(id: string): FoodEntry | null {
    const entry = this.database.entries.get(id);
    if (
      !entry ||
      (entry.kind !== "introduction" && entry.kind !== "reaction")
    ) {
      return null;
    }
    const content = this.database.entries.contentFor(id);
    if (!content) return null;
    return entry.kind === "introduction"
      ? {
          ...entry,
          isSeed: Boolean(entry.isSeed),
          kind: "introduction",
          content: normalizeIntroductionContent(
            content as unknown as IntroductionContent
          ),
        }
      : {
          ...entry,
          isSeed: Boolean(entry.isSeed),
          kind: "reaction",
          content: normalizeReactionContent(
            content as unknown as ReactionContent
          ),
        };
  }

  listForChild(childId: string): FoodEntry[] {
    return this.database.entries.listForChild(childId).flatMap((entry) => {
      const foodEntry = this.get(entry.id);
      return foodEntry ? [foodEntry] : [];
    });
  }

  delete(id: string, deletedAt: number = Date.now()): boolean {
    return this.database.transaction((transaction) => {
      const entry = transaction.entries.get(id);
      return (
        entry !== null &&
        (entry.kind === "introduction" || entry.kind === "reaction") &&
        transaction.entries.scrub(id, deletedAt)
      );
    });
  }

  reactionFoods(childId: string, now: number = Date.now()): Food[] {
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new RangeError(
        "Food tracking time must be UTC epoch milliseconds."
      );
    }
    const evidence = this.database.entries
      .listForChild(childId)
      .filter(
        (entry) =>
          entry.occurredAt <= now &&
          (entry.kind === "introduction" || entry.kind === "reaction")
      );
    const associations = new Map(
      evidence.map((entry) => [
        entry.id,
        this.database.entries.associationsFor(entry.id),
      ])
    );
    const markers = new Map(
      this.database.foods
        .listManualSafeMarkers(childId)
        .map((marker) => [marker.foodId, marker])
    );
    return this.foods
      .listFoods()
      .map((food) => ({
        food,
        trying:
          deriveFoodStatus(
            food.id,
            evidence,
            (entryId) => associations.get(entryId) ?? [],
            markers.get(food.id) ?? null,
            now
          ).status === "trying",
      }))
      .sort(
        (left, right) =>
          Number(right.trying) - Number(left.trying) ||
          left.food.name.localeCompare(right.food.name) ||
          left.food.id.localeCompare(right.food.id)
      )
      .map(({ food }) => food);
  }

  mealDraftForIntroduction(id: string): MealEntryInput {
    const introduction = this.get(id);
    if (!introduction || introduction.kind !== "introduction") {
      throw new FoodEntryValidationError("Introduction does not exist.");
    }
    const food = this.foods.getFood(introduction.content.foodId);
    if (!food) throw new FoodEntryValidationError("Food does not exist.");
    const defaults = new MealEntries(this.database).defaultsForChild(
      introduction.childId
    );
    return mealDraftFromIntroduction(introduction, food, defaults);
  }

  private assertFoodsExist(foodIds: readonly string[]): void {
    for (const foodId of foodIds) {
      if (!this.foods.getFood(foodId)) {
        throw new FoodEntryValidationError(`Food does not exist: ${foodId}`);
      }
    }
  }

  private updateEntry(
    transaction: LocalTransaction,
    existing: Entry,
    input: Pick<Entry, "childId" | "kind" | "occurredAt" | "occurredTz">
  ): Entry | null {
    if (
      input.childId !== existing.childId ||
      input.occurredTz !== existing.occurredTz ||
      input.occurredAt !== existing.occurredAt
    ) {
      const updated = transaction.entries.update(existing.id, input);
      return updated ? { ...updated, isSeed: Boolean(updated.isSeed) } : null;
    }
    // UPDATE OF occurred_at invalidates manual-safe even for the same value.
    const updatedAt = Math.max(Date.now(), existing.updatedAt + 1);
    this.database.driver
      .prepareSync("UPDATE entries SET updated_at = ? WHERE id = ?")
      .run(updatedAt, existing.id);
    return { ...existing, isSeed: Boolean(existing.isSeed), updatedAt };
  }

  private replaceFoodAssociations(
    transaction: LocalTransaction,
    entryId: string,
    foodIds: readonly string[]
  ): void {
    const existing = transaction.entries
      .associationsFor(entryId)
      .filter((association) => association.associationType === "food")
      .map((association) => association.associatedId);
    // Retain unchanged associations so content-only edits keep manual-safe.
    for (const foodId of existing) {
      if (!foodIds.includes(foodId)) {
        this.database.driver
          .prepareSync(
            `DELETE FROM entry_associations
             WHERE entry_id = ? AND association_type = 'food' AND associated_id = ?`
          )
          .run(entryId, foodId);
      }
    }
    for (const foodId of foodIds) {
      if (!existing.includes(foodId)) {
        transaction.entries.addAssociation(entryId, "food", foodId);
      }
    }
  }
}

export function mealDraftFromIntroduction(
  introduction: IntroductionEntry,
  food: Food,
  defaults: MealDefaults
): MealEntryInput {
  if (introduction.content.foodId !== food.id) {
    throw new FoodEntryValidationError("Introduction Food does not match.");
  }
  return {
    childId: introduction.childId,
    occurredAt: introduction.occurredAt,
    occurredTz: introduction.occurredTz,
    amount: 4,
    categories: food.category ? [food.category] : [],
    allergenTags: [...food.allergenTags],
    textures: introduction.content.texture
      ? [introduction.content.texture]
      : [],
    feedingStyles: [...defaults.feedingStyles],
  };
}

export function normalizeIntroductionContent(
  input: Pick<IntroductionEntryInput, "foodId" | "note" | "texture">
): IntroductionContent {
  assertFoodId(input.foodId);
  if (input.texture != null && !MEAL_TEXTURES.includes(input.texture)) {
    throw new FoodEntryValidationError("Choose a valid Texture.");
  }
  return {
    foodId: input.foodId,
    texture: input.texture ?? null,
    ...normalizeNote(input.note),
  };
}

export function normalizeReactionContent(
  input: Pick<ReactionEntryInput, "foodIds" | "severity" | "symptoms" | "note">
): ReactionContent {
  if (!Array.isArray(input.foodIds) || input.foodIds.length === 0) {
    throw new FoodEntryValidationError("Choose at least one Food.");
  }
  input.foodIds.forEach(assertFoodId);
  if (!REACTION_SEVERITIES.includes(input.severity)) {
    throw new FoodEntryValidationError("Choose a Reaction severity.");
  }
  const symptoms = input.symptoms === undefined ? [] : input.symptoms;
  if (
    !Array.isArray(symptoms) ||
    symptoms.some((symptom) => !REACTION_SYMPTOMS.includes(symptom))
  ) {
    throw new FoodEntryValidationError("Choose valid Reaction symptoms.");
  }
  return {
    foodIds: [...new Set(input.foodIds)],
    severity: input.severity,
    symptoms: [...new Set(symptoms)],
    ...normalizeNote(input.note),
  };
}

function assertFoodId(foodId: string): void {
  if (typeof foodId !== "string" || !foodId.trim()) {
    throw new FoodEntryValidationError("Choose a named Food.");
  }
}

function normalizeNote(note: string | undefined): { readonly note?: string } {
  if (note !== undefined && typeof note !== "string") {
    throw new FoodEntryValidationError("Note must be text.");
  }
  const normalized = note?.trim();
  return normalized ? { note: normalized } : {};
}

function toStoredContent(
  content: IntroductionContent | ReactionContent
): EntryContent {
  return content as unknown as EntryContent;
}
