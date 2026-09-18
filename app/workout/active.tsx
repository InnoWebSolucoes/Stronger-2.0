import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, Plus, Timer, Trash2 } from 'lucide-react-native';
import {
  useWorkout,
  workoutCompletedSets,
  workoutReps,
  workoutVolumeKg,
} from '@/features/workout/store';
import { SET_TYPE_MARK, type LoggedSet, type SetType } from '@/features/workout/types';
import { c, radius, space, type } from '@/ui/tokens.bridge';

function hhmmss(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') void Haptics.impactAsync(style);
}

const SET_TYPE_COLOR: Record<SetType, string> = {
  warmup: c.brand.text,
  normal: c.fg.secondary,
  drop: c.action.text,
  failure: c.negative.text,
};

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const active = useWorkout((s) => s.active);
  const restEndsAt = useWorkout((s) => s.restEndsAt);
  const addSet = useWorkout((s) => s.addSet);
  const updateSet = useWorkout((s) => s.updateSet);
  const toggleSetDone = useWorkout((s) => s.toggleSetDone);
  const removeSet = useWorkout((s) => s.removeSet);
  const cycleSetType = useWorkout((s) => s.cycleSetType);
  const removeExercise = useWorkout((s) => s.removeExercise);
  const finish = useWorkout((s) => s.finish);
  const discard = useWorkout((s) => s.discard);
  const clearRest = useWorkout((s) => s.clearRest);

  // One ticker drives both the session duration and the rest countdown, so
  // they can never drift apart on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  if (!active) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>No workout in progress.</Text>
        <Pressable style={styles.ghostButton} onPress={() => router.back()}>
          <Text style={styles.ghostButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const durationSec = Math.round((now - active.startedAt) / 1000);
  const volume = workoutVolumeKg(active);
  const reps = workoutReps(active);
  const doneSets = workoutCompletedSets(active);
  const restLeft = restEndsAt ? Math.ceil((restEndsAt - now) / 1000) : 0;
  const resting = restLeft > 0;

  const onFinish = () => {
    if (doneSets === 0) {
      Alert.alert(
        'Nothing logged yet',
        'Tick at least one set, or discard this workout.',
        [
          { text: 'Keep going', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              discard();
              router.back();
            },
          },
        ],
      );
      return;
    }
    const completed = finish();
    tap(Haptics.ImpactFeedbackStyle.Heavy);
    if (completed) router.replace({ pathname: '/workout/summary', params: { id: completed.id } });
    else router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.topBarIcon}>
          <ChevronDown color={c.fg.secondary} size={24} />
        </Pressable>
        <Pressable onPress={onFinish} hitSlop={10}>
          <Text style={styles.finish}>Finish</Text>
        </Pressable>
      </View>

      <View style={styles.metaBar}>
        <Text style={styles.workoutName}>{active.name}</Text>
        <View style={styles.metrics}>
          <Metric label="Duration" value={hhmmss(durationSec)} />
          <Metric label="Volume" value={`${Math.round(volume).toLocaleString()} kg`} />
          <Metric label="Sets" value={String(doneSets)} />
          <Metric label="Reps" value={String(reps)} />
        </View>
      </View>

      {resting ? (
        <Pressable style={styles.restBar} onPress={clearRest}>
          <Timer color={c.bg.canvas} size={16} />
          <Text style={styles.restText}>Rest {hhmmss(restLeft)}</Text>
          <Text style={styles.restSkip}>Skip</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {active.exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptyBody}>
              Add your first exercise to start logging sets.
            </Text>
          </View>
        ) : null}

        {active.exercises.map((ex) => (
          <View key={ex.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHead}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <View style={styles.restChip}>
                <Timer color={c.brand.text} size={12} />
                <Text style={styles.restChipText}>
                  {Math.round(ex.restSeconds / 60)}m
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert(ex.name, undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove exercise',
                      style: 'destructive',
                      onPress: () => removeExercise(ex.id),
                    },
                  ])
                }
              >
                <Trash2 color={c.fg.tertiary} size={16} />
              </Pressable>
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colSet]}>SET</Text>
              <Text style={[styles.th, styles.colPrev]}>PREVIOUS</Text>
              <Text style={[styles.th, styles.colNum]}>KG</Text>
              <Text style={[styles.th, styles.colNum]}>REPS</Text>
              <View style={styles.colCheck} />
            </View>

            {ex.sets.map((s, i) => (
              <SetRow
                key={s.id}
                index={i}
                set={s}
                onCycleType={() => {
                  tap();
                  cycleSetType(ex.id, s.id);
                }}
                onUsePrevious={() => {
                  if (!s.previous) return;
                  tap();
                  updateSet(ex.id, s.id, {
                    weightKg: s.previous.weightKg,
                    reps: s.previous.reps,
                  });
                }}
                onChangeWeight={(v) => updateSet(ex.id, s.id, { weightKg: v })}
                onChangeReps={(v) => updateSet(ex.id, s.id, { reps: v })}
                onToggleDone={() => {
                  tap(
                    s.done
                      ? Haptics.ImpactFeedbackStyle.Light
                      : Haptics.ImpactFeedbackStyle.Medium,
                  );
                  toggleSetDone(ex.id, s.id);
                }}
                onRemove={() => removeSet(ex.id, s.id)}
              />
            ))}

            <Pressable style={styles.addSet} onPress={() => addSet(ex.id)}>
              <Plus color={c.fg.secondary} size={15} />
              <Text style={styles.addSetText}>Add set</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          style={styles.addExercise}
          onPress={() => router.push('/workout/pick-exercise')}
        >
          <Plus color={c.fg.onAction} size={18} />
          <Text style={styles.addExerciseText}>Add exercise</Text>
        </Pressable>

        <Pressable
          style={styles.discard}
          onPress={() =>
            Alert.alert('Discard workout?', 'Everything logged in this session is lost.', [
              { text: 'Keep going', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => {
                  discard();
                  router.back();
                },
              },
            ])
          }
        >
          <Text style={styles.discardText}>Discard workout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function SetRow({
  index,
  set,
  onCycleType,
  onUsePrevious,
  onChangeWeight,
  onChangeReps,
  onToggleDone,
  onRemove,
}: {
  index: number;
  set: LoggedSet;
  onCycleType: () => void;
  onUsePrevious: () => void;
  onChangeWeight: (v: number | null) => void;
  onChangeReps: (v: number | null) => void;
  onToggleDone: () => void;
  onRemove: () => void;
}) {
  const mark = SET_TYPE_MARK[set.type];
  return (
    <View style={[styles.row, set.done && styles.rowDone]}>
      <Pressable style={styles.colSet} onPress={onCycleType} onLongPress={onRemove} hitSlop={6}>
        <Text style={[styles.setNumber, { color: SET_TYPE_COLOR[set.type] }]}>
          {mark || index + 1}
        </Text>
      </Pressable>

      <Pressable style={styles.colPrev} onPress={onUsePrevious}>
        <Text style={styles.prevText}>
          {set.previous ? `${set.previous.weightKg} × ${set.previous.reps}` : '—'}
        </Text>
      </Pressable>

      <NumberCell
        value={set.weightKg}
        placeholder="0"
        onChange={onChangeWeight}
        allowDecimal
      />
      <NumberCell value={set.reps} placeholder="0" onChange={onChangeReps} />

      <Pressable
        style={[styles.colCheck, styles.checkBox, set.done && styles.checkBoxDone]}
        onPress={onToggleDone}
        hitSlop={6}
      >
        <Check color={set.done ? c.bg.canvas : c.fg.disabled} size={18} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

function NumberCell({
  value,
  placeholder,
  onChange,
  allowDecimal = false,
}: {
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
  allowDecimal?: boolean;
}) {
  // Kept as local text so a half-typed "12." is not destroyed by re-parsing.
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  return (
    <TextInput
      style={[styles.colNum, styles.input]}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={c.fg.disabled}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      onChangeText={(t) => {
        const cleaned = allowDecimal ? t.replace(/[^0-9.]/g, '') : t.replace(/[^0-9]/g, '');
        setText(cleaned);
        if (cleaned === '') return onChange(null);
        const n = Number(cleaned);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.app },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  emptyText: { ...type.body, color: c.fg.secondary },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    height: 48,
  },
  topBarIcon: { width: 32 },
  finish: { ...type.heading, color: c.action.text },

  metaBar: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border.subtle,
    gap: space.md,
  },
  workoutName: { ...type.title, color: c.fg.primary },
  metrics: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { gap: 2 },
  metricLabel: { ...type.overline, color: c.fg.tertiary, fontSize: 10 },
  metricValue: {
    ...type.bodyStrong,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },

  restBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.brand.base,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  restText: {
    ...type.bodyStrong,
    color: c.bg.canvas,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  restSkip: { ...type.caption, fontWeight: '700', color: c.bg.canvas },

  body: { flex: 1 },
  bodyContent: { padding: space.xl, gap: space.lg },

  emptyCard: {
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border.default,
    gap: space.xs,
  },
  emptyTitle: { ...type.heading, color: c.fg.primary },
  emptyBody: { ...type.body, color: c.fg.tertiary },

  exerciseCard: {
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.lg,
    gap: space.sm,
  },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  exerciseName: { ...type.heading, color: c.fg.primary, flex: 1 },
  restChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: c.brand.weak,
  },
  restChipText: { ...type.caption, color: c.brand.text, fontSize: 11, fontWeight: '700' },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xs,
  },
  th: { ...type.overline, color: c.fg.tertiary, fontSize: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  rowDone: { backgroundColor: c.positive.weak },

  colSet: { width: 34, alignItems: 'center', justifyContent: 'center' },
  colPrev: { flex: 1.4, justifyContent: 'center' },
  colNum: { flex: 1 },
  colCheck: { width: 44, alignItems: 'center', justifyContent: 'center' },

  setNumber: { ...type.bodyStrong, fontVariant: ['tabular-nums'] },
  prevText: { ...type.caption, color: c.fg.tertiary, fontVariant: ['tabular-nums'] },

  input: {
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: c.surface[3],
    color: c.fg.primary,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: space.xs,
  },

  checkBox: {
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: c.surface[3],
  },
  checkBoxDone: { backgroundColor: c.positive.fill },

  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: c.surface[2],
    marginTop: space.xs,
  },
  addSetText: { ...type.caption, fontWeight: '700', color: c.fg.secondary },

  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.action.fill,
  },
  addExerciseText: { ...type.heading, color: c.fg.onAction },

  discard: { alignItems: 'center', paddingVertical: space.lg },
  discardText: { ...type.body, color: c.negative.text },

  ghostButton: {
    paddingHorizontal: space.xl,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: { ...type.bodyStrong, color: c.fg.primary },
});
