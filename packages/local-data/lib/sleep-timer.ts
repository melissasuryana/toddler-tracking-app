import { eq } from "drizzle-orm";
import type { MigrationDriver } from "./driver.ts";
import { isIanaTimezone, isUuidV7 } from "./entry.ts";
import type { LocalOrm } from "./orm.ts";
import { runningSleepTimers } from "./schema.ts";

export interface RunningSleepTimer {
  readonly childId: string;
  readonly startedAt: number;
  readonly startedTz: string;
}

type Atomic = <T>(operation: () => T) => T;

export class RunningSleepTimerAlreadyExistsError extends Error {
  constructor() {
    super("A Sleep timer is already running for this Child.");
    this.name = "RunningSleepTimerAlreadyExistsError";
  }
}

/** Persistence for one recoverable running Sleep timer per Child. */
export class SleepTimerRepository {
  private readonly orm: LocalOrm;
  private readonly driver: MigrationDriver;
  private readonly atomic: Atomic;

  constructor(orm: LocalOrm, driver: MigrationDriver, atomic: Atomic) {
    this.orm = orm;
    this.driver = driver;
    this.atomic = atomic;
  }

  get(childId: string): RunningSleepTimer | null {
    const row = this.driver
      .prepareSync(
        `SELECT child_id, started_at, started_tz
         FROM running_sleep_timers WHERE child_id = ?`
      )
      .get<{ child_id: string; started_at: number; started_tz: string }>(
        childId
      );
    return row
      ? {
          childId: row.child_id,
          startedAt: row.started_at,
          startedTz: row.started_tz,
        }
      : null;
  }

  start(timer: RunningSleepTimer): RunningSleepTimer {
    if (!isUuidV7(timer.childId)) {
      throw new TypeError("Sleep timer Child id must be a UUIDv7.");
    }
    if (!Number.isSafeInteger(timer.startedAt) || timer.startedAt < 0) {
      throw new TypeError("Sleep timer start must be UTC epoch milliseconds.");
    }
    if (!isIanaTimezone(timer.startedTz)) {
      throw new TypeError(
        "Sleep timer timezone must be a valid IANA timezone."
      );
    }
    const normalized = { ...timer, startedTz: timer.startedTz.trim() };
    return this.atomic(() => {
      if (this.get(normalized.childId)) {
        throw new RunningSleepTimerAlreadyExistsError();
      }
      this.driver
        .prepareSync(
          "INSERT INTO entry_timezones (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
        )
        .run(normalized.startedTz);
      this.orm
        .insert(runningSleepTimers)
        .values({
          childId: normalized.childId,
          startedAt: normalized.startedAt,
          startedTz: normalized.startedTz,
        })
        .run();
      return normalized;
    });
  }

  clear(childId: string): boolean {
    return this.atomic(() => {
      if (!this.get(childId)) return false;
      this.orm
        .delete(runningSleepTimers)
        .where(eq(runningSleepTimers.childId, childId))
        .run();
      return this.get(childId) === null;
    });
  }
}
