/**
 * The archetype pose library — the single source of ALL exercise demo art.
 *
 * Every demonstration in the app is this one figure rig in two keyframes,
 * interpolated. Nothing is sourced from a third party, which is both a
 * licensing decision (every open exercise-media dataset is legally
 * compromised — see AGENTS.md) and the reason the art is standardised: twelve
 * exercises on one screen are literally the same figure, so they cannot drift
 * in style.
 *
 * Coordinates live in a 100×100 viewBox. Origin is top-left, y grows downward.
 * Side view unless noted, facing right.
 */

export type P = readonly [number, number];

export type Pose = {
  head: P;
  neck: P;
  hip: P;
  elbow: P;
  wrist: P;
  knee: P;
  ankle: P;
  /** The implement (bar, dumbbell, handle). Omitted for bodyweight work. */
  bar?: P;
};

export type Archetype = {
  id: string;
  /** Contracted / start position. */
  a: Pose;
  /** Stretched / end position. */
  b: Pose;
  /** Ground line height, or null to hide it (lying, hanging, seated-machine). */
  ground: number | null;
  /** Bench or seat rectangle [x, y, w, h]. */
  bench?: readonly [number, number, number, number];
  /** Milliseconds for one full rep. Slower for heavy compounds. */
  tempo: number;
};

const A = (
  id: string,
  a: Pose,
  b: Pose,
  ground: number | null,
  tempo = 2200,
  bench?: readonly [number, number, number, number],
): Archetype => ({ id, a, b, ground, tempo, ...(bench ? { bench } : {}) });

