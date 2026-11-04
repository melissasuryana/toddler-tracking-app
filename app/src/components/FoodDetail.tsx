import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { Food } from "@keepsake/food-tracking";
import { useData } from "~/data/DataProvider";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";
import { Body, Hairline, Masthead, MetaLabel, Orb, Pill } from "./Screen";
import { PillChip } from "./PillChip";
import { introductionHistoryForFood } from "./foodBrowser";

export function FoodDetail({
  food,
  childId,
  onBack,
  onLog,
  onEdit,
  onDelete,
}: {
  readonly food: Food;
  readonly childId: string;
  readonly onBack: () => void;
  readonly onLog: (kind: "introduction" | "reaction", foodId: string) => void;
  readonly onEdit: () => void;
  readonly onDelete: () => boolean;
}) {
  const data = useData();
  const theme = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMarkSafeConfirm, setShowMarkSafeConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const now = Date.now();
  const status = data.foodStatus(childId, food.id, now);
  const resetCounts = data.resetStatusCounts(childId, food.id);
  const pillTint = theme.statusPillTint(status.status);
  const history = introductionHistoryForFood(
    data.foodEntriesForChild(childId),
    food.id,
    now
  );
  const watch = status.watchPeriod;
  const childName = data.child?.name ?? "Child";
  const isSafe = status.status === "safe";
  const isAvoid = status.status === "avoid";
  const canReset = resetCounts.canReset;

  const detailMessage =
    status.status === "trying" && watch
      ? `Watching until ${new Date(watch.endsAt).toLocaleString()}`
      : status.status === "safe"
        ? status.safeReason === "manual"
          ? "Marked safe manually."
          : "The Watch Period ended without a Reaction."
        : status.status === "avoid"
          ? "Avoid for now. A new Introduction can re-challenge this Food."
          : "No Introductions logged for this Child.";

  function markSafeImmediate() {
    try {
      const result = data.markFoodSafe(childId, food.id);
      if (!result) {
        throw new Error("This Food cannot be marked safe.");
      }
      setMessage(`${food.name} marked safe.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Food could not be marked safe."
      );
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <Masthead
        title=""
        emphasis={food.name}
        kicker="Back"
        onKickerPress={onBack}
      />
      {message ? (
        <View
          style={{
            backgroundColor: theme.colors.accentWash,
            borderBottomColor: theme.colors.ruleThin,
            borderBottomWidth: theme.rule.hairline,
            paddingHorizontal: theme.space.page,
            paddingVertical: 10,
          }}
        >
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{
              color: theme.colors.accentInk,
              fontFamily: nativeFonts.sans,
              fontSize: 12,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {message}
          </Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.sheetBlock * 2 }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.paper,
            gap: 8,
            paddingHorizontal: theme.space.page,
            paddingVertical: 20,
          }}
        >
          <Orb
            icon="foods"
            tint={{
              background: pillTint.background,
              foreground: pillTint.foreground,
            }}
            size={58}
            iconSize={26}
          />
          <Pill label={status.status} tint={pillTint} />
          <Text
            style={{
              color: theme.colors.meta,
              fontFamily: nativeFonts.sans,
              fontSize: 11,
              textAlign: "center",
            }}
          >
            {detailMessage}
          </Text>
          <Text
            style={{
              color: theme.colors.ink,
              fontFamily: nativeFonts.serif,
              fontSize: 19,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {status.exposureCount}{" "}
            {status.exposureCount === 1 ? "Introduction" : "Introductions"}
          </Text>
          <Text
            style={{
              color: theme.colors.meta,
              fontFamily: nativeFonts.sans,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            exposure count · Meals don’t count
          </Text>
        </View>

        {/* Dedicated full-width Mark Safe button directly below status summary */}
        <View
          style={{
            paddingHorizontal: theme.space.page,
            paddingBottom: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSafe ? "Marked safe" : "Mark safe"}
            accessibilityState={{ disabled: isSafe || isAvoid }}
            disabled={isSafe || isAvoid}
            onPress={() => {
              if (status.status === "untried") {
                markSafeImmediate();
              } else if (status.status === "trying") {
                setShowMarkSafeConfirm(true);
              }
            }}
            style={({ pressed }) => ({
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              borderRadius: theme.radius.pill,
              backgroundColor:
                isSafe || isAvoid ? "transparent" : theme.colors.ink,
              borderWidth: isSafe || isAvoid ? 1 : 0,
              borderColor:
                isSafe || isAvoid ? theme.colors.chipBorder : "transparent",
              opacity: isSafe || isAvoid ? 0.6 : pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color:
                  isSafe || isAvoid ? theme.colors.meta : theme.colors.paper,
                fontFamily: nativeFonts.sans,
                fontSize: 13,
                fontWeight: "600",
                letterSpacing: 0.3,
              }}
            >
              {isSafe ? "Marked safe" : "Mark safe"}
            </Text>
          </Pressable>
          {isSafe ? (
            <Text
              style={{
                color: theme.colors.meta,
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              {status.safeReason === "manual"
                ? "Already marked safe manually."
                : "Already safe: The Watch Period ended without a Reaction."}
            </Text>
          ) : isAvoid ? (
            <Text
              style={{
                color: theme.colors.meta,
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              Cannot mark safe while in avoid. Log an Introduction to re-challenge.
            </Text>
          ) : null}
        </View>

        {/* Logging actions */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            paddingHorizontal: theme.space.page,
            paddingBottom: 14,
          }}
        >
          <PillChip
            label="Log Introduction"
            selected
            tint={theme.statusPillTint("trying")}
            onPress={() => onLog("introduction", food.id)}
          />
          <PillChip
            label="Log Reaction"
            selected={false}
            tint={theme.statusPillTint("avoid")}
            onPress={() => onLog("reaction", food.id)}
          />
        </View>

        {food.category || food.allergenTags.length ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "center",
              paddingHorizontal: theme.space.page,
              paddingBottom: 12,
            }}
          >
            {food.category ? (
              <PillChip label={food.category} selected={false} />
            ) : null}
            {food.allergenTags.map((tag) => (
              <PillChip
                key={tag}
                label={tag}
                selected={false}
                tint={theme.statusPillTint("avoid")}
              />
            ))}
          </View>
        ) : null}

        <Hairline strong />
        <MetaLabel>Introduction history</MetaLabel>
        {history.length ? (
          history.map((entry) => (
            <View
              key={entry.id}
              style={{
                borderTopColor: theme.colors.ruleThin,
                borderTopWidth: theme.rule.hairline,
                gap: 3,
                paddingHorizontal: theme.space.page,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  color: theme.colors.ink,
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {new Date(entry.occurredAt).toLocaleString()}
                {entry.kind === "introduction" && entry.content.texture
                  ? ` · ${entry.content.texture}`
                  : ""}
              </Text>
              {entry.kind === "introduction" && entry.content.note ? (
                <Body dim>{entry.content.note}</Body>
              ) : null}
            </View>
          ))
        ) : (
          <Body dim>No Introduction history yet.</Body>
        )}

        {food.source === "custom" && status.status === "untried" ? (
          <View
            style={{
              borderTopColor: theme.colors.ruleThin,
              borderTopWidth: theme.rule.hairline,
              flexDirection: "row",
              gap: 8,
              justifyContent: "center",
              marginTop: 18,
              padding: theme.space.page,
            }}
          >
            <PillChip label="Edit Food" selected={false} onPress={onEdit} />
            <PillChip
              label={confirmDelete ? "Keep Food" : "Delete Food"}
              selected={false}
              onPress={() => setConfirmDelete(!confirmDelete)}
            />
          </View>
        ) : null}
        {confirmDelete ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.dangerWash,
              gap: 8,
              marginHorizontal: theme.space.page,
              padding: 12,
            }}
          >
            <Body>Delete {food.name}? This can’t be undone.</Body>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!onDelete()) {
                  setMessage("This Food can only be deleted while untried.");
                }
              }}
              style={{ padding: 8 }}
            >
              <Text
                style={{
                  color: theme.colors.danger,
                  fontFamily: nativeFonts.sans,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                Confirm delete
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Status Reset Section */}
        <View
          style={{
            borderTopColor: theme.colors.ruleThin,
            borderTopWidth: theme.rule.hairline,
            marginTop: 24,
            paddingTop: 18,
            paddingBottom: 12,
            paddingHorizontal: theme.space.page,
            alignItems: "center",
            gap: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset status"
            accessibilityState={{ disabled: !canReset }}
            disabled={!canReset}
            onPress={() => setShowResetConfirm(true)}
            style={({ pressed }) => ({
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: canReset
                ? theme.colors.danger
                : theme.colors.chipBorder,
              backgroundColor: "transparent",
              opacity: !canReset ? 0.4 : pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: canReset ? theme.colors.danger : theme.colors.meta,
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              Reset status
            </Text>
          </Pressable>
          {!canReset ? (
            <Text
              style={{
                color: theme.colors.meta,
                fontFamily: nativeFonts.sans,
                fontSize: 11,
                textAlign: "center",
              }}
            >
              No tracking history to reset.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Mark Safe Confirmation Modal for Trying status */}
      <Modal
        visible={showMarkSafeConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMarkSafeConfirm(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(51, 48, 42, 0.45)",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.colors.sheet,
              borderTopWidth: 2,
              borderTopColor: theme.colors.accent,
              paddingHorizontal: theme.space.page,
              paddingTop: 18,
              paddingBottom: theme.space.page * 1.5,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.serif,
                fontSize: 19,
                fontWeight: "500",
                color: theme.colors.ink,
              }}
            >
              Mark {food.name} safe?
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                lineHeight: 18,
                color: theme.colors.ink,
              }}
            >
              Mark {food.name} safe for {childName}? This will end the current
              Watch Period early.
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep watching"
                onPress={() => setShowMarkSafeConfirm(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: theme.colors.chipBorder,
                  backgroundColor: "transparent",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 12.5,
                    fontWeight: "600",
                    color: theme.colors.ink,
                  }}
                >
                  Keep watching
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark safe"
                onPress={() => {
                  setShowMarkSafeConfirm(false);
                  markSafeImmediate();
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.ink,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 12.5,
                    fontWeight: "600",
                    color: theme.colors.paper,
                  }}
                >
                  Mark safe
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Status Confirmation Modal */}
      <Modal
        visible={showResetConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetConfirm(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(51, 48, 42, 0.45)",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.colors.sheet,
              borderTopWidth: 2,
              borderTopColor: theme.colors.danger,
              paddingHorizontal: theme.space.page,
              paddingTop: 18,
              paddingBottom: theme.space.page * 1.5,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              gap: 10,
            }}
          >
            <Text
              style={{
                fontFamily: nativeFonts.serif,
                fontSize: 19,
                fontWeight: "500",
                color: theme.colors.danger,
              }}
            >
              Reset {food.name} status?
            </Text>
            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                lineHeight: 18,
                color: theme.colors.ink,
              }}
            >
              Resetting will revert{" "}
              <Text style={{ fontWeight: "700" }}>{food.name}</Text> to untried
              for {childName}.
            </Text>

            <View
              style={{
                backgroundColor: theme.colors.paper,
                borderRadius: 8,
                padding: 12,
                gap: 6,
                borderWidth: 1,
                borderColor: theme.colors.ruleThin,
              }}
            >
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 11.5,
                  color: theme.colors.ink,
                  lineHeight: 16,
                }}
              >
                •{" "}
                <Text style={{ fontWeight: "600" }}>
                  {resetCounts.introductionCount}
                </Text>{" "}
                {resetCounts.introductionCount === 1
                  ? "Introduction"
                  : "Introductions"}{" "}
                will be permanently deleted.
              </Text>
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 11.5,
                  color: theme.colors.ink,
                  lineHeight: 16,
                }}
              >
                •{" "}
                <Text style={{ fontWeight: "600" }}>
                  {resetCounts.singleReactionCount}
                </Text>{" "}
                single-Food{" "}
                {resetCounts.singleReactionCount === 1
                  ? "Reaction"
                  : "Reactions"}{" "}
                will be permanently deleted.
              </Text>
              <Text
                style={{
                  fontFamily: nativeFonts.sans,
                  fontSize: 11.5,
                  color: theme.colors.ink,
                  lineHeight: 16,
                }}
              >
                •{" "}
                <Text style={{ fontWeight: "600" }}>
                  {resetCounts.sharedReactionCount}
                </Text>{" "}
                shared{" "}
                {resetCounts.sharedReactionCount === 1 ? "Reaction" : "Reactions"}{" "}
                will have {food.name} removed, preserving other foods and their
                avoid status.
              </Text>
            </View>

            <Text
              style={{
                fontFamily: nativeFonts.sans,
                fontSize: 12,
                lineHeight: 18,
                color: theme.colors.ink,
              }}
            >
              <Text style={{ fontWeight: "700" }}>This can't be undone.</Text>{" "}
              The tracking history will be permanently wiped.
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 8,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep status"
                onPress={() => setShowResetConfirm(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: theme.colors.chipBorder,
                  backgroundColor: "transparent",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 12.5,
                    fontWeight: "600",
                    color: theme.colors.ink,
                  }}
                >
                  Keep status
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset status"
                onPress={() => {
                  try {
                    data.resetFoodStatus(childId, food.id);
                    setMessage(`${food.name} status reset to untried.`);
                    setShowResetConfirm(false);
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Status could not be reset."
                    );
                    setShowResetConfirm(false);
                  }
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.danger,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: nativeFonts.sans,
                    fontSize: 12.5,
                    fontWeight: "600",
                    color: "#FFF6EF",
                  }}
                >
                  Reset status
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

