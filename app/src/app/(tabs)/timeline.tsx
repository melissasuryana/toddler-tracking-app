/**
 * Timeline — every Entry in reverse chronological order. Placeholder for
 * this ticket; the Entry list arrives with the logging tickets.
 */
import { View } from "react-native";
import { Body, Hairline, Screen, ScreenTitle } from "~/components/Screen";
import { useTheme } from "~/theme/ThemeProvider";

export default function TimelineScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <ScreenTitle>Timeline</ScreenTitle>
      <View style={{ height: theme.space.rowBlock }} />
      <Hairline />
      <View style={{ padding: theme.space.page }}>
        <Body dim>Entries will appear here as you log them.</Body>
      </View>
    </Screen>
  );
}
