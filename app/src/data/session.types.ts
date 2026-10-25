/**
 * The data-session contract shared by the native and web implementations.
 * The native build (session.native.tsx) opens the real database; the web
 * build (session.web.tsx) is an in-memory stand-in — the app targets iOS.
 */
import type {
  Child,
  ChildInput,
  RunningSleepTimer,
  TemperatureUnit,
} from "@keepsake/local-data";
import type {
  MealDefaults,
  MealEntry,
  MealEntryInput,
  MealNameSuggestion,
} from "@keepsake/food-tracking";
import type { RoutineEntry, SleepQuality } from "@keepsake/routine";

export interface SleepSessionEditInput {
  readonly startAt: number;
  readonly endedAt: number;
  readonly quality: SleepQuality;
  readonly factors?: readonly string[];
}

export interface DataSession {
  /** Null when no Child exists yet — the onboarding gate's question. */
  readonly child: Child | null;
  readonly createChild: (input: ChildInput) => void;
  readonly temperatureUnit: () => TemperatureUnit | null;
  readonly setTemperatureUnit: (unit: TemperatureUnit) => void;
  readonly runningSleepTimer: () => RunningSleepTimer | null;
  readonly startSleepTimer: () => void;
  readonly cancelWake: () => void;
  readonly stopSleepTimer: (quality: SleepQuality) => RoutineEntry;
  readonly hasSleepSessionOverlap: (id: string) => boolean;
  readonly updateSleepSession: (
    id: string,
    input: SleepSessionEditInput
  ) => RoutineEntry | null;
  readonly mealsForChild: (childId: string) => readonly MealEntry[];
  readonly mealDefaultsForChild: (childId: string) => MealDefaults;
  readonly mealNameSuggestions: (
    childId: string,
    query: string
  ) => readonly MealNameSuggestion[];
  readonly createMeal: (input: MealEntryInput) => MealEntry;
  readonly updateMeal: (id: string, input: MealEntryInput) => MealEntry | null;
}
