/**
 * Movement pattern, force and mechanic taxonomies for Stronger 2.0.
 *
 * Source: docs/research/exercise-taxonomy-muscle-equipment-pattern-models-.md,
 * PART C (the 20 movement patterns) and PART D (force, mechanic, limb mode).
 *
 * The 20 patterns are built on the NSCA's 8 foundational patterns (squat, hinge,
 * lunge, push, pull, carry, rotation, gait), with push and pull split by vector
 * and isolation split by joint action. A coaching framework can live with 8; a
 * tracker cannot, because the pattern is what drives the training-split
 * breakdown chart.
 *
 * Pure TypeScript. No platform imports.
 */

import type { Region } from './muscles';

// ─────────────────────────────────────────────────────────────────────────────
// PART C — the 20 movement patterns
// ─────────────────────────────────────────────────────────────────────────────

/** The 20 movement patterns. Source: research PART C. */
export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'gait'
  | 'rotation'
  | 'anti_rotation'
  | 'anti_extension'
  | 'anti_lateral_flexion'
  | 'isolation_flexion'
  | 'isolation_extension'
  | 'isolation_abduction'
  | 'isolation_adduction'
  | 'olympic'
  | 'plyometric'
  | 'isometric_hold';

/**
 * The NSCA's 8 foundational patterns, kept so the split chart can roll our 20
 * up to the framework coaches actually recognise.
 * Source: https://www.nsca.com/education/articles/tsac-report/the-8-main-movement-patterns/
 */
export type NscaPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'rotation'
  | 'gait';

export interface MovementPatternDef {
  readonly id: MovementPattern;
  /** Display label for the split-breakdown chart legend. */
  readonly label: string;
  /** The research's one-line definition, verbatim. */
  readonly definition: string;
  /** The research's canonical examples, verbatim. */
  readonly examples: readonly string[];
  /** Which of the NSCA's 8 this rolls up to. */
  readonly nsca: NscaPattern;
  /** Which body region the split chart files this under by default. */
  readonly region: Region;
  /** `true` when the pattern crosses more than one joint under meaningful load. */
  readonly compoundByDefault: boolean;
}

/**
 * The 20 movement patterns, transcribed from research PART C.
 * `nsca`, `region` and `compoundByDefault` are our rollups of that table.
 */
