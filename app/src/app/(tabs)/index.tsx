/**
 * Home — the "Now" ledger. Placeholder for this ticket: the Child's serif
 * heading plus the hairline-ruled grid that Entry quick-log cards land in
 * with the logging tickets (#44+).
 */
import { Text, View } from "react-native";
import {
  Hairline,
  MetaLabel,
  Screen,
  ScreenTitle,
  Body,
} from "~/components/Screen";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

export default function HomeScreen() {
  const theme = useTheme();
  const { child } = useData();
  return (
    <Screen>
      <ScreenTitle>{child?.name}</ScreenTitle>
      <MetaLabel>Now</MetaLabel>
      <View
        style={{
          paddingHorizontal: theme.space.page,
          paddingBottom: theme.space.rowBlock,
        }}
      >
        <Text
          style={{
            color: theme.colors.meta,
            fontFamily: nativeFonts.serif,
            fontStyle: "italic",
            fontSize: theme.typography.body.fontSize,
          }}
        >
          Quick logging lands here next.
        </Text>
      </View>
      <Hairline />
      <View style={{ padding: theme.space.page }}>
        <Body dim>Nothing logged yet today.</Body>
      </View>
    </Screen>
  );
}
