/**
 * Test fixture: adapts Node's built-in `node:sqlite` to the package's
 * `MigrationDriver` surface so every engine-agnostic behaviour (migrations,
 * repositories, seeding) is exercised against a real SQLite database.
 */
import { DatabaseSync } from "node:sqlite";
import type { MigrationDriver, SqliteStatement } from "../index.ts";

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

/** node:sqlite rows are null-prototype objects; plain objects compare equal. */
function plain(row: unknown): unknown {
  return typeof row === "object" && row !== null ? { ...row } : row;
}

class NodeDriver implements MigrationDriver {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  execSync(sql: string): void {
    this.db.exec(sql);
  }
  prepareSync(sql: string): SqliteStatement {
    return new NodeStatement(this.db.prepare(sql));
  }
  withTransactionSync(fn: () => void): void {
    this.execSync("BEGIN");
    try {
      fn();
      this.execSync("COMMIT");
    } catch (error) {
      this.execSync("ROLLBACK");
      throw error;
    }
  }
  closeSync(): void {
    this.db.close();
  }
}

/** A fresh in-memory database wrapped as the package's driver. */
export function openTestDriver(): MigrationDriver {
  return new NodeDriver(new DatabaseSync(":memory:"));
}
