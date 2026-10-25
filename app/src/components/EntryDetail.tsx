import { useState } from "react";
import { ScrollView, View } from "react-native";
import type { IntroductionEntry } from "@keepsake/food-tracking";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { Body, MetaLabel } from "./Screen";
import { PillChip } from "./PillChip";
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
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          padding: theme.space.page,
          gap: theme.space.fieldGap,
        }}
      >
        <PillChip label="Close" selected={false} onPress={onClose} />
        {!editing ? (
          <PillChip
            label="Edit"
            selected
            onPress={() => {
              setEditorStarted(true);
              setEditing(true);
            }}
          />
        ) : null}
        <PillChip
          label="Delete entry"
          selected={false}
          onPress={() => setConfirmDelete(true)}
        />
      </View>
      {error ? <Body>{error}</Body> : null}
      <ScrollView
        style={{ display: editing ? "none" : "flex" }}
        contentContainerStyle={{
          padding: theme.space.page,
          gap: theme.space.fieldGap,
        }}
      >
        <MetaLabel>{ENTRY_LABELS[entry.kind]}</MetaLabel>
        <Body>{entrySummary(entry, data.foods())}</Body>
        <Body>
          {new Date(entry.occurredAt).toLocaleString(undefined, {
            timeZone: entry.occurredTz,
          })}{" "}
          · {entry.occurredTz}
        </Body>
        {Object.entries(entry.content)
          .filter(
            ([key, value]) =>
              !["foodId", "foodIds", "startAt"].includes(key) &&
              value !== undefined &&
              value !== null &&
              value !== ""
          )
          .map(([key, value]) => (
            <Body key={key}>
              {key.replace(/([A-Z])/g, " $1")}:{" "}
              {Array.isArray(value)
                ? value.join(", ") || "None"
                : String(value)}
            </Body>
          ))}
        {entry.kind === "sleep_session" ? (
          <>
            <Body>
              Fell asleep:{" "}
              {new Date(entry.content.startAt).toLocaleString(undefined, {
                timeZone: entry.occurredTz,
              })}
            </Body>
            {data.hasSleepSessionOverlap(entry.id) ? (
              <Body>
                This Sleep Session overlaps another logged Sleep Session.
              </Body>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <View style={{ flex: 1, display: editing ? "flex" : "none" }}>
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
      <DeleteEntryConfirm
        visible={confirmDelete}
        onKeep={() => setConfirmDelete(false)}
        onDelete={remove}
      />
    </View>
  );
}
