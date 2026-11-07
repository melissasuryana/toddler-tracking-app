import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { IntroductionEntry } from "@keepsake/food-tracking";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import { DeleteEntryConfirm } from "./DeleteEntryConfirm";
import { EntryInlineEditor } from "./EntryInlineEditor";
import { PillChip } from "./PillChip";
import {
  ENTRY_LABELS,
  entrySummary,
  type LoggedEntry,
} from "./entryPresentation";
import {
  entryDetailContext,
  entryDetailFields,
  entryDetailText,
  entryTime,
  type EntryDetailField,
} from "./entryDetails";

export function EntryDetail({
  entry,
  onClose,
  onAlsoMeal,
}: {
  readonly entry: LoggedEntry;
  readonly onClose: () => void;
  readonly onAlsoMeal: (entry: IntroductionEntry) => void;
}) {
  const data = useData();
  const theme = useTheme();
  const [activeField, setActiveField] = useState<
    EntryDetailField["key"] | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = ENTRY_LABELS[entry.kind];
  const summary = entrySummary(entry, data.foods());
  const when = entryTime(entry.occurredAt, entry.occurredTz);
  const fields = entryDetailFields(entry, data.foods());
  const context = entryDetailContext(entry);
  const timestampField: EntryDetailField = {
    key: "occurredAt",
    label: entry.kind === "sleep_session" ? "Woke up" : "When",
    value: when,
  };
  const metaStyle = {
    fontFamily: nativeFonts.sans,
    fontSize: 10,
    letterSpacing: 1,
    color: theme.colors.meta,
    textTransform: "uppercase" as const,
  };

  function editor(field: EntryDetailField) {
    return (
      <EntryInlineEditor
        key={field.key}
        entry={entry}
        field={field}
        onCancel={() => setActiveField(null)}
        onSaved={() => {
          setActiveField(null);
          setError(null);
        }}
      />
    );
  }

  function remove() {
    try {
      const deleted =
        entry.kind === "meal"
          ? data.deleteMeal(entry.id)
          : entry.kind === "introduction" || entry.kind === "reaction"
            ? data.deleteFoodEntry(entry.id)
            : data.deleteRoutineEntry(entry.id);
      if (!deleted) throw new Error("This Entry is no longer available.");
      setConfirmDelete(false);
      onClose();
    } catch (caught) {
      setConfirmDelete(false);
      setError(
        caught instanceof Error ? caught.message : "Entry could not be deleted."
      );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 18,
            paddingVertical: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Ledger"
            onPress={onClose}
            hitSlop={8}
          >
            <Text style={metaStyle}>← Ledger</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete entry"
            onPress={() => setConfirmDelete(true)}
            hitSlop={8}
          >
            <Text style={{ ...metaStyle, color: theme.colors.danger }}>
              Delete
            </Text>
          </Pressable>
        </View>
        <View
          style={{
            backgroundColor: theme.colors.sleepBand,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.ruleStrong,
            paddingHorizontal: 20,
            paddingVertical: 17,
            gap: 5,
          }}
        >
          <Text style={metaStyle}>{label}</Text>
          <Text
            style={{
              fontFamily: nativeFonts.serif,
              fontSize: 22,
              lineHeight: 27,
              color: theme.colors.ink,
            }}
          >
            {summary}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${timestampField.label}: ${when}. Change recorded time`}
            accessibilityHint="Opens an inline editor"
            accessibilityState={{ disabled: activeField !== null }}
            disabled={activeField !== null}
            onPress={() => setActiveField("occurredAt")}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                color: theme.colors.ink,
              }}
            >
              {when}
              {entry.kind === "sleep_session" ? " · Woke up" : ""}
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                color: theme.colors.meta,
              }}
            >
              {entry.occurredTz}
            </Text>
          </Pressable>
          {activeField === "occurredAt" && entry.kind !== "sleep_session"
            ? editor(timestampField)
            : null}
        </View>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ padding: 14, color: theme.colors.danger }}
          >
            {error}
          </Text>
        ) : null}
        <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
          <Text style={{ ...metaStyle, marginTop: 10, marginBottom: 4 }}>
            Recorded details
          </Text>
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              color: theme.colors.meta,
              fontSize: 11,
              marginBottom: 9,
            }}
          >
            Tap a field to change it.
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              borderWidth: 0.5,
              borderColor: theme.colors.ruleThin,
            }}
          >
            {fields.map((field) => {
              const active = activeField === field.key;
              const missing =
                field.value === null ||
                field.value === "" ||
                (Array.isArray(field.value) && field.value.length === 0);
              return (
                <View
                  key={field.key}
                  style={{
                    width: active ? "100%" : "50%",
                    minHeight: 73,
                    padding: 10,
                    borderWidth: 0.5,
                    borderColor: theme.colors.ruleThin,
                    backgroundColor: theme.colors.sheet,
                  }}
                >
                  {active ? (
                    <>
                      <Text style={{ ...metaStyle, marginBottom: 10 }}>
                        {field.label}
                      </Text>
                      {editor(field)}
                    </>
                  ) : (
                    <Pressable
                      accessibilityRole={field.readOnly ? "text" : "button"}
                      accessibilityLabel={`${field.label}: ${entryDetailText(field.value)}`}
                      accessibilityHint={
                        field.readOnly ? undefined : "Opens an inline editor"
                      }
                      accessibilityState={{
                        disabled: field.readOnly || activeField !== null,
                      }}
                      disabled={field.readOnly || activeField !== null}
                      onPress={() => setActiveField(field.key)}
                      style={{ minHeight: 52 }}
                    >
                      <Text
                        style={{
                          ...metaStyle,
                          fontSize: 10,
                          letterSpacing: 0.7,
                          marginBottom: 6,
                        }}
                      >
                        {field.label}
                      </Text>
                      {Array.isArray(field.value) && field.value.length ? (
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 5,
                          }}
                        >
                          {field.value.map((value) => (
                            <View
                              key={value}
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 9,
                                borderRadius: theme.radius.pill,
                                borderWidth: 1,
                                borderColor: theme.colors.ruleThin,
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: nativeFonts.sans,
                                  fontSize: 11,
                                  color: theme.colors.ink,
                                }}
                              >
                                {value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text
                          style={{
                            fontFamily: nativeFonts.sans,
                            fontSize: 13,
                            color: missing
                              ? theme.colors.meta
                              : theme.colors.ink,
                            fontStyle: missing ? "italic" : "normal",
                          }}
                        >
                          {entryDetailText(field.value)}
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          {context ? (
            <View
              style={{
                marginTop: 16,
                padding: 12,
                borderLeftWidth: 2,
                borderLeftColor: theme.colors.accent,
                backgroundColor: theme.colors.accentWash,
              }}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 11,
                  color: theme.colors.meta,
                }}
              >
                {context}
              </Text>
            </View>
          ) : null}
          {entry.kind === "sleep_session" &&
          data.hasSleepSessionOverlap(entry.id) ? (
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                color: theme.colors.danger,
                marginTop: 16,
              }}
            >
              This Sleep Session overlaps another logged Sleep Session.
            </Text>
          ) : null}
          {entry.kind === "introduction" && !activeField ? (
            <View style={{ alignItems: "flex-start", marginTop: 15 }}>
              <PillChip
                label="Also log a meal"
                selected={false}
                onPress={() => onAlsoMeal(entry)}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
      <DeleteEntryConfirm
        visible={confirmDelete}
        title={`Delete this ${label.toLowerCase()}?`}
        description={`${summary} · ${when}`}
        onKeep={() => setConfirmDelete(false)}
        onDelete={remove}
      />
    </View>
  );
}
