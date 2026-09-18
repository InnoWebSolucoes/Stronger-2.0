/**
 * Equipment taxonomy for Stronger 2.0: 44 items across 7 classes.
 *
 * Source: docs/research/exercise-taxonomy-muscle-equipment-pattern-models-.md,
 * PART B. Ids, labels, bar weights and availability are transcribed verbatim.
 *
 * Two modelling decisions carried over from the research:
 *  - Bench angle is a VARIANT on the movement, not a piece of equipment. wger
 *    models "Bench" and "Incline bench" as equipment; that is a modelling error
 *    we deliberately do not copy.
 *  - Cable attachment (rope, v-bar, d-handle...) is a separate axis, not
 *    equipment. It becomes a variant only where it renames the lift in common
 *    use (Rope Pushdown vs Bar Pushdown); otherwise it is a per-set note.
 *
 * All weights are KG. Kg is the canonical stored unit everywhere in this app;
 * display conversion happens at the render layer only.
 *
 * Pure TypeScript. No platform imports.
 */

/** The 7 equipment classes. Source: research PART B. */
export type EquipmentClass =
  | 'free_weight'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'band'
  | 'implement'
  | 'cardio_machine';

/** How commonly a piece of equipment is found in a gym. Source: research PART B. */
export type GymAvailability = 'ubiquitous' | 'common' | 'uncommon' | 'rare';

/**
 * How external load is added to this equipment. Determines how the set-log row
 * rounds an entered weight and whether a bar weight is added to it.
 *
 *  - `plates`      free weight loaded with plates; the implement has its own
 *                  bar weight that is ADDED to what the user enters per side.
 *  - `fixed`       one indivisible mass (a dumbbell, a kettlebell, a plate).
 *  - `stack`       a selectorized weight stack, stepped by the pin.
 *  - `bodyweight`  the body is the load; external weight is optional (dip belt,
 *                  vest) or negative (assist machine).
 *  - `elastic`     band tension. Not a kg quantity; never counted as volume.
 *  - `none`        the implement carries no load at all (a bench, a box).
 */
export type LoadBasis = 'plates' | 'fixed' | 'stack' | 'bodyweight' | 'elastic' | 'none';

/** One of the 44 equipment items. */
export interface EquipmentDef {
  readonly id: EquipmentId;
  readonly class: EquipmentClass;
  /** Display label, and the parenthesised suffix in a canonical name. */
  readonly label: string;
  readonly availability: GymAvailability;
  readonly loadBasis: LoadBasis;
  /**
   * Weight of the unloaded implement in KG, or `null` when it has none.
   * The user may override this per gym profile — silently wrong bar weight is
   * the single biggest source of bad volume numbers in competitor apps, so this
   * value is always surfaced, never hidden. Source: research PART B "BAR WEIGHT".
   */
  readonly barWeightKgDefault: number | null;
  /**
   * Smallest sensible weight change in KG, used to round a suggested or
   * auto-progressed load. Derived from real plate/stack/rack physics, stated
   * per item below; the research fixes bar weights but not increments.
   */
  readonly loadIncrementKg: number;
  /**
   * `true` when the weight the user types is the weight of ONE implement and
   * the exercise may use two (dumbbells, kettlebells, farmer's handles).
   * Volume math multiplies by the number of implements, not by 1.
   */
  readonly entryIsPerImplement: boolean;
}

/**
 * The 44 equipment items.
 *
 * `barWeightKgDefault` and `availability` are transcribed from research PART B.
 * `loadIncrementKg` rationale, applied uniformly:
 *  - plate-loaded bars: 2.5 kg (a pair of 1.25 kg plates, the smallest common pair)
 *  - loose plates: 1.25 kg (the smallest plate made)
 *  - dumbbells: 2.5 kg (commercial metric rack step)
 *  - kettlebells: 4 kg (the 8/12/16/20/24/28/32 kg competition progression)
 *  - selectorized stacks: 5 kg (standard stack plate)
 *  - plate-loaded machines: 2.5 kg (1.25 kg per side)
 *  - bodyweight equipment: 1.25 kg (the smallest plate you can hang off a dip belt)
 *  - bands / no-load items: 0 kg, because there is no honest kg increment
 */
