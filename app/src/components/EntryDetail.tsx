import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { IntroductionEntry } from "@keepsake/food-tracking";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import { MealForm } from "./MealForm";
import { FoodEntryForm } from "./FoodEntryForm";
import { RoutineEntryForm } from "./RoutineEntryForm";
import { DeleteEntryConfirm } from "./DeleteEntryConfirm";
import {
  ENTRY_LABELS,
  entrySummary,
  type LoggedEntry,
} from "./entryPresentation";

export function EntryDetail({
  entry,
  onClose,
  onAlsoMeal,
}: {
  readonly entry: LoggedEntry;
  readonly onClose: () => void;
  readonly onAlsoMeal: (entry: IntroductionEntry) => void;
}) {
  const data = useData();
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [editorStarted, setEditorStarted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    try {
      const deleted =
        entry.kind === "meal"
          ? data.deleteMeal(entry.id)
          : entry.kind === "introduction" || entry.kind === "reaction"
            ? data.deleteFoodEntry(entry.id)
            : data.deleteRoutineEntry(entry.id);
      if (!deleted) throw new Error("This Entry is no longer available.");
      setConfirmDelete(false);
      onClose();
    } catch (caught) {
      setConfirmDelete(false);
      setError(
        caught instanceof Error ? caught.message : "Entry could not be deleted."
      );
    }
  }

  const label = ENTRY_LABELS[entry.kind];
  const summary = entrySummary(entry, data.foods());
  const dateFormatted = new Date(entry.occurredAt).toLocaleString(undefined, {
    timeZone: entry.occurredTz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      {!editing ? (
        <ScrollView style={{ flex: 1 }}>
          {/* Hero Banner */}
          <View
            style={{
              backgroundColor: theme.colors.sleepBand,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.ruleStrong,
              paddingHorizontal: theme.space.page,
              paddingTop: theme.space.page,
              paddingBottom: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to Ledger"
                onPress={onClose}
                hitSlop={8}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    color: theme.colors.meta,
                    fontWeight: "600",
                  }}
                >
                  ← Ledger
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
                onPress={() => setConfirmDelete(true)}
                hitSlop={8}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    color: theme.colors.danger,
                    fontWeight: "700",
                  }}
                >
                  Delete
                </Text>
              </Pressable>
            </View>

            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1.4,
                color: theme.colors.meta,
                marginBottom: 4,
              }}
            >
              {label} · {dateFormatted}
            </Text>

            <Text
              style={{
                fontFamily: nativeFonts.serif,
                fontSize: 20,
                fontWeight: "500",
                lineHeight: 26,
                color: theme.colors.ink,
                marginBottom: 8,
              }}
            >
              {summary}
            </Text>
          </View>

          {error ? (
            <View
              style={{
                padding: theme.space.page,
                backgroundColor: theme.colors.accentWash,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.accent,
              }}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  color: theme.colors.danger,
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* Key-Value Details */}
          <View
            style={{
              paddingHorizontal: theme.space.page,
              paddingVertical: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.ruleThin,
              }}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "500",
                  color: theme.colors.meta,
                }}
              >
                Type
              </Text>
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "500",
                  color: theme.colors.ink,
                }}
              >
                {label}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.ruleThin,
              }}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "500",
                  color: theme.colors.meta,
                }}
              >
                Time
              </Text>
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "500",
                  color: theme.colors.ink,
                }}
              >
                {dateFormatted} ({entry.occurredTz})
              </Text>
            </View>

            {Object.entries(entry.content)
              .filter(
                ([key, value]) =>
                  !["foodId", "foodIds", "startAt"].includes(key) &&
                  value !== undefined &&
                  value !== null &&
                  value !== ""
              )
              .map(([key, value]) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.ruleThin,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 12,
                      fontWeight: "500",
                      color: theme.colors.meta,
                    }}
                  >
                    {key.replace(/([A-Z])/g, " $1")}
                  </Text>
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 12,
                      fontWeight: "500",
                      color: theme.colors.ink,
                      textAlign: "right",
                      maxWidth: "60%",
                    }}
                  >
                    {Array.isArray(value)
                      ? value.join(", ") || "None"
                      : String(value)}
                  </Text>
                </View>
              ))}

            {entry.kind === "sleep_session" ? (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.ruleThin,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 12,
                      fontWeight: "500",
                      color: theme.colors.meta,
                    }}
                  >
                    Fell asleep
                  </Text>
                  <Text
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 12,
                      fontWeight: "500",
                      color: theme.colors.ink,
                    }}
                  >
                    {new Date(entry.content.startAt).toLocaleString(undefined, {
                      timeZone: entry.occurredTz,
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>

                {data.hasSleepSessionOverlap(entry.id) ? (
                  <View
                    style={{
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: nativeFonts.sans,
                        fontSize: 11.5,
                        color: theme.colors.danger,
                      }}
                    >
                      This Sleep Session overlaps another logged Sleep Session.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>

          {/* Action buttons */}
          <View
            style={{
              paddingHorizontal: theme.space.page,
              paddingVertical: 16,
              gap: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit this ${label.toLowerCase()}`}
              onPress={() => {
                setEditorStarted(true);
                setEditing(true);
              }}
              style={({ pressed }) => ({
                paddingVertical: 11,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.ruleStrong,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "600",
                  color: theme.colors.sheet,
                }}
              >
                Edit this {label.toLowerCase()}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: theme.space.page,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.ruleThin,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
              onPress={() => setEditing(false)}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "600",
                  color: theme.colors.meta,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                fontWeight: "600",
                color: theme.colors.ink,
              }}
            >
              Edit {label}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {editorStarted ? (
            entry.kind === "meal" ? (
              <MealForm
                childId={entry.childId}
                initialMeal={entry}
                defaults={data.mealDefaultsForChild(entry.childId)}
                suggestionsFor={(query) =>
                  data.mealNameSuggestions(entry.childId, query)
                }
                onCancel={() => setEditing(false)}
                onSave={(input) => {
                  if (!data.updateMeal(entry.id, input))
                    throw new Error("This Meal is no longer available.");
                  onClose();
                }}
              />
            ) : entry.kind === "introduction" || entry.kind === "reaction" ? (
              <FoodEntryForm
                childId={entry.childId}
                kind={entry.kind}
                entry={entry}
                hideDelete
                onCancel={() => setEditing(false)}
                onSaved={onClose}
                onAlsoMeal={onAlsoMeal}
              />
            ) : (
              <RoutineEntryForm
                childId={entry.childId}
                kind={entry.kind}
                entry={entry}
                onCancel={() => setEditing(false)}
                onSave={(input) => {
                  if (!data.updateRoutineEntry(entry.id, input))
                    throw new Error("This Entry is no longer available.");
                  onClose();
                }}
              />
            )
          ) : null}
        </View>
      )}

      <DeleteEntryConfirm
        visible={confirmDelete}
        title={`Delete this ${label.toLowerCase()}?`}
        description={`${summary} · ${dateFormatted}`}
        onKeep={() => setConfirmDelete(false)}
        onDelete={remove}
      />
    </View>
  );
}
