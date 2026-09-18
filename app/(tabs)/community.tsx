import { Screen } from '@/ui/primitives/Screen';
import { Unbuilt } from '@/ui/primitives/Unbuilt';

export default function CommunityTab() {
  return (
    <Screen title="Community" subtitle="Groups, friends and shared sessions">
      <Unbuilt
        what="Following and discover feeds, groups, and workout posts with the generated muscle map."
        dependsOn="Supabase sync — this is the one tab that cannot work offline"
      />
    </Screen>
  );
}
