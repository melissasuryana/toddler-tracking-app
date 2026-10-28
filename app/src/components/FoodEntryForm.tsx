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
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Body } from "./Screen";
import { PillChip } from "./PillChip";
import { KeepsakeIcon } from "./KeepsakeIcon";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
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

  const isReaction = kind === "reaction";
  const trackerColor =
    theme.colors.tracker[isReaction ? "reaction" : "introduction"];

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

  const selectedFoodObjects = foodIds.map(
    (id) => foods.find((f) => f.id === id) ?? { id, name: id }
  );

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: theme.space.page,
        paddingBottom: theme.space.sheetBlock * 2,
      }}
    >
      <View
        style={{
          backgroundColor: isReaction
            ? theme.colors.dangerWash
            : theme.colors.sheet,
          borderColor: isReaction
            ? theme.colors.dangerSoft
            : theme.colors.ruleThin,
          borderWidth: 1,
          borderRadius: 18,
          padding: 16,
          gap: 12,
        }}
      >
        {/* Sheet Head */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                fontWeight: "600",
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: isReaction ? theme.colors.danger : theme.colors.meta,
              }}
            >
              {isReaction ? "Allergic Observation" : "Food Introduction"}
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.serif,
                fontSize: 20,
                color: theme.colors.ink,
              }}
            >
              {entry ? "Edit " : "Log "}
              <Text
                style={{
                  color: isReaction ? theme.colors.danger : theme.colors.accent,
                  fontStyle: "italic",
                }}
              >
                {kind}
              </Text>
            </Text>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: trackerColor.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <KeepsakeIcon
              name={kind}
              size={18}
              color={trackerColor.foreground}
            />
          </View>
        </View>

        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 12,
            color: isReaction ? theme.colors.dangerInk : theme.colors.meta,
            marginTop: -6,
          }}
        >
          {isReaction
            ? "Ends the active watch period and marks food as 'avoid'."
            : "First taste or continued exposure — starts a 3-day watch period."}
        </Text>

        {entry ? (
          <View
            style={{
              backgroundColor: isReaction
                ? theme.colors.dangerSoft
                : theme.colors.accentWash,
              borderColor: isReaction
                ? theme.colors.danger
                : theme.colors.accentSoft,
              borderWidth: 1,
              borderRadius: 8,
              paddingVertical: 7,
              paddingHorizontal: 10,
            }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 11.5,
                color: isReaction
                  ? theme.colors.dangerInk
                  : theme.colors.accentInk,
              }}
            >
              ✏️ Editing — the Entry keeps its identity.
            </Text>
          </View>
        ) : null}

        {/* Reaction: Severity */}
        {isReaction ? (
          <View style={{ gap: 6 }}>
            <FieldLabel label="Severity" hint="required" danger={isReaction} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {REACTION_SEVERITIES.map((val) => {
                const isSelected = severity === val;
                return (
                  <Pressable
                    key={val}
                    accessibilityRole="button"
                    accessibilityLabel={`Severity ${val}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSeverity(val)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? theme.colors.danger
                        : theme.colors.chipBorder,
                      backgroundColor: isSelected
                        ? theme.colors.dangerSoft
                        : theme.colors.paper,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: nativeFonts.sans,
                        fontSize: 13,
                        fontWeight: isSelected ? "700" : "600",
                        color: isSelected
                          ? theme.colors.dangerInk
                          : theme.colors.ink,
                        textTransform: "capitalize",
                      }}
                    >
                      {val}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Reaction: Symptoms */}
        {isReaction ? (
          <View style={{ gap: 6 }}>
            <FieldLabel label="Symptoms" hint="optional" danger={isReaction} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {REACTION_SYMPTOMS.map((val) => {
                const isSelected = symptoms.includes(val);
                const display = val.replaceAll("_", " ").replaceAll("-", " ");
                return (
                  <Pressable
                    key={val}
                    accessibilityRole="button"
                    accessibilityLabel={`Symptom ${display}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() =>
                      setSymptoms(
                        isSelected
                          ? symptoms.filter((item) => item !== val)
                          : [...symptoms, val]
                      )
                    }
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: theme.radius.pill,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? theme.colors.danger
                        : theme.colors.chipBorder,
                      backgroundColor: isSelected
                        ? theme.colors.dangerSoft
                        : theme.colors.paper,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: nativeFonts.sans,
                        fontSize: 12,
                        fontWeight: isSelected ? "700" : "500",
                        color: isSelected
                          ? theme.colors.dangerInk
                          : theme.colors.ink,
                        textTransform: "capitalize",
                      }}
                    >
                      {display}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Foods Selector */}
        <View style={{ gap: 6 }}>
          <FieldLabel
            label={isReaction ? "Foods" : "One named Food"}
            hint={isReaction ? "trying first" : "required"}
            danger={isReaction}
          />
          {selectedFoodObjects.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {selectedFoodObjects.map((f) => (
                <PillChip
                  key={f.id}
                  label={`${f.name} · ✕`}
                  selected
                  onPress={() =>
                    setFoodIds(foodIds.filter((value) => value !== f.id))
                  }
                />
              ))}
            </View>
          ) : null}

          <TextInput
            accessibilityLabel="Search Foods"
            placeholder="Search Foods"
            placeholderTextColor={theme.colors.meta}
            value={query}
            onChangeText={setQuery}
            style={{
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.chipBorder,
              borderWidth: 1,
              borderRadius: 8,
              color: theme.colors.ink,
              fontFamily: nativeFonts.sans,
              fontSize: 13,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          />

          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 160 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {foods
                .filter((food) =>
                  food.name
                    .toLocaleLowerCase()
                    .includes(query.trim().toLocaleLowerCase())
                )
                .slice(0, 20)
                .map((food) => {
                  const status = data.foodStatus(childId, food.id).status;
                  const isSelected = foodIds.includes(food.id);
                  return (
                    <PillChip
                      key={food.id}
                      label={`${food.name} · ${status}`}
                      selected={isSelected}
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
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 11,
              color: theme.colors.meta,
            }}
          >
            Showing up to 20 matches. Search to find another Food; every status
            is available.
          </Text>
        </View>

        {/* Heads-up Cards for Introduction */}
        {headsUps.map((headsUp) => {
          const key = `${foodIds[0]}:${headsUp.kind}:${headsUp.foodId}`;
          return dismissedHeadsUps.has(key) ? null : (
            <View
              key={key}
              style={{
                backgroundColor: theme.colors.accentWash,
                borderColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderRadius: 8,
                padding: 10,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  color: theme.colors.ink,
                }}
              >
                {headsUp.kind === "first-allergen-food"
                  ? "⚠️ A first introduction of an allergen Food. Take it at your own pace."
                  : "⚠️ Another Food has an active watch. Overlapping introductions can make reactions harder to attribute."}
              </Text>
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

        {/* Introduction: Texture */}
        {kind === "introduction" ? (
          <View style={{ gap: 6 }}>
            <FieldLabel label="Texture" hint="optional, choose one" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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
          </View>
        ) : null}

        {/* Introduction: Also log a meal */}
        {kind === "introduction" ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <PillChip
              label={alsoMeal ? "✓ Also log a meal" : "+ Also log a meal"}
              selected={alsoMeal}
              onPress={() => setAlsoMeal(!alsoMeal)}
            />
          </View>
        ) : null}

        {/* Note */}
        <View style={{ gap: 4 }}>
          <FieldLabel label="Note" hint="optional" danger={isReaction} />
          <TextInput
            accessibilityLabel={`${kind} note`}
            multiline
            style={{
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.chipBorder,
              borderWidth: 1,
              borderRadius: 8,
              color: theme.colors.ink,
              fontFamily: nativeFonts.serif,
              fontStyle: "italic",
              fontSize: 12,
              paddingHorizontal: 10,
              paddingVertical: 8,
              minHeight: 40,
            }}
            placeholder="Note (optional)"
            placeholderTextColor={theme.colors.meta}
            value={note}
            onChangeText={setNote}
          />
        </View>

        {error ? <Body>{error}</Body> : null}

        {/* Shared Timestamp Invariant directly preceding Save */}
        <EntryTimestampFields
          label={isReaction ? "Symptoms appeared" : "When"}
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

        {/* Actions */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.space.fieldGap,
            paddingTop: 4,
          }}
        >
          {entry && !hideDelete ? (
            <PillChip
              label="Delete entry"
              selected={false}
              onPress={() => setConfirmDelete(true)}
            />
          ) : null}
          <PillChip label="Cancel" selected={false} onPress={onCancel} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry ? "Save changes" : `Save ${kind}`}
            onPress={save}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: isReaction
                ? theme.colors.danger
                : theme.colors.ruleStrong,
              borderRadius: theme.radius.pill,
              flex: 1,
              paddingHorizontal: theme.space.buttonInset,
              paddingVertical: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: theme.colors.paper,
                fontFamily: nativeFonts.sans,
                fontSize: 13.5,
                fontWeight: "600",
              }}
            >
              {entry
                ? "Save changes"
                : isReaction
                  ? "Save reaction"
                  : "Save introduction"}
            </Text>
          </Pressable>
        </View>

        {isReaction && selectedFoodObjects.length > 0 ? (
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 11,
              color: theme.colors.dangerInk,
              textAlign: "center",
            }}
          >
            Ends the Watch Period ·{" "}
            {selectedFoodObjects.map((f) => f.name).join(", ")} moves to avoid
          </Text>
        ) : null}
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

function FieldLabel({
  label,
  hint,
  danger,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 2,
        paddingBottom: 2,
      }}
    >
      <Text
        style={{
          color: danger ? theme.colors.danger : theme.colors.meta,
          fontFamily: nativeFonts.sans,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {hint ? (
        <Text
          style={{
            color: danger ? theme.colors.dangerInk : theme.colors.meta,
            fontFamily: nativeFonts.sans,
            fontSize: 10,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
