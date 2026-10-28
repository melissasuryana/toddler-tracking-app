import {
  ALLERGEN_TAGS,
  FOOD_CATEGORIES,
  MEAL_FEEDING_STYLES,
  MEAL_TEXTURES,
  applyMealSuggestion,
  type AllergenTag,
  type FoodCategory,
  type MealDefaults,
  type MealEntry,
  type MealEntryInput,
  type MealFeedingStyle,
  type MealNameSuggestion,
  type MealSuggestionField,
  type MealSuggestionFields,
  type MealTexture,
} from "@keepsake/food-tracking";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { KeepsakeIcon } from "~/components/KeepsakeIcon";
import { Body } from "~/components/Screen";
import { PillChip } from "~/components/PillChip";
import { nativeFonts } from "~/theme/tokens";
import { useTheme } from "~/theme/ThemeProvider";
import { localDateTime, resolveEntryTimestamp } from "./entryTimestamp";
import { EntryTimestampFields } from "./EntryTimestampFields";
import { SteppedSlider } from "./SteppedSlider";

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

const CATEGORY_META: Record<
  FoodCategory,
  {
    readonly label: string;
    readonly renderIcon: (color: string) => React.ReactNode;
  }
> = {
  fruit: {
    label: "Fruit",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={14} r={7} stroke={color} strokeWidth={1.8} />
        <Path
          d="M12 7V3M12 3c3 0 5 2 5 4"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    ),
  },
  vegetables: {
    label: "Vegetables",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 21L17 11c2-2 1-6-2-6s-5 0-7 2L2 14c-1 3 2 6 5 7z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path
          d="M16 5l3-3M19 8l3-3"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    ),
  },
  "grains & cereals": {
    label: "Grains",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 22V8M12 8c-3-2-3-5 0-6 3 1 3 4 0 6zM8 12c-2-2-2-4 0-5 2 1 2 3 0 5zM16 12c2-2 2-4 0-5-2 1-2 3 0 5z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
  dairy: {
    label: "Dairy",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M8 3h8v3H8zM6 6h12v15H6zM10 11h4"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
  proteins: {
    label: "Proteins",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={8} cy={16} r={3} stroke={color} strokeWidth={1.8} />
        <Path
          d="M10.5 14.5L17 8c2.5-2.5 5 0 5 0s2.5 2.5 0 5L15.5 19.5"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
  "fish & shellfish": {
    label: "Fish & seafood",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 12c5-7 15-4 18 0-3 4-13 7-18 0z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Path
          d="M18 12l4-3v6l-4-3zM8 10v.01"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    ),
  },
  "nuts & seeds": {
    label: "Nuts & seeds",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Ellipse
          cx={9}
          cy={14}
          rx={4}
          ry={6}
          stroke={color}
          strokeWidth={1.8}
          transform="rotate(-20 9 14)"
        />
        <Ellipse
          cx={15}
          cy={10}
          rx={4}
          ry={6}
          stroke={color}
          strokeWidth={1.8}
          transform="rotate(-20 15 10)"
        />
      </Svg>
    ),
  },
  compound: {
    label: "Mixed dish",
    renderIcon: (color) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.8} />
        <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      </Svg>
    ),
  },
};

const ALLERGEN_LABELS: Record<AllergenTag, string> = {
  milk: "Milk",
  egg: "Egg",
  peanut: "Peanut",
  "tree nuts": "Tree nuts",
  soy: "Soy",
  wheat: "Wheat",
  fish: "Fish",
  shellfish: "Shellfish",
  sesame: "Sesame",
};

const TEXTURE_LABELS: Record<MealTexture, string> = {
  purée: "Purée",
  mashed: "Mashed",
  "soft finger food": "Soft finger",
  "firm finger food": "Firm pieces",
};

