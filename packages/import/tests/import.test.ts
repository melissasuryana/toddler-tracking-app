import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FoodEntries,
  FoodTracking,
  SEEDED_FOODS,
} from "@keepsake/food-tracking";
import {
  TriedFoodImport,
  civilDateAt,
  firstInstantOfDate,
  sqliteImportStore,
} from "../index.ts";
import { databaseFixture } from "./helpers.ts";

const NOW = Date.parse("2026-10-20T12:00:00Z");
function fixture() {
  const database = databaseFixture();
  const child = database.children.create({
    name: "Robin",
    birthdate: "2024-01-01",
    sex: "female",
  });
  const options = {
    childId: child.id,
    fallbackDate: "2026-10-19",
    timeZone: "UTC",
  };
  const importer = new TriedFoodImport(sqliteImportStore(database), () => NOW);
  return {
    database,
    child,
    options,
    importer,
    foods: new FoodTracking(database),
    entries: new FoodEntries(database),
  };
}

test("date mapping obeys the ordinary Entry epoch boundary on both midnight paths", () => {
  assert.equal(firstInstantOfDate("1969-12-31", "UTC"), null);
  assert.equal(firstInstantOfDate("1970-01-01", "Asia/Tokyo"), null);
  assert.equal(firstInstantOfDate("1965-12-01", "America/Sao_Paulo"), null);
  assert.equal(firstInstantOfDate("1970-01-01", "UTC"), 0);
  assert.equal(
    firstInstantOfDate("1970-01-01", "America/New_York"),
    18_000_000
  );
});

test("pre-epoch source dates warn and commit with the explicitly confirmed valid fallback", () => {
  for (const [date, timeZone] of [
    ["1969-12-31", "UTC"],
    ["1970-01-01", "Asia/Tokyo"],
    ["1965-12-01", "America/Sao_Paulo"],
  ]) {
    const { database, importer, options, entries } = fixture();
    try {
      const report = importer.preview(`name,date\nHistorical food,${date}`, {
        ...options,
        timeZone: timeZone!,
      });
      assert.equal(report.abortReason, null);
      assert.equal(report.counts.toImport, 1);
      assert.equal(report.counts.warned, 1);
      assert.equal(report.rows[0]!.date, options.fallbackDate);
      assert.equal(
        report.rows[0]!.occurredAt,
        firstInstantOfDate(options.fallbackDate, timeZone!)
      );
      assert.throws(
        () => importer.commit(report, { confirmFallback: false }),
        /Confirm/
      );
      importer.commit(report, { confirmFallback: true });
      const saved = entries.listForChild(options.childId);
      assert.equal(saved.length, 1);
      assert.equal(saved[0]!.occurredAt, report.rows[0]!.occurredAt);
      assert.ok(saved[0]!.occurredAt >= 0);
    } finally {
      database.close();
    }
  }
});

test("pre-epoch fallback instants are rejected before preview, including timezone-shifted midnight", () => {
  const { database, importer, options } = fixture();
  try {
    for (const [fallbackDate, timeZone] of [
      ["1969-12-31", "UTC"],
      ["1970-01-01", "Asia/Tokyo"],
      ["1965-12-01", "America/Sao_Paulo"],
    ]) {
      assert.throws(
        () =>
          importer.preview("Historical food", {
            ...options,
            fallbackDate: fallbackDate!,
            timeZone: timeZone!,
          }),
        /Fallback/
      );
    }
    const epoch = importer.preview("Historical food", {
      ...options,
      fallbackDate: "1970-01-01",
    });
    assert.equal(epoch.rows[0]!.occurredAt, 0);
    importer.commit(epoch, { confirmFallback: true });
  } finally {
    database.close();
  }
});

test("case/whitespace headers, reordered columns, CRLF, BOM, quoted commas, escaped quotes and multiline names", () => {
  const { database, importer, options } = fixture();
  try {
    const report = importer.preview(
      '\uFEFF ALLERGENS , Date , NAME , Food  Category \r\nMilk; EGG,2020-02-29,"  My, ""soup""  ", Compound\r\n,, "A\nB",\r\n\r\n',
      options
    );
    assert.equal(report.abortReason, null);
    assert.equal(report.counts.total, 2);
    assert.equal(report.counts.toImport, 2);
    assert.equal(report.rows[0]!.name, 'My, "soup"');
    assert.deepEqual(report.rows[0]!.allergenTags, ["milk", "egg"]);
    assert.equal(report.rows[0]!.category, "compound");
    assert.equal(report.rows[1]!.name, "A B");
    assert.equal(report.rows[1]!.line, 3);
  } finally {
    database.close();
  }
});