export const MOVEMENT_PATTERNS: Record<MovementPattern, MovementPatternDef> = {
  horizontal_push: {
    id: 'horizontal_push',
    label: 'Horizontal Push',
    definition: 'Load moves away from torso in the transverse plane',
    examples: ['Bench Press', 'Push Up', 'Chest Press'],
    nsca: 'push',
    region: 'chest',
    compoundByDefault: true,
  },
  vertical_push: {
    id: 'vertical_push',
    label: 'Vertical Push',
    definition: 'Load moves overhead in the frontal/sagittal plane',
    examples: ['Overhead Press', 'Handstand Push Up'],
    nsca: 'push',
    region: 'shoulders',
    compoundByDefault: true,
  },
  horizontal_pull: {
    id: 'horizontal_pull',
    label: 'Horizontal Pull',
    definition: 'Load moves toward torso in the transverse plane',
    examples: ['Barbell Row', 'Seated Cable Row', 'Inverted Row'],
    nsca: 'pull',
    region: 'back',
    compoundByDefault: true,
  },
  vertical_pull: {
    id: 'vertical_pull',
    label: 'Vertical Pull',
    definition: 'Load moves down toward torso from overhead',
    examples: ['Pull Up', 'Lat Pulldown'],
    nsca: 'pull',
    region: 'back',
    compoundByDefault: true,
  },
  squat: {
    id: 'squat',
    label: 'Squat',
    definition: 'Knee-dominant bilateral triple flexion/extension',
    examples: ['Back Squat', 'Leg Press', 'Hack Squat'],
    nsca: 'squat',
    region: 'legs',
    compoundByDefault: true,
  },
  hinge: {
    id: 'hinge',
    label: 'Hinge',
    definition: 'Hip-dominant flexion/extension, minimal knee travel',
    examples: ['Deadlift', 'RDL', 'Good Morning', 'Hip Thrust'],
    nsca: 'hinge',
    region: 'legs',
    compoundByDefault: true,
  },
  lunge: {
    id: 'lunge',
    label: 'Lunge',
    definition: 'Split-stance knee-dominant, unilateral',
    examples: ['Bulgarian Split Squat', 'Walking Lunge', 'Step Up'],
    nsca: 'lunge',
    region: 'legs',
    compoundByDefault: true,
  },
  carry: {
    id: 'carry',
    label: 'Carry',
    definition: 'Loaded gait under static hold',
    examples: ["Farmer's Walk", 'Suitcase Carry', 'Yoke Walk'],
    nsca: 'carry',
    region: 'full_body',
    compoundByDefault: true,
  },
  gait: {
    id: 'gait',
    label: 'Gait',
    definition: 'Locomotion for conditioning',
    examples: ['Run', 'Row', 'Ski Erg'],
    nsca: 'gait',
    region: 'cardio',
    compoundByDefault: true,
  },
  rotation: {
    id: 'rotation',
    label: 'Rotation',
    definition: 'Trunk rotation under load',
    examples: ['Cable Woodchop', 'Russian Twist', 'Landmine 180'],
    nsca: 'rotation',
    region: 'core',
    compoundByDefault: false,
  },
  anti_rotation: {
    id: 'anti_rotation',
    label: 'Anti-Rotation',
    definition: 'Resisting trunk rotation',
    examples: ['Pallof Press', 'Renegade Row'],
    nsca: 'rotation',
    region: 'core',
    compoundByDefault: false,
  },
  anti_extension: {
    id: 'anti_extension',
    label: 'Anti-Extension',
    definition: 'Resisting lumbar extension',
    examples: ['Plank', 'Ab Wheel', 'Dead Bug'],
    nsca: 'rotation',
    region: 'core',
    compoundByDefault: false,
  },
  anti_lateral_flexion: {
    id: 'anti_lateral_flexion',
    label: 'Anti-Lateral Flexion',
    definition: 'Resisting lateral trunk flexion',
    examples: ['Side Plank', 'Suitcase Carry', 'Copenhagen Plank'],
    nsca: 'carry',
    region: 'core',
    compoundByDefault: false,
  },
  isolation_flexion: {
    id: 'isolation_flexion',
    label: 'Flexion',
    definition: 'Single-joint flexion',
    examples: ['Biceps Curl', 'Leg Curl', 'Crunch'],
    nsca: 'pull',
    region: 'arms',
    compoundByDefault: false,
  },
  isolation_extension: {
    id: 'isolation_extension',
    label: 'Extension',
    definition: 'Single-joint extension',
    examples: ['Triceps Pushdown', 'Leg Extension', 'Back Extension'],
    nsca: 'push',
    region: 'arms',
    compoundByDefault: false,
  },
  isolation_abduction: {
    id: 'isolation_abduction',
    label: 'Abduction',
    definition: 'Limb away from midline',
    examples: ['Lateral Raise', 'Hip Abduction', 'Reverse Fly'],
    nsca: 'pull',
    region: 'shoulders',
    compoundByDefault: false,
  },
  isolation_adduction: {
    id: 'isolation_adduction',
    label: 'Adduction',
    definition: 'Limb toward midline',
    examples: ['Cable Crossover', 'Pec Deck', 'Hip Adduction'],
    nsca: 'push',
    region: 'chest',
    compoundByDefault: false,
  },
  olympic: {
    id: 'olympic',
    label: 'Olympic',
    definition: 'Triple-extension explosive full-body',
    examples: ['Clean', 'Snatch', 'Jerk', 'Thruster'],
    nsca: 'hinge',
    region: 'full_body',
    compoundByDefault: true,
  },
  plyometric: {
    id: 'plyometric',
    label: 'Plyometric',
    definition: 'Stretch-shortening, ballistic',
    examples: ['Box Jump', 'Depth Jump', 'Clap Push Up'],
    nsca: 'squat',
    region: 'full_body',
    compoundByDefault: true,
  },
  isometric_hold: {
    id: 'isometric_hold',
    label: 'Isometric Hold',
    definition: 'Static loaded position',
    examples: ['Wall Sit', 'Dead Hang', 'Isometric Bench Hold'],
    nsca: 'carry',
    region: 'full_body',
    compoundByDefault: false,
  },
};

