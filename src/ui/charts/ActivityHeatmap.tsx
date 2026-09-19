import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { c, radius, space, type } from '@/ui/tokens.bridge';

/**
 * Contribution-style training heatmap: one column per week, one row per
 * weekday, intensity from that day's session volume.
 *
 * Two things this gets right that most copies of it do not:
 *
 * 1. The ramp is QUANTILE-based over the user's own non-empty days, not a fixed
 *    kilogram scale. A beginner moving 2 t a session and a powerlifter moving
 *    20 t both get a readable spread instead of a uniform block.
 * 2. An empty log still renders the full grid. "No data" and "broken chart"
 *    must not look the same, so the frame stays and the copy explains it.
 */

export type HeatmapSession = { at: number; volumeKg: number };

const RAMP = c.viz.activity;
const EMPTY_FILL = RAMP[0];

const GAP = 3;
const GUTTER = 26;
const MONTH_ROW = 16;
const MIN_CELL = 7;
const MAX_CELL = 18;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Only every other row is labelled, or the gutter becomes a wall of text. */
const LABELLED_ROWS = new Set([0, 2, 4]);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday-based, computed in local time: an evening session belongs to its own day. */
function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Calendar-safe day stepping — adding 86,400,000 ms drifts across a DST edge. */
function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

type Cell = {
  key: string;
  at: number;
  level: number;
  volumeKg: number;
  sessions: number;
};

export function ActivityHeatmap({
  sessions,
  weeks = 26,
  endAt,
}: {
  sessions: readonly HeatmapSession[];
  /** Columns to draw. Roughly six months at the default. */
  weeks?: number;
  /** The last day shown. Defaults to today. */
  endAt?: number;
}) {
  const [width, setWidth] = useState(0);
  const end = endAt ?? Date.now();

  const grid = useMemo(() => buildGrid(sessions, weeks, end), [sessions, weeks, end]);

  const cell = useMemo(() => {
    if (width <= 0) return 0;
    const available = width - GUTTER - (weeks - 1) * GAP;
    return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(available / weeks)));
  }, [width, weeks]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const step = cell + GAP;
  const height = 7 * step - GAP + MONTH_ROW;
  const gridWidth = GUTTER + weeks * step - GAP;
  const active = grid.cells.filter((c2) => c2.sessions > 0).length;

  return (
    <View onLayout={onLayout} style={styles.root}>
      {cell > 0 ? (
        <Svg width={gridWidth} height={height}>
          {grid.cells.map((item) => (
            <Rect
              key={item.key}
              x={GUTTER + item.col * step}
              y={item.row * step}
              width={cell}
              height={cell}
              rx={Math.min(3, cell / 3)}
              fill={fillFor(item.level)}
            />
          ))}

          {DAY_LABELS.map((label, row) =>
            LABELLED_ROWS.has(row) ? (
              <SvgText
                key={label}
                x={GUTTER - 7}
                y={row * step + cell / 2 + 3}
                fill={c.fg.tertiary}
                fontSize={9}
                textAnchor="end"
              >
                {label}
              </SvgText>
            ) : null,
          )}

          {grid.monthMarks.map((mark) => (
            <SvgText
              key={`${mark.label}-${mark.col}`}
              x={GUTTER + mark.col * step}
              y={7 * step + 5}
              fill={c.fg.tertiary}
              fontSize={9}
            >
              {mark.label}
            </SvgText>
          ))}
        </Svg>
      ) : (
        // First paint, before onLayout has reported a width. Reserve the space
        // so the card does not jump.
        <View style={{ height: 7 * (MIN_CELL + GAP) + MONTH_ROW }} />
      )}

      <View style={styles.footer}>
        <Text style={styles.count}>
          {active === 0 ? 'No sessions yet' : `${active} training ${active === 1 ? 'day' : 'days'}`}
        </Text>
        <View style={styles.legend}>
          <Text style={styles.legendText}>Less</Text>
          {RAMP.map((fill, i) => (
            <View key={fill} style={[styles.swatch, { backgroundColor: fill }]} testID={`ramp-${i}`} />
          ))}
          <Text style={styles.legendText}>More</Text>
        </View>
      </View>

      {active === 0 ? (
        <Text style={styles.empty}>
          Finish a workout and the day it happened lights up here. Six months fit
          on this grid.
        </Text>
      ) : null}
    </View>
  );
}

