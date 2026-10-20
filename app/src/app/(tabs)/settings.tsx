/**
 * Settings (issue #43): the temperature-unit preference (editable) and the
 * "Import tried foods" entry point, which dead-ends until the CSV import
 * ticket lands.
 */
import {
  DEFAULT_TEMPERATURE_UNIT,
  TEMPERATURE_UNITS,
  formatTemperatureUnit,
} from "@keepsake/local-data";
import { View } from "react-native";
import { PillChip } from "~/components/PillChip";
import { Body, MetaLabel, Row, Screen, ScreenTitle } from "~/components/Screen";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";

export default function SettingsScreen() {
  const theme = useTheme();
  const data = useData();
  const unit = data.temperatureUnit() ?? DEFAULT_TEMPERATURE_UNIT;

  return (
    <Screen>
      <ScreenTitle>Settings</ScreenTitle>

      <MetaLabel>Preferences</MetaLabel>
      <Row>
        <Body>Temperature unit</Body>
        <View style={{ flexDirection: "row", gap: theme.space.rowGap }}>
          {TEMPERATURE_UNITS.map((option) => (
            <PillChip
              key={option}
              label={formatTemperatureUnit(option)}
              selected={unit === option}
              // Editing the preference changes the default for NEW Entries
              // only; stored Entries keep the unit they were logged with
              // (issue #43 — never rewrite historical Entry units).
              onPress={() => data.setTemperatureUnit(option)}
            />
          ))}
        </View>
      </Row>

      <MetaLabel>Data</MetaLabel>
      <Row>
        <Body>Import tried foods</Body>
        <Body dim>Coming with the import ticket</Body>
      </Row>
    </Screen>
  );
}
