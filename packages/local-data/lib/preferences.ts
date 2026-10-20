/**
 * Preference keys and value parsing — the pure rules for the key-value
 * preferences table. Temperature units follow CONTEXT.md (°C / °F).
 */

/** Temperature units a Medical Entry can be recorded in. */
export type TemperatureUnit = "C" | "F";

export const TEMPERATURE_UNITS: readonly TemperatureUnit[] = ["C", "F"];

export function formatTemperatureUnit(unit: TemperatureUnit): string {
  return unit === "C" ? "°C" : "°F";
}

export function parseTemperatureUnit(value: string): TemperatureUnit | null {
  const normalized = value.trim().toUpperCase().replace("°", "");
  return normalized === "C" || normalized === "F" ? normalized : null;
}

/** Known preference keys with their value type. Extend per ticket. */
export interface PreferenceTypes {
  /** Temperature-unit default for new Entries (CONTEXT.md temperature rule). */
  temperatureUnit: TemperatureUnit;
}

export type PreferenceKey = keyof PreferenceTypes;

/** First-run default: the explicit °C default from issue #43. */
export const DEFAULT_TEMPERATURE_UNIT: TemperatureUnit = "C";

/** Parses a stored preference value; returns null when missing or malformed. */
export function parsePreference<K extends PreferenceKey>(
  key: K,
  raw: string | null
): PreferenceTypes[K] | null {
  if (raw === null) return null;
  switch (key) {
    case "temperatureUnit":
      return parseTemperatureUnit(raw) as PreferenceTypes[K] | null;
    default:
      return null;
  }
}
