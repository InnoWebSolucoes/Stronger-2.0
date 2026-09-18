/**
 * Strength standards reference data for the world-standings system.
 *
 * SOURCE AND METHODOLOGY (Apple App Store Guideline 1.4.1 disclosure)
 * -------------------------------------------------------------------
 * Load tables: strengthlevel.com 2026 standards refresh — 195,513,376 lifts from
 * 27,893,268 users across 287 exercises. Submissions are filtered (unrealistic lifts,
 * automated entries and unusual submission patterns removed), converted to estimated
 * 1RMs, and lift weight is jointly modelled against bodyweight so a score is produced
 * at an exact bodyweight rather than inside a weight class. Ages 25-40 are the adult
 * baseline. Corroborated independently by Gravitus (10M workouts / 300k lifters),
 * which publishes the same five percentile anchors.
 *
 * The five named levels are NOT arbitrary buckets. Every credible provider anchors
 * them to fixed population percentiles:
 *   Beginner = P5, Novice = P20, Intermediate = P50, Advanced = P80, Elite = P95.
 * So each row of five numbers is five quantiles of one per-(exercise, sex, bodyweight)
 * distribution, and the engine fits a monotone curve through the five (ln load, z)
 * pairs instead of doing a table lookup.
 *
 * Reference population is `gym_app_lifters`. This matters enormously and must stay
 * visible in the UI: an ~83-85 kg man's 125 kg bench is the MEDIAN in OpenPowerlifting
 * competition data but ADVANCED against this population. Same word, 25-30% apart.
 *
 * All loads and bodyweights are in KILOGRAMS (the app's canonical storage unit).
 * Numbers are transcribed verbatim from the research brief
 * (docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md, Parts 1-3);
 * nothing here is smoothed, re-derived or invented.
 *
 * @see https://strengthlevel.com/about
 * @see https://gravitus.com/strength-standards/
 */

/** Biological reference distribution a lifter is compared against. */
export type Sex = 'male' | 'female';

/** The five published standard levels. */
export type Level = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

/** A lifter below the Beginner (P5) anchor is not yet on the published scale. */
export type ClassifiedLevel = 'untrained' | Level;

/** Ascending level order. Index position is meaningful; do not reorder. */
export const LEVEL_ORDER: readonly Level[] = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];

/**
 * Population percentile each named level is anchored to.
 * Source: strengthlevel.com/about ("stronger than X% of lifters"); identical on Gravitus.
 */
export const LEVEL_PERCENTILE: Readonly<Record<Level, number>> = {
  beginner: 0.05,
  novice: 0.2,
  intermediate: 0.5,
  advanced: 0.8,
  elite: 0.95,
};

/**
 * Standard-normal z-score of each level anchor (the inverse normal CDF of
 * LEVEL_PERCENTILE, to four decimals). These are the ordinates of the
 * (ln load -> z) spline.
 */
export const LEVEL_Z: Readonly<Record<Level, number>> = {
  beginner: -1.6449,
  novice: -0.8416,
  intermediate: 0.0,
  advanced: 0.8416,
  elite: 1.6449,
};

/** LEVEL_Z in LEVEL_ORDER sequence — the spline's ordinate vector. */
export const ANCHOR_Z: readonly number[] = [-1.6449, -0.8416, 0.0, 0.8416, 1.6449];

/** How a logged load relates to the number stored in the standards table. */
export type LoadType =
  /** Barbell / free-weight external load, exactly as logged. */
  | 'external'
  /** Machine or cable stack; hardware leverage varies 20-40% between manufacturers. */
  | 'external_machine'
  /** Total implement load including the bar (e.g. Bulgarian split squat). */
  | 'external_total'
  /** Published as ADDED weight, which is legitimately negative (assistance). */
  | 'added_bodyweight';

/** Movement pattern. The first six are the scoring patterns for the overall rank. */
export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_press'
  | 'vertical_press'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'isolation_quad'
  | 'isolation_hamstring'
  | 'isolation_calf'
  | 'isolation_trap'
  | 'isolation_bicep'
  | 'isolation_tricep'
  | 'isolation_sidedelt';

/** The six compound patterns the overall strength score is built from. */
export type ScoringPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_press'
  | 'vertical_press'
  | 'horizontal_pull'
  | 'vertical_pull';

/** Scoring patterns in the canonical order used by PATTERN_CORRELATION. */
export const SCORING_PATTERNS: readonly ScoringPattern[] = [
  'squat',
  'hinge',
  'horizontal_press',
  'vertical_press',
  'horizontal_pull',
  'vertical_pull',
];

/** How much hardware variance a machine introduces; inflates measurement noise. */
export type MachineVariance = 'medium' | 'high' | 'very_high';

/** One sex's bodyweight-indexed standards grid. All arrays share the `bw` length. */
export interface SexStandardTable {
  /** Bodyweight grid points in kg, strictly ascending. */
  readonly bw: readonly number[];
  /** P5 load in kg at each grid bodyweight (added weight for `added_bodyweight` lifts). */
  readonly beginner: readonly number[];
  /** P20 load in kg at each grid bodyweight. */
  readonly novice: readonly number[];
  /** P50 load in kg at each grid bodyweight. */
  readonly intermediate: readonly number[];
  /** P80 load in kg at each grid bodyweight. */
  readonly advanced: readonly number[];
  /** P95 load in kg at each grid bodyweight. */
  readonly elite: readonly number[];
}

/** An exercise's published standards plus everything needed to normalise a log entry. */
export interface ExerciseStandard {
  /** Stable slug. Never an index, never regenerated — user history depends on it. */
  readonly id: string;
  readonly name: string;
  readonly loadType: LoadType;
  /** True when the table is per dumbbell/implement rather than total. */
  readonly perSide?: boolean;
  /** Implement mass already included in the table value (kg), e.g. a 2 kg dumbbell handle. */
  readonly implementWeightKg?: number;
  /** Fraction of bodyweight actually lifted, for `added_bodyweight` lifts. */
  readonly bodyweightFraction?: number;
  readonly pattern: MovementPattern;
  readonly machineVariance?: MachineVariance;
  readonly male: SexStandardTable;
  readonly female: SexStandardTable;
}

