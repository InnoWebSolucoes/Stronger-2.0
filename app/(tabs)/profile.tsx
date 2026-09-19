import { useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Check,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Hash,
  Info,
  Layers,
  Lock,
  LogOut,
  Pencil,
  Repeat,
  Settings,
  Share2,
  Sparkles,
  Timer,
  Trophy,
  Weight,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '@/ui/primitives/Screen';
import { confirm } from '@/ui/primitives/Dialog';
import { ActivityHeatmap } from '@/ui/charts/ActivityHeatmap';
import { Ring } from '@/ui/charts/Ring';
import { ExerciseDemo } from '@/ui/anatomy/ExerciseDemo';
import { c, radius, shadow, space, type } from '@/ui/tokens.bridge';
import { ageOf, useAccount, type Profile, type Sex, type Units } from '@/features/account/store';
import { useWorkout } from '@/features/workout/store';
import { useBodyweight } from '@/features/bodyweight/store';
import {
  BADGE_CATEGORIES,
  CATEGORY_LABEL,
  RARITY_LABEL,
  computeProfileStats,
  evaluateBadges,
  progressLabel,
  type BadgeCategory,
  type EvaluatedBadge,
  type ProfileStats,
  type Rarity,
} from '@/features/profile';
import { formatVolume, kgToLb, lbToKg } from '@core/scoring';
import { phrase, pickEquivalents } from '@core/equivalents';

type TabKey = 'posts' | 'stats' | 'badges';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const RARITY_STYLE: Record<Rarity, { fg: string; bg: string; border: string; solid: boolean }> = {
  common: { fg: c.fg.secondary, bg: c.surface[3], border: c.border.default, solid: false },
  uncommon: { fg: c.positive.text, bg: c.positive.weak, border: c.positive.weak, solid: false },
  rare: { fg: c.action.text, bg: c.action.weak, border: c.action.weak, solid: false },
  epic: { fg: c.brand.text, bg: c.brand.weak, border: c.brand.borderWeak, solid: false },
  legendary: { fg: c.fg.onAccent, bg: c.brand.base, border: c.brand.base, solid: true },
};

export default function ProfileTab() {
  const profile = useAccount((s) => s.profile);
  const update = useAccount((s) => s.update);
  const signOut = useAccount((s) => s.signOut);
  const history = useWorkout((s) => s.history);
  const weighIns = useBodyweight((s) => s.entries.length);

  const [tab, setTab] = useState<TabKey>('stats');
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [category, setCategory] = useState<BadgeCategory | 'all'>('all');

  const bodyweightKg = profile?.bodyweightKg ?? 0;
  const joinedAt = profile?.joinedAt ?? Date.now();

  const stats = useMemo(
    () => computeProfileStats({ history, bodyweightKg, joinedAt, weighIns }),
    [history, bodyweightKg, joinedAt, weighIns],
  );
  const badges = useMemo(() => evaluateBadges(stats), [stats]);
  const earned = useMemo(() => badges.filter((b) => b.earned).length, [badges]);

  const units: Units = profile?.units ?? 'kg';

  if (!profile) {
    return (
      <Screen title="Profile">
        <EmptyState
          icon={Lock}
          title="Not signed in"
          body="Sign in to see your training identity, activity and achievements."
        />
      </Screen>
    );
  }

  const onSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message:
        'Your workouts, bodyweight log and routines stay on this device. Signing back in picks them up again.',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (!ok) return;
    setSettingsOpen(false);
    signOut();
  };

  return (
    <Screen
      title="Profile"
      subtitle={`Member since ${MONTHS[new Date(profile.joinedAt).getMonth()] ?? ''} ${new Date(
        profile.joinedAt,
      ).getFullYear()}`}
      action={
        <Pressable
          onPress={() => setSettingsOpen(true)}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Settings color={c.fg.secondary} size={20} />
        </Pressable>
      }
    >
      <Header
        profile={profile}
        stats={stats}
        editing={editing}
        onEdit={() => setEditing(true)}
        onClose={() => setEditing(false)}
        onSave={(patch) => {
          update(patch);
          setEditing(false);
        }}
      />

      <View style={styles.card}>
        <SectionHeader
          label="Activity"
          trailing={stats.workouts > 0 ? `${stats.workouts} lifetime` : undefined}
        />
        <ActivityHeatmap sessions={stats.sessions} weeks={26} />
      </View>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'posts', label: 'Posts' },
          { key: 'stats', label: 'Stats' },
          { key: 'badges', label: `Badges${earned > 0 ? ` · ${earned}` : ''}` },
        ]}
      />

      {tab === 'stats' ? <StatsTab stats={stats} units={units} /> : null}
      {tab === 'badges' ? (
        <BadgesTab
          badges={badges}
          earned={earned}
          category={category}
          onCategory={setCategory}
        />
      ) : null}
      {tab === 'posts' ? <PostsTab /> : null}

      <SettingsSheet
        open={settingsOpen}
        profile={profile}
        onClose={() => setSettingsOpen(false)}
        onUnits={(u) => update({ units: u })}
        onSignOut={onSignOut}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({
  profile,
  stats,
  editing,
  onEdit,
  onClose,
  onSave,
}: {
  profile: Profile;
  stats: ProfileStats;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  if (editing) return <Editor profile={profile} onCancel={onClose} onSave={onSave} />;

  const age = ageOf(profile);

  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.initials}</Text>
        </View>
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
            </Text>
            {profile.isPro ? (
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.handle}>@{profile.handle}</Text>
          <Text style={styles.meta}>
            {age > 0 ? `${age} · ` : ''}
            {profile.sex === 'male' ? 'Male' : 'Female'} ·{' '}
            {formatBodyweight(profile.bodyweightKg, profile.units)}
          </Text>
        </View>
      </View>

      {profile.bio ? (
        <Text style={styles.bio}>{profile.bio}</Text>
      ) : (
        <Text style={styles.bioEmpty}>
          No bio yet — say what you are training for. It shows on anything you share.
        </Text>
      )}

      <View style={styles.counts}>
        <CountCell value={stats.workouts} label="Workouts" />
        <View style={styles.countDivider} />
        <CountCell value={profile.followers} label="Followers" />
        <View style={styles.countDivider} />
        <CountCell value={profile.following} label="Following" />
      </View>

      <Pressable style={styles.editButton} onPress={onEdit}>
        <Pencil color={c.fg.primary} size={15} />
        <Text style={styles.editButtonText}>Edit profile</Text>
      </Pressable>
    </View>
  );
}

