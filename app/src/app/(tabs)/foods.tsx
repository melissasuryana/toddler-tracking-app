/** Foods — the per-Food status browser, styled as Direction D Food Journal. */
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { StatusKey } from "@keepsake/design-system";
import { FoodLogging, type FoodLoggingHandle } from "~/components/FoodLogging";
import {
  EmptyState,
  Hairline,
  Masthead,
  Orb,
  Pill,
  Screen,
} from "~/components/Screen";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

export default function FoodsScreen() {
  const data = useData();
  const theme = useTheme();
  const child = data.child;
  const foodLogging = useRef<FoodLoggingHandle>(null);
  const [filter, setFilter] = useState<StatusKey | "all">("all");

  const foods = useMemo(() => data.foods(), [data]);

  const foodItems = useMemo(() => {
    if (!child) {
      return foods.map((food) => ({
        food,
        status: "untried" as StatusKey,
        dayNum: undefined,
      }));
    }
    const now = Date.now();
    return foods.map((food) => {
      const info = data.foodStatus(child.id, food.id);
      const dayNum =
        info.status === "trying" && info.watchPeriod
          ? Math.min(
              3,
              Math.max(
                1,
                Math.floor((now - info.watchPeriod.startedAt) / 86_400_000) + 1
              )
            )
          : undefined;
      return {
        food,
        status: info.status as StatusKey,
        dayNum,
      };
    });
  }, [data, child, foods]);

  const counts = useMemo(() => {
    const summary = { safe: 0, trying: 0, untried: 0, avoid: 0 };
    for (const item of foodItems) {
      summary[item.status] = (summary[item.status] || 0) + 1;
    }
    return summary;
  }, [foodItems]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return foodItems;
    return foodItems.filter((item) => item.status === filter);
  }, [foodItems, filter]);

  return (
    <Screen>
      <Masthead
        title="The "
        emphasis="food"
        suffix=" journal"
        kicker={`${foods.length}`}
      />

      {/* Direction D Statusbar (.d-statusbar) */}
      <View
        style={{
          flexDirection: "row",
          gap: 14,
          paddingHorizontal: theme.space.page,
          paddingVertical: 10,
          backgroundColor: theme.colors.paper,
        }}
      >
        <Pressable
          onPress={() => setFilter(filter === "safe" ? "all" : "safe")}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 10,
              letterSpacing: 0.6,
              color: filter === "safe" ? theme.colors.ink : theme.colors.meta,
            }}
          >
            <Text style={{ fontWeight: "700", color: theme.colors.ink }}>
              {counts.safe}
            </Text>{" "}
            safe
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter(filter === "trying" ? "all" : "trying")}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 10,
              letterSpacing: 0.6,
              color: filter === "trying" ? theme.colors.ink : theme.colors.meta,
            }}
          >
            <Text style={{ fontWeight: "700", color: theme.colors.ink }}>
              {counts.trying}
            </Text>{" "}
            trying
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter(filter === "untried" ? "all" : "untried")}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 10,
              letterSpacing: 0.6,
              color:
                filter === "untried" ? theme.colors.ink : theme.colors.meta,
            }}
          >
            <Text style={{ fontWeight: "700", color: theme.colors.ink }}>
              {counts.untried}
            </Text>{" "}
            untried
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter(filter === "avoid" ? "all" : "avoid")}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 10,
              letterSpacing: 0.6,
              color: theme.colors.danger,
            }}
          >
            <Text style={{ fontWeight: "700", color: theme.colors.danger }}>
              {counts.avoid}
            </Text>{" "}
            avoid
          </Text>
        </Pressable>
      </View>

      <Hairline />

      {foods.length === 0 ? (
        <EmptyState
          icon="foods"
          tracker="meal"
          title="Your food journal"
          description="Foods and their current status will live here, together in one quiet place."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: theme.space.sheetBlock * 2 }}
        >
          {filteredItems.map(({ food, status, dayNum }) => {
            const pillTint = theme.statusPillTint(status);
            const pillLabel =
              status === "trying" && dayNum
                ? `Day ${dayNum}`
                : status.charAt(0).toUpperCase() + status.slice(1);

            const subtitleParts = [
              food.category,
              ...(food.allergenTags ?? []),
            ].filter(Boolean);
            const subtitle = subtitleParts.join(" · ");

            return (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityLabel={`${food.name} · ${pillLabel}`}
                onPress={() => {
                  if (status === "trying") {
                    foodLogging.current?.open("reaction", food.id);
                  } else {
                    foodLogging.current?.open("introduction", food.id);
                  }
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: theme.space.page,
                  paddingVertical: 10,
                  gap: 12,
                  borderTopWidth: theme.rule.hairline,
                  borderTopColor: theme.colors.ruleThin,
                  backgroundColor: theme.colors.paper,
                  opacity: pressed ? 0.7 : 1,
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
                      fontFamily: nativeFonts.sans,
                      fontSize: 13,
                      fontWeight: "600",
                      color: theme.colors.ink,
                    }}
                  >
                    {food.name}
                  </Text>
                  {subtitle ? (
                    <Text
                      style={{
                        fontFamily: nativeFonts.sans,
                        fontSize: 10.5,
                        color: theme.colors.meta,
                        marginTop: 1,
                      }}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pill label={pillLabel} tint={pillTint} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {child ? (
        <FoodLogging ref={foodLogging} childId={child.id} hideDefaultContent />
      ) : null}
    </Screen>
  );
}
