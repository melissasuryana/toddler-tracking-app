import {
  MEAL_TEXTURES,
  REACTION_SEVERITIES,
  REACTION_SYMPTOMS,
  type FoodEntry,
  type IntroductionEntry,
  type MealTexture,
  type ReactionSeverity,
  type ReactionSymptom,
} from "@keepsake/food-tracking";
import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { Body, MetaLabel } from "./Screen";
import { PillChip } from "./PillChip";
import { KeepsakeIcon } from "./KeepsakeIcon";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { localDateTime, resolveEntryTimestamp } from "./entryTimestamp";
import { EntryTimestampFields } from "./EntryTimestampFields";
import { DeleteEntryConfirm } from "./DeleteEntryConfirm";

export function FoodEntryForm({
  childId,
  kind,
  entry,
  contextualFoodId,
  hideDelete = false,
  onSaved,
  onAlsoMeal,
  onCancel,
}: {
  readonly childId: string;
  readonly kind: "introduction" | "reaction";
  readonly entry?: FoodEntry;
  readonly contextualFoodId?: string;
  readonly hideDelete?: boolean;
  readonly onSaved: () => void;
  readonly onAlsoMeal: (entry: IntroductionEntry) => void;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const data = useData();
  const [original] = useState(() => ({
    occurredAt: entry?.occurredAt ?? Date.now(),
    occurredTz:
      entry?.occurredTz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));
  const initialLocal = localDateTime(original.occurredAt, original.occurredTz);
  const [date, setDate] = useState(initialLocal.date);
  const [time, setTime] = useState(initialLocal.time);
  const [timestampEdited, setTimestampEdited] = useState(false);
  const [offset, setOffset] = useState<number | undefined>();
  const [foodIds, setFoodIds] = useState<readonly string[]>(() =>
    entry?.kind === "introduction"
      ? [entry.content.foodId]
      : entry?.kind === "reaction"
        ? entry.content.foodIds
        : contextualFoodId
          ? [contextualFoodId]
          : []
  );
  const [note, setNote] = useState(entry?.content.note ?? "");
  const [texture, setTexture] = useState<MealTexture | null>(
    entry?.kind === "introduction" ? (entry.content.texture ?? null) : null
  );
  const [severity, setSeverity] = useState<ReactionSeverity | null>(
    entry?.kind === "reaction" ? entry.content.severity : null
  );
  const [symptoms, setSymptoms] = useState<readonly ReactionSymptom[]>(
    entry?.kind === "reaction" ? (entry.content.symptoms ?? []) : []
  );
  const [query, setQuery] = useState("");
  const [alsoMeal, setAlsoMeal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dismissedHeadsUps, setDismissedHeadsUps] = useState<
    ReadonlySet<string>
  >(new Set());
  const foods =
    kind === "reaction" ? data.reactionFoods(childId) : data.foods();
  const resolved = resolveEntryTimestamp(
    original,
    timestampEdited,
    date,
    time,
    offset
  );
  const headsUps =
    kind === "introduction" &&
    foodIds[0] &&
    resolved.ok &&
    (!entry ||
      (entry.kind === "introduction" &&
        (entry.content.foodId !== foodIds[0] ||
          entry.occurredAt !== resolved.occurredAt)))
      ? data.introductionHeadsUps(childId, foodIds[0], resolved.occurredAt, {
          excludeEntryId: entry?.id,
        })
      : [];
  const inputStyle = {
    color: theme.colors.ink,
    borderBottomColor: theme.colors.ruleThin,
    borderBottomWidth: theme.rule.hairline,
    paddingVertical: theme.space.fieldGap,
    fontSize: theme.typography.body.fontSize,
  };
  const choicesStyle = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.space.fieldGap,
  };

  function save() {
    try {
      if (
        !foodIds.length ||
        (kind === "introduction" && foodIds.length !== 1)
      ) {
        throw new Error(
          kind === "introduction"
            ? "Choose exactly one Food."
            : "Choose at least one Food."
        );
      }
      if (!resolved.ok) throw new Error(resolved.error);
      const common = {
        childId,
        occurredAt: resolved.occurredAt,
        occurredTz: resolved.occurredTz,
        note,
      };
      if (kind === "introduction") {
        const input = { ...common, foodId: foodIds[0]!, texture };
        const saved = entry
          ? data.updateIntroduction(entry.id, input)
          : data.createIntroduction(input);
        if (!saved)
          throw new Error("This Introduction is no longer available.");
        if (alsoMeal) {
          onAlsoMeal(saved);
          return;
        }
      } else {
        if (!severity) throw new Error("Choose a severity.");
        const input = { ...common, foodIds, severity, symptoms };
        const saved = entry
          ? data.updateReaction(entry.id, input)
          : data.createReaction(input);
        if (!saved) throw new Error("This Reaction is no longer available.");
      }
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Entry could not be saved."
      );
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: theme.space.page,
        gap: theme.space.fieldGap,
      }}
    >
      <View style={choicesStyle}>
        <KeepsakeIcon name={kind} color={theme.discTint(kind).foreground} />
        <Body>
          {entry ? "Edit" : "Log"}{" "}
          {kind === "introduction" ? "Introduction" : "Reaction"}
        </Body>
      </View>
      {kind === "reaction" ? (
        <>
          <MetaLabel>Severity · required</MetaLabel>
          <View style={choicesStyle}>
            {REACTION_SEVERITIES.map((value) => (
              <PillChip
                key={value}
                label={value}
                selected={severity === value}
                onPress={() => setSeverity(value)}
              />
            ))}
          </View>
          <MetaLabel>Symptoms · optional</MetaLabel>
          <View style={choicesStyle}>
            {REACTION_SYMPTOMS.map((value) => (
              <PillChip
                key={value}
                label={value.replaceAll("_", " ").replaceAll("-", " ")}
                selected={symptoms.includes(value)}
                onPress={() =>
                  setSymptoms(
                    symptoms.includes(value)
                      ? symptoms.filter((item) => item !== value)
                      : [...symptoms, value]
                  )
                }
              />
            ))}
          </View>
        </>
      ) : null}
      <MetaLabel>
        {kind === "introduction"
          ? "One named Food · required"
          : "Foods · trying first"}
      </MetaLabel>
      <View style={choicesStyle}>
        {foodIds.map((id) => (
          <PillChip
            key={id}
            label={`${foods.find((food) => food.id === id)?.name ?? id} · remove`}
            selected
            onPress={() => setFoodIds(foodIds.filter((value) => value !== id))}
          />
        ))}
      </View>
      <TextInput
        accessibilityLabel="Search Foods"
        placeholder="Search Foods"
        placeholderTextColor={theme.colors.meta}
        style={inputStyle}
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: theme.space.sheetBlock * 6 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: theme.space.fieldGap }}>
          {foods
            .filter((food) =>
              food.name
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase())
            )
            .slice(0, 20)
            .map((food) => {
              const status = data.foodStatus(childId, food.id).status;
              return (
                <PillChip
                  key={food.id}
                  label={`${food.name} · ${status}`}
                  selected={foodIds.includes(food.id)}
                  tint={theme.statusPillTint(status)}
                  onPress={() => {
                    setFoodIds(
                      kind === "introduction"
                        ? [food.id]
                        : foodIds.includes(food.id)
                          ? foodIds.filter((id) => id !== food.id)
                          : [...foodIds, food.id]
                    );
                  }}
                />
              );
            })}
        </View>
      </ScrollView>
      <Body dim>
        Showing up to 20 matches. Search to find another Food; every status is
        available.
      </Body>
      {headsUps.map((headsUp) => {
        const key = `${foodIds[0]}:${headsUp.kind}:${headsUp.foodId}`;
        return dismissedHeadsUps.has(key) ? null : (
          <View key={key} style={{ gap: theme.space.fieldGap }}>
            <Body dim>
              {headsUp.kind === "first-allergen-food"
                ? "A first introduction of an allergen Food. Take it at your own pace."
                : "Another Food has an active watch. Overlapping introductions can make reactions harder to attribute."}
            </Body>
            <PillChip
              label="Dismiss heads-up"
              selected={false}
              onPress={() =>
                setDismissedHeadsUps(new Set(dismissedHeadsUps).add(key))
              }
            />
          </View>
        );
      })}
      {kind === "introduction" ? (
        <>
          <MetaLabel>Texture · optional, choose one</MetaLabel>
          <View style={choicesStyle}>
            <PillChip
              label="No texture"
              selected={texture === null}
              onPress={() => setTexture(null)}
            />
            {MEAL_TEXTURES.map((value) => (
              <PillChip
                key={value}
                label={value}
                selected={texture === value}
                onPress={() => setTexture(value)}
              />
            ))}
          </View>
        </>
      ) : null}
      <MetaLabel>Note · optional</MetaLabel>
      <TextInput
        accessibilityLabel={`${kind} note`}
        multiline
        style={inputStyle}
        placeholder="Optional note"
        placeholderTextColor={theme.colors.meta}
        value={note}
        onChangeText={setNote}
      />
      {kind === "introduction" ? (
        <PillChip
          label="Also log a meal"
          selected={alsoMeal}
          onPress={() => setAlsoMeal(!alsoMeal)}
        />
      ) : null}
      {entry && !hideDelete ? (
        <PillChip
          label="Delete entry"
          selected={false}
          onPress={() => setConfirmDelete(true)}
        />
      ) : null}
      {error ? <Body>{error}</Body> : null}
      <EntryTimestampFields
        label={kind}
        original={original}
        date={date}
        time={time}
        offset={offset}
        setDate={(value) => {
          setDate(value);
          setTimestampEdited(true);
          setOffset(undefined);
        }}
        setTime={(value) => {
          setTime(value);
          setTimestampEdited(true);
          setOffset(undefined);
        }}
        setOffset={(value) => {
          setTimestampEdited(true);
          setOffset(value);
        }}
      />
      <View style={choicesStyle}>
        <PillChip label="Cancel" selected={false} onPress={onCancel} />
        <PillChip
          label={entry ? "Save changes" : `Save ${kind}`}
          selected
          onPress={save}
        />
      </View>
      <DeleteEntryConfirm
        visible={confirmDelete}
        onKeep={() => setConfirmDelete(false)}
        onDelete={() => {
          try {
            if (!entry || !data.deleteFoodEntry(entry.id))
              throw new Error("This entry is no longer available.");
            setConfirmDelete(false);
            onSaved();
          } catch (caught) {
            setConfirmDelete(false);
            setError(
              caught instanceof Error
                ? caught.message
                : "Entry could not be deleted."
            );
          }
        }}
      />
    </ScrollView>
  );
}
