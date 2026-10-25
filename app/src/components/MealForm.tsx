import {
  ALLERGEN_TAGS,
  FOOD_CATEGORIES,
  MEAL_FEEDING_STYLES,
  MEAL_TEXTURES,
  applyMealSuggestion,
  type MealDefaults,
  type MealEntry,
  type MealEntryInput,
  type MealNameSuggestion,
  type MealSuggestionField,
  type MealSuggestionFields,
} from "@keepsake/food-tracking";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeepsakeIcon } from "~/components/KeepsakeIcon";
import { Body, MetaLabel } from "~/components/Screen";
import { PillChip } from "~/components/PillChip";
import { nativeFonts } from "~/theme/tokens";
import { useTheme } from "~/theme/ThemeProvider";
import { localDateTime, resolveEntryTimestamp } from "./entryTimestamp";
import { EntryTimestampFields } from "./EntryTimestampFields";

export interface MealFormProps {
  readonly childId: string;
  readonly initialMeal?: MealEntry | null;
  readonly defaults: MealDefaults;
  readonly prefilled?: MealPrefill;
  readonly prefilledTimestamp?: {
    readonly occurredAt: number;
    readonly occurredTz: string;
  };
  readonly suggestionsFor: (query: string) => readonly MealNameSuggestion[];
  readonly onSave: (input: MealEntryInput, id?: string) => void;
  readonly onCancel?: () => void;
}

export type MealPrefill = Partial<MealSuggestionFields>;

