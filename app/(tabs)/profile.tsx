import { Screen } from '@/ui/primitives/Screen';
import { Unbuilt } from '@/ui/primitives/Unbuilt';

export default function ProfileTab() {
  return (
    <Screen title="Profile" subtitle="Your training identity and achievements">
      <Unbuilt
        what="Activity heatmap, lifetime stats, badges and posts."
        dependsOn="workout history in src/db"
      />
    </Screen>
  );
}
