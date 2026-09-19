import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { c, radius, space, type } from '@/ui/tokens.bridge';

/**
 * The reference population as a bell curve, with the lifter's position marked.
 *
 * A percentile on its own ("top 18%") is a claim; drawn against the curve it is
 * a place. Everything left of the marker is filled, so the number and the
 * picture say the same thing.
 *
 * `z` is a standardised score, the same scale the standards engine works in.
 * The band, when given, is drawn as a lighter marker either side — an estimate
 * built from two sessions should not look as certain as one built from thirty.
 */
export function DistributionCurve({
  z,
  bandZ = null,
  height = 92,
  color = c.brand.base,
  label,
  ticks = true,
}: {
  z: number;
  /** One standard deviation of the estimate itself, in z units. */
  bandZ?: number | null;
  height?: number;
  color?: string;
  label?: string;
  ticks?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padX = 10;
  const padTop = 10;
  const padBottom = ticks ? 20 : 8;
  const minZ = -3;
  const maxZ = 3;

  const geometry = useMemo(() => {
    if (width <= 0) return null;
    const plotW = Math.max(1, width - padX * 2);
    const plotH = Math.max(1, height - padTop - padBottom);
    const baseline = padTop + plotH;

    const x = (value: number) => padX + ((Math.max(minZ, Math.min(maxZ, value)) - minZ) / (maxZ - minZ)) * plotW;
    const peak = 1 / Math.sqrt(2 * Math.PI);
    const y = (value: number) => baseline - (gaussian(value) / peak) * plotH;

    const steps = 96;
    let curve = '';
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const zi = minZ + ((maxZ - minZ) * i) / steps;
      const px = x(zi);
      const py = y(zi);
      points.push({ x: px, y: py });
      curve += `${i === 0 ? 'M' : ' L'} ${px.toFixed(2)} ${py.toFixed(2)}`;
    }

    const clamped = Math.max(minZ, Math.min(maxZ, z));
    let fill = '';
    for (const p of points) {
      if (p.x > x(clamped)) break;
      fill += `${fill === '' ? 'M' : ' L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
    if (fill !== '') {
      fill += ` L ${x(clamped).toFixed(2)} ${y(clamped).toFixed(2)} L ${x(clamped).toFixed(2)} ${baseline.toFixed(
        2,
      )} L ${padX.toFixed(2)} ${baseline.toFixed(2)} Z`;
    }

    return { curve, fill, x, y, baseline, markerX: x(clamped), markerY: y(clamped) };
  }, [width, height, z, padBottom]);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {geometry === null ? (
        <View style={[styles.placeholder, { height }]}>
          <Text style={styles.placeholderText}>—</Text>
        </View>
      ) : (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.4} />
              <Stop offset="1" stopColor={color} stopOpacity={0.06} />
            </LinearGradient>
          </Defs>

          <Line
            x1={padX}
            y1={geometry.baseline}
            x2={width - padX}
            y2={geometry.baseline}
            stroke={c.viz.axis}
            strokeWidth={1}
          />

          {geometry.fill === '' ? null : <Path d={geometry.fill} fill="url(#curveFill)" />}
          <Path d={geometry.curve} stroke={c.viz.flat} strokeWidth={1.5} fill="none" />

          {bandZ !== null && bandZ > 0 ? (
            <>
              <Line
                x1={geometry.x(z - bandZ)}
                y1={geometry.baseline}
                x2={geometry.x(z + bandZ)}
                y2={geometry.baseline}
                stroke={color}
                strokeWidth={4}
                strokeOpacity={0.35}
                strokeLinecap="round"
              />
            </>
          ) : null}

          <Line
            x1={geometry.markerX}
            y1={geometry.markerY}
            x2={geometry.markerX}
            y2={geometry.baseline}
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d={`M ${geometry.markerX - 4} ${geometry.markerY - 7} L ${geometry.markerX + 4} ${
              geometry.markerY - 7
            } L ${geometry.markerX} ${geometry.markerY - 1} Z`}
            fill={color}
          />

          {ticks
            ? [-2, -1, 0, 1, 2].map((t) => (
                <SvgText
                  key={`t-${t}`}
                  x={geometry.x(t)}
                  y={height - 6}
                  fill={c.fg.tertiary}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {percentLabel(t)}
                </SvgText>
              ))
            : null}
        </Svg>
      )}
      {label === undefined ? null : <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

function gaussian(value: number): number {
  return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI);
}

function percentLabel(z: number): string {
  // Normal CDF at whole z values, to the nearest percent. Fixed, not computed,
  // because these are axis furniture and must never shift between renders.
  if (z === -2) return '2%';
  if (z === -1) return '16%';
  if (z === 0) return '50%';
  if (z === 1) return '84%';
  return '98%';
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border.subtle,
    borderStyle: 'dashed',
  },
  placeholderText: { ...type.caption, color: c.fg.tertiary },
  label: { ...type.caption, color: c.fg.tertiary, textAlign: 'center', marginTop: space.xs },
});
