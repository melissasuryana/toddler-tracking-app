import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { Food } from "@keepsake/food-tracking";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import { Body, Hairline, Masthead, MetaLabel, Orb, Pill } from "./Screen";
import { PillChip } from "./PillChip";
import { introductionHistoryForFood } from "./foodBrowser";

export function FoodDetail({
  food,
  childId,
  onBack,
  onLog,
  onEdit,
  onDelete,
}: {
  readonly food: Food;
  readonly childId: string;
  readonly onBack: () => void;
  readonly onLog: (kind: "introduction" | "reaction", foodId: string) => void;
  readonly onEdit: () => void;
  readonly onDelete: () => boolean;
}) {
  const data = useData();
  const theme = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = Date.now();
  const status = data.foodStatus(childId, food.id, now);
  const pillTint = theme.statusPillTint(status.status);
  const history = introductionHistoryForFood(
    data.foodEntriesForChild(childId),
    food.id,
    now
  );
  const watch = status.watchPeriod;
  const detailMessage =
    status.status === "trying" && watch
      ? `Watching until ${new Date(watch.endsAt).toLocaleString()}`
      : status.status === "safe"
        ? status.safeReason === "manual"
          ? "Marked safe before the Watch Period ended."
          : "The Watch Period ended without a Reaction."
        : status.status === "avoid"
          ? "Avoid for now. A new Introduction can re-challenge this Food."
          : "No Introductions logged for this Child.";

  function markSafe() {
    try {
      if (!data.markFoodSafe(childId, food.id)) {
        throw new Error("This Watch Period has already ended.");
      }
      setMessage(`${food.name} marked safe.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Food could not be marked safe."
      );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <Masthead
        title=""
        emphasis={food.name}
        kicker="Back"
        onKickerPress={onBack}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.sheetBlock * 2 }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.paper,
            gap: 8,
            paddingHorizontal: theme.space.page,
            paddingVertical: 20,
          }}
        >
          <Orb
            icon="foods"
            tint={{
              background: pillTint.background,
              foreground: pillTint.foreground,
            }}
            size={58}
            iconSize={26}
          />
          <Pill label={status.status} tint={pillTint} />
          <Text
            style={{
              color: theme.colors.meta,
              fontFamily: nativeFonts.sans,
              fontSize: 11,
              textAlign: "center",
            }}
          >
            {detailMessage}
          </Text>
          <Text
            style={{
              color: theme.colors.ink,
              fontFamily: nativeFonts.serif,
              fontSize: 19,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {status.exposureCount}{" "}
            {status.exposureCount === 1 ? "Introduction" : "Introductions"}
          </Text>
          <Text
            style={{
              color: theme.colors.meta,
              fontFamily: nativeFonts.sans,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            exposure count · Meals don’t count
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            paddingHorizontal: theme.space.page,
            paddingBottom: 14,
          }}
        >
          <PillChip
            label="Log Introduction"
            selected
            tint={theme.statusPillTint("trying")}
            onPress={() => onLog("introduction", food.id)}
          />
          <PillChip
            label="Log Reaction"
            selected={false}
            tint={theme.statusPillTint("avoid")}
            onPress={() => onLog("reaction", food.id)}
          />
          {status.status === "trying" && status.watchPeriod ? (
            <PillChip label="Mark safe" selected={false} onPress={markSafe} />
          ) : null}
        </View>

        {food.category || food.allergenTags.length ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "center",
              paddingHorizontal: theme.space.page,
              paddingBottom: 12,
            }}
          >
            {food.category ? (
              <PillChip label={food.category} selected={false} />
            ) : null}
            {food.allergenTags.map((tag) => (
              <PillChip
                key={tag}
                label={tag}
                selected={false}
                tint={theme.statusPillTint("avoid")}
              />
            ))}
          </View>
        ) : null}

        <Hairline strong />
        <MetaLabel>Introduction history</MetaLabel>
        {history.length ? (
          history.map((entry) => (
            <View
              key={entry.id}
              style={{
                borderTopColor: theme.colors.ruleThin,
                borderTopWidth: theme.rule.hairline,
                gap: 3,
                paddingHorizontal: theme.space.page,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  color: theme.colors.ink,
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {new Date(entry.occurredAt).toLocaleString()}
                {entry.kind === "introduction" && entry.content.texture
                  ? ` · ${entry.content.texture}`
                  : ""}
              </Text>
              {entry.kind === "introduction" && entry.content.note ? (
                <Body dim>{entry.content.note}</Body>
              ) : null}
            </View>
          ))
        ) : (
          <Body dim>No Introduction history yet.</Body>
        )}

        {food.source === "custom" && status.status === "untried" ? (
          <View
            style={{
              borderTopColor: theme.colors.ruleThin,
              borderTopWidth: theme.rule.hairline,
              flexDirection: "row",
              gap: 8,
              justifyContent: "center",
              marginTop: 18,
              padding: theme.space.page,
            }}
          >
            <PillChip label="Edit Food" selected={false} onPress={onEdit} />
            <PillChip
              label={confirmDelete ? "Keep Food" : "Delete Food"}
              selected={false}
              onPress={() => setConfirmDelete(!confirmDelete)}
            />
          </View>
        ) : null}
        {confirmDelete ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.dangerWash,
              gap: 8,
              marginHorizontal: theme.space.page,
              padding: 12,
            }}
          >
            <Body>Delete {food.name}? This can’t be undone.</Body>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!onDelete()) {
                  setMessage("This Food can only be deleted while untried.");
                }
              }}
              style={{ padding: 8 }}
            >
              <Text
                style={{
                  color: theme.colors.danger,
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                Confirm delete
              </Text>
            </Pressable>
          </View>
        ) : null}
        {message ? (
          <Text
            accessibilityRole="alert"
            style={{
              color: theme.colors.meta,
              fontFamily: nativeFonts.sans,
              fontSize: 11,
              padding: theme.space.page,
              textAlign: "center",
            }}
          >
            {message}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
