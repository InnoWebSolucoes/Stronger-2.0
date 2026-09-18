import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Dumbbell, Hash, Layers } from 'lucide-react-native';
import { heroLine, pickEquivalents } from '@core/equivalents';
import { useWorkout } from '@/features/workout/store';
import { c, radius, space, type } from '@/ui/tokens.bridge';

function hhmmss(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${m}m ${String(s).padStart(2, '0')}s`;
}

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const history = useWorkout((s) => s.history);

  const workout = useMemo(
    () => history.find((w) => w.id === id) ?? history[0],
    [history, id],
  );

  // sessionIndex drives the deterministic rotation, so the same workout always
  // renders the same comparisons — reopening an old summary is identical forever.
  const sessionIndex = useMemo(() => {
    if (!workout) return 1;
    const i = history.findIndex((w) => w.id === workout.id);
    return history.length - (i < 0 ? 0 : i);
  }, [history, workout]);

  const comparisons = useMemo(
    () => (workout ? pickEquivalents(workout.volumeKg, { sessionIndex, want: 2 }) : []),
    [workout, sessionIndex],
  );

  const muscleBreakdown = useMemo(() => {
    if (!workout) return [];
    const totals = new Map<string, number>();
    for (const ex of workout.exercises) {
      let exVolume = 0;
      for (const s of ex.sets) {
        if (s.weightKg != null && s.reps != null) exVolume += s.weightKg * s.reps;
      }
      // Volume is split evenly across an exercise's listed muscles. The real
      // contribution vectors live in src/core/exercises/contributions.ts and
      // should replace this once the catalog lands.
      const share = ex.muscles.length > 0 ? exVolume / ex.muscles.length : 0;
      for (const m of ex.muscles) totals.set(m, (totals.get(m) ?? 0) + share);
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .map(([muscle, kg]) => ({ muscle, kg, pct: sum > 0 ? (kg / sum) * 100 : 0 }))
      .sort((a, b) => b.kg - a.kg);
  }, [workout]);

  if (!workout) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>That workout is no longer available.</Text>
        <Pressable style={styles.done} onPress={() => router.replace('/')}>
          <Text style={styles.doneText}>Back to today</Text>
        </Pressable>
      </View>
    );
  }

  const hero =
    comparisons.length > 0
      ? heroLine(workout.volumeKg, comparisons, sessionIndex)
      : `${Math.round(workout.volumeKg).toLocaleString()} kg moved.`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>WORKOUT COMPLETE</Text>
        <Text style={styles.name}>{workout.name}</Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroVolume}>
            {Math.round(workout.volumeKg).toLocaleString()}
            <Text style={styles.heroUnit}> kg</Text>
          </Text>
          <Text style={styles.heroLine}>{hero}</Text>
        </View>

        <View style={styles.statGrid}>
          <Stat icon={<Clock color={c.brand.text} size={16} />} label="Duration" value={hhmmss(workout.durationSec)} />
          <Stat icon={<Layers color={c.brand.text} size={16} />} label="Sets" value={String(workout.totalSets)} />
          <Stat icon={<Hash color={c.brand.text} size={16} />} label="Reps" value={String(workout.totalReps)} />
          <Stat icon={<Dumbbell color={c.brand.text} size={16} />} label="Exercises" value={String(workout.exercises.length)} />
        </View>

        {muscleBreakdown.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>WHAT YOU TRAINED</Text>
            <View style={styles.card}>
              {muscleBreakdown.map((m) => (
                <View key={m.muscle} style={styles.muscleRow}>
                  <Text style={styles.muscleName}>{m.muscle}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max(2, m.pct)}%` }]} />
                  </View>
                  <Text style={styles.musclePct}>{Math.round(m.pct)}%</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>EVERY SET</Text>
        {workout.exercises.map((ex) => (
          <View key={ex.id} style={styles.card}>
            <Text style={styles.exName}>{ex.name}</Text>
            {ex.sets.map((s, i) => (
              <View key={s.id} style={styles.setLine}>
                <Text style={styles.setIndex}>{i + 1}</Text>
                <Text style={styles.setDetail}>
                  {s.weightKg ?? 0} kg × {s.reps ?? 0}
                </Text>
                {s.type !== 'normal' ? (
                  <Text style={styles.setTag}>{s.type.toUpperCase()}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable style={styles.done} onPress={() => router.replace('/')}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.app },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  emptyText: { ...type.body, color: c.fg.secondary },
  content: { padding: space.xl, gap: space.md },

  eyebrow: { ...type.overline, color: c.brand.base },
  name: { ...type.display, color: c.fg.primary, marginBottom: space.sm },

  heroCard: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.brand.borderWeak,
    padding: space.xl,
    gap: space.sm,
  },
  heroVolume: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: c.brand.base,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: { fontSize: 22, fontWeight: '700', color: c.brand.text },
  heroLine: { ...type.body, color: c.fg.secondary, lineHeight: 22 },

  statGrid: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.md,
    gap: 4,
  },
  statValue: {
    ...type.heading,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...type.caption, color: c.fg.tertiary, fontSize: 11 },

  sectionLabel: { ...type.overline, color: c.fg.tertiary, marginTop: space.lg },

  card: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.lg,
    gap: space.sm,
  },

  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  muscleName: { ...type.caption, color: c.fg.secondary, width: 92 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.viz.track,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: c.brand.base },
  musclePct: {
    ...type.caption,
    color: c.fg.tertiary,
    width: 34,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  exName: { ...type.bodyStrong, color: c.fg.primary, marginBottom: space.xs },
  setLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  setIndex: {
    ...type.caption,
    color: c.fg.tertiary,
    width: 18,
    fontVariant: ['tabular-nums'],
  },
  setDetail: {
    ...type.body,
    color: c.fg.secondary,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  setTag: { ...type.overline, color: c.brand.text, fontSize: 9 },

  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border.subtle,
    backgroundColor: c.bg.app,
  },
  done: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.action.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { ...type.heading, color: c.fg.onAction },
});
