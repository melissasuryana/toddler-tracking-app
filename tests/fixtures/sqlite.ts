import { DatabaseSync } from "node:sqlite";
import type { MigrationDriver, SqliteStatement } from "@keepsake/local-data";

export function openTestDriver(path = ":memory:"): MigrationDriver {
  const database = new DatabaseSync(path);
  return {
    execSync(sql) {
      database.exec(sql);
    },
    prepareSync(sql): SqliteStatement {
      const statement = database.prepare(sql);
      return {
        all<T = unknown>(...params: unknown[]): T[] {
          return statement
            .all(...(params as never[]))
            .map((row) => ({ ...row })) as T[];
        },
        get<T = unknown>(...params: unknown[]): T | undefined {
          const row = statement.get(...(params as never[]));
          return row === undefined ? undefined : ({ ...row } as T);
        },
        run(...params: unknown[]) {
          statement.run(...(params as never[]));
        },
      };
    },
    withTransactionSync(operation) {
      database.exec("BEGIN");
      try {
        operation();
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    closeSync() {
      database.close();
    },
  };
}
