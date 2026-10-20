/**
 * The data-session contract shared by the native and web implementations.
 * The native build (session.native.tsx) opens the real database; the web
 * build (session.web.tsx) is an in-memory stand-in — the app targets iOS.
 */
import type { Child, ChildInput, TemperatureUnit } from "@keepsake/local-data";

export interface DataSession {
  /** Null when no Child exists yet — the onboarding gate's question. */
  readonly child: Child | null;
  readonly createChild: (input: ChildInput) => void;
  readonly temperatureUnit: () => TemperatureUnit | null;
  readonly setTemperatureUnit: (unit: TemperatureUnit) => void;
}
