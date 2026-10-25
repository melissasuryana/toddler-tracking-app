import { civilDateAt, type ImportReport } from "@keepsake/import";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { Body, Hairline, MetaLabel, Screen, ScreenTitle } from "./Screen";
import { chooseImportCsv } from "./importCsv";

export function TriedFoodImport({
  onClose,
  onImported,
}: {
  readonly onClose: () => void;
  readonly onImported: (report: ImportReport) => void;
}) {
  const data = useData();
  const theme = useTheme();
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [csv, setCsv] = useState("");
  const [fallbackDate, setFallbackDate] = useState(() =>
    civilDateAt(Date.now(), timeZone)
  );
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fieldStyle = {
    color: theme.colors.ink,
    backgroundColor: theme.colors.sheet,
    borderColor: theme.colors.ruleStrong,
    borderWidth: theme.rule.hairline,
    padding: theme.space.rowBlock,
    fontSize: theme.typography.body.fontSize,
  };
  const action = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        paddingVertical: theme.space.rowBlock,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Body>{label}</Body>
    </Pressable>
  );
  const makePreview = () => {
    try {
      setError("");
      if (!data.child) throw new Error("A Child is required.");
      setPreview(
        data.previewTriedFoods(csv, {
          childId: data.child.id,
          fallbackDate,
          timeZone,
        })
      );
      setConfirmed(false);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not preview CSV."
      );
    }
  };
  const commit = () => {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const result = data.commitTriedFoods(preview, confirmed);
      if (result.abortReason) {
        setPreview(result);
        setError(result.abortReason);
      } else onImported(result);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Import failed. Nothing was saved; you can retry."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <Screen>
        <ScreenTitle>Import tried foods</ScreenTitle>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: theme.space.page,
            gap: theme.space.rowGap,
          }}
        >
          <Body>
            For {preview?.childName ?? data.child?.name ?? "your Child"}
          </Body>
          <Body dim>
            Timezone: {timeZone}. Dates become the first valid instant of each
            local day.
          </Body>
          {!preview ? (
            <>
              <Body dim>
                Choose a CSV or paste its contents. Headers: name, date,
                category, allergens. Use YYYY-MM-DD dates and semicolons between
                allergens. Without headers, use one name per row.
              </Body>
              {action("Choose CSV file", () => {
                setError("");
                void chooseImportCsv()
                  .then((text) => {
                    if (text !== null) setCsv(text);
                  })
                  .catch((failure: unknown) =>
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Could not read file. You can paste CSV instead."
                    )
                  );
              })}
              <TextInput
                accessibilityLabel="CSV contents"
                multiline
                value={csv}
                onChangeText={setCsv}
                autoCorrect={false}
                autoCapitalize="none"
                placeholder="name,date,category,allergens"
                placeholderTextColor={theme.colors.meta}
                style={[
                  fieldStyle,
                  {
                    minHeight: theme.size.avatar * 2,
                    textAlignVertical: "top",
                  },
                ]}
              />
              <Body>
                Fallback date for missing, invalid, nonexistent or future dates
              </Body>
              <TextInput
                accessibilityLabel="Fallback date"
                value={fallbackDate}
                onChangeText={setFallbackDate}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.meta}
                style={fieldStyle}
              />
              {action("Preview import", makePreview, !csv.trim())}
            </>
          ) : (
            <>
              <ImportCounts report={preview} />
              {preview.abortReason ? (
                <Body>Cannot import: {preview.abortReason}</Body>
              ) : null}
              <Body dim>
                Warnings overlap row counts. Each data row is counted once as
                import, skipped or failed. Duplicates are included in skipped.
              </Body>
              {preview.rows.map((row) => (
                <View key={row.line} style={{ gap: theme.space.fieldGap }}>
                  <Hairline />
                  <Body>
                    Row {row.line}: {row.name || "(empty name)"} —{" "}
                    {row.classification}
                  </Body>
                  <Body dim>
                    {row.reason}
                    {row.date ? ` Date: ${row.date}.` : ""}
                  </Body>
                  {row.warnings.map((warning, index) => (
                    <Body dim key={index}>
                      {warning}
                    </Body>
                  ))}
                </View>
              ))}
              <Body>
                Confirm fallback date: {preview.fallbackDate} (
                {preview.timeZone})
              </Body>
              <Switch
                accessibilityLabel="Confirm fallback date"
                value={confirmed}
                onValueChange={setConfirmed}
                trackColor={{
                  false: theme.colors.ruleThin,
                  true: theme.colors.accent,
                }}
                thumbColor={theme.colors.sheet}
                ios_backgroundColor={theme.colors.ruleThin}
              />
              {action(
                busy ? "Importing…" : "Confirm import",
                commit,
                !confirmed || !!preview.abortReason || busy
              )}
              {action("Edit CSV or fallback date", () => {
                setPreview(null);
                setConfirmed(false);
                setError("");
              })}
            </>
          )}
          {error ? <Body>{error}</Body> : null}
          {action("Cancel — save nothing", onClose, busy)}
        </ScrollView>
      </Screen>
    </Modal>
  );
}

export function ImportCounts({ report }: { readonly report: ImportReport }) {
  const count = report.counts;
  return (
    <View>
      <MetaLabel>
        {report.childName} · {count.total} data rows
      </MetaLabel>
      <Body>
        {count.toImport} to import · {count.newFoods} new Foods
      </Body>
      <Body>
        {count.skipped} skipped ({count.skipped - count.duplicates} already
        tracked, {count.duplicates} duplicates) · {count.failed} failed
      </Body>
      <Body dim>{count.warned} rows with warnings</Body>
    </View>
  );
}