/** All 20 pattern ids, in declaration order. */
export const MOVEMENT_PATTERN_IDS = Object.keys(MOVEMENT_PATTERNS) as MovementPattern[];

// ─────────────────────────────────────────────────────────────────────────────
// PART D — force, mechanic, limb mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Direction of applied force.
 *
 * free-exercise-db ships only push | pull | static. `carry` is added because
 * loaded gait is neither and the analytics split chart needs it to exist.
 * Source: research PART D, D1.
 */
export type ForceType = 'push' | 'pull' | 'static' | 'carry';

/** All 4 force types. */
export const FORCE_TYPES: readonly ForceType[] = ['push', 'pull', 'static', 'carry'] as const;

/** Display labels for the force types. */
export const FORCE_TYPE_LABELS: Record<ForceType, string> = {
  push: 'Push',
  pull: 'Pull',
  static: 'Static',
  carry: 'Carry',
};

/**
 * Joint involvement.
 *
 * Rule: compound = more than one joint crosses meaningful load. Measured on
 * free-exercise-db's 876 records the split is 491 compound / 298 isolation /
 * 87 null; a curated catalog should land near 58/42.
 * Source: research PART D, D2.
 */
export type Mechanic = 'compound' | 'isolation';

/** Both mechanic values. */
export const MECHANICS: readonly Mechanic[] = ['compound', 'isolation'] as const;

/**
 * How the limbs work.
 *
 * This matters because entered-weight semantics differ: a Single Arm Dumbbell
 * Row at 40 kg is 40 kg of volume per rep, NOT 80. Get this wrong and every
 * unilateral PR is double-counted.
 * Source: research PART D, D3.
 */
export type LimbMode = 'bilateral' | 'unilateral_alternating' | 'unilateral_sequential';

/** All 3 limb modes. */
export const LIMB_MODES: readonly LimbMode[] = [
  'bilateral',
  'unilateral_alternating',
  'unilateral_sequential',
] as const;

/** Display labels for the limb modes. */
export const LIMB_MODE_LABELS: Record<LimbMode, string> = {
  bilateral: 'Both Limbs',
  unilateral_alternating: 'Alternating',
  unilateral_sequential: 'One Side At A Time',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the definition of one of the 20 movement patterns. */
export function getPattern(id: MovementPattern): MovementPatternDef {
  return MOVEMENT_PATTERNS[id];
}

/** Rolls one of our 20 patterns up to the NSCA's 8. */
export function toNscaPattern(id: MovementPattern): NscaPattern {
  return MOVEMENT_PATTERNS[id].nsca;
}

/** `true` for the four core patterns the research isolates for trunk work. */
export function isCorePattern(id: MovementPattern): boolean {
  return (
    id === 'rotation' ||
    id === 'anti_rotation' ||
    id === 'anti_extension' ||
    id === 'anti_lateral_flexion'
  );
}

/** `true` for the four single-joint isolation patterns. */
export function isIsolationPattern(id: MovementPattern): boolean {
  return (
    id === 'isolation_flexion' ||
    id === 'isolation_extension' ||
    id === 'isolation_abduction' ||
    id === 'isolation_adduction'
  );
}

/** `true` when the pattern is unilateral by its own definition (lunge). */
export function isUnilateralByDefinition(id: MovementPattern): boolean {
  return id === 'lunge';
}

/**
 * Whether `limbMode` means the weight the user types applies to one limb only.
 *
 * Both unilateral modes do. This is the guard against double-counting a
 * single-arm PR, and it is deliberately a function of limb mode alone so no
 * exercise row can accidentally opt out of it.
 * Source: research PART D, D3.
 */
export function weightIsPerLimb(limbMode: LimbMode): boolean {
  return limbMode !== 'bilateral';
}