/** A citable methodology note the UI can surface next to any computed number. */
export interface MethodologyNote {
  /** Plain-English explanation of what the computation does and how. */
  readonly summary: string;
  /** Human-readable citation. */
  readonly source: string;
  /** Canonical URL for the citation. */
  readonly url: string;
}

/** Which reference population the tables below describe. */
export const STANDARDS_META = {
  version: '2026.09',
  referencePopulation: 'gym_app_lifters',
  /** Short string the UI must show beside any standings number. */
  populationLabel: 'vs. 27M app lifters worldwide',
  source: 'strengthlevel.com 2026 standards refresh (195,513,376 lifts / 27,893,268 users)',
  url: 'https://strengthlevel.com/about',
  unit: 'kg',
  /** Ages treated as the adult baseline by the source dataset. */
  ageBaseline: [25, 40] as const,
} as const;

/**
 * Published standards grids, in kg, by exercise slug.
 *
 * `bench_press`, `back_squat`, `deadlift`, `overhead_press` and `barbell_row` carry the
 * full 50-140 kg male / 40-120 kg female grids. The remaining lifts carry the 5-point
 * (male 60-100 kg) / 4-point (female 50-80 kg) grids published for them. Bodyweight
 * exercises store ADDED weight, which is legitimately negative at the lower levels.
 *
 * Source: strengthlevel.com 2026 refresh, transcribed verbatim.
 */
