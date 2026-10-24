import type { RoutineEntry, SleepQuality } from "@keepsake/routine";
import { useState } from "react";
import { TextInput, View } from "react-native";
import type { SleepSessionEditInput } from "~/data/session.types";
import { Body } from "~/components/Screen";
import { PillChip } from "~/components/PillChip";
import { nativeFonts } from "~/theme/tokens";
import { useTheme } from "~/theme/ThemeProvider";

const QUALITIES: readonly SleepQuality[] = ["poor", "okay", "great"];

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
      <Body>Correct Sleep Session</Body>
      <Body dim>
        Times use UTC. The recorded timezone remains {entry.occurredTz}.
      </Body>
      <TextInput
        accessibilityLabel="Sleep start in UTC"
        keyboardType="numbers-and-punctuation"
        onChangeText={setStartAt}
        placeholder="Sleep start (ISO 8601)"
        placeholderTextColor={theme.colors.meta}
        style={inputStyle(theme)}
        value={startAt}
      />
      <TextInput
        accessibilityLabel="Sleep end in UTC"
        keyboardType="numbers-and-punctuation"
        onChangeText={setEndedAt}
        placeholder="Sleep end (ISO 8601)"
        placeholderTextColor={theme.colors.meta}
        style={inputStyle(theme)}
        value={endedAt}
      />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.space.fieldGap,
        }}
      >
        {QUALITIES.map((option) => (
          <PillChip
            key={option}
            label={option[0].toUpperCase() + option.slice(1)}
            selected={quality === option}
            onPress={() => setQuality(option)}
          />
        ))}
      </View>
      {error ? <Body>{error}</Body> : null}
      <View
        style={{
          flexDirection: "row",
          gap: theme.space.fieldGap,
        }}
      >
        <PillChip label="Cancel" selected={false} onPress={onCancel} />
        <PillChip label="Save changes" selected onPress={save} />
      </View>
    </View>
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