test("headerless input accepts names only and never guesses positional metadata", () => {
  const { database, importer, options } = fixture();
  try {
    const report = importer.preview(
      "Unseen food\nAnother food,2020-01-01\nThird food",
      options
    );
    assert.deepEqual(
      report.rows.map((row) => row.classification),
      ["import", "failed", "import"]
    );
    assert.equal(report.counts.warned, 2);
    assert.equal(
      report.rows[0]!.occurredAt,
      Date.parse("2026-10-19T00:00:00Z")
    );
  } finally {
    database.close();
  }
});

test("empty names and recoverable malformed rows fail; a failed occurrence does not consume a name", () => {
  const { database, importer, options } = fixture();
  try {
    const report = importer.preview(
      'name,date\nSame food,2020-01-01,extra\n,2020-01-01\nSame food,2020-01-01\nsame   FOOD,2020-01-02\n"broken"x,2020-01-01\nOther food,2020-01-01',
      options
    );
    assert.deepEqual(
      report.rows.map((row) => row.classification),
      ["failed", "failed", "import", "duplicate", "failed", "import"]
    );
    assert.equal(report.abortReason, null);
    assert.equal(
      report.counts.total,
      report.counts.toImport + report.counts.failed + report.counts.skipped
    );
  } finally {
    database.close();
  }
});

test("first importable name wins even when date or metadata has warnings", () => {
  const { database, importer, options } = fixture();
  try {
    const report = importer.preview(
      "name,date,category,allergens\n  My Food  ,bad,unknown,Milk;bogus;EGG;milk\nmy   FOOD,2020-01-01,fruit,peanut",
      options
    );
    assert.equal(report.rows[0]!.category, null);
    assert.deepEqual(report.rows[0]!.allergenTags, ["milk", "egg"]);
    assert.equal(report.rows[0]!.warnings.length, 3);
    assert.equal(report.counts.warned, 1);
    assert.equal(report.counts.duplicates, 1);
    assert.equal(report.counts.skipped, 1);
    assert.equal(report.rows[0]!.date, options.fallbackDate);
  } finally {
    database.close();
  }
});

test("seeds match before customs; seed metadata wins; untracked customs reused unchanged; no fuzzy matches", () => {
  const { database, importer, options, foods } = fixture();
  try {
    const seed = SEEDED_FOODS.find((food) => food.category !== null)!;
    foods.createCustomFood({
      name: ` ${seed.name.toUpperCase()} `,
      category: "compound",
      allergenTags: ["egg"],
    });
    const custom = foods.createCustomFood({
      name: "My food",
      category: null,
      allergenTags: ["soy"],
    });
    const report = importer.preview(
      `name,date,category,allergens\n${seed.name.toUpperCase()},2020-01-01,compound,egg\nMY   FOOD,2020-01-01,fruit,milk\nMy food!,2020-01-01,,`,
      options
    );
    assert.equal(report.rows[0]!.foodId, seed.id);
    assert.equal(report.rows[0]!.category, seed.category);
    assert.deepEqual(report.rows[0]!.allergenTags, seed.allergenTags);
    assert.equal(report.rows[1]!.foodId, custom.id);
    assert.equal(report.rows[1]!.category, null);
    assert.deepEqual(report.rows[1]!.allergenTags, ["soy"]);
    assert.equal(report.rows[2]!.newFood, true);
    assert.equal(report.counts.newFoods, 1);
  } finally {
    database.close();
  }
});

test("three failures of four abort; exactly half may preview; all empty/all skipped/unparseable abort", () => {
  const { database, importer, options, entries } = fixture();
  try {
    assert.match(
      importer.preview("Food\n,\n,\n,", options).abortReason!,
      /half/
    );
    assert.equal(
      importer.preview("Food\nOther\n,\n,", options).abortReason,
      null
    );
    for (const csv of [
      "",
      "\n \n",
      "name,date\n,2020-01-01",
      '"Unterminated',
      "name,name\nFood,Other",
    ]) {
      assert.ok(importer.preview(csv, options).abortReason, csv);
    }
    const seed = SEEDED_FOODS[0]!;
    entries.createIntroduction({
      childId: options.childId,
      foodId: seed.id,
      occurredAt: NOW - 86_400_000,
      occurredTz: "UTC",
    });
    const skipped = importer.preview(seed.name, options);
    assert.equal(skipped.counts.skipped, 1);
    assert.match(skipped.abortReason!, /Nothing/);
  } finally {
    database.close();
  }
});

