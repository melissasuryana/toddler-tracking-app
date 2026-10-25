import { isSlugId } from "@keepsake/local-data";
import seedData from "./food-seed.json" with { type: "json" };

export const FOOD_CATEGORIES = [
  "fruit",
  "vegetables",
  "grains & cereals",
  "proteins",
  "dairy",
  "nuts & seeds",
  "fish & shellfish",
  "compound",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const ALLERGEN_TAGS = [
  "milk",
  "egg",
  "peanut",
  "tree nuts",
  "soy",
  "wheat",
  "fish",
  "shellfish",
  "sesame",
] as const;

export type AllergenTag = (typeof ALLERGEN_TAGS)[number];
export type FoodSource = "seed" | "custom";

export interface Food {
  readonly id: string;
  readonly name: string;
  readonly category: FoodCategory | null;
  readonly allergenTags: readonly AllergenTag[];
  readonly source: FoodSource;
  readonly fdcId?: number;
}

interface FoodSeedData {
  readonly version: number;
  readonly source: string;
  readonly groups: readonly {
    readonly category: string;
    readonly allergenTags: readonly string[];
    readonly names: readonly string[];
  }[];
}

function isFoodCategory(value: string): value is FoodCategory {
  return FOOD_CATEGORIES.includes(value as FoodCategory);
}

function isAllergenTag(value: string): value is AllergenTag {
  return ALLERGEN_TAGS.includes(value as AllergenTag);
}

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSeedFoods(data: FoodSeedData): readonly Food[] {
  if (data.version !== 1 || !data.source.trim()) {
    throw new TypeError("Food seed data has an unsupported version or source.");
  }
  const ids = new Set<string>();
  const foods = data.groups.flatMap((group) => {
    const category = group.category;
    if (!isFoodCategory(category)) {
      throw new TypeError(`Unsupported Food Category: ${category}`);
    }
    if (group.allergenTags.some((tag) => !isAllergenTag(tag))) {
      throw new TypeError("Food seed contains an unsupported Allergen Tag.");
    }
    return group.names.map((name): Food => {
      const id = slugify(name);
      if (!name.trim() || !isSlugId(id) || ids.has(id)) {
        throw new TypeError(`Food seed name is blank or duplicated: ${name}`);
      }
      ids.add(id);
      return {
        id,
        name,
        category,
        allergenTags: [...group.allergenTags] as AllergenTag[],
        source: "seed",
      };
    });
  });
  if (foods.length < 250) {
    throw new TypeError("Food seed catalogue must contain roughly 300 Foods.");
  }
  return Object.freeze(
    foods.map((food) =>
      Object.freeze({
        ...food,
        allergenTags: Object.freeze([...food.allergenTags]),
      })
    )
  );
}

export const SEEDED_FOODS = buildSeedFoods(seedData as FoodSeedData);

export function isFoodCategoryValue(value: string): value is FoodCategory {
  return isFoodCategory(value);
}

export function isAllergenTagValue(value: string): value is AllergenTag {
  return isAllergenTag(value);
}
