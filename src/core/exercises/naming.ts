/**
 * Canonical naming, slugging, alias generation and near-duplicate scoring.
 *
 * Source: docs/research/exercise-taxonomy-muscle-equipment-pattern-models-.md,
 * PART F (the generator, orthography rules, alias rules) and PART G (slug
 * strategy, uniqueness tuple, import-time near-duplicate scoring).
 *
 * The central idea: a display name is COMPUTED from components and never typed.
 * That is what makes "Barbell Bench Press" and "Bench Press (Barbell)" unable to
 * both exist — they resolve to the same (movement, equipment, loadMode,
 * variantSignature) tuple and the same generated string.
 *
 * Pure TypeScript. No platform imports.
 */

import { EQUIPMENT, type EquipmentClass, type EquipmentId, CABLE_ATTACHMENT_LABELS } from './equipment';
import type { GroupWeights } from './muscles';
import { MUSCLE_GROUP_IDS } from './muscles';
import type { ExerciseComponents, LoadMode, MovementId, VariantKey } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Movement registry
// ─────────────────────────────────────────────────────────────────────────────

export interface MovementDef {
  readonly id: MovementId;
  /** Base noun phrase, e.g. "Bench Press". Singular, Title Case, no hyphens. */
  readonly label: string;
  /**
   * Equipment for which the parenthesised suffix is OMITTED because the
   * equipment is definitional: Pull Up, Push Up, Dip, Plank, Clean, Snatch,
   * Kettlebell Swing. Source: research PART F, F3.
   */
  readonly definitionalEquipment: readonly EquipmentId[];
  /**
   * `true` for the pushdown / row / curl families, where the research allows a
   * cable attachment as a second parenthesised token
   * ("Triceps Pushdown (Cable, Rope)"). Source: research PART F, F2.
   */
  readonly allowsAttachmentInName: boolean;
}

const mv = (
  id: string,
  label: string,
  definitionalEquipment: readonly EquipmentId[] = [],
  allowsAttachmentInName = false,
): MovementDef => ({ id, label, definitionalEquipment, allowsAttachmentInName });

/**
 * The movement families the Tier-0 catalog is built from. A movement is the
 * unit a demo animation belongs to; equipment, grip and stance variants of one
 * movement share that animation.
 */
