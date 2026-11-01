/** Timeline — a timezone-aware week strip and Keepsake day ledger. */
import { useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { EntryDetail } from "~/components/EntryDetail";
import { FoodLogging, type FoodLoggingHandle } from "~/components/FoodLogging";
import { EmptyState, Masthead, Orb, Screen } from "~/components/Screen";
import {
  ENTRY_LABELS,
  entriesForLocalDate,
  latestEntries,
  localDateKey,
  shiftCalendarDate,
  timelineEntryPresentation,
  timelineEntrySummary,
  type LoggedEntry,
  weekDates,
} from "~/components/entryPresentation";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  timeZone: "UTC",
  weekday: "short",
});
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  timeZone: "UTC",
  day: "numeric",
});
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  timeZone: "UTC",
  weekday: "long",
  month: "short",
  day: "numeric",
});
const RANGE_FORMAT = new Intl.DateTimeFormat(undefined, {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

export default function TimelineScreen() {
  const data = useData();
  const theme = useTheme();
  const child = data.child;
  const foodLogging = useRef<FoodLoggingHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localDateKey(Date.now(), timezone);
  const [selectedDate, setSelectedDate] = useState(() =>
    localDateKey(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone)
  );

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
  const foods = useMemo(() => data.foods(), [data]);
  const selectedDayEntries = useMemo(
    () => entriesForLocalDate(entries, selectedDate),
    [entries, selectedDate]
  );
  const week = weekDates(selectedDate);
  const weekKey = week.join(",");
  const currentWeek = weekDates(today).join(",") === weekKey;
  const weekEntryCount = entries.filter((entry) =>
    week.includes(localDateKey(entry.occurredAt, entry.occurredTz))
  ).length;
  const selected = entries.find((entry) => entry.id === selectedId);

  function moveWeek(amount: number) {
    setSelectedDate((date) => shiftCalendarDate(date, amount * 7));
  }

  function chooseDay(date: string) {
    setSelectedDate(date);
  }

  return (
    <Screen>
      <Masthead
        title="The "
        emphasis="ledger"
        kicker={entries.length > 0 ? `${entries.length}` : undefined}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.sheetBlock * 2 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: theme.space.page,
            paddingTop: 8,
            gap: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            onPress={() => moveWeek(-1)}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.sheet,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text style={{ color: theme.colors.ink, fontSize: 20 }}>‹</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              textAlign: "center",
              color: theme.colors.ink,
              fontFamily: nativeFonts.serif,
              fontSize: theme.typography.sheetTitle.fontSize,
            }}
          >
            {weekLabel(week, today)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next week"
            accessibilityState={{ disabled: currentWeek }}
            disabled={currentWeek}
            onPress={() => moveWeek(1)}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.sheet,
              opacity: currentWeek ? 0.35 : pressed ? 0.65 : 1,
            })}
          >
            <Text style={{ color: theme.colors.ink, fontSize: 20 }}>›</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            onPress={() => setSelectedDate(today)}
            hitSlop={8}
          >
            <Text
              style={{
                color: theme.colors.accent,
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              Today
            </Text>
          </Pressable>
        </View>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Choose a day"
          style={{
            flexDirection: "row",
            paddingHorizontal: theme.space.page,
            paddingVertical: 8,
            gap: 4,
          }}
        >
          {week.map((date) => {
            const isSelected = date === selectedDate;
            const isToday = date === today;
            const dayCount = entries.filter(
              (entry) =>
                localDateKey(entry.occurredAt, entry.occurredTz) === date
            ).length;
            const dateObject = new Date(`${date}T00:00:00.000Z`);
            return (
              <Pressable
                key={date}
                accessibilityRole="radio"
                accessibilityLabel={`${WEEKDAY_FORMAT.format(dateObject)} ${date}${dayCount ? `, ${dayCount} ${dayCount === 1 ? "entry" : "entries"}` : ", no entries"}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => chooseDay(date)}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 7,
                  borderRadius: theme.radius.pill,
                  borderWidth: theme.rule.hairline,
                  borderColor: isSelected
                    ? theme.colors.accent
                    : isToday
                      ? theme.colors.accent
                      : "transparent",
                  backgroundColor: isSelected
                    ? theme.colors.accent
                    : theme.colors.sheet,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Text
                  style={{
                    color: isSelected ? theme.colors.paper : theme.colors.meta,
                    fontFamily: nativeFonts.sans,
                    fontSize: 9,
                    fontWeight: "600",
                    textTransform: "uppercase",
                  }}
                >
                  {WEEKDAY_FORMAT.format(dateObject)}
                </Text>
                <Text
                  style={{
                    color: isSelected ? theme.colors.paper : theme.colors.ink,
                    fontFamily: nativeFonts.sans,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  {DAY_FORMAT.format(dateObject)}
                </Text>
                <View
                  style={{
                    width: 4,
                    height: 4,
                    marginTop: 2,
                    borderRadius: theme.radius.pill,
                    backgroundColor: dayCount
                      ? isSelected
                        ? theme.colors.paper
                        : theme.colors.accent
                      : "transparent",
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: theme.space.page,
            paddingTop: 10,
            paddingBottom: 6,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.meta,
              fontFamily: nativeFonts.sans,
              fontSize: theme.typography.meta.fontSize,
              fontWeight: String(theme.typography.meta.fontWeight) as "600",
              letterSpacing:
                theme.typography.meta.letterSpacingEm *
                theme.typography.meta.fontSize,
              textTransform: "uppercase",
            }}
          >
            {dayLabel(selectedDate, today)}
          </Text>
          {selectedDayEntries.length ? (
            <Text
              style={{
                color: theme.colors.meta,
                fontFamily: nativeFonts.sans,
                fontSize: 10,
              }}
            >
              {selectedDayEntries.length}
            </Text>
          ) : null}
        </View>

        {selectedDayEntries.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              paddingHorizontal: theme.space.page * 2,
              paddingVertical: 30,
            }}
          >
            <Text
              style={{
                color: theme.colors.ink,
                fontFamily: nativeFonts.serif,
                fontSize: theme.typography.sheetTitle.fontSize,
                textAlign: "center",
              }}
            >
              {weekEntryCount === 0
                ? "A quiet week"
                : "Nothing logged this day"}
            </Text>
            <Text
              style={{
                color: theme.colors.meta,
                fontFamily: nativeFonts.sans,
                fontSize: theme.typography.small.fontSize,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {weekEntryCount === 0
                ? "The moments you log will find their place here."
                : "Choose another day to see its moments."}
            </Text>
          </View>
        ) : (
          selectedDayEntries.map((entry) => (
            <TimelineRow
              key={entry.id}
              entry={entry}
              subtitle={timelineEntrySummary(entry, foods, (foodId) =>
                child ? data.foodStatus(child.id, foodId).status : "untried"
              )}
              onPress={() => setSelectedId(entry.id)}
            />
          ))
        )}
      </ScrollView>

      {child ? (
        <FoodLogging ref={foodLogging} childId={child.id} hideDefaultContent />
      ) : null}

      <Modal
        visible={selected !== undefined}
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}
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
          ) : null}
        </Screen>
      </Modal>
    </Screen>
  );
}

function TimelineRow({
  entry,
  subtitle,
  onPress,
}: {
  readonly entry: LoggedEntry;
  readonly subtitle: string;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const { icon, tracker } = timelineEntryPresentation(entry.kind);
  const title = entryTitle(entry);
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: entry.occurredTz,
    hour: "numeric",
    minute: "2-digit",
  }).format(entry.occurredAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${ENTRY_LABELS[entry.kind]} · ${title} · ${subtitle} · ${time}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: theme.space.page,
        paddingVertical: 10,
        gap: theme.space.rowGap,
        borderTopWidth: theme.rule.hairline,
        borderTopColor: theme.colors.ruleThin,
        backgroundColor: theme.colors.paper,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Orb icon={icon} tracker={tracker} size={36} iconSize={17} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 13,
            fontWeight: "600",
            color: theme.colors.ink,
          }}
        >
          {title}
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
      <Text
        style={{
          fontFamily: nativeFonts.serif,
          fontStyle: "italic",
          fontSize: 11.5,
          color: theme.colors.meta,
        }}
      >
        {time}
      </Text>
    </Pressable>
  );
}

function entryTitle(entry: LoggedEntry): string {
  switch (entry.kind) {
    case "feed":
      return "Feed";
    case "diaper_change":
      return "Diaper change";
    case "sleep_session": {
      const duration = Math.max(0, entry.occurredAt - entry.content.startAt);
      const hours = Math.floor(duration / 3_600_000);
      const minutes = Math.floor((duration % 3_600_000) / 60_000);
      return `Sleep${hours ? ` · ${hours}h ${minutes}m` : ` · ${minutes}m`}`;
    }
    case "medical":
      return `Medical · ${entry.content.category}`;
    case "growth":
      return "Growth";
    case "meal":
      return entry.content.name || "Meal";
    case "introduction":
      return "Introduction";
    case "reaction":
      return `Reaction · ${entry.content.severity}`;
  }
}

function weekLabel(week: readonly string[], today: string): string {
  if (weekDates(today).join(",") === week.join(",")) return "This week";
  if (weekDates(shiftCalendarDate(today, -7)).join(",") === week.join(","))
    return "Last week";
  const start = RANGE_FORMAT.format(new Date(`${week[0]}T00:00:00.000Z`));
  const end = RANGE_FORMAT.format(new Date(`${week[6]}T00:00:00.000Z`));
  return `${start} – ${end}`;
}

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === shiftCalendarDate(today, -1)) return "Yesterday";
  return DATE_FORMAT.format(new Date(`${date}T00:00:00.000Z`));
}
