import { isIanaTimezone } from "@keepsake/local-data";

export type LocalTimestampResult =
  | {
      readonly ok: true;
      readonly occurredAt: number;
      readonly occurredTz: string;
      readonly utcOffsetMinutes: number;
    }
  | { readonly ok: false; readonly error: string };

interface LocalDateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function resolveLocalTimestamp(
  localDateTime: string,
  timezone: string,
  utcOffsetMinutes?: number,
  now: number = Date.now()
): LocalTimestampResult {
  const parts = parseLocalDateTime(localDateTime);
  if (!parts) {
    return { ok: false, error: "Enter a valid local date and time." };
  }
  const occurredTz = timezone.trim();
  if (!isIanaTimezone(occurredTz)) {
    return { ok: false, error: "Choose a valid IANA timezone." };
  }
  if (utcOffsetMinutes !== undefined && !Number.isInteger(utcOffsetMinutes)) {
    return {
      ok: false,
      error: "UTC offset must be a whole number of minutes.",
    };
  }
  if (!Number.isSafeInteger(now) || now < 0) {
    return { ok: false, error: "Current time must be UTC epoch milliseconds." };
  }

  const localEpoch = epochFromParts(parts);
  const offsets = offsetsNear(localEpoch, occurredTz);
  const candidates = [...offsets]
    .map((offset) => ({ occurredAt: localEpoch - offset, offset }))
    .filter(({ occurredAt }) => matchesLocalTime(occurredAt, parts, occurredTz))
    .sort((left, right) => left.occurredAt - right.occurredAt);

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "That local time does not exist because the clock changes.",
    };
  }
  const selected =
    utcOffsetMinutes === undefined
      ? candidates.length === 1
        ? candidates[0]
        : undefined
      : candidates.find(({ offset }) => offset === utcOffsetMinutes * 60_000);
  if (!selected) {
    return {
      ok: false,
      error:
        candidates.length > 1
          ? "Choose the UTC offset for this ambiguous local time."
          : "The selected UTC offset does not match this local time.",
    };
  }
  if (selected.occurredAt > now) {
    return { ok: false, error: "Occurred time cannot be in the future." };
  }
  return {
    ok: true,
    occurredAt: selected.occurredAt,
    occurredTz,
    utcOffsetMinutes: selected.offset / 60_000,
  };
}

function parseLocalDateTime(value: string): LocalDateTimeParts | null {
  if (typeof value !== "string") return null;
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const parts: LocalDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "").padEnd(3, "0") || 0),
  };
  if (
    parts.year < 1 ||
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    return null;
  }
  const date = new Date(epochFromParts(parts));
  return date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() + 1 === parts.month &&
    date.getUTCDate() === parts.day
    ? parts
    : null;
}

function epochFromParts(parts: LocalDateTimeParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date.getTime();
}

function offsetsNear(epoch: number, timezone: string): Set<number> {
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 3) {
    const instant = epoch + hours * 60 * 60 * 1_000;
    const local = formatParts(instant, timezone);
    const localEpoch = epochFromParts({ ...local, millisecond: 0 });
    offsets.add(localEpoch - Math.floor(instant / 1_000) * 1_000);
  }
  return offsets;
}

function matchesLocalTime(
  epoch: number,
  expected: LocalDateTimeParts,
  timezone: string
): boolean {
  const actual = formatParts(epoch, timezone);
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === expected.second &&
    new Date(epoch).getUTCMilliseconds() === expected.millisecond
  );
}

function formatParts(
  epoch: number,
  timezone: string
): Omit<LocalDateTimeParts, "millisecond"> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(epoch);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}
