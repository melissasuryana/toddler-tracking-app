import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import type { IconName, TrackerKey } from "@keepsake/design-system";
import type { RoutineEntryKind } from "@keepsake/routine";
import { FoodLogging, type FoodLoggingHandle } from "~/components/FoodLogging";
import { EntryDetail } from "~/components/EntryDetail";
import { RoutineEntryForm } from "~/components/RoutineEntryForm";
import { KeepsakeIcon } from "~/components/KeepsakeIcon";
import { PillChip } from "~/components/PillChip";
import {
  Body,
  Hairline,
  MetaLabel,
  Screen,
  ScreenTitle,
} from "~/components/Screen";
import {
  ENTRY_LABELS,
  entrySummary,
  latestEntries,
} from "~/components/entryPresentation";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";

const QUICK_ACTIONS = [
  ["feed", "Feed", "feed"],
  ["diaper_change", "Diaper", "diaper"],
  ["sleep_session", "Sleep", "sleep"],
  ["meal", "Meal", "meal"],
  ["reaction", "Reaction", "reaction"],
  ["introduction", "Introduction", "introduction"],
  ["medical", "Medical", "medical"],
  ["growth", "Growth", "growth"],
] as const;

export default function HomeScreen() {
  const data = useData();
  const theme = useTheme();
  const child = data.child;
  const foodLogging = useRef<FoodLoggingHandle>(null);
  const [now, setNow] = useState(Date.now);
  const [routineKind, setRoutineKind] = useState<RoutineEntryKind | null>(null);
  const [wakeVisible, setWakeVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = data.runningSleepTimer();
  const entries = useMemo(
    () =>
      child
        ? latestEntries(
            [
              ...data.routineEntriesForChild(child.id),
              ...data.mealsForChild(child.id),
              ...data.foodEntriesForChild(child.id),
            ],
            child.id,
            Number.MAX_SAFE_INTEGER
          )
        : [],
    [data, child?.id]
  );
  const selected = entries.find((entry) => entry.id === selectedId);
  const statusTime = Math.max(now, Date.now());
  const foods = useMemo(() => data.foods(), [data]);
  const activeWatches = useMemo(() => {
    if (!child) return [];
    const introduced = new Set(
      entries.flatMap((entry) =>
        entry.kind === "introduction" ? [entry.content.foodId] : []
      )
    );
    return foods
      .filter((food) => introduced.has(food.id))
      .flatMap((food) => {
        const status = data.foodStatus(child.id, food.id);
        return status.status === "trying" && status.watchPeriod
          ? [{ food, watch: status.watchPeriod }]
          : [];
      });
  }, [data, child?.id, entries, foods]);
  const watches = activeWatches.filter(
    ({ watch }) => watch.endsAt > statusTime
  );
  const rowStyle = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.space.fieldGap,
  };

  useEffect(() => {
    const interval = setInterval(
      () => setNow(Date.now()),
      timer ? 1_000 : 60_000
    );
    return () => clearInterval(interval);
  }, [timer?.startedAt]);

  function sleep() {
    if (timer) {
      setWakeVisible(true);
      return;
    }
    try {
      data.startSleepTimer();
      setNow(Date.now());
      setMessage(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sleep could not start."
      );
    }
  }
  function cancelWake() {
    data.cancelWake();
    setWakeVisible(false);
  }
  function open(kind: (typeof QUICK_ACTIONS)[number][0]) {
    if (kind === "sleep_session") sleep();
    else if (kind === "meal" || kind === "introduction" || kind === "reaction")
      foodLogging.current?.open(kind);
    else setRoutineKind(kind);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.sheetBlock }}
      >
        <ScreenTitle>{child?.name}</ScreenTitle>
        <MetaLabel>
          {new Date(statusTime).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </MetaLabel>
        <MetaLabel>Log now</MetaLabel>
        <View
          accessibilityLabel="Quick logging"
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            borderTopWidth: theme.rule.hairline,
            borderTopColor: theme.colors.ruleStrong,
          }}
        >
          {QUICK_ACTIONS.map(([kind, label, icon]) => {
            const tint = theme.discTint(icon);
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={
                  kind === "sleep_session"
                    ? timer
                      ? "Wake and stop Sleep timer"
                      : "Start Sleep timer"
                    : `Log ${label}`
                }
                onPress={() => open(kind)}
                style={({ pressed }) => ({
                  width: "25%",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: theme.space.fieldGap,
                  paddingVertical: theme.space.rowBlock,
                  opacity: pressed ? 0.7 : 1,
                  backgroundColor: theme.colors.sheet,
                  borderBottomWidth: theme.rule.hairline,
                  borderRightWidth: theme.rule.hairline,
                  borderColor: theme.colors.ruleThin,
                })}
              >
                <View
                  style={{
                    padding: theme.space.fieldGap,
                    borderRadius: theme.radius.pill,
                    backgroundColor: tint.background,
                  }}
                >
                  <KeepsakeIcon name={icon} color={tint.foreground} />
                </View>
                <Body>
                  {kind === "sleep_session" && timer ? "Wake" : label}
                </Body>
              </Pressable>
            );
          })}
        </View>
        <View
          style={{
            padding: theme.space.page,
            gap: theme.space.fieldGap,
            backgroundColor: theme.colors.sleepBand,
          }}
        >
          <Body>
            {timer
              ? `Asleep · ${elapsed(statusTime - timer.startedAt)} · timer running`
              : "Awake · no running timer"}
          </Body>
          {timer ? (
            <Body dim>
              Fell asleep {time(timer.startedAt, timer.startedTz)} ·{" "}
              {timer.startedTz}
            </Body>
          ) : null}
          {(["feed", "diaper_change", "sleep_session"] as const).map((kind) => {
            const entry = entries.find((item) => item.kind === kind);
            return (
              <Body key={kind} dim>
                Last {ENTRY_LABELS[kind]} ·{" "}
                {entry ? time(entry.occurredAt, entry.occurredTz) : "—"}
              </Body>
            );
          })}
          {message ? <Body>{message}</Body> : null}
        </View>
        <Hairline />
        {watches.length ? <MetaLabel>Active Watch Cards</MetaLabel> : null}
        {watches.map(({ food, watch }) => (
          <View
            key={food.id}
            style={{
              backgroundColor: theme.colors.sheet,
              padding: theme.space.page,
              gap: theme.space.fieldGap,
              borderTopWidth: theme.rule.alert,
              borderTopColor: theme.statusPillTint("trying").border,
            }}
          >
            <Body>Watching: {food.name}</Body>
            <Body dim>
              Day{" "}
              {Math.min(
                3,
                Math.max(
                  1,
                  Math.floor((statusTime - watch.startedAt) / 86_400_000) + 1
                )
              )}{" "}
              of 3 · until{" "}
              {time(
                watch.endsAt,
                Intl.DateTimeFormat().resolvedOptions().timeZone
              )}
            </Body>
            <View style={rowStyle}>
              <PillChip
                label={`Offer ${food.name} again`}
                selected={false}
                onPress={() =>
                  foodLogging.current?.open("introduction", food.id)
                }
              />
              <PillChip
                label={`Reaction to ${food.name}`}
                selected={false}
                onPress={() => foodLogging.current?.open("reaction", food.id)}
              />
              <PillChip
                label={`Mark ${food.name} safe`}
                selected={false}
                onPress={() => {
                  try {
                    if (!child || !data.markFoodSafe(child.id, food.id))
                      throw new Error("This Watch Period has already ended.");
                    setMessage(`${food.name} marked safe.`);
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Food could not be marked safe."
                    );
                  }
                }}
              />
            </View>
          </View>
        ))}
        <MetaLabel>Latest entries</MetaLabel>
        {!entries.length ? (
          <View style={{ padding: theme.space.page }}>
            <Body dim>
              Nothing logged yet. Start with a quick action above.
            </Body>
          </View>
        ) : null}
        {entries.slice(0, 10).map((entry) => {
          const icon: IconName & TrackerKey =
            entry.kind === "diaper_change"
              ? "diaper"
              : entry.kind === "sleep_session"
                ? "sleep"
                : entry.kind;
          const tint = theme.discTint(icon);
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${ENTRY_LABELS[entry.kind]} · ${entrySummary(entry, foods)}`}
              onPress={() => setSelectedId(entry.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: theme.space.rowGap,
                padding: theme.space.page,
                backgroundColor: theme.colors.sheet,
                opacity: pressed ? 0.7 : 1,
                borderBottomWidth: theme.rule.hairline,
                borderBottomColor: theme.colors.ruleThin,
              })}
            >
              <KeepsakeIcon name={icon} color={tint.foreground} />
              <View style={{ flex: 1, gap: theme.space.fieldGap }}>
                <Body>
                  {ENTRY_LABELS[entry.kind]} · {entrySummary(entry, foods)}
                </Body>
                <Body dim>{time(entry.occurredAt, entry.occurredTz)}</Body>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {child ? (
        <FoodLogging ref={foodLogging} childId={child.id} hideDefaultContent />
      ) : null}
      <Modal
        visible={routineKind !== null || wakeVisible || selected !== undefined}
        animationType="slide"
        onRequestClose={() => {
          if (wakeVisible) cancelWake();
          else {
            setRoutineKind(null);
            setSelectedId(null);
          }
        }}
      >
        <Screen>
          {selected ? (
            <EntryDetail
              key={selected.id}
              entry={selected}
              onClose={() => setSelectedId(null)}
              onAlsoMeal={(entry) => {
                setSelectedId(null);
                foodLogging.current?.alsoMeal(entry);
              }}
            />
          ) : child && wakeVisible && timer ? (
            <RoutineEntryForm
              key={`wake-${timer.startedAt}`}
              childId={child.id}
              kind="sleep_session"
              sleepStart={timer.startedAt}
              sleepTimezone={timer.startedTz}
              onCancel={cancelWake}
              onSave={(input) => {
                if (input.kind !== "sleep_session")
                  throw new Error("Choose a Sleep Session.");
                const saved = data.stopSleepTimer(input.quality, {
                  startAt: input.startAt,
                  endedAt: input.occurredAt,
                  factors: input.factors,
                });
                setWakeVisible(false);
                setSelectedId(saved.id);
                setMessage("Sleep Session saved.");
              }}
            />
          ) : child && routineKind ? (
            <RoutineEntryForm
              key={routineKind}
              childId={child.id}
              kind={routineKind}
              onCancel={() => setRoutineKind(null)}
              onSave={(input) => {
                const saved = data.createRoutineEntry(input);
                setRoutineKind(null);
                setSelectedId(saved.id);
                setMessage("Entry saved.");
              }}
            />
          ) : null}
        </Screen>
      </Modal>
    </Screen>
  );
}

function time(epoch: number, timezone: string) {
  return new Date(epoch).toLocaleString(undefined, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function elapsed(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1_000);
  return seconds >= 3_600
    ? `${Math.floor(seconds / 3_600)}h ${Math.floor((seconds % 3_600) / 60)}m`
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
      : `${seconds}s`;
}
