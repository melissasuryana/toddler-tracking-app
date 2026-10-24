import {
  type Entry,
  type EntryContent,
  type LocalDatabase,
} from "@keepsake/local-data";
import {
  ALLERGEN_TAGS,
  FOOD_CATEGORIES,
  type AllergenTag,
  type FoodCategory,
} from "./catalogue.ts";

export const MEAL_TEXTURES = [
  "purée",
  "mashed",
  "soft finger food",
  "firm finger food",
] as const;

export const MEAL_FEEDING_STYLES = [
  "spoon-fed",
  "self-fed with hands",
  "self-fed with utensils",
] as const;

export type MealTexture = (typeof MEAL_TEXTURES)[number];
export type MealFeedingStyle = (typeof MEAL_FEEDING_STYLES)[number];

export interface MealContent {
  readonly amount: number;
  readonly name?: string;
  readonly note?: string;
  readonly categories: readonly FoodCategory[];
  readonly allergenTags: readonly AllergenTag[];
  readonly textures: readonly MealTexture[];
  readonly feedingStyles: readonly MealFeedingStyle[];
}

export type MealEntry = Omit<Entry, "kind"> & {
  readonly kind: "meal";
  readonly content: MealContent;
};

export interface MealEntryInput {
  readonly childId: string;
  readonly occurredAt: number;
  readonly occurredTz: string;
  readonly amount?: number;
  readonly name?: string;
  readonly note?: string;
  readonly categories?: readonly FoodCategory[];
  readonly allergenTags?: readonly AllergenTag[];
  readonly textures?: readonly MealTexture[];
  readonly feedingStyles?: readonly MealFeedingStyle[];
}

export type MealDefaults = Pick<MealContent, "textures" | "feedingStyles">;

export interface MealNameSuggestion extends MealDefaults {
  readonly name: string;
  readonly categories: readonly FoodCategory[];
  readonly allergenTags: readonly AllergenTag[];
}

export class MealValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MealValidationError";
  }
}

const EMPTY_DEFAULTS: MealDefaults = Object.freeze({
  textures: Object.freeze([]),
  feedingStyles: Object.freeze([]),
});

export class MealEntries {
  private readonly database: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.database = database;
  }

  create(input: MealEntryInput): MealEntry {
    const content = validateAndNormalize(input);
    const entry = this.database.transaction((transaction) => {
      const created = transaction.entries.create({
        childId: input.childId,
        kind: "meal",
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
      });
      transaction.entries.setContent(created.id, toEntryContent(content));
      return created;
    });
    return attachContent(entry, content);
  }

  get(id: string): MealEntry | null {
    const entry = this.database.entries.get(id);
    if (!entry || entry.kind !== "meal") return null;
    const content = this.database.entries.contentFor(id);
    return content ? attachContent(entry, fromEntryContent(content)) : null;
  }

  listForChild(childId: string): MealEntry[] {
    return this.database.entries
      .listForChild(childId)
      .filter((entry) => entry.kind === "meal")
      .sort(
        (left, right) =>
          right.occurredAt - left.occurredAt ||
          right.createdAt - left.createdAt ||
          left.id.localeCompare(right.id)
      )
      .flatMap((entry) => {
        const content = this.database.entries.contentFor(entry.id);
        return content
          ? [attachContent(entry, fromEntryContent(content))]
          : [];
      });
  }

  defaultsForChild(childId: string): MealDefaults {
    const latest = this.listForChild(childId)[0];
    return latest
      ? {
          textures: latest.content.textures,
          feedingStyles: latest.content.feedingStyles,
        }
      : EMPTY_DEFAULTS;
  }

  nameSuggestions(
    childId: string,
    query = "",
    limit = 10
  ): MealNameSuggestion[] {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new RangeError("Suggestion limit must be a nonnegative integer.");
    }
    if (limit === 0) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const seen = new Set<string>();
    const suggestions: MealNameSuggestion[] = [];
    for (const meal of this.listForChild(childId)) {
      const name = meal.content.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key) || !key.includes(normalizedQuery)) continue;
      seen.add(key);
      suggestions.push({
        name,
        categories: meal.content.categories,
        allergenTags: meal.content.allergenTags,
        textures: meal.content.textures,
        feedingStyles: meal.content.feedingStyles,
      });
      if (suggestions.length === limit) break;
    }
    return suggestions;
  }

  update(id: string, input: MealEntryInput): MealEntry | null {
    const content = validateAndNormalize(input);
    const updated = this.database.transaction((transaction) => {
      const entry = transaction.entries.update(id, {
        childId: input.childId,
        kind: "meal",
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
      });
      if (!entry) return null;
      transaction.entries.setContent(id, toEntryContent(content));
      return entry;
    });
    return updated ? attachContent(updated, content) : null;
  }

  delete(id: string, deletedAt: number = Date.now()): boolean {
    return this.database.transaction((transaction) => {
      const entry = transaction.entries.get(id);
      return (
        entry !== null &&
        entry.kind === "meal" &&
        transaction.entries.scrub(id, deletedAt)
      );
    });
  }
}

function validateAndNormalize(input: MealEntryInput): MealContent {
  const amount = input.amount ?? 4;
  if (!Number.isInteger(amount) || amount < 1 || amount > 5) {
    throw new MealValidationError("Amount eaten must be from 1 to 5.");
  }

  let name: string | undefined;
  if (input.name !== undefined) {
    if (typeof input.name !== "string") {
      throw new MealValidationError("Meal name must be text.");
    }
    name = input.name.trim() || undefined;
    if (name && name.length > 100) {
      throw new MealValidationError("Meal name must be 100 characters or fewer.");
    }
  }

  let note: string | undefined;
  if (input.note !== undefined) {
    if (typeof input.note !== "string") {
      throw new MealValidationError("Meal note must be text.");
    }
    note = input.note.trim() || undefined;
  }

  const categories = normalizeChoices(
    input.categories ?? [],
    FOOD_CATEGORIES,
    "Food Category"
  );
  const allergenTags = normalizeChoices(
    input.allergenTags ?? [],
    ALLERGEN_TAGS,
    "Allergen Tag"
  );
  const textures = normalizeChoices(input.textures ?? [], MEAL_TEXTURES, "Texture");
  const feedingStyles = normalizeChoices(
    input.feedingStyles ?? [],
    MEAL_FEEDING_STYLES,
    "Feeding Style"
  );

  return {
    amount,
    ...(name ? { name } : {}),
    ...(note ? { note } : {}),
    categories,
    allergenTags,
    textures,
    feedingStyles,
  };
}

function normalizeChoices<T extends string>(
  values: readonly T[],
  allowed: readonly T[],
  label: string
): T[] {
  if (!Array.isArray(values) || values.some((value) => !allowed.includes(value))) {
    throw new MealValidationError(`Choose valid ${label} values.`);
  }
  return [...new Set(values)];
}

function attachContent(entry: Entry, content: MealContent): MealEntry {
  return { ...entry, kind: "meal", content };
}

function toEntryContent(content: MealContent): EntryContent {
  return content as unknown as EntryContent;
}

function fromEntryContent(content: EntryContent): MealContent {
  return {
    amount: content.amount as number,
    name: content.name as string | undefined,
    note: content.note as string | undefined,
    categories: content.categories as readonly FoodCategory[],
    allergenTags: content.allergenTags as readonly AllergenTag[],
    textures: content.textures as readonly MealTexture[],
    feedingStyles: content.feedingStyles as readonly MealFeedingStyle[],
  };
}
