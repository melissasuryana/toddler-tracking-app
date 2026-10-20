/**
 * Platform-neutral re-exports for the data session. Metro resolves
 * `./session` to session.web.tsx (web) or session.native.tsx (native);
 * TypeScript reads the native file (both expose the same surface).
 */
export { SessionProvider, useData } from "./session";
export type { DataSession } from "./session.types";
