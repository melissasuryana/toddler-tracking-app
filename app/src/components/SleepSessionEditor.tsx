import { SLEEP_QUALITIES, type RoutineEntry } from "@keepsake/routine";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { SleepSessionEditInput } from "~/data/session.types";
import { Body, MetaLabel } from "~/components/Screen";
import { PillChip } from "~/components/PillChip";
import { nativeFonts } from "~/theme/tokens";
import { useTheme } from "~/theme/ThemeProvider";

export function SleepSessionEditor({
  entry,
  onSave,
  onCancel,
}: {
  readonly entry: Extract<RoutineEntry, { kind: "sleep_session" }>;
  readonly onSave: (input: SleepSessionEditInput) => void;
  readonly onCancel: () => void;
}) {
  const theme = useTheme();
  const [startAt, setStartAt] = useState(
    new Date(entry.content.startAt).toISOString()
  );
  const [endedAt, setEndedAt] = useState(
    new Date(entry.occurredAt).toISOString()
  );
  const [quality, setQuality] = useState(entry.content.quality);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const start = Date.parse(startAt);
    const end = Date.parse(endedAt);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      setError("Enter valid ISO date and time values.");
      return;
    }
    if (end <= start) {
      setError("Sleep must end after its start time.");
      return;
    }
    try {
      onSave({
        startAt: start,
        endedAt: end,
        quality,
        factors: entry.content.factors,
      });
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Sleep could not be saved."
      );
    }
  }

  return (
    <View
      style={{
        padding: theme.space.page,
        gap: theme.space.fieldGap,
      }}
    >
      <MetaLabel>Sleep session</MetaLabel>
      <Text
        style={{
          color: theme.colors.ink,
          fontFamily: nativeFonts.serif,
          fontSize: theme.typography.sheetTitle.fontSize,
          fontWeight: String(theme.typography.sheetTitle.fontWeight) as "500",
        }}
      >
        Correct{" "}
        <Text style={{ color: theme.colors.sleepInk, fontStyle: "italic" }}>
          sleep
        </Text>{" "}
        times
      </Text>
      <Body dim>
        Times use UTC. The recorded timezone remains {entry.occurredTz}.
      </Body>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.space.fieldGap,
          paddingVertical: theme.space.rowBlock,
        }}
      >
        {SLEEP_QUALITIES.map((option) => (
          <PillChip
            key={option}
            label={option[0].toUpperCase() + option.slice(1)}
            selected={quality === option}
            tint={theme.colors.safeChip}
            onPress={() => setQuality(option)}
          />
        ))}
      </View>
      {error ? <Body>{error}</Body> : null}
      <View
        style={{
          borderTopColor: theme.colors.ruleThin,
          borderBottomColor: theme.colors.ruleThin,
          borderTopWidth: theme.rule.hairline,
          borderBottomWidth: theme.rule.hairline,
          paddingVertical: theme.space.fieldGap,
        }}
      >
        <MetaLabel>When</MetaLabel>
        <Body>Fell asleep · ISO 8601</Body>
        <TextInput
          accessibilityLabel="Sleep start in UTC"
          keyboardType="numbers-and-punctuation"
          onChangeText={setStartAt}
          placeholder="Sleep start (ISO 8601)"
          placeholderTextColor={theme.colors.meta}
          style={inputStyle(theme)}
          value={startAt}
        />
        <Body>Woke up · ISO 8601</Body>
        <TextInput
          accessibilityLabel="Sleep end in UTC"
          keyboardType="numbers-and-punctuation"
          onChangeText={setEndedAt}
          placeholder="Sleep end (ISO 8601)"
          placeholderTextColor={theme.colors.meta}
          style={inputStyle(theme)}
          value={endedAt}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.space.fieldGap,
          paddingTop: theme.space.rowBlock,
        }}
      >
        <PillChip label="Cancel" selected={false} onPress={onCancel} />
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
            Save changes
          </Text>
        </Pressable>
      </View>
    </View>
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
