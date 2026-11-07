import { useState, type ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import {
  ALLERGEN_TAGS,
  FOOD_CATEGORIES,
  MEAL_FEEDING_STYLES,
  MEAL_TEXTURES,
  REACTION_SEVERITIES,
  REACTION_SYMPTOMS,
  type FoodEntry,
  type MealEntry,
  type MealEntryInput,
  type MealTexture,
  type ReactionSeverity,
  type ReactionSymptom,
} from "@keepsake/food-tracking";
import {
  SLEEP_QUALITIES,
  SLEEP_QUALITY_FACTOR_SEEDS,
  type RoutineEntry,
} from "@keepsake/routine";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import { PillChip } from "./PillChip";
import {
  EntryTimestampFields,
  useEntryTimestamp,
} from "./EntryTimestampFields";
import { detailLabel, type EntryDetailField } from "./entryDetails";
import type { LoggedEntry } from "./entryPresentation";
import { routineDraft, routineInput, type RoutineDraft } from "./routineDraft";

interface EditorProps {
  readonly field: EntryDetailField;
  readonly onSaved: (entry: LoggedEntry) => void;
  readonly onCancel: () => void;
}

export function EntryInlineEditor({
  entry,
  ...props
}: EditorProps & { readonly entry: LoggedEntry }) {
  if (entry.kind === "meal") return <MealEditor entry={entry} {...props} />;
  if (entry.kind === "introduction" || entry.kind === "reaction")
    return <FoodEditor entry={entry} {...props} />;
  return <RoutineEditor entry={entry} {...props} />;
}

function EditorActions({
  children,
  onSave,
  onCancel,
}: {
  readonly children: ReactNode;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 12 }}>
      {children}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.danger, fontFamily: nativeFonts.sans }}
        >
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <PillChip
          label="Save changes"
          selected
          onPress={() => {
            try {
              onSave();
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Entry could not be saved."
              );
            }
          }}
        />
        <PillChip label="Cancel" selected={false} onPress={onCancel} />
      </View>
    </View>
  );
}

function Input({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly numeric?: boolean;
  readonly multiline?: boolean;
}) {
  const theme = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      keyboardType={numeric ? "decimal-pad" : "default"}
      multiline={multiline}
      placeholder={label}
      placeholderTextColor={theme.colors.meta}
      style={{
        color: theme.colors.ink,
        backgroundColor: theme.colors.paper,
        borderColor: theme.colors.chipBorder,
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 44,
        padding: 10,
        fontFamily: nativeFonts.sans,
        fontSize: 13,
      }}
    />
  );
}

function Choices<T extends string>({
  options,
  selected,
  onSelect,
}: {
  readonly options: readonly T[];
  readonly selected: readonly T[];
  readonly onSelect: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((value) => (
        <PillChip
          key={value}
          label={value ? detailLabel(value) : "Not recorded"}
          selected={selected.includes(value)}
          onPress={() => onSelect(value)}
        />
      ))}
    </View>
  );
}