function fillFor(level: number): string {
  return RAMP[level] ?? EMPTY_FILL;
}

type PlacedCell = Cell & { row: number; col: number };

function buildGrid(
  sessions: readonly HeatmapSession[],
  weeks: number,
  endAt: number,
): { cells: PlacedCell[]; monthMarks: { col: number; label: string }[] } {
  const byDay = new Map<string, { volumeKg: number; sessions: number }>();
  for (const s of sessions) {
    const key = dayKey(s.at);
    const bucket = byDay.get(key) ?? { volumeKg: 0, sessions: 0 };
    bucket.volumeKg += s.volumeKg;
    bucket.sessions += 1;
    byDay.set(key, bucket);
  }

  const lastColumn = startOfWeek(endAt);
  const firstColumn = startOfWeek(addDays(lastColumn, -(weeks - 1) * 7));
  const today = startOfDay(endAt);

  // The ramp is fitted to the days actually inside this window, so the darkest
  // step always means "one of this lifter's biggest days" rather than an
  // absolute tonnage nobody shares.
  const windowVolumes: number[] = [];
  for (let col = 0; col < weeks; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const at = addDays(firstColumn, col * 7 + row);
      if (at > today) continue;
      const bucket = byDay.get(dayKey(at));
      if (bucket && bucket.volumeKg > 0) windowVolumes.push(bucket.volumeKg);
    }
  }
  const levelOf = buildLevelScale(windowVolumes);

  const cells: PlacedCell[] = [];
  const monthMarks: { col: number; label: string }[] = [];
  let lastMonth = -1;
  let lastMarkCol = -99;

  for (let col = 0; col < weeks; col += 1) {
    const columnStart = addDays(firstColumn, col * 7);
    const month = new Date(columnStart).getMonth();
    if (month !== lastMonth && col - lastMarkCol >= 3 && col <= weeks - 2) {
      monthMarks.push({ col, label: MONTHS[month] ?? '' });
      lastMarkCol = col;
    }
    lastMonth = month;

    for (let row = 0; row < 7; row += 1) {
      const at = addDays(firstColumn, col * 7 + row);
      // Days that have not happened yet are left blank rather than drawn as
      // empty squares, which would read as missed sessions.
      if (at > today) continue;
      const key = dayKey(at);
      const bucket = byDay.get(key);
      const volumeKg = bucket?.volumeKg ?? 0;
      const count = bucket?.sessions ?? 0;
      cells.push({
        key,
        at,
        row,
        col,
        volumeKg,
        sessions: count,
        level: count > 0 ? levelOf(volumeKg) : 0,
      });
    }
  }

  return { cells, monthMarks };
}

/**
 * Rank the distinct non-empty day volumes and spread them over steps 1–5.
 * A log with a single distinct value lands in the middle step: it is neither
 * the lifter's lightest day nor their heaviest, because it is their only one.
 */
function buildLevelScale(values: readonly number[]): (v: number) => number {
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  if (distinct.length === 0) return () => 1;
  if (distinct.length === 1) return () => 3;

  const table = new Map<number, number>();
  const span = distinct.length - 1;
  distinct.forEach((value, i) => {
    table.set(value, 1 + Math.min(4, Math.floor((i / span) * 5)));
  });
  return (v: number) => table.get(v) ?? 1;
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  count: { ...type.caption, color: c.fg.tertiary, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendText: { ...type.caption, color: c.fg.tertiary, fontSize: 11 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  empty: {
    ...type.caption,
    color: c.fg.tertiary,
    backgroundColor: c.bg.sunken,
    borderRadius: radius.sm,
    padding: space.md,
  },
});