export const STANDARDS: Readonly<Record<string, ExerciseStandard>> = {
  bench_press: {
    id: 'bench_press',
    name: 'Barbell Bench Press',
    loadType: 'external',
    perSide: false,
    pattern: 'horizontal_press',
    male: {
      bw: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140],
      beginner: [27, 32, 37, 42, 47, 51, 56, 60, 65, 69, 73, 77, 81, 85, 89, 93, 97, 100, 104],
      novice: [41, 47, 53, 59, 64, 70, 75, 80, 85, 90, 95, 99, 104, 108, 113, 117, 121, 125, 129],
      intermediate: [58, 65, 72, 79, 85, 92, 98, 104, 109, 115, 120, 125, 131, 135, 140, 145, 150, 154, 158],
      advanced: [78, 87, 95, 102, 110, 117, 124, 130, 137, 143, 149, 155, 160, 166, 171, 176, 181, 186, 191],
      elite: [101, 110, 119, 128, 136, 144, 151, 158, 165, 172, 179, 185, 191, 197, 203, 209, 214, 220, 225],
    },
    female: {
      bw: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120],
      beginner: [10, 12, 14, 17, 19, 21, 22, 24, 26, 28, 30, 31, 33, 35, 36, 38, 39],
      novice: [19, 22, 25, 28, 31, 33, 36, 38, 40, 43, 45, 47, 49, 51, 53, 54, 56],
      intermediate: [33, 36, 40, 44, 47, 50, 53, 56, 59, 61, 64, 66, 69, 71, 73, 75, 77],
      advanced: [49, 54, 58, 62, 66, 70, 74, 77, 80, 83, 86, 89, 92, 94, 97, 99, 102],
      elite: [68, 74, 79, 84, 88, 92, 96, 100, 104, 107, 111, 114, 117, 120, 123, 126, 128],
    },
  },

  back_squat: {
    id: 'back_squat',
    name: 'Barbell Back Squat',
    loadType: 'external',
    perSide: false,
    pattern: 'squat',
    male: {
      bw: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140],
      beginner: [36, 43, 49, 56, 62, 69, 75, 81, 87, 93, 98, 104, 109, 115, 120, 125, 130, 135, 140],
      novice: [55, 63, 71, 79, 86, 94, 101, 108, 115, 121, 128, 134, 140, 147, 152, 158, 164, 169, 175],
      intermediate: [78, 88, 98, 107, 116, 124, 132, 140, 148, 156, 163, 170, 177, 184, 191, 197, 203, 209, 215],
      advanced: [106, 118, 129, 139, 149, 159, 168, 177, 186, 194, 203, 211, 218, 226, 233, 240, 247, 254, 261],
      elite: [137, 150, 162, 174, 185, 196, 206, 216, 226, 235, 244, 253, 261, 270, 278, 285, 293, 300, 307],
    },
    female: {
      bw: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120],
      beginner: [19, 23, 26, 29, 32, 35, 37, 40, 42, 45, 47, 49, 52, 54, 56, 58, 60],
      novice: [34, 38, 42, 46, 49, 53, 56, 59, 62, 65, 68, 71, 74, 76, 79, 81, 83],
      intermediate: [53, 58, 63, 68, 72, 76, 80, 84, 88, 91, 94, 98, 101, 104, 107, 109, 112],
      advanced: [76, 82, 88, 94, 99, 104, 109, 113, 117, 121, 125, 129, 132, 136, 139, 142, 145],
      elite: [102, 110, 116, 123, 129, 134, 140, 145, 149, 154, 158, 162, 166, 170, 174, 177, 181],
    },
  },

  deadlift: {
    id: 'deadlift',
    name: 'Barbell Deadlift (conventional)',
    loadType: 'external',
    perSide: false,
    pattern: 'hinge',
    male: {
      bw: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140],
      beginner: [46, 54, 61, 68, 75, 82, 89, 96, 102, 108, 114, 120, 126, 132, 137, 143, 148, 153, 159],
      novice: [68, 77, 86, 95, 103, 111, 119, 127, 134, 141, 148, 155, 161, 168, 174, 180, 186, 192, 198],
      intermediate: [96, 107, 117, 127, 137, 146, 155, 164, 172, 180, 188, 195, 203, 210, 217, 224, 231, 237, 243],
      advanced: [129, 141, 153, 164, 175, 186, 196, 205, 215, 224, 232, 241, 249, 257, 265, 272, 280, 287, 294],
      elite: [164, 178, 191, 204, 216, 228, 239, 250, 260, 270, 279, 289, 298, 306, 315, 323, 331, 339, 346],
    },
    female: {
      bw: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120],
      beginner: [26, 30, 34, 37, 40, 43, 46, 49, 52, 54, 57, 59, 61, 64, 66, 68, 70],
      novice: [43, 48, 52, 56, 60, 64, 68, 71, 74, 77, 80, 83, 86, 89, 91, 94, 96],
      intermediate: [65, 71, 76, 81, 86, 90, 95, 99, 102, 106, 109, 113, 116, 119, 122, 125, 128],
      advanced: [92, 99, 105, 111, 116, 121, 126, 131, 135, 139, 143, 147, 151, 154, 158, 161, 164],
      elite: [121, 129, 136, 143, 149, 155, 160, 166, 170, 175, 180, 184, 188, 192, 196, 200, 203],
    },
  },

  overhead_press: {
    id: 'overhead_press',
    name: 'Barbell Overhead / Shoulder Press',
    loadType: 'external',
    perSide: false,
    pattern: 'vertical_press',
    male: {
      bw: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140],
      beginner: [15, 18, 21, 24, 27, 30, 33, 36, 38, 41, 44, 47, 49, 52, 54, 56, 59, 61, 63],
      novice: [24, 28, 32, 35, 39, 43, 46, 49, 53, 56, 59, 62, 65, 68, 71, 73, 76, 79, 81],
      intermediate: [36, 41, 45, 50, 54, 58, 62, 66, 70, 74, 77, 81, 84, 87, 90, 94, 97, 100, 102],
      advanced: [51, 56, 62, 67, 72, 76, 81, 85, 90, 94, 98, 102, 105, 109, 113, 116, 119, 123, 126],
      elite: [67, 73, 79, 85, 90, 96, 101, 106, 111, 115, 120, 124, 128, 132, 136, 140, 144, 147, 151],
    },
    female: {
      bw: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120],
      beginner: [7, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 24],
      novice: [13, 15, 17, 19, 20, 22, 23, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35],
      intermediate: [22, 24, 27, 29, 31, 32, 34, 36, 37, 39, 40, 42, 43, 45, 46, 47, 48],
      advanced: [33, 36, 38, 41, 43, 45, 47, 49, 51, 53, 54, 56, 58, 59, 61, 62, 64],
      elite: [45, 48, 51, 54, 57, 59, 62, 64, 66, 68, 70, 72, 74, 75, 77, 79, 80],
    },
  },

  barbell_row: {
    id: 'barbell_row',
    name: 'Barbell Bent Over Row',
    loadType: 'external',
    perSide: false,
    pattern: 'horizontal_pull',
    male: {
      bw: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140],
      beginner: [23, 27, 31, 36, 40, 44, 48, 52, 56, 59, 63, 67, 70, 74, 77, 80, 84, 87, 90],
      novice: [36, 41, 46, 51, 56, 61, 66, 71, 75, 79, 84, 88, 92, 96, 100, 103, 107, 111, 114],
      intermediate: [52, 59, 65, 71, 77, 83, 88, 93, 99, 104, 108, 113, 118, 122, 127, 131, 135, 139, 143],
      advanced: [72, 80, 87, 94, 101, 107, 114, 120, 125, 131, 136, 142, 147, 152, 157, 161, 166, 170, 175],
      elite: [94, 103, 111, 119, 127, 134, 141, 147, 154, 160, 166, 172, 178, 183, 188, 194, 199, 203, 208],
    },
    female: {
      bw: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120],
      beginner: [12, 14, 15, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 29, 30],
      novice: [21, 23, 25, 27, 29, 30, 32, 33, 35, 36, 37, 38, 40, 41, 42, 43, 44],
      intermediate: [33, 36, 38, 41, 43, 44, 46, 48, 50, 51, 53, 54, 56, 57, 58, 60, 61],
      advanced: [48, 51, 54, 57, 59, 62, 64, 66, 68, 69, 71, 73, 74, 76, 78, 79, 80],
      elite: [65, 69, 72, 75, 78, 80, 83, 85, 87, 89, 91, 93, 95, 97, 99, 100, 102],
    },
  },

  front_squat: {
    id: 'front_squat',
    name: 'Barbell Front Squat',
    loadType: 'external',
    perSide: false,
    pattern: 'squat',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [40, 50, 59, 68, 76],
      novice: [57, 69, 79, 90, 99],
      intermediate: [79, 92, 104, 116, 127],
      advanced: [104, 119, 133, 146, 158],
      elite: [130, 147, 163, 177, 190],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [26, 31, 35, 38],
      novice: [39, 44, 48, 53],
      intermediate: [54, 60, 65, 70],
      advanced: [72, 79, 85, 90],
      elite: [91, 99, 106, 112],
    },
  },

  hack_squat: {
    id: 'hack_squat',
    name: 'Machine Hack Squat',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'squat',
    machineVariance: 'high',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [41, 52, 63, 74, 84],
      novice: [73, 88, 102, 115, 127],
      intermediate: [117, 135, 152, 168, 183],
      advanced: [171, 193, 213, 232, 249],
      elite: [231, 257, 280, 302, 321],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [19, 24, 28, 32],
      novice: [43, 50, 56, 62],
      intermediate: [78, 87, 95, 102],
      advanced: [124, 135, 145, 154],
      elite: [176, 190, 202, 212],
    },
  },

  leg_press: {
    id: 'leg_press',
    name: 'Sled Leg Press',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'squat',
    machineVariance: 'very_high',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [71, 90, 109, 127, 144],
      novice: [115, 139, 162, 184, 205],
      intermediate: [173, 202, 230, 255, 280],
      advanced: [242, 277, 309, 338, 366],
      elite: [319, 359, 395, 429, 460],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [39, 49, 58, 67],
      novice: [73, 87, 100, 111],
      intermediate: [122, 140, 155, 170],
      advanced: [183, 204, 223, 240],
      elite: [252, 277, 299, 319],
    },
  },

  bulgarian_split_squat: {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    loadType: 'external_total',
    perSide: false,
    pattern: 'squat',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [10, 15, 21, 26, 32],
      novice: [25, 33, 41, 48, 55],
      intermediate: [47, 58, 68, 78, 87],
      advanced: [77, 90, 103, 115, 126],
      elite: [112, 128, 143, 157, 170],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [8, 10, 12, 13],
      novice: [18, 20, 23, 25],
      intermediate: [32, 36, 39, 42],
      advanced: [50, 55, 59, 63],
      elite: [72, 77, 82, 87],
    },
  },

  hip_thrust: {
    id: 'hip_thrust',
    name: 'Barbell Hip Thrust',
    loadType: 'external',
    perSide: false,
    pattern: 'hinge',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [32, 44, 56, 68, 80],
      novice: [63, 80, 96, 111, 126],
      intermediate: [107, 129, 149, 168, 186],
      advanced: [163, 189, 213, 236, 257],
      elite: [227, 257, 285, 311, 335],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [30, 35, 39, 43],
      novice: [56, 63, 69, 74],
      intermediate: [92, 100, 108, 114],
      advanced: [137, 147, 155, 163],
      elite: [187, 199, 209, 218],
    },
  },

  romanian_deadlift: {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift',
    loadType: 'external',
    perSide: false,
    pattern: 'hinge',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [43, 54, 65, 75, 85],
      novice: [65, 79, 92, 104, 115],
      intermediate: [93, 110, 125, 139, 152],
      advanced: [127, 145, 163, 179, 194],
      elite: [163, 184, 203, 221, 238],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [27, 31, 34, 37],
      novice: [42, 47, 51, 54],
      intermediate: [61, 67, 71, 75],
      advanced: [84, 90, 96, 100],
      elite: [109, 116, 122, 128],
    },
  },

  sumo_deadlift: {
    id: 'sumo_deadlift',
    name: 'Sumo Deadlift',
    loadType: 'external',
    perSide: false,
    pattern: 'hinge',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [72, 88, 102, 116, 128],
      novice: [100, 118, 135, 150, 165],
      intermediate: [134, 155, 174, 192, 208],
      advanced: [174, 197, 218, 238, 256],
      elite: [216, 241, 265, 287, 307],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [43, 47, 51, 55],
      novice: [62, 68, 73, 77],
      intermediate: [87, 93, 99, 104],
      advanced: [115, 122, 129, 135],
      elite: [146, 154, 161, 168],
    },
  },

  incline_bench_press: {
    id: 'incline_bench_press',
    name: 'Incline Barbell Bench Press',
    loadType: 'external',
    perSide: false,
    pattern: 'horizontal_press',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [32, 41, 50, 58, 66],
      novice: [45, 56, 66, 76, 86],
      intermediate: [62, 75, 87, 98, 108],
      advanced: [82, 96, 109, 122, 134],
      elite: [103, 119, 134, 147, 160],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [11, 14, 18, 21],
      novice: [20, 25, 29, 34],
      intermediate: [33, 39, 45, 50],
      advanced: [49, 56, 63, 69],
      elite: [67, 76, 84, 91],
    },
  },

  close_grip_bench_press: {
    id: 'close_grip_bench_press',
    name: 'Close Grip Bench Press',
    loadType: 'external',
    perSide: false,
    pattern: 'horizontal_press',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [35, 45, 55, 64, 73],
      novice: [49, 61, 72, 83, 93],
      intermediate: [66, 80, 93, 105, 116],
      advanced: [86, 101, 116, 129, 142],
      elite: [107, 124, 140, 155, 169],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [16, 20, 24, 28],
      novice: [26, 31, 37, 41],
      intermediate: [39, 46, 52, 58],
      advanced: [55, 63, 70, 77],
      elite: [72, 82, 90, 97],
    },
  },

  dumbbell_bench_press: {
    id: 'dumbbell_bench_press',
    name: 'Dumbbell Bench Press',
    loadType: 'external',
    perSide: true,
    implementWeightKg: 2,
    pattern: 'horizontal_press',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [13, 16, 19, 22, 25],
      novice: [20, 24, 28, 32, 36],
      intermediate: [30, 35, 40, 44, 48],
      advanced: [42, 48, 53, 58, 63],
      elite: [55, 62, 68, 74, 79],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [5, 7, 8, 9],
      novice: [10, 12, 14, 15],
      intermediate: [16, 19, 21, 23],
      advanced: [25, 28, 30, 33],
      elite: [34, 38, 41, 44],
    },
  },

  dumbbell_shoulder_press: {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    loadType: 'external',
    perSide: true,
    implementWeightKg: 2,
    pattern: 'vertical_press',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [10, 12, 15, 18, 20],
      novice: [15, 19, 22, 25, 28],
      intermediate: [23, 27, 31, 35, 39],
      advanced: [32, 37, 42, 46, 50],
      elite: [43, 48, 54, 59, 63],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [5, 6, 7, 8],
      novice: [8, 10, 11, 12],
      intermediate: [13, 15, 16, 17],
      advanced: [18, 20, 22, 24],
      elite: [25, 27, 29, 31],
    },
  },

  lat_pulldown: {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'vertical_pull',
    machineVariance: 'medium',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [35, 42, 47, 52, 57],
      novice: [50, 57, 64, 70, 76],
      intermediate: [69, 77, 85, 92, 98],
      advanced: [90, 99, 108, 116, 123],
      elite: [113, 123, 133, 142, 150],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [20, 23, 25, 27],
      novice: [30, 33, 36, 38],
      intermediate: [42, 46, 49, 52],
      advanced: [56, 60, 64, 68],
      elite: [72, 76, 81, 85],
    },
  },

  seated_cable_row: {
    id: 'seated_cable_row',
    name: 'Seated Cable Row',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'horizontal_pull',
    machineVariance: 'medium',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [33, 40, 47, 53, 59],
      novice: [49, 57, 65, 72, 79],
      intermediate: [68, 78, 87, 96, 104],
      advanced: [90, 102, 112, 122, 131],
      elite: [115, 128, 140, 150, 160],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [18, 21, 24, 26],
      novice: [28, 32, 35, 38],
      intermediate: [41, 45, 50, 53],
      advanced: [56, 62, 66, 71],
      elite: [73, 79, 85, 89],
    },
  },

  pull_up: {
    id: 'pull_up',
    name: 'Pull-Up (pronated)',
    loadType: 'added_bodyweight',
    bodyweightFraction: 0.93,
    pattern: 'vertical_pull',
    male: {
      bw: [50, 60, 70, 80, 90, 100],
      beginner: [-5, -4, -2, -2, -2, -3],
      novice: [7, 11, 13, 14, 15, 15],
      intermediate: [22, 27, 31, 33, 35, 36],
      advanced: [39, 45, 50, 54, 57, 59],
      elite: [56, 64, 71, 75, 79, 82],
    },
    female: {
      bw: [40, 50, 60, 70, 80],
      beginner: [-14, -14, -16, -18, -20],
      novice: [-5, -4, -4, -5, -7],
      intermediate: [6, 8, 9, 9, 8],
      advanced: [17, 21, 23, 24, 24],
      elite: [30, 35, 38, 40, 41],
    },
  },

  chin_up: {
    id: 'chin_up',
    name: 'Chin-Up (supinated)',
    loadType: 'added_bodyweight',
    bodyweightFraction: 0.93,
    pattern: 'vertical_pull',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [-2, -1, 0, 0, -1],
      novice: [12, 14, 16, 17, 17],
      intermediate: [28, 32, 34, 36, 37],
      advanced: [46, 50, 54, 57, 59],
      elite: [64, 70, 75, 79, 81],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [-10, -10, -11, -13],
      novice: [-1, -1, -1, -2],
      intermediate: [8, 10, 10, 10],
      advanced: [19, 21, 23, 23],
      elite: [30, 33, 35, 36],
    },
  },

  dip: {
    id: 'dip',
    name: 'Dip (chest/triceps)',
    loadType: 'added_bodyweight',
    bodyweightFraction: 0.93,
    pattern: 'horizontal_press',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [-1, 2, 5, 6, 8],
      novice: [17, 22, 26, 30, 32],
      intermediate: [39, 46, 52, 57, 61],
      advanced: [64, 73, 81, 87, 92],
      elite: [91, 101, 111, 118, 125],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [-15, -15, -16, -17],
      novice: [-2, 0, 0, 0],
      intermediate: [14, 17, 19, 20],
      advanced: [32, 37, 40, 42],
      elite: [52, 58, 62, 66],
    },
  },

  leg_extension: {
    id: 'leg_extension',
    name: 'Leg Extension',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'isolation_quad',
    machineVariance: 'high',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [36, 42, 48, 53, 58],
      novice: [57, 65, 72, 79, 85],
      intermediate: [85, 95, 103, 111, 119],
      advanced: [119, 130, 140, 149, 158],
      elite: [156, 169, 180, 191, 201],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [19, 22, 24, 27],
      novice: [34, 38, 41, 44],
      intermediate: [55, 59, 64, 67],
      advanced: [80, 86, 91, 95],
      elite: [109, 115, 121, 126],
    },
  },

  lying_leg_curl: {
    id: 'lying_leg_curl',
    name: 'Lying Leg Curl',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'isolation_hamstring',
    machineVariance: 'high',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [21, 25, 30, 35, 39],
      novice: [34, 40, 46, 51, 57],
      intermediate: [52, 59, 66, 73, 79],
      advanced: [73, 82, 90, 98, 105],
      elite: [96, 107, 116, 125, 133],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [13, 15, 17, 19],
      novice: [21, 24, 27, 29],
      intermediate: [32, 36, 40, 43],
      advanced: [46, 51, 55, 58],
      elite: [62, 67, 71, 75],
    },
  },

  seated_calf_raise: {
    id: 'seated_calf_raise',
    name: 'Seated Calf Raise',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'isolation_calf',
    machineVariance: 'high',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [20, 26, 31, 37, 42],
      novice: [41, 50, 57, 64, 71],
      intermediate: [73, 83, 93, 102, 111],
      advanced: [112, 126, 138, 149, 159],
      elite: [158, 174, 188, 201, 213],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [11, 14, 17, 20],
      novice: [29, 34, 38, 42],
      intermediate: [56, 63, 69, 74],
      advanced: [93, 102, 109, 116],
      elite: [137, 147, 156, 164],
    },
  },

  barbell_shrug: {
    id: 'barbell_shrug',
    name: 'Barbell Shrug',
    loadType: 'external',
    perSide: false,
    pattern: 'isolation_trap',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [30, 42, 53, 65, 76],
      novice: [55, 70, 85, 99, 113],
      intermediate: [89, 108, 126, 143, 159],
      advanced: [130, 154, 175, 195, 214],
      elite: [178, 205, 230, 253, 274],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [12, 17, 22, 27],
      novice: [28, 35, 42, 49],
      intermediate: [51, 61, 71, 79],
      advanced: [82, 95, 106, 117],
      elite: [119, 134, 147, 159],
    },
  },

  barbell_curl: {
    id: 'barbell_curl',
    name: 'Barbell Curl',
    loadType: 'external',
    perSide: false,
    pattern: 'isolation_bicep',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [15, 18, 22, 25, 28],
      novice: [24, 28, 33, 36, 40],
      intermediate: [36, 41, 46, 51, 55],
      advanced: [50, 57, 63, 68, 73],
      elite: [66, 74, 80, 87, 92],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [6, 8, 9, 11],
      novice: [12, 14, 16, 18],
      intermediate: [20, 23, 26, 28],
      advanced: [31, 34, 37, 40],
      elite: [43, 47, 51, 54],
    },
  },

  tricep_pushdown: {
    id: 'tricep_pushdown',
    name: 'Cable Tricep Pushdown',
    loadType: 'external_machine',
    perSide: false,
    pattern: 'isolation_tricep',
    machineVariance: 'medium',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [14, 18, 22, 25, 29],
      novice: [26, 31, 36, 41, 46],
      intermediate: [43, 50, 56, 62, 67],
      advanced: [64, 73, 80, 87, 93],
      elite: [89, 98, 107, 115, 122],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [7, 9, 11, 12],
      novice: [14, 17, 19, 22],
      intermediate: [24, 28, 31, 34],
      advanced: [38, 42, 46, 50],
      elite: [53, 59, 63, 67],
    },
  },

  dumbbell_lateral_raise: {
    id: 'dumbbell_lateral_raise',
    name: 'Dumbbell Lateral Raise',
    loadType: 'external',
    perSide: true,
    implementWeightKg: 2,
    pattern: 'isolation_sidedelt',
    male: {
      bw: [60, 70, 80, 90, 100],
      beginner: [3, 4, 5, 6, 7],
      novice: [7, 9, 10, 11, 12],
      intermediate: [13, 15, 16, 18, 19],
      advanced: [20, 23, 25, 27, 28],
      elite: [29, 32, 34, 37, 39],
    },
    female: {
      bw: [50, 60, 70, 80],
      beginner: [3, 3, 3, 4],
      novice: [5, 6, 6, 6],
      intermediate: [8, 9, 9, 10],
      advanced: [12, 13, 14, 14],
      elite: [16, 17, 18, 19],
    },
  },
};

