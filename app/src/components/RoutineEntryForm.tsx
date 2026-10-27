import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  SLEEP_QUALITIES,
  SLEEP_QUALITY_FACTOR_SEEDS,
  type RoutineEntry,
  type RoutineEntryInput,
  type RoutineEntryKind,
} from "@keepsake/routine";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { Body } from "./Screen";
import { KeepsakeIcon } from "./KeepsakeIcon";
import { PillChip } from "./PillChip";
import { nativeFonts } from "~/theme/tokens";
import {
  EntryTimestampFields,
  useEntryTimestamp,
} from "./EntryTimestampFields";
import { routineDraft, routineInput, type RoutineDraft } from "./routineDraft";

const KIND_META: Record<
  RoutineEntryKind,
  {
    readonly kicker: string;
    readonly title: string;
    readonly icon: "feed" | "diaper" | "sleep" | "medical" | "growth";
    readonly trackerKey: "feed" | "diaper" | "sleep" | "medical" | "growth";
    readonly stepNote: string;
    readonly editNote: string;
  }
> = {
  feed: {
    kicker: "Daily Routine",
    title: "feed",
    icon: "feed",
    trackerKey: "feed",
    stepNote: "Breast or bottle nursing — side and duration in minutes.",
    editNote: "✏️ Editing — the Entry keeps its identity. “When” is when feed started.",
  },
  diaper_change: {
    kicker: "Daily Routine",
    title: "diaper",
    icon: "diaper",
    trackerKey: "diaper",
    stepNote: "Observation and change — one tap saves wet, dirty, or both.",
    editNote: "✏️ Editing — the Entry keeps its identity. “When” is when diaper was changed.",
  },
  sleep_session: {
    kicker: "Sleep Tracker",
    title: "sleep",
    icon: "sleep",
    trackerKey: "sleep",
    stepNote: "Fell asleep to wake up — timer or retrospective logging.",
    editNote: "✏️ Editing — the Entry keeps its identity. Quality and factors can be refined.",
  },
  medical: {
    kicker: "Health & Care",
    title: "medical",
    icon: "medical",
    trackerKey: "medical",
    stepNote: "One of four categories — all carry optional notes and timestamps.",
    editNote: "✏️ Editing — the Entry keeps its identity. “When” is when administered / observed.",
  },
  growth: {
    kicker: "Paediatric Milestones",
    title: "growth",
    icon: "growth",
    trackerKey: "growth",
    stepNote: "Any of the three measurements — enter at least one to save.",
    editNote: "✏️ Editing — the Entry keeps its identity. “When” is when measured.",
  },
};

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

  function change<K extends keyof RoutineDraft>(
    key: K,
    value: RoutineDraft[K]
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
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

  const meta = KIND_META[kind];
  const trackerColor = theme.colors.tracker[meta.trackerKey];

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
        paddingHorizontal: theme.space.page,
        paddingBottom: theme.space.sheetBlock * 2,
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.sheet,
          borderColor: theme.colors.ruleThin,
          borderWidth: 1,
          borderRadius: 18,
          padding: 16,
          gap: 12,
        }}
      >
        {/* Sheet Head */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                fontWeight: "600",
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: theme.colors.meta,
              }}
            >
              {meta.kicker}
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.serif,
                fontSize: 20,
                color: theme.colors.ink,
              }}
            >
              {entry ? "Edit " : "Log "}
              <Text style={{ color: theme.colors.accent, fontStyle: "italic" }}>
                {meta.title}
              </Text>
            </Text>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: trackerColor.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <KeepsakeIcon
              name={meta.icon}
              size={18}
              color={trackerColor.foreground}
            />
          </View>
        </View>

        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 12,
            color: theme.colors.meta,
            marginTop: -6,
          }}
        >
          {meta.stepNote}
        </Text>

        {entry ? (
          <View
            style={{
              backgroundColor: theme.colors.accentWash,
              borderColor: theme.colors.accentSoft,
              borderWidth: 1,
              borderRadius: 8,
              paddingVertical: 7,
              paddingHorizontal: 10,
            }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 11.5,
                color: theme.colors.accentInk,
              }}
            >
              {meta.editNote}
            </Text>
          </View>
        ) : null}

        {/* Form Body for Feed */}
        {kind === "feed" ? (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 6 }}>
              <FieldLabel label="Side" hint="optional" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["left", "right"] as const).map((side) => {
                  const isSelected = draft.side === side;
                  return (
                    <Pressable
                      key={side}
                      accessibilityRole="button"
                      accessibilityLabel={`Feed ${side} side`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() =>
                        change("side", isSelected ? "" : side)
                      }
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? theme.colors.safeChip.border
                          : theme.colors.chipBorder,
                        backgroundColor: isSelected
                          ? theme.colors.safeChip.background
                          : theme.colors.paper,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontFamily: nativeFonts.sans,
                          fontSize: 13,
                          fontWeight: isSelected ? "700" : "600",
                          color: isSelected
                            ? theme.colors.safeChip.foreground
                            : theme.colors.ink,
                          textTransform: "capitalize",
                        }}
                      >
                        {side}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <FieldLabel
                label="Duration (seconds)"
                hint="optional · quick chips available"
              />
              <TextInput
                accessibilityLabel="Duration · seconds (optional)"
                keyboardType="decimal-pad"
                value={String(draft.durationSeconds)}
                onChangeText={(value) => change("durationSeconds", value)}
                placeholder="e.g. 600 (10 min) or 900 (15 min)"
                placeholderTextColor={theme.colors.meta}
                style={inputStyle(theme)}
              />
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[
                  { label: "10m", sec: "600" },
                  { label: "15m", sec: "900" },
                  { label: "20m", sec: "1200" },
                ].map((chip) => {
                  const isSel = draft.durationSeconds === chip.sec;
                  return (
                    <PillChip
                      key={chip.label}
                      label={`+${chip.label}`}
                      selected={isSel}
                      onPress={() =>
                        change("durationSeconds", isSel ? "" : chip.sec)
                      }
                    />
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {/* Form Body for Diaper */}
        {kind === "diaper_change" ? (
          <View style={{ gap: 10 }}>
            <View style={{ gap: 6 }}>
              <FieldLabel label="Change type" hint="required" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["wet", "dirty", "both"] as const).map((type) => {
                  const isSelected = draft.change === type;
                  return (
                    <Pressable
                      key={type}
                      accessibilityRole="button"
                      accessibilityLabel={`Diaper ${type}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => change("change", type)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? theme.colors.accentChip.border
                          : theme.colors.chipBorder,
                        backgroundColor: isSelected
                          ? theme.colors.accentChip.background
                          : theme.colors.paper,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontFamily: nativeFonts.sans,
                          fontSize: 13,
                          fontWeight: isSelected ? "700" : "600",
                          color: isSelected
                            ? theme.colors.accentChip.foreground
                            : theme.colors.ink,
                          textTransform: "capitalize",
                        }}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 4 }}>
              <FieldLabel label="Note" hint="optional" />
              <TextInput
                accessibilityLabel="Note · optional"
                multiline
                value={draft.note}
                onChangeText={(value) => change("note", value)}
                placeholder="Note (optional)"
                placeholderTextColor={theme.colors.meta}
                style={noteInputStyle(theme)}
              />
            </View>
          </View>
        ) : null}

        {/* Form Body for Sleep Session */}
        {kind === "sleep_session" ? (
          <View style={{ gap: 12 }}>
            <View style={{ gap: 6 }}>
              <FieldLabel label="Sleep quality" hint="required" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SLEEP_QUALITIES.map((q) => {
                  const isSelected = draft.quality === q;
                  return (
                    <Pressable
                      key={q}
                      accessibilityRole="button"
                      accessibilityLabel={`Sleep quality ${q}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => change("quality", q)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? theme.colors.safeChip.border
                          : theme.colors.chipBorder,
                        backgroundColor: isSelected
                          ? theme.colors.safeChip.background
                          : theme.colors.paper,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontFamily: nativeFonts.sans,
                          fontSize: 13,
                          fontWeight: isSelected ? "700" : "600",
                          color: isSelected
                            ? theme.colors.safeChip.foreground
                            : theme.colors.ink,
                          textTransform: "capitalize",
                        }}
                      >
                        {q}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <FieldLabel label="Sleep factors" hint="optional tags" />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {factors.map((factor) => {
                  const isSelected = draft.factors.includes(factor);
                  return (
                    <PillChip
                      key={factor}
                      label={factor}
                      selected={isSelected}
                      onPress={() =>
                        change(
                          "factors",
                          isSelected
                            ? draft.factors.filter((f) => f !== factor)
                            : [...draft.factors, factor]
                        )
                      }
                    />
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <TextInput
                  accessibilityLabel="Custom Sleep Quality Factor"
                  value={customFactor}
                  onChangeText={setCustomFactor}
                  placeholder="e.g. teething, overtired"
                  placeholderTextColor={theme.colors.meta}
                  style={[inputStyle(theme), { flex: 1 }]}
                />
                <PillChip
                  label="+ Add"
                  selected={false}
                  onPress={() => {
                    if (customFactor.trim()) {
                      change("factors", [
                        ...new Set([...draft.factors, customFactor.trim()]),
                      ]);
                      setCustomFactor("");
                    }
                  }}
                />
              </View>
            </View>

            {sleepOverlaps ? (
              <View
                style={{
                  backgroundColor: theme.colors.accentWash,
                  borderColor: theme.colors.accentSoft,
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 11.5,
                    color: theme.colors.danger,
                  }}
                >
                  ⚠️ This Sleep Session overlaps another logged Sleep Session.
                  You can still save it.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Form Body for Medical */}
        {kind === "medical" ? (
          <View style={{ gap: 12 }}>
            <View style={{ gap: 6 }}>
              <FieldLabel label="Category" hint="select one" />
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(
                  [
                    "medication",
                    "vaccine",
                    "symptom",
                    "temperature",
                  ] as const
                ).map((cat) => {
                  const isSelected = draft.category === cat;
                  return (
                    <Pressable
                      key={cat}
                      accessibilityRole="button"
                      accessibilityLabel={`Category ${cat}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => change("category", cat)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? theme.colors.accentSoft
                          : theme.colors.chipBorder,
                        backgroundColor: isSelected
                          ? theme.colors.accentWash
                          : theme.colors.paper,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: nativeFonts.sans,
                          fontSize: 11,
                          fontWeight: isSelected ? "700" : "600",
                          color: isSelected
                            ? theme.colors.accentInk
                            : theme.colors.ink,
                          textTransform: "capitalize",
                        }}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Category: Medication */}
            {draft.category === "medication" ? (
              <View style={{ gap: 8 }}>
                <View style={{ gap: 4 }}>
                  <FieldLabel
                    label="Medication name"
                    hint="history autocomplete"
                  />
                  <TextInput
                    accessibilityLabel="Medical name"
                    value={draft.name}
                    onChangeText={(value) => change("name", value)}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    placeholder="e.g. Paracetamol, Ibuprofen"
                    placeholderTextColor={theme.colors.meta}
                    style={inputStyle(theme)}
                  />
                  {nameFocused && suggestions.length > 0 ? (
                    <View
                      style={{
                        backgroundColor: theme.colors.paper,
                        borderColor: theme.colors.chipBorder,
                        borderWidth: 1,
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      {suggestions.map((name) => (
                        <Pressable
                          key={name}
                          accessibilityRole="button"
                          onPressIn={() => {
                            change("name", name);
                            setNameFocused(false);
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderBottomWidth: theme.rule.hairline,
                            borderBottomColor: theme.colors.ruleThin,
                          }}
                        >
                          <Body>{name}</Body>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={{ gap: 4 }}>
                  <FieldLabel
                    label="Dose"
                    hint="optional, amount + unit"
                  />
                  <TextInput
                    accessibilityLabel="Dose · amount and unit (optional)"
                    value={draft.dose}
                    onChangeText={(value) => change("dose", value)}
                    placeholder='e.g. "5 ml" or "120 mg"'
                    placeholderTextColor={theme.colors.meta}
                    style={inputStyle(theme)}
                  />
                </View>
              </View>
            ) : null}

            {/* Category: Vaccine */}
            {draft.category === "vaccine" ? (
              <View style={{ gap: 8 }}>
                <View style={{ gap: 4 }}>
                  <FieldLabel
                    label="Vaccine name"
                    hint="history autocomplete"
                  />
                  <TextInput
                    accessibilityLabel="Medical name"
                    value={draft.name}
                    onChangeText={(value) => change("name", value)}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    placeholder="e.g. MMR, DTaP (2nd dose)"
                    placeholderTextColor={theme.colors.meta}
                    style={inputStyle(theme)}
                  />
                  {nameFocused && suggestions.length > 0 ? (
                    <View
                      style={{
                        backgroundColor: theme.colors.paper,
                        borderColor: theme.colors.chipBorder,
                        borderWidth: 1,
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      {suggestions.map((name) => (
                        <Pressable
                          key={name}
                          accessibilityRole="button"
                          onPressIn={() => {
                            change("name", name);
                            setNameFocused(false);
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderBottomWidth: theme.rule.hairline,
                            borderBottomColor: theme.colors.ruleThin,
                          }}
                        >
                          <Body>{name}</Body>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 11.5,
                    color: theme.colors.meta,
                  }}
                >
                  Routine immunisation record for paediatric schedule.
                </Text>
              </View>
            ) : null}

            {/* Category: Symptom */}
            {draft.category === "symptom" ? (
              <View style={{ gap: 8 }}>
                <View style={{ gap: 4 }}>
                  <FieldLabel
                    label="Symptom"
                    hint="required description"
                  />
                  <TextInput
                    accessibilityLabel="Symptom description · required"
                    value={draft.description}
                    onChangeText={(value) => change("description", value)}
                    placeholder="e.g. runny nose, mild dry cough"
                    placeholderTextColor={theme.colors.meta}
                    style={inputStyle(theme)}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 11.5,
                    color: theme.colors.meta,
                  }}
                >
                  Illness and general observation only — food allergy reactions
                  belong to a Reaction.
                </Text>
              </View>
            ) : null}

            {/* Category: Temperature */}
            {draft.category === "temperature" ? (
              <View style={{ gap: 8 }}>
                <View style={{ gap: 4 }}>
                  <FieldLabel label="Temperature" hint="numeric value" />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      accessibilityLabel="Temperature · required"
                      keyboardType="decimal-pad"
                      value={draft.value}
                      onChangeText={(value) => change("value", value)}
                      placeholder="e.g. 38.2"
                      placeholderTextColor={theme.colors.meta}
                      style={[inputStyle(theme), { flex: 1 }]}
                    />
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(["C", "F"] as const).map((unit) => {
                        const isSelected = draft.unit === unit;
                        return (
                          <PillChip
                            key={unit}
                            label={`°${unit}`}
                            selected={isSelected}
                            onPress={() => change("unit", unit)}
                          />
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={{ gap: 4 }}>
              <FieldLabel label="Note" hint="optional" />
              <TextInput
                accessibilityLabel="Note · optional"
                multiline
                value={draft.note}
                onChangeText={(value) => change("note", value)}
                placeholder="Note (optional)"
                placeholderTextColor={theme.colors.meta}
                style={noteInputStyle(theme)}
              />
            </View>
          </View>
        ) : null}

        {/* Form Body for Growth */}
        {kind === "growth" ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <FieldLabel label="Weight" hint="(kg)" />
                <TextInput
                  accessibilityLabel="Weight · kg"
                  keyboardType="decimal-pad"
                  value={draft.weightKg}
                  onChangeText={(val) => change("weightKg", val)}
                  placeholder="e.g. 9.4"
                  placeholderTextColor={theme.colors.meta}
                  style={inputStyle(theme)}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <FieldLabel label="Height" hint="(cm)" />
                <TextInput
                  accessibilityLabel="Height · cm"
                  keyboardType="decimal-pad"
                  value={draft.heightCm}
                  onChangeText={(val) => change("heightCm", val)}
                  placeholder="e.g. 74.5"
                  placeholderTextColor={theme.colors.meta}
                  style={inputStyle(theme)}
                />
              </View>
            </View>
            <View style={{ gap: 4 }}>
              <FieldLabel label="Head circumference" hint="(cm)" />
              <TextInput
                accessibilityLabel="Head circumference · cm"
                keyboardType="decimal-pad"
                value={draft.headCircumferenceCm}
                onChangeText={(val) => change("headCircumferenceCm", val)}
                placeholder="e.g. 46.2"
                placeholderTextColor={theme.colors.meta}
                style={inputStyle(theme)}
              />
            </View>
          </View>
        ) : null}

        {error ? <Body>{error}</Body> : null}

        {/* Shared Timestamp Invariant directly preceding Save */}
        <View
          style={{
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.ruleThin,
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            marginTop: 4,
            gap: 8,
          }}
        >
          {kind === "sleep_session" ? (
            <EntryTimestampFields label="Fell asleep" {...start} />
          ) : null}
          <EntryTimestampFields
            label={kind === "sleep_session" ? "Woke up" : "Entry"}
            {...timestamp}
          />
        </View>

        {/* Actions: Cancel + Save */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.space.fieldGap,
            paddingTop: 4,
          }}
        >
          <PillChip label="Cancel" selected={false} onPress={onCancel} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry ? "Save changes" : "Save"}
            onPress={save}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: theme.colors.ruleStrong,
              borderRadius: theme.radius.pill,
              flex: 1,
              paddingHorizontal: theme.space.buttonInset,
              paddingVertical: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: theme.colors.paper,
                fontFamily: nativeFonts.sans,
                fontSize: 13.5,
                fontWeight: "600",
              }}
            >
              {entry ? "Save changes" : `Save ${meta.title}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function FieldLabel({
  label,
  hint,
}: {
  readonly label: string;
  readonly hint?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 2,
        paddingBottom: 2,
      }}
    >
      <Text
        style={{
          color: theme.colors.meta,
          fontFamily: nativeFonts.sans,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {hint ? (
        <Text
          style={{
            color: theme.colors.meta,
            fontFamily: nativeFonts.sans,
            fontSize: 10,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: theme.colors.sheet,
    borderColor: theme.colors.chipBorder,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.ink,
    fontFamily: nativeFonts.sans,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  };
}

function noteInputStyle(theme: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: theme.colors.sheet,
    borderColor: theme.colors.chipBorder,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.ink,
    fontFamily: nativeFonts.serif,
    fontStyle: "italic" as const,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  };
}
