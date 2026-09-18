import { useMemo, useState } from 'react';
import {
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
import { FlashList } from '@shopify/flash-list';
import { Plus, Search, X } from 'lucide-react-native';
import { MUSCLE_GROUPS, searchExercises } from '@/features/exercises/source';
import { useWorkout } from '@/features/workout/store';
import { ExerciseDemo } from '@/ui/anatomy/ExerciseDemo';
import { c, radius, space, type } from '@/ui/tokens.bridge';

export default function PickExerciseScreen() {
  const insets = useSafeAreaInsets();
  const addExercise = useWorkout((s) => s.addExercise);
  const active = useWorkout((s) => s.active);

  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);

  const results = useMemo(() => searchExercises(query, muscle), [query, muscle]);
  const alreadyAdded = useMemo(
    () => new Set((active?.exercises ?? []).map((e) => e.exerciseId)),
    [active],
  );

  const add = (id: string) => {
    const found = results.find((r) => r.id === id);
    if (!found) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addExercise(found);
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Add exercise</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={c.fg.secondary} size={24} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Search color={c.fg.tertiary} size={18} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          placeholderTextColor={c.fg.disabled}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X color={c.fg.tertiary} size={16} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        <Pressable
          style={[styles.filter, muscle === null && styles.filterActive]}
          onPress={() => setMuscle(null)}
        >
          <Text style={[styles.filterText, muscle === null && styles.filterTextActive]}>
            All
          </Text>
        </Pressable>
        {MUSCLE_GROUPS.map((m) => (
          <Pressable
            key={m}
            style={[styles.filter, muscle === m && styles.filterActive]}
            onPress={() => setMuscle(muscle === m ? null : m)}
          >
            <Text style={[styles.filterText, muscle === m && styles.filterTextActive]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.count}>
        {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
      </Text>

      <FlashList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + space['3xl'] }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No match</Text>
            <Text style={styles.emptyBody}>
              Nothing found for “{query}”. Try the muscle filters, or a shorter search.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={() => add(item.id)}>
            <ExerciseDemo exerciseId={item.id} size={44} animated={false} />
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {item.equipment} · {item.muscles.join(', ')}
              </Text>
            </View>
            {alreadyAdded.has(item.id) ? (
              <View style={styles.addedPill}>
                <Text style={styles.addedPillText}>ADDED</Text>
              </View>
            ) : (
              <Plus color={c.action.text} size={20} />
            )}
          </Pressable>
        )}
      />
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
  title: { ...type.title, color: c.fg.primary },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.xl,
    paddingHorizontal: space.md,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: c.surface[2],
  },
  search: { flex: 1, color: c.fg.primary, fontSize: 16 },

  filterRow: { maxHeight: 60, marginTop: space.md },
  filterContent: { paddingHorizontal: space.xl, gap: space.sm, alignItems: 'center' },
  filter: {
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: c.brand.weak, borderColor: c.brand.borderWeak },
  filterText: { ...type.caption, color: c.fg.secondary, fontWeight: '600' },
  filterTextActive: { color: c.brand.text },

  count: {
    ...type.overline,
    color: c.fg.tertiary,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border.subtle,
  },
  itemText: { flex: 1, gap: 2 },
  itemName: { ...type.bodyStrong, color: c.fg.primary },
  itemMeta: { ...type.caption, color: c.fg.tertiary },
  addedPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: c.surface[3],
  },
  addedPillText: { ...type.overline, color: c.fg.tertiary, fontSize: 9 },

  empty: { padding: space['3xl'], alignItems: 'center', gap: space.sm },
  emptyTitle: { ...type.heading, color: c.fg.primary },
  emptyBody: { ...type.body, color: c.fg.tertiary, textAlign: 'center' },
});