export const MOVEMENTS = {
  // chest
  bench_press: mv('bench_press', 'Bench Press'),
  chest_press: mv('chest_press', 'Chest Press'),
  chest_fly: mv('chest_fly', 'Chest Fly'),
  chest_dip: mv('chest_dip', 'Chest Dip', ['bodyweight', 'dip_bars', 'assisted_machine']),
  push_up: mv('push_up', 'Push Up', ['bodyweight']),
  pec_deck: mv('pec_deck', 'Pec Deck', ['machine_selectorized']),
  cable_crossover: mv('cable_crossover', 'Cable Crossover', ['cable', 'functional_trainer']),
  landmine_press: mv('landmine_press', 'Landmine Press', ['landmine']),
  bench_dip: mv('bench_dip', 'Bench Dip', ['bench', 'bodyweight']),
  handstand_push_up: mv('handstand_push_up', 'Handstand Push Up', ['bodyweight']),
  // back
  pull_up: mv('pull_up', 'Pull Up', ['bodyweight', 'pull_up_bar', 'assisted_machine']),
  chin_up: mv('chin_up', 'Chin Up', ['bodyweight', 'pull_up_bar', 'assisted_machine']),
  stiff_leg_deadlift: mv('stiff_leg_deadlift', 'Stiff Leg Deadlift'),
  rack_pull: mv('rack_pull', 'Rack Pull'),
  pullover: mv('pullover', 'Pullover'),
  pendlay_row: mv('pendlay_row', 'Pendlay Row', ['barbell']),
  seal_row: mv('seal_row', 'Seal Row'),
  inverted_row: mv('inverted_row', 'Inverted Row', ['bodyweight']),
  meadows_row: mv('meadows_row', 'Meadows Row', ['landmine']),
  renegade_row: mv('renegade_row', 'Renegade Row', ['dumbbell']),
  lat_pulldown: mv('lat_pulldown', 'Lat Pulldown', [], true),
  bent_over_row: mv('bent_over_row', 'Bent Over Row', [], true),
  seated_row: mv('seated_row', 'Seated Row', [], true),
  t_bar_row: mv('t_bar_row', 'T Bar Row', ['landmine', 'machine_plate_loaded']),
  straight_arm_pulldown: mv('straight_arm_pulldown', 'Straight Arm Pulldown', [], true),
  face_pull: mv('face_pull', 'Face Pull', [], true),
  shrug: mv('shrug', 'Shrug'),
  // shoulders
  overhead_press: mv('overhead_press', 'Overhead Press'),
  arnold_press: mv('arnold_press', 'Arnold Press', ['dumbbell']),
  lateral_raise: mv('lateral_raise', 'Lateral Raise'),
  front_raise: mv('front_raise', 'Front Raise'),
  reverse_fly: mv('reverse_fly', 'Reverse Fly'),
  upright_row: mv('upright_row', 'Upright Row'),
  push_press: mv('push_press', 'Push Press'),
  push_jerk: mv('push_jerk', 'Push Jerk', ['barbell']),
  high_pull: mv('high_pull', 'High Pull'),
  // arms
  biceps_curl: mv('biceps_curl', 'Biceps Curl', [], true),
  hammer_curl: mv('hammer_curl', 'Hammer Curl', [], true),
  preacher_curl: mv('preacher_curl', 'Preacher Curl'),
  triceps_pushdown: mv('triceps_pushdown', 'Triceps Pushdown', [], true),
  overhead_triceps_extension: mv(
    'overhead_triceps_extension',
    'Overhead Triceps Extension',
    [],
    true,
  ),
  skullcrusher: mv('skullcrusher', 'Skullcrusher'),
  triceps_dip: mv('triceps_dip', 'Triceps Dip', ['bodyweight', 'dip_bars', 'assisted_machine']),
  concentration_curl: mv('concentration_curl', 'Concentration Curl'),
  spider_curl: mv('spider_curl', 'Spider Curl'),
  drag_curl: mv('drag_curl', 'Drag Curl'),
  reverse_curl: mv('reverse_curl', 'Reverse Curl'),
  wrist_roller: mv('wrist_roller', 'Wrist Roller', ['wrist_roller']),
  plate_pinch: mv('plate_pinch', 'Plate Pinch', ['weight_plate']),
  triceps_kickback: mv('triceps_kickback', 'Triceps Kickback'),
  wrist_curl: mv('wrist_curl', 'Wrist Curl'),
  reverse_wrist_curl: mv('reverse_wrist_curl', 'Reverse Wrist Curl'),
  dead_hang: mv('dead_hang', 'Dead Hang', ['bodyweight', 'pull_up_bar']),
  // legs
  back_squat: mv('back_squat', 'Back Squat'),
  front_squat: mv('front_squat', 'Front Squat'),
  goblet_squat: mv('goblet_squat', 'Goblet Squat'),
  high_bar_squat: mv('high_bar_squat', 'High Bar Squat'),
  low_bar_squat: mv('low_bar_squat', 'Low Bar Squat'),
  box_squat: mv('box_squat', 'Box Squat'),
  split_squat: mv('split_squat', 'Split Squat'),
  sissy_squat: mv('sissy_squat', 'Sissy Squat', ['bodyweight']),
  pistol_squat: mv('pistol_squat', 'Pistol Squat', ['bodyweight']),
  overhead_squat: mv('overhead_squat', 'Overhead Squat', ['barbell']),
  belt_squat: mv('belt_squat', 'Belt Squat', ['belt_squat']),
  pendulum_squat: mv('pendulum_squat', 'Pendulum Squat', ['pendulum_squat']),
  lateral_lunge: mv('lateral_lunge', 'Lateral Lunge'),
  curtsy_lunge: mv('curtsy_lunge', 'Curtsy Lunge'),
  glute_ham_raise: mv('glute_ham_raise', 'Glute Ham Raise', ['ghd']),
  jump_squat: mv('jump_squat', 'Jump Squat', ['bodyweight']),
  hack_squat: mv('hack_squat', 'Hack Squat', ['hack_squat_machine']),
  leg_press: mv('leg_press', 'Leg Press', ['leg_press_machine']),
  bulgarian_split_squat: mv('bulgarian_split_squat', 'Bulgarian Split Squat'),
  walking_lunge: mv('walking_lunge', 'Walking Lunge'),
  reverse_lunge: mv('reverse_lunge', 'Reverse Lunge'),
  step_up: mv('step_up', 'Step Up'),
  leg_extension: mv('leg_extension', 'Leg Extension', ['machine_selectorized']),
  deadlift: mv('deadlift', 'Deadlift'),
  romanian_deadlift: mv('romanian_deadlift', 'Romanian Deadlift'),
  leg_curl: mv('leg_curl', 'Leg Curl'),
  nordic_curl: mv('nordic_curl', 'Nordic Curl', ['bodyweight', 'ghd']),
  good_morning: mv('good_morning', 'Good Morning'),
  hip_thrust: mv('hip_thrust', 'Hip Thrust'),
  glute_bridge: mv('glute_bridge', 'Glute Bridge'),
  glute_kickback: mv('glute_kickback', 'Glute Kickback', [], true),
  pull_through: mv('pull_through', 'Pull Through', [], true),
  reverse_hyperextension: mv('reverse_hyperextension', 'Reverse Hyperextension', ['reverse_hyper']),
  hip_abduction: mv('hip_abduction', 'Hip Abduction'),
  hip_adduction: mv('hip_adduction', 'Hip Adduction'),
  calf_raise: mv('calf_raise', 'Calf Raise'),
  back_extension: mv('back_extension', 'Back Extension', ['back_extension_bench']),
  // core
  plank: mv('plank', 'Plank', ['bodyweight']),
  side_plank: mv('side_plank', 'Side Plank', ['bodyweight']),
  crunch: mv('crunch', 'Crunch'),
  sit_up: mv('sit_up', 'Sit Up', ['bodyweight']),
  reverse_crunch: mv('reverse_crunch', 'Reverse Crunch', ['bodyweight']),
  bicycle_crunch: mv('bicycle_crunch', 'Bicycle Crunch', ['bodyweight']),
  dead_bug: mv('dead_bug', 'Dead Bug', ['bodyweight']),
  hollow_hold: mv('hollow_hold', 'Hollow Hold', ['bodyweight']),
  mountain_climber: mv('mountain_climber', 'Mountain Climber', ['bodyweight']),
  toes_to_bar: mv('toes_to_bar', 'Toes to Bar', ['bodyweight', 'pull_up_bar']),
  l_sit: mv('l_sit', 'L Sit', ['bodyweight', 'parallettes']),
  hanging_leg_raise: mv('hanging_leg_raise', 'Hanging Leg Raise', ['bodyweight', 'pull_up_bar']),
  hanging_knee_raise: mv('hanging_knee_raise', 'Hanging Knee Raise', ['bodyweight', 'pull_up_bar']),
  ab_wheel_rollout: mv('ab_wheel_rollout', 'Ab Wheel Rollout', ['ab_wheel']),
  russian_twist: mv('russian_twist', 'Russian Twist'),
  pallof_press: mv('pallof_press', 'Pallof Press', [], true),
  woodchop: mv('woodchop', 'Woodchop', [], true),
  // carry, olympic, conditioning
  farmers_walk: mv('farmers_walk', "Farmer's Walk"),
  suitcase_carry: mv('suitcase_carry', 'Suitcase Carry'),
  clean: mv('clean', 'Clean', ['barbell']),
  power_clean: mv('power_clean', 'Power Clean', ['barbell']),
  snatch: mv('snatch', 'Snatch', ['barbell']),
  clean_and_jerk: mv('clean_and_jerk', 'Clean and Jerk', ['barbell']),
  hang_clean: mv('hang_clean', 'Hang Clean', ['barbell']),
  power_snatch: mv('power_snatch', 'Power Snatch', ['barbell']),
  hang_snatch: mv('hang_snatch', 'Hang Snatch', ['barbell']),
  thruster: mv('thruster', 'Thruster'),
  kettlebell_swing: mv('kettlebell_swing', 'Kettlebell Swing', ['kettlebell']),
  turkish_get_up: mv('turkish_get_up', 'Turkish Get Up'),
  burpee: mv('burpee', 'Burpee', ['bodyweight']),
  box_jump: mv('box_jump', 'Box Jump', ['plyo_box']),
  sled_push: mv('sled_push', 'Sled Push', ['sled']),
  sled_drag: mv('sled_drag', 'Sled Drag', ['sled']),
  yoke_walk: mv('yoke_walk', 'Yoke Walk', ['yoke']),
  bear_hug_carry: mv('bear_hug_carry', 'Bear Hug Carry'),
  battle_rope_wave: mv('battle_rope_wave', 'Battle Rope Wave', ['battle_ropes']),
  wall_ball: mv('wall_ball', 'Wall Ball', ['medicine_ball']),
  tire_flip: mv('tire_flip', 'Tire Flip', ['tire']),
  // `row` is the ergometer; the strength rows are `bent_over_row` / `seated_row`.
  // The equipment suffix is NOT dropped here, because a bare "Row" next to
  // "Bent Over Row" in a search list is indistinguishable to the reader.
  run: mv('run', 'Run', ['treadmill']),
  walk: mv('walk', 'Walk', ['treadmill']),
  row: mv('row', 'Row'),
  air_bike: mv('air_bike', 'Air Bike', ['air_bike']),
  cycle: mv('cycle', 'Cycle', ['stationary_bike']),
  elliptical_stride: mv('elliptical_stride', 'Elliptical', ['elliptical']),
  stair_climb: mv('stair_climb', 'Stair Climber', ['stair_climber']),
  ski_erg_pull: mv('ski_erg_pull', 'Ski Erg', ['ski_erg']),
  jump_rope: mv('jump_rope', 'Jump Rope', ['jump_rope']),
  neck_curl: mv('neck_curl', 'Neck Curl'),
  neck_extension: mv('neck_extension', 'Neck Extension'),
} as const satisfies Record<string, MovementDef>;