export const ARCHETYPES: Record<string, Archetype> = {
  /** Lying horizontal press — bench press, dumbbell press, machine press. */
  benchPress: A(
    'benchPress',
    {
      head: [30, 46], neck: [38, 50], hip: [62, 52],
      elbow: [40, 40], wrist: [42, 26], bar: [42, 22],
      knee: [74, 62], ankle: [78, 78],
    },
    {
      head: [30, 46], neck: [38, 50], hip: [62, 52],
      elbow: [32, 56], wrist: [42, 44], bar: [42, 40],
      knee: [74, 62], ankle: [78, 78],
    },
    82, 2400, [30, 52, 42, 5],
  ),

  /** Incline press — same mechanic, torso raised. */
  inclinePress: A(
    'inclinePress',
    {
      head: [28, 38], neck: [36, 44], hip: [62, 58],
      elbow: [38, 36], wrist: [40, 22], bar: [40, 18],
      knee: [74, 66], ankle: [78, 80],
    },
    {
      head: [28, 38], neck: [36, 44], hip: [62, 58],
      elbow: [30, 50], wrist: [40, 40], bar: [40, 36],
      knee: [74, 66], ankle: [78, 80],
    },
    82, 2400, [28, 44, 40, 5],
  ),

  /** Squat pattern — back squat, front squat, goblet, hack, leg press. */
  squat: A(
    'squat',
    {
      head: [50, 16], neck: [50, 24], hip: [50, 50],
      elbow: [42, 30], wrist: [40, 22], bar: [50, 22],
      knee: [52, 64], ankle: [50, 82],
    },
    {
      head: [46, 32], neck: [47, 40], hip: [44, 60],
      elbow: [39, 44], wrist: [37, 38], bar: [47, 38],
      knee: [60, 66], ankle: [50, 82],
    },
    82, 2600,
  ),

  /** Hip hinge — deadlift, RDL, good morning, kettlebell swing. */
  hinge: A(
    'hinge',
    {
      head: [50, 16], neck: [50, 24], hip: [50, 48],
      elbow: [52, 36], wrist: [53, 48], bar: [53, 50],
      knee: [52, 64], ankle: [50, 82],
    },
    {
      head: [36, 30], neck: [42, 34], hip: [56, 46],
      elbow: [46, 50], wrist: [50, 68], bar: [50, 72],
      knee: [58, 62], ankle: [50, 82],
    },
    82, 2800,
  ),

  /** Horizontal pull — barbell row, dumbbell row, cable row, T-bar. */
  row: A(
    'row',
    {
      head: [34, 32], neck: [42, 36], hip: [62, 44],
      elbow: [48, 48], wrist: [44, 40], bar: [43, 38],
      knee: [66, 60], ankle: [62, 80],
    },
    {
      head: [34, 32], neck: [42, 36], hip: [62, 44],
      elbow: [46, 56], wrist: [44, 66], bar: [43, 70],
      knee: [66, 60], ankle: [62, 80],
    },
    82, 2200,
  ),

  /** Vertical pull — pull-up, chin-up, lat pulldown. */
  pulldown: A(
    'pulldown',
    {
      head: [50, 30], neck: [50, 38], hip: [50, 58],
      elbow: [40, 34], wrist: [44, 20], bar: [50, 18],
      knee: [56, 70], ankle: [52, 84],
    },
    {
      head: [50, 22], neck: [50, 30], hip: [50, 52],
      elbow: [38, 22], wrist: [44, 14], bar: [50, 12],
      knee: [56, 64], ankle: [52, 80],
    },
    null, 2400,
  ),

  /** Vertical press — overhead press, push press, machine shoulder press. */
  overheadPress: A(
    'overheadPress',
    {
      head: [50, 20], neck: [50, 28], hip: [50, 52],
      elbow: [40, 28], wrist: [45, 14], bar: [50, 10],
      knee: [52, 66], ankle: [50, 82],
    },
    {
      head: [50, 20], neck: [50, 28], hip: [50, 52],
      elbow: [38, 38], wrist: [45, 28], bar: [50, 26],
      knee: [52, 66], ankle: [50, 82],
    },
    82, 2200,
  ),

  /** Elbow flexion — every curl. */
  curl: A(
    'curl',
    {
      head: [50, 18], neck: [50, 26], hip: [50, 52],
      elbow: [48, 44], wrist: [56, 32], bar: [58, 30],
      knee: [52, 66], ankle: [50, 82],
    },
    {
      head: [50, 18], neck: [50, 26], hip: [50, 52],
      elbow: [48, 44], wrist: [52, 62], bar: [53, 64],
      knee: [52, 66], ankle: [50, 82],
    },
    82, 2000,
  ),

  /** Elbow extension — pushdown, skullcrusher, overhead extension, kickback. */
  tricepsExtension: A(
    'tricepsExtension',
    {
      head: [50, 18], neck: [50, 26], hip: [50, 52],
      elbow: [48, 42], wrist: [52, 58], bar: [53, 60],
      knee: [52, 66], ankle: [50, 82],
    },
    {
      head: [50, 18], neck: [50, 26], hip: [50, 52],
      elbow: [48, 42], wrist: [46, 40], bar: [45, 38],
      knee: [52, 66], ankle: [50, 82],
    },
    82, 2000,
  ),

  /** Shoulder abduction — lateral raise, front raise, rear delt fly. */
  raise: A(
    'raise',
    {
      head: [50, 18], neck: [50, 26], hip: [50, 52],
      elbow: [64, 28], wrist: [76, 26], bar: [78, 26],
      knee: [52, 66], ankle: [50, 82],
    },
    {
      head: [50, 18], neck: [50, 26], hip: [50, 52],
      elbow: [56, 44], wrist: [60, 58], bar: [61, 60],
      knee: [52, 66], ankle: [50, 82],
    },
    82, 2000,
  ),

  /** Knee extension — leg extension machine. */
  legExtension: A(
    'legExtension',
    {
      head: [34, 28], neck: [40, 34], hip: [56, 48],
      elbow: [46, 44], wrist: [44, 52],
      knee: [72, 50], ankle: [88, 46],
    },
    {
      head: [34, 28], neck: [40, 34], hip: [56, 48],
      elbow: [46, 44], wrist: [44, 52],
      knee: [72, 50], ankle: [76, 70],
    },
    null, 2000, [36, 48, 38, 5],
  ),

  /** Knee flexion — lying and seated leg curl. */
  legCurl: A(
    'legCurl',
    {
      head: [22, 46], neck: [30, 48], hip: [56, 50],
      elbow: [34, 42], wrist: [30, 36],
      knee: [74, 52], ankle: [78, 32],
    },
    {
      head: [22, 46], neck: [30, 48], hip: [56, 50],
      elbow: [34, 42], wrist: [30, 36],
      knee: [74, 52], ankle: [90, 56],
    },
    null, 2000, [22, 50, 56, 5],
  ),

  /** Hip extension — hip thrust, glute bridge. */
  hipThrust: A(
    'hipThrust',
    {
      head: [24, 44], neck: [32, 46], hip: [56, 46],
      elbow: [34, 40], wrist: [30, 34], bar: [56, 40],
      knee: [74, 54], ankle: [78, 76],
    },
    {
      head: [24, 48], neck: [32, 52], hip: [56, 62],
      elbow: [34, 46], wrist: [30, 40], bar: [56, 56],
      knee: [74, 58], ankle: [78, 76],
    },
    82, 2200, [18, 44, 22, 5],
  ),

  /** Ankle plantarflexion — calf raise. */
  calfRaise: A(
    'calfRaise',
    {
      head: [50, 14], neck: [50, 22], hip: [50, 48],
      elbow: [46, 32], wrist: [46, 46],
      knee: [51, 64], ankle: [50, 78],
    },
    {
      head: [50, 20], neck: [50, 28], hip: [50, 54],
      elbow: [46, 38], wrist: [46, 52],
      knee: [51, 68], ankle: [50, 82],
    },
    82, 1800,
  ),

  /** Spinal flexion — crunch, cable crunch, leg raise. */
  crunch: A(
    'crunch',
    {
      head: [34, 44], neck: [40, 48], hip: [62, 54],
      elbow: [38, 42], wrist: [34, 40],
      knee: [72, 46], ankle: [80, 60],
    },
    {
      head: [28, 54], neck: [36, 54], hip: [62, 54],
      elbow: [32, 50], wrist: [28, 48],
      knee: [72, 46], ankle: [80, 60],
    },
    82, 2000,
  ),

  /** Chest fly / crossover — horizontal adduction. */
  fly: A(
    'fly',
    {
      head: [50, 18], neck: [50, 28], hip: [50, 54],
      elbow: [62, 34], wrist: [58, 44], bar: [57, 46],
      knee: [52, 68], ankle: [50, 82],
    },
    {
      head: [50, 18], neck: [50, 28], hip: [50, 54],
      elbow: [70, 28], wrist: [82, 34], bar: [84, 35],
      knee: [52, 68], ankle: [50, 82],
    },
    82, 2200,
  ),

  /** Dip and push-up — bodyweight horizontal/vertical press hybrid. */
  dip: A(
    'dip',
    {
      head: [50, 22], neck: [50, 30], hip: [52, 52],
      elbow: [42, 38], wrist: [40, 50],
      knee: [60, 64], ankle: [66, 76],
    },
    {
      head: [50, 34], neck: [50, 42], hip: [52, 62],
      elbow: [38, 40], wrist: [40, 50],
      knee: [62, 72], ankle: [70, 82],
    },
    null, 2200,
  ),

  /** Lunge and split squat. */
  lunge: A(
    'lunge',
    {
      head: [50, 16], neck: [50, 24], hip: [50, 48],
      elbow: [44, 32], wrist: [42, 46], bar: [41, 48],
      knee: [56, 64], ankle: [58, 82],
    },
    {
      head: [48, 28], neck: [48, 36], hip: [48, 58],
      elbow: [42, 44], wrist: [40, 58], bar: [39, 60],
      knee: [66, 70], ankle: [70, 82],
    },
    82, 2400,
  ),

  /** Shrug — scapular elevation. */
  shrug: A(
    'shrug',
    {
      head: [50, 16], neck: [50, 24], hip: [50, 52],
      elbow: [42, 40], wrist: [42, 56], bar: [42, 58],
      knee: [52, 66], ankle: [50, 82],
    },
    {
      head: [50, 18], neck: [50, 28], hip: [50, 52],
      elbow: [42, 44], wrist: [42, 62], bar: [42, 64],
      knee: [52, 66], ankle: [50, 82],
    },
    82, 1600,
  ),

  /** Static hold — plank, carries, hangs. Barely moves, by design. */
  hold: A(
    'hold',
    {
      head: [26, 46], neck: [34, 48], hip: [58, 54],
      elbow: [34, 58], wrist: [34, 70],
      knee: [74, 62], ankle: [86, 70],
    },
    {
      head: [26, 48], neck: [34, 50], hip: [58, 55],
      elbow: [34, 60], wrist: [34, 70],
      knee: [74, 63], ankle: [86, 70],
    },
    72, 3000,
  ),
};

