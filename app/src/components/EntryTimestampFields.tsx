import { useState } from "react";
import { TextInput, View } from "react-native";
import { Body, MetaLabel } from "./Screen";
import { PillChip } from "./PillChip";
import { useTheme } from "~/theme/ThemeProvider";
import {
  localDateTime,
  resolveEntryTimestamp,
  timestampOptions,
  formatUtcOffset,
  type EntryTimestamp,
} from "./entryTimestamp";

export function useEntryTimestamp(initial: EntryTimestamp) {
  const [original] = useState(initial);
  const local = localDateTime(original.occurredAt, original.occurredTz);
  const [date, setDate] = useState(local.date);
  const [time, setTime] = useState(local.time);
  const [edited, setEdited] = useState(false);
  const [offset, setOffset] = useState<number>();
  return {
    original,
    date,
    time,
    offset,
    setDate: (value: string) => {
      setDate(value);
      setEdited(true);
      setOffset(undefined);
    },
    setTime: (value: string) => {
      setTime(value);
      setEdited(true);
      setOffset(undefined);
    },
    setOffset: (value: number) => {
      setOffset(value);
      setEdited(true);
    },
    resolved: resolveEntryTimestamp(original, edited, date, time, offset),
  };
}

export function EntryTimestampFields({
  label = "Entry",
  original,
  date,
  time,
  offset,
  setDate,
  setTime,
  setOffset,
}: {
  readonly label?: string;
  readonly original: EntryTimestamp;
  readonly date: string;
  readonly time: string;
  readonly offset?: number;
  readonly setDate: (value: string) => void;
  readonly setTime: (value: string) => void;
  readonly setOffset: (value: number) => void;
}) {
  const theme = useTheme();
  const style = {
    color: theme.colors.ink,
    borderBottomColor: theme.colors.ruleThin,
    borderBottomWidth: theme.rule.hairline,
    paddingVertical: theme.space.fieldGap,
    fontSize: theme.typography.body.fontSize,
  };
  const options = timestampOptions(`${date}T${time}`, original.occurredTz);
  return (
    <View style={{ gap: theme.space.fieldGap }}>
      <MetaLabel>
        {label === "Fell asleep" || label === "Woke up" ? label : "When"}
      </MetaLabel>
      <Body>Date · YYYY-MM-DD</Body>
      <TextInput
        accessibilityLabel={`${label} date`}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.colors.meta}
        style={style}
      />
      <Body>Time · HH:mm</Body>
      <TextInput
        accessibilityLabel={`${label} time`}
        value={time}
        onChangeText={setTime}
        placeholder="HH:mm"
        placeholderTextColor={theme.colors.meta}
        style={style}
      />
      {options.length > 1 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: theme.space.fieldGap,
          }}
        >
          {options.map(({ utcOffsetMinutes }) => (
            <PillChip
              key={utcOffsetMinutes}
              label={formatUtcOffset(utcOffsetMinutes)}
              selected={offset === utcOffsetMinutes}
              onPress={() => setOffset(utcOffsetMinutes)}
            />
          ))}
        </View>
      ) : null}
      <Body dim>{original.occurredTz}</Body>
    </View>
  );
}