/** A known movement family id. */
export type KnownMovementId = keyof typeof MOVEMENTS;

/** All movement family ids. */
export const MOVEMENT_IDS = Object.keys(MOVEMENTS) as KnownMovementId[];

/** Returns a movement definition, or `null` for an unknown id. */
export function getMovement(id: MovementId): MovementDef | null {
  return Object.prototype.hasOwnProperty.call(MOVEMENTS, id)
    ? MOVEMENTS[id as KnownMovementId]
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant slots and labels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The FIXED modifier order. Any other order is a bug, and the test suite
 * asserts generated names follow it.
 * Source: research PART F, F1: Limb > Position > Angle > Stance > Grip > ROM.
 */
export type VariantSlot = 'limb' | 'position' | 'angle' | 'stance' | 'grip' | 'rom';

/** The six modifier slots in the order they appear before the base noun. */
export const VARIANT_SLOT_ORDER: readonly VariantSlot[] = [
  'limb',
  'position',
  'angle',
  'stance',
  'grip',
  'rom',
] as const;

interface VariantDef {
  readonly slot: VariantSlot;
  /** Display word(s). `null` means the variant is implied and never printed. */
  readonly label: string | null;
}

/**
 * Display label and slot for every variant key.
 *
 * `flat` and `conventional` have a `null` label: they are the implicit default
 * and printing them would produce "Flat Bench Press (Barbell)", which the
 * research explicitly omits.
 */
export const VARIANT_DEFS: Record<VariantKey, VariantDef> = {
  // limb
  single_arm: { slot: 'limb', label: 'Single Arm' },
  single_leg: { slot: 'limb', label: 'Single Leg' },
  alternating: { slot: 'limb', label: 'Alternating' },
  // position
  seated: { slot: 'position', label: 'Seated' },
  standing: { slot: 'position', label: 'Standing' },
  lying: { slot: 'position', label: 'Lying' },
  prone: { slot: 'position', label: 'Prone' },
  kneeling: { slot: 'position', label: 'Kneeling' },
  bent_over: { slot: 'position', label: 'Bent Over' },
  chest_supported: { slot: 'position', label: 'Chest Supported' },
  overhead: { slot: 'position', label: 'Overhead' },
  // angle
  incline: { slot: 'angle', label: 'Incline' },
  decline: { slot: 'angle', label: 'Decline' },
  flat: { slot: 'angle', label: null },
  // stance
  sumo: { slot: 'stance', label: 'Sumo' },
  conventional: { slot: 'stance', label: null },
  wide_stance: { slot: 'stance', label: 'Wide Stance' },
  narrow_stance: { slot: 'stance', label: 'Narrow Stance' },
  staggered: { slot: 'stance', label: 'Staggered' },
  b_stance: { slot: 'stance', label: 'B Stance' },
  split: { slot: 'stance', label: 'Split' },
  deficit: { slot: 'stance', label: 'Deficit' },
  elevated_heels: { slot: 'stance', label: 'Heels Elevated' },
  // grip
  close_grip: { slot: 'grip', label: 'Close Grip' },
  wide_grip: { slot: 'grip', label: 'Wide Grip' },
  neutral_grip: { slot: 'grip', label: 'Neutral Grip' },
  reverse_grip: { slot: 'grip', label: 'Reverse Grip' },
  supinated: { slot: 'grip', label: 'Supinated' },
  pronated: { slot: 'grip', label: 'Pronated' },
  mixed_grip: { slot: 'grip', label: 'Mixed Grip' },
  false_grip: { slot: 'grip', label: 'False Grip' },
  behind_the_neck: { slot: 'grip', label: 'Behind The Neck' },
  // rom
  paused: { slot: 'rom', label: 'Paused' },
  pin: { slot: 'rom', label: 'Pin' },
  board: { slot: 'rom', label: 'Board' },
  floor: { slot: 'rom', label: 'Floor' },
  partial: { slot: 'rom', label: 'Partial' },
  lengthened_partial: { slot: 'rom', label: 'Lengthened Partial' },
  one_and_a_half: { slot: 'rom', label: 'One and a Half' },
};

/** Load-mode token printed inside the parentheses. */
const LOAD_MODE_LABELS: Record<LoadMode, string | null> = {
  none: null,
  weighted: 'Weighted',
  assisted: 'Assisted',
  banded: 'Banded',
};

/**
 * Maximum characters in a canonical name before the active-workout row
 * truncates. Source: research PART F, F3.
 */
export const MAX_NAME_LENGTH = 42;

// ─────────────────────────────────────────────────────────────────────────────
// The generator
// ─────────────────────────────────────────────────────────────────────────────

/** A generated display name, plus any overflow pushed out of it. */
export interface GeneratedName {
  /** The display name. */
  readonly name: string;
  /**
   * ROM modifier that was dropped to keep `name` within 42 characters, or
   * `null` when nothing had to be dropped.
   */
  readonly subtitle: string | null;
  /** `true` when even after dropping the ROM modifier the name exceeds 42. */
  readonly overflows: boolean;
}

/** Picks the variant occupying a slot, or `null`. Returns the first match. */
function variantInSlot(
  variants: readonly VariantKey[],
  slot: VariantSlot,
): VariantKey | null {
  for (const key of variants) {
    if (VARIANT_DEFS[key].slot === slot) return key;
  }
  return null;
}

function slotLabels(
  variants: readonly VariantKey[],
  slots: readonly VariantSlot[],
): string[] {
  const out: string[] = [];
  for (const slot of slots) {
    const key = variantInSlot(variants, slot);
    if (key === null) continue;
    const label = VARIANT_DEFS[key].label;
    if (label !== null) out.push(label);
  }
  return out;
}

function buildName(components: ExerciseComponents, slots: readonly VariantSlot[]): string {
  const movement = getMovement(components.movementId);
  const base = movement === null ? components.movementId : movement.label;
  const head = [...slotLabels(components.variants, slots), base].join(' ');

  const parens: string[] = [];
  const load = LOAD_MODE_LABELS[components.loadMode];
  if (load !== null) parens.push(load);

  const definitional =
    movement !== null && movement.definitionalEquipment.includes(components.equipmentId);
  if (!definitional) parens.push(EQUIPMENT[components.equipmentId].label);

  if (
    components.attachment !== undefined &&
    movement !== null &&
    movement.allowsAttachmentInName
  ) {
    parens.push(CABLE_ATTACHMENT_LABELS[components.attachment]);
  }

  return parens.length > 0 ? `${head} (${parens.join(', ')})` : head;
}

/**
 * Generates the canonical display name from an exercise's components.
 *
 * Modifier order is fixed: Limb > Position > Angle > Stance > Grip > ROM > Base,
 * followed by "(Load, Equipment, Attachment)". The equipment suffix is omitted
 * when the equipment is definitional for that movement (Pull Up, Push Up, Dip,
 * Plank, Clean, Snatch, Kettlebell Swing) and REQUIRED otherwise.
 *
 * When the result exceeds 42 characters the ROM modifier is moved into
 * `subtitle` rather than truncating the row.
 *
 * Source: research PART F, F1 and F3.
 *
 * @param components - movement, equipment, load mode, variants, attachment
 * @returns the display name, an optional subtitle, and whether it still overflows
 */
export function canonicalName(components: ExerciseComponents): GeneratedName {
  const full = buildName(components, VARIANT_SLOT_ORDER);
  if (full.length <= MAX_NAME_LENGTH) {
    return { name: full, subtitle: null, overflows: false };
  }

  const romKey = variantInSlot(components.variants, 'rom');
  if (romKey !== null && VARIANT_DEFS[romKey].label !== null) {
    const withoutRom = buildName(
      components,
      VARIANT_SLOT_ORDER.filter((s) => s !== 'rom'),
    );
    return {
      name: withoutRom,
      subtitle: VARIANT_DEFS[romKey].label,
      overflows: withoutRom.length > MAX_NAME_LENGTH,
    };
  }
  return { name: full, subtitle: null, overflows: true };
}

/**
 * The sorted, `|`-joined variant signature. Half of the database uniqueness
 * tuple (movement, equipment, loadMode, variantSignature), and the reason two
 * differently-ordered variant arrays cannot produce two rows.
 * Source: research PART G, G2.
 */
export function variantSignature(variants: readonly VariantKey[]): string {
  return [...new Set(variants)].sort().join('|');
}

/**
 * Derives the deterministic, unique, human-readable slug from components.
 *
 * Shape: `[limb-position-angle-stance-grip-rom-]movement--equipment[--loadMode]`
 *
 * Built from IDS, not from the display name, so renaming "Chest Fly" to
 * "Pec Fly" in the UI changes zero slugs and zero history.
 * Source: research PART G, G1.
 *
 * @returns e.g. `close-grip-bench-press--barbell`, `pull-up--bodyweight--weighted`
 */
export function deriveSlug(components: ExerciseComponents): string {
  const mods: string[] = [];
  for (const slot of VARIANT_SLOT_ORDER) {
    const key = variantInSlot(components.variants, slot);
    if (key === null) continue;
    if (VARIANT_DEFS[key].label === null) continue;
    mods.push(key.replace(/_/gu, '-'));
  }
  const head = [...mods, components.movementId.replace(/_/gu, '-')].join('-');
  const parts = [head, components.equipmentId];
  if (components.loadMode !== 'none') parts.push(components.loadMode);
  return parts.join('--');
}

// ─────────────────────────────────────────────────────────────────────────────
// Orthography lint
// ─────────────────────────────────────────────────────────────────────────────

/** Words that must never appear in a canonical name. Source: research PART F, F3. */
const FORBIDDEN_NAME_TOKENS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpull-?up\b/iu, 'write "Pull Up" as two words with no hyphen'],
  [/\bpush-?up\b/iu, 'write "Push Up" as two words with no hyphen'],
  [/\bchin-?up\b/iu, 'write "Chin Up" as two words with no hyphen'],
  [/\bsit-?up\b/iu, 'write "Sit Up" as two words with no hyphen'],
  [/\bstep-?up\b/iu, 'write "Step Up" as two words with no hyphen'],
  [/\btricep\b/iu, '"Triceps" always takes the s'],
  [/\bbicep\b/iu, '"Biceps" always takes the s'],
  [/\b(bb|db|kb|ohp|rdl|sldl|bss|ghr|hspu)\b/iu, 'no abbreviations in canonical names'],
  [/\b(close|wide|neutral|reverse|mixed|false)-grip\b/iu, 'no hyphen in grip modifiers'],
  [/\b(bent|chest)-(over|supported)\b/iu, 'no hyphen in position modifiers'],
  [/\b(curls|raises|presses|rows|extensions|flys|flies|squats|deadlifts)\b/iu,
    'base nouns are singular'],
];

