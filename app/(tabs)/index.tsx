import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import {
  ChevronRight,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { Screen } from '@/ui/primitives/Screen';
import { Ring } from '@/ui/charts/Ring';
import { c, radius, shadow, space, type } from '@/ui/tokens.bridge';

/**
 * PLACEHOLDER DATA — not wired to the database yet.
 *
 * src/db is still being built. This is here so the layout can be reviewed on a
 * real device; every value below is invented. Delete this block entirely when
 * the queries land — do not "gradually replace" it, or real and fake values
 * end up on screen together.
 */
const MOCK = {
  readiness: { score: 100, headline: 'Good to go', detail: 'Strong recovery today' },
  suggested: {
    name: 'Upper A',
    exerciseCount: 5,
    estimatedMinutes: 45,
    why: 'Your chest, back and shoulders are recovered. Focus on controlled reps.',
  },
  history: [
    {
      id: 'w1',
      name: 'pull',
      date: new Date(2026, 8, 16),
      exercises: 8,
      groups: ['Back', 'Shoulders', 'Arms'],
      volumeKg: 10714,
      reps: 359,
      prs: 2,
    },
    {
      id: 'w2',
      name: 'push',
      date: new Date(2026, 8, 14),
      exercises: 7,
      groups: ['Shoulders', 'Chest', 'Arms'],
      volumeKg: 7250,
      reps: 327,
      prs: 2,
    },
  ],
} as const;

type WeekDay = {
  letter: string;
  day: number;
  trained: boolean;
  today?: boolean;
  future?: boolean;
};

const WEEK: readonly WeekDay[] = [
  { letter: 'M', day: 14, trained: true },
  { letter: 'T', day: 15, trained: false },
  { letter: 'W', day: 16, trained: true },
  { letter: 'T', day: 17, trained: false },
  { letter: 'F', day: 18, trained: false, today: true },
  { letter: 'S', day: 19, trained: false, future: true },
  { letter: 'S', day: 20, trained: false, future: true },
];

export default function LogTab() {
  const today = new Date();

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
      {/* Recovery + suggestion share one card: the suggestion is a consequence
          of the readiness score, so separating them would hide the causation. */}
      <View style={styles.heroCard}>
        <Pressable style={styles.recoveryRow}>
          <Ring value={MOCK.readiness.score} size={44} thickness={4} />
          <View style={styles.recoveryText}>
            <Text style={styles.recoveryHeadline}>{MOCK.readiness.headline}</Text>
            <Text style={styles.recoveryDetail}>{MOCK.readiness.detail}</Text>
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
            <Text style={styles.suggestionName}>{MOCK.suggested.name}</Text>
            <Text style={styles.suggestionMeta}>
              {MOCK.suggested.exerciseCount} exercises · ~{MOCK.suggested.estimatedMinutes} min
            </Text>
          </View>

          <Text style={styles.suggestionWhy}>{MOCK.suggested.why}</Text>

          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start workout</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Build my own workout</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>TRAINING LOG</Text>

      <View style={styles.weekCard}>
        <View style={styles.weekStrip}>
          {WEEK.map((d, i) => (
            <View key={`${d.letter}-${i}`} style={styles.weekDay}>
              <Text style={[styles.weekLetter, d.future && styles.weekDimmed]}>
                {d.letter}
              </Text>
              <View style={[styles.weekDayNumber, d.today && styles.weekDayToday]}>
                <Text
                  style={[
                    styles.weekNumber,
                    d.future && styles.weekDimmed,
                    d.today && styles.weekNumberToday,
                  ]}
                >
                  {d.day}
                </Text>
              </View>
              <View style={styles.weekDot}>
                {d.trained ? <View style={styles.dotFilled} /> : null}
                {d.today ? <View style={styles.dotToday} /> : null}
              </View>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionLabel}>THIS WEEK</Text>

      {MOCK.history.map((w) => (
        <View key={w.id} style={styles.historyCard}>
          <View style={styles.historyTop}>
            <Text style={styles.historyName}>{w.name}</Text>
            <View style={styles.historyActions}>
              {w.prs > 0 ? (
                <View style={styles.prBadge}>
                  <Trophy color={c.record.fg} size={11} />
                  <Text style={styles.prBadgeText}>{w.prs} PB</Text>
                </View>
              ) : null}
              <Pressable style={styles.repeatButton} hitSlop={6}>
                <RotateCcw color={c.fg.secondary} size={15} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.historyMeta}>
            {format(w.date, 'EEE d MMM')} · {w.exercises} exercises
          </Text>

          <View style={styles.historyBottom}>
            <View style={styles.chips}>
              {w.groups.map((g) => (
                <View key={g} style={styles.chip}>
                  <Text style={styles.chipText}>{g.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.historyStats}>
              <Text style={styles.historyStatValue}>{w.volumeKg.toLocaleString()}</Text>
              <Text style={styles.historyStatUnit}>kg</Text>
              <Text style={styles.historyStatUnit}> · </Text>
              <Text style={styles.historyStatValue}>{w.reps}</Text>
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
  dotToday: {
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: c.brand.base,
  },

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
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: c.record.fill,
  },
  prBadgeText: { ...type.caption, fontWeight: '700', color: c.record.fg, fontSize: 11 },
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
