export function formatGreeting(name: string): string {
  const recipient = name.trim() || "there";
  return `Hello, ${recipient}!`;
}
