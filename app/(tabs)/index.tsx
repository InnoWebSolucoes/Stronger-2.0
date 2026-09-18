import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { format, isSameDay, startOfWeek, addDays } from 'date-fns';
import {
  ChevronRight,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { Screen } from '@/ui/primitives/Screen';
import { Ring } from '@/ui/charts/Ring';
import { ALL_EXERCISES } from '@/features/exercises/source';
import { useWorkout, type ExerciseSeed } from '@/features/workout/store';
import type { CompletedWorkout } from '@/features/workout/types';
import { c, radius, shadow, space, type } from '@/ui/tokens.bridge';

/** A starter template until routines are stored. */
const UPPER_A: string[] = [
  'barbell-bench-press',
  'barbell-row',
  'seated-dumbbell-press',
  'lat-pulldown',
  'dumbbell-lateral-raise',
];

function seedsFor(ids: string[]): ExerciseSeed[] {
  const out: ExerciseSeed[] = [];
  for (const id of ids) {
    const found = ALL_EXERCISES.find((e) => e.id === id);
    if (found) out.push(found);
  }
  return out;
}

export default function LogTab() {
  const today = new Date();
  const active = useWorkout((s) => s.active);
  const history = useWorkout((s) => s.history);
  const start = useWorkout((s) => s.start);

  const week = useMemo(() => {
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return {
        date,
        letter: format(date, 'EEEEE'),
        day: date.getDate(),
        trained: history.some((w) => isSameDay(new Date(w.finishedAt), date)),
        isToday: isSameDay(date, today),
        future: date > today && !isSameDay(date, today),
      };
    });
  }, [history, today]);

  const startSuggested = () => {
    start('Upper A', seedsFor(UPPER_A));
    router.push('/workout/active');
  };

  const startEmpty = () => {
    start(`Workout ${format(today, 'd MMM')}`);
    router.push('/workout/active');
  };

  const repeat = (w: CompletedWorkout) => {
    start(
      w.name,
      w.exercises.map((ex) => ({
        id: ex.exerciseId,
        name: ex.name,
        muscles: ex.muscles,
        defaultRestSeconds: ex.restSeconds,
      })),
    );
    router.push('/workout/active');
  };

  return (
    <Screen
      title="Today"
      subtitle={format(today, 'EEEE, d MMMM')}
      action={
        <Pressable style={styles.iconButton} hitSlop={8}>
          <Search color={c.fg.secondary} size={20} />
        </Pressable>
      }
    >
      {active ? (
        <Pressable style={styles.resumeBar} onPress={() => router.push('/workout/active')}>
          <Play color={c.bg.canvas} size={16} fill={c.bg.canvas} />
          <View style={{ flex: 1 }}>
            <Text style={styles.resumeTitle}>{active.name} in progress</Text>
            <Text style={styles.resumeMeta}>
              {active.exercises.length}{' '}
              {active.exercises.length === 1 ? 'exercise' : 'exercises'} · tap to resume
            </Text>
          </View>
          <ChevronRight color={c.bg.canvas} size={18} />
        </Pressable>
      ) : null}

      <View style={styles.heroCard}>
        <Pressable style={styles.recoveryRow}>
          <Ring value={100} size={44} thickness={4} />
          <View style={styles.recoveryText}>
            <Text style={styles.recoveryHeadline}>Good to go</Text>
            <Text style={styles.recoveryDetail}>All muscles recovered</Text>
          </View>
          <ChevronRight color={c.fg.tertiary} size={18} />
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.suggestion}>
          <View style={styles.suggestionLabel}>
            <Sparkles color={c.brand.base} size={13} />
            <Text style={styles.suggestionLabelText}>SUGGESTED FOR TODAY</Text>
          </View>

          <View style={styles.suggestionHead}>
            <Text style={styles.suggestionName}>Upper A</Text>
            <Text style={styles.suggestionMeta}>{UPPER_A.length} exercises · ~45 min</Text>
          </View>

          <Text style={styles.suggestionWhy}>
            Chest, back and shoulders are recovered. Focus on controlled reps.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={startSuggested}
            disabled={active !== null}
          >
            <Text style={styles.primaryButtonText}>
              {active ? 'Finish your current workout first' : 'Start workout'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.secondaryButton} onPress={startEmpty} disabled={active !== null}>
        <Text style={styles.secondaryButtonText}>Build my own workout</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>TRAINING LOG</Text>

      <View style={styles.weekCard}>
        <View style={styles.weekStrip}>
          {week.map((d) => (
            <View key={d.day} style={styles.weekDay}>
              <Text style={[styles.weekLetter, d.future && styles.weekDimmed]}>
                {d.letter}
              </Text>
              <View style={[styles.weekDayNumber, d.isToday && styles.weekDayToday]}>
                <Text
                  style={[
                    styles.weekNumber,
                    d.future && styles.weekDimmed,
                    d.isToday && styles.weekNumberToday,
                  ]}
                >
                  {d.day}
                </Text>
              </View>
              <View style={styles.weekDot}>
                {d.trained ? <View style={styles.dotFilled} /> : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionLabel}>
        {history.length > 0 ? 'RECENT WORKOUTS' : 'NO WORKOUTS YET'}
      </Text>

      {history.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Your log is empty</Text>
          <Text style={styles.emptyBody}>
            Start a workout and every set you tick off lands here, with volume, reps
            and personal records.
          </Text>
        </View>
      ) : null}

      {history.slice(0, 12).map((w) => (
        <View key={w.id} style={styles.historyCard}>
          <View style={styles.historyTop}>
            <Text style={styles.historyName}>{w.name}</Text>
            <View style={styles.historyActions}>
              <Pressable style={styles.repeatButton} hitSlop={6} onPress={() => repeat(w)}>
                <RotateCcw color={c.fg.secondary} size={15} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.historyMeta}>
            {format(new Date(w.finishedAt), 'EEE d MMM')} · {w.exercises.length}{' '}
            {w.exercises.length === 1 ? 'exercise' : 'exercises'}
          </Text>

          <View style={styles.historyBottom}>
            <View style={styles.chips}>
              {Array.from(new Set(w.exercises.flatMap((e) => e.muscles)))
                .slice(0, 3)
                .map((g) => (
                  <View key={g} style={styles.chip}>
                    <Text style={styles.chipText}>{g.toUpperCase()}</Text>
                  </View>
                ))}
            </View>
            <Text style={styles.historyStats}>
              <Text style={styles.historyStatValue}>
                {Math.round(w.volumeKg).toLocaleString()}
              </Text>
              <Text style={styles.historyStatUnit}>kg · </Text>
              <Text style={styles.historyStatValue}>{w.totalReps}</Text>
              <Text style={styles.historyStatUnit}> reps</Text>
            </Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface[2],
  },

  resumeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.brand.base,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.md,
  },
  resumeTitle: { ...type.bodyStrong, color: c.bg.canvas },
  resumeMeta: { ...type.caption, color: 'rgba(7,10,17,0.72)' },

  heroCard: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    overflow: 'hidden',
    ...shadow[2],
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
  },
  recoveryText: { flex: 1 },
  recoveryHeadline: { ...type.bodyStrong, color: c.positive.text },
  recoveryDetail: { ...type.caption, color: c.fg.tertiary, marginTop: 1 },
  divider: { height: 1, backgroundColor: c.border.subtle },

  suggestion: { padding: space.lg, gap: space.md },
  suggestionLabel: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  suggestionLabelText: { ...type.overline, color: c.brand.base },
  suggestionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  suggestionName: { ...type.title, color: c.fg.primary },
  suggestionMeta: { ...type.caption, color: c.fg.tertiary },
  suggestionWhy: { ...type.body, color: c.fg.secondary },
  primaryButton: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.action.fill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  primaryButtonText: { ...type.heading, color: c.fg.onAction },

  secondaryButton: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  secondaryButtonText: { ...type.bodyStrong, color: c.fg.primary },

  sectionLabel: {
    ...type.overline,
    color: c.fg.tertiary,
    marginTop: space['2xl'],
    marginBottom: space.md,
  },

  weekCard: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.lg,
  },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: space.sm, flex: 1 },
  weekLetter: { ...type.caption, color: c.fg.tertiary, fontSize: 12 },
  weekDayNumber: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayToday: { borderWidth: 1, borderColor: c.brand.borderWeak },
  weekNumber: {
    ...type.bodyStrong,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  weekNumberToday: { color: c.brand.base },
  weekDimmed: { color: c.fg.disabled },
  weekDot: { height: 6, justifyContent: 'center' },
  dotFilled: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.brand.base },

  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border.default,
    padding: space.xl,
    gap: space.xs,
  },
  emptyTitle: { ...type.heading, color: c.fg.primary },
  emptyBody: { ...type.body, color: c.fg.tertiary },

  historyCard: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyName: { ...type.heading, color: c.fg.primary, flex: 1 },
  historyActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  repeatButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyMeta: { ...type.caption, color: c.fg.tertiary },
  historyBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.xs,
  },
  chips: { flexDirection: 'row', gap: space.xs, flexShrink: 1, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: c.brand.weak,
  },
  chipText: { ...type.overline, color: c.brand.text, fontSize: 10 },
  historyStats: { textAlign: 'right' },
  historyStatValue: {
    ...type.bodyStrong,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  historyStatUnit: { ...type.caption, color: c.fg.tertiary },
});
