/**
 * TypeScript fallback for `./session` — Metro never loads this file (it
 * resolves the platform variants), but tsc does. It re-exports the native
 * implementation, which matches the web one symbol-for-symbol.
 */
export { SessionProvider, useData } from "./session.native";
