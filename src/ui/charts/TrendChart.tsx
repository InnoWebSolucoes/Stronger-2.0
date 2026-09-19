import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { c, radius, space, type } from '@/ui/tokens.bridge';

export interface TrendPoint {
  /** Epoch ms. */
  readonly at: number;
  readonly value: number;
  /** Renders hollow — a reading the smoother damped. */
  readonly muted?: boolean;
}

/**
 * A full-width time-series chart with axes: the smoothed line is the subject,
 * the raw readings are context behind it.
 *
 * Two deliberate choices. The y-axis does NOT start at zero — for bodyweight a
 * zero baseline flattens every real change into a straight line — so the range
 * is padded around the data instead, and the axis labels say so by always
 * showing their own numbers. And the x-axis is scaled by TIME, not by index, so
 * a fortnight's gap in logging looks like a gap rather than one wide step.
 */
export function TrendChart({
  series,
  raw = [],
  goal = null,
  height = 180,
  color = c.brand.base,
  formatValue = (v: number) => v.toFixed(1),
  formatDate = defaultFormatDate,
  goalLabel = 'Goal',
}: {
  /** The smoothed line, oldest first. */
  series: readonly TrendPoint[];
  /** Raw readings behind the line, oldest first. */
  raw?: readonly TrendPoint[];
  goal?: number | null;
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
  formatDate?: (at: number) => string;
  goalLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padLeft = 44;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 24;

  const geometry = useMemo(() => {
    if (width <= 0 || series.length === 0) return null;

    const all = [...series, ...raw];
    let minV = Infinity;
    let maxV = -Infinity;
    let minT = Infinity;
    let maxT = -Infinity;
    for (const p of all) {
      if (!Number.isFinite(p.value)) continue;
      if (p.value < minV) minV = p.value;
      if (p.value > maxV) maxV = p.value;
      if (p.at < minT) minT = p.at;
      if (p.at > maxT) maxT = p.at;
    }
    if (goal !== null && Number.isFinite(goal)) {
      if (goal < minV) minV = goal;
      if (goal > maxV) maxV = goal;
    }
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return null;

    const span = maxV - minV;
    const pad = span === 0 ? Math.max(0.5, Math.abs(maxV) * 0.01) : span * 0.12;
    const lo = minV - pad;
    const hi = maxV + pad;

    const plotW = Math.max(1, width - padLeft - padRight);
    const plotH = Math.max(1, height - padTop - padBottom);
    const tSpan = maxT - minT;

    const x = (at: number) => (tSpan === 0 ? padLeft + plotW / 2 : padLeft + ((at - minT) / tSpan) * plotW);
    const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * plotH;

    const toPath = (points: readonly TrendPoint[]): string => {
      let d = '';
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p === undefined || !Number.isFinite(p.value)) continue;
        d += `${d === '' ? 'M' : ' L'} ${x(p.at).toFixed(2)} ${y(p.value).toFixed(2)}`;
      }
      return d;
    };

    const line = toPath(series);
    const first = series[0];
    const last = series[series.length - 1];
    const areaPath =
      line === '' || first === undefined || last === undefined
        ? ''
        : `${line} L ${x(last.at).toFixed(2)} ${(padTop + plotH).toFixed(2)} L ${x(first.at).toFixed(2)} ${(
            padTop + plotH
          ).toFixed(2)} Z`;

    const ticks = [hi, (hi + lo) / 2, lo];

    return {
      line,
      areaPath,
      x,
      y,
      lo,
      hi,
      ticks,
      minT,
      maxT,
      plotW,
      plotH,
      last,
    };
  }, [width, height, series, raw, goal]);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {geometry === null ? (
        <View style={[styles.placeholder, { height }]}>
          <Text style={styles.placeholderText}>Nothing logged yet</Text>
        </View>
      ) : (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {geometry.ticks.map((t, i) => (
            <Line
              key={`grid-${i}`}
              x1={padLeft}
              y1={geometry.y(t)}
              x2={width - padRight}
              y2={geometry.y(t)}
              stroke={c.viz.grid}
              strokeWidth={1}
            />
          ))}
          {geometry.ticks.map((t, i) => (
            <SvgText
              key={`tick-${i}`}
              x={padLeft - 8}
              y={geometry.y(t) + 4}
              fill={c.fg.tertiary}
              fontSize={10}
              textAnchor="end"
            >
              {formatValue(t)}
            </SvgText>
          ))}

          {goal !== null && Number.isFinite(goal) ? (
            <>
              <Line
                x1={padLeft}
                y1={geometry.y(goal)}
                x2={width - padRight}
                y2={geometry.y(goal)}
                stroke={c.action.text}
                strokeWidth={1.25}
                strokeDasharray="5 4"
              />
              <SvgText
                x={width - padRight}
                y={geometry.y(goal) - 5}
                fill={c.action.text}
                fontSize={10}
                textAnchor="end"
              >
                {goalLabel}
              </SvgText>
            </>
          ) : null}

          {geometry.areaPath === '' ? null : <Path d={geometry.areaPath} fill="url(#trendFill)" />}

          {raw.map((p, i) =>
            Number.isFinite(p.value) ? (
              <Circle
                key={`raw-${i}`}
                cx={geometry.x(p.at)}
                cy={geometry.y(p.value)}
                r={2.2}
                fill={p.muted === true ? 'none' : c.fg.disabled}
                stroke={p.muted === true ? c.fg.disabled : 'none'}
                strokeWidth={1}
              />
            ) : null,
          )}

          {geometry.line === '' ? null : (
            <Path
              d={geometry.line}
              stroke={color}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}

          {geometry.last === undefined ? null : (
            <Circle
              cx={geometry.x(geometry.last.at)}
              cy={geometry.y(geometry.last.value)}
              r={3.75}
              fill={color}
              stroke={c.bg.app}
              strokeWidth={1.5}
            />
          )}

          <SvgText x={padLeft} y={height - 6} fill={c.fg.tertiary} fontSize={10}>
            {formatDate(geometry.minT)}
          </SvgText>
          <SvgText x={width - padRight} y={height - 6} fill={c.fg.tertiary} fontSize={10} textAnchor="end">
            {formatDate(geometry.maxT)}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

function defaultFormatDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    borderStyle: 'dashed',
    paddingHorizontal: space.lg,
  },
  placeholderText: { ...type.caption, color: c.fg.tertiary },
});
