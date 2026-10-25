/** Foods — the per-Food status browser. */
import { Hairline, Screen, ScreenTitle, EmptyState } from "~/components/Screen";

export default function FoodsScreen() {
  return (
    <Screen>
      <ScreenTitle>The food journal</ScreenTitle>
      <Hairline />
      <EmptyState
        icon="foods"
        tracker="meal"
        title="Your food journal"
        description="Foods and their current status will live here, together in one quiet place."
      />
    </Screen>
  );
}
