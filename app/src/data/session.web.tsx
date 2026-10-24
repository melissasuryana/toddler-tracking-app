/**
 * Web stand-in for the data session: expo-sqlite has no web implementation
 * and the app targets iOS, so this in-memory session exists purely to keep
 * the app importable/bundleable off-device. Nothing here persists.
 */
import { uuidv7 } from "@keepsake/local-data";
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
    }),
    [child, sleepTimer, unit]
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
