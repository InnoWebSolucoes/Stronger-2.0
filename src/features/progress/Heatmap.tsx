import { StyleSheet, Text, View } from 'react-native';
import type { ConsistencyDay } from '@core/bodyweight';
import { c, radius, space, type } from '@/ui/tokens.bridge';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Tracking-consistency heatmap: one cell per day, weeks running left to right.
 *
 * Deliberately not a streak counter. A gap is information — it shows when
 * tracking lapsed, which is the thing worth noticing — so empty cells are drawn
 * in the ramp's own first step rather than left blank.
 */
export function ConsistencyHeatmap({
  days,
  weeks = 18,
  label,
}: {
  /** Ascending, one entry per calendar day. */
  days: readonly ConsistencyDay[];
  weeks?: number;
  label?: string;
}) {
  const cells = days.slice(-weeks * 7);
  if (cells.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No weigh-ins to chart yet</Text>
      </View>
    );
  }

  // Pad the front so the first column starts on a Sunday and the weekday rows
  // line up with their labels.
  const first = cells[0];
  const leading = first === undefined ? 0 : mod(dayOfWeek(first.dayIndex), 7);

  const columns: (ConsistencyDay | null)[][] = [];
  let column: (ConsistencyDay | null)[] = new Array<ConsistencyDay | null>(leading).fill(null);
  for (const day of cells) {
    column.push(day);
    if (column.length === 7) {
      columns.push(column);
      column = [];
    }
  }
  if (column.length > 0) {
    while (column.length < 7) column.push(null);
    columns.push(column);
  }

  return (
    <View>
      <View style={styles.grid}>
        <View style={styles.weekdayColumn}>
          {WEEKDAYS.map((d, i) => (
            <Text key={`${d}-${i}`} style={[styles.weekday, i % 2 === 1 ? undefined : styles.weekdayHidden]}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.columns}>
          {columns.map((week, wi) => (
            <View key={wi} style={styles.column}>
              {week.map((day, di) => (
                <View
                  key={di}
                  style={[
                    styles.cell,
                    {
                      backgroundColor:
                        day === null
                          ? 'transparent'
                          : day.entryCount > 0
                            ? c.viz.activity[4]
                            : c.viz.activity[0],
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
      {label === undefined ? null : <Text style={styles.caption}>{label}</Text>}
    </View>
  );
}

/** Day of week for a local day index; 1970-01-01 was a Thursday (index 4). */
function dayOfWeek(dayIndex: number): number {
  return (dayIndex + 4) % 7;
}

function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: space.sm },
  weekdayColumn: { gap: 3, justifyContent: 'space-between' },
  weekday: { ...type.caption, fontSize: 9, color: c.fg.disabled, height: 11, lineHeight: 11 },
  weekdayHidden: { opacity: 0 },
  columns: { flexDirection: 'row', gap: 3, flex: 1 },
  column: { gap: 3, flex: 1 },
  cell: { height: 11, borderRadius: 2.5 },
  caption: { ...type.caption, color: c.fg.tertiary, marginTop: space.md },
  emptyWrap: {
    paddingVertical: space.xl,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border.subtle,
  },
  emptyText: { ...type.caption, color: c.fg.tertiary },
});
