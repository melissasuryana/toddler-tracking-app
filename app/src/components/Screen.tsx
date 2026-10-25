/**
 * Keepsake screen scaffolding — the Ledger grid look from
 * prototypes/mvp-end-to-end.html and docs/design/design-directions.html#dir-d:
 * paper background, serif display heading, uppercase meta labels, hairline
 * rules, strict page margin. Every value resolves to a design-system token via
 * useTheme().
 */
import type { ReactNode } from "react";
import type {
  DiscTint,
  IconName,
  PillTint,
  TrackerKey,
} from "@keepsake/design-system";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { nativeFonts } from "../theme/tokens";
import { KeepsakeIcon } from "./KeepsakeIcon";

/** Paper background with safe-area padding. Wraps every screen. */
export function Screen({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.fill,
        {
          backgroundColor: theme.colors.paper,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Direction D masthead: serif display heading with terracotta italic emphasis + kicker. */
export function Masthead({
  title,
  emphasis,
  suffix = "",
  kicker,
  onKickerPress,
}: {
  readonly title?: string;
  readonly emphasis?: string;
  readonly suffix?: string;
  readonly kicker?: string;
  readonly onKickerPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <View>
      <View
        style={{
          paddingHorizontal: theme.space.page,
          paddingTop: 10,
          paddingBottom: 12,
          backgroundColor: theme.colors.paper,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Text
          style={{
            fontFamily: nativeFonts.serif,
            fontSize: theme.typography.display.fontSize,
            fontWeight: String(theme.typography.display.fontWeight) as "500",
            letterSpacing: -0.26,
            color: theme.colors.ink,
            flexShrink: 1,
          }}
        >
          {title}
          {emphasis ? (
            <Text style={{ fontStyle: "italic", color: theme.colors.accent }}>
              {emphasis}
            </Text>
          ) : null}
          {suffix}
        </Text>
        {kicker ? (
          onKickerPress ? (
            <Pressable onPress={onKickerPress} accessibilityRole="button">
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: theme.typography.meta.fontSize,
                  fontWeight: String(theme.typography.meta.fontWeight) as "600",
                  letterSpacing:
                    theme.typography.meta.letterSpacingEm *
                    theme.typography.meta.fontSize,
                  textTransform: theme.typography.meta.textTransform,
                  color: theme.colors.accent,
                  marginLeft: 8,
                }}
              >
                {kicker}
              </Text>
            </Pressable>
          ) : (
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: theme.typography.meta.fontSize,
                fontWeight: String(theme.typography.meta.fontWeight) as "600",
                letterSpacing:
                  theme.typography.meta.letterSpacingEm *
                  theme.typography.meta.fontSize,
                textTransform: theme.typography.meta.textTransform,
                color: theme.colors.meta,
                marginLeft: 8,
              }}
            >
              {kicker}
            </Text>
          )
        ) : null}
      </View>
      <Hairline strong />
    </View>
  );
}

/** Direction D 36px icon disc (.d-orb) */
export function Orb({
  icon,
  tracker,
  tint,
  size = 36,
  iconSize = 17,
}: {
  readonly icon: IconName;
  readonly tracker?: TrackerKey;
  readonly tint?: DiscTint;
  readonly size?: number;
  readonly iconSize?: number;
}) {
  const theme = useTheme();
  const resolvedTint =
    tint ??
    (tracker
      ? theme.discTint(tracker)
      : { background: theme.colors.paper, foreground: theme.colors.ink });
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        backgroundColor: resolvedTint.background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <KeepsakeIcon
        name={icon}
        color={resolvedTint.foreground}
        size={iconSize}
      />
    </View>
  );
}

/** Direction D uppercase section header (.d-section) */
export function SectionHeader({ title }: { readonly title: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: nativeFonts.sans,
        fontSize: 10,
        fontWeight: "600",
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: theme.colors.meta,
        paddingHorizontal: theme.space.page,
        paddingTop: 12,
        paddingBottom: 6,
      }}
    >
      {title}
    </Text>
  );
}

