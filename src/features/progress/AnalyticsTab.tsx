import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Activity, BarChart3, Dumbbell, Flame, Timer, Trophy } from 'lucide-react-native';
import { READINESS_BANDS, type MuscleReadiness } from '@core/readiness';
import { STANDARDS_META } from '@core/standards';
import { Ring } from '@/ui/charts/Ring';
import { Sparkline } from '@/ui/charts/Sparkline';
import { DistributionCurve } from '@/ui/charts/DistributionCurve';
import { ExerciseDemo } from '@/ui/anatomy/ExerciseDemo';
import { c, radius, space, type } from '@/ui/tokens.bridge';
import type { CompletedWorkout } from '@/features/workout/types';
import { ageOf, type Profile } from '@/features/account/store';
import {
  RANGE_NOUN,
  changeOverRange,
  journeyStats,
  rangeStart,
  strengthProfile,
  summariseLifts,
  trainingSplit,
  type LiftSummary,
  type RangeKey,
} from './analytics';
import { readinessView } from './readiness';
import { labelForMuscleId } from './mapping';
import {
  E1RM_DISCLOSURE,
  PERCENTILE_DISCLOSURE,
  RANK_DISCLOSURE,
  READINESS_DISCLOSURE,
  SPLIT_DISCLOSURE,
} from './methodology';
import { Card, EmptyState, HowChip, RangeBar, SectionHeader, ShareBar, StatTile } from './ui';
import * as fmt from './format';

