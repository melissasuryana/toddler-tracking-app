import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Body } from "./Screen";
import { PillChip } from "./PillChip";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import {
  localDateTime,
  resolveEntryTimestamp,
  timestampOptions,
  formatUtcOffset,
  formatKeepsakeTimestamp,
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
  label = "When",
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
  const [expanded, setExpanded] = useState(false);
  const isReaction = label === "Symptoms appeared";
  const isSleep = label === "Fell asleep" || label === "Woke up";
  const displayPrefix = isReaction
    ? "Symptoms appeared"
    : isSleep
      ? label
      : "When";
  const style = isReaction ? "reaction" : isSleep ? "sleep" : "standard";
  const actionText = expanded
    ? "Done"
    : isReaction || isSleep
      ? "Edit"
      : "Change";
  const formatted = formatKeepsakeTimestamp(
    date,
    time,
    original.occurredTz,
    style
  );
  const friendlyText = `${displayPrefix} · ${formatted}`;

  const inputStyle = {
    color: theme.colors.ink,
    borderBottomColor: theme.colors.ruleThin,
    borderBottomWidth: theme.rule.hairline,
    paddingVertical: theme.space.fieldGap,
    fontSize: theme.typography.body.fontSize,
  };
  const options = timestampOptions(`${date}T${time}`, original.occurredTz);

  return (
    <View
      style={{
        borderTopWidth: theme.rule.hairline,
        borderBottomWidth: theme.rule.hairline,
        borderColor: theme.colors.ruleThin,
        paddingVertical: 10,
        paddingHorizontal: 2,
        marginTop: 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 11.5,
            fontWeight: "600",
            color: theme.colors.meta,
          }}
        >
          {friendlyText}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionText} ${displayPrefix}`}
          onPress={() => setExpanded(!expanded)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 11.5,
              fontWeight: "600",
              color: theme.colors.accent,
            }}
          >
            {actionText}
          </Text>
        </Pressable>
      </View>
      {expanded ? (
        <View
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: theme.rule.hairline,
            borderTopColor: theme.colors.ruleThin,
            gap: theme.space.fieldGap,
          }}
        >
          <Body>Date · YYYY-MM-DD</Body>
          <TextInput
            accessibilityLabel={`${label} date`}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.meta}
            style={inputStyle}
          />
          <Body>Time · HH:mm</Body>
          <TextInput
            accessibilityLabel={`${label} time`}
            value={time}
            onChangeText={setTime}
            placeholder="HH:mm"
            placeholderTextColor={theme.colors.meta}
            style={inputStyle}
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
      ) : null}
    </View>
  );
}

export function DualEntryTimestampFields({
  start,
  end,
}: {
  readonly start: {
    readonly original: EntryTimestamp;
    readonly date: string;
    readonly time: string;
    readonly offset?: number;
    readonly setDate: (value: string) => void;
    readonly setTime: (value: string) => void;
    readonly setOffset: (value: number) => void;
  };
  readonly end: {
    readonly original: EntryTimestamp;
    readonly date: string;
    readonly time: string;
    readonly offset?: number;
    readonly setDate: (value: string) => void;
    readonly setTime: (value: string) => void;
    readonly setOffset: (value: number) => void;
  };
}) {
  const theme = useTheme();
  const [startExpanded, setStartExpanded] = useState(false);
  const [endExpanded, setEndExpanded] = useState(false);

  const startFormatted = formatKeepsakeTimestamp(
    start.date,
    start.time,
    start.original.occurredTz,
    "sleep"
  );
  const endFormatted = formatKeepsakeTimestamp(
    end.date,
    end.time,
    end.original.occurredTz,
    "sleep"
  );

  const inputStyle = {
    color: theme.colors.ink,
    borderBottomColor: theme.colors.ruleThin,
    borderBottomWidth: theme.rule.hairline,
    paddingVertical: theme.space.fieldGap,
    fontSize: theme.typography.body.fontSize,
  };

  const startOptions = timestampOptions(
    `${start.date}T${start.time}`,
    start.original.occurredTz
  );
  const endOptions = timestampOptions(
    `${end.date}T${end.time}`,
    end.original.occurredTz
  );

  return (
    <View
      style={{
        borderTopWidth: theme.rule.hairline,
        borderBottomWidth: theme.rule.hairline,
        borderColor: theme.colors.ruleThin,
        marginTop: 4,
      }}
    >
      {/* Row 1: Fell asleep */}
      <View style={{ paddingVertical: 9, paddingHorizontal: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 11.5,
              fontWeight: "600",
              color: theme.colors.meta,
            }}
          >
            {`Fell asleep · ${startFormatted}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${startExpanded ? "Done" : "Edit"} Fell asleep`}
            onPress={() => setStartExpanded(!startExpanded)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 11.5,
                fontWeight: "600",
                color: theme.colors.accent,
              }}
            >
              {startExpanded ? "Done" : "Edit"}
            </Text>
          </Pressable>
        </View>
        {startExpanded ? (
          <View
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: theme.rule.hairline,
              borderTopColor: theme.colors.ruleThin,
              gap: theme.space.fieldGap,
            }}
          >
            <Body>Date · YYYY-MM-DD</Body>
            <TextInput
              accessibilityLabel="Fell asleep date"
              value={start.date}
              onChangeText={start.setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.meta}
              style={inputStyle}
            />
            <Body>Time · HH:mm</Body>
            <TextInput
              accessibilityLabel="Fell asleep time"
              value={start.time}
              onChangeText={start.setTime}
              placeholder="HH:mm"
              placeholderTextColor={theme.colors.meta}
              style={inputStyle}
            />
            {startOptions.length > 1 ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.space.fieldGap,
                }}
              >
                {startOptions.map(({ utcOffsetMinutes }) => (
                  <PillChip
                    key={utcOffsetMinutes}
                    label={formatUtcOffset(utcOffsetMinutes)}
                    selected={start.offset === utcOffsetMinutes}
                    onPress={() => start.setOffset(utcOffsetMinutes)}
                  />
                ))}
              </View>
            ) : null}
            <Body dim>{start.original.occurredTz}</Body>
          </View>
        ) : null}
      </View>

      {/* Row divider */}
      <View
        style={{
          borderTopWidth: theme.rule.hairline,
          borderColor: theme.colors.ruleThin,
        }}
      />

      {/* Row 2: Woke up */}
      <View style={{ paddingVertical: 9, paddingHorizontal: 2 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 11.5,
              fontWeight: "600",
              color: theme.colors.meta,
            }}
          >
            {`Woke up · ${endFormatted}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${endExpanded ? "Done" : "Edit"} Woke up`}
            onPress={() => setEndExpanded(!endExpanded)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 11.5,
                fontWeight: "600",
                color: theme.colors.accent,
              }}
            >
              {endExpanded ? "Done" : "Edit"}
            </Text>
          </Pressable>
        </View>
        {endExpanded ? (
          <View
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: theme.rule.hairline,
              borderTopColor: theme.colors.ruleThin,
              gap: theme.space.fieldGap,
            }}
          >
            <Body>Date · YYYY-MM-DD</Body>
            <TextInput
              accessibilityLabel="Woke up date"
              value={end.date}
              onChangeText={end.setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.meta}
              style={inputStyle}
            />
            <Body>Time · HH:mm</Body>
            <TextInput
              accessibilityLabel="Woke up time"
              value={end.time}
              onChangeText={end.setTime}
              placeholder="HH:mm"
              placeholderTextColor={theme.colors.meta}
              style={inputStyle}
            />
            {endOptions.length > 1 ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.space.fieldGap,
                }}
              >
                {endOptions.map(({ utcOffsetMinutes }) => (
                  <PillChip
                    key={utcOffsetMinutes}
                    label={formatUtcOffset(utcOffsetMinutes)}
                    selected={end.offset === utcOffsetMinutes}
                    onPress={() => end.setOffset(utcOffsetMinutes)}
                  />
                ))}
              </View>
            ) : null}
            <Body dim>{end.original.occurredTz}</Body>
          </View>
        ) : null}
      </View>
    </View>
  );
}