/** Direction D quiet ledger row (.d-row) */
export function LedgerRow({
  icon,
  tracker,
  tint,
  title,
  subtitle,
  right,
  onPress,
}: {
  readonly icon?: IconName;
  readonly tracker?: TrackerKey;
  readonly tint?: DiscTint;
  readonly title: string;
  readonly subtitle?: string;
  readonly right?: ReactNode;
  readonly onPress?: () => void;
}) {
  const theme = useTheme();
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: theme.space.page,
        paddingVertical: 10,
        gap: 12,
        borderTopWidth: theme.rule.hairline,
        borderTopColor: theme.colors.ruleThin,
        backgroundColor: theme.colors.paper,
      }}
    >
      {icon ? <Orb icon={icon} tracker={tracker} tint={tint} /> : null}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 13,
            fontWeight: "600",
            color: theme.colors.ink,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 10.5,
              color: theme.colors.meta,
              marginTop: 1,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

/** Direction D status pill (.d-pill) */
export function Pill({
  label,
  tint,
}: {
  readonly label: string;
  readonly tint: PillTint;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        backgroundColor: tint.background,
        borderColor: tint.border,
        borderWidth: theme.rule.hairline,
      }}
    >
      <Text
        style={{
          fontFamily: nativeFonts.sans,
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.72,
          textTransform: "uppercase",
          color: tint.foreground,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Serif display heading — the Keepsake voice (typography.display). */
export function ScreenTitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.ink,
        fontFamily: nativeFonts.serif,
        fontSize: theme.typography.display.fontSize,
        fontWeight: String(theme.typography.display.fontWeight) as "500",
        paddingHorizontal: theme.space.page,
        paddingTop: theme.space.sheetBlock,
      }}
    >
      {children}
    </Text>
  );
}

/** Uppercase meta label — section headers like "Preferences" / "Data". */
export function MetaLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const meta = theme.typography.meta;
  return (
    <Text
      style={{
        color: theme.colors.meta,
        fontFamily: nativeFonts.sans,
        fontSize: meta.fontSize,
        fontWeight: String(meta.fontWeight) as "600",
        letterSpacing: meta.letterSpacingEm * meta.fontSize,
        textTransform: meta.textTransform,
        paddingHorizontal: theme.space.page,
        paddingTop: theme.space.sheetBlock,
        paddingBottom: theme.space.fieldGap,
      }}
    >
      {children}
    </Text>
  );
}

/** Hairline rule — the Ledger bones (rule.hairline, ruleThin ink). */
export function Hairline({
  strong = false,
  style,
}: {
  readonly strong?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          height: theme.rule.hairline,
          backgroundColor: strong
            ? theme.colors.ruleStrong
            : theme.colors.ruleThin,
        },
        style,
      ]}
    />
  );
}

/** A ledger row: sheet background, hairline rule below, page-margin padding. */
export function Row({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View>
      <View
        style={{
          backgroundColor: theme.colors.sheet,
          paddingHorizontal: theme.space.page,
          paddingVertical: theme.space.rowBlock,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.space.rowGap,
        }}
      >
        {children}
      </View>
      <Hairline />
    </View>
  );
}

/** Body text in the ledger's sans voice. */
export function Body({
  children,
  dim = false,
}: {
  readonly children: ReactNode;
  readonly dim?: boolean;
}) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: dim ? theme.colors.meta : theme.colors.ink,
        fontFamily: nativeFonts.sans,
        fontSize: theme.typography.body.fontSize,
        flexShrink: 1,
      }}
    >
      {children}
    </Text>
  );
}

/** Quiet, illustrated empty state using the same tracker disc as ledger rows. */
export function EmptyState({
  icon,
  tracker,
  title,
  description,
}: {
  readonly icon: IconName;
  readonly tracker: TrackerKey;
  readonly title: string;
  readonly description: string;
}) {
  const theme = useTheme();
  const tint = theme.discTint(tracker);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: theme.space.page * 2,
        gap: theme.space.rowGap,
      }}
    >
      <View
        style={{
          width: theme.size.avatar,
          height: theme.size.avatar,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.pill,
          backgroundColor: tint.background,
        }}
      >
        <KeepsakeIcon name={icon} color={tint.foreground} />
      </View>
      <Text
        style={{
          color: theme.colors.ink,
          fontFamily: nativeFonts.serif,
          fontSize: theme.typography.sheetTitle.fontSize,
          fontWeight: String(theme.typography.sheetTitle.fontWeight) as "500",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.meta,
          fontFamily: nativeFonts.sans,
          fontSize: theme.typography.body.fontSize,
          textAlign: "center",
          lineHeight: theme.typography.body.fontSize * 1.5,
        }}
      >
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
