import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { darkTheme } from '@/ui/theme';
import { c, radius, space, type } from '@/ui/tokens.bridge';

/**
 * Anatomical muscle map — front and back.
 *
 * ART PROVENANCE: every path below was authored for this file. Nothing is
 * traced, imported or derived from a third-party body map. AGENTS.md forbids
 * MuscleWiki bodymaps and CC-BY-SA derivatives in app assets, so this had to be
 * original geometry. It is a stylised plate figure — each muscle is an
 * independent rounded plate rather than a realistic render — which is what lets
 * one region light up on its own and still look deliberate.
 *
 * SHADING: regions are shaded by each muscle's SHARE of the session, and the
 * ramp is then stretched against the session's own hottest muscle. That is the
 * difference between a map that says "what did this session train" and one that
 * says "how heavy is this lifter" — a 60 kg lifter and a 110 kg lifter doing the
 * same split produce identical maps, which is the only version that is readable
 * in a feed.
 *
 * The heat ramp lives in `@/ui/theme` (`darkTheme.viz.heat`), not in
 * tokens.bridge, which carries only the amber `activity` ramp. Both are tokens;
 * no hex is written here.
 */

const HEAT = darkTheme.viz.heat;
const HEAT_BASE = darkTheme.viz.heatBase;

/** Muscle display name (as used by `@/features/exercises/source`) → 0..1 share. */
export type MuscleShares = Readonly<Record<string, number>>;

/**
 * Bodyweight movements store 0 kg, so raw tonnage would erase pull-ups, dips
 * and planks from the map entirely. This is a DISPLAY-ONLY stand-in load used
 * to keep them visible in the shading; it never touches scoring, PRs or any
 * stored number.
 */
const BODYWEIGHT_PROXY_KG = 20;

type SetLike = {
  readonly type?: string;
  readonly weightKg: number | null;
  readonly reps: number | null;
  readonly done: boolean;
};

type ExerciseLike = {
  readonly muscles: readonly string[];
  readonly sets: readonly SetLike[];
};

/**
 * Per-muscle share of a session's work, summing to 1 (or empty).
 *
 * An exercise lists its muscles primary-first, so credit decays as 1, 1/2,
 * 1/3 … normalised per exercise. Warm-ups and un-ticked sets are excluded for
 * the same reason they are excluded from volume.
 */
