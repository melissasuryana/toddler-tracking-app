import type { MealEntryInput } from "@keepsake/food-tracking";

export type FoodDraftKind = "meal" | "introduction" | "reaction";

export interface FoodDrafts {
  readonly revisions: Readonly<Record<FoodDraftKind, number>>;
  readonly started: readonly FoodDraftKind[];
  readonly contextualFoods: Readonly<Partial<Record<FoodDraftKind, string>>>;
  readonly mealPrefill?: MealEntryInput;
}

export const EMPTY_FOOD_DRAFTS: FoodDrafts = {
  revisions: { meal: 0, introduction: 0, reaction: 0 },
  started: [],
  contextualFoods: {},
};

export type FoodDraftAction =
  | {
      readonly type: "open";
      readonly kind: FoodDraftKind;
      readonly foodId?: string;
    }
  | { readonly type: "saved"; readonly kind: FoodDraftKind }
  | {
      readonly type: "meal-shortcut";
      readonly draft: MealEntryInput;
      readonly preserveIntroductionDraft?: boolean;
    };

/** Cancel and tab changes do not discard a draft; only an explicit save resets it. */
export function foodDraftsReducer(
  state: FoodDrafts,
  action: FoodDraftAction
): FoodDrafts {
  if (action.type === "open") {
    const changingContext =
      action.foodId !== undefined &&
      state.contextualFoods[action.kind] !== action.foodId;
    return {
      ...state,
      started: [...new Set([...state.started, action.kind])],
      revisions: changingContext
        ? {
            ...state.revisions,
            [action.kind]: state.revisions[action.kind] + 1,
          }
        : state.revisions,
      contextualFoods: action.foodId
        ? { ...state.contextualFoods, [action.kind]: action.foodId }
        : state.contextualFoods,
    };
  }
  if (action.type === "meal-shortcut") {
    return {
      ...state,
      started: [
        ...new Set<FoodDraftKind>([
          ...state.started.filter(
            (kind) =>
              kind !== "introduction" || action.preserveIntroductionDraft
          ),
          "meal",
        ]),
      ],
      revisions: {
        ...state.revisions,
        introduction:
          state.revisions.introduction +
          (action.preserveIntroductionDraft ? 0 : 1),
        meal: state.revisions.meal + 1,
      },
      contextualFoods: action.preserveIntroductionDraft
        ? state.contextualFoods
        : { ...state.contextualFoods, introduction: undefined },
      mealPrefill: action.draft,
    };
  }
  return {
    ...state,
    started: state.started.filter((kind) => kind !== action.kind),
    revisions: {
      ...state.revisions,
      [action.kind]: state.revisions[action.kind] + 1,
    },
    contextualFoods: { ...state.contextualFoods, [action.kind]: undefined },
    mealPrefill: action.kind === "meal" ? undefined : state.mealPrefill,
  };
}
