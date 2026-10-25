/** Timeline — every Entry in reverse chronological order. */
import { EmptyState, Hairline, Screen, ScreenTitle } from "~/components/Screen";

export default function TimelineScreen() {
  return (
    <Screen>
      <ScreenTitle>Timeline</ScreenTitle>
      <Hairline />
      <EmptyState
        icon="timeline"
        tracker="feed"
        title="A day at a time"
        description="The moments you log will find their place here, in the order they happened."
      />
    </Screen>
  );
}