/** Every exercise slug that has a published standards grid. */
export const STANDARD_IDS: readonly string[] = Object.keys(STANDARDS);

/**
 * Look up a standards table by stable exercise slug.
 * @param id stable exercise slug (never an index or generated UUID)
 * @returns the standard, or undefined when the exercise has no published table
 * @see https://strengthlevel.com/strength-standards
 */
export function getStandard(id: string): ExerciseStandard | undefined {
  return STANDARDS[id];
}

/**
 * Look up a standards table, throwing when the slug is unknown. Use where a missing
 * table is a programming error rather than a user logging an exotic exercise.
 * @param id stable exercise slug
 * @throws RangeError when no table exists for the slug
 * @see https://strengthlevel.com/strength-standards
 */
export function requireStandard(id: string): ExerciseStandard {
  const std = STANDARDS[id];
  if (std === undefined) throw new RangeError(`No strength standard for exercise "${id}"`);
  return std;
}

// ---------------------------------------------------------------------------
// Muscle contribution matrix
// ---------------------------------------------------------------------------

/** The 17 muscle groups the body map and the rollup are defined over. */
export type MuscleGroup =
  | 'chest'
  | 'frontDelt'
  | 'sideDelt'
  | 'rearDelt'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'lats'
  | 'upperBack'
  | 'traps'
  | 'lowerBack'
  | 'abs'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

