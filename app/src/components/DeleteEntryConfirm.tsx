import { Modal, Pressable, Text, View } from "react-native";
import { useTheme } from "~/theme/ThemeProvider";
import { nativeFonts } from "~/theme/tokens";

export function DeleteEntryConfirm({
  visible,
  onKeep,
  onDelete,
  title = "Delete this entry?",
  description,
}: {
  readonly visible: boolean;
  readonly onKeep: () => void;
  readonly onDelete: () => void;
  readonly title?: string;
  readonly description?: string;
}) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeep}
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
            gap: 8,
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
            {title}
          </Text>

          <Text
            style={{
              fontFamily: nativeFonts.sans,
              fontSize: 12,
              lineHeight: 18,
              color: theme.colors.ink,
            }}
          >
            {description ? (
              <>
                {description}
                {"\n\n"}
              </>
            ) : null}
            <Text style={{ fontWeight: "bold" }}>This can't be undone.</Text>{" "}
            The content is wiped for good — there is no Recently Deleted view
            and no restore.
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
              accessibilityLabel="Keep it"
              onPress={onKeep}
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
                Keep it
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete forever"
              onPress={onDelete}
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
                Delete forever
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
