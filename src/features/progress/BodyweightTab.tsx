import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, Plus, Scale, Target, Trash2, X } from 'lucide-react-native';
import {
  allTimeRange,
  averageKg,
  lagCorrectedTrendKg,
  overallChange,
  projectGoalFromSeries,
  smoothWeightSeries,
  trackingConsistency,
  validateWeightGoal,
  weeklyRateKg,
  type WeightEntry,
} from '@core/bodyweight';
import { TrendChart, type TrendPoint } from '@/ui/charts/TrendChart';
import { confirm } from '@/ui/primitives/Dialog';
import { c, radius, space, type } from '@/ui/tokens.bridge';
import { ageOf, type Profile } from '@/features/account/store';
import { useBodyweight, type WeighIn } from '@/features/bodyweight/store';
import { ConsistencyHeatmap } from './Heatmap';
import { GOAL_SAFETY_DISCLOSURE, PROJECTION_DISCLOSURE, TREND_DISCLOSURE } from './methodology';
import { useProgressPrefs } from './prefs';
import { RANGE_NOUN, rangeStart, type RangeKey } from './analytics';
import { Card, EmptyState, RangeBar, SectionHeader, StatTile } from './ui';
import * as fmt from './format';

const DAY_MS = 86_400_000;

export function BodyweightTab({
  profile,
  range,
  onRangeChange,
  now,
}: {
  profile: Profile | null;
  range: RangeKey;
  onRangeChange: (next: RangeKey) => void;
  now: number;
}) {
  const units = profile?.units ?? 'kg';
  const entries = useBodyweight((s) => s.entries);
  const goalKg = useBodyweight((s) => s.goalKg);
  const addEntry = useBodyweight((s) => s.add);
  const removeEntry = useBodyweight((s) => s.remove);
  const setGoal = useBodyweight((s) => s.setGoal);

  const heightCm = useProgressPrefs((s) => s.heightCm);
  const hydrated = useProgressPrefs((s) => s.hydrated);
  const hydratePrefs = useProgressPrefs((s) => s.hydrate);
  useEffect(() => {
    if (!hydrated) void hydratePrefs();
  }, [hydrated, hydratePrefs]);

  const [addOpen, setAddOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const from = useMemo(() => rangeStart(range, now), [range, now]);

  /** Ascending, engine-shaped. Smoothing always runs over ALL history: an EWMA
   *  restarted at the window edge would show a trend that never existed. */
  const all = useMemo<WeightEntry[]>(
    () => [...entries].sort((a, b) => a.date - b.date).map((e) => ({ at: e.date, kg: e.kg })),
    [entries],
  );

  const series = useMemo(() => smoothWeightSeries(all), [all]);
  const rate = useMemo(() => weeklyRateKg(series), [series]);
  const change = useMemo(() => overallChange(all), [all]);
  const average = useMemo(() => averageKg(all), [all]);
  const extremes = useMemo(() => allTimeRange(all), [all]);
  const consistency = useMemo(
    () =>
      trackingConsistency(all, {
        utcOffsetMinutes: -new Date(now).getTimezoneOffset(),
        fromAt: now - 125 * DAY_MS,
        toAt: now,
      }),
    [all, now],
  );

  const projection = useMemo(
    () => (goalKg === null ? null : projectGoalFromSeries(series, goalKg)),
    [series, goalKg],
  );

  const last = series[series.length - 1];
  const currentKg =
    last === undefined ? null : lagCorrectedTrendKg(last.trendKg, rate.confidence === 'none' ? 0 : rate.kgPerWeek);

  const chart = useMemo(() => {
    const smoothed: TrendPoint[] = series
      .filter((p) => p.at >= from)
      .map((p) => ({ at: p.at, value: p.trendKg }));
    const raw: TrendPoint[] = series
      .filter((p) => p.at >= from)
      .map((p) => ({ at: p.at, value: p.kg, muted: p.isOutlier }));
    return { smoothed, raw };
  }, [series, from]);

  const recent = useMemo(() => entries.slice(0, 12), [entries]);

  const onDelete = async (entry: WeighIn) => {
    const ok = await confirm({
      title: 'Delete this weigh-in?',
      message: `${fmt.weight(entry.kg, units)} on ${fmt.dateLabel(entry.date)}. The trend line recalculates without it.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) removeEntry(entry.id);
  };

  if (entries.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Scale color={c.brand.base} size={22} />}
          title="No weigh-ins yet"
          body="Log your weight and this becomes a smoothed trend line, a rate in kg per week, and a projection to your goal — none of which the raw scale number can tell you on its own."
          hint="Daily bodyweight swings by a kilo from water alone. The chart smooths that out."
        />
        <Pressable style={styles.primaryButton} onPress={() => setAddOpen(true)}>
          <Plus color={c.fg.onAccent} size={18} />
          <Text style={styles.primaryButtonText}>Add your first weigh-in</Text>
        </Pressable>
        <WeighInSheet
          open={addOpen}
          units={units}
          defaultKg={profile?.bodyweightKg ?? null}
          onClose={() => setAddOpen(false)}
          onSubmit={(kg) => {
            addEntry(kg);
            setAddOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <RangeBar value={range} onChange={onRangeChange} />

      <SectionHeader
        title="WEIGHT TREND"
        disclosure={TREND_DISCLOSURE}
        trailing={
          <Pressable style={styles.miniButton} onPress={() => setAddOpen(true)} hitSlop={8}>
            <Plus color={c.brand.text} size={14} />
            <Text style={styles.miniButtonText}>Weigh in</Text>
          </Pressable>
        }
      />

      <Card>
        <View style={styles.currentRow}>
          <View>
            <Text style={styles.currentValue}>
              {fmt.weightValue(currentKg, units) ?? '—'}
              <Text style={styles.currentUnit}> {units}</Text>
            </Text>
            <Text style={styles.currentCaption}>smoothed, lag-corrected</Text>
          </View>
          <Pressable style={styles.goalButton} onPress={() => setGoalOpen(true)}>
            <Target color={goalKg === null ? c.fg.tertiary : c.action.text} size={14} />
            <Text style={[styles.goalButtonText, goalKg !== null && styles.goalButtonTextSet]}>
              {goalKg === null ? 'Set goal' : fmt.weight(goalKg, units)}
            </Text>
          </Pressable>
        </View>

        {chart.smoothed.length === 0 ? (
          <View style={styles.chartEmpty}>
            <Text style={styles.quietBody}>No weigh-ins {RANGE_NOUN[range]}. Pick a longer range.</Text>
          </View>
        ) : (
          <TrendChart
            series={chart.smoothed}
            raw={chart.raw}
            goal={goalKg}
            height={190}
            color={c.brand.base}
            formatValue={(v) => fmt.weightValue(v, units) ?? '—'}
          />
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      <SectionHeader title="THE NUMBERS" disclosure={PROJECTION_DISCLOSURE} />
      <View style={styles.tileGrid}>
        <StatTile
          label="Overall change"
          value={change === null ? null : (fmt.delta(change.changeKg, units) ?? null)}
          sub={change === null ? undefined : `over ${Math.max(1, Math.round(change.spanDays))} days`}
          tone={change === null ? 'neutral' : change.changeKg < 0 ? 'down' : 'up'}
        />
        <StatTile
          label="Trend"
          value={rate.confidence === 'none' ? null : `${rate.kgPerWeek >= 0 ? '+' : '−'}${Math.abs(rate.kgPerWeek).toFixed(2)}`}
          unit={rate.confidence === 'none' ? undefined : `${units}/wk`}
          sub={rate.confidence === 'none' ? (rate.reason ?? 'Not enough data') : `${rate.confidence} confidence`}
          tone={rate.confidence === 'none' ? 'neutral' : rate.kgPerWeek < 0 ? 'down' : 'up'}
        />
        <StatTile
          label="Average"
          value={fmt.weightValue(average, units)}
          unit={units}
          sub={`${consistency.daysLogged} days logged`}
        />
        <StatTile
          label="All-time range"
          value={extremes === null ? null : fmt.weightValue(extremes.rangeKg, units)}
          unit={units}
          sub={
            extremes === null
              ? undefined
              : `${fmt.weightValue(extremes.minKg, units) ?? '—'} – ${fmt.weightValue(extremes.maxKg, units) ?? '—'} ${units}`
          }
        />
      </View>

      <ProjectionCard projection={projection} goalKg={goalKg} units={units} onSetGoal={() => setGoalOpen(true)} />

      {/* ------------------------------------------------------------------ */}
      <SectionHeader title="TRACKING CONSISTENCY" />
      <Card>
        <ConsistencyHeatmap
          days={consistency.days}
          label={`${Math.round(consistency.consistencyPercent)}% of the last ${consistency.daysInPeriod} days · ${consistency.logsPerWeek.toFixed(1)} weigh-ins a week · longest streak ${consistency.longestStreakDays} days`}
        />
      </Card>

      {/* ------------------------------------------------------------------ */}
      <SectionHeader title="RECENT WEIGH-INS" />
      <View style={styles.entryList}>
        {recent.map((entry, index) => {
          const previous = recent[index + 1];
          const step = previous === undefined ? null : entry.kg - previous.kg;
          return (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryMain}>
                <Text style={styles.entryWeight}>{fmt.weight(entry.kg, units)}</Text>
                <Text style={styles.entryDate}>{fmt.dateLabel(entry.date)}</Text>
              </View>
              <Text
                style={[
                  styles.entryDelta,
                  { color: step === null ? c.fg.disabled : step < 0 ? c.viz.down : step > 0 ? c.viz.up : c.fg.tertiary },
                ]}
              >
                {step === null ? '—' : (fmt.delta(step, units) ?? '—')}
              </Text>
              <Pressable onPress={() => void onDelete(entry)} hitSlop={10} accessibilityLabel="Delete weigh-in">
                <Trash2 color={c.fg.tertiary} size={16} />
              </Pressable>
            </View>
          );
        })}
      </View>

      <WeighInSheet
        open={addOpen}
        units={units}
        defaultKg={currentKg ?? profile?.bodyweightKg ?? null}
        onClose={() => setAddOpen(false)}
        onSubmit={(kg) => {
          addEntry(kg);
          setAddOpen(false);
        }}
      />

      <GoalSheet
        open={goalOpen}
        units={units}
        profile={profile}
        currentKg={currentKg ?? profile?.bodyweightKg ?? null}
        heightCm={heightCm}
        goalKg={goalKg}
        now={now}
        onClose={() => setGoalOpen(false)}
        onSave={(kg) => {
          setGoal(kg);
          setGoalOpen(false);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function ProjectionCard({
  projection,
  goalKg,
  units,
  onSetGoal,
}: {
  projection: ReturnType<typeof projectGoalFromSeries> | null;
  goalKg: number | null;
  units: 'kg' | 'lb';
  onSetGoal: () => void;
}) {
  if (goalKg === null || projection === null) {
    return (
      <Pressable style={styles.projectionEmpty} onPress={onSetGoal}>
        <Target color={c.fg.tertiary} size={16} />
        <Text style={styles.projectionEmptyText}>
          Set a goal weight to see a projected arrival window.
        </Text>
      </Pressable>
    );
  }

  if (projection.status === 'achieved') {
    return (
      <Card style={styles.projectionCard}>
        <Text style={styles.projectionTitle}>Goal reached</Text>
        <Text style={styles.quietBody}>
          You are within normal daily fluctuation of {fmt.weight(goalKg, units)}.
        </Text>
      </Card>
    );
  }

  if (projection.status === 'declined') {
    return (
      <Card style={styles.projectionCard}>
        <Text style={styles.projectionTitle}>No projection yet</Text>
        <Text style={styles.quietBody}>{projection.message}</Text>
      </Card>
    );
  }

  const arrive = (days: number): string =>
    new Date(Date.now() + days * DAY_MS).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });

  return (
    <Card style={styles.projectionCard}>
      <Text style={styles.projectionTitle}>
        {fmt.weight(Math.abs(projection.remainingKg), units)} to go
      </Text>
      <Text style={styles.projectionBand}>
        {arrive(projection.earliestDays)} – {arrive(projection.latestDays)}
        {projection.latestIsCapped ? ' or later' : ''}
      </Text>
      <Text style={styles.quietBody}>
        A band, not a date: at {Math.abs(projection.kgPerWeek).toFixed(2)} {units}/week with{' '}
        {projection.confidence} confidence, capped at {projection.horizonDays} days.
      </Text>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X color={c.fg.secondary} size={20} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WeighInSheet({
  open,
  units,
  defaultKg,
  onClose,
  onSubmit,
}: {
  open: boolean;
  units: 'kg' | 'lb';
  defaultKg: number | null;
  onClose: () => void;
  onSubmit: (kg: number) => void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue(defaultKg === null ? '' : (fmt.weightValue(defaultKg, units) ?? ''));
  }, [open, defaultKg, units]);

  const kg = fmt.parseWeightToKg(value, units);

  return (
    <Sheet open={open} title="Add weigh-in" onClose={onClose}>
      <Text style={styles.fieldLabel}>WEIGHT ({units.toUpperCase()})</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder={units === 'kg' ? '78.4' : '173'}
        placeholderTextColor={c.fg.disabled}
        style={styles.input}
        autoFocus
      />
      <Text style={styles.fieldHint}>
        Weigh in at the same time of day — first thing, after the bathroom, before food — or the noise
        swamps the signal.
      </Text>
      <Pressable
        style={[styles.primaryButton, kg === null && styles.primaryButtonDisabled]}
        disabled={kg === null}
        onPress={() => {
          if (kg !== null) onSubmit(kg);
        }}
      >
        <Text style={styles.primaryButtonText}>Save weigh-in</Text>
      </Pressable>
    </Sheet>
  );
}

function GoalSheet({
  open,
  units,
  profile,
  currentKg,
  heightCm,
  goalKg,
  now,
  onClose,
  onSave,
}: {
  open: boolean;
  units: 'kg' | 'lb';
  profile: Profile | null;
  currentKg: number | null;
  heightCm: number | null;
  goalKg: number | null;
  now: number;
  onClose: () => void;
  onSave: (kg: number | null) => void;
}) {
  const setHeightCm = useProgressPrefs((s) => s.setHeightCm);
  const [value, setValue] = useState('');
  const [height, setHeight] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(goalKg === null ? '' : (fmt.weightValue(goalKg, units) ?? ''));
    setHeight(heightCm === null ? '' : String(Math.round(heightCm)));
    setAttempted(false);
  }, [open, goalKg, units, heightCm]);

  const requestedKg = fmt.parseWeightToKg(value, units);
  const heightM = (() => {
    const parsed = Number.parseFloat(height.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 50 && parsed < 260 ? parsed / 100 : null;
  })();

  const validation = useMemo(() => {
    if (requestedKg === null || currentKg === null || profile === null) return null;
    return validateWeightGoal({
      currentKg,
      goalKg: requestedKg,
      ageYears: ageOf(profile, now),
      heightM,
    });
  }, [requestedKg, currentKg, profile, heightM, now]);

  const blocked = validation !== null && !validation.allowed;

  return (
    <Sheet open={open} title="Goal weight" onClose={onClose}>
      <Text style={styles.fieldLabel}>GOAL ({units.toUpperCase()})</Text>
      <TextInput
        value={value}
        onChangeText={(next) => {
          setValue(next);
          setAttempted(false);
        }}
        keyboardType="decimal-pad"
        placeholder={units === 'kg' ? '74' : '163'}
        placeholderTextColor={c.fg.disabled}
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>HEIGHT (CM)</Text>
      <TextInput
        value={height}
        onChangeText={setHeight}
        keyboardType="number-pad"
        placeholder="178"
        placeholderTextColor={c.fg.disabled}
        style={styles.input}
      />
      <Text style={styles.fieldHint}>
        Height is required for a loss goal: without it the BMI floor cannot be enforced, and a goal
        below it will be refused rather than quietly accepted.
      </Text>

      {/* Every rejection shows its source. AGENTS.md §8 — this is a hard
          constraint, not a nicety. */}
      {blocked && validation !== null
        ? validation.rejections.map((issue) => (
            <View key={issue.code} style={styles.rejection}>
              <View style={styles.rejectionHead}>
                <AlertTriangle color={c.negative.text} size={15} />
                <Text style={styles.rejectionTitle}>Goal not allowed</Text>
              </View>
              <Text style={styles.rejectionBody}>{issue.message}</Text>
              {issue.source === null ? null : (
                <Text style={styles.rejectionSource}>
                  {issue.source.organisation}: “{issue.source.guidance}”
                  {issue.source.url === null ? '' : `\n${issue.source.url}`}
                </Text>
              )}
            </View>
          ))
        : null}

      {validation !== null && validation.allowed
        ? validation.warnings.map((issue) => (
            <View key={issue.code} style={styles.warning}>
              <Text style={styles.warningBody}>{issue.message}</Text>
              {issue.source === null ? null : (
                <Text style={styles.rejectionSource}>{issue.source.organisation}</Text>
              )}
            </View>
          ))
        : null}

      {validation !== null && validation.minimumSafeGoalKg !== null ? (
        <Text style={styles.fieldHint}>
          Lowest goal allowed at this height: {fmt.weight(validation.minimumSafeGoalKg, units)} (BMI 18.5).
          {validation.maxLossKgPerWeek === null
            ? ''
            : ` Fastest safe loss: ${validation.maxLossKgPerWeek.toFixed(2)} kg/week.`}
        </Text>
      ) : null}

      {attempted && requestedKg === null ? (
        <Text style={styles.rejectionBody}>Enter a goal weight first.</Text>
      ) : null}

      <View style={styles.sheetActions}>
        {goalKg === null ? null : (
          <Pressable style={styles.secondaryButton} onPress={() => onSave(null)}>
            <Text style={styles.secondaryButtonText}>Remove goal</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.primaryButton, styles.flex, (blocked || requestedKg === null) && styles.primaryButtonDisabled]}
          disabled={blocked || requestedKg === null}
          onPress={() => {
            setAttempted(true);
            if (requestedKg === null || blocked) return;
            if (heightM !== null) setHeightCm(Math.round(heightM * 100));
            onSave(requestedKg);
          }}
        >
          <Text style={styles.primaryButtonText}>Save goal</Text>
        </Pressable>
      </View>

      <Text style={styles.disclosureNote}>{GOAL_SAFETY_DISCLOSURE.summary}</Text>
      <Text style={styles.disclosureSource}>{GOAL_SAFETY_DISCLOSURE.source}</Text>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  currentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: space.md,
  },
  currentValue: { ...type.display, color: c.fg.primary, fontVariant: ['tabular-nums'] },
  currentUnit: { ...type.body, color: c.fg.tertiary },
  currentCaption: { ...type.caption, color: c.fg.tertiary },

  goalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  goalButtonText: { ...type.caption, fontWeight: '600', color: c.fg.tertiary },
  goalButtonTextSet: { color: c.action.text, fontVariant: ['tabular-nums'] },

  chartEmpty: { paddingVertical: space['3xl'], alignItems: 'center' },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  projectionCard: { marginTop: space.sm },
  projectionTitle: { ...type.heading, color: c.fg.primary },
  projectionBand: {
    ...type.title,
    color: c.brand.text,
    marginVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  projectionEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border.default,
  },
  projectionEmptyText: { ...type.caption, color: c.fg.tertiary, flex: 1 },

  entryList: { gap: space.xs },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surface[1],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  entryMain: { flex: 1 },
  entryWeight: { ...type.bodyStrong, color: c.fg.primary, fontVariant: ['tabular-nums'] },
  entryDate: { ...type.caption, color: c.fg.tertiary },
  entryDelta: { ...type.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },

  scrim: { flex: 1, backgroundColor: c.bg.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface[2],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border.default,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space['3xl'],
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  sheetTitle: { ...type.title, color: c.fg.primary },
  sheetActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  flex: { flex: 1 },

  fieldLabel: { ...type.overline, color: c.fg.tertiary, marginTop: space.md, marginBottom: space.sm },
  input: {
    ...type.title,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
    backgroundColor: c.bg.sunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  fieldHint: { ...type.caption, color: c.fg.tertiary, marginTop: space.sm },

  rejection: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.negative.weak,
    borderWidth: 1,
    borderColor: c.negative.text,
    gap: space.xs,
  },
  rejectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rejectionTitle: { ...type.bodyStrong, color: c.negative.text },
  rejectionBody: { ...type.caption, color: c.fg.primary },
  rejectionSource: { ...type.caption, fontSize: 11, color: c.fg.tertiary },

  warning: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.brand.weak,
    borderWidth: 1,
    borderColor: c.brand.borderWeak,
    gap: space.xs,
  },
  warningBody: { ...type.caption, color: c.brand.text },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: c.brand.base,
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { ...type.bodyStrong, color: c.fg.onAccent },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  secondaryButtonText: { ...type.bodyStrong, color: c.fg.secondary },

  disclosureNote: { ...type.caption, color: c.fg.tertiary, marginTop: space.xl },
  disclosureSource: { ...type.caption, fontSize: 11, color: c.fg.disabled, marginTop: space.xs },

  quietBody: { ...type.caption, color: c.fg.tertiary },
  miniButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.brand.borderWeak,
    backgroundColor: c.brand.weak,
  },
  miniButtonText: { ...type.caption, fontSize: 11, fontWeight: '700', color: c.brand.text },
});