test("preview and cancel produce no writes, including custom Foods, Entries and manual-safe markers", () => {
  const { database, importer, options } = fixture();
  try {
    const before = database.driver
      .prepareSync("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all<{ name: string }>()
      .filter(({ name }) => !name.startsWith("sqlite_"))
      .map(
        ({ name }) =>
          [
            name,
            database.driver.prepareSync(`SELECT * FROM "${name}"`).all(),
          ] as const
      );
    importer.preview(
      "name,date,category,allergens\nNew food,,fruit,milk",
      options
    );
    for (const [name, rows] of before) {
      assert.deepEqual(
        database.driver.prepareSync(`SELECT * FROM "${name}"`).all(),
        rows,
        name
      );
    }
  } finally {
    database.close();
  }
});

test("normal date, skipped midnight, repeated midnight and wholly nonexistent date", () => {
  assert.equal(
    firstInstantOfDate("2020-02-29", "UTC"),
    Date.parse("2020-02-29T00:00:00Z")
  );
  assert.equal(
    firstInstantOfDate("2018-11-04", "America/Sao_Paulo"),
    Date.parse("2018-11-04T03:00:00Z")
  );
  assert.equal(
    firstInstantOfDate("2020-11-01", "America/Havana"),
    Date.parse("2020-11-01T04:00:00Z")
  );
  assert.equal(firstInstantOfDate("2011-12-30", "Pacific/Apia"), null);
  assert.equal(
    civilDateAt(Date.parse("2018-11-04T03:00:00Z"), "America/Sao_Paulo"),
    "2018-11-04"
  );
  for (const date of [
    "2020-2-29",
    "2021-02-29",
    "2020-04-31",
    "not-a-date",
    "0000-01-01",
  ]) {
    assert.equal(firstInstantOfDate(date, "UTC"), null, date);
  }
});

test("invalid, missing, future and nonexistent dates use a strictly valid nonfuture confirmed fallback", () => {
  const { database, importer, options } = fixture();
  try {
    const report = importer.preview(
      "name,date\nMissing,\nInvalid,2021-02-29\nFuture,2099-01-01\nLost day,2011-12-30",
      { ...options, timeZone: "Pacific/Apia" }
    );
    assert.equal(report.counts.toImport, 4);
    assert.equal(report.counts.warned, 4);
    assert.ok(
      report.rows.every(
        (row) => row.date === options.fallbackDate && row.occurredAt! <= NOW
      )
    );
    assert.throws(
      () => importer.commit(report, { confirmFallback: false }),
      /Confirm/
    );
    for (const fallbackDate of [
      "2099-01-01",
      "bad",
      "2021-02-29",
      "2011-12-30",
    ]) {
      assert.throws(
        () =>
          importer.preview("Food", {
            ...options,
            timeZone: "Pacific/Apia",
            fallbackDate,
          }),
        /Fallback/
      );
    }
    assert.throws(
      () => importer.preview("Food", { ...options, timeZone: "+01:00" }),
      /IANA/
    );
  } finally {
    database.close();
  }
});

test("commit is ordinary backdated Introductions; derives status, no heads-up call or persisted report", () => {
  const { database, importer, options, foods, entries } = fixture();
  try {
    const preview = importer.preview(
      "name,date,category,allergens\nMy first food,2020-01-01,fruit,milk\nRecent food,2026-10-20,,egg",
      options
    );
    const report = importer.commit(preview, { confirmFallback: true });
    assert.deepEqual(report, preview);
    const custom = foods.listFoods().filter((food) => food.source === "custom");
    assert.equal(custom.length, 2);
    assert.equal(
      foods.statusFor(
        options.childId,
        custom.find((food) => food.name === "My first food")!.id,
        NOW
      ).status,
      "safe"
    );
    assert.equal(
      foods.statusFor(
        options.childId,
        custom.find((food) => food.name === "Recent food")!.id,
        NOW
      ).status,
      "trying"
    );
    const introductions = entries.listForChild(options.childId);
    assert.equal(introductions.length, 2);
    assert.ok(
      introductions.every(
        (entry) =>
          entry.kind === "introduction" &&
          entry.occurredTz === "UTC" &&
          entry.occurredAt <= NOW
      )
    );
    assert.equal(
      database.foods.listManualSafeMarkers(options.childId).length,
      0
    );
    assert.equal(
      database.driver.prepareSync("SELECT * FROM metadata").all().length,
      0
    );
  } finally {
    database.close();
  }
});

test("forced failure rolls back custom Foods, Entries, associations and marker changes; same preview retries safely", () => {
  const { database, options, foods, entries } = fixture();
  try {
    const existing = foods.createCustomFood({ name: "Already safe" });
    const entry = entries.createIntroduction({
      childId: options.childId,
      foodId: existing.id,
      occurredAt: NOW - 1_000,
      occurredTz: "UTC",
    });
    foods.markSafe(options.childId, existing.id, NOW);
    const originalMarkers = database.foods.listManualSafeMarkers(
      options.childId
    );
    const store = sqliteImportStore(database);
    let fail = true;
    let writes = 0;
    const importer = new TriedFoodImport(
      {
        ...store,
        introduce: (input) => {
          store.introduce(input);
          writes += 1;
          if (fail && writes === 2) {
            database.foods.setManualSafeMarker(
              options.childId,
              input.foodId,
              entry.id
            );
            throw new Error("Forced write failure");
          }
        },
      },
      () => NOW
    );
    const preview = importer.preview("First new\nSecond new", options);
    assert.throws(
      () => importer.commit(preview, { confirmFallback: true }),
      /Forced/
    );
    assert.equal(
      foods.listFoods().filter((food) => food.source === "custom").length,
      1
    );
    assert.equal(entries.listForChild(options.childId).length, 1);
    assert.deepEqual(
      database.foods.listManualSafeMarkers(options.childId),
      originalMarkers
    );
    fail = false;
    assert.equal(
      importer.commit(preview, { confirmFallback: true }).counts.toImport,
      2
    );
    const retried = importer.commit(preview, { confirmFallback: true });
    assert.equal(retried.counts.toImport, 0);
    assert.equal(retried.counts.skipped, 2);
    assert.ok(retried.abortReason);
    assert.equal(entries.listForChild(options.childId).length, 3);
  } finally {
    database.close();
  }
});

test("commit revalidates newly tracked Foods and customs created since preview without changing metadata", () => {
  const { database, importer, options, foods, entries } = fixture();
  try {
    const preview = importer.preview(
      "name,date,category,allergens\nConcurrent food,2020-01-01,fruit,milk\nReuse me,2020-01-01,fruit,milk",
      options
    );
    const first = foods.createCustomFood({
      name: "Concurrent FOOD",
      category: "compound",
    });
    const second = foods.createCustomFood({
      name: "Reuse me",
      category: "proteins",
      allergenTags: ["soy"],
    });
    entries.createReaction({
      childId: options.childId,
      foodIds: [first.id],
      severity: "mild",
      occurredAt: NOW - 1_000,
      occurredTz: "UTC",
    });
    const result = importer.commit(preview, { confirmFallback: true });
    assert.equal(result.counts.skipped, 1);
    assert.equal(result.counts.toImport, 1);
    assert.equal(result.counts.newFoods, 0);
    assert.deepEqual(foods.getFood(second.id), second);
    assert.equal(
      foods.statusFor(options.childId, first.id, NOW).status,
      "avoid"
    );
    assert.equal(entries.listForChild(options.childId).length, 2);
  } finally {
    database.close();
  }
});

test("target Child isolation, captured timezone, immutable preview and foreign preview rejection", () => {
  const { database, importer, options, entries } = fixture();
  try {
    const other = database.children.create({
      name: "Other Child",
      birthdate: "2023-01-01",
      sex: "male",
    });
    entries.createIntroduction({
      childId: other.id,
      foodId: SEEDED_FOODS[0]!.id,
      occurredAt: NOW - 1_000,
      occurredTz: "UTC",
    });
    const mutableOptions = { ...options, timeZone: "America/New_York" };
    const preview = importer.preview(SEEDED_FOODS[0]!.name, mutableOptions);
    mutableOptions.timeZone = "UTC";
    assert.equal(preview.counts.toImport, 1);
    assert.equal(preview.childName, "Robin");
    assert.ok(Object.isFrozen(preview.rows[0]!.warnings));
    assert.throws(
      () =>
        new TriedFoodImport(sqliteImportStore(database)).commit(preview, {
          confirmFallback: true,
        }),
      /session/
    );
    importer.commit(preview, { confirmFallback: true });
    assert.equal(
      entries.listForChild(options.childId)[0]!.occurredTz,
      "America/New_York"
    );
    assert.equal(entries.listForChild(other.id).length, 1);
  } finally {
    database.close();
  }
});
