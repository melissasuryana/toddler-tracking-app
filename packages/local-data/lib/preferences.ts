/**
 * Preference keys and value parsing — the pure rules for the key-value
 * preferences table. Temperature units follow CONTEXT.md (°C / °F).
 */

/** Temperature units a Medical Entry can be recorded in. */
export type TemperatureUnit = "C" | "F";
export type ThemePreference = "system" | "light" | "dark";

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
  themePreference: ThemePreference;
  demoDataLoaded: boolean;
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
    case "themePreference":
      return raw === "system" || raw === "light" || raw === "dark"
        ? (raw as PreferenceTypes[K])
        : null;
    case "demoDataLoaded":
      return raw === "true"
        ? (true as PreferenceTypes[K])
        : raw === "false"
          ? (false as PreferenceTypes[K])
          : null;
    default:
      return null;
  }
}
