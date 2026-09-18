import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { c, type } from '@/ui/tokens.bridge';

/**
 * Progress ring. Sweeps clockwise from 12 o'clock.
 *
 * The track is always drawn at full circumference so an empty ring still reads
 * as a ring rather than as a missing element — an 0% ring and a broken ring
 * must not look the same.
 */
export function Ring({
  value,
  max = 100,
  size = 56,
  thickness = 5,
  color = c.positive.text,
  track = c.viz.track,
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  label?: string;
  sublabel?: string;
}) {
  const safeMax = max <= 0 ? 1 : max;
  const pct = Math.max(0, Math.min(1, value / safeMax));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={track}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - pct)}
          // Start the sweep at 12 o'clock instead of 3 o'clock.
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {label ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.label, { fontSize: size * 0.3 }]}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: {
    ...type.metric,
    color: c.fg.primary,
    fontVariant: ['tabular-nums'],
  },
  sublabel: { ...type.caption, color: c.fg.tertiary, fontSize: 10 },
});
