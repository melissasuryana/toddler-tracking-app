import {
  ALLERGEN_TAGS,
  FOOD_CATEGORIES,
  MEAL_FEEDING_STYLES,
  MEAL_TEXTURES,
  type MealDefaults,
  type MealEntry,
  type MealEntryInput,
  type MealNameSuggestion,
} from "@keepsake/food-tracking";
import { resolveLocalTimestamp } from "@keepsake/routine";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Body, MetaLabel } from "~/components/Screen";
import { PillChip } from "~/components/PillChip";
import { nativeFonts } from "~/theme/tokens";
import { useTheme } from "~/theme/ThemeProvider";

export interface MealFormProps {
  readonly childId: string;
  readonly initialMeal?: MealEntry | null;
  readonly defaults: MealDefaults;
  readonly preservePrefilledFields?: readonly MealSuggestionField[];
  readonly suggestionsFor: (query: string) => readonly MealNameSuggestion[];
  readonly onSave: (input: MealEntryInput, id?: string) => void;
  readonly onCancel?: () => void;
}

export type MealSuggestionField =
  "categories" | "allergenTags" | "textures" | "feedingStyles";

export function MealForm({
  childId,
  initialMeal = null,
  defaults,
  preservePrefilledFields = [],
  suggestionsFor,
  onSave,
  onCancel,
}: MealFormProps) {
  const theme = useTheme();
  const timestamp = initialMeal
    ? localDateTime(initialMeal.occurredAt, initialMeal.occurredTz)
    : localDateTime(Date.now(), currentTimezone());
  const [occurredOn, setOccurredOn] = useState(timestamp.date);
  const [occurredAt, setOccurredAt] = useState(timestamp.time);
  const [utcOffsetMinutes, setUtcOffsetMinutes] = useState<
    number | undefined
  >();
  const [name, setName] = useState(initialMeal?.content.name ?? "");
  const [note, setNote] = useState(initialMeal?.content.note ?? "");
  const [amount, setAmount] = useState(initialMeal?.content.amount ?? 4);
  const [categories, setCategories] = useState<readonly string[]>(
    initialMeal?.content.categories ?? []
  );
  const [allergenTags, setAllergenTags] = useState<readonly string[]>(
    initialMeal?.content.allergenTags ?? []
  );
  const [textures, setTextures] = useState<readonly string[]>(
    initialMeal?.content.textures ?? defaults.textures
  );
  const [feedingStyles, setFeedingStyles] = useState<readonly string[]>(
    initialMeal?.content.feedingStyles ?? defaults.feedingStyles
  );
  const [edited, setEdited] = useState<ReadonlySet<MealSuggestionField>>(
    () => new Set(preservePrefilledFields)
  );
  const [error, setError] = useState<string | null>(null);
  const timezone = initialMeal?.occurredTz ?? currentTimezone();
  const suggestions = suggestionsFor(name);
  const localTimestamp = `${occurredOn}T${occurredAt}`;
  const timestampOptions = useMemo(
    () => validTimestampOptions(localTimestamp, timezone),
    [localTimestamp, timezone]
  );

  function toggle(
    field: MealSuggestionField,
    value: string,
    selected: readonly string[],
    setSelected: (values: readonly string[]) => void
  ) {
    setEdited((previous) => new Set(previous).add(field));
    setSelected(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    );
  }

  function selectSuggestion(suggestion: MealNameSuggestion) {
    setName(suggestion.name);
    if (!edited.has("categories")) setCategories(suggestion.categories);
    if (!edited.has("allergenTags")) setAllergenTags(suggestion.allergenTags);
    if (!edited.has("textures")) setTextures(suggestion.textures);
    if (!edited.has("feedingStyles"))
      setFeedingStyles(suggestion.feedingStyles);
  }

  function save() {
    const timestampResult = resolveLocalTimestamp(
      localTimestamp,
      timezone,
      utcOffsetMinutes
    );
    if (!timestampResult.ok) {
      setError(timestampResult.error);
      return;
    }
    try {
      onSave(
        {
          childId,
          occurredAt: timestampResult.occurredAt,
          occurredTz: timestampResult.occurredTz,
          amount,
          name,
          note,
          categories: categories as MealEntryInput["categories"],
          allergenTags: allergenTags as MealEntryInput["allergenTags"],
          textures: textures as MealEntryInput["textures"],
          feedingStyles: feedingStyles as MealEntryInput["feedingStyles"],
        },
        initialMeal?.id
      );
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Meal could not be saved."
      );
    }
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: theme.space.page }}
    >
      <MetaLabel>{initialMeal ? "Edit meal" : "Meal"}</MetaLabel>
      <FieldLabel label="Meal name" />
      <TextInput
        accessibilityLabel="Meal name"
        maxLength={100}
        onChangeText={setName}
        placeholder="Optional dish name"
        placeholderTextColor={theme.colors.meta}
        style={inputStyle(theme)}
        value={name}
      />
      {suggestions.map((suggestion) => (
        <Pressable
          accessibilityRole="button"
          key={`${suggestion.name}:${suggestion.categories.join(",")}`}
          onPress={() => selectSuggestion(suggestion)}
          style={{ paddingVertical: theme.space.fieldGap }}
        >
          <Body>{suggestion.name}</Body>
        </Pressable>
      ))}

      <FieldLabel label="Amount eaten" />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.space.fieldGap,
        }}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <PillChip
            key={value}
            label={String(value)}
            selected={amount === value}
            onPress={() => setAmount(value)}
          />
        ))}
      </View>

      <ChoiceGroup
        label="Food Categories"
        options={FOOD_CATEGORIES}
        selected={categories}
        onToggle={(value) =>
          toggle("categories", value, categories, setCategories)
        }
      />
      <ChoiceGroup
        label="Allergen Tags"
        options={ALLERGEN_TAGS}
        selected={allergenTags}
        onToggle={(value) =>
          toggle("allergenTags", value, allergenTags, setAllergenTags)
        }
      />
      <ChoiceGroup
        label="Texture"
        options={MEAL_TEXTURES}
        selected={textures}
        onToggle={(value) => toggle("textures", value, textures, setTextures)}
      />
      <ChoiceGroup
        label="Feeding Style"
        options={MEAL_FEEDING_STYLES}
        selected={feedingStyles}
        onToggle={(value) =>
          toggle("feedingStyles", value, feedingStyles, setFeedingStyles)
        }
      />

      <FieldLabel label="Note" />
      <TextInput
        accessibilityLabel="Meal note"
        multiline
        onChangeText={setNote}
        placeholder="Optional note"
        placeholderTextColor={theme.colors.meta}
        style={[inputStyle(theme), { minHeight: theme.space.sheetBlock * 2 }]}
        value={note}
      />

      <FieldLabel label="Date" />
      <TextInput
        accessibilityLabel="Meal date"
        onChangeText={(value) => {
          setOccurredOn(value);
          setUtcOffsetMinutes(undefined);
        }}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.colors.meta}
        style={inputStyle(theme)}
        value={occurredOn}
      />
      <FieldLabel label="Time" />
      <TextInput
        accessibilityLabel="Meal time"
        onChangeText={(value) => {
          setOccurredAt(value);
          setUtcOffsetMinutes(undefined);
        }}
        placeholder="HH:mm"
        placeholderTextColor={theme.colors.meta}
        style={inputStyle(theme)}
        value={occurredAt}
      />
      {timestampOptions.length > 1 ? (
        <>
          <FieldLabel label="Time zone offset" />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: theme.space.fieldGap,
            }}
          >
            {timestampOptions.map(({ utcOffsetMinutes: offset }) => (
              <PillChip
                key={offset}
                label={formatUtcOffset(offset)}
                selected={utcOffsetMinutes === offset}
                onPress={() => setUtcOffsetMinutes(offset)}
              />
            ))}
          </View>
        </>
      ) : null}
      <Body dim>{timezone}</Body>

      {error ? <Body>{error}</Body> : null}
      <View
        style={{
          flexDirection: "row",
          gap: theme.space.fieldGap,
          paddingVertical: theme.space.rowBlock,
        }}
      >
        {onCancel ? (
          <PillChip label="Cancel" selected={false} onPress={onCancel} />
        ) : null}
        <PillChip
          label={initialMeal ? "Save changes" : "Save meal"}
          selected
          onPress={save}
        />
      </View>
    </ScrollView>
  );
}

function ChoiceGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  readonly label: string;
  readonly options: readonly string[];
  readonly selected: readonly string[];
  readonly onToggle: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <>
      <FieldLabel label={label} />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.space.fieldGap,
        }}
      >
        {options.map((option) => (
          <PillChip
            key={option}
            label={option}
            selected={selected.includes(option)}
            onPress={() => onToggle(option)}
          />
        ))}
      </View>
    </>
  );
}

function FieldLabel({ label }: { readonly label: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.ink,
        fontFamily: nativeFonts.sans,
        fontSize: theme.typography.meta.fontSize,
        paddingTop: theme.space.fieldGap,
        paddingBottom: theme.space.fieldGap,
      }}
    >
      {label}
    </Text>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>) {
  return {
    borderColor: theme.colors.chipBorder,
    borderWidth: theme.rule.hairline,
    color: theme.colors.ink,
    fontFamily: nativeFonts.sans,
    fontSize: theme.typography.body.fontSize,
    padding: theme.space.fieldGap,
  };
}

function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function localDateTime(epoch: number, timezone: string) {
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(epoch)
      .map(({ type, value }) => [type, value])
  );
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    time: `${parts.get("hour")}:${parts.get("minute")}`,
  };
}

function validTimestampOptions(localDateTime: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime);
  if (!match) return [];

  const nominalEpoch = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 3) {
    const instant = nominalEpoch + hours * 60 * 60 * 1_000;
    const parts = new Map(
      formatter.formatToParts(instant).map(({ type, value }) => [type, value])
    );
    const localEpoch = Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day")),
      Number(parts.get("hour")),
      Number(parts.get("minute"))
    );
    offsets.add(Math.round((localEpoch - instant) / 60_000));
  }

  return [...offsets]
    .map((offset) =>
      resolveLocalTimestamp(
        localDateTime,
        timezone,
        offset,
        Number.MAX_SAFE_INTEGER
      )
    )
    .filter((result) => result.ok)
    .sort((left, right) =>
      left.ok && right.ok ? left.occurredAt - right.occurredAt : 0
    );
}

function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "−" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}
