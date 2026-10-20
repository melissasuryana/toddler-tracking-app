/**
 * Drizzle ORM wiring over the package's `MigrationDriver` boundary: a minimal
 * synchronous `SQLiteSession`, so Drizzle's typed query builders run against
 * ANY injected engine (node:sqlite in tests, or an engine with the
 * execSync/prepareSync/withTransactionSync surface). The app uses this same
 * session against expo-sqlite (see ./expo.ts) — the official
 * `drizzle-orm/expo-sqlite` adapter pulls in `expo-sqlite` at module scope
 * for live queries, which plain Node cannot resolve, so the boundary stays
 * home-grown and shared. The schema in ./schema.ts is the single source of
 * truth for both Drizzle and the migration SQL.
 */
import { entityKind } from "drizzle-orm/entity";
import {
  BaseSQLiteDatabase,
  SQLiteSyncDialect,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core";
import type {
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core";
import { SQLitePreparedQuery, SQLiteSession } from "drizzle-orm/sqlite-core";
import type { Query } from "drizzle-orm/sql/sql";
import type { SelectedFieldsOrdered } from "drizzle-orm/sqlite-core/query-builders/select.types";
import type { MigrationDriver } from "./driver.ts";
import * as schema from "./schema.ts";

type Schema = typeof schema;

class DriverPreparedQuery extends SQLitePreparedQuery<{
  type: "sync";
  run: void;
  all: unknown[];
  get: unknown;
  values: unknown[];
  execute: unknown;
}> {
  static readonly [entityKind]: string = "KeepsakeDriverPreparedQuery";

  private readonly statement;

  constructor(
    driver: MigrationDriver,
    query: Query,
    executeMethod: SQLiteExecuteMethod
  ) {
    super("sync", executeMethod, query);
    this.statement = driver.prepareSync(query.sql);
  }

  run(placeholderValues?: Record<string, unknown>): void {
    this.statement.run(...this.params(placeholderValues));
  }

  all(placeholderValues?: Record<string, unknown>): unknown[] {
    return this.statement.all(...this.params(placeholderValues));
  }

  get(placeholderValues?: Record<string, unknown>): unknown {
    return this.statement.get(...this.params(placeholderValues));
  }

  values(placeholderValues?: Record<string, unknown>): unknown[] {
    return this.statement.all(...this.params(placeholderValues)) as unknown[];
  }

  isResponseInArrayMode(): boolean {
    return false;
  }

  /**
   * Drizzle hands sync `run/all/get` the placeholder map and, in some
   * versions, nothing at all — the SQL was already built with ordered
   * placeholders, whose values ride along on the query's `params` array.
   * Prefer the explicit map; fall back to the built params.
   */
  private params(
    placeholderValues: Record<string, unknown> | undefined
  ): unknown[] {
    if (placeholderValues && Object.keys(placeholderValues).length > 0) {
      return Object.values(placeholderValues);
    }
    const built = (this as unknown as { query: Query }).query.params;
    return built as unknown[];
  }
}

class DriverSession extends SQLiteSession<"sync", void, Schema, never> {
  static readonly [entityKind]: string = "KeepsakeDriverSession";

  private readonly driver: MigrationDriver;

  constructor(driver: MigrationDriver) {
    super(new SQLiteSyncDialect());
    this.driver = driver;
  }

  prepareQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean
  ): DriverPreparedQuery {
    void fields;
    void isResponseInArrayMode;
    return new DriverPreparedQuery(this.driver, query, executeMethod);
  }

  transaction<T>(
    transaction: (tx: SQLiteTransaction<"sync", void, Schema, never>) => T,
    config?: SQLiteTransactionConfig
  ): T {
    const behavior = config?.behavior ?? "deferred";
    this.driver.execSync(`BEGIN ${behavior.toUpperCase()}`);
    try {
      // SQLiteTransaction is abstract (rollback); the concrete instance only
      // needs the base behaviour, so it is built via a cast.
      const TxCtor = SQLiteTransaction as unknown as new (
        resultType: "sync",
        dialect: SQLiteSyncDialect,
        session: SQLiteSession<"sync", void, Schema, never>,
        schema: undefined,
        nestedIndex: number
      ) => SQLiteTransaction<"sync", void, Schema, never>;
      const tx = new TxCtor(
        "sync",
        new SQLiteSyncDialect(),
        this as never,
        undefined,
        0
      );
      const result = transaction(tx);
      this.driver.execSync("COMMIT");
      return result;
    } catch (error) {
      this.driver.execSync("ROLLBACK");
      throw error;
    }
  }
}

export type LocalOrm = BaseSQLiteDatabase<"sync", void, Schema, never>;

/**
 * A typed Drizzle handle bound to the injected driver and the Keepsake
 * schema. The app passes expo-sqlite (via `openAppDatabase`), tests pass
 * node:sqlite — both behind the same `MigrationDriver` boundary.
 */
export function createOrm(driver: MigrationDriver): LocalOrm {
  return new BaseSQLiteDatabase<"sync", void, Schema, never>(
    "sync",
    new SQLiteSyncDialect(),
    new DriverSession(driver) as never,
    undefined
  );
}
