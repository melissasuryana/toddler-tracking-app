import { useState, useRef, useCallback } from "react";
import {
  AccessibilityActionEvent,
  GestureResponderEvent,
  LayoutChangeEvent,
  Text,
  View,
} from "react-native";
import { nativeFonts } from "~/theme/tokens";
import { useTheme } from "~/theme/ThemeProvider";

export interface SteppedSliderStepInfo {
  readonly val: number;
  readonly label: string;
  readonly pct: string;
  readonly sub?: string;
}

export const DEFAULT_MEAL_AMOUNT_STEPS: readonly SteppedSliderStepInfo[] = [
  { val: 1, label: "Tasted", pct: "10%", sub: "A tiny nibble / lick" },
  { val: 2, label: "Little", pct: "25%", sub: "A few bites (< 25%)" },
  { val: 3, label: "Half", pct: "50%", sub: "About half eaten (~50%)" },
  { val: 4, label: "Most", pct: "75%", sub: "Ate most of the plate (~75%)" },
  { val: 5, label: "Clean plate", pct: "100%", sub: "Finished everything! (100%)" },
];

export interface SteppedSliderProps {
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly steps?: readonly SteppedSliderStepInfo[];
  readonly label?: string;
  readonly leftLabel?: string;
  readonly middleLabel?: string;
  readonly rightLabel?: string;
  readonly onChange: (value: number) => void;
}

export function SteppedSlider({
  value,
  min = 1,
  max = 5,
  steps = DEFAULT_MEAL_AMOUNT_STEPS,
  label = "How much eaten",
  leftLabel = "Bite (1)",
  middleLabel = "Half (3)",
  rightLabel = "Clean plate (5)",
  onChange,
}: SteppedSliderProps) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const trackRef = useRef<View>(null);

  const clampedValue = Math.max(min, Math.min(max, value));
  const currentStep = steps.find((s) => s.val === clampedValue) ?? {
    val: clampedValue,
    label: `${clampedValue}`,
    pct: `${Math.round(((clampedValue - min) / (max - min)) * 100)}%`,
  };

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      setTrackWidth(width);
    }
  }, []);

  const updateFromPosition = useCallback(
    (locationX: number) => {
      if (trackWidth <= 0) return;
      const fraction = Math.max(0, Math.min(1, locationX / trackWidth));
      const stepIndex = Math.round(fraction * (max - min));
      const newValue = min + stepIndex;
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [trackWidth, min, max, value, onChange]
  );

  const handleResponder = (e: GestureResponderEvent) => {
    updateFromPosition(e.nativeEvent.locationX);
  };

  const handleAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === "increment" && clampedValue < max) {
      onChange(clampedValue + 1);
    } else if (e.nativeEvent.actionName === "decrement" && clampedValue > min) {
      onChange(clampedValue - 1);
    }
  };

  const activeFraction = (clampedValue - min) / (max - min);

  return (
    <View style={{ gap: 6, marginVertical: 4 }}>
      {/* Header Label Row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: theme.colors.meta,
          }}
        >
          {label}
        </Text>
        <View
          style={{
            backgroundColor: theme.colors.safeChip.background,
            borderColor: theme.colors.safeChip.border,
            borderWidth: theme.rule.hairline,
            borderRadius: theme.radius.pill,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 11,
              fontWeight: "700",
              color: theme.colors.safeChip.foreground,
            }}
          >
            {clampedValue} of {max} · {currentStep.label} ({currentStep.pct})
          </Text>
        </View>
      </View>

      {/* Slider Interactive Track Container */}
      <View
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          min,
          max,
          now: clampedValue,
          text: `${clampedValue} of ${max}, ${currentStep.label}`,
        }}
        accessibilityActions={[
          { name: "increment", label: "Increase amount" },
          { name: "decrement", label: "Decrease amount" },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleResponder}
        onResponderMove={handleResponder}
        style={{
          height: 40,
          justifyContent: "center",
          cursor: "pointer" as never,
        }}
      >
        <View
          ref={trackRef}
          onLayout={handleLayout}
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.paper,
            borderColor: theme.colors.chipBorder,
            borderWidth: theme.rule.hairline,
            position: "relative",
            justifyContent: "center",
          }}
        >
          {/* Active Filled Bar */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${activeFraction * 100}%`,
              backgroundColor: theme.colors.safeChip.border,
              borderRadius: 4,
            }}
          />

          {/* Tick Dots for Steps */}
          {Array.from({ length: max - min + 1 }, (_, i) => {
            const stepVal = min + i;
            const fraction = i / (max - min);
            const isFilled = stepVal <= clampedValue;
            return (
              <View
                key={stepVal}
                style={{
                  position: "absolute",
                  left: `${fraction * 100}%`,
                  marginLeft: -3,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isFilled
                    ? theme.colors.safeChip.foreground
                    : theme.colors.chipBorder,
                }}
              />
            );
          })}

          {/* Draggable/Tappable Thumb */}
          <View
            style={{
              position: "absolute",
              left: `${activeFraction * 100}%`,
              marginLeft: -13,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.colors.sheet,
              borderColor: theme.colors.safeChip.foreground,
              borderWidth: 2.5,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 3,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.colors.safeChip.foreground,
              }}
            />
          </View>
        </View>
      </View>

      {/* Subtitle / Range Scale Meta Row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 2,
        }}
      >
        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 11,
            color: theme.colors.meta,
          }}
        >
          {leftLabel}
        </Text>
        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 11,
            color: theme.colors.meta,
          }}
        >
          {middleLabel}
        </Text>
        <Text
          style={{
            fontFamily: nativeFonts.sans,
            fontSize: 11,
            color: theme.colors.meta,
          }}
        >
          {rightLabel}
        </Text>
      </View>
    </View>
  );
}
