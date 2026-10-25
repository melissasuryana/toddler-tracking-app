/**
 * Web stand-in for the data session: expo-sqlite has no web implementation
 * and the app targets iOS, so this in-memory session exists purely to keep
 * the app importable/bundleable off-device. Nothing here persists.
 */
import { uuidv7, validateEntryInput } from "@keepsake/local-data";
import {
  mealDefaultsFrom,
  mealNameSuggestionsFrom,
  normalizeMealContent,
  sortMealsByRecency,
  SEEDED_FOODS,
  deriveFoodStatus,
  introductionHeadsUpsFrom,
  mealDraftFromIntroduction,
  normalizeIntroductionContent,
  normalizeReactionContent,
  type FoodEntry,
  type FoodStatus,
  type IntroductionEntry,
  type IntroductionEntryInput,
  type ReactionEntry,
  type ReactionEntryInput,
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
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DataSession, SleepSessionEditInput } from "./session.types";

const DataContext = createContext<DataSession | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [child, setChild] = useState<Child | null>(null);
  const [unit, setUnit] = useState<TemperatureUnit | null>(null);
  const [sleepTimer, setSleepTimer] = useState<RunningSleepTimer | null>(null);
  const [sleepSessions, setSleepSessions] = useState<
    Extract<RoutineEntry, { kind: "sleep_session" }>[]
  >([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  // The shortcut reads the saved Introduction in the same turn, before React renders.
  const latestFoodEntries = useRef(foodEntries);
  latestFoodEntries.current = foodEntries;

  const session = useMemo<DataSession>(() => {
    const foods = [...SEEDED_FOODS].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    );
    const statusFor = (
      childId: string,
      foodId: string,
      now = Date.now(),
      excludeEntryId?: string
    ): FoodStatus => {
      if (!foods.some((food) => food.id === foodId))
        throw new Error("Food does not exist.");
      if (!Number.isSafeInteger(now) || now < 0)
        throw new Error("Invalid Food tracking time.");
      const evidence = foodEntries.filter(
        (entry) => entry.childId === childId && entry.occurredAt <= now
      );
      return deriveFoodStatus(
        foodId,
        evidence,
        (entryId) => {
          const entry = evidence.find((item) => item.id === entryId);
          if (!entry) return [];
          const ids =
            entry.kind === "introduction"
              ? [entry.content.foodId]
              : entry.content.foodIds;
          return ids.map((associatedId) => ({
            associationType: "food",
            associatedId,
          }));
        },
        null,
        now,
        excludeEntryId
      );
    };
    const toFoodEntry = (
      input: IntroductionEntryInput | ReactionEntryInput,
      kind: "introduction" | "reaction",
      existing?: FoodEntry
    ): FoodEntry => {
      const validation = validateEntryInput({ ...input, kind });
      if (!validation.ok)
        throw new Error("Check this entry’s date, time and Child.");
      if (input.childId !== child?.id)
        throw new Error("This Child is no longer available.");
      const now = Date.now();
      const base = {
        id: existing?.id ?? uuidv7(),
        childId: input.childId,
        kind,
        occurredAt: input.occurredAt,
        occurredTz: input.occurredTz,
        createdAt: existing?.createdAt ?? now,
        updatedAt: Math.max(now, (existing?.updatedAt ?? 0) + 1),
        deletedAt: null,
        isSeed: false,
      };
      const entry: FoodEntry =
        kind === "introduction"
          ? {
              ...base,
              kind,
              content: normalizeIntroductionContent(
                input as IntroductionEntryInput
              ),
            }
          : {
              ...base,
              kind,
              content: normalizeReactionContent(input as ReactionEntryInput),
            };
      const foodIds =
        entry.kind === "introduction"
          ? [entry.content.foodId]
          : entry.content.foodIds;
      if (foodIds.some((id) => !foods.some((food) => food.id === id)))
        throw new Error("Food does not exist.");
      return entry;
    };
    const canUpdate = (
      existing: FoodEntry | undefined,
      input: IntroductionEntryInput | ReactionEntryInput
    ) =>
      existing &&
      existing.childId === input.childId &&
      existing.occurredTz === input.occurredTz;
    return {
      foods: () => foods,
      foodStatus: statusFor,
      introductionHeadsUps: (childId, foodId, occurredAt, options = {}) => {
        const food = foods.find((item) => item.id === foodId);
        if (!food) throw new Error("Food does not exist.");
        const statuses = [
          ...new Set(
            foodEntries
              .filter((entry) => entry.childId === childId)
              .flatMap((entry) =>
                entry.kind === "introduction"
                  ? [entry.content.foodId]
                  : entry.content.foodIds
              )
          ),
        ].map((id) =>
          statusFor(childId, id, occurredAt, options.excludeEntryId)
        );
        return introductionHeadsUpsFrom(
          food,
          statusFor(childId, foodId, occurredAt, options.excludeEntryId),
          statuses,
          options
        );
      },
      foodEntriesForChild: (childId) =>
        foodEntries
          .filter((entry) => entry.childId === childId)
          .sort(
            (a, b) =>
              b.occurredAt - a.occurredAt ||
              b.createdAt - a.createdAt ||
              b.id.localeCompare(a.id)
          ),
      reactionFoods: (childId, now) =>
        foods
          .map((food) => ({
            food,
            trying: statusFor(childId, food.id, now).status === "trying",
          }))
          .sort(
            (a, b) =>
              Number(b.trying) - Number(a.trying) ||
              a.food.name.localeCompare(b.food.name) ||
              a.food.id.localeCompare(b.food.id)
          )
          .map(({ food }) => food),
      createIntroduction: (input) => {
        const entry = toFoodEntry(input, "introduction") as IntroductionEntry;
        latestFoodEntries.current = [...latestFoodEntries.current, entry];
        setFoodEntries((current) => [...current, entry]);
        return entry;
      },
      updateIntroduction: (id, input) => {
        const existing = foodEntries.find(
          (entry) => entry.id === id && entry.kind === "introduction"
        );
        if (!canUpdate(existing, input)) return null;
        const entry = toFoodEntry(
          input,
          "introduction",
          existing
        ) as IntroductionEntry;
        latestFoodEntries.current = latestFoodEntries.current.map((item) =>
          item.id === id ? entry : item
        );
        setFoodEntries((current) =>
          current.map((item) => (item.id === id ? entry : item))
        );
        return entry;
      },
      createReaction: (input) => {
        const entry = toFoodEntry(input, "reaction") as ReactionEntry;
        latestFoodEntries.current = [...latestFoodEntries.current, entry];
        setFoodEntries((current) => [...current, entry]);
        return entry;
      },
      updateReaction: (id, input) => {
        const existing = foodEntries.find(
          (entry) => entry.id === id && entry.kind === "reaction"
        );
        if (!canUpdate(existing, input)) return null;
        const entry = toFoodEntry(input, "reaction", existing) as ReactionEntry;
        latestFoodEntries.current = latestFoodEntries.current.map((item) =>
          item.id === id ? entry : item
        );
        setFoodEntries((current) =>
          current.map((item) => (item.id === id ? entry : item))
        );
        return entry;
      },
      deleteFoodEntry: (id) => {
        if (!foodEntries.some((entry) => entry.id === id)) return false;
        latestFoodEntries.current = latestFoodEntries.current.filter(
          (entry) => entry.id !== id
        );
        setFoodEntries((current) => current.filter((entry) => entry.id !== id));
        return true;
      },
      mealDraftForIntroduction: (id) => {
        const introduction = latestFoodEntries.current.find(
          (entry) => entry.id === id
        );
        if (!introduction || introduction.kind !== "introduction")
          throw new Error("Introduction does not exist.");
        const food = foods.find(
          (item) => item.id === introduction.content.foodId
        );
        if (!food) throw new Error("Food does not exist.");
        return mealDraftFromIntroduction(
          introduction,
          food,
          mealDefaultsFrom(
            meals.filter((meal) => meal.childId === introduction.childId)
          )
        );
      },
      child,
      createChild: (input: ChildInput) => {
        setChild({
          id: uuidv7(),
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
        const entry: Extract<RoutineEntry, { kind: "sleep_session" }> = {
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
        setSleepSessions((current) => [...current, entry]);
        return entry;
      },
      hasSleepSessionOverlap: (id: string) => {
        const target = sleepSessions.find((entry) => entry.id === id);
        return (
          target !== undefined &&
          sleepSessions.some(
            (entry) =>
              entry.id !== target.id &&
              entry.childId === target.childId &&
              entry.content.startAt < target.occurredAt &&
              entry.occurredAt > target.content.startAt
          )
        );
      },
      updateSleepSession: (id: string, input: SleepSessionEditInput) => {
        const existing = sleepSessions.find((entry) => entry.id === id);
        if (!existing || input.endedAt <= input.startAt) return null;
        const factors = input.factors ?? existing.content.factors;
        const updated: Extract<RoutineEntry, { kind: "sleep_session" }> = {
          ...existing,
          occurredAt: input.endedAt,
          updatedAt: Math.max(Date.now(), existing.updatedAt + 1),
          content: {
            startAt: input.startAt,
            quality: input.quality,
            ...(factors ? { factors } : {}),
          },
        };
        setSleepSessions((current) =>
          current.map((entry) => (entry.id === id ? updated : entry))
        );
        return updated;
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
    };
  }, [child, meals, foodEntries, sleepSessions, sleepTimer, unit]);

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
    content: normalizeMealContent(input),
  };
}