const FEEDING_STYLE_LABELS: Record<MealFeedingStyle, string> = {
  "spoon-fed": "Spoon-fed",
  "self-fed with hands": "Self (hands)",
  "self-fed with utensils": "Self (utensils)",
};

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
  const [safetyDrawerOpen, setSafetyDrawerOpen] = useState(
    allergenTags.length > 0
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

  function toggleSingle<T extends string>(
    field: MealSuggestionField,
    value: T,
    selected: readonly T[],
    setSelected: (values: readonly T[]) => void
  ) {
    setEdited((previous) => new Set(previous).add(field));
    setSelected(selected.includes(value) ? [] : [value]);
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
    if (fields.allergenTags.length > 0) {
      setSafetyDrawerOpen(true);
    }
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

  const allergenCount = allergenTags.length;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: theme.space.page,
        paddingBottom: theme.space.sheetBlock * 2,
      }}
    >
      {/* Sheet Container Card */}
      <View
        style={{
          backgroundColor: theme.colors.sheet,
          borderColor: theme.colors.ruleThin,
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
                color: theme.colors.meta,
              }}
            >
              {initialMeal ? "Edit entry" : "Refined plate log"}
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.serif,
                fontSize: 20,
                color: theme.colors.ink,
              }}
            >
              {initialMeal ? "Edit " : "Log a "}
              <Text style={{ color: theme.colors.accent, fontStyle: "italic" }}>
                meal
              </Text>
            </Text>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.colors.tracker.meal.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <KeepsakeIcon
              name="meal"
              size={18}
              color={theme.colors.tracker.meal.foreground}
            />
          </View>
        </View>

        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 12,
            color: theme.colors.meta,
            marginTop: -6,
          }}
        >
          Structured food groups, portion slider, and safety check.
        </Text>

        {initialMeal ? (
          <View
            style={{
              backgroundColor: theme.colors.accentWash,
              borderColor: theme.colors.accentSoft,
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
                color: theme.colors.accentInk,
              }}
            >
              ✏️ Editing — the Entry keeps its identity. “When” is when eaten.
            </Text>
          </View>
        ) : null}

        {/* Dish Name */}
        <View style={{ gap: 4 }}>
          <FieldLabel label="Dish name" hint="optional description" />
          <TextInput
            accessibilityLabel="Meal name"
            maxLength={100}
            onChangeText={setName}
            onFocus={() => setNameFieldFocused(true)}
            onBlur={() => setNameFieldFocused(false)}
            placeholder="e.g. Oatmeal with banana"
            placeholderTextColor={theme.colors.meta}
            style={inputStyle(theme)}
            value={name}
          />
          {nameFieldFocused && suggestions.length > 0 ? (
            <View
              style={{
                backgroundColor: theme.colors.paper,
                borderColor: theme.colors.chipBorder,
                borderWidth: 1,
                borderRadius: 8,
                overflow: "hidden",
                marginTop: 2,
              }}
            >
              {suggestions.map((suggestion) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${suggestion.name}:${suggestion.categories.join(",")}`}
                  onPressIn={() => selectSuggestion(suggestion)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderBottomWidth: theme.rule.hairline,
                    borderBottomColor: theme.colors.ruleThin,
                  }}
                >
                  <Body>{suggestion.name}</Body>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* 1-5 Stepped Slider for Amount Eaten (Replaces Buttons) */}
        <SteppedSlider
          value={amount}
          onChange={setAmount}
          label="How much eaten"
        />

        {/* 4x2 Bento Grid for Categories */}
        <View style={{ gap: 6 }}>
          <FieldLabel
            label="Plate food groups"
            hint={`${categories.length} selected`}
          />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {FOOD_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const isSelected = categories.includes(cat);
              return (
                <Pressable
                  key={cat}
                  accessibilityRole="button"
                  accessibilityLabel={meta.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() =>
                    toggle("categories", cat, categories, setCategories)
                  }
                  style={({ pressed }) => ({
                    width: "23.5%",
                    minHeight: 52,
                    paddingVertical: 6,
                    paddingHorizontal: 2,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isSelected
                      ? theme.colors.accentSoft
                      : theme.colors.chipBorder,
                    backgroundColor: isSelected
                      ? theme.colors.accentWash
                      : theme.colors.paper,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  {meta.renderIcon(
                    isSelected ? theme.colors.accent : theme.colors.meta
                  )}
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 10,
                      fontWeight: isSelected ? "700" : "600",
                      color: isSelected
                        ? theme.colors.accentInk
                        : theme.colors.ink,
                      textAlign: "center",
                    }}
                  >
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Safety Shield Expandable Drawer for Allergens */}
        <View style={{ gap: 6 }}>
          <FieldLabel label="Allergy safety check" hint="Big-9 flags" />
          <View
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor:
                allergenCount > 0
                  ? theme.colors.dangerSoft
                  : theme.colors.chipBorder,
              backgroundColor: theme.colors.paper,
              overflow: "hidden",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle allergy safety drawer"
              onPress={() => setSafetyDrawerOpen(!safetyDrawerOpen)}
              style={({ pressed }) => ({
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 10,
                paddingVertical: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                }}
              >
                <Text style={{ fontSize: 13 }}>🛡️</Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 11.5,
                    fontWeight: "600",
                    color:
                      allergenCount > 0
                        ? theme.colors.dangerInk
                        : theme.colors.ink,
                    flex: 1,
                  }}
                >
                  {allergenCount > 0
                    ? allergenTags
                        .map((tag) => ALLERGEN_LABELS[tag] ?? tag)
                        .join(", ")
                    : "No big-9 allergens flagged"}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor:
                    allergenCount > 0
                      ? theme.colors.dangerWash
                      : theme.colors.sheet,
                  borderColor:
                    allergenCount > 0
                      ? theme.colors.dangerSoft
                      : theme.colors.chipBorder,
                  borderWidth: 1,
                  borderRadius: theme.radius.pill,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 10.5,
                    fontWeight: "700",
                    color:
                      allergenCount > 0
                        ? theme.colors.dangerInk
                        : theme.colors.meta,
                  }}
                >
                  {allergenCount > 0 ? `${allergenCount} flagged ⚠️` : "+ Flag"}
                </Text>
              </View>
            </Pressable>

            {safetyDrawerOpen ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.ruleThin,
                  padding: 8,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {ALLERGEN_TAGS.map((tag) => {
                  const isFlagged = allergenTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      accessibilityRole="button"
                      accessibilityLabel={ALLERGEN_LABELS[tag]}
                      accessibilityState={{ selected: isFlagged }}
                      onPress={() =>
                        toggle(
                          "allergenTags",
                          tag,
                          allergenTags,
                          setAllergenTags
                        )
                      }
                      style={({ pressed }) => ({
                        width: "31.5%",
                        paddingVertical: 6,
                        paddingHorizontal: 4,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: isFlagged
                          ? theme.colors.dangerSoft
                          : theme.colors.chipBorder,
                        backgroundColor: isFlagged
                          ? theme.colors.dangerWash
                          : theme.colors.sheet,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: nativeFonts.sans,
                          fontSize: 11,
                          fontWeight: isFlagged ? "700" : "600",
                          color: isFlagged
                            ? theme.colors.dangerInk
                            : theme.colors.meta,
                        }}
                      >
                        {isFlagged ? "⚠️ " : ""}
                        {ALLERGEN_LABELS[tag]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        {/* Textures Segmented Control Rail */}
        <View style={{ gap: 6 }}>
          <FieldLabel label="Texture" hint="segmented rail" />
          <View
            style={{
              flexDirection: "row",
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.chipBorder,
              borderWidth: 1,
              borderRadius: 8,
              padding: 2,
              gap: 2,
            }}
          >
            {MEAL_TEXTURES.map((tex) => {
              const isSelected = textures.includes(tex);
              return (
                <Pressable
                  key={tex}
                  accessibilityRole="button"
                  accessibilityLabel={TEXTURE_LABELS[tex]}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() =>
                    toggleSingle("textures", tex, textures, setTextures)
                  }
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 2,
                    borderRadius: 6,
                    backgroundColor: isSelected
                      ? theme.colors.sheet
                      : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: isSelected ? "#000" : "transparent",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isSelected ? 0.08 : 0,
                    shadowRadius: 2,
                    elevation: isSelected ? 1 : 0,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 10.5,
                      fontWeight: "600",
                      color: isSelected ? theme.colors.ink : theme.colors.meta,
                    }}
                  >
                    {TEXTURE_LABELS[tex]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Feeding Style Segmented Control Rail */}
        <View style={{ gap: 6 }}>
          <FieldLabel label="Feeding style" hint="segmented rail" />
          <View
            style={{
              flexDirection: "row",
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.chipBorder,
              borderWidth: 1,
              borderRadius: 8,
              padding: 2,
              gap: 2,
            }}
          >
            {MEAL_FEEDING_STYLES.map((style) => {
              const isSelected = feedingStyles.includes(style);
              return (
                <Pressable
                  key={style}
                  accessibilityRole="button"
                  accessibilityLabel={FEEDING_STYLE_LABELS[style]}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() =>
                    toggleSingle(
                      "feedingStyles",
                      style,
                      feedingStyles,
                      setFeedingStyles
                    )
                  }
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 6,
                    paddingHorizontal: 2,
                    borderRadius: 6,
                    backgroundColor: isSelected
                      ? theme.colors.sheet
                      : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: isSelected ? "#000" : "transparent",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isSelected ? 0.08 : 0,
                    shadowRadius: 2,
                    elevation: isSelected ? 1 : 0,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: nativeFonts.sans,
                      fontSize: 10.5,
                      fontWeight: "600",
                      color: isSelected ? theme.colors.ink : theme.colors.meta,
                    }}
                  >
                    {FEEDING_STYLE_LABELS[style]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Optional Note */}
        <View style={{ gap: 4 }}>
          <FieldLabel label="Note" hint="optional" />
          <TextInput
            accessibilityLabel="Meal note"
            multiline
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={theme.colors.meta}
            style={noteInputStyle(theme)}
            value={note}
          />
        </View>

        {error ? <Body>{error}</Body> : null}

        {/* Shared Timestamp Invariant directly preceding Save */}
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

        {/* Action Buttons: Cancel + Save */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.space.fieldGap,
            paddingTop: 4,
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
              backgroundColor: theme.colors.ruleStrong,
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
              {initialMeal ? "Save changes" : "Save meal"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function FieldLabel({
  label,
  hint,
}: {
  readonly label: string;
  readonly hint?: string;
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
          color: theme.colors.meta,
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
            color: theme.colors.meta,
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

function inputStyle(theme: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: theme.colors.sheet,
    borderColor: theme.colors.chipBorder,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.ink,
    fontFamily: nativeFonts.sans,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  };
}

function noteInputStyle(theme: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: theme.colors.sheet,
    borderColor: theme.colors.chipBorder,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.ink,
    fontFamily: nativeFonts.serif,
    fontStyle: "italic" as const,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  };
}

function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
