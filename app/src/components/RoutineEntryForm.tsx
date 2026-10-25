import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import {
  SLEEP_QUALITIES,
  SLEEP_QUALITY_FACTOR_SEEDS,
  type RoutineEntry,
  type RoutineEntryInput,
  type RoutineEntryKind,
} from "@keepsake/routine";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { Body, MetaLabel } from "./Screen";
import { PillChip } from "./PillChip";
import {
  EntryTimestampFields,
  useEntryTimestamp,
} from "./EntryTimestampFields";
import { routineDraft, routineInput, type RoutineDraft } from "./routineDraft";

export function RoutineEntryForm({
  childId,
  kind,
  entry,
  sleepStart,
  sleepTimezone,
  onSave,
  onCancel,
}: {
  readonly childId: string;
  readonly kind: RoutineEntryKind;
  readonly entry?: RoutineEntry;
  readonly sleepStart?: number;
  readonly sleepTimezone?: string;
  readonly onSave: (input: RoutineEntryInput) => void;
  readonly onCancel: () => void;
}) {
  const data = useData();
  const theme = useTheme();
  const [draft, setDraft] = useState(() =>
    routineDraft(entry, data.temperatureUnit() ?? "C")
  );
  const [customFactor, setCustomFactor] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timestamp = useEntryTimestamp({
    occurredAt: entry?.occurredAt ?? Date.now(),
    occurredTz:
      entry?.occurredTz ??
      sleepTimezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const start = useEntryTimestamp({
    occurredAt:
      entry?.kind === "sleep_session"
        ? entry.content.startAt
        : (sleepStart ?? Date.now() - 3_600_000),
    occurredTz: timestamp.original.occurredTz,
  });
  const choicesStyle = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.space.fieldGap,
  };
  function change<K extends keyof RoutineDraft>(
    key: K,
    value: RoutineDraft[K]
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function field(key: keyof RoutineDraft, label: string, numeric = false) {
    return (
      <View key={key}>
        <Body>{label}</Body>
        <TextInput
          accessibilityLabel={label}
          value={String(draft[key])}
          keyboardType={numeric ? "decimal-pad" : "default"}
          placeholderTextColor={theme.colors.meta}
          onChangeText={(value) => change(key, value as never)}
          style={{
            color: theme.colors.ink,
            fontSize: theme.typography.body.fontSize,
            paddingVertical: theme.space.fieldGap,
            borderBottomWidth: theme.rule.hairline,
            borderBottomColor: theme.colors.ruleThin,
          }}
        />
      </View>
    );
  }
  function choices<T extends string>(
    label: string,
    values: readonly T[],
    selected: T | "",
    select: (value: T) => void
  ) {
    return (
      <View style={{ gap: theme.space.fieldGap }}>
        <Body>{label}</Body>
        <View style={choicesStyle}>
          {values.map((value) => (
            <PillChip
              key={value}
              label={value}
              selected={selected === value}
              onPress={() => select(value)}
            />
          ))}
        </View>
      </View>
    );
  }
  function save() {
    try {
      if (!timestamp.resolved.ok) throw new Error(timestamp.resolved.error);
      if (kind === "sleep_session" && !start.resolved.ok)
        throw new Error(start.resolved.error);
      const input = routineInput(
        childId,
        kind,
        timestamp.resolved,
        draft,
        start.resolved.ok ? start.resolved.occurredAt : undefined
      );
      onSave(input);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Entry could not be saved."
      );
    }
  }
  const suggestions =
    kind === "medical" &&
    (draft.category === "medication" || draft.category === "vaccine")
      ? [
          ...new Set(
            data
              .routineEntriesForChild(childId)
              .flatMap((item) =>
                item.kind === "medical" &&
                item.content.category === draft.category &&
                "name" in item.content
                  ? [item.content.name]
                  : []
              )
          ),
        ]
          .filter((name) =>
            name
              .toLocaleLowerCase()
              .includes(draft.name.trim().toLocaleLowerCase())
          )
          .slice(0, 10)
      : [];
  const factors = [
    ...new Set([
      ...SLEEP_QUALITY_FACTOR_SEEDS,
      ...data
        .routineEntriesForChild(childId)
        .flatMap((item) =>
          item.kind === "sleep_session" ? (item.content.factors ?? []) : []
        ),
      ...draft.factors,
    ]),
  ];
  const sleepOverlaps =
    kind === "sleep_session" &&
    start.resolved.ok &&
    timestamp.resolved.ok &&
    data
      .routineEntriesForChild(childId)
      .some(
        (item) =>
          item.kind === "sleep_session" &&
          item.id !== entry?.id &&
          start.resolved.ok &&
          timestamp.resolved.ok &&
          item.content.startAt < timestamp.resolved.occurredAt &&
          item.occurredAt > start.resolved.occurredAt
      );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: theme.space.page,
        gap: theme.space.rowGap,
      }}
    >
      <MetaLabel>{entry ? "Edit entry" : "New entry"}</MetaLabel>
      <Body>{kind.replaceAll("_", " ")}</Body>
      {kind === "feed" ? (
        <>
          {choices(
            "Side · optional",
            ["left", "right"] as const,
            draft.side,
            (side) => change("side", draft.side === side ? "" : side)
          )}
          {field("durationSeconds", "Duration · seconds (optional)", true)}
        </>
      ) : null}
      {kind === "diaper_change" ? (
        <>
          {choices(
            "Change",
            ["wet", "dirty", "both"] as const,
            draft.change,
            (value) => change("change", value)
          )}
          {field("note", "Note · optional")}
        </>
      ) : null}
      {kind === "growth" ? (
        <>
          {field("weightKg", "Weight · kg", true)}
          {field("heightCm", "Height · cm", true)}
          {field("headCircumferenceCm", "Head circumference · cm", true)}
        </>
      ) : null}
      {kind === "medical" ? (
        <>
          {choices(
            "Category",
            ["medication", "vaccine", "symptom", "temperature"] as const,
            draft.category,
            (value) => change("category", value)
          )}
          {draft.category === "medication" || draft.category === "vaccine" ? (
            <>
              <Body>Name · required</Body>
              <TextInput
                accessibilityLabel="Medical name"
                value={draft.name}
                onChangeText={(value) => change("name", value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                style={{
                  color: theme.colors.ink,
                  paddingVertical: theme.space.fieldGap,
                  borderBottomColor: theme.colors.ruleThin,
                  borderBottomWidth: theme.rule.hairline,
                }}
              />
              {nameFocused
                ? suggestions.map((name) => (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      onPressIn={() => {
                        change("name", name);
                        setNameFocused(false);
                      }}
                    >
                      <Body>{name}</Body>
                    </Pressable>
                  ))
                : null}
            </>
          ) : null}
          {draft.category === "medication"
            ? field("dose", "Dose · amount and unit (optional)")
            : null}
          {draft.category === "symptom"
            ? field("description", "Symptom description · required")
            : null}
          {draft.category === "temperature" ? (
            <>
              {field("value", "Temperature · required", true)}
              {choices("Unit", ["C", "F"] as const, draft.unit, (value) =>
                change("unit", value)
              )}
            </>
          ) : null}
          {field("note", "Note · optional")}
        </>
      ) : null}
      {kind === "sleep_session" ? (
        <>
          {choices(
            "Sleep quality · required",
            SLEEP_QUALITIES,
            draft.quality ?? "",
            (value) => change("quality", value)
          )}
          <Body>Sleep Quality Factors · optional</Body>
          <View style={choicesStyle}>
            {factors.map((factor) => (
              <PillChip
                key={factor}
                label={factor}
                selected={draft.factors.includes(factor)}
                onPress={() =>
                  change(
                    "factors",
                    draft.factors.includes(factor)
                      ? draft.factors.filter((value) => value !== factor)
                      : [...draft.factors, factor]
                  )
                }
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="Custom Sleep Quality Factor"
            value={customFactor}
            onChangeText={setCustomFactor}
            placeholder="Add a factor"
            placeholderTextColor={theme.colors.meta}
            style={{
              color: theme.colors.ink,
              paddingVertical: theme.space.fieldGap,
            }}
          />
          <PillChip
            label="Add factor"
            selected={false}
            onPress={() => {
              if (customFactor.trim())
                change("factors", [
                  ...new Set([...draft.factors, customFactor.trim()]),
                ]);
              setCustomFactor("");
            }}
          />
        </>
      ) : null}
      {sleepOverlaps ? (
        <Body>
          This Sleep Session overlaps another logged Sleep Session. You can
          still save it.
        </Body>
      ) : null}
      {error ? <Body>{error}</Body> : null}
      {kind === "sleep_session" ? <MetaLabel>When</MetaLabel> : null}
      {kind === "sleep_session" ? (
        <EntryTimestampFields label="Fell asleep" {...start} />
      ) : null}
      <EntryTimestampFields
        label={kind === "sleep_session" ? "Woke up" : "Entry"}
        {...timestamp}
      />
      <View style={choicesStyle}>
        <PillChip label="Cancel" selected={false} onPress={onCancel} />
        <PillChip
          label={entry ? "Save changes" : "Save"}
          selected
          onPress={save}
        />
      </View>
    </ScrollView>
  );
}
