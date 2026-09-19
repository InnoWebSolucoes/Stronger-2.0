import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/ui/primitives/Screen';
import { space } from '@/ui/tokens.bridge';
import { useAccount } from '@/features/account/store';
import { useBodyweight } from '@/features/bodyweight/store';
import { useWorkout } from '@/features/workout/store';
import { AnalyticsTab } from '@/features/progress/AnalyticsTab';
import { BodyweightTab } from '@/features/progress/BodyweightTab';
import { ExercisesTab } from '@/features/progress/ExercisesTab';
import { Segmented } from '@/features/progress/ui';
import type { RangeKey } from '@/features/progress/analytics';

type Tab = 'analytics' | 'exercises' | 'bodyweight';

const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'exercises', label: 'Exercises' },
  { key: 'bodyweight', label: 'Bodyweight' },
];

const SUBTITLE: Readonly<Record<Tab, string>> = {
  analytics: 'Where you stand, and what moved',
  exercises: 'Every lift you have logged',
  bodyweight: 'Trend, not today’s number',
};

export default function ProgressTab() {
  const [tab, setTab] = useState<Tab>('analytics');
  const [range, setRange] = useState<RangeKey>('3M');

  const history = useWorkout((s) => s.history);
  const workoutHydrated = useWorkout((s) => s.hydrated);
  const hydrateWorkout = useWorkout((s) => s.hydrate);

  const profile = useAccount((s) => s.profile);
  const accountHydrated = useAccount((s) => s.hydrated);
  const hydrateAccount = useAccount((s) => s.hydrate);

  const bodyweightHydrated = useBodyweight((s) => s.hydrated);
  const hydrateBodyweight = useBodyweight((s) => s.hydrate);

  useEffect(() => {
    if (!workoutHydrated) void hydrateWorkout();
  }, [workoutHydrated, hydrateWorkout]);
  useEffect(() => {
    if (!accountHydrated) void hydrateAccount();
  }, [accountHydrated, hydrateAccount]);
  useEffect(() => {
    if (!bodyweightHydrated) void hydrateBodyweight();
  }, [bodyweightHydrated, hydrateBodyweight]);

  // One clock for the whole screen. Every derivation takes `now` as a
  // parameter, so a single value keeps the rank, the readiness chips and the
  // range selector describing the same instant.
  const now = useMemo(() => Date.now(), [history, tab]);

  return (
    <Screen title="Progress" subtitle={SUBTITLE[tab]}>
      <View style={styles.tabs}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>

      {tab === 'analytics' ? (
        <AnalyticsTab
          history={history}
          profile={profile}
          range={range}
          onRangeChange={setRange}
          now={now}
        />
      ) : null}

      {tab === 'exercises' ? <ExercisesTab history={history} profile={profile} now={now} /> : null}

      {tab === 'bodyweight' ? (
        <BodyweightTab profile={profile} range={range} onRangeChange={setRange} now={now} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: space.sm },
});