/** Canonical muscle order. Used as the parameter order of the rollup solver. */
export const MUSCLES: readonly MuscleGroup[] = [
  'chest',
  'frontDelt',
  'sideDelt',
  'rearDelt',
  'triceps',
  'biceps',
  'forearms',
  'lats',
  'upperBack',
  'traps',
  'lowerBack',
  'abs',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
];

/** Contribution weights of one exercise, summing to 1.0. */
export type ContributionRow = Readonly<Partial<Record<MuscleGroup, number>>>;

/**
 * Muscle contribution matrix W: how much each exercise's LOAD CEILING is determined
 * by each muscle. Every row sums to 1.0.
 *
 * These are limiting contributions, not EMG amplitudes. EMG %MVC literature is the
 * prior (bench: pec up to 95% MVC, anterior delt 79%, triceps 67%; squat ascent:
 * quads up to 74%, glutes 52%, hamstrings 43%), but activation is not the same as
 * limitation — spinal erectors fire hard in a squat as stabilisers yet rarely cap the
 * lift. The plan of record is to refit W by factor analysis from the app's own
 * cross-exercise histories once enough users have them.
 *
 * @see https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/
 * @see https://www.jefit.com/blog/best-exercises-for-each-major-muscle-group-backed-emg-data
 */
export const MUSCLE_CONTRIBUTIONS: Readonly<Record<string, ContributionRow>> = {
  bench_press: { chest: 0.46, frontDelt: 0.22, triceps: 0.28, sideDelt: 0.02, lats: 0.02 },
  incline_bench_press: { chest: 0.38, frontDelt: 0.32, triceps: 0.26, sideDelt: 0.04 },
  close_grip_bench_press: { chest: 0.3, frontDelt: 0.2, triceps: 0.46, sideDelt: 0.04 },
  dumbbell_bench_press: { chest: 0.48, frontDelt: 0.22, triceps: 0.24, sideDelt: 0.03, forearms: 0.03 },
  machine_chest_press: { chest: 0.5, frontDelt: 0.22, triceps: 0.26, sideDelt: 0.02 },
  cable_fly: { chest: 0.78, frontDelt: 0.14, biceps: 0.04, forearms: 0.04 },
  push_up: { chest: 0.44, frontDelt: 0.2, triceps: 0.26, abs: 0.07, sideDelt: 0.03 },
  dip: { chest: 0.38, triceps: 0.38, frontDelt: 0.18, sideDelt: 0.02, abs: 0.04 },

  overhead_press: { frontDelt: 0.4, sideDelt: 0.16, triceps: 0.28, upperBack: 0.04, abs: 0.08, traps: 0.04 },
  dumbbell_shoulder_press: { frontDelt: 0.42, sideDelt: 0.18, triceps: 0.26, abs: 0.08, traps: 0.06 },
  dumbbell_lateral_raise: { sideDelt: 0.8, frontDelt: 0.08, traps: 0.1, forearms: 0.02 },
  rear_delt_fly: { rearDelt: 0.62, upperBack: 0.28, traps: 0.08, forearms: 0.02 },
  face_pull: { rearDelt: 0.44, upperBack: 0.34, traps: 0.14, biceps: 0.05, forearms: 0.03 },

  tricep_pushdown: { triceps: 0.88, forearms: 0.06, chest: 0.03, frontDelt: 0.03 },
  overhead_tricep_ext: { triceps: 0.88, frontDelt: 0.05, forearms: 0.04, abs: 0.03 },
  barbell_curl: { biceps: 0.78, forearms: 0.16, frontDelt: 0.04, upperBack: 0.02 },
  hammer_curl: { biceps: 0.62, forearms: 0.34, frontDelt: 0.04 },

  barbell_row: { lats: 0.32, upperBack: 0.26, rearDelt: 0.1, biceps: 0.12, lowerBack: 0.12, forearms: 0.06, traps: 0.02 },
  t_bar_row: { lats: 0.34, upperBack: 0.28, rearDelt: 0.09, biceps: 0.12, lowerBack: 0.09, forearms: 0.06, traps: 0.02 },
  seated_cable_row: { lats: 0.34, upperBack: 0.3, rearDelt: 0.09, biceps: 0.14, forearms: 0.07, lowerBack: 0.06 },
  lat_pulldown: { lats: 0.5, upperBack: 0.16, biceps: 0.18, rearDelt: 0.06, forearms: 0.08, abs: 0.02 },
  pull_up: { lats: 0.48, upperBack: 0.15, biceps: 0.17, rearDelt: 0.05, forearms: 0.09, abs: 0.06 },
  chin_up: { lats: 0.42, biceps: 0.26, upperBack: 0.13, forearms: 0.09, abs: 0.06, rearDelt: 0.04 },
  barbell_shrug: { traps: 0.74, upperBack: 0.12, forearms: 0.12, lowerBack: 0.02 },

  back_squat: { quads: 0.4, glutes: 0.26, adductors: 0.1, hamstrings: 0.08, lowerBack: 0.1, abs: 0.06 },
  front_squat: { quads: 0.48, glutes: 0.2, adductors: 0.08, lowerBack: 0.1, abs: 0.09, upperBack: 0.05 },
  hack_squat: { quads: 0.58, glutes: 0.22, adductors: 0.09, hamstrings: 0.06, abs: 0.05 },
  leg_press: { quads: 0.48, glutes: 0.28, adductors: 0.12, hamstrings: 0.08, calves: 0.04 },
  bulgarian_split_squat: { quads: 0.4, glutes: 0.34, adductors: 0.1, hamstrings: 0.08, abs: 0.05, calves: 0.03 },
  walking_lunge: { quads: 0.36, glutes: 0.36, adductors: 0.1, hamstrings: 0.09, abs: 0.06, calves: 0.03 },
  leg_extension: { quads: 0.94, abs: 0.03, calves: 0.03 },

  deadlift: { hamstrings: 0.22, glutes: 0.24, lowerBack: 0.22, quads: 0.12, traps: 0.08, forearms: 0.07, upperBack: 0.05 },
  sumo_deadlift: { glutes: 0.26, quads: 0.2, adductors: 0.14, hamstrings: 0.16, lowerBack: 0.14, forearms: 0.06, traps: 0.04 },
  romanian_deadlift: { hamstrings: 0.38, glutes: 0.28, lowerBack: 0.2, forearms: 0.07, traps: 0.04, upperBack: 0.03 },
  hip_thrust: { glutes: 0.62, hamstrings: 0.2, quads: 0.12, abs: 0.06 },
  lying_leg_curl: { hamstrings: 0.9, calves: 0.07, glutes: 0.03 },
  good_morning: { hamstrings: 0.34, lowerBack: 0.34, glutes: 0.26, abs: 0.06 },
  back_extension: { lowerBack: 0.5, glutes: 0.28, hamstrings: 0.22 },

  standing_calf_raise: { calves: 0.94, quads: 0.03, abs: 0.03 },
  seated_calf_raise: { calves: 1.0 },
  hanging_leg_raise: { abs: 0.8, lats: 0.1, forearms: 0.06, quads: 0.04 },
  ab_wheel_rollout: { abs: 0.72, lats: 0.12, frontDelt: 0.08, lowerBack: 0.08 },
};

