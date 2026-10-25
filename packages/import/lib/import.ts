import {
  ALLERGEN_TAGS,
  FOOD_CATEGORIES,
  FoodEntries,
  FoodTracking,
  type AllergenTag,
  type CustomFoodInput,
  type Food,
  type IntroductionEntryInput,
} from "@keepsake/food-tracking";
import {
  isIanaTimezone,
  type Child,
  type LocalDatabase,
} from "@keepsake/local-data";
import { parseCsv } from "./csv.ts";
import { civilDateAt, firstInstantOfDate } from "./dates.ts";

export interface ImportStore {
  child(id: string): Pick<Child, "id" | "name"> | null;
  foods(): readonly Food[];
  tracked(childId: string, foodId: string, now: number): boolean;
  createFood(input: CustomFoodInput): Food;
  introduce(input: IntroductionEntryInput): void;
  transaction<T>(operation: () => T): T;
}

export function sqliteImportStore(database: LocalDatabase): ImportStore {
  const foods = new FoodTracking(database);
  const entries = new FoodEntries(database);
  return {
    child: (id) =>
      database.children.list().find((child) => child.id === id) ?? null,
    foods: () => foods.listFoods(),
    tracked: (childId, foodId, now) =>
      foods.statusFor(childId, foodId, now).status !== "untried",
    createFood: (input) => foods.createCustomFood(input),
    introduce: (input) => {
      entries.createIntroduction(input);
    },
    transaction: (operation) => database.transaction(() => operation()),
  };
}

export interface ImportOptions {
  readonly childId: string;
  readonly fallbackDate: string;
  readonly timeZone: string;
}

export interface ImportRow {
  readonly line: number;
  readonly name: string;
  readonly classification: "import" | "skipped" | "duplicate" | "failed";
  readonly reason: string;
  readonly warnings: readonly string[];
  readonly foodId: string | null;
  readonly newFood: boolean;
  readonly category: Food["category"];
  readonly allergenTags: readonly AllergenTag[];
  readonly occurredAt: number | null;
  readonly date: string | null;
}

export interface ImportReport {
  readonly childId: string;
  readonly childName: string;
  readonly timeZone: string;
  readonly fallbackDate: string;
  readonly rows: readonly ImportRow[];
  readonly counts: {
    readonly total: number;
    readonly toImport: number;
    readonly newFoods: number;
    /** Includes duplicates; toImport + skipped + failed partitions data rows. */
    readonly skipped: number;
    /** Subset of skipped, not an additional row classification count. */
    readonly duplicates: number;
    readonly failed: number;
    /** Overlaps row classifications; a row with several warnings counts once. */
    readonly warned: number;
  };
  readonly abortReason: string | null;
}

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
const displayName = (value: string) => value.trim().replace(/\s+/g, " ");
const HEADERS = ["name", "date", "category", "allergens"] as const;

export class TriedFoodImport {
  private readonly store: ImportStore;
  private readonly clock: () => number;
  private readonly previews = new WeakMap<
    ImportReport,
    { csv: string; options: ImportOptions }
  >();

  constructor(store: ImportStore, clock: () => number = Date.now) {
    this.store = store;
    this.clock = clock;
  }

  preview(csv: string, options: ImportOptions): ImportReport {
    const report = this.classify(csv, options);
    this.previews.set(report, { csv, options: { ...options } });
    return report;
  }

  commit(
    preview: ImportReport,
    confirmation: { readonly confirmFallback: boolean }
  ): ImportReport {
    const source = this.previews.get(preview);
    if (!source)
      throw new Error("Create a preview in this import session first.");
    if (preview.abortReason) throw new Error(preview.abortReason);
    if (!confirmation.confirmFallback)
      throw new Error("Confirm the fallback date before importing.");
    return this.store.transaction(() => {
      // Re-read the catalogue and current status inside the write transaction.
      const report = this.classify(source.csv, source.options);
      if (report.abortReason) return report;
      for (const row of report.rows) {
        if (row.classification !== "import") continue;
        const foodId =
          row.foodId ??
          this.store.createFood({
            name: row.name,
            category: row.category,
            allergenTags: row.allergenTags,
          }).id;
        this.store.introduce({
          childId: report.childId,
          foodId,
          occurredAt: row.occurredAt!,
          occurredTz: report.timeZone,
        });
      }
      return report;
    });
  }