export function AnalyticsTab({
  history,
  profile,
  range,
  onRangeChange,
  now,
}: {
  history: readonly CompletedWorkout[];
  profile: Profile | null;
  range: RangeKey;
  onRangeChange: (next: RangeKey) => void;
  now: number;
}) {
  const units = profile?.units ?? 'kg';
  const bodyweightKg = profile?.bodyweightKg ?? null;

  const lifts = useMemo(() => summariseLifts(history, bodyweightKg), [history, bodyweightKg]);
  const from = useMemo(() => rangeStart(range, now), [range, now]);

  const standing = useMemo(() => {
    if (profile === null) return null;
    return strengthProfile(
      lifts,
      { sex: profile.sex, bodyweightKg: profile.bodyweightKg, age: ageOf(profile, now) },
      now,
    );
  }, [lifts, profile, now]);

  const readiness = useMemo(() => readinessView(history, now), [history, now]);
  const journey = useMemo(() => journeyStats(history, lifts, from), [history, lifts, from]);
  const split = useMemo(() => trainingSplit(history, from, bodyweightKg), [history, from, bodyweightKg]);

  const rangedLifts = useMemo(() => {
    const scored = lifts
      .filter((l) => l.points.length > 0)
      .map((lift) => ({ lift, change: changeOverRange(lift, from) }));
    const touched = scored.filter((s) => s.lift.lastPerformedAt >= from);
    return (touched.length > 0 ? touched : scored).slice(0, 12);
  }, [lifts, from]);

  if (history.length === 0) {
    return (
      <>
        <EmptyState
          icon={<BarChart3 color={c.brand.base} size={22} />}
          title="No training logged yet"
          body="Finish your first workout and this fills in: your strength rank against 27 million lifters, an e1RM trend for every lift, muscle readiness, and where your volume is actually going."
          hint="Nothing here is estimated from a survey — it all comes from sets you log."
        />
        <ReadinessPreview readiness={readiness.muscles} />
      </>
    );
  }

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      <SectionHeader title="STRENGTH PROFILE" disclosure={RANK_DISCLOSURE} />
      <StrengthCard standing={standing} lifts={lifts} />

      {/* ---------------------------------------------------------------- */}
      <View style={styles.rangeWrap}>
        <RangeBar value={range} onChange={onRangeChange} />
      </View>

      {/* ---------------------------------------------------------------- */}
      <SectionHeader title="YOUR LIFTS" disclosure={E1RM_DISCLOSURE} />
      {rangedLifts.length === 0 ? (
        <Card>
          <Text style={styles.quietTitle}>No estimable lifts yet</Text>
          <Text style={styles.quietBody}>
            A one-rep-max estimate needs a completed working set of twelve reps or fewer. Warm-ups and
            unticked sets are ignored on purpose.
          </Text>
        </Card>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.liftRow}
        >
          {rangedLifts.map(({ lift, change }) => (
            <LiftCard
              key={lift.exerciseId}
              lift={lift}
              deltaKg={change.deltaKg}
              from={from}
              units={units}
              now={now}
            />
          ))}
        </ScrollView>
      )}

      {/* ---------------------------------------------------------------- */}
      <SectionHeader title="MUSCLE READINESS" disclosure={READINESS_DISCLOSURE} />
      <Card>
        <Text style={styles.recommendation}>{readiness.recommendation}</Text>
        {readiness.trained.length === 0 ? (
          <Text style={styles.quietBody}>
            Nothing has been trained in the last three weeks, so every muscle reads as fully recovered.
          </Text>
        ) : (
          <View style={styles.chipWrap}>
            {readiness.trained.slice(0, 12).map((m) => (
              <View key={m.muscle} style={styles.readinessChip}>
                <View style={[styles.readinessDot, { backgroundColor: readinessColor(m.pct) }]} />
                <Text style={styles.readinessLabel}>{labelForMuscleId(m.muscle)}</Text>
                <Text style={[styles.readinessPct, { color: readinessColor(m.pct) }]}>
                  {Math.round(m.pct)}%
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* ---------------------------------------------------------------- */}
      <SectionHeader title="JOURNEY" />
      <View style={styles.tileGrid}>
        <StatTile
          label="Workouts"
          value={fmt.count(journey.all.workouts)}
          sub={deltaSub(journey.delta.workouts, range, 'session')}
        />
        <StatTile
          label="Volume lifted"
          value={fmt.compactVolume(journey.all.volumeKg, units)}
          unit={units}
          sub={
            journey.delta.volumeKg > 0
              ? `+${fmt.compactVolume(journey.delta.volumeKg, units)} ${RANGE_NOUN[range]}`
              : `Nothing ${RANGE_NOUN[range]}`
          }
        />
        <StatTile
          label="Records set"
          value={fmt.count(journey.all.prs)}
          tone={journey.delta.prs > 0 ? 'brand' : 'neutral'}
          sub={deltaSub(journey.delta.prs, range, 'PR')}
        />
        <StatTile
          label="Time training"
          value={fmt.duration(journey.all.seconds)}
          sub={
            journey.delta.seconds > 0
              ? `+${fmt.duration(journey.delta.seconds)} ${RANGE_NOUN[range]}`
              : `Nothing ${RANGE_NOUN[range]}`
          }
        />
      </View>

      {/* ---------------------------------------------------------------- */}
      <SectionHeader title="TRAINING SPLIT" disclosure={SPLIT_DISCLOSURE} />
      {split.length === 0 ? (
        <Card>
          <Text style={styles.quietTitle}>Nothing logged {RANGE_NOUN[range]}</Text>
          <Text style={styles.quietBody}>Pick a longer range, or train something.</Text>
        </Card>
      ) : (
        <Card>
          {split.slice(0, 8).map((slice) => (
            <View key={slice.label} style={styles.splitRow}>
              <View style={styles.splitHead}>
                <Text style={styles.splitLabel}>{slice.label}</Text>
                <Text style={styles.splitPct}>{fmt.percent(slice.share)}</Text>
              </View>
              <ShareBar share={slice.share / maxShare(split)} baseline={slice.baselineShare / maxShare(split)} />
            </View>
          ))}
          <Text style={styles.splitNote}>{splitNote(split, range)}</Text>
        </Card>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function StrengthCard({
  standing,
  lifts,
}: {
  standing: ReturnType<typeof strengthProfile>;
  lifts: readonly LiftSummary[];
}) {
  if (standing === null) {
    return (
      <Card>
        <View style={styles.rankRow}>
          <Ring value={0} max={100} size={92} thickness={7} color={c.fg.disabled} label="—" />
          <View style={styles.rankText}>
            <Text style={styles.rankLabel}>Not enough data yet</Text>
            <Text style={styles.quietBody}>
              {lifts.length === 0
                ? 'Log a squat, bench, deadlift, press, row or pull-up and your world standing appears here.'
                : 'None of the lifts you have logged have a published strength table yet. Log one of the six main compound patterns to be ranked.'}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const { standing: overall } = standing;
  const calibrating = overall.state === 'calibrating';
  const rank = overall.rank;
  const rangeLo = overall.rangeLabels[0];
  const rangeHi = overall.rangeLabels[1];

  return (
    <Card>
      <View style={styles.rankRow}>
        <Ring
          value={calibrating ? 100 : rank.progress * 100}
          max={100}
          size={92}
          thickness={7}
          color={calibrating ? c.fg.disabled : c.brand.base}
          label={calibrating ? '?' : String(Math.round(rank.score))}
          sublabel={calibrating ? 'calibrating' : 'points'}
        />
        <View style={styles.rankText}>
          <Text style={styles.rankLabel}>{calibrating ? 'Not enough data yet' : rank.label}</Text>
          {calibrating ? (
            <Text style={styles.quietBody}>
              Somewhere between {rangeLo} and {rangeHi}. Log a main lift in each pattern across two
              sessions to settle it.
            </Text>
          ) : (
            <>
              <Text style={styles.rankSub}>
                Top {rank.topPercent < 1 ? rank.topPercent.toFixed(1) : Math.round(rank.topPercent)}%{' '}
                {STANDARDS_META.populationLabel.replace('vs. ', 'of ')}
              </Text>
              {rank.pointsToNext === null || rank.nextLabel === null ? (
                <Text style={styles.rankNext}>Top of the ladder.</Text>
              ) : (
                <Text style={styles.rankNext}>
                  <Text style={styles.rankNextNumber}>{rank.pointsToNext.toFixed(1)} pts</Text> to{' '}
                  {rank.nextLabel}
                </Text>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.curveWrap}>
        <DistributionCurve z={overall.z} bandZ={overall.sdZ} height={96} />
        <View style={styles.curveFooter}>
          <Text style={styles.curveCaption}>
            {calibrating
              ? `${overall.patternsCovered} of 6 movement patterns measured`
              : `${fmt.percent(overall.percentile.percentile / 100, 0)} percentile · ${overall.patternsCovered} of 6 patterns measured`}
          </Text>
          {/* The percentile is a separate calculation from the rank and needs
              its own disclosure — Apple Guideline 1.4.1. */}
          <HowChip disclosure={PERCENTILE_DISCLOSURE} />
        </View>
      </View>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function LiftCard({
  lift,
  deltaKg,
  from,
  units,
  now,
}: {
  lift: LiftSummary;
  deltaKg: number | null;
  from: number;
  units: 'kg' | 'lb';
  now: number;
}) {
  const inRange = lift.points.filter((p) => p.at >= from);
  const series = (inRange.length >= 2 ? inRange : lift.points).map((p) => p.e1rmKg);
  const tone = deltaKg === null ? c.viz.flat : deltaKg > 0 ? c.viz.up : deltaKg < 0 ? c.viz.down : c.viz.flat;

  return (
    <View style={styles.liftCard}>
      <View style={styles.liftHead}>
        <ExerciseDemo exerciseId={lift.exerciseId} size={38} animated={false} />
        <Text style={styles.liftName} numberOfLines={2}>
          {lift.name}
        </Text>
      </View>

      <View style={styles.liftValueRow}>
        <Text style={styles.liftValue}>{fmt.weightValue(lift.currentE1rmKg, units) ?? '—'}</Text>
        <Text style={styles.liftUnit}>{units}</Text>
      </View>
      <Text style={styles.liftCaption}>estimated 1RM</Text>

      <View style={styles.liftFooter}>
        <Sparkline values={series} width={76} height={26} color={tone} />
        <Text style={[styles.liftDelta, { color: tone }]}>{fmt.delta(deltaKg, units) ?? 'new'}</Text>
      </View>
      <Text style={styles.liftMeta}>{fmt.sinceLabel(lift.lastPerformedAt, now)}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function ReadinessPreview({ readiness }: { readiness: readonly MuscleReadiness[] }) {
  return (
    <View style={styles.previewWrap}>
      <Text style={styles.previewLabel}>WHAT YOU WILL SEE</Text>
      <View style={styles.previewRow}>
        <PreviewItem icon={<Trophy color={c.brand.base} size={16} />} text="Rank & percentile" />
        <PreviewItem icon={<Activity color={c.positive.text} size={16} />} text="Muscle readiness" />
        <PreviewItem icon={<Dumbbell color={c.action.text} size={16} />} text="Per-lift e1RM" />
        <PreviewItem icon={<Flame color={c.brand.text} size={16} />} text="Volume split" />
        <PreviewItem icon={<Timer color={c.fg.secondary} size={16} />} text="Time training" />
      </View>
      <Text style={styles.previewHint}>
        {readiness.length} muscles tracked · readiness starts at 100% and moves only when you train.
      </Text>
    </View>
  );
}

function PreviewItem({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.previewItem}>
      {icon}
      <Text style={styles.previewItemText}>{text}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function readinessColor(pct: number): string {
  if (pct >= READINESS_BANDS.ready) return c.readiness.full;
  if (pct >= READINESS_BANDS.moderate) return c.readiness.partial;
  if (pct >= READINESS_BANDS.deepFatigue) return c.readiness.low;
  return c.negative.text;
}

function deltaSub(value: number, range: RangeKey, noun: string): string {
  if (value <= 0) return `None ${RANGE_NOUN[range]}`;
  return `+${value} ${noun}${value === 1 ? '' : 's'} ${RANGE_NOUN[range]}`;
}

function maxShare(split: readonly { share: number }[]): number {
  return split.reduce((acc, s) => Math.max(acc, s.share), 0.0001);
}

function splitNote(
  split: readonly { label: string; deltaPoints: number }[],
  range: RangeKey,
): string {
  const sorted = [...split].sort((a, b) => b.deltaPoints - a.deltaPoints);
  const most = sorted[0];
  const least = sorted[sorted.length - 1];
  if (most === undefined || least === undefined) return '';
  if (Math.abs(most.deltaPoints) < 3 && Math.abs(least.deltaPoints) < 3) {
    return `Balanced ${RANGE_NOUN[range]} — every muscle is within 3 points of your usual split.`;
  }
  const parts: string[] = [];
  if (most.deltaPoints >= 3) {
    parts.push(`${most.label} is up ${Math.round(most.deltaPoints)} points on your average`);
  }
  if (least.deltaPoints <= -3) {
    parts.push(`${least.label} is down ${Math.round(Math.abs(least.deltaPoints))}`);
  }
  return `${parts.join('; ')}. Compared against your own all-time split, not a template.`;
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  rangeWrap: { marginTop: space['2xl'] },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  rankText: { flex: 1, gap: 2 },
  rankLabel: { ...type.title, color: c.fg.primary },
  rankSub: { ...type.caption, color: c.fg.tertiary },
  rankNext: { ...type.caption, color: c.fg.secondary, marginTop: space.xs },
  rankNextNumber: { color: c.brand.text, fontWeight: '700', fontVariant: ['tabular-nums'] },

  curveWrap: { marginTop: space.lg },
  curveFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  curveCaption: { ...type.caption, color: c.fg.tertiary, flex: 1, fontVariant: ['tabular-nums'] },

  liftRow: { gap: space.md, paddingVertical: 2, paddingRight: space.xl },
  liftCard: {
    width: 156,
    backgroundColor: c.surface[1],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: space.md,
    gap: 2,
  },
  liftHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 },
  liftName: { ...type.caption, fontWeight: '600', color: c.fg.secondary, flex: 1 },
  liftValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: space.sm },
  liftValue: { ...type.metric, fontSize: 24, color: c.fg.primary, fontVariant: ['tabular-nums'] },
  liftUnit: { ...type.caption, color: c.fg.tertiary },
  liftCaption: { ...type.caption, fontSize: 10, color: c.fg.tertiary },
  liftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  liftDelta: { ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liftMeta: { ...type.caption, fontSize: 10, color: c.fg.disabled, marginTop: 2 },

  recommendation: { ...type.bodyStrong, color: c.fg.primary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  readinessChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.surface[2],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  readinessDot: { width: 7, height: 7, borderRadius: radius.pill },
  readinessLabel: { ...type.caption, color: c.fg.secondary },
  readinessPct: { ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  splitRow: { marginBottom: space.md, gap: 6 },
  splitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  splitLabel: { ...type.caption, color: c.fg.secondary },
  splitPct: { ...type.caption, fontWeight: '700', color: c.fg.primary, fontVariant: ['tabular-nums'] },
  splitNote: { ...type.caption, color: c.fg.tertiary, marginTop: space.xs },

  quietTitle: { ...type.bodyStrong, color: c.fg.primary, marginBottom: space.xs },
  quietBody: { ...type.caption, color: c.fg.tertiary },

  previewWrap: { marginTop: space['2xl'] },
  previewLabel: { ...type.overline, color: c.fg.tertiary, marginBottom: space.md },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  previewItemText: { ...type.caption, color: c.fg.secondary },
  previewHint: { ...type.caption, color: c.fg.disabled, marginTop: space.md },
});