export const EQUIPMENT = {
  // ── free_weight (17) ───────────────────────────────────────────────────────
  barbell: {
    id: 'barbell',
    class: 'free_weight',
    label: 'Barbell',
    availability: 'ubiquitous',
    loadBasis: 'plates',
    barWeightKgDefault: 20,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  dumbbell: {
    id: 'dumbbell',
    class: 'free_weight',
    label: 'Dumbbell',
    availability: 'ubiquitous',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: true,
  },
  kettlebell: {
    id: 'kettlebell',
    class: 'free_weight',
    label: 'Kettlebell',
    availability: 'common',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 4,
    entryIsPerImplement: true,
  },
  ez_bar: {
    id: 'ez_bar',
    class: 'free_weight',
    label: 'EZ Bar',
    availability: 'common',
    loadBasis: 'plates',
    barWeightKgDefault: 10,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  trap_bar: {
    id: 'trap_bar',
    class: 'free_weight',
    label: 'Trap Bar',
    availability: 'common',
    loadBasis: 'plates',
    barWeightKgDefault: 25,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  safety_squat_bar: {
    id: 'safety_squat_bar',
    class: 'free_weight',
    label: 'Safety Squat Bar',
    availability: 'uncommon',
    loadBasis: 'plates',
    barWeightKgDefault: 25,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  cambered_bar: {
    id: 'cambered_bar',
    class: 'free_weight',
    label: 'Cambered Bar',
    availability: 'rare',
    loadBasis: 'plates',
    barWeightKgDefault: 25,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  swiss_bar: {
    id: 'swiss_bar',
    class: 'free_weight',
    label: 'Swiss / Football Bar',
    availability: 'uncommon',
    loadBasis: 'plates',
    barWeightKgDefault: 20,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  axle_bar: {
    id: 'axle_bar',
    class: 'free_weight',
    label: 'Axle Bar',
    availability: 'rare',
    loadBasis: 'plates',
    barWeightKgDefault: 25,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  log_bar: {
    id: 'log_bar',
    class: 'free_weight',
    label: 'Log',
    availability: 'rare',
    loadBasis: 'plates',
    barWeightKgDefault: 50,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  weight_plate: {
    id: 'weight_plate',
    class: 'free_weight',
    label: 'Weight Plate',
    availability: 'ubiquitous',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  sandbag: {
    id: 'sandbag',
    class: 'free_weight',
    label: 'Sandbag',
    availability: 'uncommon',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  medicine_ball: {
    id: 'medicine_ball',
    class: 'free_weight',
    label: 'Medicine Ball',
    availability: 'common',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 1,
    entryIsPerImplement: false,
  },
  slam_ball: {
    id: 'slam_ball',
    class: 'free_weight',
    label: 'Slam Ball',
    availability: 'common',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 1,
    entryIsPerImplement: false,
  },
  atlas_stone: {
    id: 'atlas_stone',
    class: 'free_weight',
    label: 'Atlas Stone',
    availability: 'rare',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  macebell: {
    id: 'macebell',
    class: 'free_weight',
    label: 'Macebell',
    availability: 'rare',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 2,
    entryIsPerImplement: true,
  },
  indian_club: {
    id: 'indian_club',
    class: 'free_weight',
    label: 'Indian Club',
    availability: 'rare',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 0.5,
    entryIsPerImplement: true,
  },

  // ── machine (12) ───────────────────────────────────────────────────────────
  machine_selectorized: {
    id: 'machine_selectorized',
    class: 'machine',
    label: 'Machine',
    availability: 'ubiquitous',
    loadBasis: 'stack',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  machine_plate_loaded: {
    id: 'machine_plate_loaded',
    class: 'machine',
    label: 'Plate Loaded Machine',
    availability: 'common',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  smith_machine: {
    id: 'smith_machine',
    class: 'machine',
    label: 'Smith Machine',
    availability: 'common',
    loadBasis: 'plates',
    // Smith carriages are counterbalanced anywhere from 6 to 20 kg. The research
    // fixes 15 kg as the shipped default and requires it be user-overridable.
    barWeightKgDefault: 15,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  hack_squat_machine: {
    id: 'hack_squat_machine',
    class: 'machine',
    label: 'Hack Squat Machine',
    availability: 'common',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  leg_press_machine: {
    id: 'leg_press_machine',
    class: 'machine',
    label: 'Leg Press',
    availability: 'ubiquitous',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  pendulum_squat: {
    id: 'pendulum_squat',
    class: 'machine',
    label: 'Pendulum Squat',
    availability: 'rare',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  belt_squat: {
    id: 'belt_squat',
    class: 'machine',
    label: 'Belt Squat',
    availability: 'uncommon',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  reverse_hyper: {
    id: 'reverse_hyper',
    class: 'machine',
    label: 'Reverse Hyper',
    availability: 'uncommon',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  ghd: {
    id: 'ghd',
    class: 'machine',
    label: 'Glute Ham Developer',
    availability: 'uncommon',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  back_extension_bench: {
    id: 'back_extension_bench',
    class: 'machine',
    label: '45 Degree Back Extension',
    availability: 'common',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  assisted_machine: {
    id: 'assisted_machine',
    class: 'machine',
    label: 'Assisted Pull Up / Dip Machine',
    availability: 'common',
    loadBasis: 'stack',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  neck_machine: {
    id: 'neck_machine',
    class: 'machine',
    label: '4-Way Neck Machine',
    availability: 'rare',
    loadBasis: 'stack',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },

  // ── cable (3) ──────────────────────────────────────────────────────────────
  cable: {
    id: 'cable',
    class: 'cable',
    label: 'Cable',
    availability: 'ubiquitous',
    loadBasis: 'stack',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  functional_trainer: {
    id: 'functional_trainer',
    class: 'cable',
    label: 'Functional Trainer',
    availability: 'common',
    loadBasis: 'stack',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  lat_pulldown_station: {
    id: 'lat_pulldown_station',
    class: 'cable',
    label: 'Lat Pulldown',
    availability: 'ubiquitous',
    loadBasis: 'stack',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },

  // ── bodyweight (11) ────────────────────────────────────────────────────────
  bodyweight: {
    id: 'bodyweight',
    class: 'bodyweight',
    label: 'Bodyweight',
    availability: 'ubiquitous',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  pull_up_bar: {
    id: 'pull_up_bar',
    class: 'bodyweight',
    label: 'Pull Up Bar',
    availability: 'ubiquitous',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  dip_bars: {
    id: 'dip_bars',
    class: 'bodyweight',
    label: 'Dip Bars',
    availability: 'common',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  gymnastic_rings: {
    id: 'gymnastic_rings',
    class: 'bodyweight',
    label: 'Rings',
    availability: 'uncommon',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  parallettes: {
    id: 'parallettes',
    class: 'bodyweight',
    label: 'Parallettes',
    availability: 'uncommon',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  suspension_trainer: {
    id: 'suspension_trainer',
    class: 'bodyweight',
    label: 'Suspension Trainer',
    availability: 'common',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  ab_wheel: {
    id: 'ab_wheel',
    class: 'bodyweight',
    label: 'Ab Wheel',
    availability: 'common',
    loadBasis: 'bodyweight',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  bench: {
    id: 'bench',
    class: 'bodyweight',
    label: 'Bench',
    availability: 'ubiquitous',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  plyo_box: {
    id: 'plyo_box',
    class: 'bodyweight',
    label: 'Box',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  stability_ball: {
    id: 'stability_ball',
    class: 'bodyweight',
    label: 'Stability Ball',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  sliders: {
    id: 'sliders',
    class: 'bodyweight',
    label: 'Sliders / Valslides',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },

  // ── band (3) ───────────────────────────────────────────────────────────────
  resistance_band: {
    id: 'resistance_band',
    class: 'band',
    label: 'Resistance Band',
    availability: 'ubiquitous',
    loadBasis: 'elastic',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  mini_band: {
    id: 'mini_band',
    class: 'band',
    label: 'Mini Band',
    availability: 'common',
    loadBasis: 'elastic',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  chains: {
    id: 'chains',
    class: 'band',
    label: 'Chains',
    availability: 'rare',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },

  // ── implement (11) ─────────────────────────────────────────────────────────
  sled: {
    id: 'sled',
    class: 'implement',
    label: 'Sled / Prowler',
    availability: 'uncommon',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  yoke: {
    id: 'yoke',
    class: 'implement',
    label: 'Yoke',
    availability: 'rare',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },
  farmers_handles: {
    id: 'farmers_handles',
    class: 'implement',
    label: "Farmer's Handles",
    availability: 'uncommon',
    loadBasis: 'plates',
    barWeightKgDefault: null,
    loadIncrementKg: 2.5,
    entryIsPerImplement: true,
  },
  landmine: {
    id: 'landmine',
    class: 'implement',
    label: 'Landmine',
    availability: 'common',
    loadBasis: 'plates',
    // A landmine is a barbell in a pivot; the sleeve carries part of the bar's
    // weight, so the effective bar weight at the hands is roughly half of 20 kg.
    barWeightKgDefault: 10,
    loadIncrementKg: 2.5,
    entryIsPerImplement: false,
  },
  battle_ropes: {
    id: 'battle_ropes',
    class: 'implement',
    label: 'Battle Ropes',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  weighted_vest: {
    id: 'weighted_vest',
    class: 'implement',
    label: 'Weighted Vest',
    availability: 'uncommon',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 1,
    entryIsPerImplement: false,
  },
  dip_belt: {
    id: 'dip_belt',
    class: 'implement',
    label: 'Dip Belt',
    availability: 'common',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  neck_harness: {
    id: 'neck_harness',
    class: 'implement',
    label: 'Neck Harness',
    availability: 'rare',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  wrist_roller: {
    id: 'wrist_roller',
    class: 'implement',
    label: 'Wrist Roller',
    availability: 'uncommon',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 1.25,
    entryIsPerImplement: false,
  },
  grip_trainer: {
    id: 'grip_trainer',
    class: 'implement',
    label: 'Grip Trainer',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  tire: {
    id: 'tire',
    class: 'implement',
    label: 'Tire',
    availability: 'rare',
    loadBasis: 'fixed',
    barWeightKgDefault: null,
    loadIncrementKg: 5,
    entryIsPerImplement: false,
  },

  // ── cardio_machine (8) ─────────────────────────────────────────────────────
  treadmill: {
    id: 'treadmill',
    class: 'cardio_machine',
    label: 'Treadmill',
    availability: 'ubiquitous',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  rower: {
    id: 'rower',
    class: 'cardio_machine',
    label: 'Rowing Machine',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  air_bike: {
    id: 'air_bike',
    class: 'cardio_machine',
    label: 'Air Bike',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  stationary_bike: {
    id: 'stationary_bike',
    class: 'cardio_machine',
    label: 'Stationary Bike',
    availability: 'ubiquitous',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  elliptical: {
    id: 'elliptical',
    class: 'cardio_machine',
    label: 'Elliptical',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  stair_climber: {
    id: 'stair_climber',
    class: 'cardio_machine',
    label: 'Stair Climber',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  ski_erg: {
    id: 'ski_erg',
    class: 'cardio_machine',
    label: 'Ski Erg',
    availability: 'uncommon',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
  jump_rope: {
    id: 'jump_rope',
    class: 'cardio_machine',
    label: 'Jump Rope',
    availability: 'common',
    loadBasis: 'none',
    barWeightKgDefault: null,
    loadIncrementKg: 0,
    entryIsPerImplement: false,
  },
} as const satisfies Record<string, Omit<EquipmentDef, 'id'> & { id: string }>;

/** Stable identifier for one of the 44 equipment items. */
export type EquipmentId = keyof typeof EQUIPMENT;

/** All 44 equipment ids. */
export const EQUIPMENT_IDS = Object.keys(EQUIPMENT) as EquipmentId[];

/**
 * The cable attachment axis. NOT equipment — it is a variant only where it
 * renames the lift in common use (Rope Pushdown vs Bar Pushdown); otherwise it
 * is stored as a per-set note. Source: research PART B "CABLE ATTACHMENT".
 */
export type CableAttachment =
  | 'rope'
  | 'straight_bar'
  | 'ez_bar'
  | 'v_bar'
  | 'd_handle'
  | 'single_d'
  | 'lat_bar_wide'
  | 'ankle_strap'
  | 'tricep_v'
  | 'mag_grip'
  | 'stirrup'
  | 'belt';

/** All 12 cable attachments. Source: research PART B. */
export const CABLE_ATTACHMENTS: readonly CableAttachment[] = [
  'rope',
  'straight_bar',
  'ez_bar',
  'v_bar',
  'd_handle',
  'single_d',
  'lat_bar_wide',
  'ankle_strap',
  'tricep_v',
  'mag_grip',
  'stirrup',
  'belt',
] as const;

/** Display labels for the cable attachments, used as a second paren token. */
export const CABLE_ATTACHMENT_LABELS: Record<CableAttachment, string> = {
  rope: 'Rope',
  straight_bar: 'Bar',
  ez_bar: 'EZ Bar',
  v_bar: 'V Bar',
  d_handle: 'D Handle',
  single_d: 'Single D Handle',
  lat_bar_wide: 'Wide Bar',
  ankle_strap: 'Ankle Strap',
  tricep_v: 'V Handle',
  mag_grip: 'MAG Grip',
  stirrup: 'Stirrup',
  belt: 'Belt',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the definition of one of the 44 equipment items. */
export function getEquipment(id: EquipmentId): EquipmentDef {
  return EQUIPMENT[id];
}

/** Every equipment item in a class, in declaration order. */
export function equipmentByClass(cls: EquipmentClass): EquipmentDef[] {
  return EQUIPMENT_IDS.map((id) => EQUIPMENT[id]).filter((e) => e.class === cls);
}

/**
 * The unloaded implement weight in KG that must be ADDED to plates the user
 * entered per-side, or 0 when the equipment has none.
 *
 * @param id - equipment
 * @param overrideKg - the user's per-gym override, if they set one
 * @returns kg
 */
export function barWeightKg(id: EquipmentId, overrideKg?: number): number {
  if (overrideKg !== undefined) return overrideKg;
  return EQUIPMENT[id].barWeightKgDefault ?? 0;
}

/**
 * Rounds a weight in KG to the nearest increment this equipment can actually
 * be loaded to. Used by progression suggestions and plate math, never applied
 * to a weight the user typed by hand.
 *
 * Equipment with no meaningful kg increment (bands, benches, cardio machines)
 * returns the value unchanged rather than collapsing it to zero.
 *
 * @param id - equipment
 * @param kg - desired load in kg
 * @returns kg, rounded to the nearest loadable step
 */
export function roundToIncrement(id: EquipmentId, kg: number): number {
  const step = EQUIPMENT[id].loadIncrementKg;
  if (step <= 0) return kg;
  const rounded = Math.round(kg / step) * step;
  // Guard float drift: 2.5 * 3 is 7.5 but 0.1 * 3 is 0.30000000000000004.
  return Math.round(rounded * 1000) / 1000;
}

/**
 * Total kg moved for one rep given what the user entered.
 *
 * Handles the three ways entered weight maps to real load:
 *  - plate-loaded bars add the bar weight
 *  - per-implement equipment (dumbbells, kettlebells, handles) multiplies by
 *    the number of implements held
 *  - everything else is taken at face value
 *
 * This deliberately does NOT know about bodyweight; `bwFactor` lives on the
 * exercise record and is applied by the volume engine.
 *
 * @param id - equipment
 * @param enteredKg - what the user typed, in kg
 * @param opts.implements - how many implements are held (default 1)
 * @param opts.barWeightOverrideKg - the user's per-gym bar weight override
 * @param opts.includeBarWeight - false when the user enters total loaded weight
 *   rather than plates-per-side (default true)
 * @returns kg actually moved per rep, external load only
 */
export function externalLoadKg(
  id: EquipmentId,
  enteredKg: number,
  opts?: {
    implements?: number;
    barWeightOverrideKg?: number;
    includeBarWeight?: boolean;
  },
): number {
  const def = EQUIPMENT[id];
  const implementCount = opts?.implements ?? 1;
  const includeBar = opts?.includeBarWeight ?? true;

  let kg = enteredKg;
  if (def.entryIsPerImplement) kg *= implementCount;
  if (includeBar && def.loadBasis === 'plates') {
    kg += barWeightKg(id, opts?.barWeightOverrideKg);
  }
  return kg;
}

/**
 * Whether a given equipment item contributes a countable kg load at all.
 * Bands and no-load props do not: band tension is not a kg quantity and must
 * never be summed into a volume total.
 */
export function carriesKgLoad(id: EquipmentId): boolean {
  const basis = EQUIPMENT[id].loadBasis;
  return basis !== 'elastic' && basis !== 'none';
}
