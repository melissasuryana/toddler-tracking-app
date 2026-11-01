import { Pressable, Text, View } from "react-native";
import type { Food, FoodWatchPeriod } from "@keepsake/food-tracking";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import { PillChip } from "./PillChip";

export function FoodWatchCard({
  food,
  watch,
  now,
  reactionCount,
  onIntroduction,
  onReaction,
  onMarkSafe,
}: {
  readonly food: Food;
  readonly watch: FoodWatchPeriod;
  readonly now: number;
  readonly reactionCount: number;
  readonly onIntroduction: () => void;
  readonly onReaction: () => void;
  readonly onMarkSafe: () => void;
}) {
  const theme = useTheme();
  const dayNum = Math.min(
    3,
    Math.max(1, Math.floor((now - watch.startedAt) / 86_400_000) + 1)
  );
  return (
    <View
      style={{
        backgroundColor: theme.colors.accentWash,
        borderTopColor: theme.colors.accent,
        borderTopWidth: 2,
        paddingHorizontal: theme.space.page,
        paddingTop: 12,
        paddingBottom: 14,
      }}
    >
      <Text
        style={{
          color: theme.colors.accent,
          fontFamily: nativeFonts.sans,
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        Watching · day {dayNum} of 3
      </Text>
      <Text
        style={{
          color: theme.colors.ink,
          fontFamily: nativeFonts.serif,
          fontSize: 19,
          marginTop: 3,
        }}
      >
        {food.name}
      </Text>
      <Text
        style={{
          color: theme.colors.accentInk,
          fontFamily: nativeFonts.sans,
          fontSize: 10.5,
          marginTop: 2,
        }}
      >
        ends{" "}
        {new Date(watch.endsAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        ·{" "}
        {reactionCount === 0
          ? "no reactions logged"
          : `${reactionCount} reaction(s) logged`}
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: 5,
          marginVertical: 10,
        }}
      >
        {[1, 2, 3].map((day) => (
          <View
            key={day}
            style={{
              backgroundColor:
                day <= dayNum
                  ? theme.colors.accent
                  : theme.name === "night"
                    ? theme.colors.accentSoft
                    : theme.colors.accentWash,
              borderRadius: theme.radius.pill,
              height: 5,
              width: 26,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        <PillChip label="Try again" selected={false} onPress={onIntroduction} />
        <PillChip
          label="Log reaction"
          selected={false}
          tint={theme.statusPillTint("avoid")}
          onPress={onReaction}
        />
        <PillChip label="Mark safe" selected={false} onPress={onMarkSafe} />
      </View>
    </View>
  );
}
