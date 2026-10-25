import { resolveLocalTimestamp } from "@keepsake/routine/index.ts";

export interface EntryTimestamp {
  readonly occurredAt: number;
  readonly occurredTz: string;
}

export function localDateTime(epoch: number, timezone: string) {
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(epoch)
      .map(({ type, value }) => [type, value])
  );
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    time: `${parts.get("hour")}:${parts.get("minute")}`,
  };
}

/** Keep seconds, milliseconds and the chosen DST occurrence until edited. */
export function resolveEntryTimestamp(
  original: EntryTimestamp,
  edited: boolean,
  date: string,
  time: string,
  offset?: number
) {
  return edited
    ? resolveLocalTimestamp(`${date}T${time}`, original.occurredTz, offset)
    : { ok: true as const, ...original };
}

export function timestampOptions(dateTime: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dateTime);
  if (!match) return [];
  const nominal = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 3) {
    const instant = nominal + hours * 3_600_000;
    const local = localDateTime(instant, timezone);
    offsets.add(
      Math.round(
        (Date.parse(`${local.date}T${local.time}Z`) - instant) / 60_000
      )
    );
  }
  return [...offsets]
    .map((offset) =>
      resolveLocalTimestamp(dateTime, timezone, offset, Number.MAX_SAFE_INTEGER)
    )
    .filter((result) => result.ok)
    .sort((left, right) =>
      left.ok && right.ok ? left.occurredAt - right.occurredAt : 0
    );
}

export function formatUtcOffset(offset: number) {
  const absolute = Math.abs(offset);
  return `UTC${offset < 0 ? "−" : "+"}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
