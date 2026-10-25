import {
  DEFAULT_TEMPERATURE_UNIT,
  TEMPERATURE_UNITS,
  formatTemperatureUnit,
} from "@keepsake/local-data";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import type { ImportReport } from "@keepsake/import";
import { ImportCounts, TriedFoodImport } from "~/components/TriedFoodImport";
import { Body, Masthead, Screen, SectionHeader } from "~/components/Screen";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

export default function SettingsScreen() {
  const theme = useTheme();
  const data = useData();
  const child = data.child;
  const unit = data.temperatureUnit() ?? DEFAULT_TEMPERATURE_UNIT;
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportReport | null>(null);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.sheetBlock * 2 }}
      >
        {/* Direction D Masthead */}
        <Masthead
          title="The "
          emphasis="fine"
          suffix=" print"
          kicker="Settings"
        />

        {/* Preferences Section */}
        <SectionHeader title="Preferences" />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: theme.space.page,
            paddingVertical: 13,
            borderTopWidth: theme.rule.hairline,
            borderTopColor: theme.colors.ruleThin,
            backgroundColor: theme.colors.paper,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 13,
                fontWeight: "600",
                color: theme.colors.ink,
              }}
            >
              Temperature unit
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 10.5,
                color: theme.colors.meta,
                marginTop: 2,
              }}
            >
              default for new temperature entries
            </Text>
          </View>
          {/* Direction D Segmented Control (.d-seg) */}
          <View
            style={{
              flexDirection: "row",
              borderWidth: 1,
              borderColor: theme.colors.chipBorder,
              borderRadius: theme.radius.pill,
              overflow: "hidden",
            }}
          >
            {TEMPERATURE_UNITS.map((option) => {
              const selected = unit === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Set temperature unit to ${formatTemperatureUnit(option)}`}
                  onPress={() => data.setTemperatureUnit(option)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    backgroundColor: selected
                      ? theme.colors.ruleStrong
                      : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 11,
                      fontWeight: "600",
                      color: selected ? theme.colors.paper : theme.colors.meta,
                    }}
                  >
                    {formatTemperatureUnit(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Data Section */}
        <SectionHeader title="Data" />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: theme.space.page,
            paddingVertical: 13,
            borderTopWidth: theme.rule.hairline,
            borderTopColor: theme.colors.ruleThin,
            backgroundColor: theme.colors.paper,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 13,
                fontWeight: "600",
                color: theme.colors.ink,
              }}
            >
              Import tried foods
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 10.5,
                color: theme.colors.meta,
                marginTop: 2,
              }}
            >
              4-column CSV → backdated Introductions
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import tried foods"
            onPress={() => {
              setResult(null);
              setImporting(true);
            }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                fontWeight: "600",
                color: theme.colors.accent,
              }}
            >
              Import…
            </Text>
          </Pressable>
        </View>

        {result ? (
          <View
            style={{
              padding: theme.space.page,
              gap: theme.space.rowGap,
              backgroundColor: theme.colors.accentWash,
            }}
          >
            <Body>Import complete</Body>
            <ImportCounts report={result} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setResult(null)}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "600",
                  color: theme.colors.accent,
                }}
              >
                Dismiss result
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* About Section */}
        {child ? (
          <>
            <SectionHeader title="About" />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: theme.space.page,
                paddingVertical: 13,
                borderTopWidth: theme.rule.hairline,
                borderTopColor: theme.colors.ruleThin,
                backgroundColor: theme.colors.paper,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 13,
                    fontWeight: "600",
                    color: theme.colors.ink,
                  }}
                >
                  {child.name}
                </Text>
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 10.5,
                    color: theme.colors.meta,
                    marginTop: 2,
                  }}
                >
                  born {child.birthdate} · {child.sex}
                </Text>
              </View>
            </View>
          </>
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
