import {
  DEFAULT_TEMPERATURE_UNIT,
  TEMPERATURE_UNITS,
  formatTemperatureUnit,
} from "@keepsake/local-data";
import { Pressable, ScrollView, View } from "react-native";
import { useState } from "react";
import type { ImportReport } from "@keepsake/import";
import { ImportCounts, TriedFoodImport } from "~/components/TriedFoodImport";
import { PillChip } from "~/components/PillChip";
import {
  Body,
  Hairline,
  MetaLabel,
  Row,
  Screen,
  ScreenTitle,
} from "~/components/Screen";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";

export default function SettingsScreen() {
  const theme = useTheme();
  const data = useData();
  const unit = data.temperatureUnit() ?? DEFAULT_TEMPERATURE_UNIT;
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportReport | null>(null);

  return (
    <Screen>
      <ScrollView>
        <ScreenTitle>Settings</ScreenTitle>
        <Hairline style={{ marginTop: theme.space.sheetBlock }} />

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
          <View style={{ flex: 1, gap: theme.space.fieldGap }}>
            <Body>Import tried foods</Body>
            <Body dim>Bring a food history into your journal.</Body>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import tried foods"
            onPress={() => {
              setResult(null);
              setImporting(true);
            }}
          >
            <Body>Import</Body>
          </Pressable>
        </Row>
        {result ? (
          <View style={{ padding: theme.space.page, gap: theme.space.rowGap }}>
            <Body>Import complete</Body>
            <ImportCounts report={result} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setResult(null)}
            >
              <Body>Dismiss result</Body>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      {importing ? (
        <TriedFoodImport
          onClose={() => setImporting(false)}
          onImported={(report) => {
            setResult(report);
            setImporting(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