/**
 * Lints a generated name against the orthography rules in research PART F, F3.
 * Returns a list of violations; an empty list means the name is canonical.
 *
 * The two-word forms are checked positively (`Pull Up`, not `Pull-Up`) because
 * the research calls out Hevy's own inconsistency — they ship "Handstand Push
 * Up", "One-Arm Push-Up" and "Sternum Pull up" in one library.
 */
export function lintCanonicalName(name: string): string[] {
  const problems: string[] = [];
  for (const entry of FORBIDDEN_NAME_TOKENS) {
    const [pattern, message] = entry;
    // Each pattern is written so the CORRECT spelling cannot match it: the
    // `-?` in /\bpull-?up\b/ matches a hyphen or nothing, never a space, so
    // "Pull Up" passes while "Pull-Up" and "Pullup" are flagged.
    if (pattern.test(name)) problems.push(`${message} (in "${name}")`);
  }
  if (name.length > MAX_NAME_LENGTH) {
    problems.push(`name exceeds ${MAX_NAME_LENGTH} characters (in "${name}")`);
  }
  return problems;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abbreviation expansions applied in reverse at normalisation time, so a user
 * who types "bb bp" and the catalog's "Bench Press (Barbell)" collapse to the
 * same key. Source: research PART F, F4 rule 3.
 */
export const ABBREVIATION_EXPANSIONS: Record<string, string> = {
  bb: 'barbell',
  db: 'dumbbell',
  kb: 'kettlebell',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  sldl: 'stiff leg deadlift',
  bss: 'bulgarian split squat',
  ghr: 'glute ham raise',
  hspu: 'handstand push up',
  bor: 'bent over row',
  cgbp: 'close grip bench press',
  jm: 'jm press',
  dl: 'deadlift',
  sq: 'squat',
  bp: 'bench press',
  latpd: 'lat pulldown',
  ldl: 'landmine deadlift',
};

/**
 * Phrase-level spelling fixes, applied before tokenisation.
 * Source: research PART F, F4 rule 4.
 */
export const SPELLING_FIXES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\blat pull down\b/gu, 'lat pulldown'],
  [/\bpulldowns?\b/gu, 'pulldown'],
  [/\bpullups?\b/gu, 'pull up'],
  [/\bpushups?\b/gu, 'push up'],
  [/\bchinups?\b/gu, 'chin up'],
  [/\bsitups?\b/gu, 'sit up'],
  [/\bdead lift\b/gu, 'deadlift'],
  [/\bskull ?crushers?\b/gu, 'skullcrusher'],
  [/\blying triceps extension\b/gu, 'skullcrusher'],
  [/\btriceps? ?extension\b/gu, 'triceps extension'],
  [/\btricep\b/gu, 'triceps'],
  [/\bbicep\b/gu, 'biceps'],
  [/\bquad\b/gu, 'quadriceps'],
  [/\bham\b/gu, 'hamstring'],
];

