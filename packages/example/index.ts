import { formatGreeting } from "./lib/impl.ts";

export function greet(name: string): string {
  return formatGreeting(name);
}
