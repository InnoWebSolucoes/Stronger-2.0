import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { archetypeFor, lerpPose, type Pose } from './poses';
import { c, radius } from '@/ui/tokens.bridge';

/**
 * Animated movement demonstration.
 *
 * One rig, one visual language, for every exercise in the catalog — see
 * poses.ts for why this is drawn rather than licensed.
 *
 * Motion is a ping-pong between the archetype's two keyframes with an
 * ease-in-out, so the figure decelerates into each end position the way a real
 * rep does, rather than sliding linearly and reading as a puppet.
 */
export function ExerciseDemo({
  exerciseId,
  size = 64,
  animated = true,
}: {
  exerciseId: string;
  size?: number;
  animated?: boolean;
}) {
  const arch = archetypeFor(exerciseId);
  const [t, setT] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!animated) return;
    let frame = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      if (startedAt.current === 0) startedAt.current = now;
      const elapsed = (now - startedAt.current) % arch.tempo;
      const phase = elapsed / arch.tempo;
      // Ping-pong 0→1→0, then ease so the ends are slow and the middle quick.
      const linear = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      const eased = linear < 0.5
        ? 2 * linear * linear
        : 1 - Math.pow(-2 * linear + 2, 2) / 2;
      setT(eased);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      startedAt.current = 0;
    };
  }, [animated, arch.tempo]);

  const pose: Pose = lerpPose(arch.a, arch.b, animated ? t : 0.5);
  const stroke = Math.max(2.5, 100 / size + 3);

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {arch.ground != null ? (
          <Line
            x1={8}
            y1={arch.ground}
            x2={92}
            y2={arch.ground}
            stroke={c.border.strong}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : null}

        {arch.bench ? (
          <Rect
            x={arch.bench[0]}
            y={arch.bench[1]}
            width={arch.bench[2]}
            height={arch.bench[3]}
            rx={2}
            fill={c.surface[4]}
          />
        ) : null}

        {/* Limbs behind the torso so joints read cleanly. */}
        <Limb from={pose.hip} to={pose.knee} stroke={stroke} />
        <Limb from={pose.knee} to={pose.ankle} stroke={stroke} />
        <Limb from={pose.neck} to={pose.elbow} stroke={stroke} />
        <Limb from={pose.elbow} to={pose.wrist} stroke={stroke} />

        {/* Spine */}
        <Line
          x1={pose.neck[0]}
          y1={pose.neck[1]}
          x2={pose.hip[0]}
          y2={pose.hip[1]}
          stroke={c.fg.secondary}
          strokeWidth={stroke + 1}
          strokeLinecap="round"
        />

        <Circle cx={pose.head[0]} cy={pose.head[1]} r={7} fill={c.fg.secondary} />

        {pose.bar ? (
          <Circle
            cx={pose.bar[0]}
            cy={pose.bar[1]}
            r={5}
            fill={c.brand.base}
            stroke={c.bg.canvas}
            strokeWidth={1.5}
          />
        ) : null}
      </Svg>
    </View>
  );
}

function Limb({
  from,
  to,
  stroke,
}: {
  from: readonly [number, number];
  to: readonly [number, number];
  stroke: number;
}) {
  return (
    <Line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      stroke={c.fg.tertiary}
      strokeWidth={stroke}
      strokeLinecap="round"
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.sm,
    backgroundColor: c.surface[3],
    overflow: 'hidden',
  },
});
