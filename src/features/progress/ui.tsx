import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Info, X } from 'lucide-react-native';
import { c, radius, shadow, space, type } from '@/ui/tokens.bridge';
import { RANGES, type RangeKey } from './analytics';
import type { Disclosure } from './methodology';

/* -------------------------------------------------------------------------- */
/* Segmented control                                                           */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.segmented, compact && styles.segmentedCompact]}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.segment, compact && styles.segmentCompact, active && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                compact ? styles.segmentTextCompact : styles.segmentText,
                active && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The 1W / 1M / 3M / 6M / 1Y / All selector that drives the whole tab. */
export function RangeBar({ value, onChange }: { value: RangeKey; onChange: (next: RangeKey) => void }) {
  return (
    <Segmented
      compact
      value={value}
      onChange={onChange}
      options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Disclosure — Apple Guideline 1.4.1                                          */
/* -------------------------------------------------------------------------- */

/**
 * The "how this is calculated" affordance. Every computed health figure on this
 * tab carries one; it is a shipping requirement, not decoration.
 */
export function HowChip({ disclosure }: { disclosure: Disclosure }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={styles.howChip}
        accessibilityRole="button"
        accessibilityLabel={disclosure.title}
      >
        <Info color={c.fg.tertiary} size={13} />
        <Text style={styles.howChipText}>How</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{disclosure.title}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <X color={c.fg.secondary} size={20} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetBody}>
              <Text style={styles.sheetText}>{disclosure.summary}</Text>
              <Text style={styles.sheetSourceLabel}>SOURCE</Text>
              <Text style={styles.sheetSource}>{disclosure.source}</Text>
              {disclosure.url === null ? null : <Text style={styles.sheetUrl}>{disclosure.url}</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function SectionHeader({
  title,
  disclosure,
  trailing,
}: {
  title: string;
  disclosure?: Disclosure;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionTrailing}>
        {trailing}
        {disclosure === undefined ? null : <HowChip disclosure={disclosure} />}
      </View>
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

/** A labelled number. `value` is pre-formatted; `null` renders an em dash, not a zero. */
export function StatTile({
  label,
  value,
  unit,
  sub,
  tone = 'neutral',
  width,
}: {
  label: string;
  value: string | null;
  unit?: string;
  sub?: string;
  tone?: 'neutral' | 'up' | 'down' | 'brand';
  width?: StyleProp<ViewStyle>;
}) {
  const toneColor =
    tone === 'up'
      ? c.positive.text
      : tone === 'down'
        ? c.negative.text
        : tone === 'brand'
          ? c.brand.text
          : c.fg.primary;

  return (
    <View style={[styles.tile, width]}>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.tileValueRow}>
        <Text style={[styles.tileValue, { color: value === null ? c.fg.disabled : toneColor }]}>
          {value ?? '—'}
        </Text>
        {unit !== undefined && value !== null ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      </View>
      {sub === undefined ? null : (
        <Text style={styles.tileSub} numberOfLines={2}>
          {sub}
        </Text>
      )}
    </View>
  );
}

/**
 * A designed empty state. A new user has no data on every surface of this tab,
 * and that path has to look intentional rather than broken.
 */
export function EmptyState({
  icon,
  title,
  body,
  hint,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {hint === undefined ? null : <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

/** A horizontal proportion bar with an optional baseline tick behind it. */
export function ShareBar({
  share,
  baseline = null,
  color = c.brand.base,
}: {
  share: number;
  baseline?: number | null;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, share));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      {baseline === null ? null : (
        <View
          style={[styles.barBaseline, { left: `${Math.max(0, Math.min(1, baseline)) * 100}%` }]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

/** Small pill used for muscle chips and filters. */
export function Chip({
  label,
  active = false,
  tone,
  onPress,
}: {
  label: string;
  active?: boolean;
  tone?: string;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={[
        styles.chip,
        active && styles.chipActive,
        tone !== undefined && { borderColor: tone, backgroundColor: `${tone}1F` },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, tone !== undefined && { color: tone }]}>
        {label}
      </Text>
    </View>
  );
  if (onPress === undefined) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.bg.sunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    padding: 3,
    gap: 2,
  },
  segmentedCompact: { borderRadius: radius.sm },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
  segmentCompact: { paddingVertical: 6, borderRadius: 6 },
  segmentActive: { backgroundColor: c.surface[3] },
  segmentText: { ...type.bodyStrong, color: c.fg.tertiary },
  segmentTextCompact: {
    ...type.caption,
    fontWeight: '600',
    color: c.fg.tertiary,
    fontVariant: ['tabular-nums'],
  },
  segmentTextActive: { color: c.fg.primary },

  howChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  howChipText: { ...type.caption, fontSize: 11, fontWeight: '600', color: c.fg.tertiary },

  scrim: {
    flex: 1,
    backgroundColor: c.bg.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface[2],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border.default,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space['3xl'],
    maxHeight: '80%',
    ...shadow[3],
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.md,
  },
  sheetTitle: { ...type.title, color: c.fg.primary, flex: 1 },
  sheetBody: { flexGrow: 0 },
  sheetText: { ...type.body, color: c.fg.secondary },
  sheetSourceLabel: { ...type.overline, color: c.fg.tertiary, marginTop: space.xl },
  sheetSource: { ...type.caption, color: c.fg.tertiary, marginTop: space.xs },
  sheetUrl: { ...type.caption, color: c.action.text, marginTop: space.xs },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space['2xl'],
    marginBottom: space.md,
  },
  sectionTitle: { ...type.overline, color: c.fg.tertiary, flex: 1 },
  sectionTrailing: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  card: {
    backgroundColor: c.surface[1],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  cardPadded: { padding: space.lg },

  tile: {
    flex: 1,
    minWidth: 92,
    backgroundColor: c.surface[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: 2,
  },
  tileLabel: { ...type.caption, fontSize: 11, color: c.fg.tertiary },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  tileValue: {
    ...type.title,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  tileUnit: { ...type.caption, color: c.fg.tertiary },
  tileSub: { ...type.caption, fontSize: 11, color: c.fg.tertiary, marginTop: 1 },

  empty: {
    alignItems: 'center',
    paddingVertical: space['3xl'],
    paddingHorizontal: space.xl,
    backgroundColor: c.surface[1],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border.subtle,
    borderStyle: 'dashed',
    gap: space.sm,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface[2],
    marginBottom: space.xs,
  },
  emptyTitle: { ...type.heading, color: c.fg.primary, textAlign: 'center' },
  emptyBody: { ...type.body, color: c.fg.tertiary, textAlign: 'center' },
  emptyHint: { ...type.caption, color: c.fg.disabled, textAlign: 'center', marginTop: space.xs },

  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: c.viz.track,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: { height: 8, borderRadius: radius.pill },
  barBaseline: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: c.fg.disabled,
  },

  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.surface[1],
  },
  chipActive: { borderColor: c.brand.borderWeak, backgroundColor: c.brand.weak },
  chipText: { ...type.caption, fontWeight: '600', color: c.fg.secondary },
  chipTextActive: { color: c.brand.text },
});
