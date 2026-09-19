import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { c } from '@/ui/tokens.bridge';

/**
 * A compact trend line for a row or a card. No axes, no labels — it exists to
 * give a number a shape, and the number beside it carries the value.
 *
 * Three states, deliberately distinguishable:
 *
 *   no data      a dashed baseline in the flat colour — "nothing logged",
 *                which is not the same thing as "no change"
 *   one point    a single dot, because a line through one point is a lie
 *   many points  the path, optionally with a tinted area under it
 *
 * Series are drawn OLDEST FIRST, left to right.
 */
export function Sparkline({
  values,
  width = 76,
  height = 28,
  color = c.viz.up,
  strokeWidth = 1.75,
  area = true,
  endDot = true,
}: {
  /** Oldest first. */
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  area?: boolean;
  endDot?: boolean;
}) {
  const pad = strokeWidth + 1;

  const geometry = useMemo(() => {
    const clean = values.filter((v) => Number.isFinite(v));
    if (clean.length === 0) return null;

    let min = Infinity;
    let max = -Infinity;
    for (const v of clean) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    // A perfectly flat series still needs a line through the middle, not a
    // divide-by-zero at the top edge.
    const span = max - min;
    const usableH = Math.max(1, height - pad * 2);
    const usableW = Math.max(1, width - pad * 2);

    const x = (i: number) =>
      clean.length === 1 ? width / 2 : pad + (i / (clean.length - 1)) * usableW;
    const y = (v: number) =>
      span === 0 ? height / 2 : pad + (1 - (v - min) / span) * usableH;

    const points = clean.map((v, i) => ({ x: x(i), y: y(v) }));
    const first = points[0];
    const last = points[points.length - 1];
    if (first === undefined || last === undefined) return null;

    let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p === undefined) continue;
      d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }

    const areaD = `${d} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`;

    return { d, areaD, last, count: points.length };
  }, [values, width, height, pad]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {geometry === null ? (
          <Line
            x1={pad}
            y1={height / 2}
            x2={width - pad}
            y2={height / 2}
            stroke={c.viz.flat}
            strokeWidth={1.25}
            strokeDasharray="3 4"
            strokeLinecap="round"
          />
        ) : geometry.count === 1 ? (
          <Circle cx={geometry.last.x} cy={geometry.last.y} r={strokeWidth + 1} fill={color} />
        ) : (
          <>
            {area ? <Path d={geometry.areaD} fill={color} fillOpacity={0.12} /> : null}
            <Path
              d={geometry.d}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {endDot ? (
              <Circle
                cx={geometry.last.x}
                cy={geometry.last.y}
                r={strokeWidth + 0.75}
                fill={color}
                stroke={c.bg.app}
                strokeWidth={1}
              />
            ) : null}
          </>
        )}
      </Svg>
    </View>
  );
}
