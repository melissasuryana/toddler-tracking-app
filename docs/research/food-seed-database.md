# Research: seeded food database with allergen tags

Resolves GitHub issue #10 (part of wayfinder map #1). Research date: 2026-09-26.

**Question:** Where does the seeded food database (a few hundred common foods with
pre-set big-9 allergen tags) come from — an existing open dataset (e.g. USDA
FoodData Central), an authored in-repo list, or a hybrid? Covers source, coverage
of common toddler first foods, allergen-tag accuracy, licensing, and the format of
the seed file. Outcome: enough to author the seed file without further research.

## Verdict (gist)

**Author the list in-repo as a bundled JSON/TS seed file, using USDA FoodData
Central (FDC) SR Legacy / Foundation Foods as the naming reference (optionally
keeping `fdcId` cross-references), and hand-apply big-9 Allergen Tags per food.**
No existing open dataset ships per-food big-9 allergen tags for generic whole
foods: FDC is CC0 public domain and has excellent coverage of single-ingredient
foods but **no allergen fields at all** (verified against its API schema), and
Open Food Facts (OFF) has structured `allergens_tags` but is crowd-sourced,
packaged-product-centric, and licensed ODbL 1.0, whose share-alike clause makes
bundling its data into an app seed legally awkward. The hybrid is cheap because
toddler first foods are overwhelmingly single-ingredient whole foods whose
allergen content is unambiguous; the ~30–50 compound foods on the list (breads,
cereals, hummus) are the only ones needing care. Licensing: FDC is CC0 — no
permission needed, attribution requested; the FDA big-9 list is law (FALCPA +
FASTER Act), not copyrightable content; the authored tag assignments are our own
work.

## Candidate sources evaluated

### USDA FoodData Central (FDC)