export function MealForm({
  childId,
  initialMeal = null,
  defaults,
  prefilled = {},
  prefilledTimestamp,
  suggestionsFor,
  onSave,
  onCancel,
}: MealFormProps) {
  const theme = useTheme();
  const [originalTimestamp] = useState(() => ({
    occurredAt:
      initialMeal?.occurredAt ?? prefilledTimestamp?.occurredAt ?? Date.now(),
    occurredTz:
      initialMeal?.occurredTz ??
      prefilledTimestamp?.occurredTz ??
      currentTimezone(),
  }));
  const [timestampEdited, setTimestampEdited] = useState(false);
  const timestamp = initialMeal
    ? localDateTime(initialMeal.occurredAt, initialMeal.occurredTz)
    : prefilledTimestamp
      ? localDateTime(
          prefilledTimestamp.occurredAt,
          prefilledTimestamp.occurredTz
        )
      : localDateTime(
          originalTimestamp.occurredAt,
          originalTimestamp.occurredTz
        );
  const [occurredOn, setOccurredOn] = useState(timestamp.date);
  const [occurredAt, setOccurredAt] = useState(timestamp.time);
  const [utcOffsetMinutes, setUtcOffsetMinutes] = useState<
    number | undefined
  >();
  const [name, setName] = useState(initialMeal?.content.name ?? "");
  const [nameFieldFocused, setNameFieldFocused] = useState(false);
  const [note, setNote] = useState(initialMeal?.content.note ?? "");
  const [amount, setAmount] = useState(initialMeal?.content.amount ?? 4);
  const [categories, setCategories] = useState<
    MealSuggestionFields["categories"]
  >(initialMeal?.content.categories ?? prefilled.categories ?? []);
  const [allergenTags, setAllergenTags] = useState<
    MealSuggestionFields["allergenTags"]
  >(initialMeal?.content.allergenTags ?? prefilled.allergenTags ?? []);
  const [textures, setTextures] = useState<MealSuggestionFields["textures"]>(
    initialMeal?.content.textures ?? prefilled.textures ?? defaults.textures
  );
  const [feedingStyles, setFeedingStyles] = useState<
    MealSuggestionFields["feedingStyles"]
  >(
    initialMeal?.content.feedingStyles ??
      prefilled.feedingStyles ??
      defaults.feedingStyles
  );
  const [edited, setEdited] = useState<ReadonlySet<MealSuggestionField>>(
    () => new Set(Object.keys(prefilled) as MealSuggestionField[])
  );
  const [error, setError] = useState<string | null>(null);
  const suggestions = suggestionsFor(name);

  function toggle<T extends string>(
    field: MealSuggestionField,
    value: T,
    selected: readonly T[],
    setSelected: (values: readonly T[]) => void
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
    setNameFieldFocused(false);
    const fields = applyMealSuggestion(
      {
        categories,
        allergenTags,
        textures,
        feedingStyles,
        occurredOn,
        occurredAt,
        amount,
        note,
      },
      suggestion,
      edited
    );
    setCategories(fields.categories);
    setAllergenTags(fields.allergenTags);
    setTextures(fields.textures);
    setFeedingStyles(fields.feedingStyles);
  }

  function save() {
    const timestampResult = resolveEntryTimestamp(
      originalTimestamp,
      timestampEdited,
      occurredOn,
      occurredAt,
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
      contentContainerStyle={{
        paddingHorizontal: theme.space.page,
        paddingBottom: theme.space.sheetBlock,
      }}
    >
      <MetaLabel>{initialMeal ? "Edit entry" : "New entry"}</MetaLabel>
      <Text
        style={{
          color: theme.colors.ink,
          fontFamily: nativeFonts.serif,
          fontSize: theme.typography.sheetTitle.fontSize,
          fontWeight: String(theme.typography.sheetTitle.fontWeight) as "500",
          paddingBottom: theme.space.sheetBlock,
        }}
      >
        {initialMeal ? "Edit a " : "Log a "}
        <Text style={{ color: theme.colors.accent, fontStyle: "italic" }}>
          meal
        </Text>
      </Text>
      <FieldLabel label="Meal name" />
      <TextInput
        accessibilityLabel="Meal name"
        maxLength={100}
        onChangeText={setName}
        onFocus={() => setNameFieldFocused(true)}
        onBlur={() => setNameFieldFocused(false)}
        placeholder="Optional dish name"
        placeholderTextColor={theme.colors.meta}
        style={inputStyle(theme)}
        value={name}
      />
      {nameFieldFocused
        ? suggestions.map((suggestion) => (
            <Pressable
              accessibilityRole="button"
              key={`${suggestion.name}:${suggestion.categories.join(",")}`}
              onPressIn={() => selectSuggestion(suggestion)}
              style={{ paddingVertical: theme.space.fieldGap }}
            >
              <Body>{suggestion.name}</Body>
            </Pressable>
          ))
        : null}

      <FieldLabel label="Amount eaten" />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: theme.space.rowGap,
          paddingVertical: theme.space.fieldGap,
        }}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${value} of 5 eaten`}
            accessibilityState={{ selected: amount === value }}
            onPress={() => setAmount(value)}
            style={({ pressed }) => ({
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 19,
              borderColor:
                value <= amount
                  ? theme.colors.safeChip.border
                  : theme.colors.chipBorder,
              borderWidth: theme.rule.hairline,
              backgroundColor:
                value <= amount
                  ? theme.colors.safeChip.background
                  : "transparent",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <KeepsakeIcon
              name="check"
              size={16}
              color={
                value <= amount
                  ? theme.colors.safeChip.foreground
                  : theme.colors.meta
              }
            />
          </Pressable>
        ))}
      </View>
      <Text
        style={{
          color: theme.colors.meta,
          fontFamily: nativeFonts.sans,
          fontSize: theme.typography.small.fontSize,
          fontWeight: String(theme.typography.meta.fontWeight) as "600",
          textAlign: "center",
          paddingBottom: theme.space.fieldGap,
        }}
      >
        {amount} of 5
      </Text>

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

      {error ? <Body>{error}</Body> : null}
      <View
        style={{
          borderTopColor: theme.colors.ruleThin,
          borderBottomColor: theme.colors.ruleThin,
          borderTopWidth: theme.rule.hairline,
          borderBottomWidth: theme.rule.hairline,
          marginTop: theme.space.sheetBlock,
          paddingVertical: theme.space.fieldGap,
        }}
      >
        <EntryTimestampFields
          label="Meal"
          original={originalTimestamp}
          date={occurredOn}
          time={occurredAt}
          offset={utcOffsetMinutes}
          setDate={(value) => {
            setTimestampEdited(true);
            setOccurredOn(value);
            setUtcOffsetMinutes(undefined);
          }}
          setTime={(value) => {
            setTimestampEdited(true);
            setOccurredAt(value);
            setUtcOffsetMinutes(undefined);
          }}
          setOffset={(offset) => {
            setTimestampEdited(true);
            setUtcOffsetMinutes(offset);
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.space.fieldGap,
          paddingTop: theme.space.sheetBlock,
        }}
      >
        {onCancel ? (
          <PillChip label="Cancel" selected={false} onPress={onCancel} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={save}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: theme.colors.ink,
            borderRadius: theme.radius.pill,
            flex: 1,
            paddingHorizontal: theme.space.buttonInset,
            paddingVertical: theme.space.rowBlock,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.paper,
              fontFamily: nativeFonts.sans,
              fontSize: theme.typography.body.fontSize,
              fontWeight: String(theme.typography.meta.fontWeight) as "600",
            }}
          >
            {initialMeal ? "Save changes" : "Save meal"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  readonly label: string;
  readonly options: readonly T[];
  readonly selected: readonly T[];
  readonly onToggle: (value: T) => void;
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
        fontWeight: String(theme.typography.meta.fontWeight) as "600",
        letterSpacing:
          theme.typography.meta.letterSpacingEm *
          theme.typography.meta.fontSize,
        textTransform: "uppercase",
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
    borderBottomColor: theme.colors.ruleThin,
    borderBottomWidth: theme.rule.hairline,
    color: theme.colors.ink,
    fontFamily: nativeFonts.sans,
    fontSize: theme.typography.body.fontSize,
    paddingHorizontal: 2,
    paddingVertical: theme.space.fieldGap,
  };
}

function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
