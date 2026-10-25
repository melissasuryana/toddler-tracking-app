/**
 * Keepsake screen scaffolding — the Ledger grid look from
 * prototypes/mvp-end-to-end.html: paper background, serif display heading,
 * uppercase meta labels, hairline rules, strict page margin. Every value
 * resolves to a design-system token via useTheme().
 */
import type { ReactNode } from "react";
import type { IconName, TrackerKey } from "@keepsake/design-system";
import {
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
export function Screen({ children }: { children: ReactNode }) {
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
      ]}
    >
      {children}
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
