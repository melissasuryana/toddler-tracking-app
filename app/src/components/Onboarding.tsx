/**
 * First-run onboarding (issue #43): the ONLY UI reachable before a Child
 * exists. Creates the Child (name required, birthdate required and nonfuture,
 * sex required for growth charts, photo optional) and asks the temperature-
 * unit prompt with °C preselected as the explicit default. Vocabulary follows
 * CONTEXT.md — "Child", never kid/baby/profile.
 */
import {
  CHILD_SEXES,
  DEFAULT_TEMPERATURE_UNIT,
  TEMPERATURE_UNITS,
  formatTemperatureUnit,
  isIsoDate,
  todayIsoDate,
  validateChildInput,
  type ChildFieldError,
  type ChildSex,
  type TemperatureUnit,
} from "@keepsake/local-data";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useData } from "../data/DataProvider";
import { pickChildPhoto } from "../data/photo";
import { useTheme } from "../theme/ThemeProvider";
import { nativeFonts } from "../theme/tokens";
import { PillChip } from "./PillChip";
import { Body, Hairline, MetaLabel, Screen, ScreenTitle } from "./Screen";

function FieldError({ message }: { readonly message: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.danger,
        fontFamily: nativeFonts.sans,
        fontSize: theme.typography.small.fontSize,
      }}
    >
      {message}
    </Text>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.space.page,
        paddingVertical: theme.space.rowBlock,
        gap: theme.space.fieldGap,
      }}
    >
      <Text
        style={{
          color: theme.colors.meta,
          fontFamily: nativeFonts.sans,
          fontSize: theme.typography.meta.fontSize,
          fontWeight: String(theme.typography.meta.fontWeight) as "600",
          letterSpacing:
            theme.typography.meta.letterSpacingEm *
            theme.typography.meta.fontSize,
          textTransform: theme.typography.meta.textTransform,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Onboarding() {
  const theme = useTheme();
  const data = useData();
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [sex, setSex] = useState<ChildSex | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [unit, setUnit] = useState<TemperatureUnit>(DEFAULT_TEMPERATURE_UNIT);
  const [errors, setErrors] = useState<readonly ChildFieldError[]>([]);
  const [picking, setPicking] = useState(false);

  const errorFor = (field: ChildFieldError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;

  const submit = () => {
    const result = validateChildInput(
      { name, birthdate, sex: sex ?? ("" as ChildSex), photo },
      todayIsoDate()
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    data.setTemperatureUnit(unit);
    data.createChild(result.value);
  };

  const choosePhoto = async () => {
    setPicking(true);
    try {
      const picked = await pickChildPhoto();
      if (picked) setPhoto(picked);
    } finally {
      setPicking(false);
    }
  };

  const inputStyle = {
    color: theme.colors.ink,
    fontFamily: nativeFonts.sans,
    fontSize: theme.typography.body.fontSize,
    backgroundColor: theme.colors.sheet,
    borderColor: theme.colors.chipBorder,
    borderWidth: theme.rule.hairline,
    paddingHorizontal: theme.space.rowBlock,
    paddingVertical: theme.space.rowBlock,
  } as const;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <ScreenTitle>Welcome</ScreenTitle>
          <MetaLabel>Set up your Child</MetaLabel>
          <View style={{ paddingHorizontal: theme.space.page }}>
            <Body dim>
              Before any tracking, create your Child. Everything stays on this
              device — no account, no network.
            </Body>
          </View>

          <Field label="Name (required)">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Child's name"
              placeholderTextColor={theme.colors.meta}
              style={inputStyle}
              autoFocus
            />
            {errorFor("name") ? (
              <FieldError message={errorFor("name")!} />
            ) : null}
          </Field>

          <Field label="Birthdate (required, YYYY-MM-DD)">
            <TextInput
              value={birthdate}
              onChangeText={setBirthdate}
              placeholder={todayIsoDate()}
              placeholderTextColor={theme.colors.meta}
              style={inputStyle}
              keyboardType="numbers-and-punctuation"
              autoComplete="birthdate-full"
            />
            {birthdate.length > 0 && !isIsoDate(birthdate) ? (
              <FieldError message="Use a real date: YYYY-MM-DD." />
            ) : null}
            {errorFor("birthdate") ? (
              <FieldError message={errorFor("birthdate")!} />
            ) : null}
          </Field>

          <Field label="Sex (required — for growth charts)">
            <View style={{ flexDirection: "row", gap: theme.space.rowGap }}>
              {CHILD_SEXES.map((option) => (
                <PillChip
                  key={option}
                  label={option === "female" ? "Female" : "Male"}
                  selected={sex === option}
                  onPress={() => setSex(option)}
                />
              ))}
            </View>
            {errorFor("sex") ? <FieldError message={errorFor("sex")!} /> : null}
          </Field>

          <Field label="Photo (optional)">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.space.rowGap,
              }}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={{
                    width: theme.size.avatar,
                    height: theme.size.avatar,
                    borderRadius: theme.radius.pill,
                  }}
                />
              ) : null}
              <PillChip
                label={
                  picking ? "Opening…" : photo ? "Change photo" : "Add photo"
                }
                selected={false}
                onPress={choosePhoto}
                disabled={picking}
              />
            </View>
          </Field>

          <Hairline style={{ marginVertical: theme.space.rowBlock }} />

          <Field label="Temperature unit">
            <View style={{ flexDirection: "row", gap: theme.space.rowGap }}>
              {TEMPERATURE_UNITS.map((option) => (
                <PillChip
                  key={option}
                  label={formatTemperatureUnit(option)}
                  selected={unit === option}
                  onPress={() => setUnit(option)}
                />
              ))}
            </View>
            <Body dim>
              °C is the default. This sets the unit for new temperature Entries;
              you can change it later in Settings.
            </Body>
          </Field>

          <View
            style={{
              paddingHorizontal: theme.space.page,
              paddingVertical: theme.space.sheetBlock,
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              style={({ pressed }) => ({
                backgroundColor: pressed
                  ? theme.colors.accentInk
                  : theme.colors.accent,
                borderRadius: theme.radius.pill,
                paddingVertical: theme.space.buttonInset,
                alignItems: "center",
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
                Create Child
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
