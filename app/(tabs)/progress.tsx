import { Screen } from '@/ui/primitives/Screen';
import { Unbuilt } from '@/ui/primitives/Unbuilt';

export default function ProgressTab() {
  return (
    <Screen title="Progress" subtitle="Strength, recovery and training trends">
      <Unbuilt
        what="Strength profile and rank, per-lift e1RM trends, muscle readiness, world standings, bodyweight and progress photos."
        dependsOn="src/core/standards, src/core/readiness and src/core/bodyweight"
      />
    </Screen>
  );
}
