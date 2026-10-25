import { DatabaseSync } from "node:sqlite";
import {
  openDatabase,
  type MigrationDriver,
  type SqliteStatement,
} from "@keepsake/local-data";

export function databaseFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const driver: MigrationDriver = {
    execSync: (sql) => {
      sqlite.exec(sql);
    },
    prepareSync: (sql): SqliteStatement => {
      const statement = sqlite.prepare(sql);
      return {
        all: <T>(...params: unknown[]) =>
          statement
            .all(...(params as never[]))
            .map((row) => ({ ...row })) as T[],
        get: <T>(...params: unknown[]) => {
          const row = statement.get(...(params as never[]));
          return row === undefined ? undefined : ({ ...row } as T);
        },
        run: (...params: unknown[]) => {
          statement.run(...(params as never[]));
        },
      };
    },
    withTransactionSync: (operation) => {
      sqlite.exec("BEGIN");
      try {
        operation();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    closeSync: () => {
      sqlite.close();
    },
  };
  return openDatabase(driver);
}
