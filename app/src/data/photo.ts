/**
 * Child photo handling: the picker returns a cache path that can be wiped by
 * the OS, so the selected image is copied into app document storage and the
 * Child record keeps the stable app-absolute path (CONTEXT.md: photo optional).
 *
 * Native-only: expo-file-system's new File/Directory API has no web
 * implementation, so both modules are imported lazily and photo picking
 * quietly reports "unavailable" off-device (the field is optional).
 */
import { Platform } from "react-native";

/**
 * Opens the image picker and persists the choice. Returns the stored file
 * path, or null when the caregiver cancels or photos are unavailable (web).
 */
export async function pickChildPhoto(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }
  const ImagePicker = await import("expo-image-picker");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  if (!asset) return null;

  const { Directory, File, Paths } = await import("expo-file-system");
  const photosDir = new Directory(Paths.document, "photos");
  if (!photosDir.exists) {
    photosDir.create({ intermediates: true, idempotent: true });
  }
  const source = new File(asset.uri);
  const target = new File(photosDir, `child-${Date.now()}.jpg`);
  source.copy(target);
  return target.uri;
}
