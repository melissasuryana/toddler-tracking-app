/**
 * App-side data session (native): opens the local database once (migrations
 * + seeds via @keepsake/local-data), answers the onboarding gate question,
 * and exposes the repositories through React context. Fully offline, no
 * account. The web build resolves session.web.tsx instead — Metro picks the
 * platform file, so expo-sqlite is never bundled off-device.
 */
import type {
  Child,
  ChildInput,
  LocalDatabase,
  TemperatureUnit,
} from "@keepsake/local-data";
import { MealEntries } from "@keepsake/food-tracking";
import { openAppDatabase } from "@keepsake/local-data/expo";
import { RoutineEntries, type SleepQuality } from "@keepsake/routine";
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
  const [db] = useState<LocalDatabase>(() => openAppDatabase());
  const [child, setChild] = useState<Child | null>(() => db.children.first());
  const [unitVersion, setUnitVersion] = useState(0);
  const [sleepTimerVersion, setSleepTimerVersion] = useState(0);
  const [routineEntries] = useState(() => new RoutineEntries(db));
  const [mealEntries] = useState(() => new MealEntries(db));
  const [mealVersion, setMealVersion] = useState(0);

  const session = useMemo<DataSession>(
    () => ({
      child,
      createChild: (input: ChildInput) => {
        setChild(db.children.create(input));
      },
      temperatureUnit: () => {
        void unitVersion; // re-read after a Settings edit
        return db.preferences.get("temperatureUnit");
      },
      setTemperatureUnit: (unit: TemperatureUnit) => {
        db.preferences.set("temperatureUnit", unit);
        setUnitVersion((version) => version + 1);
      },
      runningSleepTimer: () => {
        void sleepTimerVersion;
        return child ? routineEntries.getSleepTimer(child.id) : null;
      },
      startSleepTimer: () => {
        if (!child) throw new Error("A Child is required to start Sleep.");
        routineEntries.startSleepTimer({
          childId: child.id,
          startedTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setSleepTimerVersion((version) => version + 1);
      },
      cancelWake: () => {
        if (child) routineEntries.cancelWake(child.id);
      },
      stopSleepTimer: (quality: SleepQuality) => {
        if (!child) throw new Error("A Child is required to stop Sleep.");
        const entry = routineEntries.stopSleepTimer(child.id, {
          endedAt: Date.now(),
          quality,
        });
        setSleepTimerVersion((version) => version + 1);
        return entry;
      },
      hasSleepSessionOverlap: (id) => {
        const entry = routineEntries.get(id);
        return (
          entry?.kind === "sleep_session" &&
          routineEntries.hasSleepSessionOverlap(
            entry.childId,
            entry.content.startAt,
            entry.occurredAt,
            entry.id
          )
        );
      },
      updateSleepSession: (id, input) => {
        const existing = routineEntries.get(id);
        if (!existing || existing.kind !== "sleep_session") return null;
        return routineEntries.update(id, {
          childId: existing.childId,
          kind: "sleep_session",
          startAt: input.startAt,
          occurredAt: input.endedAt,
          occurredTz: existing.occurredTz,
          quality: input.quality,
          factors: input.factors ?? existing.content.factors,
        });
      },
      mealsForChild: (childId: string) => {
        void mealVersion;
        return mealEntries.listForChild(childId);
      },
      mealDefaultsForChild: (childId: string) => {
        void mealVersion;
        return mealEntries.defaultsForChild(childId);
      },
      mealNameSuggestions: (childId: string, query: string) => {
        void mealVersion;
        return mealEntries.nameSuggestions(childId, query);
      },
      createMeal: (input) => {
        const meal = mealEntries.create(input);
        setMealVersion((version) => version + 1);
        return meal;
      },
      updateMeal: (id, input) => {
        const meal = mealEntries.update(id, input);
        if (meal) setMealVersion((version) => version + 1);
        return meal;
      },
    }),
    [
      child,
      db,
      mealEntries,
      mealVersion,
      routineEntries,
      sleepTimerVersion,
      unitVersion,
    ]
  );

  return (
    <DataContext.Provider value={session}>{children}</DataContext.Provider>
  );
}

/** The open data session. Throws outside DataProvider. */
export function useData(): DataSession {
  const session = useContext(DataContext);
  if (!session) {
    throw new Error("useData must be used inside <DataProvider>");
  }
  return session;
}