/** Stopwords dropped during normalisation. Source: research PART G, G3. */
const STOPWORDS = new Set(['the', 'a', 'an', 'with', 'on', 'using', 'and', 'of']);

/** Words the naive singulariser must not strip. */
const NEVER_SINGULARISE = new Set([
  'triceps',
  'biceps',
  'quadriceps',
  'forceps',
  'abs',
  'lats',
  'glutes',
  'calves',
  'hamstrings',
  'delts',
  'press',
  'cross',
  'plus',
]);

function singularise(token: string): string {
  if (NEVER_SINGULARISE.has(token)) return token;
  if (token.endsWith('ss')) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('es') && token.length > 3) {
    const stem = token.slice(0, -2);
    if (stem.endsWith('s') || stem.endsWith('x') || stem.endsWith('ch') || stem.endsWith('sh')) {
      return stem;
    }
  }
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

/**
 * Normalises a name to a deterministic comparison key.
 *
 * Steps, in order (research PART G, G3): lowercase, strip diacritics, apply the
 * spelling fixes, strip punctuation and parentheses, tokenise, expand
 * abbreviations, drop stopwords, singularise.
 *
 * Tokens are NOT sorted here — `normalizedKey` sorts them, `tokenSetRatio`
 * needs them unsorted.
 *
 * @param name - any human or upstream spelling
 * @returns lowercase, space-joined normalised tokens
 */