/**
 * Map an exercise id to its archetype.
 *
 * Matching is by substring on the slug, most specific first — a catalog of
 * 1,200 exercises cannot carry a hand-assigned archetype per row, and the slug
 * already encodes the movement.
 */
const RULES: readonly (readonly [RegExp, string])[] = [
  [/incline.*(press|bench)/, 'inclinePress'],
  [/(bench-press|chest-press|close-grip)/, 'benchPress'],
  [/(fly|crossover|pec-deck)/, 'fly'],
  [/(dip|push-up)/, 'dip'],
  [/(pull-up|chin-up|pulldown|pullover)/, 'pulldown'],
  [/(row)/, 'row'],
  [/shrug/, 'shrug'],
  [/(deadlift|good-morning|swing|rack-pull|back-extension)/, 'hinge'],
  [/(squat|leg-press|thruster)/, 'squat'],
  [/(lunge|step-up|split-squat)/, 'lunge'],
  [/(hip-thrust|glute-bridge|kickback-glute|cable-kickback)/, 'hipThrust'],
  [/leg-extension/, 'legExtension'],
  [/leg-curl|nordic/, 'legCurl'],
  [/calf-raise/, 'calfRaise'],
  [/(crunch|leg-raise|plank|ab-wheel|twist|woodchop)/, 'crunch'],
  [/(overhead-press|shoulder-press|push-press|arnold|jerk)/, 'overheadPress'],
  [/(lateral-raise|front-raise|rear-delt|face-pull|upright-row)/, 'raise'],
  [/(triceps|pushdown|skullcrusher|extension)/, 'tricepsExtension'],
  [/(curl)/, 'curl'],
  [/(carry|hold|farmer)/, 'hold'],
  [/(clean|snatch)/, 'hinge'],
];

export function archetypeFor(exerciseId: string): Archetype {
  for (const [re, id] of RULES) {
    if (re.test(exerciseId)) {
      const found = ARCHETYPES[id];
      if (found) return found;
    }
  }
  return ARCHETYPES.squat as Archetype;
}

export function lerpPoint(a: P, b: P, t: number): P {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {
    head: lerpPoint(a.head, b.head, t),
    neck: lerpPoint(a.neck, b.neck, t),
    hip: lerpPoint(a.hip, b.hip, t),
    elbow: lerpPoint(a.elbow, b.elbow, t),
    wrist: lerpPoint(a.wrist, b.wrist, t),
    knee: lerpPoint(a.knee, b.knee, t),
    ankle: lerpPoint(a.ankle, b.ankle, t),
  };
  if (a.bar && b.bar) return { ...out, bar: lerpPoint(a.bar, b.bar, t) };
  return out;
}
