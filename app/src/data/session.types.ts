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
  Food,
  FoodStatus,
  FoodEntry,
  IntroductionEntry,
  IntroductionEntryInput,
  ReactionEntry,
  ReactionEntryInput,
  IntroductionHeadsUp,
  IntroductionHeadsUpOptions,
} from "@keepsake/food-tracking";
import type { RoutineEntry, SleepQuality } from "@keepsake/routine";

export interface SleepSessionEditInput {
  readonly startAt: number;
  readonly endedAt: number;
  readonly quality: SleepQuality;
  readonly factors?: readonly string[];
}

export interface DataSession {
  readonly foods: () => readonly Food[];
  readonly foodStatus: (
    childId: string,
    foodId: string,
    now?: number
  ) => FoodStatus;
  readonly introductionHeadsUps: (
    childId: string,
    foodId: string,
    occurredAt: number,
    options?: IntroductionHeadsUpOptions
  ) => readonly IntroductionHeadsUp[];
  readonly foodEntriesForChild: (childId: string) => readonly FoodEntry[];
  readonly reactionFoods: (childId: string, now?: number) => readonly Food[];
  readonly createIntroduction: (
    input: IntroductionEntryInput
  ) => IntroductionEntry;
  readonly updateIntroduction: (
    id: string,
    input: IntroductionEntryInput
  ) => IntroductionEntry | null;
  readonly createReaction: (input: ReactionEntryInput) => ReactionEntry;
  readonly updateReaction: (
    id: string,
    input: ReactionEntryInput
  ) => ReactionEntry | null;
  readonly deleteFoodEntry: (id: string) => boolean;
  readonly mealDraftForIntroduction: (id: string) => MealEntryInput;
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
