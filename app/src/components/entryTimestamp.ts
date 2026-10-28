import { resolveLocalTimestamp } from "@keepsake/routine";

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

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type KeepsakeTimestampStyle = "standard" | "sleep" | "reaction";

export function formatKeepsakeTimestamp(
  date: string,
  time: string,
  timezone: string,
  style: KeepsakeTimestampStyle = "standard",
  nowEpoch: number = Date.now()
): string {
  const [hStr = "0", mStr = "0"] = time.split(":");
  const hour = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;
  const ampm = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minuteStr = String(minute).padStart(2, "0");
  const formattedTime = `${hour12}:${minuteStr} ${ampm}`;

  const nowLocal = localDateTime(nowEpoch, timezone);
  const todayDate = nowLocal.date;

  const [currYear, currMonth, currDay] = todayDate.split("-").map(Number);
  const yesterdayUtc = new Date(Date.UTC(currYear, currMonth - 1, currDay - 1));
  const yesterdayDate = yesterdayUtc.toISOString().slice(0, 10);

  const [tYear, tMonth, tDay] = date.split("-").map(Number);
  const monthName = MONTH_NAMES[(tMonth || 1) - 1] ?? "Jan";
  const dayNum = tDay || 1;

  if (style === "sleep") {
    if (date === todayDate) {
      return `${formattedTime} (today)`;
    }
    if (date === yesterdayDate) {
      return `${formattedTime} (yesterday)`;
    }
    if (tYear === currYear) {
      return `${formattedTime} (${monthName} ${dayNum})`;
    }
    return `${formattedTime} (${monthName} ${dayNum}, ${tYear})`;
  }

  if (style === "reaction") {
    if (date === todayDate) {
      return formattedTime;
    }
    if (date === yesterdayDate) {
      return `Yesterday, ${formattedTime}`;
    }
    if (tYear === currYear) {
      return `${monthName} ${dayNum}, ${formattedTime}`;
    }
    return `${monthName} ${dayNum}, ${tYear}, ${formattedTime}`;
  }

  // standard style
  if (date === todayDate) {
    const timeOfDay = hour < 12 ? "This morning" : "Today";
    return `${timeOfDay}, ${formattedTime}`;
  }
  if (date === yesterdayDate) {
    return `Yesterday, ${formattedTime}`;
  }
  if (tYear === currYear) {
    return `${monthName} ${dayNum}, ${formattedTime}`;
  }
  return `${monthName} ${dayNum}, ${tYear}, ${formattedTime}`;
}
