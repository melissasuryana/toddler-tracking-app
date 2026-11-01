/**
 * Root layout: opens the local database, installs the Keepsake theme
 * (day/night follows the saved preference or system appearance), and gates the whole app on
 * a Child existing — before that, onboarding is the only reachable UI
 * (issue #43; no logging surface mounts until the gate opens).
 */
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Onboarding } from "~/components/Onboarding";
import { SessionProvider, useData } from "~/data/DataProvider";
import { ThemeProvider, useTheme } from "~/theme/ThemeProvider";

function Gate() {
  const theme = useTheme();
  const { child } = useData();
  if (!child) {
    return <Onboarding />;
  }
  return (
    <>
      <StatusBar style={theme.name === "night" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.paper },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <ThemeProvider>
          <Gate />
        </ThemeProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
