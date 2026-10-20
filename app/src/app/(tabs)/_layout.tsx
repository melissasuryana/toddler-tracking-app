/**
 * The four-tab shell (issue #43): Home, Timeline, Foods, Settings. Tab icons
 * are design-system stroke icons rendered via react-native-svg (no emoji);
 * colors, spacing, and rule widths all resolve to Keepsake tokens.
 */
import type { IconName } from "@keepsake/design-system";
import { Tabs } from "expo-router";
import { KeepsakeIcon } from "~/components/KeepsakeIcon";
import { useTheme } from "~/theme/ThemeProvider";

const TAB_ICONS: Record<string, IconName> = {
  index: "now",
  timeline: "timeline",
  foods: "foods",
  settings: "settings",
};

function TabIcon({
  route,
  color,
  size,
}: {
  route: string;
  color: string;
  size: number;
}) {
  const name = TAB_ICONS[route] ?? "now";
  return <KeepsakeIcon name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.paper },
        tabBarActiveTintColor: theme.colors.ink,
        tabBarInactiveTintColor: theme.colors.meta,
        tabBarStyle: {
          backgroundColor: theme.colors.sheet,
          borderTopColor: theme.colors.ruleThin,
          borderTopWidth: theme.rule.hairline,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.meta.fontSize,
          fontWeight: String(theme.typography.meta.fontWeight) as "600",
          letterSpacing:
            theme.typography.meta.letterSpacingEm *
            theme.typography.meta.fontSize,
          textTransform: theme.typography.meta.textTransform,
        },
        tabBarIcon: ({ color }) => (
          <TabIcon route={route.name} color={color} size={theme.size.tabIcon} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="timeline" options={{ title: "Timeline" }} />
      <Tabs.Screen name="foods" options={{ title: "Foods" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