function CountCell({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.countCell}>
      <Text style={styles.countValue}>{value.toLocaleString('en-US')}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inline editor
// ---------------------------------------------------------------------------

type Draft = {
  name: string;
  handle: string;
  bio: string;
  weight: string;
  units: Units;
  sex: Sex;
  birthYear: string;
};

function Editor({
  profile,
  onCancel,
  onSave,
}: {
  profile: Profile;
  onCancel: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    name: profile.name,
    handle: profile.handle,
    bio: profile.bio ?? '',
    weight: displayWeightValue(profile.bodyweightKg, profile.units),
    units: profile.units,
    sex: profile.sex,
    birthYear: String(profile.birthYear),
  }));

  const patch = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));

  const save = () => {
    const name = draft.name.trim() || profile.name;
    const handle =
      draft.handle.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 18) || profile.handle;

    const parsedWeight = Number.parseFloat(draft.weight.replace(',', '.'));
    const bodyweightKg =
      Number.isFinite(parsedWeight) && parsedWeight > 0
        ? draft.units === 'lb'
          ? lbToKg(parsedWeight)
          : parsedWeight
        : profile.bodyweightKg;

    // A birth year outside this range is a typo, not a lifter. Fall back
    // rather than poisoning the age adjustment in the strength standards.
    const thisYear = new Date().getFullYear();
    const parsedYear = Number.parseInt(draft.birthYear, 10);
    const birthYear =
      Number.isFinite(parsedYear) && parsedYear >= 1920 && parsedYear <= thisYear - 13
        ? parsedYear
        : profile.birthYear;

    onSave({
      name,
      handle,
      bio: draft.bio.trim() || undefined,
      initials: initialsOf(name),
      bodyweightKg,
      units: draft.units,
      sex: draft.sex,
      birthYear,
    });
  };

  return (
    <View style={styles.card}>
      <SectionHeader label="Edit profile" />

      <Field label="Name">
        <TextInput
          style={styles.input}
          value={draft.name}
          onChangeText={(v) => patch({ name: v })}
          placeholder="Your name"
          placeholderTextColor={c.fg.disabled}
          autoCapitalize="words"
        />
      </Field>

      <Field label="Handle">
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>@</Text>
          <TextInput
            style={[styles.input, styles.inputFlush]}
            value={draft.handle}
            onChangeText={(v) => patch({ handle: v })}
            placeholder="handle"
            placeholderTextColor={c.fg.disabled}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </Field>

      <Field label="Bio">
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={draft.bio}
          onChangeText={(v) => patch({ bio: v })}
          placeholder="What are you training for?"
          placeholderTextColor={c.fg.disabled}
          multiline
          maxLength={160}
        />
      </Field>

      <View style={styles.fieldRow}>
        <Field label={`Bodyweight (${draft.units})`} style={styles.fieldHalf}>
          <TextInput
            style={styles.input}
            value={draft.weight}
            onChangeText={(v) => patch({ weight: v })}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={c.fg.disabled}
          />
        </Field>
        <Field label="Birth year" style={styles.fieldHalf}>
          <TextInput
            style={styles.input}
            value={draft.birthYear}
            onChangeText={(v) => patch({ birthYear: v.replace(/[^0-9]/g, '').slice(0, 4) })}
            keyboardType="number-pad"
            placeholder="1998"
            placeholderTextColor={c.fg.disabled}
          />
        </Field>
      </View>

      <Field label="Units">
        <Choice
          value={draft.units}
          options={[
            { key: 'kg', label: 'Kilograms' },
            { key: 'lb', label: 'Pounds' },
          ]}
          onChange={(u) => {
            // Convert the field the user is looking at so the number keeps
            // meaning the same thing. Storage stays kilograms either way.
            const current = Number.parseFloat(draft.weight.replace(',', '.'));
            const converted = Number.isFinite(current)
              ? u === 'lb'
                ? kgToLb(current)
                : lbToKg(current)
              : null;
            patch({
              units: u,
              weight: converted === null ? draft.weight : round1(converted),
            });
          }}
        />
      </Field>

      <Field label="Sex">
        <Choice
          value={draft.sex}
          options={[
            { key: 'male', label: 'Male' },
            { key: 'female', label: 'Female' },
          ]}
          onChange={(s) => patch({ sex: s })}
        />
        <Text style={styles.fieldNote}>
          Used only by the strength standards, which are sex- and age-specific.
        </Text>
      </Field>

      <View style={styles.editorActions}>
        <Pressable style={styles.secondaryButton} onPress={onCancel}>
          <X color={c.fg.primary} size={15} />
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={save}>
          <Check color={c.fg.onAccent} size={16} />
          <Text style={styles.primaryButtonText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function StatsTab({ stats, units }: { stats: ProfileStats; units: Units }) {
  const equivalent = useMemo(() => {
    if (stats.volumeKg <= 0) return null;
    const picks = pickEquivalents(stats.volumeKg, {
      sessionIndex: Math.max(1, stats.workouts),
      want: 2,
    });
    const a = picks[0];
    const b = picks[1];
    if (!a) return null;
    return b ? `That is ${phrase(a)} — or ${phrase(b)}.` : `That is ${phrase(a)}.`;
  }, [stats.volumeKg, stats.workouts]);

  if (stats.workouts === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="No sessions logged yet"
        body="Lifetime totals, best lifts and your weekly consistency appear here the moment you finish your first workout. Nothing is estimated — every number on this screen comes from sets you ticked off."
      />
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.tileGrid}>
        <Tile icon={Dumbbell} label="Workouts" value={stats.workouts.toLocaleString('en-US')} />
        <Tile
          icon={Weight}
          label="Volume"
          value={compactWeight(stats.volumeKg, units)}
          sub={formatVolume(stats.volumeKg, units)}
        />
        <Tile icon={Repeat} label="Reps" value={compact(stats.reps)} sub={`${stats.sets.toLocaleString('en-US')} sets`} />
        <Tile icon={Clock} label="Time training" value={compactHours(stats.seconds)} />
        <Tile icon={Trophy} label="Records" value={stats.prs.toLocaleString('en-US')} sub="personal bests" />
        <Tile
          icon={Timer}
          label="Avg session"
          value={shortDuration(stats.avgSessionSec)}
          sub={`longest ${shortDuration(stats.longestSessionSec)}`}
        />
      </View>

      {equivalent ? (
        <View style={styles.callout}>
          <Sparkles color={c.brand.text} size={16} />
          <Text style={styles.calloutText}>{equivalent}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <SectionHeader label="Consistency" trailing={`${stats.weeklyTarget}× / week target`} />
        <View style={styles.streakRow}>
          <View style={styles.streakMain}>
            <Flame color={c.brand.base} size={22} />
            <Text style={styles.streakValue}>{stats.currentWeekStreak}</Text>
            <Text style={styles.streakUnit}>
              {stats.currentWeekStreak === 1 ? 'week' : 'weeks'}
            </Text>
          </View>
          <View style={styles.streakSide}>
            <Text style={styles.streakSideValue}>{stats.longestWeekStreak}</Text>
            <Text style={styles.streakSideLabel}>Best run</Text>
          </View>
          <View style={styles.streakSide}>
            <Text style={styles.streakSideValue}>{stats.activeWeeks}</Text>
            <Text style={styles.streakSideLabel}>Active weeks</Text>
          </View>
        </View>

        <WeekStrip weeks={stats.weeks} />

        <Text style={styles.note}>
          Weeks, not days. A rest day is part of training, so it cannot break
          anything — a week counts when it hits your own typical{' '}
          {stats.weeklyTarget} session{stats.weeklyTarget === 1 ? '' : 's'}, and the
          week in progress never breaks a run.
        </Text>
      </View>

      <View style={styles.card}>
        <SectionHeader label="Best lifts" trailing="estimated 1RM" />
        {stats.bestLifts.length === 0 ? (
          <Text style={styles.note}>
            No working sets with both a load and a rep count yet.
          </Text>
        ) : (
          stats.bestLifts.slice(0, 5).map((lift) => (
            <View key={lift.exerciseId} style={styles.liftRow}>
              <View style={styles.liftDemo}>
                <ExerciseDemo exerciseId={lift.exerciseId} size={40} animated={false} />
              </View>
              <View style={styles.liftText}>
                <Text style={styles.liftName} numberOfLines={1}>
                  {lift.name}
                </Text>
                <Text style={styles.liftMeta}>
                  {formatLoad(lift.weightKg, units)} × {lift.reps} · {shortDate(lift.at)}
                </Text>
              </View>
              <Text style={styles.liftValue}>{formatLoad(lift.e1rmKg, units)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <SectionHeader label="Training profile" />
        <Row
          icon={Dumbbell}
          label="Favourite exercise"
          value={stats.favouriteExercise?.name ?? '—'}
          sub={
            stats.favouriteExercise
              ? `${stats.favouriteExercise.sessions} sessions`
              : 'no repeats yet'
          }
        />
        <Row
          icon={Layers}
          label="Most-trained muscle"
          value={stats.topMuscle?.name ?? '—'}
          sub={stats.topMuscle ? `${stats.topMuscle.sets} sets` : 'nothing logged'}
        />
        <Row
          icon={Weight}
          label="Biggest session"
          value={formatVolume(stats.biggestSessionKg, units)}
          sub={`${stats.mostSetsInSession} sets at most`}
        />
        <Row
          icon={Hash}
          label="Variety"
          value={`${stats.distinctExercises} exercises`}
          sub={`${stats.distinctMuscles} of ${stats.muscleGroupsTotal} muscle groups`}
        />
        <Row
          icon={Flame}
          label="Training days"
          value={`${stats.trainingDays}`}
          sub={`across ${stats.trainingMonths} month${stats.trainingMonths === 1 ? '' : 's'}`}
        />
      </View>

      <View style={styles.methodology}>
        <Info color={c.fg.tertiary} size={14} />
        <Text style={styles.methodologyText}>
          Estimated 1RMs use the Epley equation on your best working set of a
          session. A record counts only when it beats the previous best by more
          than 0.5 kg, and only once per exercise per session. Warm-ups are
          excluded from every total.
        </Text>
      </View>
    </View>
  );
}

/** The last twelve weeks as bars: filled when the week met the target. */
function WeekStrip({ weeks }: { weeks: ProfileStats['weeks'] }) {
  const recent = weeks.slice(-12);
  if (recent.length === 0) return null;
  const peak = Math.max(1, ...recent.map((w) => w.sessions));

  return (
    <View style={styles.strip}>
      {recent.map((w) => {
        const height = 6 + Math.round((w.sessions / peak) * 22);
        return (
          <View key={w.start} style={styles.stripSlot}>
            <View
              style={[
                styles.stripBar,
                {
                  height,
                  backgroundColor: w.qualified ? c.brand.base : c.surface[4],
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function BadgesTab({
  badges,
  earned,
  category,
  onCategory,
}: {
  badges: EvaluatedBadge[];
  earned: number;
  category: BadgeCategory | 'all';
  onCategory: (v: BadgeCategory | 'all') => void;
}) {
  const shown = useMemo(
    () => (category === 'all' ? badges : badges.filter((b) => b.def.category === category)),
    [badges, category],
  );

  const rarityCounts = useMemo(() => {
    const out = new Map<Rarity, { earned: number; total: number }>();
    for (const b of badges) {
      const bucket = out.get(b.def.rarity) ?? { earned: 0, total: 0 };
      bucket.total += 1;
      if (b.earned) bucket.earned += 1;
      out.set(b.def.rarity, bucket);
    }
    return out;
  }, [badges]);

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.badgeSummary}>
          <Ring
            value={earned}
            max={badges.length}
            size={72}
            thickness={7}
            color={c.brand.base}
            label={`${earned}`}
          />
          <View style={styles.badgeSummaryText}>
            <Text style={styles.badgeSummaryTitle}>
              {earned} of {badges.length} earned
            </Text>
            <Text style={styles.note}>
              {earned === 0
                ? 'Nothing is handed out for signing up. Every badge below has a stated bar, measured against your own log.'
                : 'Earned badges show in full colour. Locked ones keep their criterion visible so you can see what is left.'}
            </Text>
          </View>
        </View>

        <View style={styles.rarityRow}>
          {(['common', 'uncommon', 'rare', 'epic', 'legendary'] as Rarity[]).map((r) => {
            const counts = rarityCounts.get(r);
            if (!counts) return null;
            const st = RARITY_STYLE[r];
            return (
              <View key={r} style={[styles.rarityChip, { borderColor: st.border }]}>
                <View style={[styles.rarityDot, { backgroundColor: st.solid ? st.bg : st.fg }]} />
                <Text style={styles.rarityChipText}>
                  {counts.earned}/{counts.total}
                </Text>
                <Text style={styles.rarityChipLabel}>{RARITY_LABEL[r]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip
          label="All"
          active={category === 'all'}
          onPress={() => onCategory('all')}
        />
        {BADGE_CATEGORIES.map((key) => (
          <FilterChip
            key={key}
            label={CATEGORY_LABEL[key]}
            active={category === key}
            onPress={() => onCategory(key)}
          />
        ))}
      </ScrollView>

      {shown.map((badge) => (
        <BadgeCard key={badge.def.id} badge={badge} />
      ))}
    </View>
  );
}

function BadgeCard({ badge }: { badge: EvaluatedBadge }) {
  const st = RARITY_STYLE[badge.def.rarity];
  const Icon = badge.def.icon;
  const locked = !badge.earned;

  return (
    <View style={[styles.badgeCard, badge.earned && { borderColor: st.border }]}>
      <View
        style={[
          styles.badgeIcon,
          {
            backgroundColor: locked ? c.surface[2] : st.bg,
            borderColor: locked ? c.border.default : st.border,
          },
        ]}
      >
        {locked ? (
          <Lock color={c.fg.disabled} size={18} />
        ) : (
          <Icon color={st.fg} size={20} />
        )}
      </View>

      <View style={styles.badgeBody}>
        <View style={styles.badgeTitleRow}>
          <Text style={[styles.badgeName, locked && styles.badgeNameLocked]} numberOfLines={1}>
            {badge.def.name}
          </Text>
          <Text style={[styles.badgeRarity, { color: locked ? c.fg.disabled : st.fg }]}>
            {RARITY_LABEL[badge.def.rarity]}
          </Text>
        </View>

        <Text style={styles.badgeCopy}>
          {badge.earned ? badge.def.blurb : badge.def.criterion}
        </Text>

        {locked && badge.countable ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { flex: Math.max(0.0001, badge.progress), backgroundColor: st.fg },
                ]}
              />
              <View style={{ flex: Math.max(0.0001, 1 - badge.progress) }} />
            </View>
            <Text style={styles.progressText}>{progressLabel(badge)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

function PostsTab() {
  return (
    <View style={styles.stack}>
      <EmptyState
        icon={Share2}
        title="Nothing shared yet"
        body="Sharing a finished workout is not built. When it is, each post will show the session name, its duration, volume, the lifts you hit and any records you set — and it will only ever leave this device when you tap share."
      />
      <View style={styles.card}>
        <SectionHeader label="What a post will carry" />
        <Row icon={Dumbbell} label="Session" value="Name, date, duration" />
        <Row icon={Weight} label="Work" value="Volume, sets, reps" />
        <Row icon={Trophy} label="Records" value="Any PRs from that session" />
        <Text style={styles.note}>
          Progress photos are never attached automatically. They are health data
          and stay on-device behind a separate consent.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsSheet({
  open,
  profile,
  onClose,
  onUnits,
  onSignOut,
}: {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onUnits: (u: Units) => void;
  onSignOut: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Settings</Text>
            <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="Close">
              <X color={c.fg.secondary} size={18} />
            </Pressable>
          </View>

          <Field label="Units">
            <Choice
              value={profile.units}
              options={[
                { key: 'kg', label: 'Kilograms' },
                { key: 'lb', label: 'Pounds' },
              ]}
              onChange={onUnits}
            />
            <Text style={styles.fieldNote}>
              Everything is stored in kilograms. This only changes what is
              displayed, so switching never rounds a logged weight.
            </Text>
          </Field>

          <View style={styles.sheetNote}>
            <Info color={c.fg.tertiary} size={14} />
            <Text style={styles.methodologyText}>
              Nothing here is uploaded. Workouts, bodyweight and routines live on
              this device until cloud sync ships.
            </Text>
          </View>

          <Pressable style={styles.signOut} onPress={onSignOut}>
            <LogOut color={c.negative.text} size={16} />
            <Text style={styles.signOutText}>Sign out</Text>
            <ChevronRight color={c.negative.text} size={16} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionHeader({ label, trailing }: { label: string; trailing?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.overline}>{label.toUpperCase()}</Text>
      {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
    </View>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.tile}>
      <Icon color={c.fg.tertiary} size={15} />
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {sub ? (
        <Text style={styles.tileSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.row}>
      <Icon color={c.fg.tertiary} size={16} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.choice}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.choiceOption, active && styles.choiceOptionActive]}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
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
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Icon color={c.fg.tertiary} size={22} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const second = parts[1];
  if (first && second) return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase();
  return (first ?? 'ST').slice(0, 2).toUpperCase();
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function displayWeightValue(kg: number, units: Units): string {
  return round1(units === 'lb' ? kgToLb(kg) : kg);
}

function formatBodyweight(kg: number, units: Units): string {
  return `${displayWeightValue(kg, units)} ${units}`;
}

function formatLoad(kg: number, units: Units): string {
  const value = units === 'lb' ? kgToLb(kg) : kg;
  return `${Math.round(value * 10) / 10} ${units}`;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString('en-US');
}

function compactWeight(kg: number, units: Units): string {
  const value = units === 'lb' ? kgToLb(kg) : kg;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M ${units}`;
  if (value >= 10_000) return `${Math.round(value / 1000).toLocaleString('en-US')}k ${units}`;
  return `${Math.round(value).toLocaleString('en-US')} ${units}`;
}

function compactHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 100) return `${Math.round(hours)}h`;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}

function shortDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

function shortDate(ts: number): string {
  const d = new Date(ts);
  const month = MONTHS[d.getMonth()]?.slice(0, 3) ?? '';
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  stack: { gap: space.md },

  card: {
    backgroundColor: c.surface[1],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.lg,
    gap: space.md,
    marginBottom: space.md,
    ...shadow[1],
  },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface[2],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },

  // header ------------------------------------------------------------------
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: c.brand.weak,
    borderWidth: 1,
    borderColor: c.brand.borderWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.title, color: c.brand.text, letterSpacing: 0.5 },
  identityText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.title, color: c.fg.primary, flexShrink: 1 },
  proBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: c.brand.base,
  },
  proText: { ...type.overline, fontSize: 10, color: c.fg.onAccent },
  handle: { ...type.body, color: c.action.text },
  meta: { ...type.caption, color: c.fg.tertiary, fontVariant: ['tabular-nums'] },

  bio: { ...type.body, color: c.fg.secondary },
  bioEmpty: { ...type.body, color: c.fg.disabled, fontStyle: 'italic' },

  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg.sunken,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  countCell: { flex: 1, alignItems: 'center', gap: 2 },
  countDivider: { width: 1, height: 26, backgroundColor: c.border.subtle },
  countValue: {
    ...type.heading,
    color: c.fg.primary,
    fontSize: 19,
    fontVariant: ['tabular-nums'],
  },
  countLabel: { ...type.caption, color: c.fg.tertiary, fontSize: 12 },

  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.strong,
  },
  editButtonText: { ...type.bodyStrong, color: c.fg.primary },

  // editor ------------------------------------------------------------------
  field: { gap: space.xs },
  fieldRow: { flexDirection: 'row', gap: space.md },
  fieldHalf: { flex: 1 },
  fieldLabel: { ...type.overline, color: c.fg.tertiary },
  fieldNote: { ...type.caption, color: c.fg.tertiary },
  input: {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: c.surface[3],
    color: c.fg.primary,
    paddingHorizontal: space.md,
    fontSize: 15,
  },
  inputFlush: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: c.surface[3],
    paddingHorizontal: space.md,
  },
  inputPrefix: { ...type.body, color: c.fg.tertiary },
  inputMultiline: { height: 84, paddingTop: space.md, textAlignVertical: 'top' },
  editorActions: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: c.brand.base,
  },
  primaryButtonText: { ...type.bodyStrong, color: c.fg.onAccent },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.strong,
  },
  secondaryButtonText: { ...type.bodyStrong, color: c.fg.primary },

  // section -----------------------------------------------------------------
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overline: { ...type.overline, color: c.fg.tertiary },
  sectionTrailing: {
    ...type.caption,
    color: c.fg.tertiary,
    fontVariant: ['tabular-nums'],
  },

  // segmented ---------------------------------------------------------------
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.bg.sunken,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
    marginBottom: space.md,
  },
  segment: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: c.surface[3] },
  segmentText: { ...type.bodyStrong, color: c.fg.tertiary, fontSize: 14 },
  segmentTextActive: { color: c.fg.primary },

  choice: { flexDirection: 'row', gap: space.sm },
  choiceOption: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOptionActive: { borderColor: c.brand.base, backgroundColor: c.brand.weak },
  choiceText: { ...type.body, color: c.fg.secondary },
  choiceTextActive: { color: c.brand.text, fontWeight: '600' },

  // tiles -------------------------------------------------------------------
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: c.surface[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.md,
    gap: 2,
  },
  tileValue: {
    ...type.metric,
    fontSize: 21,
    lineHeight: 26,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
    marginTop: space.xs,
  },
  tileLabel: { ...type.caption, color: c.fg.secondary, fontSize: 12 },
  tileSub: { ...type.caption, color: c.fg.tertiary, fontSize: 11, fontVariant: ['tabular-nums'] },

  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: c.brand.weak,
    borderWidth: 1,
    borderColor: c.brand.borderWeak,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  calloutText: { ...type.body, color: c.brand.text, flex: 1 },

  // consistency -------------------------------------------------------------
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  streakMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  streakValue: {
    ...type.display,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  streakUnit: { ...type.body, color: c.fg.tertiary },
  streakSide: { alignItems: 'flex-end', minWidth: 62 },
  streakSideValue: {
    ...type.heading,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  streakSideLabel: { ...type.caption, color: c.fg.tertiary, fontSize: 11 },

  strip: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 30 },
  stripSlot: { flex: 1, justifyContent: 'flex-end' },
  stripBar: { borderRadius: 2, width: '100%' },

  note: { ...type.caption, color: c.fg.tertiary },

  // lifts -------------------------------------------------------------------
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  liftDemo: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: c.bg.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liftText: { flex: 1, gap: 1 },
  liftName: { ...type.bodyStrong, color: c.fg.primary },
  liftMeta: { ...type.caption, color: c.fg.tertiary, fontVariant: ['tabular-nums'] },
  liftValue: {
    ...type.heading,
    color: c.brand.text,
    fontVariant: ['tabular-nums'],
  },

  // rows --------------------------------------------------------------------
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowLabel: { ...type.body, color: c.fg.secondary, flex: 1 },
  rowValueWrap: { alignItems: 'flex-end', maxWidth: '55%' },
  rowValue: {
    ...type.bodyStrong,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  rowSub: { ...type.caption, color: c.fg.tertiary, fontSize: 11, fontVariant: ['tabular-nums'] },

  methodology: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    paddingHorizontal: space.xs,
    marginBottom: space.lg,
  },
  methodologyText: { ...type.caption, color: c.fg.tertiary, flex: 1 },

  // badges ------------------------------------------------------------------
  badgeSummary: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  badgeSummaryText: { flex: 1, gap: space.xs },
  badgeSummaryTitle: {
    ...type.heading,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  rarityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rarityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rarityDot: { width: 7, height: 7, borderRadius: 4 },
  rarityChipText: {
    ...type.caption,
    color: c.fg.primary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rarityChipLabel: { ...type.caption, color: c.fg.tertiary, fontSize: 11 },

  filterRow: { gap: space.sm, paddingBottom: space.md, paddingRight: space.lg },
  filterChip: {
    paddingHorizontal: space.md,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.surface[1],
  },
  filterChipActive: { backgroundColor: c.brand.weak, borderColor: c.brand.borderWeak },
  filterChipText: { ...type.caption, color: c.fg.secondary, fontWeight: '600' },
  filterChipTextActive: { color: c.brand.text },

  badgeCard: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: c.surface[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.md,
    marginBottom: space.sm,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeBody: { flex: 1, gap: 3 },
  badgeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badgeName: { ...type.bodyStrong, color: c.fg.primary, flex: 1 },
  badgeNameLocked: { color: c.fg.secondary },
  badgeRarity: { ...type.overline, fontSize: 10 },
  badgeCopy: { ...type.caption, color: c.fg.tertiary },
  progressWrap: { gap: 4, marginTop: space.xs },
  progressTrack: {
    flexDirection: 'row',
    height: 5,
    borderRadius: 3,
    backgroundColor: c.viz.track,
    overflow: 'hidden',
  },
  progressFill: { borderRadius: 3 },
  progressText: {
    ...type.caption,
    color: c.fg.tertiary,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  // empty -------------------------------------------------------------------
  emptyState: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surface[1],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.subtle,
    borderStyle: 'dashed',
    padding: space.xl,
    marginBottom: space.md,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: c.surface[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...type.heading, color: c.fg.primary, textAlign: 'center' },
  emptyBody: { ...type.caption, color: c.fg.tertiary, textAlign: 'center' },

  // settings ----------------------------------------------------------------
  scrim: {
    flex: 1,
    backgroundColor: c.bg.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    backgroundColor: c.surface[2],
    borderWidth: 1,
    borderColor: c.border.default,
    padding: space.xl,
    gap: space.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { ...type.title, color: c.fg.primary },
  sheetNote: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: c.negative.weak,
    borderWidth: 1,
    borderColor: c.negative.weak,
  },
  signOutText: { ...type.bodyStrong, color: c.negative.text, flex: 1 },
});
