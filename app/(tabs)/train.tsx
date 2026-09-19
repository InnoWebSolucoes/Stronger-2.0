import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/ui/primitives/Screen';
import { ExerciseDemo } from '@/ui/anatomy/ExerciseDemo';
import { confirm } from '@/ui/primitives/Dialog';
import { resolveAll } from '@/features/exercises/source';
import { TEMPLATES, useRoutines, type Routine } from '@/features/routines/store';
import { useWorkout, type ExerciseSeed } from '@/features/workout/store';
import { c, radius, space, type } from '@/ui/tokens.bridge';

function seedsFor(names: readonly string[]): ExerciseSeed[] {
  return resolveAll(names);
}

export default function TrainTab() {
  const routines = useRoutines((s) => s.routines);
  const hydrate = useRoutines((s) => s.hydrate);
  const hydrated = useRoutines((s) => s.hydrated);
  const create = useRoutines((s) => s.create);
  const remove = useRoutines((s) => s.remove);
  const duplicate = useRoutines((s) => s.duplicate);
  const active = useWorkout((s) => s.active);
  const start = useWorkout((s) => s.start);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const startRoutine = (r: Routine) => {
    start(
      r.name,
      r.exercises.map((e) => ({
        id: e.exerciseId,
        name: e.name,
        muscles: e.muscles,
        defaultRestSeconds: e.restSeconds,
      })),
    );
    router.push('/workout/active');
  };

  const useTemplate = (t: (typeof TEMPLATES)[number]) => {
    const routine = create(t.name, seedsFor(t.exerciseIds), t.note);
    router.push({ pathname: '/routine/edit', params: { id: routine.id } });
  };

  const deleteRoutine = async (r: Routine) => {
    const yes = await confirm({
      title: `Delete ${r.name}?`,
      message: 'The routine is removed. Workouts you already logged from it stay.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (yes) remove(r.id);
  };

  return (
    <Screen
      title="Train"
      subtitle="Your routines and ready-made plans"
      action={
        <Pressable
          style={styles.newButton}
          onPress={() => router.push('/routine/edit')}
          hitSlop={8}
        >
          <Plus color={c.bg.canvas} size={20} />
        </Pressable>
      }
    >
      <Text style={styles.sectionLabel}>
        {routines.length > 0 ? 'YOUR ROUTINES' : 'NO ROUTINES YET'}
      </Text>

      {routines.length === 0 ? (
        <Pressable style={styles.emptyCard} onPress={() => router.push('/routine/edit')}>
          <Text style={styles.emptyTitle}>Build your first routine</Text>
          <Text style={styles.emptyBody}>
            Save the exercises you do together, then start the whole session in one
            tap. Or pick one of the plans below to start from.
          </Text>
          <View style={styles.emptyCta}>
            <Plus color={c.action.text} size={15} />
            <Text style={styles.emptyCtaText}>New routine</Text>
          </View>
        </Pressable>
      ) : null}

      {routines.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{r.name}</Text>
              <Text style={styles.cardMeta}>
                {r.exercises.length}{' '}
                {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                {r.note ? ` · ${r.note}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.demoRow}>
            {r.exercises.slice(0, 6).map((e, i) => (
              <ExerciseDemo
                key={`${e.exerciseId}-${i}`}
                exerciseId={e.exerciseId}
                size={40}
                animated={false}
              />
            ))}
            {r.exercises.length > 6 ? (
              <View style={styles.moreChip}>
                <Text style={styles.moreChipText}>+{r.exercises.length - 6}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardActions}>
            <Pressable
              style={[styles.start, active != null && styles.startDisabled]}
              onPress={() => startRoutine(r)}
              disabled={active != null}
            >
              <Play color={c.fg.onAction} size={15} fill={c.fg.onAction} />
              <Text style={styles.startText}>
                {active ? 'Workout in progress' : 'Start'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.iconAction}
              onPress={() => router.push({ pathname: '/routine/edit', params: { id: r.id } })}
              hitSlop={6}
            >
              <Pencil color={c.fg.secondary} size={16} />
            </Pressable>
            <Pressable style={styles.iconAction} onPress={() => duplicate(r.id)} hitSlop={6}>
              <Copy color={c.fg.secondary} size={16} />
            </Pressable>
            <Pressable style={styles.iconAction} onPress={() => deleteRoutine(r)} hitSlop={6}>
              <Trash2 color={c.negative.text} size={16} />
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>READY-MADE PLANS</Text>

      {TEMPLATES.map((t) => (
        <Pressable key={t.name} style={styles.templateCard} onPress={() => useTemplate(t)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t.name}</Text>
            <Text style={styles.cardMeta}>
              {t.exerciseIds.length} exercises · {t.note}
            </Text>
          </View>
          <View style={styles.useChip}>
            <Plus color={c.brand.text} size={14} />
            <Text style={styles.useChipText}>Use</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  newButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brand.base,
  },
  sectionLabel: {
    ...type.overline,
    color: c.fg.tertiary,
    marginTop: space.lg,
    marginBottom: space.md,
  },

  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border.default,
    padding: space.xl,
    gap: space.sm,
  },
  emptyTitle: { ...type.heading, color: c.fg.primary },
  emptyBody: { ...type.body, color: c.fg.tertiary },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  emptyCtaText: { ...type.bodyStrong, color: c.action.text },

  card: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { ...type.heading, color: c.fg.primary },
  cardMeta: { ...type.caption, color: c.fg.tertiary, marginTop: 2 },

  demoRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  moreChip: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: c.surface[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreChipText: { ...type.caption, color: c.fg.tertiary, fontWeight: '700' },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  start: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: c.action.fill,
  },
  startDisabled: { backgroundColor: c.surface[3] },
  startText: { ...type.bodyStrong, color: c.fg.onAction },
  iconAction: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },

  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.lg,
    marginBottom: space.sm,
  },
  useChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: c.brand.weak,
  },
  useChipText: { ...type.caption, fontWeight: '700', color: c.brand.text },
});