export function normalizeName(name: string): string {
  let s = name.normalize('NFKD').replace(/[̀-ͯ]/gu, '').toLowerCase();
  for (const entry of SPELLING_FIXES) {
    const [pattern, replacement] = entry;
    s = s.replace(pattern, replacement);
  }
  s = s.replace(/[^a-z0-9\s]/gu, ' ');

  const out: string[] = [];
  for (const raw of s.split(/\s+/u)) {
    if (raw === '') continue;
    const expanded = ABBREVIATION_EXPANSIONS[raw];
    const pieces = expanded === undefined ? [raw] : expanded.split(' ');
    for (const piece of pieces) {
      if (STOPWORDS.has(piece)) continue;
      out.push(singularise(piece));
    }
  }
  return out.join(' ');
}

/**
 * The cheap search normaliser: lowercase, strip diacritics, drop every
 * character that is not a letter, digit or space, and collapse whitespace.
 *
 * Deliberately dumber than {@link normalizeName}: it does NOT expand
 * abbreviations, drop stopwords or singularise, so it is safe to run on a
 * partially-typed query where "curl" must still prefix-match "curls" and where
 * dropping a token the user is mid-way through typing would make results jump
 * around between keystrokes.
 *
 * @param input - raw user text or a catalog name
 * @returns lowercase, single-spaced, punctuation-free text
 */
