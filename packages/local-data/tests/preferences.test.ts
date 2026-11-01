/**
 * Preference parsing rules (issue #43): the temperature-unit prompt's
 * explicit °C default, and tolerant parsing of stored values.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TEMPERATURE_UNIT,
  TEMPERATURE_UNITS,
  formatTemperatureUnit,
  parsePreference,
  parseTemperatureUnit,
} from "../index.ts";

test("the explicit first-run default is °C", () => {
  assert.equal(DEFAULT_TEMPERATURE_UNIT, "C");
  assert.equal(formatTemperatureUnit(DEFAULT_TEMPERATURE_UNIT), "°C");
});

test("the unit vocabulary is exactly °C and °F", () => {
  assert.deepEqual(TEMPERATURE_UNITS, ["C", "F"]);
  assert.equal(formatTemperatureUnit("F"), "°F");
});

test("parseTemperatureUnit accepts symbols and bare letters, rejects junk", () => {
  assert.equal(parseTemperatureUnit("°C"), "C");
  assert.equal(parseTemperatureUnit("°f"), "F");
  assert.equal(parseTemperatureUnit(" c "), "C");
  assert.equal(parseTemperatureUnit("kelvin"), null);
  assert.equal(parseTemperatureUnit(""), null);
});

test("parsePreference reads the temperature-unit key", () => {
  assert.equal(parsePreference("temperatureUnit", "C"), "C");
  assert.equal(parsePreference("temperatureUnit", "F"), "F");
  assert.equal(parsePreference("temperatureUnit", null), null);
  assert.equal(parsePreference("temperatureUnit", "nonsense"), null);
});

test("parsePreference reads theme and demo-data settings", () => {
  assert.equal(parsePreference("themePreference", "system"), "system");
  assert.equal(parsePreference("themePreference", "dark"), "dark");
  assert.equal(parsePreference("themePreference", "nonsense"), null);
  assert.equal(parsePreference("demoDataLoaded", "true"), true);
  assert.equal(parsePreference("demoDataLoaded", "false"), false);
  assert.equal(parsePreference("demoDataLoaded", "yes"), null);
});
