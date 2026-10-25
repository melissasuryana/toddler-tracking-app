import { Modal, View } from "react-native";
import { Body } from "./Screen";
import { PillChip } from "./PillChip";
import { useTheme } from "~/theme/ThemeProvider";

export function DeleteEntryConfirm({
  visible,
  onKeep,
  onDelete,
}: {
  readonly visible: boolean;
  readonly onKeep: () => void;
  readonly onDelete: () => void;
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
        accessibilityViewIsModal
        style={{
          flex: 1,
          justifyContent: "center",
          padding: theme.space.page,
          backgroundColor: theme.colors.paper,
          gap: theme.space.sheetBlock,
        }}
      >
        <Body>This can't be undone</Body>
        <Body>Delete this Entry permanently?</Body>
        <PillChip label="Keep it" selected={false} onPress={onKeep} />
        <PillChip label="Delete permanently" selected onPress={onDelete} />
      </View>
    </Modal>
  );
}
