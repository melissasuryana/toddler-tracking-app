/**
 * Foods — the per-Food status browser (untried / trying / safe / avoid).
 * Placeholder for this ticket; the seeded food database and status pills
 * arrive with the foods tickets.
 */
import { View } from "react-native";
import { Body, Hairline, Screen, ScreenTitle } from "~/components/Screen";
import { useTheme } from "~/theme/ThemeProvider";

export default function FoodsScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <ScreenTitle>Foods</ScreenTitle>
      <View style={{ height: theme.space.rowBlock }} />
      <Hairline />
      <View style={{ padding: theme.space.page }}>
        <Body dim>The food database arrives with the import ticket.</Body>
      </View>
    </Screen>
  );
}
