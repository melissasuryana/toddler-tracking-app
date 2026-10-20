/**
 * App-only entry point: the expo-sqlite adapter. Kept out of `index.ts` so
 * the engine-agnostic surface stays importable in plain Node test runners.
 */
export { DATABASE_NAME, openAppDatabase } from "./lib/expo.ts";
