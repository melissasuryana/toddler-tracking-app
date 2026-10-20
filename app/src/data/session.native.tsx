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
import { openAppDatabase } from "@keepsake/local-data/expo";
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
    }),
    [child, db, unitVersion]
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
