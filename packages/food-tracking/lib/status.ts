import type {
  Entry,
  LocalTransaction,
  ManualSafeMarker,
} from "@keepsake/local-data";
import type { FoodStatusName, FoodWatchPeriod } from "./types.ts";

const WATCH_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

export interface FoodEvidence {
  readonly entry: Entry;
  readonly kind: "introduction" | "reaction";
}

export interface FoodStatusResult {
  readonly foodId: string;
  readonly status: FoodStatusName;
  readonly exposureCount: number;
  readonly watchPeriod: FoodWatchPeriod | null;
  readonly safeReason: "watch-expired" | "manual" | null;
}

export function deriveFoodStatus(
  foodId: string,
  entries: readonly Entry[],
  associationsFor: (entryId: string) => readonly {
    associationType: string;
    associatedId: string;
  }[],
  marker: ManualSafeMarker | null,
  now: number
): FoodStatusResult {
  const evidence: FoodEvidence[] = [];
  for (const entry of entries) {
    if (entry.kind !== "introduction" && entry.kind !== "reaction") continue;
    if (
      associationsFor(entry.id).some(
        ({ associationType, associatedId }) =>
          associationType === "food" && associatedId === foodId
      )
    ) {
      evidence.push({ entry, kind: entry.kind });
    }
  }
  evidence.sort(compareEvidence);

  let status: FoodStatusName = "untried";
  let watchPeriod: FoodWatchPeriod | null = null;
  let safeReason: FoodStatusResult["safeReason"] = null;
  let exposureCount = 0;

  for (const { entry, kind } of evidence) {
    if (
      status === "trying" &&
      watchPeriod !== null &&
      entry.occurredAt >= watchPeriod.endsAt
    ) {
      status = "safe";
      safeReason = "watch-expired";
      watchPeriod = null;
    }
    if (kind === "introduction") {
      exposureCount += 1;
      if (status === "untried" || status === "avoid") {
        status = "trying";
        safeReason = null;
        watchPeriod = {
          openingIntroductionId: entry.id,
          startedAt: entry.occurredAt,
          endsAt: entry.occurredAt + WATCH_PERIOD_MS,
        };
      }
    } else {
      status = "avoid";
      safeReason = null;
      watchPeriod = null;
    }
  }

  if (
    status === "trying" &&
    watchPeriod !== null &&
    now >= watchPeriod.endsAt
  ) {
    status = "safe";
    safeReason = "watch-expired";
    watchPeriod = null;
  } else if (
    status === "trying" &&
    watchPeriod !== null &&
    marker?.foodId === foodId &&
    marker.cycleEntryId === watchPeriod.openingIntroductionId
  ) {
    status = "safe";
    safeReason = "manual";
    watchPeriod = null;
  }

  return { foodId, status, exposureCount, watchPeriod, safeReason };
}

function compareEvidence(left: FoodEvidence, right: FoodEvidence): number {
  return (
    left.entry.occurredAt - right.entry.occurredAt ||
    Number(left.kind === "reaction") - Number(right.kind === "reaction") ||
    left.entry.createdAt - right.entry.createdAt ||
    (left.entry.id < right.entry.id
      ? -1
      : left.entry.id > right.entry.id
        ? 1
        : 0)
  );
}

export function statusFor(
  transaction: Pick<LocalTransaction, "entries" | "foods">,
  childId: string,
  foodId: string,
  now: number
): FoodStatusResult {
  const entries = transaction.entries
    .listForChild(childId)
    .filter((entry) => entry.occurredAt <= now);
  return deriveFoodStatus(
    foodId,
    entries,
    (entryId) => transaction.entries.associationsFor(entryId),
    transaction.foods.manualSafeMarker(childId, foodId),
    now
  );
}

export function foodIdsInHistory(
  transaction: Pick<LocalTransaction, "entries">,
  childId: string
): string[] {
  return [
    ...new Set(
      transaction.entries
        .listForChild(childId)
        .filter(
          (entry) => entry.kind === "introduction" || entry.kind === "reaction"
        )
        .flatMap((entry) =>
          transaction.entries
            .associationsFor(entry.id)
            .filter((association) => association.associationType === "food")
            .map((association) => association.associatedId)
        )
    ),
  ];
}
