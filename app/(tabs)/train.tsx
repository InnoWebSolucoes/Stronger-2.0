import { Screen } from '@/ui/primitives/Screen';
import { Unbuilt } from '@/ui/primitives/Unbuilt';

export default function TrainTab() {
  return (
    <Screen title="Train" subtitle="Saved sessions and ready-made workouts">
      <Unbuilt
        what="Workout library, saved routines and the coach plan."
        dependsOn="the exercise catalog (src/core/exercises)"
      />
    </Screen>
  );
}
