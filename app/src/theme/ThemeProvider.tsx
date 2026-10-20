/**
 * ThemeProvider + useTheme() — the React half of the ADR 0005 adapter.
 * Resolves day/night from the system appearance (`useColorScheme()`) and
 * re-renders live on appearance change. All values come from
 * @keepsake/design-system via ./tokens — no token values are defined here.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { resolveTheme, type Theme } from "./tokens";

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo(() => resolveTheme(scheme), [scheme]);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/** The active Keepsake theme. Throws outside the provider — every screen is inside it. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return theme;
}