export function searchNormalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * The unique search key stored on every exercise: normalised tokens, deduped
 * and sorted, so "Barbell Bench Press" and "Bench Press (Barbell)" produce the
 * identical key.
 */
export function normalizedKey(name: string): string {
  const tokens = normalizeName(name).split(' ').filter((t) => t !== '');
  return [...new Set(tokens)].sort().join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Aliases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the search aliases for a canonical name.
 *
 * Rules 1-4 from research PART F, F4:
 *  1. equipment-first permutation: "Bench Press (Barbell)" -> "Barbell Bench Press"
 *  2. paren-stripped: -> "Bench Press Barbell"
 *  3. abbreviation forms, generated by reversing the expansion map
 *  4. common misspellings, via the spelling-fix map applied in reverse
 *
 * Rule 5 (gym slang and eponyms: Pec Deck, Kroc Row, Meadows Row) and rule 6
 * (non-English) are hand-curated per exercise and passed in as `curated`.
 *
 * @param name - the canonical display name
 * @param curated - hand-authored aliases, slang and translations
 * @returns deduplicated, lowercase aliases, canonical name first
 */
export function generateAliases(name: string, curated: readonly string[] = []): string[] {
  const out = new Set<string>();
  const add = (s: string): void => {
    const trimmed = s.trim().replace(/\s+/gu, ' ');
    if (trimmed !== '') out.add(trimmed.toLowerCase());
  };

  add(name);

  const match = /^(.*?)\s*\(([^)]*)\)\s*$/u.exec(name);
  if (match !== null) {
    const head = match[1] ?? '';
    const inner = match[2] ?? '';
    const tokens = inner.split(',').map((t) => t.trim()).filter((t) => t !== '');
    // rule 1: equipment-first permutation
    add(`${tokens.join(' ')} ${head}`);
    // rule 2: paren-stripped
    add(`${head} ${tokens.join(' ')}`);
    add(head);
  }

  // rule 3: abbreviation forms
  const lower = name.toLowerCase();
  for (const [abbrev, expansion] of Object.entries(ABBREVIATION_EXPANSIONS)) {
    if (lower.includes(expansion)) {
      add(lower.replace(expansion, abbrev));
    }
  }

  // rule 4: the misspellings people actually type
  add(lower.replace(/triceps/gu, 'tricep'));
  add(lower.replace(/biceps/gu, 'bicep'));
  add(lower.replace(/pull up/gu, 'pullup'));
  add(lower.replace(/push up/gu, 'pushup'));
  add(lower.replace(/chin up/gu, 'chinup'));
  add(lower.replace(/pulldown/gu, 'pull down'));

  for (const c of curated) add(c);

  return [...out];
}

