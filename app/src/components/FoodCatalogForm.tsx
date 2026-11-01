import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  ALLERGEN_TAGS,
  FOOD_CATEGORIES,
  type AllergenTag,
  type CustomFoodInput,
  type Food,
  type FoodCategory,
} from "@keepsake/food-tracking";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import { Body, Hairline, Masthead } from "./Screen";
import { PillChip } from "./PillChip";

export function FoodCatalogForm({
  food,
  onCancel,
  onSave,
}: {
  readonly food: Food | null;
  readonly onCancel: () => void;
  readonly onSave: (input: CustomFoodInput) => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(food?.name ?? "");
  const [category, setCategory] = useState<FoodCategory | null>(
    food?.category ?? null
  );
  const [allergenTags, setAllergenTags] = useState<readonly AllergenTag[]>(
    food?.allergenTags ?? []
  );
  const [error, setError] = useState<string | null>(null);

  function save() {
    try {
      onSave({ name, category, allergenTags });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Food could not be saved."
      );
    }
  }

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: "absolute",
        zIndex: 2,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.colors.paper,
      }}
    >
      <Masthead
        title={food ? "Edit " : "Add "}
        emphasis="food"
        kicker="Cancel"
        onKickerPress={onCancel}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: theme.space.page,
          paddingBottom: theme.space.sheetBlock * 2,
          gap: theme.space.fieldGap,
        }}
      >
        <Body>Food name · required</Body>
        <TextInput
          accessibilityLabel="Food name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Lentil loaf"
          placeholderTextColor={theme.colors.meta}
          style={{
            color: theme.colors.ink,
            backgroundColor: theme.colors.sheet,
            borderBottomColor: theme.colors.ruleStrong,
            borderBottomWidth: theme.rule.hairline,
            fontFamily: nativeFonts.sans,
            fontSize: theme.typography.body.fontSize,
            padding: 10,
          }}
        />
        <Hairline />
        <Body>Food Category · optional</Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          <PillChip
            label="None"
            selected={category === null}
            onPress={() => setCategory(null)}
          />
          {FOOD_CATEGORIES.map((value) => (
            <PillChip
              key={value}
              label={value}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
        <Hairline />
        <Body>Allergen Tags · optional</Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {ALLERGEN_TAGS.map((value) => {
            const selected = allergenTags.includes(value);
            return (
              <PillChip
                key={value}
                label={value}
                selected={selected}
                onPress={() =>
                  setAllergenTags(
                    selected
                      ? allergenTags.filter((tag) => tag !== value)
                      : [...allergenTags, value]
                  )
                }
              />
            );
          })}
        </View>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{
              color: theme.colors.danger,
              fontFamily: nativeFonts.sans,
              fontSize: 12,
            }}
          >
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={food ? "Save Food changes" : "Create Food"}
          onPress={save}
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.ink,
            borderRadius: theme.radius.pill,
            marginTop: 10,
            padding: 13,
          }}
        >
          <Text
            style={{
              color: theme.colors.paper,
              fontFamily: nativeFonts.sans,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {food ? "Save changes" : "Create Food"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