export function muscleShares(exercises: readonly ExerciseLike[]): MuscleShares {
  const totals = new Map<string, number>();
  let grand = 0;

  for (const ex of exercises) {
    let effort = 0;
    for (const s of ex.sets) {
      if (!s.done) continue;
      if (s.type === 'warmup') continue;
      const reps = s.reps ?? 0;
      if (reps <= 0) continue;
      const kg = s.weightKg ?? 0;
      effort += (kg > 0 ? kg : BODYWEIGHT_PROXY_KG) * reps;
    }
    if (effort <= 0) continue;

    const muscles = ex.muscles.filter((m) => m.length > 0);
    if (muscles.length === 0) continue;

    let weightSum = 0;
    for (let i = 0; i < muscles.length; i += 1) weightSum += 1 / (i + 1);

    for (let i = 0; i < muscles.length; i += 1) {
      const name = muscles[i];
      if (name === undefined) continue;
      const credit = (effort * (1 / (i + 1))) / weightSum;
      totals.set(name, (totals.get(name) ?? 0) + credit);
      grand += credit;
    }
  }

  if (grand <= 0) return {};

  const out: Record<string, number> = {};
  for (const [name, value] of totals) out[name] = value / grand;
  return out;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * One coordinate system for both views: 100 wide, 224 tall, figure centred on
 * x = 50. Every bilateral plate is authored for the right-hand side only and
 * mirrored, which is what guarantees the two halves cannot drift apart.
 */
const VB_W = 100;
const VB_H = 224;

type Plate = {
  /** Muscle display name, or null for non-muscle anatomy (head, hands, feet). */
  readonly muscle: string | null;
  readonly d: string;
  /** Mirrored to the left-hand side as well. */
  readonly bilateral: boolean;
};

/** Shared between both views: head, neck, hands, knees, feet. */
const SCAFFOLD: Plate[] = [
  { muscle: null, bilateral: false, d: 'M50,5.6 C55.6,5.6 59.4,10.2 59.4,17.2 C59.4,24.4 55.6,28.8 50,28.8 C44.4,28.8 40.6,24.4 40.6,17.2 C40.6,10.2 44.4,5.6 50,5.6 Z' },
  { muscle: null, bilateral: false, d: 'M44.4,26.4 L55.6,26.4 L56.6,33.4 L43.4,33.4 Z' },
  { muscle: null, bilateral: true, d: 'M78.6,128.6 C81.6,127.4 84.4,128.6 85,131.6 C85.8,136 85.4,140.4 84,142.8 C82.4,145 79.4,144.6 78.4,142 C77.4,138.4 77.6,132.6 78.6,128.6 Z' },
  { muscle: null, bilateral: true, d: 'M53.8,153.6 C57.6,151.8 62,152.4 64.4,155 C65.4,158.6 65,162.4 63,164.6 C60,167 55.6,166.4 53.8,163.4 C52.6,160.6 52.8,156.6 53.8,153.6 Z' },
  { muscle: null, bilateral: true, d: 'M55.6,197.8 C58.8,196.6 62,197.4 63,200.2 C63.8,203.6 65.2,206.8 67.4,209.2 C68.6,211 67.6,213.2 64.6,213.2 L57.4,213.2 C55.6,213.2 54.8,211.6 54.9,209 C55,205 55.2,201 55.6,197.8 Z' },
];

/** Front view, right-hand side. */
const FRONT: Plate[] = [
  // Trapezius — the visible front slope from neck to shoulder.
  { muscle: 'Traps', bilateral: true, d: 'M50,27.2 L56.4,26.8 C61.8,28.4 66.4,31.6 69.6,35.6 C63.4,34 56.2,34.2 50,35.2 Z' },
  // Anterior deltoid.
  { muscle: 'Front Delts', bilateral: true, d: 'M61.6,36.2 C66.6,34.2 71.8,36.8 73.4,42.4 C74.6,48 71.6,52.6 67,52 C63,50.8 60.6,44.4 61.6,36.2 Z' },
  // Lateral deltoid — the outer cap, visible from both views.
  { muscle: 'Side Delts', bilateral: true, d: 'M72.4,38.8 C76.8,41.4 79,47 78.4,53 C78,57.6 74.8,59 72.4,56.6 C70.8,51 70.8,44.2 72.4,38.8 Z' },
  // Pectoralis.
  { muscle: 'Chest', bilateral: true, d: 'M50,36 C55.6,35.6 59.8,37.4 61.6,41.6 C62.6,47.6 60,54.2 55,56.8 C53,57.8 51.2,57.8 50,57.2 Z' },
  // Rectus abdominis.
  { muscle: 'Abs', bilateral: true, d: 'M50,58.6 L57.8,59.4 C59,67.2 58.8,79 56.8,89 C55.2,93.4 52.6,95.6 50,95.8 Z' },
  // External obliques.
  { muscle: 'Obliques', bilateral: true, d: 'M58.8,59.8 C62.2,61.2 64.4,65.2 64.8,71.2 C65,79.6 62.2,87.6 58.2,92.6 C60,81.6 60.2,69.6 58.8,59.8 Z' },
  // Lats wrap far enough forward to read under the armpit.
  { muscle: 'Lats', bilateral: true, d: 'M64.8,55 C67.2,60.4 66.8,67.4 64.6,73.4 C62.8,66.4 60.4,60.6 58.2,56.8 Z' },
  // Pelvis — anatomy, not a muscle.
  { muscle: null, bilateral: true, d: 'M50,93.6 C54.8,93.8 59.6,95.6 62.8,99 C64.8,102.4 65.6,105.6 65.2,108 C60.4,105.8 55.2,104.8 50,104.8 Z' },
  { muscle: 'Biceps', bilateral: true, d: 'M68.2,53.4 C72.8,51.8 76.8,54.8 78.8,62 C80.8,71 80.8,81 79.4,88 C76.8,90.6 73.4,89.4 72.4,86 C69.8,76 67.8,63 68.2,53.4 Z' },
  { muscle: 'Forearms', bilateral: true, d: 'M72.8,89.4 C76.4,87.4 80.4,88.6 82,93 C84,102 85.4,113 85.4,124 C85.4,128.4 82,130.4 79,128.4 C77,119 74,102 72.8,89.4 Z' },
  { muscle: 'Quads', bilateral: true, d: 'M50.6,105 C56.6,103.4 62.6,104.6 65.2,108 C66.8,120 65.8,138 62.8,154 C60.8,158 56,158 54.4,154 C51.8,138 50.2,120 50.6,105 Z' },
  { muscle: 'Calves', bilateral: true, d: 'M55.2,162.8 C58.8,160.8 62.4,162.4 63.4,167 C64.4,176 63.8,188 61.8,198 C60.4,201.8 56.8,201.8 55.8,198.4 C54.8,186 54.8,171.8 55.2,162.8 Z' },
];

/** Back view, right-hand side. */
const BACK: Plate[] = [
  // Trapezius: the upper slope plus the strip that tapers down the spine.
  { muscle: 'Traps', bilateral: true, d: 'M50,26.8 L56.2,26.8 C61.6,28.4 66.2,32 69.2,36 C63,37.6 57.6,40.2 54.6,44.6 C53.4,52.4 52,60.4 50,64.4 Z' },
  { muscle: 'Rear Delts', bilateral: true, d: 'M61.8,36.4 C66.8,34.4 72.2,37 73.8,42.6 C75,48.2 72,52.8 67.4,52.2 C63.4,51 61,44.6 61.8,36.4 Z' },
  { muscle: 'Side Delts', bilateral: true, d: 'M73,38.8 C77.4,41.4 79.6,47 79,53 C78.6,57.6 75.4,59 73,56.6 C71.4,51 71.4,44.2 73,38.8 Z' },
  // Rhomboids / teres / mid traps, read together as "Upper Back".
  { muscle: 'Upper Back', bilateral: true, d: 'M55.4,45.4 C60.2,40.6 65.8,38.2 69.6,37.6 C71,44 70,52.2 67,58.6 C63.4,63 58.2,64.8 54.2,64 C53.6,57 54.2,50 55.4,45.4 Z' },
  { muscle: 'Lats', bilateral: true, d: 'M67.8,59.4 C69.8,63.8 69.4,71.6 67.2,79.6 C64.8,87.6 60,92.6 55.2,94.6 C53.9,90 53.8,80 54.6,71.6 C55,67.6 56,64.6 57.2,63 C60.6,61.2 64.8,60.2 67.8,59.4 Z' },
  // Erector spinae.
  { muscle: 'Lower Back', bilateral: true, d: 'M50,64.8 L53.2,66 C54.2,74 53.8,84 52.8,92 C52.2,96.4 51.2,99.4 50,100.4 Z' },
  { muscle: 'Glutes', bilateral: true, d: 'M50,93.8 C56.2,92.8 62.8,95.4 66,100.6 C68,106.6 67,114.4 63,118.6 C57.8,121.8 52.4,119.8 50,116.8 Z' },
  { muscle: 'Triceps', bilateral: true, d: 'M68.2,53.4 C72.8,51.8 76.8,54.8 78.8,62 C80.8,71 80.8,81 79.4,88 C76.8,90.6 73.4,89.4 72.4,86 C69.8,76 67.8,63 68.2,53.4 Z' },
  { muscle: 'Forearms', bilateral: true, d: 'M72.8,89.4 C76.4,87.4 80.4,88.6 82,93 C84,102 85.4,113 85.4,124 C85.4,128.4 82,130.4 79,128.4 C77,119 74,102 72.8,89.4 Z' },
  { muscle: 'Hamstrings', bilateral: true, d: 'M51.4,120.4 C56.8,118.8 62.4,120.4 64.8,124.4 C66,136 65,148 62.4,157 C60.4,161 56,161 54.4,157 C51.8,146 51,132 51.4,120.4 Z' },
  { muscle: 'Calves', bilateral: true, d: 'M55.2,162.8 C58.8,160.8 62.4,162.4 63.4,167 C64.4,176 63.8,188 61.8,198 C60.4,201.8 56.8,201.8 55.8,198.4 C54.8,186 54.8,171.8 55.2,162.8 Z' },
];

/** Every muscle name this map can render. Anything else is silently ignored. */
export const MAPPED_MUSCLES: readonly string[] = Array.from(
  new Set([...FRONT, ...BACK].map((p) => p.muscle).filter((m): m is string => m !== null)),
);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const MIRROR = `translate(${VB_W},0) scale(-1,1)`;

function colourFor(share: number | undefined, peak: number): string {
  if (share === undefined || share <= 0 || peak <= 0) return HEAT_BASE;
  // Stretched against the session's own peak, so a single-muscle session still
  // reaches the top of the ramp instead of rendering as one dim smudge.
  const rel = Math.max(0, Math.min(1, share / peak));
  const idx = Math.max(1, Math.min(HEAT.length - 1, Math.round(rel * (HEAT.length - 1))));
  return HEAT[idx] ?? HEAT_BASE;
}

function Body({
  plates,
  shares,
  peak,
  width,
  height,
}: {
  plates: readonly Plate[];
  shares: MuscleShares;
  peak: number;
  width: number;
  height: number;
}) {
  const all = [...SCAFFOLD, ...plates];

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      {/*
        Pass 1: the whole figure in the untrained tone, stroked so the plates
        fuse into one silhouette. Pass 2 sits inside it, leaving a hairline of
        pass 1 showing between plates as the definition lines.
      */}
      <G fill={HEAT_BASE} stroke={HEAT_BASE} strokeWidth={2} strokeLinejoin="round">
        {all.map((p, i) => (
          <G key={`base-${i}`}>
            <Path d={p.d} />
            {p.bilateral ? <Path d={p.d} transform={MIRROR} /> : null}
          </G>
        ))}
      </G>

      <G strokeWidth={0}>
        {all.map((p, i) => {
          const fill = p.muscle === null ? HEAT_BASE : colourFor(shares[p.muscle], peak);
          if (fill === HEAT_BASE) return null;
          return (
            <G key={`heat-${i}`} fill={fill}>
              <Path d={p.d} />
              {p.bilateral ? <Path d={p.d} transform={MIRROR} /> : null}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

export function MuscleMap({
  shares,
  height = 120,
  view = 'both',
  legend = false,
  style,
}: {
  shares: MuscleShares;
  /** Rendered height of each body, in px. Legible from about 56px up. */
  height?: number;
  view?: 'both' | 'front' | 'back';
  /** Ramp key plus the top three muscles. Only worth it above ~110px. */
  legend?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const width = Math.round((height * VB_W) / VB_H);

  const { peak, top } = useMemo(() => {
    const entries = Object.entries(shares)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const first = entries[0];
    return { peak: first ? first[1] : 0, top: entries.slice(0, 3) };
  }, [shares]);

  const empty = peak <= 0;

  return (
    <View style={[styles.root, style]}>
      <View style={styles.bodies}>
        {view !== 'back' ? (
          <Body plates={FRONT} shares={shares} peak={peak} width={width} height={height} />
        ) : null}
        {view !== 'front' ? (
          <Body plates={BACK} shares={shares} peak={peak} width={width} height={height} />
        ) : null}
      </View>

      {legend ? (
        empty ? (
          <Text style={styles.legendEmpty}>No sets logged — nothing to shade yet</Text>
        ) : (
          <View style={styles.legend}>
            <View style={styles.rampRow}>
              <Text style={styles.rampEnd}>less</Text>
              <View style={styles.ramp}>
                {HEAT.map((step, i) => (
                  <View key={i} style={[styles.rampStep, { backgroundColor: step }]} />
                ))}
              </View>
              <Text style={styles.rampEnd}>more</Text>
            </View>
            <View style={styles.topRow}>
              {top.map(([name, value]) => (
                <View key={name} style={styles.topChip}>
                  <View
                    style={[styles.topDot, { backgroundColor: colourFor(value, peak) }]}
                  />
                  <Text style={styles.topName}>{name}</Text>
                  <Text style={styles.topPct}>{Math.round(value * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  bodies: { flexDirection: 'row', gap: space.xs },
  legend: { marginTop: space.md, alignSelf: 'stretch', gap: space.sm },
  legendEmpty: {
    ...type.caption,
    color: c.fg.tertiary,
    marginTop: space.md,
    textAlign: 'center',
  },
  rampRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rampEnd: { ...type.caption, color: c.fg.tertiary, fontSize: 11 },
  ramp: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  rampStep: { flex: 1 },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, justifyContent: 'center' },
  topChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: c.surface[2],
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  topDot: { width: 8, height: 8, borderRadius: radius.pill },
  topName: { ...type.caption, color: c.fg.secondary },
  topPct: {
    ...type.caption,
    color: c.fg.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
