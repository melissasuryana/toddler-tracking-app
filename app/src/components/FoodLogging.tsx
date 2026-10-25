import { useEffect, useState } from "react";
import { BackHandler, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  FoodEntry,
  MealEntry,
  MealEntryInput,
} from "@keepsake/food-tracking";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { Body, MetaLabel } from "./Screen";
import { PillChip } from "./PillChip";
import { MealForm } from "./MealForm";
import { FoodEntryForm } from "./FoodEntryForm";

export function FoodLogging({ childId }: { readonly childId: string }) {
  const data = useData();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<"meal" | "introduction" | "reaction">("meal");
  const [startedDrafts, setStartedDrafts] = useState<ReadonlySet<typeof tab>>(
    new Set()
  );
  const [editing, setEditing] = useState<FoodEntry | MealEntry | null>(null);
  const [introductionDraft, setIntroductionDraft] = useState(0);
  const [reactionDraft, setReactionDraft] = useState(0);
  const [mealDraft, setMealDraft] = useState(0);
  const [contextualFood, setContextualFood] = useState<string | undefined>();
  const [mealPrefill, setMealPrefill] = useState<MealEntryInput | undefined>();
  const [now, setNow] = useState(Date.now);
  const statusTime = Math.max(now, Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const meals = data.mealsForChild(childId);
  const foodEntries = data.foodEntriesForChild(childId);
  const foods = data.foods();
  const introducedFoodIds = new Set(
    foodEntries.flatMap((entry) =>
      entry.kind === "introduction" ? [entry.content.foodId] : []
    )
  );
  const watches = foods
    .filter((food) => introducedFoodIds.has(food.id))
    .flatMap((food) => {
      const status = data.foodStatus(childId, food.id, statusTime);
      return status.status === "trying" && status.watchPeriod
        ? [{ food, watch: status.watchPeriod }]
        : [];
    });
  const rowStyle = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.space.fieldGap,
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setVisible(false);
        return true;
      }
    );
    return () => subscription.remove();
  }, [visible]);

  function open(kind: typeof tab, foodId?: string) {
    setEditing(null);
    selectTab(kind);
    if (foodId) {
      setContextualFood(foodId);
      if (kind === "reaction") setReactionDraft((value) => value + 1);
      else setIntroductionDraft((value) => value + 1);
    }
    setVisible(true);
  }

  function selectTab(kind: typeof tab) {
    setTab(kind);
    setStartedDrafts((current) => new Set(current).add(kind));
  }

  function saved(kind: typeof tab) {
    setVisible(false);
    setEditing(null);
    setStartedDrafts((current) => {
      const next = new Set(current);
      next.delete(kind);
      return next;
    });
    setContextualFood(undefined);
    if (kind === "meal") {
      setMealDraft((value) => value + 1);
      setMealPrefill(undefined);
    } else if (kind === "introduction") {
      setIntroductionDraft((value) => value + 1);
    } else {
      setReactionDraft((value) => value + 1);
    }
    setMessage("Entry saved.");
  }

  function alsoMeal(entry: Extract<FoodEntry, { kind: "introduction" }>) {
    // The Introduction is already durable; abandoning this draft never removes it.
    const draft = data.mealDraftForIntroduction(entry.id);
    setIntroductionDraft((value) => value + 1);
    setMealPrefill(draft);
    setMealDraft((value) => value + 1);
    setStartedDrafts((current) => {
      const next = new Set(current);
      next.delete("introduction");
      return next.add("meal");
    });
    setContextualFood(undefined);
    setEditing(null);
    setTab("meal");
    setMessage("Introduction saved. The Meal is a separate, editable draft.");
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: theme.space.page,
          gap: theme.space.fieldGap,
        }}
      >
        <View style={rowStyle}>
          <PillChip label="Log a meal" selected onPress={() => open("meal")} />
          <PillChip
            label="Log an Introduction"
            selected={false}
            onPress={() => open("introduction")}
          />
          <PillChip
            label="Log a Reaction"
            selected={false}
            onPress={() => open("reaction")}
          />
        </View>
        {message ? <Body dim>{message}</Body> : null}
        {watches.length ? <MetaLabel>Active watches</MetaLabel> : null}
        {watches.map(({ food, watch }) => (
          <View
            key={food.id}
            style={{
              gap: theme.space.fieldGap,
              paddingVertical: theme.space.fieldGap,
            }}
          >
            <Body>
              {food.name} · watching until{" "}
              {new Date(watch.endsAt).toLocaleString()}
            </Body>
            <View style={rowStyle}>
              <PillChip
                label={`Log ${food.name} again`}
                selected={false}
                onPress={() => open("introduction", food.id)}
              />
              <PillChip
                label={`Reaction to ${food.name}`}
                selected={false}
                onPress={() => open("reaction", food.id)}
              />
            </View>
          </View>
        ))}
        {meals.length || foodEntries.length ? (
          <MetaLabel>Recent food Entries</MetaLabel>
        ) : null}
        {[...meals, ...foodEntries]
          .sort((a, b) => b.occurredAt - a.occurredAt)
          .slice(0, 10)
          .map((entry) => {
            const label =
              entry.kind === "meal"
                ? `${entry.content.name || "Meal"} · ${entry.content.amount}/5`
                : entry.kind === "introduction"
                  ? `Introduction · ${foods.find((food) => food.id === entry.content.foodId)?.name ?? "Food"}`
                  : `Reaction · ${entry.content.severity} · ${entry.content.foodIds.map((id) => foods.find((food) => food.id === id)?.name ?? "Food").join(", ")}`;
            return (
              <PillChip
                key={entry.id}
                label={`Edit ${label}`}
                selected={false}
                onPress={() => {
                  setEditing(entry);
                  setTab(entry.kind);
                  setVisible(true);
                }}
              />
            );
          })}
      </ScrollView>
      {/* A mounted overlay keeps both unsaved drafts through Cancel, unlike a hidden native Modal. */}
      <View
        accessibilityViewIsModal={visible}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          display: visible ? "flex" : "none",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: theme.colors.paper,
        }}
      >
        <View
          style={{
            flex: 1,
            paddingTop: theme.space.sheetBlock,
            backgroundColor: theme.colors.paper,
          }}
        >
          {!editing ? (
            <View style={[rowStyle, { paddingHorizontal: theme.space.page }]}>
              <PillChip
                label="Meal"
                selected={tab === "meal"}
                onPress={() => selectTab("meal")}
              />
              <PillChip
                label="Introduction"
                selected={tab === "introduction"}
                onPress={() => selectTab("introduction")}
              />
              {tab === "reaction" ? (
                <PillChip label="Reaction" selected />
              ) : null}
            </View>
          ) : null}
          {visible && message?.startsWith("Introduction saved") ? (
            <Body>{message}</Body>
          ) : null}
          <View
            style={{
              flex: 1,
              display: !editing && tab === "meal" ? "flex" : "none",
            }}
          >
            {startedDrafts.has("meal") ? (
              <MealForm
                key={`meal-${mealDraft}`}
                childId={childId}
                defaults={data.mealDefaultsForChild(childId)}
                prefilled={mealPrefill}
                prefilledTimestamp={mealPrefill}
                suggestionsFor={(query) =>
                  data.mealNameSuggestions(childId, query)
                }
                onCancel={() => setVisible(false)}
                onSave={(input) => {
                  data.createMeal(input);
                  saved("meal");
                }}
              />
            ) : null}
          </View>
          <View
            style={{
              flex: 1,
              display: !editing && tab === "introduction" ? "flex" : "none",
            }}
          >
            {startedDrafts.has("introduction") ? (
              <FoodEntryForm
                key={`introduction-${introductionDraft}`}
                childId={childId}
                kind="introduction"
                contextualFoodId={contextualFood}
                onSaved={() => saved("introduction")}
                onAlsoMeal={alsoMeal}
                onCancel={() => setVisible(false)}
              />
            ) : null}
          </View>
          <View
            style={{
              flex: 1,
              display: !editing && tab === "reaction" ? "flex" : "none",
            }}
          >
            {startedDrafts.has("reaction") ? (
              <FoodEntryForm
                key={`reaction-${reactionDraft}`}
                childId={childId}
                kind="reaction"
                contextualFoodId={contextualFood}
                onSaved={() => saved("reaction")}
                onAlsoMeal={alsoMeal}
                onCancel={() => setVisible(false)}
              />
            ) : null}
          </View>
          {editing?.kind === "meal" ? (
            <MealForm
              key={editing.id}
              childId={childId}
              initialMeal={editing}
              defaults={data.mealDefaultsForChild(childId)}
              suggestionsFor={(query) =>
                data.mealNameSuggestions(childId, query)
              }
              onCancel={() => setVisible(false)}
              onSave={(input) => {
                if (!data.updateMeal(editing.id, input))
                  throw new Error("This Meal is no longer available.");
                setEditing(null);
                setVisible(false);
              }}
            />
          ) : editing ? (
            <FoodEntryForm
              key={editing.id}
              childId={childId}
              entry={editing}
              kind={editing.kind}
              onSaved={() => {
                setEditing(null);
                setVisible(false);
                setMessage("Entry updated.");
              }}
              onAlsoMeal={alsoMeal}
              onCancel={() => setVisible(false)}
            />
          ) : null}
        </View>
      </View>
    </>
  );
}
