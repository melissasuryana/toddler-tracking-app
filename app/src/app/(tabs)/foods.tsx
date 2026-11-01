import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { StatusKey } from "@keepsake/design-system";
import type { Food, FoodStatus } from "@keepsake/food-tracking";
import { FoodCatalogForm } from "~/components/FoodCatalogForm";
import { FoodDetail } from "~/components/FoodDetail";
import { FoodLogging, type FoodLoggingHandle } from "~/components/FoodLogging";
import { FoodWatchCard } from "~/components/FoodWatchCard";
import { filterFoodItems } from "~/components/foodBrowser";
import {
  EmptyState,
  Hairline,
  Masthead,
  Orb,
  Pill,
  Screen,
} from "~/components/Screen";
import { PillChip } from "~/components/PillChip";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

type StatusFilter = StatusKey | "all";
type SourceFilter = "all" | "seed" | "custom";
type FoodItem = {
  readonly food: Food;
  readonly status: StatusKey;
  readonly info: FoodStatus | null;
};

const STATUS_FILTERS: readonly StatusFilter[] = [
  "all",
  "untried",
  "trying",
  "safe",
  "avoid",
];

export default function FoodsScreen() {
  const data = useData();
  const theme = useTheme();
  const child = data.child;
  const foodLogging = useRef<FoodLoggingHandle>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [editingFood, setEditingFood] = useState<Food | null | undefined>(
    undefined
  );
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const foods = useMemo(() => data.foods(), [data]);
  const foodEntries = child ? data.foodEntriesForChild(child.id) : [];

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const foodItems = useMemo<readonly FoodItem[]>(
    () =>
      foods.map((food) => {
        const info = child ? data.foodStatus(child.id, food.id, now) : null;
        return {
          food,
          status: (info?.status ?? "untried") as StatusKey,
          info,
        };
      }),
    [data, child?.id, foods, now]
  );

  const counts = useMemo(() => {
    const summary: Record<StatusKey, number> = {
      safe: 0,
      trying: 0,
      untried: 0,
      avoid: 0,
    };
    for (const item of foodItems) summary[item.status] += 1;
    return summary;
  }, [foodItems]);

  const filteredItems = useMemo(
    () =>
      filterFoodItems(foodItems, {
        query,
        status: filter,
        source: sourceFilter,
      }),
    [foodItems, filter, sourceFilter, query]
  );

  const activeWatches = useMemo(
    () =>
      foodItems.flatMap(({ food, info }) =>
        info?.status === "trying" &&
        info.watchPeriod &&
        info.watchPeriod.endsAt > now
          ? [{ food, watch: info.watchPeriod }]
          : []
      ),
    [foodItems, now]
  );

  const selectedFood = foods.find((food) => food.id === selectedFoodId) ?? null;

  function saveCustomFood(input: {
    readonly name: string;
    readonly category?: Food["category"];
    readonly allergenTags?: Food["allergenTags"];
  }) {
    if (editingFood) {
      const updated = data.updateCustomFood(editingFood.id, input);
      if (!updated) throw new Error("This custom Food is no longer available.");
      setSelectedFoodId(updated.id);
      setMessage(`${updated.name} updated.`);
    } else {
      const created = data.createCustomFood(input);
      setSelectedFoodId(created.id);
      setMessage(`${created.name} added.`);
    }
    setEditingFood(undefined);
  }

  function deleteCustomFood(foodId: string): boolean {
    const deleted = data.deleteCustomFood(foodId);
    if (deleted) {
      setSelectedFoodId(null);
      setMessage("Food deleted.");
    }
    return deleted;
  }

  function markSafe(foodId: string, foodName: string) {
    try {
      if (!child || !data.markFoodSafe(child.id, foodId)) {
        throw new Error("This Watch Period has already ended.");
      }
      setMessage(`${foodName} marked safe.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Food could not be marked safe."
      );
    }
  }

  return (
    <Screen>
      {selectedFood && child ? (
        <FoodDetail
          key={selectedFood.id}
          food={selectedFood}
          childId={child.id}
          onBack={() => {
            setSelectedFoodId(null);
            setMessage(null);
          }}
          onLog={(kind, foodId) => foodLogging.current?.open(kind, foodId)}
          onEdit={() => setEditingFood(selectedFood)}
          onDelete={() => deleteCustomFood(selectedFood.id)}
        />
      ) : (
        <>
          <Masthead
            title="The "
            emphasis="food"
            suffix=" journal"
            kicker="+ Add"
            onKickerPress={() => setEditingFood(null)}
          />
          {message ? (
            <Text
              accessibilityRole="alert"
              style={{
                backgroundColor: theme.colors.accentWash,
                color: theme.colors.accentInk,
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                paddingHorizontal: theme.space.page,
                paddingVertical: 8,
              }}
            >
              {message}
            </Text>
          ) : null}
          {activeWatches.length ? (
            <View>
              {activeWatches.map(({ food, watch }) => {
                const reactionCount = foodEntries.filter(
                  (entry) =>
                    entry.kind === "reaction" &&
                    entry.content.foodIds.includes(food.id)
                ).length;
                return (
                  <FoodWatchCard
                    key={food.id}
                    food={food}
                    watch={watch}
                    now={now}
                    reactionCount={reactionCount}
                    onIntroduction={() =>
                      foodLogging.current?.open("introduction", food.id)
                    }
                    onReaction={() =>
                      foodLogging.current?.open("reaction", food.id)
                    }
                    onMarkSafe={() => markSafe(food.id, food.name)}
                  />
                );
              })}
            </View>
          ) : null}
          <View
            style={{
              backgroundColor: theme.colors.paper,
              gap: 8,
              paddingHorizontal: theme.space.page,
              paddingVertical: 10,
            }}
          >
            <TextInput
              accessibilityLabel="Search Foods"
              onChangeText={setQuery}
              placeholder="Search Foods, categories, or allergens"
              placeholderTextColor={theme.colors.meta}
              returnKeyType="search"
              value={query}
              style={{
                backgroundColor: theme.colors.sheet,
                borderColor: theme.colors.ruleThin,
                borderWidth: theme.rule.hairline,
                color: theme.colors.ink,
                fontFamily: nativeFonts.sans,
                fontSize: 13,
                paddingHorizontal: 10,
                paddingVertical: 9,
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7 }}
            >
              {STATUS_FILTERS.map((value) => (
                <PillChip
                  key={value}
                  label={
                    value === "all"
                      ? `All ${foods.length}`
                      : `${counts[value]} ${value}`
                  }
                  selected={filter === value}
                  tint={
                    value === "all" ? undefined : theme.statusPillTint(value)
                  }
                  onPress={() => setFilter(filter === value ? "all" : value)}
                />
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 7 }}>
              {(["all", "seed", "custom"] as const).map((value) => (
                <PillChip
                  key={value}
                  label={
                    value === "all"
                      ? "All Foods"
                      : value === "seed"
                        ? "Seeded"
                        : "Custom"
                  }
                  selected={sourceFilter === value}
                  onPress={() => setSourceFilter(value)}
                />
              ))}
            </View>
          </View>
          <Hairline />
          {filteredItems.length ? (
            <ScrollView
              contentContainerStyle={{
                paddingBottom: theme.space.sheetBlock * 2,
              }}
            >
              {filteredItems.map(({ food, status }) => {
                const pillTint = theme.statusPillTint(status);
                const subtitle = [
                  food.source === "custom" ? "Custom" : "",
                  food.category ?? "",
                  ...food.allergenTags,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Pressable
                    key={food.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${food.name} · ${status}`}
                    onPress={() => {
                      setSelectedFoodId(food.id);
                      setMessage(null);
                    }}
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: theme.colors.paper,
                      borderTopColor: theme.colors.ruleThin,
                      borderTopWidth: theme.rule.hairline,
                      flexDirection: "row",
                      gap: 12,
                      opacity: pressed ? 0.7 : 1,
                      paddingHorizontal: theme.space.page,
                      paddingVertical: 10,
                    })}
                  >
                    <Orb
                      icon="foods"
                      tint={{
                        background: pillTint.background,
                        foreground: pillTint.foreground,
                      }}
                      size={36}
                      iconSize={17}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: theme.colors.ink,
                          fontFamily: nativeFonts.sans,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {food.name}
                      </Text>
                      {subtitle ? (
                        <Text
                          style={{
                            color: theme.colors.meta,
                            fontFamily: nativeFonts.sans,
                            fontSize: 10.5,
                            marginTop: 1,
                          }}
                        >
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Pill label={status} tint={pillTint} />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <EmptyState
              icon="foods"
              tracker="meal"
              title={foods.length ? "No Foods found" : "Your food journal"}
              description={
                foods.length
                  ? "Try another search or status filter."
                  : "Foods and their current status will live here, together in one quiet place."
              }
            />
          )}
        </>
      )}
      {child ? (
        <FoodLogging ref={foodLogging} childId={child.id} hideDefaultContent />
      ) : null}
      {editingFood !== undefined ? (
        <FoodCatalogForm
          key={editingFood?.id ?? "new-custom-food"}
          food={editingFood}
          onCancel={() => setEditingFood(undefined)}
          onSave={saveCustomFood}
        />
      ) : null}
    </Screen>
  );
}
