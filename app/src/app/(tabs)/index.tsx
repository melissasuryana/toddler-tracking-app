/** Home — the "Now" ledger with the Child's persistent Sleep timer control. */
import { useEffect, useState } from "react";
import {
  SLEEP_QUALITIES,
  type RoutineEntry,
  type SleepQuality,
} from "@keepsake/routine";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MealForm } from "~/components/MealForm";
import { PillChip } from "~/components/PillChip";
import { SleepSessionEditor } from "~/components/SleepSessionEditor";
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
  const {
    child,
    runningSleepTimer,
    startSleepTimer,
    cancelWake,
    stopSleepTimer,
    hasSleepSessionOverlap,
    updateSleepSession,
    mealsForChild,
    mealDefaultsForChild,
    mealNameSuggestions,
    createMeal,
    updateMeal,
  } = useData();
  const timer = runningSleepTimer();
  const [now, setNow] = useState(Date.now);
  const [wakePromptVisible, setWakePromptVisible] = useState(false);
  const [sleepError, setSleepError] = useState<string | null>(null);
  const [selectedSleepQuality, setSelectedSleepQuality] =
    useState<SleepQuality>("great");
  const [lastSleepSession, setLastSleepSession] = useState<Extract<
    RoutineEntry,
    { kind: "sleep_session" }
  > | null>(null);
  const [sleepSessionOverlaps, setSleepSessionOverlaps] = useState(false);
  const [sleepEditorVisible, setSleepEditorVisible] = useState(false);
  const [mealFormVisible, setMealFormVisible] = useState(false);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const meals = child ? mealsForChild(child.id) : [];
  const selectedMeal = meals.find((meal) => meal.id === selectedMealId) ?? null;

  useEffect(() => {
    if (!timer) return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [timer?.startedAt]);

  useEffect(() => {
    if (lastSleepSession) {
      setSleepSessionOverlaps(hasSleepSessionOverlap(lastSleepSession.id));
    }
  }, [hasSleepSessionOverlap, lastSleepSession]);

  const start = () => {
    try {
      startSleepTimer();
      setSleepError(null);
      setNow(Date.now());
    } catch (error) {
      setSleepError(errorMessage(error));
    }
  };

  const cancelWakePrompt = () => {
    cancelWake();
    setWakePromptVisible(false);
    setSleepError(null);
  };

  const stop = (quality: (typeof SLEEP_QUALITIES)[number]) => {
    try {
      const entry = stopSleepTimer(quality);
      if (entry.kind === "sleep_session") {
        setLastSleepSession(entry);
        setSleepSessionOverlaps(hasSleepSessionOverlap(entry.id));
        setSleepEditorVisible(false);
      }
      setWakePromptVisible(false);
      setSleepError(null);
    } catch (error) {
      setSleepError(errorMessage(error));
    }
  };

  return (
    <Screen>
      <ScreenTitle>{child?.name}</ScreenTitle>
      <MetaLabel>Now</MetaLabel>
      <View
        style={{
          backgroundColor: theme.colors.sleepBand,
          paddingHorizontal: theme.space.page,
          paddingVertical: theme.space.sheetBlock,
          gap: theme.space.fieldGap,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.space.rowGap,
          }}
        >
          <View style={{ flex: 1, gap: theme.space.fieldGap }}>
            <Text
              style={{
                color: theme.colors.sleepInk,
                fontFamily: nativeFonts.sans,
                fontSize: theme.typography.meta.fontSize,
                fontWeight: String(theme.typography.meta.fontWeight) as "600",
                letterSpacing:
                  theme.typography.meta.letterSpacingEm *
                  theme.typography.meta.fontSize,
                textTransform: "uppercase",
              }}
            >
              Sleep · {timer ? "timer running" : "ready"}
            </Text>
            {timer ? (
              <Text
                style={{
                  color: theme.colors.ink,
                  fontFamily: nativeFonts.serif,
                  fontSize: theme.typography.dataFigure.fontSize,
                  fontWeight: String(
                    theme.typography.dataFigure.fontWeight
                  ) as "500",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatElapsed(now - timer.startedAt)}{" "}
                <Text
                  style={{
                    color: theme.colors.sleepInk,
                    fontStyle: "italic",
                  }}
                >
                  so far
                </Text>
              </Text>
            ) : (
              <Body dim>Start a timer when your Child falls asleep.</Body>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              timer ? "Wake and stop Sleep timer" : "Start Sleep timer"
            }
            onPress={
              timer
                ? () => {
                    setSleepError(null);
                    setSelectedSleepQuality("great");
                    setWakePromptVisible(true);
                  }
                : start
            }
            style={({ pressed }) => ({
              alignSelf: "center",
              backgroundColor: theme.colors.ink,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.space.buttonInset,
              paddingVertical: theme.space.rowBlock,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: theme.colors.paper,
                fontFamily: nativeFonts.sans,
                fontSize: theme.typography.body.fontSize,
                fontWeight: String(theme.typography.meta.fontWeight) as "600",
              }}
            >
              {timer ? "Wake" : "Start sleep"}
            </Text>
          </Pressable>
        </View>
        {timer ? (
          <Body dim>
            Down at {formatSleepTime(timer.startedAt, timer.startedTz)} ·{" "}
            {timer.startedTz}
          </Body>
        ) : null}
        {sleepError && !wakePromptVisible ? <Body>{sleepError}</Body> : null}
      </View>
      <Hairline />
      {lastSleepSession ? (
        <View
          style={{
            backgroundColor: theme.colors.sheet,
            padding: theme.space.page,
            gap: theme.space.fieldGap,
          }}
        >
          {sleepEditorVisible ? (
            <SleepSessionEditor
              entry={lastSleepSession}
              onCancel={() => setSleepEditorVisible(false)}
              onSave={(input) => {
                const updated = updateSleepSession(lastSleepSession.id, input);
                if (!updated || updated.kind !== "sleep_session") {
                  throw new Error("This Sleep Session is no longer available.");
                }
                setLastSleepSession(updated);
                setSleepSessionOverlaps(hasSleepSessionOverlap(updated.id));
                setSleepEditorVisible(false);
              }}
            />
          ) : (
            <>
              <Body>Sleep Session saved</Body>
              {sleepSessionOverlaps ? (
                <Body>
                  This Sleep Session overlaps another logged Sleep Session.
                </Body>
              ) : null}
              <PillChip
                label="Correct Sleep times"
                selected={false}
                onPress={() => setSleepEditorVisible(true)}
              />
            </>
          )}
        </View>
      ) : null}
      <Hairline />
      {mealFormVisible && child ? (
        <MealForm
          childId={child.id}
          initialMeal={selectedMeal}
          defaults={mealDefaultsForChild(child.id)}
          suggestionsFor={(query) => mealNameSuggestions(child.id, query)}
          onCancel={() => {
            setMealFormVisible(false);
            setSelectedMealId(null);
          }}
          onSave={(input, id) => {
            if (id) {
              if (!updateMeal(id, input)) {
                throw new Error("This Meal is no longer available.");
              }
              setSelectedMealId(id);
            } else {
              const meal = createMeal(input);
              setSelectedMealId(meal.id);
            }
            setMealFormVisible(false);
          }}
        />
      ) : (
        <View style={{ padding: theme.space.page, gap: theme.space.fieldGap }}>
          <PillChip
            label="Log a meal"
            selected
            onPress={() => {
              setSelectedMealId(null);
              setMealFormVisible(true);
            }}
          />
          {meals.length > 0 ? <MetaLabel>Recent Meals</MetaLabel> : null}
          {meals.slice(0, 5).map((meal) => (
            <Pressable
              key={meal.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${meal.content.name || "Meal"}`}
              onPress={() => {
                setSelectedMealId(meal.id);
                setMealFormVisible(true);
              }}
              style={{ paddingVertical: theme.space.fieldGap }}
            >
              <Body>
                {meal.content.name || "Meal"} · {meal.content.amount}/5
              </Body>
            </Pressable>
          ))}
          <Body dim>Other quick logging lands here next.</Body>
        </View>
      )}
      <Modal
        visible={wakePromptVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelWakePrompt}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
          }}
        >
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: theme.colors.ink, opacity: 0.32 },
            ]}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.colors.paper,
              borderTopColor: theme.colors.ruleStrong,
              borderTopWidth: theme.rule.alert,
              paddingHorizontal: theme.space.page,
              paddingTop: theme.space.sheetBlock,
              paddingBottom: theme.space.page,
              gap: theme.space.fieldGap,
            }}
          >
            <MetaLabel>Sleep session</MetaLabel>
            <Text
              style={{
                color: theme.colors.ink,
                fontFamily: nativeFonts.serif,
                fontSize: theme.typography.sheetTitle.fontSize,
                fontWeight: String(
                  theme.typography.sheetTitle.fontWeight
                ) as "500",
                paddingBottom: theme.space.fieldGap,
              }}
            >
              Ending{" "}
              <Text
                style={{ color: theme.colors.sleepInk, fontStyle: "italic" }}
              >
                the night
              </Text>
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: theme.space.fieldGap,
                justifyContent: "center",
                paddingVertical: theme.space.rowBlock,
              }}
            >
              {SLEEP_QUALITIES.map((quality) => {
                const selected = selectedSleepQuality === quality;
                return (
                  <Pressable
                    key={quality}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedSleepQuality(quality)}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: selected
                        ? theme.colors.safeChip.background
                        : "transparent",
                      borderColor: selected
                        ? theme.colors.safeChip.border
                        : theme.colors.chipBorder,
                      borderRadius: theme.radius.pill,
                      borderWidth: theme.rule.hairline,
                      flex: 1,
                      paddingVertical: theme.space.rowBlock,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: selected
                          ? theme.colors.safeChip.foreground
                          : theme.colors.meta,
                        fontFamily: nativeFonts.sans,
                        fontSize: theme.typography.body.fontSize,
                        fontWeight: String(
                          theme.typography.meta.fontWeight
                        ) as "600",
                      }}
                    >
                      {quality[0].toUpperCase() + quality.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {sleepError ? <Body>{sleepError}</Body> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel Wake and keep Sleep timer running"
              onPress={cancelWakePrompt}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text
                style={{
                  color: theme.colors.accent,
                  fontFamily: nativeFonts.sans,
                  fontSize: theme.typography.small.fontSize,
                  paddingVertical: theme.space.fieldGap,
                }}
              >
                Cancel — keep timer running
              </Text>
            </Pressable>
            <View
              style={{
                borderTopColor: theme.colors.ruleThin,
                borderBottomColor: theme.colors.ruleThin,
                borderTopWidth: theme.rule.hairline,
                borderBottomWidth: theme.rule.hairline,
                marginTop: theme.space.fieldGap,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: theme.space.rowBlock,
                }}
              >
                <Body>Fell asleep</Body>
                <Body dim>
                  {timer
                    ? formatSleepTime(timer.startedAt, timer.startedTz)
                    : "—"}
                </Body>
              </View>
              <Hairline />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: theme.space.rowBlock,
                }}
              >
                <Body>Woke up</Body>
                <Body dim>
                  {timer ? formatSleepTime(now, timer.startedTz) : "—"}
                </Body>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => stop(selectedSleepQuality)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: theme.colors.ink,
                borderRadius: theme.radius.pill,
                marginTop: theme.space.rowBlock,
                paddingHorizontal: theme.space.buttonInset,
                paddingVertical: theme.space.rowBlock,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.colors.paper,
                  fontFamily: nativeFonts.sans,
                  fontSize: theme.typography.body.fontSize,
                  fontWeight: String(theme.typography.meta.fontWeight) as "600",
                }}
              >
                Save sleep
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function formatElapsed(elapsedMilliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMilliseconds) / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatSleepTime(epoch: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(epoch);
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Sleep timer could not be saved.";
}
