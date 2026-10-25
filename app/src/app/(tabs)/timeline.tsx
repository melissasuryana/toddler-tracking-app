/** Timeline — every Entry in reverse chronological order, styled as Direction D Ledger. */
import { useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { IconName, TrackerKey } from "@keepsake/design-system";
import { EntryDetail } from "~/components/EntryDetail";
import { FoodLogging, type FoodLoggingHandle } from "~/components/FoodLogging";
import { EmptyState, Masthead, Orb, Screen } from "~/components/Screen";
import {
  ENTRY_LABELS,
  entrySummary,
  latestEntries,
  type LoggedEntry,
} from "~/components/entryPresentation";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

export default function TimelineScreen() {
  const data = useData();
  const theme = useTheme();
  const child = data.child;
  const foodLogging = useRef<FoodLoggingHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const selected = entries.find((entry) => entry.id === selectedId);

  return (
    <Screen>
      <Masthead
        title="The "
        emphasis="ledger"
        kicker={entries.length > 0 ? `${entries.length}` : undefined}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon="timeline"
          tracker="feed"
          title="A day at a time"
          description="The moments you log will find their place here, in the order they happened."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: theme.space.sheetBlock * 2 }}
        >
          {entries.map((entry) => {
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

            const title = entryTitle(entry, foods);
            const subtitle = entrySummary(entry, foods);

            return (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${ENTRY_LABELS[entry.kind]} · ${subtitle}`}
                onPress={() => setSelectedId(entry.id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: theme.space.page,
                  paddingVertical: 11,
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
                  {formatEntryTime(entry.occurredAt, entry.occurredTz)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

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

function entryTitle(
  entry: LoggedEntry,
  foods: readonly { readonly id: string; readonly name: string }[]
): string {
  if (entry.kind === "meal") {
    return entry.content.name || "Meal";
  }
  if (entry.kind === "feed") {
    return `Feed${entry.content.side ? ` · ${entry.content.side}` : ""}`;
  }
  if (entry.kind === "sleep_session") {
    const duration = formatSleepDuration(entry);
    return `Sleep${duration ? ` · ${duration}` : ""}`;
  }
  if (entry.kind === "diaper_change") {
    return `Diaper${entry.content.change ? ` · ${entry.content.change}` : ""}`;
  }
  if (entry.kind === "reaction") {
    return `Reaction${entry.content.severity ? ` · ${entry.content.severity}` : ""}`;
  }
  if (entry.kind === "introduction") {
    const food = foods.find((f) => f.id === entry.content.foodId);
    return `First taste · ${food ? food.name : "Food"}`;
  }
  if (entry.kind === "medical") {
    return `Medical · ${entry.content.category}`;
  }
  if (entry.kind === "growth") {
    return `Growth${entry.content.weightKg ? ` · ${entry.content.weightKg} kg` : ""}`;
  }
  return (
    (ENTRY_LABELS as Record<string, string>)[(entry as LoggedEntry).kind] ??
    "Entry"
  );
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

function formatEntryTime(epoch: number, timezone: string): string {
  const d = new Date(epoch);
  return d.toLocaleTimeString(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
}
