/**
 * Web stand-in for the data session: expo-sqlite has no web implementation
 * and the app targets iOS, so this in-memory session exists purely to keep
 * the app importable/bundleable off-device. Nothing here persists.
 */
import { uuidv7 } from "@keepsake/local-data";
import {
  mealDefaultsFrom,
  mealNameSuggestionsFrom,
  sortMealsByRecency,
  type MealEntry,
  type MealEntryInput,
} from "@keepsake/food-tracking";
import type {
  Child,
  ChildInput,
  RunningSleepTimer,
  TemperatureUnit,
} from "@keepsake/local-data";
import type { RoutineEntry, SleepQuality } from "@keepsake/routine";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DataSession } from "./session.types";

const DataContext = createContext<DataSession | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [child, setChild] = useState<Child | null>(null);
  const [unit, setUnit] = useState<TemperatureUnit | null>(null);
  const [sleepTimer, setSleepTimer] = useState<RunningSleepTimer | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);

  const session = useMemo<DataSession>(
    () => ({
      child,
      createChild: (input: ChildInput) => {
        setChild({
          id: "web-preview",
          name: input.name.trim(),
          birthdate: input.birthdate,
          sex: input.sex,
          photo: input.photo ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      },
      temperatureUnit: () => unit,
      setTemperatureUnit: (next: TemperatureUnit) => setUnit(next),
      runningSleepTimer: () => sleepTimer,
      startSleepTimer: () => {
        if (!child) throw new Error("A Child is required to start Sleep.");
        if (sleepTimer) {
          throw new Error("A Sleep timer is already running for this Child.");
        }
        setSleepTimer({
          childId: child.id,
          startedAt: Date.now(),
          startedTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      },
      cancelWake: () => undefined,
      stopSleepTimer: (quality: SleepQuality): RoutineEntry => {
        if (!child || !sleepTimer) {
          throw new Error("There is no running Sleep timer for this Child.");
        }
        const endedAt = Date.now();
        if (endedAt <= sleepTimer.startedAt) {
          throw new Error("Sleep must end after its start time.");
        }
        const entry: RoutineEntry = {
          id: uuidv7(),
          childId: child.id,
          kind: "sleep_session",
          occurredAt: endedAt,
          occurredTz: sleepTimer.startedTz,
          createdAt: endedAt,
          updatedAt: endedAt,
          deletedAt: null,
          isSeed: false,
          content: { startAt: sleepTimer.startedAt, quality },
        };
        setSleepTimer(null);
        return entry;
      },
      mealsForChild: (childId: string) =>
        sortMealsByRecency(meals.filter((meal) => meal.childId === childId)),
      mealDefaultsForChild: (childId: string) =>
        mealDefaultsFrom(meals.filter((meal) => meal.childId === childId)),
      mealNameSuggestions: (childId: string, query: string) =>
        mealNameSuggestionsFrom(
          meals.filter((meal) => meal.childId === childId),
          query
        ),
      createMeal: (input: MealEntryInput) => {
        const meal = toWebMeal(input);
        setMeals((current) => [...current, meal]);
        return meal;
      },
      updateMeal: (id: string, input: MealEntryInput) => {
        const existing = meals.find((meal) => meal.id === id);
        if (
          !existing ||
          existing.childId !== input.childId ||
          existing.occurredTz !== input.occurredTz
        ) {
          return null;
        }
        const updated = toWebMeal(input, existing);
        setMeals((current) =>
          current.map((meal) => (meal.id === id ? updated : meal))
        );
        return updated;
      },
    }),
    [child, meals, sleepTimer, unit]
  );

  return (
    <DataContext.Provider value={session}>{children}</DataContext.Provider>
  );
}

export function useData(): DataSession {
  const session = useContext(DataContext);
  if (!session) {
    throw new Error("useData must be used inside <DataProvider>");
  }
  return session;
}

function toWebMeal(input: MealEntryInput, existing?: MealEntry): MealEntry {
  const now = Date.now();
  const name = input.name?.trim();
  const note = input.note?.trim();
  return {
    id: existing?.id ?? uuidv7(),
    childId: input.childId,
    kind: "meal",
    occurredAt: input.occurredAt,
    occurredTz: input.occurredTz,
    createdAt: existing?.createdAt ?? now,
    updatedAt: Math.max(now, (existing?.updatedAt ?? 0) + 1),
    deletedAt: null,
    isSeed: false,
    content: {
      amount: input.amount ?? 4,
      ...(name ? { name } : {}),
      ...(note ? { note } : {}),
      categories: [...new Set(input.categories ?? [])],
      allergenTags: [...new Set(input.allergenTags ?? [])],
      textures: [...new Set(input.textures ?? [])],
      feedingStyles: [...new Set(input.feedingStyles ?? [])],
    },
  };
}
