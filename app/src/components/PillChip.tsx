/**
 * Pill chip — the Ledger's selection control: pill radius, tinted fill/border
 * from a PillTint token (accentChip when idle, safeChip-style tints when the
 * caller supplies one). Used by the onboarding prompts and Settings.
 */
import { Pressable, Text } from "react-native";
import type { PillTint } from "@keepsake/design-system";
import { useTheme } from "../theme/ThemeProvider";
import { nativeFonts } from "../theme/tokens";

export function PillChip({
  label,
  selected,
  onPress,
  disabled = false,
  tint,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  /** Overrides the idle/selected tint (defaults: chipBorder idle, accentChip selected). */
  readonly tint?: PillTint;
}) {
  const theme = useTheme();
  const active = tint ?? theme.colors.accentChip;
  const background = selected ? active.background : "transparent";
  const border = selected ? active.border : theme.colors.chipBorder;
  const foreground = selected ? active.foreground : theme.colors.meta;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.accentWash : background,
        borderColor: border,
        borderWidth: theme.rule.hairline,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.space.rowBlock + 4,
        paddingVertical: theme.space.rowBlock / 2,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text
        style={{
          color: foreground,
          fontFamily: nativeFonts.sans,
          fontSize: theme.typography.body.fontSize,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