// ─────────────────────────────────────────────────────────────────────────────
// Near-duplicate scoring
// ─────────────────────────────────────────────────────────────────────────────

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr: number[] = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length] ?? 0;
}

/**
 * Normalised string similarity, 0..1. `1` is identical, `0` shares nothing.
 *
 * The research names "token_set_ratio" as the metric but does not pin the
 * underlying edit kernel; this uses Levenshtein similarity
 * (1 - distance / longest), which is dependency-free and monotone in the same
 * direction as the difflib ratio the name alludes to.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === '' && b === '') return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Token-set ratio between two names, 0..1.
 *
 * Both names are normalised, split into token sets, and compared three ways:
 * the shared tokens alone against each side's shared-plus-remainder string, and
 * the two remainder strings against each other. The maximum wins, which is what
 * makes "Bench Press (Barbell)" and "Barbell Bench Press - Medium Grip" score
 * high despite the extra tokens.
 *
 * Source: research PART G, G3.
 */
export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(' ').filter((t) => t !== ''));
  const tb = new Set(normalizeName(b).split(' ').filter((t) => t !== ''));

  const shared = [...ta].filter((t) => tb.has(t)).sort();
  const onlyA = [...ta].filter((t) => !tb.has(t)).sort();
  const onlyB = [...tb].filter((t) => !ta.has(t)).sort();

  const s0 = shared.join(' ');
  const s1 = [...shared, ...onlyA].join(' ');
  const s2 = [...shared, ...onlyB].join(' ');

  return Math.max(stringSimilarity(s0, s1), stringSimilarity(s0, s2), stringSimilarity(s1, s2));
}

/**
 * Cosine similarity between two group-weight contribution vectors, 0..1.
 * Both vectors are non-negative, so the result never goes below 0.
 * A vector of all zeros scores 0 against everything, including itself.
 */
export function contributionCosine(a: GroupWeights, b: GroupWeights): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const group of MUSCLE_GROUP_IDS) {
    const x = a[group] ?? 0;
    const y = b[group] ?? 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** The minimum an import candidate must carry to be scored for duplication. */
export interface DedupeCandidate {
  readonly name: string;
  readonly movementId: MovementId;
  readonly equipmentClass: EquipmentClass;
  readonly groupWeights: GroupWeights;
}

/** What the importer should do with a scored pair. Source: research PART G, G3. */
export type DuplicateVerdict = 'auto_merge' | 'human_review' | 'distinct';

/** Score at or above which a pair is merged automatically, and the merge logged. */
export const AUTO_MERGE_THRESHOLD = 0.92;
/** Score at or above which a pair enters the human review queue. */
export const HUMAN_REVIEW_THRESHOLD = 0.8;

/**
 * Import-time near-duplicate score, 0..1.
 *
 * `score = 0.45 * token_set_ratio + 0.25 * (same movement) +
 *          0.20 * (same equipment class) + 0.10 * cosine(groupWeights)`
 *
 * Source: research PART G, G3, weights verbatim. Used when seeding from an open
 * dataset, on user-submitted exercises, and on CSV imports from Strong, Hevy
 * and JEFIT — where measured name overlap between RepDB and free-exercise-db
 * was only 136 of 600, so name similarity alone is not enough.
 */
export function nearDuplicateScore(a: DedupeCandidate, b: DedupeCandidate): number {
  return (
    0.45 * tokenSetRatio(a.name, b.name) +
    0.25 * (a.movementId === b.movementId ? 1 : 0) +
    0.2 * (a.equipmentClass === b.equipmentClass ? 1 : 0) +
    0.1 * contributionCosine(a.groupWeights, b.groupWeights)
  );
}

/**
 * Maps a near-duplicate score to an action.
 * >= 0.92 auto-merge (logged), 0.80..0.92 human review, < 0.80 distinct.
 * Source: research PART G, G3.
 */
export function duplicateVerdict(score: number): DuplicateVerdict {
  if (score >= AUTO_MERGE_THRESHOLD) return 'auto_merge';
  if (score >= HUMAN_REVIEW_THRESHOLD) return 'human_review';
  return 'distinct';
}

/**
 * Scores a candidate against a catalog and returns every match at or above the
 * human-review threshold, best first.
 */
export function findNearDuplicates(
  candidate: DedupeCandidate,
  catalog: readonly DedupeCandidate[],
): Array<{ candidate: DedupeCandidate; score: number; verdict: DuplicateVerdict }> {
  return catalog
    .map((other) => {
      const score = nearDuplicateScore(candidate, other);
      return { candidate: other, score, verdict: duplicateVerdict(score) };
    })
    .filter((r) => r.verdict !== 'distinct')
    .sort((x, y) => y.score - x.score);
}

/** Returns the equipment class for an equipment id, for dedupe scoring. */
export function equipmentClassOf(id: EquipmentId): EquipmentClass {
  return EQUIPMENT[id].class;
}