/**
 * Base measurement noise (SD in z units) by equipment class. Higher means the lift is
 * a less trustworthy probe of true strength: machine leverage, sled weight and pulley
 * ratios differ 20-40% between manufacturers, so a leg press number is worth far less
 * evidence than a barbell squat number.
 */
export const EXERCISE_NOISE_TAU = {
  barbell_compound: 0.28,
  dumbbell_compound: 0.34,
  bodyweight_loaded: 0.32,
  cable_isolation: 0.42,
  machine_compound: 0.48,
  machine_isolation: 0.52,
  unilateral: 0.4,
} as const;

/**
 * Weight of each movement pattern in the overall strength score.
 * Mirrors Symmetric Strength's "best lift in each of five categories" design, extended
 * to six patterns so vertical and horizontal pulling are scored separately.
 * @see https://symmetricstrength.com/about
 */
export const PATTERN_WEIGHTS: Readonly<Record<ScoringPattern, number>> = {
  squat: 0.22,
  hinge: 0.22,
  horizontal_press: 0.17,
  vertical_press: 0.11,
  horizontal_pull: 0.14,
  vertical_pull: 0.14,
};

/**
 * Correlation matrix R between pattern z-scores, in SCORING_PATTERNS order.
 * Lifts correlate at roughly 0.58-0.85 within a lifter. The overall score divides the
 * weighted mean by sqrt(wᵀRw); without that correction every consistent lifter is
 * dragged toward the 50th percentile and "Top X%" is simply wrong.
 */
