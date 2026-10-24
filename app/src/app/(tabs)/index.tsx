/** Home — the "Now" ledger with the Child's persistent Sleep timer control. */
import { useEffect, useState } from "react";
import { SLEEP_QUALITIES, type RoutineEntry } from "@keepsake/routine";
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
          Sleep
        </Text>
      </View>
      <View
        style={{
          backgroundColor: theme.colors.sheet,
          padding: theme.space.page,
          gap: theme.space.fieldGap,
        }}
      >
        <Body>{timer ? "Sleep timer running" : "No running Sleep timer"}</Body>
        {timer ? (
          <Body dim>
            Started {formatElapsed(now - timer.startedAt)} ago ·{" "}
            {timer.startedTz}
          </Body>
        ) : (
          <Body dim>Start a timer when your Child falls asleep.</Body>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            timer ? "Wake and stop Sleep timer" : "Start Sleep timer"
          }
          onPress={
            timer
              ? () => {
                  setSleepError(null);
                  setWakePromptVisible(true);
                }
              : start
          }
          style={{
            alignSelf: "flex-start",
            backgroundColor: theme.colors.ink,
            borderRadius: theme.radius.pill,
            paddingHorizontal: theme.space.rowBlock,
            paddingVertical: theme.space.fieldGap,
          }}
        >
          <Text
            style={{
              color: theme.colors.paper,
              fontSize: theme.typography.body.fontSize,
              fontWeight: String(theme.typography.meta.fontWeight) as "600",
            }}
          >
            {timer ? "Wake" : "Start sleep"}
          </Text>
        </Pressable>
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
            justifyContent: "center",
            padding: theme.space.page,
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
              padding: theme.space.page,
              gap: theme.space.fieldGap,
            }}
          >
            <Text
              style={{
                color: theme.colors.ink,
                fontFamily: nativeFonts.serif,
                fontSize: theme.typography.sheetTitle.fontSize,
              }}
            >
              Sleep quality
            </Text>
            <Body>Choose a quality to save this Sleep Session.</Body>
            {SLEEP_QUALITIES.map((quality) => (
              <Pressable
                key={quality}
                accessibilityRole="button"
                onPress={() => stop(quality)}
                style={{
                  borderColor: theme.colors.ruleThin,
                  borderRadius: theme.radius.pill,
                  borderWidth: theme.rule.hairline,
                  padding: theme.space.rowBlock,
                }}
              >
                <Body>{quality[0].toUpperCase() + quality.slice(1)}</Body>
              </Pressable>
            ))}
            {sleepError ? <Body>{sleepError}</Body> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel Wake and keep Sleep timer running"
              onPress={cancelWakePrompt}
              style={{
                alignSelf: "flex-start",
                paddingVertical: theme.space.fieldGap,
              }}
            >
              <Body dim>Cancel — keep timer running</Body>
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

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Sleep timer could not be saved.";
}
