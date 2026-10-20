/**
 * Web stub for expo-sqlite: the app targets iOS and never opens the database
 * off-device (session.web.tsx replaces it), but Metro still resolves the
 * import graph for web bundles. These throw only if actually called.
 */
export function openDatabaseSync(): never {
  throw new Error("expo-sqlite is unavailable on web; the app targets iOS.");
}
