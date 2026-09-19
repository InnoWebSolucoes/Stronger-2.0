import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { ExerciseDemo } from '@/ui/anatomy/ExerciseDemo';
import { Sparkline } from '@/ui/charts/Sparkline';
import { c, radius, space, type } from '@/ui/tokens.bridge';
import { ALL_EXERCISES, MUSCLE_GROUPS, searchExercises } from '@/features/exercises/source';
import type { CompletedWorkout } from '@/features/workout/types';
import type { Profile } from '@/features/account/store';
import { summariseLifts, type LiftSummary } from './analytics';
import { E1RM_DISCLOSURE } from './methodology';
import { Card, EmptyState, SectionHeader, Segmented } from './ui';
import * as fmt from './format';

type Scope = 'mine' | 'all';

interface Row {
  readonly exerciseId: string;
  readonly name: string;
  readonly muscles: readonly string[];
  readonly lift: LiftSummary | null;
}

export function ExercisesTab({
  history,
  profile,
  now,
}: {
  history: readonly CompletedWorkout[];
  profile: Profile | null;
  now: number;
}) {
  const units = profile?.units ?? 'kg';
  const [scope, setScope] = useState<Scope>('mine');
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);

  const lifts = useMemo(
    () => summariseLifts(history, profile?.bodyweightKg ?? null),
    [history, profile?.bodyweightKg],
  );
  const byId = useMemo(() => new Map(lifts.map((l) => [l.exerciseId, l])), [lifts]);

  const rows = useMemo<Row[]>(() => {
    if (scope === 'all') {
      const matches = searchExercises(query, muscle);
      return matches.map((e) => ({
        exerciseId: e.id,
        name: e.name,
        muscles: e.muscles,
        lift: byId.get(e.id) ?? null,
      }));
    }

    const matchedIds = new Set(searchExercises(query, muscle).map((e) => e.id));
    return lifts
      .filter((lift) => {
        // A logged lift may no longer be in the catalog; match on its own name
        // so history never disappears behind a catalog change.
        if (matchedIds.has(lift.exerciseId)) return true;
        if (muscle !== null && !lift.muscles.includes(muscle)) return false;
        const q = query.trim().toLowerCase();
        return q === '' ? muscle === null || lift.muscles.includes(muscle) : lift.name.toLowerCase().includes(q);
      })
      .map((lift) => ({
        exerciseId: lift.exerciseId,
        name: lift.name,
        muscles: lift.muscles,
        lift,
      }));
  }, [scope, query, muscle, lifts, byId]);

  const loggedCount = lifts.length;

  return (
    <>
      <Segmented
        value={scope}
        onChange={setScope}
        options={[
          { key: 'mine', label: `My lifts${loggedCount > 0 ? ` (${loggedCount})` : ''}` },
          { key: 'all', label: `All exercises (${ALL_EXERCISES.length})` },
        ]}
      />

      <View style={styles.searchRow}>
        <Search color={c.fg.tertiary} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={c.fg.disabled}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query === '' ? null : (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <X color={c.fg.tertiary} size={16} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip label="All muscles" active={muscle === null} onPress={() => setMuscle(null)} />
        {MUSCLE_GROUPS.map((group) => (
          <FilterChip
            key={group}
            label={group}
            active={muscle === group}
            onPress={() => setMuscle(muscle === group ? null : group)}
          />
        ))}
      </ScrollView>

      <SectionHeader
        title={scope === 'mine' ? 'LIFTS YOU HAVE LOGGED' : 'EVERY EXERCISE'}
        disclosure={E1RM_DISCLOSURE}
      />

      {rows.length === 0 ? (
        scope === 'mine' && loggedCount === 0 ? (
          <EmptyState
            icon={<Search color={c.brand.base} size={22} />}
            title="No lifts logged yet"
            body="Every exercise you complete a working set of shows up here with its estimated 1RM, its best set and a trend line."
            hint="Switch to All exercises to browse the catalog in the meantime."
          />
        ) : (
          <Card>
            <Text style={styles.emptyRowTitle}>Nothing matches</Text>
            <Text style={styles.emptyRowBody}>
              {muscle === null ? 'Try a different search.' : `No ${muscle.toLowerCase()} match “${query}”.`}
            </Text>
          </Card>
        )
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <ExerciseRow key={row.exerciseId} row={row} units={units} now={now} />
          ))}
        </View>
      )}
    </>
  );
}

function ExerciseRow({ row, units, now }: { row: Row; units: 'kg' | 'lb'; now: number }) {
  const lift = row.lift;
  const values = lift === null ? [] : lift.points.map((p) => p.e1rmKg);
  const trend =
    values.length < 2
      ? c.viz.flat
      : (values[values.length - 1] ?? 0) >= (values[0] ?? 0)
        ? c.viz.up
        : c.viz.down;

  return (
    <View style={styles.row}>
      <ExerciseDemo exerciseId={row.exerciseId} size={44} animated={false} />

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name}
        </Text>
        {lift === null ? (
          <Text style={styles.rowMetaQuiet}>Not logged yet · {row.muscles.slice(0, 2).join(', ')}</Text>
        ) : (
          <Text style={styles.rowMeta} numberOfLines={1}>
            Best {fmt.weight(lift.bestSet?.weightKg ?? null, units)}
            {lift.bestSet === null ? '' : ` × ${lift.bestSet.reps}`} ·{' '}
            {fmt.sinceLabel(lift.lastPerformedAt, now)}
          </Text>
        )}
      </View>

      <View style={styles.rowRight}>
        <Sparkline values={values} width={64} height={24} color={trend} />
        <View style={styles.rowValueRow}>
          <Text style={[styles.rowValue, lift === null && styles.rowValueEmpty]}>
            {fmt.weightValue(lift?.currentE1rmKg ?? null, units) ?? '—'}
          </Text>
          <Text style={styles.rowUnit}>{lift === null ? '' : units}</Text>
        </View>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={[styles.filterChip, active && styles.filterChipActive]}>
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: c.bg.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  searchInput: { flex: 1, ...type.body, color: c.fg.primary, padding: 0 },

  filterRow: { gap: space.sm, paddingVertical: space.md, paddingRight: space.xl },
  filterChip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.surface[1],
  },
  filterChipActive: { borderColor: c.brand.borderWeak, backgroundColor: c.brand.weak },
  filterChipText: { ...type.caption, fontWeight: '600', color: c.fg.secondary },
  filterChipTextActive: { color: c.brand.text },

  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  rowBody: { flex: 1, gap: 2 },
  rowName: { ...type.bodyStrong, color: c.fg.primary },
  rowMeta: { ...type.caption, color: c.fg.tertiary },
  rowMetaQuiet: { ...type.caption, color: c.fg.disabled },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  rowValue: {
    ...type.bodyStrong,
    fontSize: 17,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  rowValueEmpty: { color: c.fg.disabled },
  rowUnit: { ...type.caption, fontSize: 11, color: c.fg.tertiary },

  emptyRowTitle: { ...type.bodyStrong, color: c.fg.primary, marginBottom: space.xs },
  emptyRowBody: { ...type.caption, color: c.fg.tertiary },
});