function toggle<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function RoutineEditor({
  entry,
  field,
  onSaved,
  onCancel,
}: EditorProps & { readonly entry: RoutineEntry }) {
  const data = useData();
  const theme = useTheme();
  const [draft, setDraft] = useState(() =>
    routineDraft(entry, data.temperatureUnit() ?? "C")
  );
  const [customFactor, setCustomFactor] = useState("");
  const timestamp = useEntryTimestamp(entry);
  const start = useEntryTimestamp({
    occurredAt:
      entry.kind === "sleep_session" ? entry.content.startAt : entry.occurredAt,
    occurredTz: entry.occurredTz,
  });
  function change<K extends keyof RoutineDraft>(
    key: K,
    value: RoutineDraft[K]
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function text(
    key:
      | "durationMinutes"
      | "note"
      | "name"
      | "dose"
      | "description"
      | "value"
      | "weightKg"
      | "heightCm"
      | "headCircumferenceCm",
    label = field.label,
    numeric = false
  ) {
    return (
      <Input
        label={label}
        value={draft[key]}
        onChange={(value) => change(key, value)}
        numeric={numeric}
        multiline={key === "note"}
      />
    );
  }
  const nameSuggestions =
    entry.kind === "medical" &&
    (draft.category === "medication" || draft.category === "vaccine")
      ? [
          ...new Set(
            data
              .routineEntriesForChild(entry.childId)
              .flatMap((item) =>
                item.kind === "medical" &&
                item.content.category === draft.category &&
                "name" in item.content
                  ? [item.content.name]
                  : []
              )
          ),
        ]
          .filter((name) =>
            name
              .toLocaleLowerCase()
              .includes(draft.name.trim().toLocaleLowerCase())
          )
          .slice(0, 10)
      : [];
  function medicalName() {
    return (
      <>
        {text("name", "Name")}
        <Choices
          options={nameSuggestions}
          selected={[]}
          onSelect={(value) => change("name", value)}
        />
      </>
    );
  }
  function medicalFields() {
    return draft.category === "medication" || draft.category === "vaccine" ? (
      <>
        {medicalName()}
        {draft.category === "medication" ? text("dose", "Dose") : null}
      </>
    ) : draft.category === "symptom" ? (
      text("description", "Description")
    ) : (
      <>
        {text("value", "Temperature", true)}
        <Choices
          options={["C", "F"]}
          selected={[draft.unit]}
          onSelect={(value) => change("unit", value)}
        />
      </>
    );
  }
  const factors = [
    ...new Set([
      ...SLEEP_QUALITY_FACTOR_SEEDS,
      ...data
        .routineEntriesForChild(entry.childId)
        .flatMap((item) =>
          item.kind === "sleep_session" ? (item.content.factors ?? []) : []
        ),
      ...draft.factors,
    ]),
  ];
  const sleepOverlaps =
    entry.kind === "sleep_session" &&
    start.resolved.ok &&
    timestamp.resolved.ok &&
    data
      .routineEntriesForChild(entry.childId)
      .some(
        (item) =>
          item.kind === "sleep_session" &&
          item.id !== entry.id &&
          start.resolved.ok &&
          timestamp.resolved.ok &&
          item.content.startAt < timestamp.resolved.occurredAt &&
          item.occurredAt > start.resolved.occurredAt
      );
  return (
    <EditorActions
      onCancel={onCancel}
      onSave={() => {
        if (!timestamp.resolved.ok) throw new Error(timestamp.resolved.error);
        if (entry.kind === "sleep_session" && !start.resolved.ok)
          throw new Error(start.resolved.error);
        const input = routineInput(
          entry.childId,
          entry.kind,
          timestamp.resolved,
          draft,
          start.resolved.ok ? start.resolved.occurredAt : undefined
        );
        const saved = data.updateRoutineEntry(entry.id, input);
        if (!saved) throw new Error("This Entry is no longer available.");
        onSaved(saved);
      }}
    >
      {field.key === "occurredAt" ? (
        <EntryTimestampFields inline label={field.label} {...timestamp} />
      ) : field.key === "startAt" ? (
        <EntryTimestampFields inline label={field.label} {...start} />
      ) : field.key === "side" ? (
        <Choices
          options={["", "left", "right"]}
          selected={[draft.side]}
          onSelect={(value) => change("side", value)}
        />
      ) : field.key === "durationMinutes" ? (
        text("durationMinutes", "Duration in minutes", true)
      ) : field.key === "change" ? (
        <Choices
          options={["wet", "dirty", "both"]}
          selected={[draft.change]}
          onSelect={(value) => change("change", value)}
        />
      ) : field.key === "quality" ? (
        <Choices
          options={SLEEP_QUALITIES}
          selected={draft.quality ? [draft.quality] : []}
          onSelect={(value) => change("quality", value)}
        />
      ) : field.key === "factors" ? (
        <>
          <Choices
            options={factors}
            selected={draft.factors}
            onSelect={(value) =>
              change("factors", toggle(draft.factors, value))
            }
          />
          <Input
            label="Custom Sleep Quality Factor"
            value={customFactor}
            onChange={setCustomFactor}
          />
          <PillChip
            label="Add factor"
            selected={false}
            disabled={!customFactor.trim()}
            onPress={() => {
              const factor = customFactor.trim();
              change("factors", [...new Set([...draft.factors, factor])]);
              setCustomFactor("");
            }}
          />
        </>
      ) : field.key === "category" ? (
        <>
          <Choices
            options={["medication", "vaccine", "symptom", "temperature"]}
            selected={[draft.category]}
            onSelect={(value) => change("category", value)}
          />
          {medicalFields()}
        </>
      ) : field.key === "temperature" ? (
        medicalFields()
      ) : field.key === "weightKg" ||
        field.key === "heightCm" ||
        field.key === "headCircumferenceCm" ? (
        text(field.key, field.label, true)
      ) : field.key === "name" ? (
        medicalName()
      ) : field.key === "note" ||
        field.key === "dose" ||
        field.key === "description" ? (
        text(field.key)
      ) : null}
      {sleepOverlaps ? (
        <Text
          style={{
            color: theme.colors.danger,
            fontFamily: nativeFonts.sans,
            fontSize: 12,
          }}
        >
          This Sleep Session overlaps another logged Sleep Session.
        </Text>
      ) : null}
    </EditorActions>
  );
}

function MealEditor({
  entry,
  field,
  onSaved,
  onCancel,
}: EditorProps & { readonly entry: MealEntry }) {
  const data = useData();
  const [draft, setDraft] = useState<MealEntryInput>({
    ...entry.content,
    childId: entry.childId,
    occurredAt: entry.occurredAt,
    occurredTz: entry.occurredTz,
  });
  const timestamp = useEntryTimestamp(entry);
  function change<K extends keyof MealEntryInput>(
    key: K,
    value: MealEntryInput[K]
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <EditorActions
      onCancel={onCancel}
      onSave={() => {
        if (!timestamp.resolved.ok) throw new Error(timestamp.resolved.error);
        const saved = data.updateMeal(entry.id, {
          ...draft,
          occurredAt: timestamp.resolved.occurredAt,
          occurredTz: timestamp.resolved.occurredTz,
        });
        if (!saved) throw new Error("This Meal is no longer available.");
        onSaved(saved);
      }}
    >
      {field.key === "occurredAt" ? (
        <EntryTimestampFields inline label="When" {...timestamp} />
      ) : field.key === "name" || field.key === "note" ? (
        <>
          <Input
            label={field.label}
            value={draft[field.key] ?? ""}
            onChange={(value) =>
              change(field.key === "name" ? "name" : "note", value)
            }
            multiline={field.key === "note"}
          />
          {field.key === "name" ? (
            <Choices
              options={data
                .mealNameSuggestions(entry.childId, draft.name ?? "")
                .map((suggestion) => suggestion.name)}
              selected={[]}
              onSelect={(value) => change("name", value)}
            />
          ) : null}
        </>
      ) : field.key === "amount" ? (
        <Choices
          options={["1", "2", "3", "4", "5"]}
          selected={[String(draft.amount)]}
          onSelect={(value) => change("amount", Number(value))}
        />
      ) : field.key === "categories" ? (
        <Choices
          options={FOOD_CATEGORIES}
          selected={draft.categories ?? []}
          onSelect={(value) =>
            change("categories", toggle(draft.categories ?? [], value))
          }
        />
      ) : field.key === "allergenTags" ? (
        <Choices
          options={ALLERGEN_TAGS}
          selected={draft.allergenTags ?? []}
          onSelect={(value) =>
            change("allergenTags", toggle(draft.allergenTags ?? [], value))
          }
        />
      ) : field.key === "textures" ? (
        <Choices
          options={MEAL_TEXTURES}
          selected={draft.textures ?? []}
          onSelect={(value) =>
            change("textures", toggle(draft.textures ?? [], value))
          }
        />
      ) : field.key === "feedingStyles" ? (
        <Choices
          options={MEAL_FEEDING_STYLES}
          selected={draft.feedingStyles ?? []}
          onSelect={(value) =>
            change("feedingStyles", toggle(draft.feedingStyles ?? [], value))
          }
        />
      ) : null}
    </EditorActions>
  );
}

function FoodEditor({
  entry,
  field,
  onSaved,
  onCancel,
}: EditorProps & { readonly entry: FoodEntry }) {
  const data = useData();
  const theme = useTheme();
  const timestamp = useEntryTimestamp(entry);
  const [foodIds, setFoodIds] = useState<readonly string[]>(
    entry.kind === "introduction"
      ? [entry.content.foodId]
      : entry.content.foodIds
  );
  const [note, setNote] = useState(entry.content.note ?? "");
  const [texture, setTexture] = useState<MealTexture | null>(
    entry.kind === "introduction" ? (entry.content.texture ?? null) : null
  );
  const [severity, setSeverity] = useState<ReactionSeverity>(
    entry.kind === "reaction" ? entry.content.severity : "mild"
  );
  const [symptoms, setSymptoms] = useState<readonly ReactionSymptom[]>(
    entry.kind === "reaction" ? entry.content.symptoms : []
  );
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const foods =
    entry.kind === "reaction"
      ? data.reactionFoods(entry.childId)
      : data.foods();
  const headsUps =
    entry.kind === "introduction" &&
    foodIds[0] &&
    timestamp.resolved.ok &&
    (entry.content.foodId !== foodIds[0] ||
      entry.occurredAt !== timestamp.resolved.occurredAt)
      ? data.introductionHeadsUps(
          entry.childId,
          foodIds[0],
          timestamp.resolved.occurredAt,
          { excludeEntryId: entry.id }
        )
      : [];
  return (
    <EditorActions
      onCancel={onCancel}
      onSave={() => {
        if (!timestamp.resolved.ok) throw new Error(timestamp.resolved.error);
        const common = {
          childId: entry.childId,
          occurredAt: timestamp.resolved.occurredAt,
          occurredTz: timestamp.resolved.occurredTz,
          note,
        };
        if (!foodIds.length)
          throw new Error(
            entry.kind === "introduction"
              ? "Choose exactly one Food."
              : "Choose at least one Food."
          );
        const saved =
          entry.kind === "introduction"
            ? data.updateIntroduction(entry.id, {
                ...common,
                foodId: foodIds[0]!,
                texture,
              })
            : data.updateReaction(entry.id, {
                ...common,
                foodIds,
                severity,
                symptoms,
              });
        if (!saved) throw new Error("This Entry is no longer available.");
        onSaved(saved);
      }}
    >
      {field.key === "occurredAt" ? (
        <EntryTimestampFields
          inline
          label={
            entry.kind === "reaction" ? "Symptoms appeared" : "First tried"
          }
          {...timestamp}
        />
      ) : field.key === "foodId" || field.key === "foodIds" ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {foodIds.map((id) => (
              <PillChip
                key={id}
                label={
                  foods.find((food) => food.id === id)?.name ??
                  "Unavailable Food"
                }
                selected
                onPress={() =>
                  setFoodIds(foodIds.filter((value) => value !== id))
                }
              />
            ))}
          </View>
          <Input label="Search Foods" value={query} onChange={setQuery} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {foods
              .filter((food) =>
                food.name
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase())
              )
              .slice(0, 10)
              .map((food) => (
                <PillChip
                  key={food.id}
                  label={food.name}
                  selected={foodIds.includes(food.id)}
                  onPress={() =>
                    setFoodIds(
                      entry.kind === "introduction"
                        ? [food.id]
                        : toggle(foodIds, food.id)
                    )
                  }
                />
              ))}
          </View>
        </>
      ) : field.key === "texture" ? (
        <>
          <PillChip
            label="Not recorded"
            selected={texture === null}
            onPress={() => setTexture(null)}
          />
          <Choices
            options={MEAL_TEXTURES}
            selected={texture ? [texture] : []}
            onSelect={setTexture}
          />
        </>
      ) : field.key === "severity" ? (
        <Choices
          options={REACTION_SEVERITIES}
          selected={[severity]}
          onSelect={setSeverity}
        />
      ) : field.key === "symptoms" ? (
        <Choices
          options={REACTION_SYMPTOMS}
          selected={symptoms}
          onSelect={(value) => setSymptoms(toggle(symptoms, value))}
        />
      ) : field.key === "note" ? (
        <Input label="Note" value={note} onChange={setNote} multiline />
      ) : null}
      {headsUps
        .filter((item) => !dismissed.includes(item.kind))
        .map((item) => (
          <View key={item.kind} style={{ gap: 8 }}>
            <Text
              style={{
                color: theme.colors.accentInk,
                fontFamily: nativeFonts.sans,
                fontSize: 12,
              }}
            >
              {item.kind === "first-allergen-food"
                ? "A first introduction of an allergen Food. Take it at your own pace."
                : "Another Food has an active watch. Overlapping introductions can make reactions harder to attribute."}
            </Text>
            <PillChip
              label="Dismiss heads-up"
              selected={false}
              onPress={() => setDismissed([...dismissed, item.kind])}
            />
          </View>
        ))}
    </EditorActions>
  );
}