export const PATTERN_CORRELATION: readonly (readonly number[])[] = [
  [1.0, 0.85, 0.68, 0.62, 0.66, 0.58],
  [0.85, 1.0, 0.64, 0.58, 0.7, 0.62],
  [0.68, 0.64, 1.0, 0.8, 0.72, 0.66],
  [0.62, 0.58, 0.8, 1.0, 0.7, 0.68],
  [0.66, 0.7, 0.72, 0.7, 1.0, 0.82],
  [0.58, 0.62, 0.66, 0.68, 0.82, 1.0],
];

/**
 * Bootstrap ratios for exercises with no published standards:
 * `standard_e(bw, level) = ratio × standard_anchor(bw, level)`.
 * `confidence` is the prior weight on the ratio (1 = well evidenced); the plan is to
 * refit each ratio as the median paired e1RM ratio among users who log both lifts.
 */
export interface AnchorMapping {
  /** Slug of the exercise whose published table is borrowed. */
  readonly anchor: string;
  /** Multiplier applied to every level of the anchor's table. */
  readonly ratio: number;
  /** 0-1 confidence in the ratio; low confidence must inflate measurement noise. */
  readonly confidence: number;
}

/** Anchor mappings for the long tail of exercises, keyed by stable slug. */
export const ANCHOR_MAPPINGS: Readonly<Record<string, AnchorMapping>> = {
  smith_machine_bench_press: { anchor: 'bench_press', ratio: 1.06, confidence: 0.7 },
  machine_chest_press: { anchor: 'bench_press', ratio: 1.02, confidence: 0.6 },
  decline_bench_press: { anchor: 'bench_press', ratio: 1.05, confidence: 0.8 },
  paused_bench_press: { anchor: 'bench_press', ratio: 0.93, confidence: 0.9 },
  floor_press: { anchor: 'bench_press', ratio: 0.9, confidence: 0.8 },
  seated_overhead_press: { anchor: 'overhead_press', ratio: 1.05, confidence: 0.85 },
  push_press: { anchor: 'overhead_press', ratio: 1.3, confidence: 0.8 },
  arnold_press: { anchor: 'dumbbell_shoulder_press', ratio: 0.9, confidence: 0.7 },
  pendlay_row: { anchor: 'barbell_row', ratio: 0.92, confidence: 0.8 },
  chest_supported_row: { anchor: 'barbell_row', ratio: 0.95, confidence: 0.7 },
  box_squat: { anchor: 'back_squat', ratio: 1.02, confidence: 0.8 },
  safety_bar_squat: { anchor: 'back_squat', ratio: 0.92, confidence: 0.75 },
  smith_machine_squat: { anchor: 'back_squat', ratio: 1.1, confidence: 0.6 },
  goblet_squat: { anchor: 'front_squat', ratio: 0.55, confidence: 0.6 },
  trap_bar_deadlift: { anchor: 'deadlift', ratio: 1.08, confidence: 0.8 },
  deficit_deadlift: { anchor: 'deadlift', ratio: 0.9, confidence: 0.8 },
  rack_pull: { anchor: 'deadlift', ratio: 1.25, confidence: 0.6 },
  stiff_leg_deadlift: { anchor: 'romanian_deadlift', ratio: 0.95, confidence: 0.85 },
  single_leg_hip_thrust: { anchor: 'hip_thrust', ratio: 0.42, confidence: 0.6 },
  seated_leg_curl: { anchor: 'lying_leg_curl', ratio: 1.05, confidence: 0.8 },
  preacher_curl: { anchor: 'barbell_curl', ratio: 0.8, confidence: 0.8 },
  ez_bar_curl: { anchor: 'barbell_curl', ratio: 1.0, confidence: 0.9 },
  skullcrusher: { anchor: 'close_grip_bench_press', ratio: 0.48, confidence: 0.7 },
};