- **What it is:** USDA/ARS integrated food-composition system with five data
  types: Foundation Foods (analytically-derived basic foods/ingredients), SR
  Legacy (the decades-old Standard Reference, final release April 2018, ~7,800
  foods), FNDDS (foods/beverages as eaten in the US, from NHANES What We Eat in
  America), Branded Foods, and Experimental Foods.
  [Source (FAQ)](https://fdc.nal.usda.gov/faq)
- **Access:** full downloads per data type in JSON and CSV (SR Legacy JSON is a
  12.3 MB zip; Foundation Foods ~460 KB zipped), plus a free REST API
  (`api.nal.usda.gov/fdc/v1`, `/foods/search`, `/food/{fdcId}`, …) requiring a
  data.gov API key, default rate limit 1,000 requests/hour/IP.
  [Source (downloads)](https://fdc.nal.usda.gov/download-datasets) ·
  [Source (API guide)](https://fdc.nal.usda.gov/api-guide)
- **Allergen data: none.** Verified by calling the API directly: a Branded Foods
  detail record carries `description`, `ingredients` (free-text ingredient
  statement), `foodNutrients`, `brandedFoodCategory`, etc., but **no allergen
  field exists anywhere in the schema**. Allergen info would have to be derived
  by parsing free-text `ingredients` strings — and only Branded Foods even have
  those; SR Legacy/Foundation entries (the whole foods) have no ingredient text.
  (Verified 2026-09-26 via `GET /fdc/v1/food/531110` and the FDC OpenAPI spec.)
  [Source (API spec)](https://fdc.nal.usda.gov/api-spec/fdc_api.html)
- **Licensing:** "USDA FoodData Central data are in the public domain and they
  are not copyrighted. They are published under CC0 1.0 Universal. No permission
  is needed for their use, but we request that users list FoodData Central as
  the source of the data." Suggested citation: _U.S. Department of Agriculture,
  Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov._
  [Source (API guide, Licensing section)](https://fdc.nal.usda.gov/api-guide)

### Open Food Facts (OFF)

- **What it is:** crowd-sourced global database of food _products_ (mostly
  branded/packaged), with a genuinely structured allergen model. Verified via
  the API: each product carries `allergens_tags` (e.g. `["en:milk", "en:nuts",
"en:soybeans"]`) and `traces_tags`. (Verified 2026-09-26 via
  `GET world.openfoodfacts.org/api/v2/product/3017620422003.json`.)
  [Source (API)](https://world.openfoodfacts.org/api/v2/product/3017620422003.json)
- **Coverage mismatch:** OFF is barcode-product data. Plain "banana", "avocado",
  "sweet potato" entries exist only sparsely/inconsistently, and allergen
  completeness on crowd-sourced entries is uneven — the opposite profile from a
  first-foods list.
- **Licensing — the disqualifier:** the database is **ODbL 1.0** (contents
  DbCL, images CC-BY-SA). ODbL requires attribution **and share-alike**: "If you
  publicly use any adapted version of this database, or works produced from an
  adapted database, you must also offer that adapted database under the ODbL and
  share your modifications back." An app-bundled, edited seed derived from OFF
  would be an adapted database we'd have to republish under ODbL — real ongoing
  compliance surface for zero coverage benefit.
  [Source (OFF data page)](https://world.openfoodfacts.org/data)

### The big-9 list itself (FDA)

- The tag enum is defined by US law, not a dataset: FALCPA (2004) named 8 major
  allergens — milk, eggs, fish, Crustacean shellfish, tree nuts, peanuts, wheat,
  soybeans — and the FASTER Act (2021) added **sesame** as the 9th, effective
  January 1, 2023. FDA also requires the _specific_ tree nut type (almonds,
  pecans, walnuts…), fish species (bass, flounder, cod…), and Crustacean
  shellfish species (crab, lobster, shrimp…) to be declared — useful when naming
  seed foods like "shrimp" → `shellfish`.
  [Source (FDA Food Allergies page, archived)](https://web.archive.org/web/2026id_/http://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies)

### Proprietary / not usable

- Apps with curated first-foods databases (e.g. Solid Starts) are proprietary
  content — no license to reuse. Not pursued further.

## Recommended approach (hybrid: authored list, FDC-referenced)

1. **Author ~250–350 foods in-repo**, organized by category: fruits, vegetables,
   grains & cereals (oats, rice, pasta, bread…), proteins (meats, eggs, legumes,
   tofu…), dairy (yogurt, cheeses…), nuts & seeds (as butters/flours…), fish &
   shellfish, and a small set of common compound foods (hummus, pancakes, baby
   cereals). This comfortably covers the standard first-foods canon.
2. **Naming reference:** use FDC SR Legacy / Foundation Foods descriptions as
   canonical names and keep the `fdcId` as an optional cross-reference field
   (costs nothing, CC0-licensed, keeps the door open for future nutrient data).
   Verified that SR Legacy search returns plain whole-food entries (e.g.
   "banana" → `Bananas, dehydrated…`, plus raw/canned variants).
3. **Allergen tags: hand-assigned per food**, using the FDA big-9 enum. This is
   tractable and _more_ accurate than any dataset for this list because almost
   every first food is single-ingredient: banana → `[]`, shrimp → `[shellfish]`,
   whole-milk yogurt → `[milk]`, wheat bread → `[wheat]` (and typically
   `[soy]`/`[sesame]` per the specific product — compound foods get a
   "typical-ingredients" tag set and the parent-facing copy already treats tags
   as informational, per issue #5). Deliberate non-goal: cross-contact /
   "may contain" warnings, which no source provides for generic foods and FDA
   leaves as voluntary advisory statements.
4. **Consistency with the domain model:** tags are informational grouping only
   (CONTEXT.md); a Reaction flags the Food, not the category — so the seed needs
   per-food tags, nothing richer.

## Seed file format

One JSON file bundled with the app (imported into expo-sqlite at first launch,
matching the storage decision from issue #2). Draft schema:

```jsonc
// docs or packages/.../food-seed.json
{
  "version": 1,
  "source": "Authored for this app; food names reference USDA FoodData Central (CC0).",
  "foods": [
    {
      "id": "banana", // stable slug, primary key
      "name": "Banana", // display name
      "category": "fruit", // small fixed enum
      "allergenTags": [], // subset of the big-9 enum below
      "fdcId": 173944, // optional FDC cross-reference
    },
    {
      "id": "shrimp",
      "name": "Shrimp",
      "category": "protein",
      "allergenTags": ["shellfish"],
      "fdcId": 175180,
    },
  ],
}
```

```ts
type AllergenTag =
  | "milk"
  | "egg"
  | "peanut"
  | "tree_nuts"
  | "soy"
  | "wheat"
  | "fish"
  | "shellfish"
  | "sesame";
```

- JSON (not a TS literal) so the file is diff-friendly, reviewable in PRs, and
  importable by any future tooling; TS type above lives next to the import code.
- Custom parent-added Foods reuse the same shape (minus `fdcId`), so one code
  path ingests both.
- Estimated size: 300 foods × ~150 bytes ≈ 45 KB — trivially bundleable.

## Licensing summary for the shipped seed

- **FDC names/IDs: CC0.** No permission needed; honor the request by citing
  FoodData Central in an about/acknowledgements screen.
  [Source](https://fdc.nal.usda.gov/api-guide)
- **FDA big-9 definitions: statute/government work**, fine to reference.
- **Allergen tag assignments: authored in-repo** — our own work, no upstream
  license obligations, and none of OFF's ODbL share-alike attaches because no
  OFF data is used.
- **Do not** pull from Open Food Facts for this seed (ODbL attribution +
  share-alike on any adapted database, for data that doesn't fit the use case).
