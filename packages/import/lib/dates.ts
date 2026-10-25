import { isIanaTimezone } from "@keepsake/local-data";
import { resolveLocalTimestamp } from "@keepsake/routine";

const formatters = new Map<string, Intl.DateTimeFormat>();

export function civilDateAt(instant: number, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = new Map(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value])
  );
  return `${parts.get("year")!.padStart(4, "0")}-${parts.get("month")}-${parts.get("day")}`;
}

export function firstInstantOfDate(
  date: string,
  timeZone: string
): number | null {
  if (/^[+-]/.test(timeZone) || !isIanaTimezone(timeZone)) {
    throw new Error("Choose a valid IANA timezone.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const epoch = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(epoch) ||
    new Date(epoch).toISOString().slice(0, 10) !== date
  ) {
    return null;
  }
  const midnight = resolveLocalTimestamp(
    `${date}T00:00`,
    timeZone,
    undefined,
    Number.MAX_SAFE_INTEGER
  );
  if (midnight.ok) return midnight.occurredAt;

  // Midnight may be skipped or repeated. Locate the first real instant of the
  // civil day, not a JS Date's silently shifted midnight (e.g. Apia's lost day).
  const hour = 3_600_000;
  for (
    let instant = epoch - 36 * hour;
    instant <= epoch + 36 * hour;
    instant += hour
  ) {
    if (civilDateAt(instant, timeZone) !== date) continue;
    let low = instant - hour;
    let high = instant;
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (civilDateAt(middle, timeZone) === date) high = middle;
      else low = middle;
    }
    return high >= 0 ? high : null;
  }
  return null;
}
