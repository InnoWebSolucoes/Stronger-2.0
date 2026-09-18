import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, Play, Plus, Trash2, X } from 'lucide-react-native';
import { ExerciseDemo } from '@/ui/anatomy/ExerciseDemo';
import { confirm } from '@/ui/primitives/Dialog';
import { usePick } from '@/features/exercises/pick-store';
import { useRoutines, type RoutineExercise } from '@/features/routines/store';
import { useWorkout } from '@/features/workout/store';
import { c, radius, space, type } from '@/ui/tokens.bridge';

export default function RoutineEditor() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const routines = useRoutines((s) => s.routines);
  const hydrate = useRoutines((s) => s.hydrate);
  const hydrated = useRoutines((s) => s.hydrated);
  const create = useRoutines((s) => s.create);
  const update = useRoutines((s) => s.update);
  const removeRoutine = useRoutines((s) => s.remove);

  const setMode = usePick((s) => s.setMode);
  const consume = usePick((s) => s.consume);

  const start = useWorkout((s) => s.start);
  const active = useWorkout((s) => s.active);

  const existing = id ? routines.find((r) => r.id === id) : undefined;

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // Seed the form once the store has hydrated, and only once, so typing is
  // never clobbered by a later store update.
  useEffect(() => {
    if (loaded || !hydrated) return;
    if (existing) {
      setName(existing.name);
      setNote(existing.note ?? '');
      setExercises(existing.exercises);
    }
    setLoaded(true);
  }, [existing, hydrated, loaded]);

  // Collect anything chosen in the picker on the way back.
  useFocusEffect(
    useCallback(() => {
      const picked = consume();
      if (!picked) return;
      setExercises((prev) => [
        ...prev,
        {
          exerciseId: picked.id,
          name: picked.name,
          muscles: picked.muscles,
          restSeconds: picked.defaultRestSeconds ?? 120,
          targetSets: 3,
        },
      ]);
    }, [consume]),
  );

  const addExercise = () => {
    setMode('routine');
    router.push('/workout/pick-exercise');
  };

  const move = (index: number, delta: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const target = index + delta;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const setTargetSets = (index: number, value: number) => {
    setExercises((prev) =>
      prev.map((e, i) => (i === index ? { ...e, targetSets: Math.max(1, value) } : e)),
    );
  };

  const save = (): string | null => {
    const trimmed = name.trim() || 'Untitled routine';
    if (existing) {
      update(existing.id, { name: trimmed, note: note.trim(), exercises });
      return existing.id;
    }
    const created = create(
      trimmed,
      exercises.map((e) => ({
        id: e.exerciseId,
        name: e.name,
        muscles: e.muscles,
        defaultRestSeconds: e.restSeconds,
      })),
      note.trim() || undefined,
    );
    // create() defaults targetSets; carry the edited values across.
    update(created.id, { exercises });
    return created.id;
  };

  const onSave = () => {
    save();
    router.back();
  };

  const onStart = () => {
    save();
    start(
      name.trim() || 'Workout',
      exercises.map((e) => ({
        id: e.exerciseId,
        name: e.name,
        muscles: e.muscles,
        defaultRestSeconds: e.restSeconds,
      })),
    );
    router.replace('/workout/active');
  };

  const onDelete = async () => {
    if (!existing) return router.back();
    const yes = await confirm({
      title: `Delete ${existing.name}?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (yes) {
      removeRoutine(existing.id);
      router.back();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={c.fg.secondary} size={24} />
        </Pressable>
        <Text style={styles.topTitle}>{existing ? 'Edit routine' : 'New routine'}</Text>
        <Pressable onPress={onSave} hitSlop={10}>
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Routine name"
          placeholderTextColor={c.fg.disabled}
          returnKeyType="next"
        />
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional) — e.g. week 3, deload"
          placeholderTextColor={c.fg.disabled}
        />

        <Text style={styles.sectionLabel}>
          {exercises.length} {exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}
        </Text>

        {exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyBody}>
              No exercises yet. Add the movements you do in this session, in the order
              you do them.
            </Text>
          </View>
        ) : null}

        {exercises.map((e, i) => (
          <View key={`${e.exerciseId}-${i}`} style={styles.exRow}>
            <ExerciseDemo exerciseId={e.exerciseId} size={44} animated={false} />

            <View style={styles.exText}>
              <Text style={styles.exName}>{e.name}</Text>
              <Text style={styles.exMeta}>{e.muscles.join(', ')}</Text>
            </View>

            <View style={styles.setsStepper}>
              <Pressable
                onPress={() => setTargetSets(i, e.targetSets - 1)}
                hitSlop={6}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSign}>−</Text>
              </Pressable>
              <Text style={styles.setsValue}>{e.targetSets}</Text>
              <Pressable
                onPress={() => setTargetSets(i, e.targetSets + 1)}
                hitSlop={6}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSign}>+</Text>
              </Pressable>
            </View>

            <View style={styles.reorder}>
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={4}>
                <ChevronUp color={i === 0 ? c.fg.disabled : c.fg.tertiary} size={16} />
              </Pressable>
              <Pressable
                onPress={() => move(i, 1)}
                disabled={i === exercises.length - 1}
                hitSlop={4}
              >
                <ChevronDown
                  color={i === exercises.length - 1 ? c.fg.disabled : c.fg.tertiary}
                  size={16}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={() => setExercises((prev) => prev.filter((_, j) => j !== i))}
              hitSlop={6}
            >
              <Trash2 color={c.fg.tertiary} size={16} />
            </Pressable>
          </View>
        ))}

        <Pressable style={styles.addButton} onPress={addExercise}>
          <Plus color={c.action.text} size={18} />
          <Text style={styles.addButtonText}>Add exercise</Text>
        </Pressable>

        {existing ? (
          <Pressable style={styles.delete} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete routine</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable
          style={[styles.startButton, (exercises.length === 0 || active != null) && styles.startDisabled]}
          onPress={onStart}
          disabled={exercises.length === 0 || active != null}
        >
          <Play color={c.fg.onAction} size={16} fill={c.fg.onAction} />
          <Text style={styles.startText}>
            {active ? 'Workout already in progress' : 'Save and start'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.app },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  topTitle: { ...type.heading, color: c.fg.primary },
  save: { ...type.heading, color: c.action.text },

  content: { paddingHorizontal: space.xl, gap: space.sm },

  nameInput: {
    ...type.title,
    color: c.fg.primary,
    backgroundColor: c.surface[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  noteInput: {
    ...type.body,
    color: c.fg.secondary,
    backgroundColor: c.surface[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },

  sectionLabel: { ...type.overline, color: c.fg.tertiary, marginTop: space.lg },

  emptyCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border.default,
    padding: space.lg,
  },
  emptyBody: { ...type.body, color: c.fg.tertiary },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.surface[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.md,
  },
  exText: { flex: 1, gap: 2 },
  exName: { ...type.bodyStrong, color: c.fg.primary },
  exMeta: { ...type.caption, color: c.fg.tertiary },

  setsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: c.surface[3],
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
    height: 32,
  },
  stepperButton: { width: 22, alignItems: 'center', justifyContent: 'center' },
  stepperSign: { ...type.bodyStrong, color: c.fg.secondary, fontSize: 17 },
  setsValue: {
    ...type.caption,
    fontWeight: '700',
    color: c.fg.primary,
    minWidth: 14,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  reorder: { gap: 2 },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.action.text,
    borderStyle: 'dashed',
    marginTop: space.sm,
  },
  addButtonText: { ...type.bodyStrong, color: c.action.text },

  delete: { alignItems: 'center', paddingVertical: space.xl },
  deleteText: { ...type.body, color: c.negative.text },

  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border.subtle,
    backgroundColor: c.bg.app,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.action.fill,
  },
  startDisabled: { backgroundColor: c.surface[3] },
  startText: { ...type.heading, color: c.fg.onAction },
});
