import { DatabaseSync } from "node:sqlite";
import type { MigrationDriver, SqliteStatement } from "@keepsake/local-data";

class NodeStatement implements SqliteStatement {
  private readonly statement: import("node:sqlite").StatementSync;

  constructor(statement: import("node:sqlite").StatementSync) {
    this.statement = statement;
  }

  all<T = unknown>(...params: unknown[]): T[] {
    return this.statement.all(...(params as never[])).map(plain) as T[];
  }

  get<T = unknown>(...params: unknown[]): T | undefined {
    const row = this.statement.get(...(params as never[]));
    return row === undefined ? undefined : (plain(row) as T);
  }

  run(...params: unknown[]): void {
    this.statement.run(...(params as never[]));
  }
}

function plain(row: unknown): unknown {
  return typeof row === "object" && row !== null ? { ...row } : row;
}

class NodeDriver implements MigrationDriver {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  execSync(sql: string): void {
    this.database.exec(sql);
  }

  prepareSync(sql: string): SqliteStatement {
    return new NodeStatement(this.database.prepare(sql));
  }

  withTransactionSync(operation: () => void): void {
    this.execSync("BEGIN");
    try {
      operation();
      this.execSync("COMMIT");
    } catch (error) {
      this.execSync("ROLLBACK");
      throw error;
    }
  }

  closeSync(): void {
    this.database.close();
  }
}

export function openTestDriver(): MigrationDriver {
  return new NodeDriver(new DatabaseSync(":memory:"));
}
