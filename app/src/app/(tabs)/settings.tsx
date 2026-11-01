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
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const themePreference = data.themePreference() ?? "system";
  const demoDataLoaded = data.demoDataLoaded();

  function loadDemoData() {
    try {
      if (!child) throw new Error("Create a Child profile first.");
      const foods = data.foods();
      const firstFood =
        foods.find((food) => food.name.toLowerCase() === "banana") ?? foods[0];
      const secondFood = foods.find((food) => food.id !== firstFood?.id);
      if (!firstFood || !secondFood)
        throw new Error("Demo Foods are unavailable.");

      const now = Date.now();
      const occurredTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const at = (daysAgo: number) => now - daysAgo * 86_400_000;
      data.createIntroduction({
        childId: child.id,
        occurredAt: at(5),
        occurredTz,
        foodId: firstFood.id,
        note: "Demo entry",
      });
      data.createReaction({
        childId: child.id,
        occurredAt: at(4),
        occurredTz,
        foodIds: [firstFood.id],
        severity: "mild",
        symptoms: ["rash/hives"],
        note: "Demo entry",
      });
      data.createIntroduction({
        childId: child.id,
        occurredAt: at(1),
        occurredTz,
        foodId: secondFood.id,
        note: "Demo entry",
      });
      data.createMeal({
        childId: child.id,
        occurredAt: now - 90 * 60_000,
        occurredTz,
        amount: 4,
        name: "Demo breakfast",
        note: "Demo entry",
        categories: firstFood.category ? [firstFood.category] : [],
        allergenTags: firstFood.allergenTags,
        textures: ["mashed"],
        feedingStyles: ["spoon-fed"],
      });
      data.createRoutineEntry({
        childId: child.id,
        occurredAt: now - 30 * 60_000,
        occurredTz,
        kind: "feed",
        side: "left",
        durationSeconds: 900,
      });
      data.setDemoDataLoaded(true);
      setDemoMessage("Demo entries added to the timeline.");
    } catch (error) {
      setDemoMessage(
        error instanceof Error
          ? error.message
          : "Demo data could not be loaded."
      );
    }
  }

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
              Appearance
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 10.5,
                color: theme.colors.meta,
                marginTop: 2,
              }}
            >
              choose how Keepsake looks
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              borderWidth: 1,
              borderColor: theme.colors.chipBorder,
              borderRadius: theme.radius.pill,
              overflow: "hidden",
            }}
          >
            {(["system", "light", "dark"] as const).map((option) => {
              const selected = themePreference === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Set appearance to ${option}`}
                  accessibilityState={{ selected }}
                  onPress={() => data.setThemePreference(option)}
                  style={{
                    paddingHorizontal: 10,
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
                      textTransform: "capitalize",
                    }}
                  >
                    {option}
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
              Load demo data
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 10.5,
                color: theme.colors.meta,
                marginTop: 2,
              }}
            >
              sample entries for this Child
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              demoDataLoaded ? "Demo data already loaded" : "Load demo data"
            }
            disabled={demoDataLoaded}
            onPress={loadDemoData}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                fontWeight: "600",
                color: demoDataLoaded ? theme.colors.meta : theme.colors.accent,
              }}
            >
              {demoDataLoaded ? "Loaded" : "Load"}
            </Text>
          </Pressable>
        </View>
        {demoMessage ? <Body dim={!demoDataLoaded}>{demoMessage}</Body> : null}
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