  private classify(csv: string, options: ImportOptions): ImportReport {
    const now = this.clock();
    if (!Number.isSafeInteger(now) || now < 0)
      throw new Error("Invalid current time.");
    const child = this.store.child(options.childId);
    if (!child) throw new Error("The target Child is no longer available.");
    if (/^[+-]/.test(options.timeZone) || !isIanaTimezone(options.timeZone)) {
      throw new Error("Choose a valid IANA timezone.");
    }
    const fallbackInstant = firstInstantOfDate(
      options.fallbackDate,
      options.timeZone
    );
    if (
      fallbackInstant === null ||
      fallbackInstant > now ||
      options.fallbackDate > civilDateAt(now, options.timeZone)
    ) {
      throw new Error(
        "Fallback must be an existing, nonfuture YYYY-MM-DD date."
      );
    }
    const catalogue = [...this.store.foods()].sort(
      (a, b) =>
        Number(a.source === "custom") - Number(b.source === "custom") ||
        a.id.localeCompare(b.id)
    );
    const byName = new Map<string, Food>();
    for (const food of catalogue) {
      const key = normalize(food.name);
      if (!byName.has(key)) byName.set(key, food);
    }
    const rows: ImportRow[] = [];
    let abortReason: string | null = null;
    try {
      const parsed = parseCsv(csv);
      const first = parsed[0];
      const firstHeaders =
        first?.cells.map((cell) => {
          const header = normalize(cell);
          return header === "food category" ? "category" : header;
        }) ?? [];
      const hasHeader =
        firstHeaders.includes("name") &&
        (firstHeaders.length > 1 || firstHeaders[0] === "name");
      let columns: readonly string[] = ["name"];
      let width = 1;
      if (hasHeader) {
        if (
          first!.malformed ||
          firstHeaders.some(
            (header) => !HEADERS.includes(header as (typeof HEADERS)[number])
          ) ||
          new Set(firstHeaders).size !== firstHeaders.length
        ) {
          throw new Error(
            "Use unique name, date, category, allergens headers."
          );
        }
        columns = firstHeaders;
        width = columns.length;
      }
      const seen = new Set<string>();
      const dateCache = new Map<string, number | null>();
      for (const record of parsed.slice(hasHeader ? 1 : 0)) {
        const get = (column: string) =>
          record.cells[columns.indexOf(column)] ?? "";
        const name = displayName(get("name"));
        const base = {
          line: record.line,
          name,
          warnings: [] as string[],
          foodId: null,
          newFood: false,
          category: null,
          allergenTags: [] as AllergenTag[],
          occurredAt: null,
          date: null,
        };
        if (record.malformed || record.cells.length !== width || !name) {
          rows.push({
            ...base,
            classification: "failed",
            reason: !name
              ? "Name is empty."
              : "Malformed row: wrong column count or quoting.",
          });
          continue;
        }
        const key = normalize(name);
        const food = byName.get(key);
        if (seen.has(key)) {
          rows.push({
            ...base,
            classification: "duplicate",
            reason: "First importable occurrence wins.",
          });
          continue;
        }
        if (food && this.store.tracked(child.id, food.id, now)) {
          rows.push({
            ...base,
            foodId: food.id,
            classification: "skipped",
            reason: "Food is already tracked for this Child.",
          });
          continue;
        }
        const warnings: string[] = [];
        const rawCategory = normalize(get("category"));
        const category =
          FOOD_CATEGORIES.find((value) => value === rawCategory) ?? null;
        if (rawCategory && !category)
          warnings.push("Unknown category dropped.");
        const allergenTags: AllergenTag[] = [];
        for (const token of get("allergens")
          .split(";")
          .map(normalize)
          .filter(Boolean)) {
          const tag = ALLERGEN_TAGS.find((value) => value === token);
          if (!tag) warnings.push(`Unknown allergen "${token}" dropped.`);
          else if (!allergenTags.includes(tag)) allergenTags.push(tag);
        }
        const rawDate = get("date");
        if (!dateCache.has(rawDate))
          dateCache.set(rawDate, firstInstantOfDate(rawDate, options.timeZone));
        const instant = dateCache.get(rawDate) ?? null;
        const useFallback = instant === null || instant > now;
        if (useFallback)
          warnings.push(
            "Missing, invalid, nonexistent or future date: use confirmed fallback."
          );
        if (food && (get("category") || get("allergens"))) {
          warnings.push(
            "Existing Food metadata retained; CSV metadata ignored."
          );
        }
        seen.add(key);
        rows.push({
          ...base,
          classification: "import",
          reason: food ? "Reuse existing Food." : "Create custom Food.",
          warnings,
          foodId: food?.id ?? null,
          newFood: !food,
          category: food ? food.category : category,
          allergenTags: food ? food.allergenTags : allergenTags,
          occurredAt: useFallback ? fallbackInstant : instant,
          date: useFallback ? options.fallbackDate : rawDate,
        });
      }
    } catch (error) {
      abortReason = error instanceof Error ? error.message : "Unparseable CSV.";
    }
    const count = (classification: ImportRow["classification"]) =>
      rows.filter((row) => row.classification === classification).length;
    const counts = {
      total: rows.length,
      toImport: count("import"),
      newFoods: rows.filter((row) => row.newFood).length,
      skipped: count("skipped") + count("duplicate"),
      duplicates: count("duplicate"),
      failed: count("failed"),
      warned: rows.filter((row) => row.warnings.length > 0).length,
    };
    if (!abortReason && counts.failed > counts.total / 2)
      abortReason = "More than half the data rows failed.";
    if (!abortReason && !counts.toImport) abortReason = "Nothing to import.";
    return Object.freeze({
      childId: child.id,
      childName: child.name,
      timeZone: options.timeZone,
      fallbackDate: options.fallbackDate,
      rows: Object.freeze(
        rows.map((row) =>
          Object.freeze({
            ...row,
            warnings: Object.freeze([...row.warnings]),
            allergenTags: Object.freeze([...row.allergenTags]),
          })
        )
      ),
      counts: Object.freeze(counts),
      abortReason,
    });
  }
}
