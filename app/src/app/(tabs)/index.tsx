import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { IconName, TrackerKey } from "@keepsake/design-system";
import type { RoutineEntryKind } from "@keepsake/routine";
import { FoodLogging, type FoodLoggingHandle } from "~/components/FoodLogging";
import { EntryDetail } from "~/components/EntryDetail";
import { RoutineEntryForm } from "~/components/RoutineEntryForm";
import {
  Body,
  Hairline,
  Masthead,
  Orb,
  Screen,
  SectionHeader,
} from "~/components/Screen";
import {
  ENTRY_LABELS,
  entrySummary,
  latestEntries,
  type LoggedEntry,
} from "~/components/entryPresentation";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

const TRACKER_ROWS = [
  {
    kind: "feed",
    label: "Feed",
    icon: "feed",
    fallbackSubtitle: "breast · bottle · nursing",
  },
  {
    kind: "diaper_change",
    label: "Diaper",
    icon: "diaper",
    fallbackSubtitle: "wet · dirty · both",
  },
  {
    kind: "meal",
    label: "Meal",
    icon: "meal",
    fallbackSubtitle: "breakfast · lunch · dinner",
  },
  {
    kind: "medical",
    label: "Medical",
    icon: "medical",
    fallbackSubtitle: "medication · vaccine · temp",
  },
  {
    kind: "reaction",
    label: "Reaction",
    icon: "reaction",
    fallbackSubtitle: "symptoms · severity",
  },
  {
    kind: "introduction",
    label: "Introduction",
    icon: "introduction",
    fallbackSubtitle: "first taste · 3-day watch",
  },
  {
    kind: "growth",
    label: "Growth",
    icon: "growth",
    fallbackSubtitle: "weight · height · head",
  },
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

  const lastSleep = useMemo(
    () => entries.find((entry) => entry.kind === "sleep_session"),
    [entries]
  );

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

  function open(kind: string) {
    if (kind === "sleep_session") sleep();
    else if (kind === "meal" || kind === "introduction" || kind === "reaction")
      foodLogging.current?.open(kind);
    else setRoutineKind(kind as RoutineEntryKind);
  }

  const currentDate = new Date(statusTime);
  const dayName = currentDate.toLocaleDateString(undefined, {
    weekday: "long",
  });
  const dateKicker = currentDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.sheetBlock * 2 }}
      >
        {/* Direction D Masthead */}
        <Masthead
          title={`${child?.name ?? "Toddler"}'s `}
          emphasis={theme.name === "night" ? "night" : dayName}
          kicker={dateKicker}
        />

        {/* Direction D Sleep Band (.d-sleep) */}
        <View
          style={{
            backgroundColor: theme.colors.sleepBand,
            paddingHorizontal: theme.space.page,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 10,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: theme.colors.sleepInk,
                fontWeight: "600",
              }}
            >
              {timer ? "Sleep · timer running" : "Sleep"}
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.serif,
                fontSize: 28,
                color: theme.colors.ink,
                fontVariant: ["tabular-nums"],
                marginVertical: 2,
              }}
            >
              {timer ? (
                <>
                  {elapsed(statusTime - timer.startedAt)}{" "}
                  <Text
                    style={{
                      fontStyle: "italic",
                      color: theme.colors.sleepInk,
                    }}
                  >
                    so far
                  </Text>
                </>
              ) : lastSleep && lastSleep.kind === "sleep_session" ? (
                <>
                  {formatSleepDuration(lastSleep)}{" "}
                  <Text
                    style={{
                      fontStyle: "italic",
                      color: theme.colors.sleepInk,
                    }}
                  >
                    · {lastSleep.content.quality ?? "great"}
                  </Text>
                </>
              ) : (
                <>
                  Awake{" "}
                  <Text
                    style={{
                      fontStyle: "italic",
                      color: theme.colors.sleepInk,
                    }}
                  >
                    · resting
                  </Text>
                </>
              )}
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 10.5,
                color: theme.colors.sleepInk,
              }}
            >
              {timer
                ? `Fell asleep ${formatTime(timer.startedAt, timer.startedTz)}`
                : lastSleep && lastSleep.kind === "sleep_session"
                  ? `woke ${formatTime(lastSleep.occurredAt, lastSleep.occurredTz)}`
                  : "No running timer"}
            </Text>
          </View>
          <Pressable
            onPress={sleep}
            accessibilityRole="button"
            accessibilityLabel={
              timer ? "Wake and stop Sleep timer" : "Start Sleep timer"
            }
            style={({ pressed }) => ({
              backgroundColor: theme.colors.ruleStrong,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: theme.radius.pill,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                fontWeight: "600",
                letterSpacing: 0.3,
                color: theme.colors.paper,
              }}
            >
              {timer ? "Wake" : "Start sleep"}
            </Text>
          </Pressable>
        </View>

        {/* Direction D Watch Band (.d-watch) */}
        {watches.map(({ food, watch }) => {
          const dayNum = Math.min(
            3,
            Math.max(
              1,
              Math.floor((statusTime - watch.startedAt) / 86_400_000) + 1
            )
          );
          const reactionCount = entries.filter(
            (e) =>
              e.kind === "reaction" &&
              Array.isArray(e.content.foodIds) &&
              e.content.foodIds.includes(food.id)
          ).length;
          return (
            <View
              key={food.id}
              style={{
                backgroundColor: theme.colors.accentWash,
                borderTopWidth: 2,
                borderTopColor: theme.colors.accent,
                paddingHorizontal: theme.space.page,
                paddingTop: 12,
                paddingBottom: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: theme.colors.accent,
                  fontWeight: "600",
                }}
              >
                Watching · day {dayNum} of 3
              </Text>
              <Text
                style={{
                  fontFamily: nativeFonts.serif,
                  fontSize: 19,
                  color: theme.colors.ink,
                  marginTop: 3,
                }}
              >
                {food.name}
              </Text>
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 10.5,
                  color: theme.colors.accentInk,
                  marginTop: 2,
                }}
              >
                ends{" "}
                {formatTime(
                  watch.endsAt,
                  Intl.DateTimeFormat().resolvedOptions().timeZone
                )}{" "}
                ·{" "}
                {reactionCount === 0
                  ? "no reactions logged"
                  : `${reactionCount} reaction(s) logged`}
              </Text>
              {/* 3 Day Ticks */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 4,
                  marginVertical: 10,
                }}
              >
                {[1, 2, 3].map((d) => (
                  <View
                    key={d}
                    style={{
                      width: 26,
                      height: 5,
                      borderRadius: 99,
                      backgroundColor:
                        d <= dayNum
                          ? theme.colors.accent
                          : theme.name === "night"
                            ? "#4A3A2A"
                            : "#EFD8C3",
                    }}
                  />
                ))}
              </View>
              {/* Contextual Action Links */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <Pressable
                  onPress={() =>
                    foodLogging.current?.open("introduction", food.id)
                  }
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 11,
                      fontWeight: "bold",
                      color: theme.colors.accent,
                      textDecorationLine: "underline",
                    }}
                  >
                    Try again
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => foodLogging.current?.open("reaction", food.id)}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 11,
                      fontWeight: "bold",
                      color: theme.colors.danger,
                      textDecorationLine: "underline",
                    }}
                  >
                    Log reaction
                  </Text>
                </Pressable>
                <Pressable
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
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 11,
                      fontWeight: "bold",
                      color: theme.colors.accentInk,
                      textDecorationLine: "underline",
                    }}
                  >
                    Mark safe
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {message ? (
          <View
            style={{
              paddingHorizontal: theme.space.page,
              paddingVertical: 10,
              backgroundColor: theme.colors.accentWash,
            }}
          >
            <Body>{message}</Body>
          </View>
        ) : null}

        {/* Direction D Quiet Tracker Rows (.d-row) */}
        <View style={{ marginTop: 2 }}>
          {TRACKER_ROWS.map(({ kind, label, icon, fallbackSubtitle }) => {
            const entry = entries.find((item) => item.kind === kind);
            const subtitle = entry
              ? `${elapsedAgo(entry.occurredAt, statusTime)} · ${entrySummary(entry, foods)}`
              : fallbackSubtitle;
            const trackerKey = (
              icon === "diaper" ? "diaper" : icon
            ) as TrackerKey;

            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={`Log ${label}`}
                onPress={() => open(kind)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: theme.space.page,
                  paddingVertical: 10,
                  gap: 12,
                  borderTopWidth: theme.rule.hairline,
                  borderTopColor: theme.colors.ruleThin,
                  backgroundColor: theme.colors.paper,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Orb
                  icon={icon as IconName}
                  tracker={trackerKey}
                  size={36}
                  iconSize={17}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 13,
                      fontWeight: "600",
                      color: theme.colors.ink,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 10.5,
                      color: theme.colors.meta,
                      marginTop: 1,
                    }}
                  >
                    {subtitle}
                  </Text>
                </View>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: theme.name === "night" ? "#6B4A38" : "#E2C3AB",
                    borderRadius: theme.radius.pill,
                    paddingHorizontal: 13,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 11,
                      fontWeight: "600",
                      color: theme.colors.accent,
                    }}
                  >
                    Log
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Latest entries ledger list */}
        {entries.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <SectionHeader title="Latest entries" />
            {entries.slice(0, 5).map((entry) => {
              const iconName: IconName =
                entry.kind === "diaper_change"
                  ? "diaper"
                  : entry.kind === "sleep_session"
                    ? "sleep"
                    : (entry.kind as IconName);
              const trackerKey: TrackerKey =
                entry.kind === "diaper_change"
                  ? "diaper"
                  : entry.kind === "sleep_session"
                    ? "sleep"
                    : (entry.kind as TrackerKey);

              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${ENTRY_LABELS[entry.kind]} · ${entrySummary(entry, foods)}`}
                  onPress={() => setSelectedId(entry.id)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: theme.space.page,
                    paddingVertical: 10,
                    gap: 12,
                    borderTopWidth: theme.rule.hairline,
                    borderTopColor: theme.colors.ruleThin,
                    backgroundColor: theme.colors.paper,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Orb
                    icon={iconName}
                    tracker={trackerKey}
                    size={36}
                    iconSize={17}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: nativeFonts.sans,
                        fontSize: 13,
                        fontWeight: "600",
                        color: theme.colors.ink,
                      }}
                    >
                      {ENTRY_LABELS[entry.kind]} · {entrySummary(entry, foods)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: nativeFonts.sans,
                        fontSize: 10.5,
                        color: theme.colors.meta,
                        marginTop: 1,
                      }}
                    >
                      {elapsedAgo(entry.occurredAt, statusTime)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: nativeFonts.serif,
                      fontStyle: "italic",
                      fontSize: 11.5,
                      color: theme.colors.meta,
                    }}
                  >
                    {formatTime(entry.occurredAt, entry.occurredTz)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
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

function formatTime(epoch: number, timezone: string) {
  return new Date(epoch).toLocaleTimeString(undefined, {
    timeZone: timezone,
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

function elapsedAgo(epoch: number, now: number) {
  const diff = Math.max(0, now - epoch);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSleepDuration(entry: LoggedEntry) {
  if (entry.kind !== "sleep_session") return "";
  const start = entry.content.startAt;
  const end = entry.occurredAt;
  const diff = Math.max(0, end - start);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
