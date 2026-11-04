export type FoodStatusName = "untried" | "trying" | "safe" | "avoid";

export interface FoodWatchPeriod {
  readonly openingIntroductionId: string;
  readonly startedAt: number;
  readonly endsAt: number;
}

export type IntroductionHeadsUpKind =
  "overlapping-introductions" | "first-allergen-food";

export interface IntroductionHeadsUp {
  readonly kind: IntroductionHeadsUpKind;
  readonly foodId: string;
}

export interface ResetStatusCounts {
  readonly introductionCount: number;
  readonly singleReactionCount: number;
  readonly sharedReactionCount: number;
  readonly hasManualSafeDecision: boolean;
  readonly canReset: boolean;
}