// ---------------------------------------------------------------------------
// Rank ladder
// ---------------------------------------------------------------------------

/** Score = SCORE_INTERCEPT + SCORE_SLOPE × z. */
export const SCORE_INTERCEPT = 36;
/** Points per z-score unit. 18 gives 15-point bands one 0.833 z apart. */
export const SCORE_SLOPE = 18;
/** Displayed score is clipped to this closed interval. */
export const SCORE_CLIP: readonly [number, number] = [0, 120];
/** Width of a sub-tier in points. Three sub-tiers make a 15-point band. */
export const SUB_TIER_WIDTH = 5.0;

/** One named band of the rank ladder. */
export interface RankBand {
  /** Display name, e.g. "Novice". */
  readonly tier: string;
  /** Inclusive lower score bound. */
  readonly from: number;
  /** Exclusive upper score bound. */
  readonly to: number;
  /** Roman sub-tier numerals, empty for bands that have none. */
  readonly subTiers: readonly string[];
  /** z-score at the band floor. */
  readonly zFrom: number;
  /** Population percentile at the band floor. */
  readonly percentileFrom: number;
}

/**
 * The named rank ladder. 15-point bands, three 5-point sub-tiers each, on the
 * S = 36 + 18z scale, so the band floors land on the published percentile anchors:
 * Beginner ≈ P5, Novice ≈ P20, Intermediate = P50, Advanced ≈ P80, Elite ≈ P95.
 */
export const RANK_LADDER: readonly RankBand[] = [
  { tier: 'Untrained', from: 0.0, to: 6.0, subTiers: [], zFrom: -2.0, percentileFrom: 0.023 },
  { tier: 'Beginner', from: 6.0, to: 21.0, subTiers: ['I', 'II', 'III'], zFrom: -1.667, percentileFrom: 0.048 },
  { tier: 'Novice', from: 21.0, to: 36.0, subTiers: ['I', 'II', 'III'], zFrom: -0.833, percentileFrom: 0.202 },
  { tier: 'Intermediate', from: 36.0, to: 51.0, subTiers: ['I', 'II', 'III'], zFrom: 0.0, percentileFrom: 0.5 },
  { tier: 'Advanced', from: 51.0, to: 66.0, subTiers: ['I', 'II', 'III'], zFrom: 0.833, percentileFrom: 0.798 },
  { tier: 'Elite', from: 66.0, to: 81.0, subTiers: ['I', 'II', 'III'], zFrom: 1.667, percentileFrom: 0.952 },
  { tier: 'World Class', from: 81.0, to: 96.0, subTiers: ['I', 'II', 'III'], zFrom: 2.5, percentileFrom: 0.9938 },
  { tier: 'Legendary', from: 96.0, to: 120.0, subTiers: [], zFrom: 3.333, percentileFrom: 0.99957 },
];

// ---------------------------------------------------------------------------
// Cold-start priors
// ---------------------------------------------------------------------------

/** Self-declared training history, collected at onboarding. */
export type Experience = 'never' | 'under_3m' | '3_12m' | '1_2y' | '2_5y' | '5y_plus';

/** A normal prior on a lifter's latent strength in z units. */
export interface StrengthPrior {
  /** Prior mean z. */
  readonly mu: number;
  /** Prior SD in z units. */
  readonly sigma: number;
}

/**
 * Prior on overall strength by self-declared experience. Used so that a brand-new user
 * with one logged set is shrunk toward a believable level instead of being crowned
 * Elite off a single number.
 */
export const EXPERIENCE_PRIOR: Readonly<Record<Experience, StrengthPrior>> = {
  never: { mu: -1.9, sigma: 0.7 },
  under_3m: { mu: -1.5, sigma: 0.75 },
  '3_12m': { mu: -1.0, sigma: 0.85 },
  '1_2y': { mu: -0.4, sigma: 0.95 },
  '2_5y': { mu: 0.1, sigma: 1.0 },
  '5y_plus': { mu: 0.5, sigma: 1.1 },
};

/**
 * Prior used when the user declined to state their experience: slightly below the
 * reference median (a new app user is typically weaker than the median logging lifter)
 * and deliberately wide, so real evidence dominates quickly.
 */
export const UNKNOWN_EXPERIENCE_PRIOR: StrengthPrior = { mu: -0.5, sigma: 1.1 };

/**
 * Posterior SD, in z units, below which a hard tier label may be shown. 0.35 z is about
 * 6.3 points — a little over one sub-tier. Above it the UI must show a range and a
 * "calibrating" state instead of a label.
 */
export const LABEL_SD_THRESHOLD = 0.35;
